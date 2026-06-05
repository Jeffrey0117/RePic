/**
 * VideoViewer — plays a Pokkit video in the single-item view.
 *
 * Mirrors ImageViewer's centered, max-sized container. Uses the native <video>
 * controls (no autoplay) with the thumbnail as poster. The video.mp4 route is
 * public and Range-enabled, so the browser streams/seeks it directly.
 */
export const VideoViewer = ({ src, poster, processing = false }) => {
    if (processing || !src) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-transparent">
                {poster && (
                    <img
                        src={poster}
                        alt="Video poster"
                        className="max-w-[calc(100vw-280px)] max-h-[calc(100vh-220px)] object-contain rounded-md opacity-60"
                        draggable={false}
                    />
                )}
                <div className="mt-4 flex items-center gap-2 text-white/70 text-sm">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                    影片處理中…
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex items-center justify-center overflow-hidden bg-transparent">
            <video
                src={src}
                poster={poster || undefined}
                controls
                controlsList="nodownload"
                preload="metadata"
                className="block rounded-md"
                style={{
                    maxWidth: 'calc(100vw - 280px)',
                    maxHeight: 'calc(100vh - 160px)'
                }}
            />
        </div>
    );
};
