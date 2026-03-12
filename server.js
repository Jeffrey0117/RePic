import http from 'http';
import sharp from 'sharp';
import https from 'https';

const PORT = parseInt(process.env.PORT || '4013', 10);

// ─── Helpers ───

function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'REPIC/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImage(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getImageBuffer(body) {
  if (body.base64) return Buffer.from(body.base64, 'base64');
  if (body.url) return fetchImage(body.url);
  throw new Error('Provide url or base64');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

// ─── Image Processing ───

async function removeBackground(buf) {
  const image = sharp(buf);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const brightness = (r + g + b) / 3;
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
    if (brightness > 200 && saturation < 30) {
      data[i + 3] = 0;
    }
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function generateFavicon(buf) {
  const sizes = [16, 32, 180, 192, 512];
  const results = {};
  for (const size of sizes) {
    const resized = await sharp(buf)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    results[`${size}x${size}`] = resized.toString('base64');
  }
  return results;
}

async function resizeImage(buf, opts) {
  let pipeline = sharp(buf).resize(
    opts.width || null,
    opts.height || null,
    { fit: opts.fit || 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }
  );
  const fmt = opts.format || 'png';
  pipeline = pipeline[fmt === 'jpeg' ? 'jpeg' : fmt === 'webp' ? 'webp' : fmt === 'avif' ? 'avif' : 'png']();
  return pipeline.toBuffer();
}

async function convertImage(buf, opts) {
  const fmt = opts.format;
  const quality = opts.quality || undefined;
  let pipeline = sharp(buf);
  if (fmt === 'jpeg') pipeline = pipeline.jpeg({ quality });
  else if (fmt === 'webp') pipeline = pipeline.webp({ quality });
  else if (fmt === 'avif') pipeline = pipeline.avif({ quality });
  else pipeline = pipeline.png();
  return pipeline.toBuffer();
}

async function cropImage(buf, opts) {
  return sharp(buf)
    .extract({ left: opts.left, top: opts.top, width: opts.width, height: opts.height })
    .toBuffer();
}

async function getMetadata(buf) {
  const meta = await sharp(buf).metadata();
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    channels: meta.channels,
    hasAlpha: meta.hasAlpha,
    size: buf.length,
  };
}

async function compositeImages(body) {
  const baseBuf = body.base64
    ? Buffer.from(body.base64, 'base64')
    : await fetchImage(body.url);
  const overlayBuf = body.overlay_base64
    ? Buffer.from(body.overlay_base64, 'base64')
    : await fetchImage(body.overlay_url);

  const gravityMap = {
    north: 'north', south: 'south', east: 'east', west: 'west',
    northeast: 'northeast', northwest: 'northwest',
    southeast: 'southeast', southwest: 'southwest',
    centre: 'centre', center: 'centre',
  };

  const gravity = gravityMap[body.gravity] || 'southeast';
  let overlay = sharp(overlayBuf);
  if (body.opacity != null && body.opacity < 1) {
    const meta = await sharp(overlayBuf).metadata();
    const { data, info } = await sharp(overlayBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) {
      data[i] = Math.round(data[i] * body.opacity);
    }
    overlay = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  }
  const overlayPng = await overlay.png().toBuffer();

  return sharp(baseBuf)
    .composite([{ input: overlayPng, gravity }])
    .png()
    .toBuffer();
}

// ─── Routes ───

const routes = {
  'GET /api/health': async (_req, res) => {
    json(res, 200, { status: 'ok', service: 'repic' });
  },

  'POST /api/remove-background': async (req, res) => {
    const body = await readBody(req);
    const buf = await getImageBuffer(body);
    const result = await removeBackground(buf);
    json(res, 200, { base64: result.toString('base64'), format: 'png' });
  },

  'POST /api/favicon': async (req, res) => {
    const body = await readBody(req);
    const buf = await getImageBuffer(body);
    const favicons = await generateFavicon(buf);
    json(res, 200, { favicons });
  },

  'POST /api/resize': async (req, res) => {
    const body = await readBody(req);
    const buf = await getImageBuffer(body);
    const result = await resizeImage(buf, body);
    const fmt = body.format || 'png';
    json(res, 200, { base64: result.toString('base64'), format: fmt });
  },

  'POST /api/convert': async (req, res) => {
    const body = await readBody(req);
    if (!body.format) return json(res, 400, { error: 'format is required' });
    const buf = await getImageBuffer(body);
    const result = await convertImage(buf, body);
    json(res, 200, { base64: result.toString('base64'), format: body.format });
  },

  'POST /api/crop': async (req, res) => {
    const body = await readBody(req);
    if (body.left == null || body.top == null || body.width == null || body.height == null) {
      return json(res, 400, { error: 'left, top, width, height are required' });
    }
    const buf = await getImageBuffer(body);
    const result = await cropImage(buf, body);
    json(res, 200, { base64: result.toString('base64'), format: 'png' });
  },

  'POST /api/metadata': async (req, res) => {
    const body = await readBody(req);
    const buf = await getImageBuffer(body);
    const meta = await getMetadata(buf);
    json(res, 200, meta);
  },

  'POST /api/composite': async (req, res) => {
    const body = await readBody(req);
    const result = await compositeImages(body);
    json(res, 200, { base64: result.toString('base64'), format: 'png' });
  },
};

// ─── Server ───

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const key = `${req.method} ${url.pathname}`;
  const handler = routes[key];

  if (!handler) {
    return json(res, 404, { error: 'Not found' });
  }

  try {
    await handler(req, res);
  } catch (err) {
    console.error(`[repic] ${key} error:`, err.message);
    json(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`[repic] Image processing server running on port ${PORT}`);
});
