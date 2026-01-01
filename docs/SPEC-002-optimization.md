# SPEC-002: Repic Application Optimization

## Overview
Comprehensive optimization plan to make Repic smaller, cleaner, and faster.

## Current Metrics
| Metric | Current Value |
|--------|---------------|
| Web Bundle (JS+CSS) | 428 KB |
| node_modules | 738 MB |
| Installer Size | 78 MB |
| Unpacked App | 295 MB |
| Total Source LOC | 2,357 |
| Components | 22 |

## Optimization Goals
- Reduce installer size by 20-30%
- Eliminate duplicate code
- Improve startup and runtime performance
- Enhance security posture
- Clean codebase for maintainability

---

## Phase 1: Code Deduplication

### 1.1 Extract Shared Drawing Utilities
**Problem:** `drawArrow()` and annotation rendering duplicated in:
- `src/features/editor/AnnotationLayer.jsx`
- `src/features/editor/utils/canvasUtils.js`

**Solution:** Create shared module `src/features/editor/utils/drawingHelpers.js`

```javascript
// Extract common drawing functions:
// - drawArrow(ctx, annotation)
// - drawRect(ctx, annotation)
// - drawCircle(ctx, annotation)
// - drawBlur(ctx, annotation, canvas)
// - setupStrokeStyle(ctx, color, width)
```

**Expected Savings:** ~60 LOC reduction

### 1.2 Create Constants File
**Problem:** Magic numbers scattered throughout code

**Solution:** Create `src/constants/drawing.js`
```javascript
export const STROKE_WIDTH = 3;
export const BLUR_AMOUNT = 10;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.15;
```

---

## Phase 2: Bundle Optimization

### 2.1 Electron Builder Optimization
**Current electron-builder config lacks optimization**

**Add to package.json build config:**
```json
{
  "build": {
    "asar": true,
    "compression": "maximum",
    "files": [
      "dist/**/*",
      "electron/**/*",
      "!node_modules/**/*"
    ],
    "asarUnpack": [],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ]
    },
    "nsis": {
      "oneClick": true,
      "perMachine": false,
      "deleteAppDataOnUninstall": true
    }
  }
}
```

### 2.2 Vite Build Optimization
**Add to vite.config.js:**
```javascript
build: {
  target: 'esnext',
  minify: 'esbuild',
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom'],
        'vendor-motion': ['framer-motion'],
        'vendor-icons': ['lucide-react']
      }
    }
  }
}
```

### 2.3 Dependency Optimization
**Review and optimize:**
- Consider `@iconify/react` instead of `lucide-react` for tree-shaking
- Use CSS animations for simple transitions instead of framer-motion where possible
- Lazy load heavy components

---

## Phase 3: Electron Optimization

### 3.1 Security Hardening
**Current Issues (electron/main.cjs):**
```javascript
// INSECURE - Current
contextIsolation: false,
nodeIntegration: true,
webSecurity: false
```

**Solution: Use preload script with contextBridge**

Create `electron/preload.cjs`:
```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  batchCropSave: (data) => ipcRenderer.invoke('batch-crop-save', data),
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  getFileMetadata: (path) => ipcRenderer.invoke('get-file-metadata', path),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  getFilesInDirectory: (path) => ipcRenderer.invoke('get-files-in-directory', path)
});
```

Update main.cjs:
```javascript
webPreferences: {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true
}
```

### 3.2 IPC Input Validation
Add validation to all IPC handlers:
```javascript
ipcMain.handle('save-file', async (event, { filePath, imageData }) => {
  // Validate inputs
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }
  if (!imageData || !imageData.startsWith('data:image/')) {
    throw new Error('Invalid image data');
  }
  // Sanitize path
  const safePath = path.normalize(filePath);
  // ... rest of implementation
});
```

### 3.3 Window Configuration Optimization
```javascript
const mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  show: false, // Don't show until ready
  backgroundColor: '#0a0a0f',
  webPreferences: { /* ... */ }
});

mainWindow.once('ready-to-show', () => {
  mainWindow.show();
});
```

---

## Phase 4: React Performance

### 4.1 Optimize useI18n Hook
**Problem:** Force update pattern causes unnecessary re-renders

**Solution:** Use React Context properly
```javascript
// src/i18n/I18nContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { getLanguage, setLanguage as setLang, subscribe, t } from './index';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(getLanguage);

  useEffect(() => {
    return subscribe(setLanguageState);
  }, []);

  const setLanguage = (lang) => setLang(lang);

  return (
    <I18nContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
```

### 4.2 Component Memoization
Apply React.memo to expensive components:
```javascript
// ThumbnailList - renders many items
export const ThumbnailList = memo(({ images, currentIndex, onSelect, selectedIndexes }) => {
  // ...
});

// InfoPanel - static display
export const InfoPanel = memo(({ metadata }) => {
  // ...
});
```

### 4.3 Lazy Loading
```javascript
// App.jsx
const BatchCropModal = lazy(() => import('./components/ui/BatchCropModal'));
const CaptureOverlay = lazy(() => import('./features/capture/CaptureOverlay'));
const ImageCropper = lazy(() => import('./features/editor/ImageCropper'));
```

---

## Phase 5: Code Cleanup

### 5.1 Remove Unused TopBar Elements
Current placeholder buttons with no implementation:
- Copy button (empty onClick)
- Search/Zoom button
- Gallery View button
- Settings button

**Action:** Remove or implement these features

### 5.2 Clean Unused Imports
Review all files for unused imports, especially:
- TopBar.jsx lucide-react icons
- Any unused React hooks

### 5.3 Consolidate Utility Functions
Move scattered utilities to proper locations:
- Image processing utils -> `src/utils/imageUtils.js`
- File system utils -> `src/utils/fileUtils.js`
- Canvas utils -> `src/utils/canvasUtils.js`

---

## Implementation Checklist

### Agent 1: Drawing Code Refactor
- [ ] Create `src/features/editor/utils/drawingHelpers.js`
- [ ] Extract drawArrow, drawRect, drawCircle, drawBlur
- [ ] Update AnnotationLayer.jsx to use shared module
- [ ] Update canvasUtils.js to use shared module
- [ ] Create `src/constants/drawing.js`

### Agent 2: Electron Optimization
- [ ] Update electron-builder config for smaller builds
- [ ] Add compression and ASAR optimization
- [ ] Test build size reduction

### Agent 3: Security & Preload
- [ ] Create `electron/preload.cjs`
- [ ] Update main.cjs with contextIsolation
- [ ] Update renderer to use window.electronAPI
- [ ] Add IPC input validation

### Agent 4: React Performance
- [ ] Refactor useI18n to Context pattern
- [ ] Add React.memo to heavy components
- [ ] Implement lazy loading for modals

### Agent 5: Code Cleanup
- [ ] Remove unused TopBar buttons/imports
- [ ] Clean unused imports across codebase
- [ ] Consolidate utility functions

---

## Expected Results

| Metric | Current | Target |
|--------|---------|--------|
| Installer Size | 78 MB | ~55-60 MB |
| Unpacked App | 295 MB | ~220 MB |
| Bundle Size | 428 KB | ~350 KB |
| Source LOC | 2,357 | ~2,100 |
| Security Score | Low | High |

## Notes
- All changes should be backward compatible
- Test each phase before proceeding
- Maintain existing functionality
