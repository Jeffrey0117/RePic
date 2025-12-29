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

        // 3. Get sources
        const sources = await ipcRenderer.invoke('get-desktop-sources');

        // Assume first screen for MVP
        const screenSource = sources[0];

        // 4. Get stream
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: screenSource.id,
                    minWidth: 1280,
                    maxWidth: 8000,
                    minHeight: 720,
                    maxHeight: 8000
                }
            }
        });

        // 5. Create video element to grab frame
        const video = document.createElement('video');
        video.srcObject = stream;

        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                // crucial delay: wait for first frame to actually render
                setTimeout(resolve, 500);
            };
        });

        // 6. Draw to canvas
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        // If it's still grey, try to draw multiple times or wait longer
        ctx.drawImage(video, 0, 0);

        // 7. Cleanup
        stream.getTracks().forEach(t => t.stop());
        video.pause();
        video.srcObject = null;
        video.remove();

        // 8. Result
        const dataUrl = canvas.toDataURL('image/png');

        // 9. Show window
        await ipcRenderer.invoke('show-window');

        return dataUrl;

    } catch (err) {
        console.error("Capture failed", err);
        // Ensure window comes back even if error
        await ipcRenderer.invoke('show-window');
        return null;
    }
}
