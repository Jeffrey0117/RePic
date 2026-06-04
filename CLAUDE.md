# RePic

Desktop image viewer/manager that rethinks storage: web images live as **Virtual Albums** (0 KB) or tiny `.repic` shortcut files (<1 KB) instead of full downloads.

## Stack
- **Runtime**: Electron 31 (main: `electron/main.cjs`)
- **Frontend**: React 19 + Vite 7 (JavaScript/JSX, ESM `"type": "module"`)
- **Styling**: TailwindCSS v4 (via `@tailwindcss/postcss`)
- **Image processing**: Sharp (Node, in Electron main) + a Go helper binary
- **Cropping**: react-image-crop · **Virtual scrolling**: react-window
- **Native helpers**: Go scraper (`scraper/`), Rust util (`cdevsaveclaudenode/`)
- **Lint**: ESLint 9 (flat config, react-hooks + react-refresh)
- **Packaging**: electron-builder (NSIS, Windows-only target)

## Directory structure

```
electron/        ← Electron main, preload (IPC bridge via window.electronAPI), start
src/
  main.jsx       ← React entry; App.jsx ← root component
  components/    ← icons/ (custom SVG, no emoji), ui/ (dialogs, toolbars, sidebar)
  features/      ← album/, editor/ (crop, annotation), viewer/, pokkit/
  hooks/         ← useFileSystem, useWebAlbums, usePokkit, useI18n, useLetMeUse...
  contexts/      ← ThemeContext (dark/light)
  i18n/          ← I18nContext + strings (en / zh-TW)
  lib/           ← motion/ (in-house animation), pokkitApi
  utils/         ← repicFile, imageLoader, thumbnailCache (IndexedDB), offlineCache, prefetchManager
  constants/     ← drawing constants
scraper/         ← Go: image scrape, batch download, thumbnail, crop, compress, prefetch (NDJSON CLI)
scripts/         ← post-build.cjs, remove-background.js, rcedit.exe
docs/            ← SPEC, ROADMAP, virtual-image-spec, marketing site (index/intro.html)
```

## Key concepts

- **Virtual Albums**: web image collections stored as URLs in memory/IndexedDB, zero disk. Browse/crop/annotate as if local.
- **.repic file format (v2)**: tiny JSON shortcut `{ v, type, url, crop }`. Read/write/batch-export via `src/utils/repicFile.js`.
- **Electron main responsibilities** (`electron/main.cjs`): downloads images to temp dir (1h expiry), extracts direct image URL from HTML (og:image / raw links), hotlink-bypass proxy, Sharp processing, drag-to-share temp files.
- **Go scraper CLI**: invoked by main process for performance-critical batch ops (download with connection pooling, thumbnails, crop, compress). Flags-driven, streams NDJSON.
- **Non-destructive editing**: crop/annotate/mosaic never touch originals (`features/editor/`).
- **Cloud upload**: local image → cloud (urusai.cc / pokkit) → `.repic` virtualization.
- **Caching layers**: `thumbnailCache` (IndexedDB), `offlineCache`, `prefetchManager` (window prefetch), virtual scrolling for large albums.
- **i18n**: English / Traditional Chinese via `src/i18n`.
- **Integrations**: pokkit (storage) and LetMeUse (auth) hooks present.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (browser, port 3000) |
| `npm run electron:dev` | Vite + Electron together (concurrently + wait-on) |
| `npm run build` | Vite production build → `dist/` |
| `npm run electron:build` | Build + electron-builder NSIS installer → `release/` + post-build |
| `npm run preview` | Preview the Vite build |
| `npm run lint` | ESLint over the project |

Go scraper: build/run from `scraper/` (`go build` / `go run main.go -url ...`). Requires Windows 10+ for the packaged app.

## Coding rules

- **Icons**: use the custom SVG icon components in `src/components/icons/` — no emoji.
- **Immutability**: create new objects, never mutate state.
- **File organization**: small focused files; group by feature (`features/`) not by type.
- **JSX**: function components + hooks; lazy-load heavy components (editor, batch crop) via `React.lazy`.
- **Renderer ↔ main**: cross the boundary only through `window.electronAPI` (preload bridge), never direct Node access in the renderer.
