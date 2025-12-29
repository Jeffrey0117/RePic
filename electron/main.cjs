const { app, BrowserWindow, Menu, ipcMain, desktopCapturer, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#000000',
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        }
    });

    Menu.setApplicationMenu(null);

    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    // Try multiple ports if default is busy, but for now hardcode or use arg
    const startUrl = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}`;

    mainWindow.loadURL(startUrl);

    // Handle port fallback manually if needed, but wait-on usually handles 5174.
    // Ideally passed via env var.
}

ipcMain.handle('hide-window', () => {
    mainWindow.minimize(); // or hide()
    // mainWindow.hide() is better for screenshot so it completely disappears.
    // But minimize works too. Let's use hide to be instant.
    mainWindow.hide();
    return true;
});

ipcMain.handle('show-window', () => {
    mainWindow.show();
    mainWindow.focus();
    return true;
});

ipcMain.handle('get-desktop-sources', async () => {
    // Get primary display resolution for high-res thumbnail
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
            width: width * primaryDisplay.scaleFactor,
            height: height * primaryDisplay.scaleFactor
        }
    });

    // We return the thumbnail as a data URL so it's ready to use in the renderer
    return sources.map(s => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL()
    }));
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

ipcMain.handle('get-file-info', async (event, filePath) => {
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
    try {
        const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
        fs.writeFileSync(filePath, buffer);
        return { success: true };
    } catch (e) {
        console.error("Failed to save file", e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('show-save-dialog', async (event, defaultPath) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath,
        filters: [
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
        ]
    });
    return result;
});

app.whenReady().then(() => {
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
