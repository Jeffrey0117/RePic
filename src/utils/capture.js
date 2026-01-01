export async function captureScreen() {
    // Check if running in Electron with secure API
    if (!window.electronAPI) {
        alert("Screenshot only available in Electron mode");
        return null;
    }

    try {
        // 1. Hide window
        await window.electronAPI.hideWindow();

        // 2. Short delay to ensure window is gone
        await new Promise(r => setTimeout(r, 300));

        // 3. Get sources with thumbnails
        const sources = await window.electronAPI.getScreenSources();

        if (!sources || sources.length === 0) {
            throw new Error("No screen sources found");
        }

        // Use the first screen's thumbnail (usually primary)
        const dataUrl = sources[0].thumbnail;

        // 4. Show window
        await window.electronAPI.showWindow();

        return dataUrl;

    } catch (err) {
        console.error("Capture failed", err);
        // Ensure window comes back even if error
        await window.electronAPI.showWindow();
        return null;
    }
}
