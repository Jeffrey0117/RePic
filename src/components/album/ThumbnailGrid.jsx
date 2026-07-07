import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { ContextMenu } from '../ui/ContextMenu';
import { Scissors, Pencil } from '../icons';
import { ThumbnailGridCell } from './ThumbnailGridCell';

/**
 * ThumbnailGrid - Grid view for album images
 *
 * @param {Array} images - Album images array
 * @param {number} currentIndex - Currently selected image index
 * @param {Function} onSelectImage - Callback when image is clicked (index)
 * @param {string} size - Grid size: 'small' | 'medium' | 'large'
 * @param {boolean} isMultiSelectMode - Multi-select mode
 * @param {Set} selectedImageIds - Selected image IDs
 * @param {Set} processingImageIds - IDs of images being processed
 * @param {Function} onToggleSelect - Toggle image selection
 * @param {Function} onRemoveBackground - Callback for removing background from image(s)
 * @param {Function} onRenameImage - Callback for renaming image (imageId, newName)
 */
export const ThumbnailGrid = memo(function ThumbnailGrid({
  images,
  currentIndex,
  onSelectImage,
  size = 'medium',
  isMultiSelectMode = false,
  selectedImageIds = new Set(),
  processingImageIds = new Set(),
  onToggleSelect,
  onRemoveBackground,
  onRenameImage
}) {
  // Grid sizes (in pixels)
  const sizes = {
    small: 128,
    medium: 192,
    large: 256
  };
  const thumbSize = sizes[size];

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    targetImage: null,
    targetIndex: null
  });

  // Rename state. renameValueRef mirrors renameValue so the submit callback
  // can read the latest text without depending on it (keeps the callback
  // stable, so memoized cells don't re-render on every keystroke).
  const [renamingImageId, setRenamingImageId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameValueRef = useRef('');
  const renameInputRef = useRef(null);

  const handleRenameChange = useCallback((val) => {
    renameValueRef.current = val;
    setRenameValue(val);
  }, []);

  // Focus and select rename input when renaming starts
  useEffect(() => {
    if (renamingImageId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingImageId]);

  // Handle right-click on thumbnail
  const handleContextMenu = useCallback((e, image, index) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      targetImage: image,
      targetIndex: index
    });
  }, []);

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      targetImage: null,
      targetIndex: null
    });
  };

  // Handle remove background action
  const handleRemoveBackground = () => {
    if (isMultiSelectMode && selectedImageIds.size > 0) {
      // Batch remove background for selected images
      const selectedImages = images.filter(img => selectedImageIds.has(img.id));
      onRemoveBackground?.(selectedImages, true);
    } else if (contextMenu.targetImage) {
      // Single image remove background
      onRemoveBackground?.([contextMenu.targetImage], false);
    }
  };

  // Handle rename from context menu
  const handleStartRename = () => {
    if (contextMenu.targetImage) {
      const currentName = contextMenu.targetImage.name ||
        `${contextMenu.targetIndex + 1}.jpg`;
      setRenamingImageId(contextMenu.targetImage.id);
      renameValueRef.current = currentName;
      setRenameValue(currentName);
      closeContextMenu();
    }
  };

  // Handle rename submit
  const handleRenameSubmit = useCallback(() => {
    const val = renameValueRef.current;
    setRenamingImageId((id) => {
      if (id && val.trim() && onRenameImage) onRenameImage(id, val.trim());
      return null;
    });
    renameValueRef.current = '';
    setRenameValue('');
  }, [onRenameImage]);

  // Handle rename cancel
  const handleRenameCancel = useCallback(() => {
    setRenamingImageId(null);
    renameValueRef.current = '';
    setRenameValue('');
  }, []);

  // Handle double-click on image name
  const handleNameDoubleClick = useCallback((e, image, index) => {
    e.stopPropagation();
    const currentName = image.name || `${index + 1}.jpg`;
    setRenamingImageId(image.id);
    renameValueRef.current = currentName;
    setRenameValue(currentName);
  }, []);

  // Context menu items
  const getContextMenuItems = () => {
    const items = [];

    // Rename option
    if (onRenameImage && !isMultiSelectMode) {
      items.push({
        label: 'Rename',
        icon: Pencil,
        onClick: handleStartRename
      });
    }

    // Remove Background option
    if (onRemoveBackground) {
      if (isMultiSelectMode && selectedImageIds.size > 0) {
        items.push({
          label: `Remove Background (${selectedImageIds.size} images)`,
          icon: Scissors,
          onClick: handleRemoveBackground
        });
      } else {
        items.push({
          label: 'Remove Background',
          icon: Scissors,
          onClick: handleRemoveBackground
        });
      }
    }

    return items;
  };

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden p-4 bg-[#0A0A0A]">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`
        }}
      >
        {images.map((image, index) => (
          <ThumbnailGridCell
            key={image.id}
            image={image}
            index={index}
            thumbSize={thumbSize}
            isCurrent={index === currentIndex}
            isSelected={selectedImageIds.has(image.id)}
            isProcessing={processingImageIds.has(image.id)}
            isMultiSelectMode={isMultiSelectMode}
            isRenaming={renamingImageId === image.id}
            renameValue={renameValue}
            renameInputRef={renameInputRef}
            onSelect={onSelectImage}
            onToggleSelect={onToggleSelect}
            onContextMenu={handleContextMenu}
            onNameDoubleClick={handleNameDoubleClick}
            onRenameChange={handleRenameChange}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={handleRenameCancel}
          />
        ))}
      </div>

      {/* Empty state */}
      {images.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-white/40">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <p className="text-lg">No images in this album</p>
        </div>
      )}

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
        items={getContextMenuItems()}
      />
    </div>
  );
});

ThumbnailGrid.displayName = 'ThumbnailGrid';
