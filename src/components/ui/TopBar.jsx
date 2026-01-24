import { motion } from '../../lib/motion';
import {
    FolderOpen,
    RotateCcw,
    Scissors,
    Trash2,
    Download,
    Upload,
    Info,
    Globe,
    Sun,
    Moon
} from '../icons';
import { Button } from './Button';
import useI18n from '../../hooks/useI18n';
import { useTheme } from '../../contexts/ThemeContext';

// Check if electronAPI is available (injected via preload script)
const electronAPI = window.electronAPI || null;

export const TopBar = ({ currentPath, onOpenFolder, isEditing, onToggleEdit, onClear, onSave, onUpload, isUploading, showInfoPanel, onToggleInfo }) => {
    const { t, language, setLanguage } = useI18n();
    const { theme, toggleTheme } = useTheme();

    // Get folder name using electronAPI or fallback
    const getFolderName = () => {
        if (!currentPath) return t('openFolder');
        if (electronAPI && electronAPI.path) {
            return electronAPI.path.basename(currentPath);
        }
        // Fallback to simple string parsing
        return currentPath.split(/[\\/]/).pop() || currentPath;
    };

    const folderName = getFolderName();

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
            {/* Left: Folder Info */}
            <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all border ${
                    theme === 'dark'
                        ? 'bg-white/5 hover:bg-white/10 border-white/5'
                        : 'bg-black/5 hover:bg-black/10 border-black/10'
                }`}
                onClick={onOpenFolder}
            >
                <FolderOpen size={16} className="text-primary" />
                <span className={`text-xs font-medium max-w-[200px] truncate ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>{folderName}</span>
            </div>

            {/* Center: Main Tools */}
            <div className={`flex items-center rounded-xl p-1 border ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-black/5 border-black/10'}`}>
                <ToolButton icon={RotateCcw} title={t('refresh')} onClick={() => window.location.reload()} theme={theme} />
                <ToolButton icon={Scissors} title={t('editArea')} onClick={onToggleEdit} active={isEditing} theme={theme} />
                <ToolButton icon={Trash2} title={t('delete')} className="text-danger" onClick={onClear} theme={theme} />
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
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
                <Button variant="ghost" className={`h-9 w-9 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`} onClick={onSave}>
                    <Download size={18} className="hover:text-primary transition-colors" />
                </Button>
                <Button
                    variant="ghost"
                    className={`h-9 w-9 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'} ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={onUpload}
                    disabled={isUploading}
                    title={t('upload')}
                >
                    <Upload size={18} className={`hover:text-primary transition-colors ${isUploading ? 'animate-pulse' : ''}`} />
                </Button>
            </div>
        </motion.div>
    );
};

const ToolButton = ({ icon: Icon, title, onClick, className = "", active = false, theme = 'dark' }) => (
    <button
        onClick={onClick}
        title={title}
        className={`p-2.5 rounded-lg transition-all ${
            active
                ? 'bg-primary/20 text-primary'
                : theme === 'dark'
                    ? 'hover:bg-white/10 text-white/60 hover:text-white'
                    : 'hover:bg-black/10 text-gray-500 hover:text-gray-800'
        } ${className}`}
    >
        <Icon size={22} />
    </button>
);
