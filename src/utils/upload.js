/**
 * Upload an image to urusai.cc
 * @param {string} dataUrl - Image data URL
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function uploadToUrusai(dataUrl) {
    try {
        // Convert data URL to blob
        const res = await fetch(dataUrl);
        const blob = await res.blob();

        const formData = new FormData();
        formData.append('file', blob, 'screenshot.png');

        // According to dukshot's PRD, the API endpoint is https://api.urusai.cc/v1/upload
        // Note: In a real app, the token should be stored securely or provided by the user.
        // For now, we'll try to use the public endpoint if available or assume it needs a token.
        const response = await fetch('https://api.urusai.cc/v1/upload', {
            method: 'POST',
            body: formData,
            // headers: {
            //     'Authorization': 'Bearer YOUR_TOKEN'
            // }
        });

        if (!response.ok) {
            throw new Error(`Upload failed with status ${response.status}`);
        }

        const data = await response.json();

        // Assuming the response contains the URL in a field like 'url' or 'data.url'
        if (data && data.url) {
            return { success: true, url: data.url };
        } else if (data && data.data && data.data.url) {
            return { success: true, url: data.data.url };
        } else {
            return { success: false, error: 'Unexpected API response format' };
        }

    } catch (err) {
        console.error('Upload error:', err);
        return { success: false, error: err.message };
    }
}
