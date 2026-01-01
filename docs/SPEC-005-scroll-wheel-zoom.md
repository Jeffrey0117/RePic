# SPEC-005: Scroll Wheel Zoom

## Overview
Allow users to zoom in/out on the current image using the mouse scroll wheel.

## Requirements
1. Scroll up = zoom in (increase scale)
2. Scroll down = zoom out (decrease scale)
3. Zoom range: 10% to 500% (0.1x to 5x)
4. Zoom centered on cursor position (zoom toward mouse pointer)
5. Smooth zoom transitions
6. Display current zoom level in UI
7. Double-click to reset to fit-to-window

## Implementation
- File: Main image display component (likely in App.jsx or create ImageViewer.jsx)
- Add onWheel event handler
- Track scale state and transform origin
- Use CSS transform: scale() for zooming
- Show zoom percentage indicator

## Technical Details
```jsx
const handleWheel = (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1; // scroll down = zoom out
  const newScale = Math.max(0.1, Math.min(5, scale + delta));
  setScale(newScale);
};
```

## Zoom Behavior
- Each scroll tick changes zoom by ~10%
- Zoom should be smooth (consider using CSS transition)
- When zoomed in, allow panning by dragging
- Ctrl+0 or double-click resets to fit

## UI Updates
- Show zoom percentage in toolbar or corner (e.g., "150%")
- Update existing zoom controls if any

## Acceptance Criteria
- [ ] Scroll up zooms in
- [ ] Scroll down zooms out
- [ ] Zoom range is 10% to 500%
- [ ] Zoom level displayed in UI
- [ ] Double-click resets zoom to fit
- [ ] Zoomed image can be panned by dragging
- [ ] Smooth zoom transitions
