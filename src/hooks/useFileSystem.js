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
    const [cacheVersion, setCacheVersion] = useState(0); // For cache busting after save

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

    const loadFolder = useCallback((folderPath, preserveIndex = false) => {
        const electronAPI = getElectronAPI();
        if (!electronAPI) return;

        try {
            const imageFiles = electronAPI.getFilesInDirectory(folderPath);

            if (imageFiles.length > 0) {
                setFiles(imageFiles);
                if (!preserveIndex) {
                    setCurrentIndex(0);
                }
                setCurrentPath(folderPath);

                // Bump cache version to force image reload in Sidebar
                if (preserveIndex) {
                    setCacheVersion(v => v + 1);
                    setThumbCache({});
                }

                // Prefetch thumbnails (limited set for performance)
                imageFiles.slice(0, 30).forEach(file => {
                    const img = new Image();
                    img.onload = () => {
                        setThumbCache(prev => ({ ...prev, [file]: `${img.src}?t=${Date.now()}` }));
                    };
                    img.src = `file://${file}?t=${Date.now()}`;
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
    }, []);

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

    // Load single file (from file association / command line)
    const loadFile = useCallback((filePath) => {
        const electronAPI = getElectronAPI();
        if (!electronAPI || !filePath) return;

        try {
            // Get the folder containing the file
            const folderPath = electronAPI.path.dirname(filePath);
            const imageFiles = electronAPI.getFilesInDirectory(folderPath);

            if (imageFiles.length > 0) {
                setFiles(imageFiles);
                setCurrentPath(folderPath);

                // Find the index of the opened file
                const fileIndex = imageFiles.findIndex(f => f === filePath);
                setCurrentIndex(fileIndex >= 0 ? fileIndex : 0);
            }
        } catch (err) {
            console.error("Failed to load file", err);
        }
    }, []);

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
        loadFile,
        nextImage,
        prevImage,
        selectImage,
        currentPath,
        currentMetadata,
        cacheVersion
    };
};
