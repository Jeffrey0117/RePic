# Screenshot Implementation Details

## Architecture
To keep the app "MVP" and "Minimalist" while avoiding heavy third-party Screenshot binaries, we used **Electron's Native APIs**.

### Workflow
1. **Trigger**: User clicks "Screenshot" (Camera Icon) in the UI.
2. **Hide**: The Renderer tells the Main Process to `hide-window`. This ensures the app doesn't take a picture of itself obscuring the screen.
3. **Capture**:
   - The Main Process uses `desktopCapturer` to fetch active screen sources.
   - The Renderer receives the source ID and uses `navigator.mediaDevices.getUserMedia` to grab a high-res video stream of the desktop.
   - A single frame is drawn to a Canvas and converted to an Image (Data URL).
4. **Show**: The Window is immediately restored (`show-window`).
5. **Edit**: The captured screenshot is loaded directly into the existing **Image Editor**, ready for cropping or saving.

## Key Files
- `electron/main.cjs`: Handles `hide-window`, `show-window`, and `get-desktop-sources`.
- `src/utils/capture.js`: Orchestrates the `Hide -> Capture -> Show` sequence.
- `src/App.jsx`: UI integration.

## Usage
- Click the **Camera Icon** on the main screen (or toolbar).
- The app will vanish for a split second and reappear with your screen content captured.
