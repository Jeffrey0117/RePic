// Adapted for react-image-crop output
export default async function getCroppedImg(
    image,
    crop,
    rotate = 0,
    scale = 1,
    fileName = 'cropped.jpg'
) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('No 2d context');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // devicePixelRatio slightly increases sharpness on retina devices
    // but let's stick to 1 for simplicity and performance unless requested
    const pixelRatio = 1;

    canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
    canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;

    const rotateRads = rotate * Math.PI / 180;
    const centerX = image.naturalWidth / 2;
    const centerY = image.naturalHeight / 2;

    ctx.save();

    // 5) Move the crop origin to the canvas origin (0,0)
    ctx.translate(-cropX, -cropY);
    // 4) Move the origin to the center of the original position
    ctx.translate(centerX, centerY);
    // 3) Rotate around the origin
    ctx.rotate(rotateRads);
    // 2) Scale the image
    ctx.scale(scale, scale);
    // 1) Move the center of the image to the origin (0,0)
    ctx.translate(-centerX, -centerY);

    ctx.drawImage(
        image,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
    );

    ctx.restore();

    return new Promise((resolve) => {
        resolve(canvas.toDataURL('image/jpeg', 0.95)); // High quality jpeg
    });
}
