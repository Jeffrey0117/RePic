import { memo } from 'react';
import { LazyImage } from '../ui/LazyImage';
import { Scissors } from '../icons';

// Format a video duration in seconds as m:ss (e.g. 42 -> "0:42", 95 -> "1:35").
const formatDuration = (seconds) => {
  if (seconds == null || !isFinite(seconds)) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * One thumbnail cell. Memoized so a state change touching one cell (rename,
 * selection, processing) doesn't reconcile every other cell in the album —
 * content-visibility already skips off-screen paint, but React still
 * reconciles fibers without this boundary.
 */
export const ThumbnailGridCell = memo(function ThumbnailGridCell({
  image,
  index,
  thumbSize,
  isCurrent,
  isSelected,
  isProcessing,
  isMultiSelectMode,
  isRenaming,
  renameValue,
  renameInputRef,
  onSelect,
  onToggleSelect,
  onContextMenu,
  onNameDoubleClick,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel
}) {
  return (
    <div
      className={`
        relative group cursor-pointer rounded-lg overflow-hidden
        transition-all duration-200
        ${isCurrent ? 'ring-2 ring-primary scale-105' : 'hover:scale-105'}
        ${isSelected ? 'ring-2 ring-blue-500' : ''}
      `}
      style={{
        aspectRatio: '1',
        height: `${thumbSize}px`,
        // Skip rendering/decoding work for off-screen thumbnails.
        // intrinsic size matches the fixed cell so scroll height stays stable.
        contentVisibility: 'auto',
        containIntrinsicSize: `${thumbSize}px ${thumbSize}px`
      }}
      onClick={(e) => {
        if (isMultiSelectMode) {
          e.preventDefault();
          onToggleSelect?.(image.id);
        } else {
          onSelect(index);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, image, index)}
    >
      {/* Thumbnail */}
      <LazyImage
        src={image.processedUrl || image.url || image.src}
        alt={image.name || `Image ${index + 1}`}
        className="w-full h-full"
        useThumbnail
        showSpinner={true}
        hasTransparency={image.hasBackgroundRemoved || !!image.processedUrl}
      />

      {/* Video markers: center play triangle + bottom-right duration */}
      {image.isVideo && (
        <>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center group-hover:bg-black/60 transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="ml-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          {formatDuration(image.duration) && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[11px] font-medium px-1.5 py-0.5 rounded pointer-events-none tabular-nums">
              {formatDuration(image.duration)}
            </div>
          )}
        </>
      )}

      {/* Multi-select checkbox */}
      {isMultiSelectMode && (
        <div className="absolute top-2 right-2 z-10">
          <div
            className={`
              w-6 h-6 rounded border-2 flex items-center justify-center
              transition-colors duration-200
              ${isSelected
                ? 'bg-blue-500 border-blue-500'
                : 'bg-black/50 border-white/30 group-hover:border-white/60'
              }
            `}
          >
            {isSelected && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Image name overlay (on hover or when renaming) */}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 transition-opacity duration-200 ${
        isRenaming ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onRenameSubmit();
              } else if (e.key === 'Escape') {
                onRenameCancel();
              }
              e.stopPropagation();
            }}
            onBlur={onRenameSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full px-2 py-1 text-xs bg-white/10 text-white border border-white/20 rounded focus:outline-none focus:border-primary"
          />
        ) : (
          <p
            className="text-xs text-white/90 truncate cursor-text"
            onDoubleClick={(e) => onNameDoubleClick(e, image, index)}
          >
            {image.name || `${index + 1}.jpg`}
          </p>
        )}
      </div>

      {/* Current indicator badge */}
      {isCurrent && !isMultiSelectMode && (
        <div className="absolute top-2 left-2 bg-primary px-2 py-0.5 rounded text-xs font-medium">
          Current
        </div>
      )}

      {/* Background removed indicator */}
      {image.hasBackgroundRemoved && !isProcessing && (
        <div className="absolute bottom-2 right-2 bg-green-500/90 p-1 rounded backdrop-blur-sm" title="Background removed">
          <Scissors size={12} className="text-white" />
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-xs text-white/80">Processing...</span>
          </div>
        </div>
      )}
    </div>
  );
});
