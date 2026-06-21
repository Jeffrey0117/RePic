; RePic NSIS customisations
;
; Goal: keep "double-click opens in RePic" for image files, but let Windows
; Explorer show the REAL image thumbnail instead of the RePic logo.
;
; Why this is needed:
; electron-builder registers each image type under its own ProgId (named after
; the association's "name", e.g. "JPEG Image") and forces that ProgId's
; DefaultIcon to the RePic logo. A ProgId DefaultIcon overrides the per-file
; thumbnail in Explorer, so every image shows the logo instead of its content.
; Removing the DefaultIcon (while keeping the open verb) restores the native
; thumbnail provider.
;
; The ".repic" virtual-image format intentionally keeps its logo icon (its
; ProgId is "Repic Virtual Image", which we leave untouched).

!macro customInstall
  ; Drop the logo icon override on each image ProgId -> native thumbnails.
  DeleteRegKey SHELL_CONTEXT "Software\Classes\JPEG Image\DefaultIcon"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\PNG Image\DefaultIcon"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\GIF Image\DefaultIcon"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\WebP Image\DefaultIcon"
  DeleteRegKey SHELL_CONTEXT "Software\Classes\BMP Image\DefaultIcon"
  ; Tell Explorer associations changed so icons refresh without a reboot.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  ; Clean up the extension -> ProgId defaults we created, so the file types
  ; cleanly fall back to the system handler after uninstall.
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.jpg" ""
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.jpeg" ""
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.png" ""
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.gif" ""
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.webp" ""
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.bmp" ""
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
