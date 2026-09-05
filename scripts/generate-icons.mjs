import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const logoPath = path.join(projectRoot, 'public/brand/hanzi-beat-logo.png');

if (!fs.existsSync(logoPath)) {
  console.error('Không tìm thấy logo gốc tại:', logoPath);
  process.exit(1);
}

console.log('=== KHỞI TẠO BỘ ICON CHUẨN GOOGLE SEARCH CHO HANZI BEAT ===\n');

async function generateIcons() {
  const logoBuffer = fs.readFileSync(logoPath);

  // 1. Tạo các kích thước PNG chuẩn
  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },      // Chuẩn Google Search Favicon
    { name: 'apple-touch-icon.png', size: 180 },  // Chuẩn Apple iOS Safari
    { name: 'icon.png', size: 192 },              // Chuẩn Android Chrome / Web Manifest
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },          // Chuẩn PWA & Rich Media
  ];

  const pngBuffers = {};

  for (const item of sizes) {
    const buf = await sharp(logoBuffer)
      .resize(item.size, item.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9, quality: 100 })
      .toBuffer();

    const destPath = path.join(projectRoot, 'public', item.name);
    fs.writeFileSync(destPath, buf);
    pngBuffers[item.size] = buf;
    console.log(`  ✓ Đã tạo public/${item.name} (${item.size}x${item.size}) - ${buf.length} bytes`);
  }

  // Cập nhật cả app/icon.png (dùng size 192x192 thay vì 2MB)
  const appIconDest = path.join(projectRoot, 'app/icon.png');
  fs.writeFileSync(appIconDest, pngBuffers[192]);
  console.log(`  ✓ Đã tối ưu app/icon.png (${pngBuffers[192].length} bytes thay vì 2.03MB)`);

  // 2. Tạo tệp favicon.ico đa kích thước (16, 32, 48)
  const icoSizes = [16, 32, 48];
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
  icoHeader.writeUInt16LE(icoSizes.length, 4); // Count = 3

  let offset = 6 + 16 * icoSizes.length;
  const dirEntries = [];
  const imageBuffers = [];

  for (const s of icoSizes) {
    const imgBuf = pngBuffers[s];
    imageBuffers.push(imgBuf);

    const entry = Buffer.alloc(16);
    entry.writeUInt8(s === 256 ? 0 : s, 0); // Width
    entry.writeUInt8(s === 256 ? 0 : s, 1); // Height
    entry.writeUInt8(0, 2);                 // Color count (0 = 256+)
    entry.writeUInt8(0, 3);                 // Reserved
    entry.writeUInt16LE(1, 4);              // Color planes
    entry.writeUInt16LE(32, 6);             // Bits per pixel
    entry.writeUInt32LE(imgBuf.length, 8);  // Image size in bytes
    entry.writeUInt32LE(offset, 12);        // Image data offset

    dirEntries.push(entry);
    offset += imgBuf.length;
  }

  const finalIcoBuffer = Buffer.concat([
    icoHeader,
    ...dirEntries,
    ...imageBuffers,
  ]);

  const icoDest = path.join(projectRoot, 'public/favicon.ico');
  fs.writeFileSync(icoDest, finalIcoBuffer);
  console.log(`  ✓ Đã tạo public/favicon.ico đa kích thước (16, 32, 48) - Tổng dung lượng: ${finalIcoBuffer.length} bytes`);

  // 3. Tạo public/favicon.svg biểu tượng Hán tự phong cách Hanzi Beat (thay thế SVG template cũ)
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <radialGradient id="sealGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#cf3238"/>
      <stop offset="100%" stop-color="#8d1c21"/>
    </radialGradient>
    <filter id="goldDrop" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
    </filter>
  </defs>
  <!-- Nền con dấu hình vuông bo góc phong cách Tiên hiệp -->
  <rect x="8" y="8" width="112" height="112" rx="20" fill="url(#sealGlow)" stroke="#f3cd74" stroke-width="4" filter="url(#goldDrop)"/>
  <!-- Đường viền kép hoàng kim -->
  <rect x="14" y="14" width="100" height="100" rx="14" fill="none" stroke="#d6a53a" stroke-width="1.5" stroke-dasharray="8 3" opacity="0.8"/>
  <!-- Hán tự '汉' (Han) cách điệu phong cách Thư pháp & Nhịp điệu -->
  <text x="64" y="84" font-family="'Songti SC', 'SimSun', 'Microsoft YaHei', 'PingFang SC', serif" font-size="72" font-weight="900" text-anchor="middle" fill="#fef5d8" filter="url(#goldDrop)">汉</text>
  <!-- Chấm nốt nhạc nhịp điệu phát sáng -->
  <circle cx="98" cy="30" r="6" fill="#f5ce75"/>
  <circle cx="106" cy="24" r="3" fill="#ffffff"/>
</svg>
`;

  const svgDest = path.join(projectRoot, 'public/favicon.svg');
  fs.writeFileSync(svgDest, svgContent, 'utf8');
  console.log(`  ✓ Đã cập nhật public/favicon.svg với logo Hán tự & Tiên hiệp đặc trưng`);
}

generateIcons().catch(err => {
  console.error('Lỗi khi sinh icons:', err);
  process.exit(1);
});
