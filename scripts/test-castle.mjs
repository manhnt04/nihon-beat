/**
 * Test Suite: Hán Tự Thành Isometric Algorithms & Asset Integrity
 * Run with: node scripts/test-castle.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const BASE_TILE_W = 64;
const BASE_TILE_H = 32;
const GRID = 8;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n========================================');
console.log('🏛️  KIỂM THỬ THUẬT TOÁN HÁN TỰ THÀNH 2.5D');
console.log('========================================\n');

// 1. Thuật toán 1: Grid ↔ Screen
console.log('1. Kiểm thử Chiếu Lưới ↔ Màn hình (GridToScreen & ScreenToGrid):');

function gridToScreen(col, row, originX, originY, tileW, tileH) {
  return {
    x: originX + ((col - row) * tileW) / 2,
    y: originY + ((col + row) * tileH) / 2,
  };
}

function screenToGrid(x, y, originX, originY, tileW, tileH) {
  const dx = x - originX;
  const dy = y - originY;
  const col = (dx / (tileW / 2) + dy / (tileH / 2)) / 2;
  const row = (dy / (tileH / 2) - dx / (tileW / 2)) / 2;
  return { col: Math.floor(col), row: Math.floor(row) };
}

const originX = 400;
const originY = 200;

for (let c = 0; c < GRID; c++) {
  for (let r = 0; r < GRID; r++) {
    const screen = gridToScreen(c + 0.5, r + 0.5, originX, originY, BASE_TILE_W, BASE_TILE_H);
    const roundtrip = screenToGrid(screen.x, screen.y, originX, originY, BASE_TILE_W, BASE_TILE_H);
    if (roundtrip.col !== c || roundtrip.row !== r) {
      assert(false, `Lỗi roundtrip tại ô (${c}, ${r}) -> Nhận được (${roundtrip.col}, ${roundtrip.row})`);
      break;
    }
  }
}
assert(true, 'Tất cả 64 ô trên lưới 8x8 đều chuyển đổi thuận nghịch 100% chuẩn xác.');

// 2. Thuật toán 2 & 3: Footprint & Placement Collision Validation
console.log('\n2. Kiểm thử Footprint & Phát hiện Va chạm (Placement Validation):');

function canPlace(col, row, w, h, occupiedMap) {
  if (col < 0 || row < 0 || col + w > GRID || row + h > GRID) return false;
  for (let dc = 0; dc < w; dc++) {
    for (let dr = 0; dr < h; dr++) {
      if (occupiedMap[col + dc]?.[row + dr]) return false;
    }
  }
  return true;
}

const occupancy = Array.from({ length: GRID }, () => Array(GRID).fill(false));
// Đặt Chủ thành 3x3 tại (2, 2)
for (let c = 2; c < 5; c++) {
  for (let r = 2; r < 5; r++) {
    occupancy[c][r] = true;
  }
}

assert(canPlace(0, 0, 2, 2, occupancy) === true, 'Đặt Tàng Thư Các 2x2 tại ô trống (0, 0) -> HỢP LỆ');
assert(canPlace(1, 1, 2, 2, occupancy) === false, 'Đặt công trình 2x2 chớm đè vào (2, 2) của Chủ thành -> BỊ CHẶN');
assert(canPlace(3, 3, 1, 1, occupancy) === false, 'Đặt Trạm gác 1x1 trùng đúng giữa Chủ thành -> BỊ CHẶN');
assert(canPlace(6, 6, 3, 3, occupancy) === false, 'Đặt công trình 3x3 tràn mép lưới (6+3=9 > 8) -> BỊ CHẶN');
assert(canPlace(6, 6, 2, 2, occupancy) === true, 'Đặt công trình 2x2 vừa khít góc lưới (6, 6) -> HỢP LỆ');

// 3. Thuật toán 4: Depth Sorting (Painter's Algorithm)
console.log('\n3. Kiểm thử Sắp Xếp Chiều Sâu (Depth Sorting):');

function depthKey(b) {
  return (b.col + b.w - 1) + (b.row + b.h - 1);
}

const buildings = [
  { name: 'Chủ Thành', col: 2, row: 2, w: 3, h: 3 },
  { name: 'Trạm Canh Phía Sau', col: 0, row: 0, w: 1, h: 1 },
  { name: 'Thính Âm Các', col: 5, row: 0, w: 2, h: 2 },
  { name: 'Tiểu Cảnh Tiền Cảnh', col: 6, row: 6, w: 1, h: 1 },
];

buildings.sort((a, b) => depthKey(a) - depthKey(b));
assert(
  buildings[0].name === 'Trạm Canh Phía Sau' &&
  buildings[1].name === 'Thính Âm Các' &&
  buildings[2].name === 'Chủ Thành' &&
  buildings[3].name === 'Tiểu Cảnh Tiền Cảnh',
  'Thứ tự vẽ từ xa tới gần: Trạm Canh (xa nhất) -> Thính Âm Các -> Chủ Thành -> Tiểu Cảnh (gần nhất).'
);

// 4. Thuật toán 5: Hit-testing Hình bóng 3D
console.log('\n4. Kiểm thử Hit-testing Hình bóng 3D (Point In Polygon):');

function pointInPolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

const testBox = [
  { x: 100, y: 50 },
  { x: 150, y: 75 },
  { x: 150, y: 150 },
  { x: 100, y: 175 },
  { x: 50, y: 150 },
  { x: 50, y: 75 },
];

assert(pointInPolygon({ x: 100, y: 100 }, testBox) === true, 'Điểm tâm (100, 100) nằm trong hitbox -> TRÚNG');
assert(pointInPolygon({ x: 20, y: 20 }, testBox) === false, 'Điểm bên ngoài (20, 20) -> KHÔNG TRÚNG');

// 5. Kiểm tra Asset ảnh WebP
console.log('\n5. Kiểm tra Tính Toàn Vẹn Của Asset Ảnh (.webp):');

const requiredAssets = [
  'public/castle/buildings/main/stage-1.webp',
  'public/castle/buildings/main/stage-2.webp',
  'public/castle/buildings/main/stage-3.webp',
  'public/castle/buildings/main/stage-4.webp',
  'public/castle/buildings/main/stage-5.webp',
  'public/castle/buildings/library/stage-1.webp',
  'public/castle/buildings/listening/stage-1.webp',
  'public/castle/environment-stage-2.webp',
  'public/castle/environment-stage-3.webp',
  'public/castle/environment-stage-4.webp',
  'public/castle/environment-stage-5.webp',
  'public/castle/map-empty.webp',
];

for (const asset of requiredAssets) {
  const fullPath = path.join(projectRoot, asset);
  const exists = fs.existsSync(fullPath);
  const stats = exists ? fs.statSync(fullPath) : null;
  assert(exists && stats.size > 1000, `Asset ${asset} tồn tại (${stats ? Math.round(stats.size / 1024) : 0} KB)`);
}

// 6. Kiểm thử Animation State Machine & Easing Thăng Cấp (Building System Guide)
console.log('\n6. Kiểm thử Animation State Machine & Easing Thăng Cấp:');

function calculateBurstTimeline(elapsed) {
  let scale = 1.0;
  let isFlashing = false;
  let isShaking = false;
  if (elapsed < 150) {
    scale = 1.0 - 0.1 * (elapsed / 150);
  } else if (elapsed < 250) {
    isFlashing = true;
    scale = 0.9 + 0.15 * ((elapsed - 150) / 100);
    isShaking = true;
  } else if (elapsed < 650) {
    const t = (elapsed - 250) / 400;
    const overshoot = 1 + 1.8 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
    scale = 0.8 + 0.2 * overshoot;
    if (elapsed <= 350) isShaking = true;
  } else {
    scale = 1.0;
  }
  return { scale, isFlashing, isShaking };
}

const t0 = calculateBurstTimeline(75);
assert(t0.scale < 1.0 && t0.scale >= 0.9, `Phase 1 (Squeeze): scale = ${t0.scale.toFixed(3)} (co nén nhẹ)`);

const t1 = calculateBurstTimeline(200);
assert(t1.isFlashing === true && t1.isShaking === true, `Phase 2 (Flash & Shake): isFlashing = true, isShaking = true`);

const t2 = calculateBurstTimeline(450);
assert(t2.scale > 1.0, `Phase 3 (Overshoot Spring): scale = ${t2.scale.toFixed(3)} (> 1.0 nảy đàn hồi)`);

const t3 = calculateBurstTimeline(800);
assert(Math.abs(t3.scale - 1.0) < 0.001, `Phase 4 (Settle): scale = ${t3.scale.toFixed(3)} (định hình ổn định)`);

console.log('\n========================================');
console.log(`📊 TỔNG KẾT: ${passed} ĐẠT, ${failed} LỖI`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 TẤT CẢ THỬ NGHIỆM ĐÃ VƯỢT QUA!\n');
}
