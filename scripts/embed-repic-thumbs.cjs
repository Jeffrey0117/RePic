#!/usr/bin/env node
/**
 * Backfill embedded thumbnails into existing .repic files.
 *
 * A .repic is a JSON pointer with only a (usually remote) `url`, so Windows
 * Explorer shows the generic RePic icon for every one. This script downloads
 * each pointer's image, shrinks it to a small JPEG, and stores it under the
 * `thumb` key so the RePic shell thumbnail handler can render the real image.
 *
 * Rewriting the file changes its size/mtime, which invalidates Explorer's
 * thumbnail cache entry — so thumbnails refresh on their own afterwards.
 *
 * Usage:
 *   node scripts/embed-repic-thumbs.cjs "C:\path\to\folder" [--recursive] [--force]
 *
 *   --recursive   descend into subfolders
 *   --force       re-generate even if a `thumb` already exists
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.error('sharp is not available. Run this from the repic project root (npm install first).');
    process.exit(1);
}

const THUMB_MAX = 256; // longest edge in px
const CONCURRENCY = 8;

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const targetDir = positional[0];
const recursive = flags.has('--recursive');
const force = flags.has('--force');

if (!targetDir) {
    console.error('Usage: node scripts/embed-repic-thumbs.cjs "<folder>" [--recursive] [--force]');
    process.exit(2);
}
if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    console.error('Not a folder:', targetDir);
    process.exit(2);
}

function normalizeImageUrl(url) {
    // GitHub blob -> raw (mirrors the app's normalizer for common cases)
    const m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
    if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
    return url;
}

function download(url, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
        let u;
        try {
            u = new URL(url);
        } catch (e) {
            return reject(new Error('bad url'));
        }
        const protocol = u.protocol === 'https:' ? https : http;
        const options = {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                Referer: u.origin + '/',
            },
        };
        const req = protocol.get(url, options, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (redirectsLeft <= 0) return reject(new Error('too many redirects'));
                res.resume();
                const nextUrl = new URL(res.headers.location, url).toString();
                return resolve(download(nextUrl, redirectsLeft - 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('HTTP ' + res.statusCode));
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(30000, () => {
            req.destroy();
            reject(new Error('timeout'));
        });
    });
}

async function makeThumb(buffer) {
    const out = await sharp(buffer)
        .rotate()
        .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
}

function collectRepicFiles(dir) {
    const found = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (recursive) found.push(...collectRepicFiles(full));
        } else if (entry.name.toLowerCase().endsWith('.repic')) {
            found.push(full);
        }
    }
    return found;
}

async function processFile(filePath) {
    let data;
    try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        return { filePath, status: 'skip', reason: 'invalid JSON' };
    }
    if (data.thumb && !force) return { filePath, status: 'skip', reason: 'already has thumb' };
    if (!data.url || !/^https?:/i.test(data.url)) {
        return { filePath, status: 'skip', reason: 'no http url' };
    }
    try {
        const buf = await download(normalizeImageUrl(data.url));
        const thumb = await makeThumb(buf);
        const next = { ...data, thumb };
        fs.writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
        return { filePath, status: 'ok', bytes: thumb.length };
    } catch (e) {
        return { filePath, status: 'fail', reason: e.message };
    }
}

async function mapLimit(items, limit, mapper) {
    const results = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const i = next++;
            results[i] = await mapper(items[i], i);
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

(async () => {
    const files = collectRepicFiles(targetDir);
    if (files.length === 0) {
        console.log('No .repic files found in', targetDir);
        return;
    }
    console.log(`Found ${files.length} .repic file(s). Embedding thumbnails...`);
    let done = 0;
    const results = await mapLimit(files, CONCURRENCY, async (f) => {
        const r = await processFile(f);
        done++;
        const tag = r.status === 'ok' ? 'OK  ' : r.status === 'skip' ? 'SKIP' : 'FAIL';
        console.log(`[${done}/${files.length}] ${tag} ${path.basename(f)}${r.reason ? ' — ' + r.reason : ''}`);
        return r;
    });
    const ok = results.filter((r) => r.status === 'ok').length;
    const skip = results.filter((r) => r.status === 'skip').length;
    const fail = results.filter((r) => r.status === 'fail').length;
    console.log(`\nDone. embedded=${ok} skipped=${skip} failed=${fail}`);
    if (fail > 0) {
        console.log('Failed files (left unchanged, still show the icon):');
        results.filter((r) => r.status === 'fail').forEach((r) => console.log('  -', r.filePath, '::', r.reason));
    }
})();
