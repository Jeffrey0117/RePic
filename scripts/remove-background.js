import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function removeBackground(inputPath, outputPath) {
  try {
    console.log(`Processing: ${inputPath}`);

    // Read the image
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    console.log(`Image size: ${metadata.width}x${metadata.height}`);

    // Get raw pixel data
    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Process pixels to remove light gray/white background
    // Threshold for determining background (adjust if needed)
    const threshold = 240; // Pixels with R,G,B all > 240 are considered background

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // If pixel is very light (close to white/light gray), make it transparent
      if (r > threshold && g > threshold && b > threshold) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }

    // Create new image from processed data
    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
    .png()
    .toFile(outputPath);

    console.log(`✓ Saved: ${outputPath}`);
  } catch (error) {
    console.error(`Error processing ${inputPath}:`, error);
  }
}

async function main() {
  const images = [
    {
      input: join(rootDir, 'repic.jpeg'),
      output: join(rootDir, 'repic.png')
    },
    {
      input: join(rootDir, 'repic-logo.jpeg'),
      output: join(rootDir, 'repic-logo.png')
    }
  ];

  console.log('Starting background removal...\n');

  for (const img of images) {
    await removeBackground(img.input, img.output);
  }

  console.log('\nDone! PNG files with transparent backgrounds created.');
}

main();
