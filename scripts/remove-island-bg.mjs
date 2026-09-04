import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

async function removeWhiteBackground(inputPath, outputPath) {
  console.log(`Processing: ${inputPath} -> ${outputPath}`);
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const channels = 4; // RGBA
  const totalPixels = width * height;

  // visited: 0 = not visited, 1 = background (transparent), 2 = transition
  const mask = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let qHead = 0;
  let qTail = 0;

  // Step 1: Initialize BFS queue with all border pixels
  const pushPixel = (p) => {
    if (mask[p] === 0) {
      mask[p] = 1;
      queue[qTail++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    pushPixel(0 * width + x);
    pushPixel((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    pushPixel(y * width + 0);
    pushPixel(y * width + (width - 1));
  }

  // Step 2: Flood-fill connected near-white background
  // White threshold: R, G, B >= 240 and color delta <= 12
  while (qHead < qTail) {
    const p = queue[qHead++];
    const px = p % width;
    const py = (p / width) | 0;

    // Check 4 neighbors
    const neighbors = [
      px > 0 ? p - 1 : -1,
      px < width - 1 ? p + 1 : -1,
      py > 0 ? p - width : -1,
      py < height - 1 ? p + width : -1,
    ];

    for (const n of neighbors) {
      if (n !== -1 && mask[n] === 0) {
        const nIdx = n * 4;
        const r = data[nIdx];
        const g = data[nIdx + 1];
        const b = data[nIdx + 2];

        // Is near-white pixel connected to border
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        const minChannel = Math.min(r, g, b);
        const avg = (r + g + b) / 3;

        if (minChannel >= 240 && maxDiff <= 14) {
          mask[n] = 1;
          queue[qTail++] = n;
        } else if (avg >= 248 && maxDiff <= 8) {
          mask[n] = 1;
          queue[qTail++] = n;
        }
      }
    }
  }

  console.log(`Flood fill background pixels: ${qTail} / ${totalPixels} (${((qTail / totalPixels) * 100).toFixed(1)}%)`);

  // Step 3: Edge feathering & halo removal (defringing)
  // For pixels adjacent to transparent background with high brightness
  const outData = Buffer.from(data);

  // Set all core background pixels to completely transparent
  for (let p = 0; p < totalPixels; p++) {
    if (mask[p] === 1) {
      const idx = p * 4;
      outData[idx + 3] = 0; // Alpha = 0
    }
  }

  // Smooth edge pixels to prevent hard jagged borders or white halos
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (mask[p] === 0) {
        // Check if adjacent to background
        const neighbors = [p - 1, p + 1, p - width, p + width];
        let bgNeighborCount = 0;
        for (const n of neighbors) {
          if (mask[n] === 1) bgNeighborCount++;
        }

        if (bgNeighborCount > 0) {
          const idx = p * 4;
          const r = outData[idx];
          const g = outData[idx + 1];
          const b = outData[idx + 2];
          const minC = Math.min(r, g, b);
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));

          // If the edge pixel is tinted white, fade its alpha and defringe
          if (minC >= 215 && maxDiff <= 18) {
            const whiteness = Math.min(1, Math.max(0, (minC - 215) / (255 - 215)));
            const alpha = Math.round((1 - whiteness * 0.9) * 255);
            outData[idx + 3] = alpha;

            // Un-premultiply white background to remove white halo
            const aNorm = alpha / 255;
            if (aNorm > 0.05) {
              outData[idx] = Math.max(0, Math.min(255, Math.round((r - (1 - aNorm) * 255) / aNorm)));
              outData[idx + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - aNorm) * 255) / aNorm)));
              outData[idx + 2] = Math.max(0, Math.min(255, Math.round((b - (1 - aNorm) * 255) / aNorm)));
            }
          }
        }
      }
    }
  }

  // Save as high-quality PNG with true transparency
  await sharp(outData, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 8 })
    .toFile(outputPath);

  const stats = fs.statSync(outputPath);
  console.log(`Saved transparent PNG: ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
}

async function main() {
  await removeWhiteBackground(
    'public/castle/empty-island-rim-12x12.jpg',
    'public/castle/empty-island-rim-12x12.png'
  );
  await removeWhiteBackground(
    'public/castle/empty-island-12x12.jpg',
    'public/castle/empty-island-12x12.png'
  );
  console.log('All transparent PNGs generated successfully!');
}

main().catch(console.error);
