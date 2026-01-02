# BUG REPORT: 優化後桌面資料夾無法載入

## 問題描述
優化後應用程式啟動時顯示 Dropzone（Select Image 畫面），而不是自動載入桌面資料夾的圖片。

## 根本原因分析

### 問題 1: `window.electronAPI` 在模組載入時為 `undefined`

**原因：** 在 `useFileSystem.js` 第 4 行：
```javascript
const electronAPI = window.electronAPI || null;
```

這行程式碼在**模組載入時**執行，但此時 preload script 可能還沒注入 `window.electronAPI`。

**為什麼之前可以運作：**
之前使用 `nodeIntegration: true`，`window.require('electron')` 是同步可用的。

**現在的問題：**
使用 `contextIsolation: true` + preload script 後，`window.electronAPI` 是由 preload 腳本異步注入的。當 React 應用的 JavaScript 模組開始載入時，preload 可能還沒完成注入。

### 問題 2: `useEffect` 依賴問題

在 `useFileSystem.js` 第 13-22 行：
```javascript
useEffect(() => {
    if (!electronAPI) return;  // electronAPI 是 null，直接 return
    try {
        const desktopPath = electronAPI.getDesktopPath();
        loadFolder(desktopPath);
    } catch (e) {
        console.error("Failed to load desktop", e);
    }
}, []);  // 空依賴陣列，只執行一次
```

由於 `electronAPI` 在模組載入時就被設為 `null`，且 useEffect 只在組件首次渲染時執行一次，所以永遠不會載入桌面資料夾。

### 問題 3: Dropzone 沒有「開啟資料夾」選項

`Dropzone.jsx` 只提供「Select Image」按鈕，它只能選擇單一圖片檔案，不能選擇資料夾。

## 修復方案

### 方案 A: 延遲檢查 electronAPI（推薦）

在 hook 內部動態檢查 `window.electronAPI`，而不是在模組載入時：

```javascript
// useFileSystem.js
export const useFileSystem = () => {
    // ... state declarations ...

    // 動態獲取 electronAPI
    const getElectronAPI = () => window.electronAPI || null;

    useEffect(() => {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            console.warn('electronAPI not available');
            return;
        }
        try {
            const desktopPath = electronAPI.getDesktopPath();
            loadFolder(desktopPath);
        } catch (e) {
            console.error("Failed to load desktop", e);
        }
    }, []);

    const loadFolder = useCallback((folderPath) => {
        const electronAPI = getElectronAPI();
        if (!electronAPI) return;
        // ... rest of code
    }, [thumbCache]);

    // ... rest of hook
};
```

### 方案 B: 加入 Dropzone 開啟資料夾按鈕

在 `Dropzone.jsx` 加入「Open Folder」按鈕：

```jsx
<Button variant="secondary" icon={Folder} onClick={onOpenFolder}>
    Open Folder
</Button>
```

### 方案 C: 使用 retry 機制

```javascript
useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10;

    const tryLoadDesktop = () => {
        const electronAPI = window.electronAPI;
        if (electronAPI) {
            const desktopPath = electronAPI.getDesktopPath();
            loadFolder(desktopPath);
        } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(tryLoadDesktop, 100);
        }
    };

    tryLoadDesktop();
}, []);
```

## 建議的完整修復

1. **修改 `useFileSystem.js`** - 使用動態檢查 + retry
2. **修改 `App.jsx`** - 傳遞 `onOpenFolder` 給 Dropzone
3. **修改 `Dropzone.jsx`** - 加入「開啟資料夾」按鈕

## 優先順序

1. 先修復 useFileSystem.js 的 electronAPI 動態檢查（解決自動載入桌面問題）
2. 再修復 Dropzone 的資料夾按鈕（提供手動選擇資料夾的備用方案）

## 測試步驟

1. 啟動應用程式
2. 確認自動載入桌面資料夾的圖片
3. 確認左側 Sidebar 顯示縮圖
4. 確認點擊「Open Folder」可以選擇其他資料夾
