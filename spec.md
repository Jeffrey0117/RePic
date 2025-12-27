# Repic UI Refresh Specification

## Layout Overview
The application will use a three-column layout with a top toolbar.

### 1. Top Toolbar (Global Actions)
- **Icons**: Folder Open, Sort/Filter, Copy, Crop, Delete, Search, Grid View, Settings, Refresh, Fullscreen.
- **Status Info**: Current zoom level, image resolution (WxH), file type, size, modification date.
- **Background**: Semi-transparent dark surface with blur (iOS-like).

### 2. Left Sidebar (Thumbnail Gallery)
- **Width**: Fixed (approx. 80-100px).
- **Content**: Vertical list of image thumbnails.
- **Behavior**: Scrollable, active thumbnail is highlighted with a primary color border.
- **Label**: Filename displayed above or below thumbnail.

### 3. Center Area (Image Viewer)
- **Content**: The currently selected image.
- **Background**: Dark contrasting background (Translucent/Glass if possible).
- **Behavior**: Fits the available space, maintains aspect ratio.

### 4. Right Sidebar (Detail Panel)
- **Width**: Fixed (approx. 250px).
- **Content**: 
    - Tabs (Details, Structure/Exif).
    - **Details Section**:
        - Image Resolution (e.g., 2816 x 1536).
        - File Size (e.g., 4.6 MB).
        - Creation Date.
        - Modification Date.
- **Typography**: Clean, monospace or sans-serif, high contrast labels with muted values.

## Technical Requirements
- **Metadata Extraction**: Use Node.js `fs.statSync` and image dimensions logic in the main/renderer process.
- **State Management**: Update `useFileSystem` hook to return detailed metadata for the `currentImage`.
- **Responsive Design**: Sidbars should be toggleable or responsive to window size.

## Design Aesthetic
- **Color Palette**: Ultra-dark (#000000 to #1A1A1A).
- **Accents**: Primary blue (#0066FF) for active states.
- **Icons**: `lucide-react`.
- **Animations**: `framer-motion` for transitions between images and panel toggles.
