import { useTheme } from '../../contexts/ThemeContext';
import useI18n from '../../hooks/useI18n';

// Panel width constant (matches AlbumSidebar)
const PANEL_WIDTH = 220;
const TRANSITION_DURATION = 250;

// Cloud icon
const Cloud = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </svg>
);

// Refresh icon
const RefreshCw = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

// LogOut icon
const LogOut = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" x2="9" y1="12" y2="12" />
  </svg>
);

// Image icon for photo count
const ImageIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

// Spinner component
const Spinner = ({ className = '' }) => (
  <svg className={`animate-spin ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-20" />
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const PokkitSidebar = ({
  albums,
  selectedAlbumId,
  onSelectAlbum,
  isAuthenticated,
  user,
  onLogin,
  onLogout,
  onRefresh,
  isLoadingAlbums,
  isLoadingPhotos,
  isVisible = true,
  isCollapsed = false
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();

  const sidebarStyle = {
    width: isVisible && !isCollapsed ? PANEL_WIDTH : 0,
    transition: `width ${TRANSITION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)`,
    overflow: 'hidden',
  };

  return (
    <aside
      style={sidebarStyle}
      className={`h-full border-r flex flex-col shrink-0 ${
        theme === 'dark'
          ? 'bg-surface/50 border-white/5'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex flex-col h-full" style={{ width: PANEL_WIDTH, minWidth: PANEL_WIDTH }}>
        {/* Header */}
        <div className={`flex items-center justify-between p-3 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
          <h2 className={`text-sm font-semibold flex items-center gap-1.5 ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
            <Cloud size={14} className="text-primary" />
            {t('pokkit')}
          </h2>
          {isAuthenticated && (
            <div className="flex items-center gap-1">
              <button
                onClick={onRefresh}
                disabled={isLoadingAlbums}
                title={t('pokkitRefresh')}
                className={`p-1.5 rounded transition-colors ${
                  isLoadingAlbums ? 'opacity-40' : ''
                } ${theme === 'dark' ? 'hover:bg-white/10 text-white/50' : 'hover:bg-gray-200 text-gray-500'}`}
              >
                <RefreshCw size={12} className={isLoadingAlbums ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={onLogout}
                title={t('pokkitLogout')}
                className={`p-1.5 rounded transition-colors ${
                  theme === 'dark'
                    ? 'hover:bg-red-500/20 text-white/50 hover:text-red-400'
                    : 'hover:bg-red-50 text-gray-500 hover:text-red-500'
                }`}
              >
                <LogOut size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        {!isAuthenticated ? (
          /* Login prompt */
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center mb-4 ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-300'
            }`}>
              <Cloud size={28} className={theme === 'dark' ? 'text-white/20' : 'text-gray-300'} />
            </div>
            <p className={`text-sm text-center mb-4 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
              {t('pokkitLoginRequired')}
            </p>
            <button
              onClick={onLogin}
              className="w-full py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/80 transition-colors"
            >
              {t('connectPokkit')}
            </button>
          </div>
        ) : (
          /* Authenticated content */
          <>
            {/* User info */}
            {user && (
              <div className={`flex items-center gap-2 px-3 py-2 border-b ${
                theme === 'dark' ? 'border-white/5' : 'border-gray-200'
              }`}>
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    theme === 'dark' ? 'bg-primary/30 text-primary' : 'bg-primary/20 text-primary'
                  }`}>
                    {(user.name || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
                <span className={`text-xs truncate ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>
                  {user.name || user.email}
                </span>
              </div>
            )}

            {/* Album list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isLoadingAlbums ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Spinner className={theme === 'dark' ? 'text-white/40' : 'text-gray-400'} />
                  <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
                    {t('pokkitLoading')}
                  </p>
                </div>
              ) : albums.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <ImageIcon size={24} className={theme === 'dark' ? 'text-white/15' : 'text-gray-300'} />
                  <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-white/30' : 'text-gray-400'}`}>
                    {t('pokkitNoAlbums')}
                  </p>
                </div>
              ) : (
                albums.map(album => (
                  <div
                    key={album.id}
                    onClick={() => onSelectAlbum(album.id)}
                    className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                      selectedAlbumId === album.id
                        ? 'bg-primary/20 border border-primary/30'
                        : theme === 'dark'
                          ? 'hover:bg-white/5 border border-transparent'
                          : 'hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Cloud size={14} className="text-primary shrink-0" />
                      <span className={`text-sm font-medium truncate ${
                        theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                      }`}>
                        {album.name}
                      </span>
                    </div>
                    <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                      {album.photo_count ?? album.photos?.length ?? 0} {t('images')}
                      {isLoadingPhotos && selectedAlbumId === album.id && (
                        <span className="ml-1 inline-block">
                          <Spinner className="w-3 h-3 inline" />
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

export default PokkitSidebar;
