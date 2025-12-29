export async function captureScreen() {
    // Check if running in Electron
    if (!window.require) {
        alert("Screenshot only available in Electron mode");
        return null;
    }

    const { ipcRenderer } = window.require('electron');

    try {
        // 1. Hide window
        await ipcRenderer.invoke('hide-window');

        // 2. Short delay to ensure window is gone
        await new Promise(r => setTimeout(r, 300));

        // 3. Get sources with thumbnails
        const sources = await ipcRenderer.invoke('get-desktop-sources');

        if (!sources || sources.length === 0) {
            throw new Error("No screen sources found");
        }

        // Use the first screen's thumbnail (usually primary)
        const dataUrl = sources[0].thumbnail;

        // 4. Show window
        await ipcRenderer.invoke('show-window');

        return dataUrl;

    } catch (err) {
        console.error("Capture failed", err);
        // Ensure window comes back even if error
        await ipcRenderer.invoke('show-window');
        return null;
    }
}
