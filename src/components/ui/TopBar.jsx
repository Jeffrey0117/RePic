import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from '../../lib/motion';
import {
    FolderOpen,
    Info,
    Globe,
    Sun,
    Moon,
    Album
} from '../icons';
import { Button } from './Button';
import useI18n from '../../hooks/useI18n';
import { useTheme } from '../../contexts/ThemeContext';

const electronAPI = window.electronAPI || null;

// Sidebar toggle icon
const PanelLeft = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
    </svg>
);

// Panel bottom icon
const PanelBottom = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 15h18" />
    </svg>
);

// Pin icon for always on top
const Pin = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 17v5" />
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 1 1-1h1V3H7v2h1a1 1 0 0 1 1 1z" />
    </svg>
);

// Link/URL icon
const Link = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);

// X close icon
const X = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);

// Help/About icon
const HelpCircle = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
    </svg>
);

export const TopBar = ({ currentPath, onOpenFolder, showInfoPanel, onToggleInfo, viewMode, onToggleViewMode, selectedAlbum, onAddAlbumImage, albumSidebarCollapsed, onToggleAlbumSidebar, sidebarPosition, onToggleSidebarPosition, onAbout }) => {
    const { t, language, setLanguage } = useI18n();
    const { theme, toggleTheme } = useTheme();
    const [urlInput, setUrlInput] = useState('');
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

    // Load initial always on top state
    useEffect(() => {
        if (electronAPI?.getAlwaysOnTop) {
            electronAPI.getAlwaysOnTop().then(result => {
                if (result.success) {
                    setIsAlwaysOnTop(result.isAlwaysOnTop);
                }
            });
        }
    }, []);

    const toggleAlwaysOnTop = async () => {
        console.log('[TopBar] toggleAlwaysOnTop called, current:', isAlwaysOnTop);
        if (electronAPI?.setAlwaysOnTop) {
            const result = await electronAPI.setAlwaysOnTop(!isAlwaysOnTop);
            console.log('[TopBar] setAlwaysOnTop result:', result);
            if (result.success) {
                setIsAlwaysOnTop(result.isAlwaysOnTop);
            }
        } else {
            console.log('[TopBar] electronAPI.setAlwaysOnTop not available');
        }
    };

    // Get folder name using electronAPI or fallback
    const getFolderName = () => {
        if (viewMode === 'album') {
            return selectedAlbum?.name || t('selectOrCreateAlbum');
        }
        if (!currentPath) return t('openFolder');
        if (electronAPI && electronAPI.path) {
            return electronAPI.path.basename(currentPath);
        }
        // Fallback to simple string parsing
        return currentPath.split(/[\\/]/).pop() || currentPath;
    };

    const folderName = getFolderName();

    const handleAddUrl = (e) => {
        e.preventDefault();
        if (urlInput.trim() && onAddAlbumImage) {
            // Support multiple URLs (newline or comma separated)
            const urls = urlInput.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
            urls.forEach(url => onAddAlbumImage(url));
            setUrlInput('');
        }
    };

    const handlePaste = (e) => {
        const pastedText = e.clipboardData.getData('text');
        if (pastedText) {
            const urls = pastedText.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
            if (urls.length > 0 && urls.every(url => url.startsWith('http'))) {
                e.preventDefault();
                urls.forEach(url => onAddAlbumImage(url));
            }
        }
    };

    const nextLang = language === 'en' ? 'zh-TW' : 'en';
    const langDisplay = language === 'en' ? 'EN' : '中';

    return (
        <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`h-14 w-full backdrop-blur-xl border-b flex items-center justify-between px-6 z-30 ${
                theme === 'dark'
                    ? 'bg-surface/30 border-white/5'
                    : 'bg-white/80 border-black/10'
            }`}
        >
            {/* Left: Folder/Album Info */}
            <div className="flex items-center gap-2">
                {/* Album sidebar toggle - only in album mode */}
                {viewMode === 'album' && (
                    <button
                        onClick={onToggleAlbumSidebar}
                        className={`p-2 rounded-lg transition-all ${
                            albumSidebarCollapsed
                                ? 'bg-primary/20 text-primary'
                                : theme === 'dark'
                                    ? 'hover:bg-white/10 text-white/60'
                                    : 'hover:bg-black/10 text-gray-500'
                        }`}
                        title={albumSidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
                    >
                        <PanelLeft size={18} />
                    </button>
                )}

                <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border ${
                        viewMode === 'album' ? '' : 'cursor-pointer'
                    } ${
                        theme === 'dark'
                            ? 'bg-white/5 hover:bg-white/10 border-white/5'
                            : 'bg-black/5 hover:bg-black/10 border-black/10'
                    }`}
                    onClick={viewMode === 'local' ? onOpenFolder : undefined}
                >
                    {viewMode === 'album' ? (
                        <Album size={16} className="text-primary" />
                    ) : (
                        <FolderOpen size={16} className="text-primary" />
                    )}
                    <span className={`text-xs font-medium max-w-[150px] truncate ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>{folderName}</span>
                </div>

                {/* Add URL button - Album mode only */}
                {viewMode === 'album' && selectedAlbum && (
                    <button
                        onClick={() => setShowUrlModal(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            theme === 'dark'
                                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                : 'bg-primary/10 text-primary hover:bg-primary/20'
                        }`}
                    >
                        <Link size={14} />
                        {t('addUrl')}
                    </button>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
                {/* Mode toggle */}
                <Button
                    variant="ghost"
                    className={`h-9 px-3 rounded-lg flex items-center gap-2 transition-all ${
                        viewMode === 'album'
                            ? 'bg-primary/20 text-primary'
                            : theme === 'dark'
                                ? 'hover:bg-white/10 text-white/70'
                                : 'hover:bg-black/10 text-gray-600'
                    }`}
                    onClick={onToggleViewMode}
                    title={t('webAlbum')}
                >
                    <Album size={18} />
                    <span className="text-xs font-medium">{viewMode === 'album' ? t('album') : t('local')}</span>
                </Button>

                <div className={`w-px h-6 mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />

                {/* Always on top toggle */}
                <button
                    className={`h-9 w-9 p-0 rounded-lg transition-colors flex items-center justify-center ${
                        isAlwaysOnTop
                            ? theme === 'dark' ? 'bg-white/20 text-white' : 'bg-black/20 text-gray-800'
                            : `hover:bg-black/10 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`
                    }`}
                    onClick={toggleAlwaysOnTop}
                    title={isAlwaysOnTop ? t('unpinWindow') : t('pinWindow')}
                >
                    <Pin size={18} />
                </button>
                <Button
                    variant="ghost"
                    className={`h-9 w-9 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}
                    onClick={toggleTheme}
                    title={theme === 'dark' ? t('lightMode') : t('darkMode')}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </Button>
                <Button
                    variant="ghost"
                    className={`h-9 px-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 flex gap-2 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}
                    onClick={() => setLanguage(nextLang)}
                    title={t('changeLanguage')}
                >
                    <Globe size={18} />
                    <span className="text-xs font-bold">{langDisplay}</span>
                </Button>
                <Button
                    variant="ghost"
                    className={`h-9 w-9 p-0 rounded-lg transition-all ${showInfoPanel ? 'bg-primary/20 text-primary' : `hover:bg-black/10 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}`}
                    onClick={onToggleInfo}
                    title={t('toggleInfo')}
                >
                    <Info size={18} />
                </Button>
                <Button
                    variant="ghost"
                    className={`h-9 w-9 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}
                    onClick={onToggleSidebarPosition}
                    title={sidebarPosition === 'left' ? '縮圖移到底部' : '縮圖移到左側'}
                >
                    {sidebarPosition === 'left' ? <PanelBottom size={18} /> : <PanelLeft size={18} />}
                </Button>
                <Button
                    variant="ghost"
                    className={`h-9 w-9 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}
                    onClick={onAbout}
                    title={t('about')}
                >
                    <HelpCircle size={18} />
                </Button>
            </div>

            {/* URL Input Modal - rendered via Portal to avoid transform issues */}
            {createPortal(
                <AnimatePresence>
                    {showUrlModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowUrlModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-full max-w-md mx-4 p-5 rounded-2xl shadow-2xl border ${
                                    theme === 'dark'
                                        ? 'bg-surface border-white/10'
                                        : 'bg-white border-black/10'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                        {t('addImageUrl')}
                                    </h3>
                                    <button
                                        onClick={() => setShowUrlModal(false)}
                                        className={`p-1.5 rounded-lg transition-colors ${
                                            theme === 'dark' ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-gray-500'
                                        }`}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    if (urlInput.trim() && onAddAlbumImage) {
                                        const urls = urlInput.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
                                        urls.forEach(url => onAddAlbumImage(url));
                                        setUrlInput('');
                                        setShowUrlModal(false);
                                    }
                                }}>
                                    <textarea
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        onPaste={(e) => {
                                            const pastedText = e.clipboardData.getData('text');
                                            if (pastedText) {
                                                const urls = pastedText.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
                                                if (urls.length > 0 && urls.every(url => url.startsWith('http'))) {
                                                    e.preventDefault();
                                                    urls.forEach(url => onAddAlbumImage(url));
                                                    setShowUrlModal(false);
                                                }
                                            }
                                        }}
                                        placeholder={t('pasteImageUrlPlaceholder')}
                                        rows={4}
                                        autoFocus
                                        className={`w-full px-3 py-2.5 text-sm rounded-xl resize-none transition-colors ${
                                            theme === 'dark'
                                                ? 'bg-white/5 text-white border border-white/10 placeholder:text-white/30 focus:border-primary/50'
                                                : 'bg-black/5 text-gray-800 border border-black/10 placeholder:text-gray-400 focus:border-primary/50'
                                        } focus:outline-none`}
                                    />
                                    <p className={`mt-2 text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                                        {t('urlInputHint')}
                                    </p>
                                    <div className="flex justify-end gap-2 mt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowUrlModal(false)}
                                            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                                                theme === 'dark'
                                                    ? 'bg-white/5 text-white/70 hover:bg-white/10'
                                                    : 'bg-black/5 text-gray-600 hover:bg-black/10'
                                            }`}
                                        >
                                            {t('cancel')}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!urlInput.trim()}
                                            className="px-4 py-2 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {t('addImage')}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </motion.div>
    );
};

