const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// V8 Startup Optimization
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');
// Enable V8 code cache for faster startup
app.commandLine.appendSwitch('js-flags', '--use-strict');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

let mainWindow;
let fileToOpen = null; // File path from command line or file association

// Single instance lock - prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    // Handle second instance (when user opens another file while app is running)
    app.on('second-instance', (_event, commandLine) => {
        // Find image file from command line args
        const filePath = commandLine.find(arg => {
            if (arg.startsWith('-') || arg.startsWith('--')) return false;
            const ext = path.extname(arg).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext);
        });

        if (filePath && mainWindow) {
            // Send file to renderer
            mainWindow.webContents.send('open-file', filePath);
            // Focus the window
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Get file from command line args (first launch)
function getFileFromArgs() {
    const args = process.argv.slice(app.isPackaged ? 1 : 2);
    return args.find(arg => {
        if (arg.startsWith('-') || arg.startsWith('--')) return false;
        const ext = path.extname(arg).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext);
    });
}

// Input validation helpers
function isValidPath(filePath) {
    if (typeof filePath !== 'string') return false;
    if (filePath.length === 0 || filePath.length > 32767) return false;
    // Note: Path traversal protection is handled by the preload script's limited API
    return true;
}

function isValidBase64Data(data) {
    if (typeof data !== 'string') return false;
    return data.startsWith('data:image/');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'Repic',
        backgroundColor: '#000000',
        titleBarStyle: 'hiddenInset',
        icon: path.join(__dirname, '../repic-logo.png'),
        show: true, // Show immediately for faster perceived startup
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // Allow Node.js modules in preload script
            webSecurity: false // Keep false for local file access (file:// protocol)
        }
    });

    Menu.setApplicationMenu(null);

    const isDev = !app.isPackaged;

    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Send file to open when renderer is ready
    mainWindow.webContents.once('did-finish-load', () => {
        if (fileToOpen) {
            mainWindow.webContents.send('open-file', fileToOpen);
            fileToOpen = null;
        }
    });
}

function setupIpcHandlers() {
    ipcMain.handle('select-directory', async () => {
        if (!mainWindow) return null;
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        if (result.canceled) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('get-file-info', async (event, filePath) => {
        // Input validation
        if (!isValidPath(filePath)) {
            console.error('Invalid file path provided to get-file-info');
            return null;
        }

        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                birthtime: stats.birthtime,
                mtime: stats.mtime
            };
        } catch (e) {
            console.error("Failed to get file info", e);
            return null;
        }
    });

    ipcMain.handle('save-file', async (event, { filePath, base64Data }) => {
        // Input validation
        if (!isValidPath(filePath)) {
            return { success: false, error: 'Invalid file path' };
        }
        if (!isValidBase64Data(base64Data)) {
            return { success: false, error: 'Invalid image data format' };
        }

        try {
            const base64Content = base64Data.split(',')[1];
            if (!base64Content) {
                return { success: false, error: 'Invalid base64 content' };
            }
            const buffer = Buffer.from(base64Content, 'base64');
            fs.writeFileSync(filePath, buffer);
            return { success: true };
        } catch (e) {
            console.error("Failed to save file", e);
            return { success: false, error: e.message };
        }
    });

    ipcMain.handle('show-save-dialog', async (event, defaultPath) => {
        if (!mainWindow) return { canceled: true };

        // Basic validation for defaultPath
        if (defaultPath && typeof defaultPath !== 'string') {
            defaultPath = undefined;
        }

        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath,
            filters: [
                { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
            ]
        });
        return result;
    });

    // Native crop - not available (using browser canvas instead)
    ipcMain.handle('native-crop', async () => {
        return { success: false, error: 'Native processing not available', fallback: true };
    });

    // Check if native processing is available
    ipcMain.handle('native-available', () => {
        return { available: false };
    });

    // Batch crop - save cropped image data to file
    ipcMain.handle('batch-crop-save', async (event, { filePath, base64Data, outputMode, originalPath, customDir }) => {
        console.log('[batch-crop-save] Received:', { filePath, outputMode, originalPath, customDir, hasBase64: !!base64Data });

        // Input validation
        if (!isValidPath(filePath)) {
            return { success: false, error: 'Invalid file path' };
        }
        if (!isValidBase64Data(base64Data)) {
            return { success: false, error: 'Invalid image data format' };
        }
        if (originalPath && !isValidPath(originalPath)) {
            return { success: false, error: 'Invalid original path' };
        }
        if (customDir && !isValidPath(customDir)) {
            return { success: false, error: 'Invalid custom directory' };
        }
        if (!['replace', 'folder', 'custom'].includes(outputMode)) {
            return { success: false, error: 'Invalid output mode' };
        }

        try {
            let targetPath = filePath;

            if (outputMode === 'custom' && customDir) {
                // Save to user-selected directory
                if (!fs.existsSync(customDir)) {
                    fs.mkdirSync(customDir, { recursive: true });
                }
                targetPath = path.join(customDir, path.basename(originalPath || filePath));
            } else if (outputMode === 'folder') {
                // Create "cropped" subfolder
                const dir = path.dirname(originalPath || filePath);
                const croppedDir = path.join(dir, 'cropped');
                if (!fs.existsSync(croppedDir)) {
                    fs.mkdirSync(croppedDir, { recursive: true });
                }
                targetPath = path.join(croppedDir, path.basename(originalPath || filePath));
            }

            console.log('[batch-crop-save] Writing to:', targetPath);
            const base64Content = base64Data.split(',')[1];
            if (!base64Content) {
                return { success: false, error: 'Invalid base64 content' };
            }
            const buffer = Buffer.from(base64Content, 'base64');
            fs.writeFileSync(targetPath, buffer);
            console.log('[batch-crop-save] Success!');
            return { success: true, path: targetPath };
        } catch (e) {
            console.error("[batch-crop-save] Failed:", e.message);
            return { success: false, error: e.message };
        }
    });
}

app.whenReady().then(() => {
    // Get file from command line (for file association)
    fileToOpen = getFileFromArgs();

    setupIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
