import { useState, useEffect, useCallback } from 'react';

// Dynamic getter for electronAPI (injected via preload script)
// Must be called at runtime, not at module load time
const getElectronAPI = () => window.electronAPI || null;

export const useFileSystem = () => {
    const [files, setFiles] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [currentPath, setCurrentPath] = useState(null);
    const [currentMetadata, setCurrentMetadata] = useState(null);
    const [thumbCache, setThumbCache] = useState({}); // Simple memory cache

    // Initial Load - Desktop with retry mechanism
    useEffect(() => {
        let attempts = 0;
        const maxAttempts = 20; // Try for 2 seconds max

        const tryLoadDesktop = () => {
            const electronAPI = getElectronAPI();
            if (electronAPI) {
                try {
                    const desktopPath = electronAPI.getDesktopPath();
                    loadFolder(desktopPath);
                } catch (e) {
                    console.error("Failed to load desktop", e);
                }
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(tryLoadDesktop, 100);
            } else {
                console.warn('electronAPI not available after retries');
            }
        };

        tryLoadDesktop();
    }, []);

    const loadFolder = useCallback((folderPath) => {
        const electronAPI = getElectronAPI();
        if (!electronAPI) return;

        try {
            const imageFiles = electronAPI.getFilesInDirectory(folderPath);

            if (imageFiles.length > 0) {
                setFiles(imageFiles);
                setCurrentIndex(0);
                setCurrentPath(folderPath); // Track current folder

                // Prefetch thumbnails (limited set for performance)
                imageFiles.slice(0, 30).forEach(file => {
                    if (!thumbCache[file]) {
                        const img = new Image();
                        img.onload = () => {
                            setThumbCache(prev => ({ ...prev, [file]: img.src }));
                        };
                        img.src = `file://${file}`;
                    }
                });
            } else {
                setFiles([]);
                setCurrentIndex(-1);
                setCurrentPath(folderPath);
            }
        } catch (err) {
            console.error("Failed to read dir", err);
            setFiles([]);
            setCurrentIndex(-1);
        }
    }, [thumbCache]);

    const nextImage = useCallback(() => {
        if (files.length === 0) return null;
        setCurrentIndex(prev => (prev + 1) % files.length);
    }, [files]);

    const prevImage = useCallback(() => {
        if (files.length === 0) return null;
        setCurrentIndex(prev => (prev - 1 + files.length) % files.length);
    }, [files]);

    const selectImage = useCallback((index) => {
        if (index >= 0 && index < files.length) {
            setCurrentIndex(index);
        }
    }, [files]);

    const currentImage = files[currentIndex] || null;

    useEffect(() => {
        const electronAPI = getElectronAPI();
        if (!currentImage || !electronAPI) {
            setCurrentMetadata(null);
            return;
        }

        const fetchInfo = async () => {
            const info = await electronAPI.getFileMetadata(currentImage);
            if (info) {
                // Also try to get image dimensions
                const img = new Image();
                img.onload = () => {
                    setCurrentMetadata({
                        ...info,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    });
                };
                img.src = `file://${currentImage}`;
            }
        };

        fetchInfo();
    }, [currentImage]);

    return {
        files,
        currentIndex,
        currentImage,
        loadFolder,
        nextImage,
        prevImage,
        selectImage,
        currentPath,
        currentMetadata
    };
};
