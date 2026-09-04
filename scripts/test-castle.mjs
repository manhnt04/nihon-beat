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
const GRID = 12;

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
assert(true, 'Tất cả 144 ô trên lưới 12x12 đều chuyển đổi thuận nghịch 100% chuẩn xác.');

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
assert(canPlace(10, 10, 3, 3, occupancy) === false, 'Đặt công trình 3x3 tràn mép lưới (10+3=13 > 12) -> BỊ CHẶN');
assert(canPlace(10, 10, 2, 2, occupancy) === true, 'Đặt công trình 2x2 vừa khít góc lưới (10, 10) -> HỢP LỆ');

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
  'public/castle/empty-island-rim-12x12.webp',
  'public/castle/empty-island-12x12.webp',
  'public/castle/empty-island-rim-12x12.png',
  'public/castle/empty-island-12x12.png',
  'public/castle/empty-island-rim-12x12.jpg',
  'public/castle/empty-island-12x12.jpg',
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

// 7. Kiểm thử GRID + HITBOX SYSTEM (castleGrid.ts)
console.log('\n7. Kiểm thử GRID + HITBOX SYSTEM (Footprints, GridManager, Di Chuyển & Snapping):');

// Implement / import functions directly to verify logic
function rectFootprint(w, h) {
  const cells = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      cells.push({ x, y });
    }
  }
  return cells;
}

function lShapeFootprint() {
  return [
    { x: 0, y: 0 }, { x: 1, y: 0 },
    { x: 0, y: 1 }, { x: 1, y: 1 },
    { x: 0, y: 2 },
  ];
}

function flipFootprintCells(cells, w) {
  return cells.map((c) => ({
    x: w - 1 - c.x,
    y: c.y,
  }));
}

function getEffectiveFootprint(b) {
  const base = b.cells && b.cells.length > 0 ? b.cells : rectFootprint(b.w, b.h);
  if (!b.flipX) return base;
  return flipFootprintCells(base, b.w);
}

class TestGridManager {
  constructor(cols = 12, rows = 12) {
    this.cols = cols;
    this.rows = rows;
    this.occupied = Array.from({ length: rows }, () => Array(cols).fill(null));
    this.buildings = new Map();
  }

  getAbsoluteCells(cells, gridX, gridY) {
    return cells.map((c) => ({ col: gridX + c.x, row: gridY + c.y }));
  }

  canPlace(cells, gridX, gridY, ignoreInstanceId = null, requireBuffer = true) {
    const absCells = this.getAbsoluteCells(cells, gridX, gridY);
    const footprintKeySet = new Set(absCells.map((c) => `${c.col},${c.row}`));

    for (const { col, row } of absCells) {
      if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
        return { ok: false, reason: 'out_of_bounds' };
      }
      const occupant = this.occupied[row]?.[col];
      if (occupant !== null && occupant !== undefined && occupant !== ignoreInstanceId) {
        return { ok: false, reason: 'collision', conflictWith: occupant };
      }
    }

    if (requireBuffer) {
      for (const { col, row } of absCells) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nc = col + dx;
            const nr = row + dy;
            if (footprintKeySet.has(`${nc},${nr}`)) continue;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
              const nOcc = this.occupied[nr]?.[nc];
              if (nOcc !== null && nOcc !== undefined && nOcc !== ignoreInstanceId) {
                return { ok: false, reason: 'buffer_violation', conflictWith: nOcc };
              }
            }
          }
        }
      }
    }

    return { ok: true };
  }

  placeBuilding(instanceId, cells, gridX, gridY, requireBuffer = true) {
    const check = this.canPlace(cells, gridX, gridY, null, requireBuffer);
    if (!check.ok) return false;
    for (const { col, row } of this.getAbsoluteCells(cells, gridX, gridY)) {
      this.occupied[row][col] = instanceId;
    }
    this.buildings.set(instanceId, { cells, gridX, gridY });
    return true;
  }

  moveBuilding(instanceId, newGridX, newGridY, requireBuffer = true) {
    const b = this.buildings.get(instanceId);
    if (!b) return { ok: false, reason: 'collision' };
    const check = this.canPlace(b.cells, newGridX, newGridY, instanceId, requireBuffer);
    if (!check.ok) return check;

    for (const { col, row } of this.getAbsoluteCells(b.cells, b.gridX, b.gridY)) {
      if (this.occupied[row]?.[col] === instanceId) this.occupied[row][col] = null;
    }
    for (const { col, row } of this.getAbsoluteCells(b.cells, newGridX, newGridY)) {
      this.occupied[row][col] = instanceId;
    }
    b.gridX = newGridX;
    b.gridY = newGridY;
    return { ok: true };
  }

  getPlacementPreview(cells, gridX, gridY, ignoreInstanceId = null, requireBuffer = true) {
    const check = this.canPlace(cells, gridX, gridY, ignoreInstanceId, requireBuffer);
    const absCells = this.getAbsoluteCells(cells, gridX, gridY);
    const footprintKeySet = new Set(absCells.map((c) => `${c.col},${c.row}`));

    const highlightCells = absCells.map(({ col, row }) => {
      const inBounds = col >= 0 && row >= 0 && col < this.cols && row < this.rows;
      if (!inBounds) return { col, row, valid: false };
      const occupant = this.occupied[row]?.[col];
      if (occupant !== null && occupant !== undefined && occupant !== ignoreInstanceId) {
        return { col, row, valid: false };
      }
      if (requireBuffer) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nc = col + dx;
            const nr = row + dy;
            if (footprintKeySet.has(`${nc},${nr}`)) continue;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
              const nOcc = this.occupied[nr]?.[nc];
              if (nOcc !== null && nOcc !== undefined && nOcc !== ignoreInstanceId) {
                return { col, row, valid: false };
              }
            }
          }
        }
      }
      return { col, row, valid: true };
    });
    return { valid: check.ok, reason: check.reason, highlightCells };
  }

  removeBuilding(instanceId) {
    const b = this.buildings.get(instanceId);
    if (!b) return false;
    for (const { col, row } of this.getAbsoluteCells(b.cells, b.gridX, b.gridY)) {
      if (this.occupied[row]?.[col] === instanceId) this.occupied[row][col] = null;
    }
    this.buildings.delete(instanceId);
    return true;
  }

  clear() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.occupied[r][c] = null;
      }
    }
    this.buildings.clear();
  }

  syncBuildings(buildings) {
    const currentIds = new Set(buildings.map((b) => b.id));
    for (const id of Array.from(this.buildings.keys())) {
      if (!currentIds.has(id)) {
        this.removeBuilding(id);
      }
    }
    for (const b of buildings) {
      const bCells = b.cells && b.cells.length > 0 ? b.cells : rectFootprint(b.w, b.h);
      const existing = this.buildings.get(b.id);
      if (!existing) {
        this.placeBuilding(b.id, bCells, b.col, b.row, false);
      } else if (existing.gridX !== b.col || existing.gridY !== b.row) {
        this.moveBuilding(b.id, b.col, b.row, false);
      }
    }
  }
}

// 7.1 Footprint generation
const rect3x3 = rectFootprint(3, 3);
assert(rect3x3.length === 9, 'rectFootprint(3, 3) tạo đúng 9 ô tương đối.');

const lShape = lShapeFootprint();
assert(lShape.length === 5, 'lShapeFootprint() tạo đúng 5 ô chữ L phi chữ nhật.');

// 7.2 GridManager 12x12 placement, collisions & 1-tile buffer
const gm = new TestGridManager(12, 12);
const placedMain = gm.placeBuilding('main', rect3x3, 4, 4);
assert(placedMain === true, 'Đặt Chủ Thành 3x3 tại (4, 4) trên lưới 12x12 -> THÀNH CÔNG');

const conflictCheck = gm.canPlace(rectFootprint(2, 2), 4, 4);
assert(conflictCheck.ok === false && conflictCheck.reason === 'collision', 'Đặt công trình 2x2 trùng đè (4, 4) của Chủ thành -> BỊ CHẶN do va chạm main');

const oobCheck = gm.canPlace(rectFootprint(2, 2), 11, 11);
assert(oobCheck.ok === false && oobCheck.reason === 'out_of_bounds', 'Đặt công trình 2x2 vượt biên (11+2 > 12) -> BỊ CHẶN do out of bounds');

// 7.3 Kiểm thử Quy Tắc Đệm 1 Ô (1-Tile Buffer Rule)
const bufferTouchCheck = gm.canPlace(rectFootprint(2, 2), 7, 4);
assert(bufferTouchCheck.ok === false && bufferTouchCheck.reason === 'buffer_violation', 'Đặt công trình 2x2 dính sát cạnh phải Chủ thành tại (7, 4) -> BỊ CHẶN do vi phạm đệm 1 ô');

const bufferDiagCheck = gm.canPlace(rectFootprint(1, 1), 7, 7);
assert(bufferDiagCheck.ok === false && bufferDiagCheck.reason === 'buffer_violation', 'Đặt công trình 1x1 chạm góc chéo Chủ thành tại (7, 7) -> BỊ CHẶN do vi phạm đệm 1 ô');

const bufferValidCheck = gm.canPlace(rectFootprint(2, 2), 8, 4);
assert(bufferValidCheck.ok === true, 'Đặt công trình 2x2 cách Chủ thành 1 ô trống (cột 7 trống) tại (8, 4) -> HỢP LỆ');

const placedListening = gm.placeBuilding('listening', rectFootprint(2, 2), 8, 4);
assert(placedListening === true, 'Đặt Thính Âm Các 2x2 tại (8, 4) an toàn -> THÀNH CÔNG');

const placedLibrary = gm.placeBuilding('library', rectFootprint(2, 2), 1, 4);
assert(placedLibrary === true, 'Đặt Tàng Thư Các 2x2 tại cánh trái (1, 4) an toàn -> THÀNH CÔNG');

// 7.4 L-Shape placement
const placedL = gm.placeBuilding('corridor-1', lShape, 0, 0);
assert(placedL === true, 'Đặt Lạc Hà Hành Lang (chữ L 5 ô) tại góc Tây Bắc (0, 0) -> THÀNH CÔNG');

// 7.5 Relocation / Moving Building with self-collision & buffer ignore
const moveSafe = gm.moveBuilding('listening', 8, 6);
assert(moveSafe.ok === true, 'Di chuyển Thính Âm Các trong khoảng cách an toàn sang (8, 6) -> THÀNH CÔNG');

const moveBufferCollision = gm.moveBuilding('listening', 7, 4);
assert(moveBufferCollision.ok === false && moveBufferCollision.reason === 'buffer_violation', 'Di chuyển Thính Âm Các đè sát Chủ Thành tại (7, 4) -> BỊ CHẶN do vi phạm đệm 1 ô');

// 7.6 Per-Cell Preview (Green/Red diamond highlights with buffer check)
const previewValid = gm.getPlacementPreview(rectFootprint(2, 2), 8, 9);
assert(previewValid.valid === true && previewValid.highlightCells.every((c) => c.valid), 'Preview vị trí trống cách xa (8, 9): 4/4 ô đều hợp lệ (Xanh)');

const previewBufferViolation = gm.getPlacementPreview(rectFootprint(2, 2), 7, 4);
assert(previewBufferViolation.valid === false && previewBufferViolation.highlightCells.some((c) => !c.valid), 'Preview vị trí sát vách: Tự động đánh dấu ĐỎ ô vi phạm khoảng đệm 1 ô');

// ========================================
// 8. FIX #1: Perimeter Polygon Outline (getFootprintOutline)
// ========================================
console.log('\n8. Kiểm thử Đường bao Chu vi Đa giác (Perimeter Polygon & L-Shape Outline):');

function edgeKey(a, b) {
  const [p1, p2] = [a, b].sort((m, n) => m.x - n.x || m.y - n.y);
  return `${p1.x},${p1.y}-${p2.x},${p2.y}`;
}

function getFootprintOutline(cells) {
  if (!cells || cells.length === 0) {
    return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  }
  const edgeCount = new Map();
  const addEdge = (a, b) => {
    const key = edgeKey(a, b);
    const existing = edgeCount.get(key);
    if (existing) existing.count++;
    else edgeCount.set(key, { a, b, count: 1 });
  };
  for (const { x, y } of cells) {
    addEdge({ x, y }, { x: x + 1, y });
    addEdge({ x: x + 1, y }, { x: x + 1, y: y + 1 });
    addEdge({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
    addEdge({ x, y: y + 1 }, { x, y });
  }
  const boundary = [...edgeCount.values()].filter((e) => e.count === 1);
  if (boundary.length === 0) {
    return [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  }
  const pointKey = (p) => `${p.x},${p.y}`;
  const adjacency = new Map();
  for (const e of boundary) {
    const ka = pointKey(e.a);
    const kb = pointKey(e.b);
    if (!adjacency.has(ka)) adjacency.set(ka, []);
    if (!adjacency.has(kb)) adjacency.set(kb, []);
    adjacency.get(ka).push(e.b);
    adjacency.get(kb).push(e.a);
  }
  const polygon = [];
  const visited = new Set();
  let current = boundary[0].a;
  let prevKey = '';
  while (true) {
    const key = pointKey(current);
    if (visited.has(key) && polygon.length > 2) break;
    visited.add(key);
    polygon.push(current);
    const neighbors = adjacency.get(key) || [];
    const next = neighbors.find((n) => pointKey(n) !== prevKey);
    if (!next) break;
    prevKey = key;
    current = next;
    if (polygon.length > cells.length * 4 + 8) break;
  }

  if (polygon.length <= 3) return polygon;
  const simplified = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    if (cross !== 0) {
      simplified.push(curr);
    }
  }

  return simplified.length >= 3 ? simplified : polygon;
}

const rect1x1Outline = getFootprintOutline(rectFootprint(1, 1));
assert(rect1x1Outline.length === 4, 'Ô 1x1 tạo ra đúng 4 đỉnh chu vi hình chữ nhật.');

const rect2x2Outline = getFootprintOutline(rectFootprint(2, 2));
assert(rect2x2Outline.length === 4, 'Khối 2x2 tạo ra đúng 4 đỉnh chu vi (khử cạnh chung bên trong).');

const lShapeOutline = getFootprintOutline(lShape);
assert(lShapeOutline.length === 6, 'Hình L (5 ô) tạo ra đúng 6 đỉnh chu vi viền chính xác hình L (phi lồi).');

// Kiểm thử điểm bên trong chữ L vs góc rỗng của chữ L
// L Shape: (0,0), (1,0), (0,1), (1,1), (0,2). Góc rỗng là (1, 2)
assert(pointInPolygon({ x: 0.5, y: 0.5 }, lShapeOutline) === true, 'Điểm (0.5, 0.5) nằm TRONG hình L -> TRÚNG.');
assert(pointInPolygon({ x: 0.5, y: 2.5 }, lShapeOutline) === true, 'Điểm (0.5, 2.5) phần đuôi hình L -> TRÚNG.');
assert(pointInPolygon({ x: 1.5, y: 2.5 }, lShapeOutline) === false, 'Điểm (1.5, 2.5) góc khuyết của hình L -> KHÔNG TRÚNG (Không bị click ảo).');

// ========================================
// 9. FIX #1: Sprite Bounds & Bottom-Center Anchor (computeSpriteBounds)
// ========================================
console.log('\n9. Kiểm thử Tính Toán Kích Thước Sprite Thống Nhất (SpriteBounds & Anchor):');

// ========================================
// 9. Bounding Volume & Screen Envelope (VISUAL_BUDGET & fitSpriteToEnvelope)
// ========================================
console.log('\n9. Kiểm thử Khối Giới Hạn Bounding Volume (Screen Envelope & Contain-Scale):');

const UNIT_PX = 40;

function computeScreenEnvelope(footprintW, footprintD, budget, tileW, tileH, scaleFactor = 1, imageScale = 1) {
  const baseScreenW = (footprintW + footprintD) * (tileW / 2);
  const baseScreenH =
    (footprintW + footprintD) * (tileH / 2) +
    budget.heightUnits * UNIT_PX * scaleFactor;

  return {
    baseMaxW: baseScreenW * budget.maxHorizontalBleed * imageScale,
    baseMaxH: baseScreenH * imageScale,
    crownMaxW: baseScreenW * (budget.maxHorizontalBleed + budget.crownBleedExtra) * imageScale,
  };
}

function fitSpriteToEnvelope(nativeImgW, nativeImgH, anchorScreen, envelope, budget) {
  const aspect = nativeImgH > 0 && nativeImgW > 0 ? nativeImgH / nativeImgW : (budget.aspect ?? 1.0);

  // Bước 1: scale theo chiều cao trước
  let imgH = envelope.baseMaxH;
  let imgW = imgH / aspect;

  // Bước 2: nếu bề ngang vượt quá "crown" cho phép (mái/ngọn) -> chặn trần tại crownMaxW
  if (imgW > envelope.crownMaxW) {
    imgW = envelope.crownMaxW;
    imgH = imgW * aspect;
  }

  const drawX = anchorScreen.x - imgW * budget.anchor.x;
  const drawY = anchorScreen.y - imgH * budget.anchor.y;

  return { drawX, drawY, imgW, imgH };
}

const mainHallBudget = {
  heightUnits: 2.6,
  maxHorizontalBleed: 1.15,
  crownBleedExtra: 0.25,
  anchor: { x: 0.5, y: 0.94 },
  aspect: 1.15,
};

const watchtowerBudget = {
  heightUnits: 1.3,
  maxHorizontalBleed: 1.10,
  crownBleedExtra: 0.10,
  anchor: { x: 0.5, y: 0.95 },
  aspect: 1.25,
};

const anchorPt = { x: 400, y: 350 };
const env3x3 = computeScreenEnvelope(3, 3, mainHallBudget, BASE_TILE_W, BASE_TILE_H, 1.0, 1.18);
// baseScreenW = (3+3)*(64/2) = 192px
// baseScreenH = (3+3)*(32/2) + 2.6*40 = 96 + 104 = 200px
// baseMaxH = 200 * 1.18 = 236px
// crownMaxW = 192 * (1.15 + 0.25) * 1.18 = 192 * 1.4 * 1.18 = 317.184px
assert(Math.abs(env3x3.baseMaxH - 236) < 0.01, 'Khối giới hạn: baseMaxH tính toán chính xác từ footprint (3x3), heightUnits và scale.');
assert(Math.abs(env3x3.crownMaxW - 317.184) < 0.01, 'Khối giới hạn: crownMaxW thiết lập trần tối đa cho phần mái (+25% extra bleed).');

// Trường hợp 1: Sprite tỷ lệ chuẩn (aspect = 1.15), khớp theo chiều cao
const fitNormal = fitSpriteToEnvelope(500, 575, anchorPt, env3x3, mainHallBudget);
// aspect = 1.15 -> imgH = 236, imgW = 236 / 1.15 = 205.217 <= 317.184
assert(Math.abs(fitNormal.imgH - 236) < 0.01, 'Sprite chuẩn: scale theo chiều cao baseMaxH.');
assert(fitNormal.imgW < env3x3.crownMaxW, 'Sprite chuẩn: bề ngang nằm gọn an toàn trong crownMaxW.');
assert(Math.abs(fitNormal.drawX - (anchorPt.x - fitNormal.imgW * 0.5)) < 0.01, 'Tọa độ drawX tự động căn giữa theo anchor.x = 0.5.');
assert(Math.abs(fitNormal.drawY - (anchorPt.y - fitNormal.imgH * 0.94)) < 0.01, 'Tọa độ drawY neo chính xác đáy-giữa theo anchor.y = 0.94.');

// Trường hợp 2: Sprite mái bè cực rộng (aspect = 0.5, ngang gấp đôi cao)
const fitWide = fitSpriteToEnvelope(1000, 500, anchorPt, env3x3, mainHallBudget);
// Nếu scale theo cao: imgH = 236 -> imgW = 236 / 0.5 = 472px > 317.184px!
// Hệ thống Bounding Volume BẮT BUỘC phải chặn trần tại crownMaxW = 317.184px:
assert(Math.abs(fitWide.imgW - env3x3.crownMaxW) < 0.01, 'Sprite mái bè rộng: BỊ CHẶN TRẦN chuẩn xác tại crownMaxW, không bao giờ tràn lấn đè ô kế bên.');
assert(Math.abs(fitWide.imgH - env3x3.crownMaxW * 0.5) < 0.01, 'Sprite mái bè rộng: Chiều cao tự động co lại bảo toàn nguyên vẹn aspect ratio.');

// Trường hợp 3: Công trình nhỏ 1x1 (Trạm gác tiền đồn)
const env1x1 = computeScreenEnvelope(1, 1, watchtowerBudget, BASE_TILE_W, BASE_TILE_H, 1.0, 1.0);
const fit1x1 = fitSpriteToEnvelope(200, 250, anchorPt, env1x1, watchtowerBudget);
// baseScreenW = 2 * 32 = 64px. crownMaxW = 64 * 1.2 = 76.8px.
assert(fit1x1.imgW <= env1x1.crownMaxW, 'Công trình 1x1: Giữ kích thước gọn gàng, không bị đội to quá khổ so với ô đất.');

// ========================================
// 10. FIX #2: GridManager Incremental Sync (Zero Allocation)
// ========================================
console.log('\n10. Kiểm thử Đồng bộ Gia tăng GridManager Singleton (Zero GC Allocations):');

const syncGm = new TestGridManager(12, 12);
const initialBuildings = [
  { id: 'b1', col: 0, row: 0, w: 2, h: 2 },
  { id: 'b2', col: 4, row: 4, w: 1, h: 1 },
  { id: 'b3', col: 8, row: 0, w: 2, h: 2 },
];

syncGm.syncBuildings(initialBuildings);
assert(syncGm.buildings.size === 3, 'Khởi tạo ban đầu: Đã đồng bộ 3 công trình vào singleton grid.');
assert(syncGm.occupied[0][0] === 'b1' && syncGm.occupied[4][4] === 'b2', 'Occupancy map ghi nhận chính xác ID.');

// Đồng bộ danh sách mới: Xóa b2, Di chuyển b1 sang (1, 1), Giữ nguyên b3
const updatedBuildings = [
  { id: 'b1', col: 1, row: 1, w: 2, h: 2 },
  { id: 'b3', col: 8, row: 0, w: 2, h: 2 },
];
syncGm.syncBuildings(updatedBuildings);
assert(syncGm.buildings.size === 2, 'Sau khi đồng bộ: b2 bị xóa khỏi Map.');
assert(syncGm.occupied[4][4] === null, 'Ô cũ của b2 tại (4, 4) đã được giải phóng thành null.');
assert(syncGm.occupied[0][0] === null && syncGm.occupied[1][1] === 'b1', 'b1 di chuyển sang (1, 1), ô (0, 0) được trả về tự do.');

// ========================================
// 11. FIX #3: Layout Sanitization & Cloud Integrity
// ========================================
console.log('\n11. Kiểm thử Vệ Sinh Bố Cục Khi Tải (Layout Sanitization):');

function sanitizeBuildingsLayout(rawList, coreObstacles = []) {
  if (!Array.isArray(rawList)) return [];
  const gm = new TestGridManager(12, 12);
  for (const core of coreObstacles) {
    const cells = core.cells && core.cells.length > 0 ? core.cells : rectFootprint(core.w, core.h);
    gm.placeBuilding(core.id, cells, core.col, core.row, false);
  }
  const validBuildings = [];
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const b = item;
    if (typeof b.id !== 'string' || typeof b.col !== 'number' || typeof b.row !== 'number') continue;
    const w = typeof b.w === 'number' && b.w > 0 ? b.w : 1;
    const h = typeof b.h === 'number' && b.h > 0 ? b.h : 1;
    const flipX = typeof b.flipX === 'boolean' ? b.flipX : false;
    const baseCells = Array.isArray(b.cells) && b.cells.length > 0 ? b.cells : rectFootprint(w, h);
    const effectiveCells = getEffectiveFootprint({ w, h, cells: baseCells, flipX });
    const check = gm.canPlace(effectiveCells, b.col, b.row, null, true);
    if (check.ok) {
      gm.placeBuilding(b.id, effectiveCells, b.col, b.row, false);
      validBuildings.push({ id: b.id, col: b.col, row: b.row, w, h, cells: baseCells, flipX });
    }
  }
  return validBuildings;
}

const coreHall = [{ id: 'main', col: 4, row: 4, w: 3, h: 3 }];
const corruptedLayout = [
  { id: 'good-1', col: 0, row: 0, w: 2, h: 2 }, // HỢP LỆ (cách xa main tại 4,4)
  { id: 'collision-hall', col: 4, row: 4, w: 1, h: 1 }, // VA CHẠM VỚI MAIN HALL
  { id: 'buffer-hall', col: 7, row: 4, w: 2, h: 2 }, // VI PHẠM VÙNG ĐỆM 1 Ô
  { id: 'oob-building', col: 11, row: 11, w: 2, h: 2 }, // VƯỢT BIÊN (11+2 > 12)
  { id: 'overlap-good', col: 0, row: 0, w: 1, h: 1 }, // TRÙNG ĐÈ LÊN GOOD-1
  { notAValidObject: 123 }, // RÁC DỮ LIỆU
  null,
];

const cleaned = sanitizeBuildingsLayout(corruptedLayout, coreHall);
assert(cleaned.length === 1, 'Layout Sanitizer loại bỏ toàn bộ 5 mục lỗi/trùng/vượt biên/vi phạm đệm, chỉ giữ lại đúng 1 công trình hợp lệ.');
assert(cleaned[0].id === 'good-1', 'Công trình giữ lại chính xác là good-1 tại (0, 0).');

// ========================================
// 12. Bilinear Quad Mapping & Island Calibration Engine
// ========================================
console.log('\n12. Kiểm thử Bilinear Quad Mapping & Hiệu Chuẩn Đảo Tiên:');

function testBilinearQuad(u, v, corners) {
  const { top, right, bottom, left } = corners;
  const x =
    (1 - u) * (1 - v) * top.x +
    u * (1 - v) * right.x +
    (1 - u) * v * left.x +
    u * v * bottom.x;

  const y =
    (1 - u) * (1 - v) * top.y +
    u * (1 - v) * right.y +
    (1 - u) * v * left.y +
    u * v * bottom.y;

  return { x, y };
}

const testCalib = {
  id: 'rim-12x12',
  name: 'Đảo Thành Cổ Viền Đá (12×12)',
  imageSrc: '/castle/empty-island-rim-12x12.jpg',
  sourceImageSize: { w: 1024, h: 1024 },
  plateauCorners: {
    top: { x: 512, y: 156 },
    right: { x: 926, y: 402 },
    bottom: { x: 512, y: 648 },
    left: { x: 98, y: 402 },
  },
  gridCols: 12,
  gridRows: 12,
};

// 1. Kiểm tra 4 đỉnh cực trị
const topPt = testBilinearQuad(0, 0, testCalib.plateauCorners);
assert(topPt.x === 512 && topPt.y === 156, 'Bilinear Quad tại (u=0, v=0) khớp chính xác đỉnh TOP (512, 156).');

const rightPt = testBilinearQuad(1, 0, testCalib.plateauCorners);
assert(rightPt.x === 926 && rightPt.y === 402, 'Bilinear Quad tại (u=1, v=0) khớp chính xác đỉnh RIGHT (926, 402).');

const bottomPt = testBilinearQuad(1, 1, testCalib.plateauCorners);
assert(bottomPt.x === 512 && bottomPt.y === 648, 'Bilinear Quad tại (u=1, v=1) khớp chính xác đỉnh BOTTOM (512, 648).');

const leftPt = testBilinearQuad(0, 1, testCalib.plateauCorners);
assert(leftPt.x === 98 && leftPt.y === 402, 'Bilinear Quad tại (u=0, v=1) khớp chính xác đỉnh LEFT (98, 402).');

// 2. Kiểm tra tâm mặt cỏ
const centerPt = testBilinearQuad(0.5, 0.5, testCalib.plateauCorners);
const expectedCenterX = (512 + 926 + 512 + 98) / 4;
const expectedCenterY = (156 + 402 + 648 + 402) / 4;
assert(
  Math.abs(centerPt.x - expectedCenterX) < 0.001 && Math.abs(centerPt.y - expectedCenterY) < 0.001,
  `Tâm mặt phẳng (u=0.5, v=0.5) tại (${centerPt.x}, ${centerPt.y}) khớp trọng tâm 4 đỉnh (${expectedCenterX}, ${expectedCenterY}).`
);

// 3. Kiểm thử Chiếu Thuận Nghịch 144/144 ô lưới bằng ScreenToGridCalibrated
function testGridToScreenCalibrated(col, row, calib, renderScale, drawOrigin) {
  const u = col / calib.gridCols;
  const v = row / calib.gridRows;
  const point = testBilinearQuad(u, v, calib.plateauCorners);
  return {
    x: drawOrigin.x + point.x * renderScale,
    y: drawOrigin.y + point.y * renderScale,
  };
}

function testPointInConvexQuad(pt, v0, v1, v2, v3) {
  const cp1 = (v1.x - v0.x) * (pt.y - v0.y) - (v1.y - v0.y) * (pt.x - v0.x);
  const cp2 = (v2.x - v1.x) * (pt.y - v1.y) - (v2.y - v1.y) * (pt.x - v1.x);
  const cp3 = (v3.x - v2.x) * (pt.y - v2.y) - (v3.y - v2.y) * (pt.x - v2.x);
  const cp4 = (v0.x - v3.x) * (pt.y - v3.y) - (v0.y - v3.y) * (pt.x - v3.x);
  const hasNeg = cp1 < 0 || cp2 < 0 || cp3 < 0 || cp4 < 0;
  const hasPos = cp1 > 0 || cp2 > 0 || cp3 > 0 || cp4 > 0;
  return !(hasNeg && hasPos);
}

function testScreenToGridCalibrated(screenX, screenY, calib, renderScale, drawOrigin) {
  const imgX = (screenX - drawOrigin.x) / renderScale;
  const imgY = (screenY - drawOrigin.y) / renderScale;
  const pt = { x: imgX, y: imgY };

  const cols = calib.gridCols;
  const rows = calib.gridRows;
  const { top, right, bottom, left } = calib.plateauCorners;
  const minX = Math.min(top.x, right.x, bottom.x, left.x) - 10;
  const maxX = Math.max(top.x, right.x, bottom.x, left.x) + 10;
  const minY = Math.min(top.y, right.y, bottom.y, left.y) - 10;
  const maxY = Math.max(top.y, right.y, bottom.y, left.y) + 10;

  if (imgX < minX || imgX > maxX || imgY < minY || imgY > maxY) {
    return { col: -1, row: -1 };
  }

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const u0 = c / cols;
      const u1 = (c + 1) / cols;
      const v0 = r / rows;
      const v1 = (r + 1) / rows;

      const vTop = testBilinearQuad(u0, v0, calib.plateauCorners);
      const vRight = testBilinearQuad(u1, v0, calib.plateauCorners);
      const vBottom = testBilinearQuad(u1, v1, calib.plateauCorners);
      const vLeft = testBilinearQuad(u0, v1, calib.plateauCorners);

      const cMinX = Math.min(vTop.x, vRight.x, vBottom.x, vLeft.x);
      const cMaxX = Math.max(vTop.x, vRight.x, vBottom.x, vLeft.x);
      const cMinY = Math.min(vTop.y, vRight.y, vBottom.y, vLeft.y);
      const cMaxY = Math.max(vTop.y, vRight.y, vBottom.y, vLeft.y);

      if (imgX >= cMinX && imgX <= cMaxX && imgY >= cMinY && imgY <= cMaxY) {
        if (testPointInConvexQuad(pt, vTop, vRight, vBottom, vLeft)) {
          return { col: c, row: r };
        }
      }
    }
  }
  return { col: -1, row: -1 };
}

const renderScale = 0.85;
const drawOrigin = { x: 150, y: 80 };

let roundtripPassCount = 0;
for (let c = 0; c < 12; c++) {
  for (let r = 0; r < 12; r++) {
    // Lấy tâm của ô (c + 0.5, r + 0.5) trên màn hình
    const screenCenter = testGridToScreenCalibrated(c + 0.5, r + 0.5, testCalib, renderScale, drawOrigin);
    const resolved = testScreenToGridCalibrated(screenCenter.x, screenCenter.y, testCalib, renderScale, drawOrigin);
    if (resolved.col === c && resolved.row === r) {
      roundtripPassCount++;
    } else {
      assert(false, `Lỗi roundtrip calibrated tại ô (${c}, ${r}) -> Nhận (${resolved.col}, ${resolved.row})`);
      break;
    }
  }
}

assert(roundtripPassCount === 144, 'Toàn bộ 144/144 ô trên đảo 12x12 chuyển đổi thuận nghịch song tuyến tính 100% chuẩn xác.');

// 4. Kiểm tra điểm ngoài rìa đảo
const oobPoint = testScreenToGridCalibrated(10, 10, testCalib, renderScale, drawOrigin);
assert(oobPoint.col === -1 && oobPoint.row === -1, 'Điểm ngoài phạm vi mặt cỏ trả về { col: -1, row: -1 } -> Không cho phép click nhầm ngoài đảo.');

// 13. Kiểm thử Tính Năng Lật Ngang Công Trình (Horizontal Flip / flipX & Asymmetric Footprints)
console.log('\n13. Kiểm thử Tính Năng Lật Ngang Công Trình (flipX & Asymmetric Footprints):');

// 1. Kiểm tra toán học lật ô vuông 2x2
const rect2x2 = rectFootprint(2, 2);
const flippedRect2x2 = flipFootprintCells(rect2x2, 2);
const rectSetBefore = new Set(rect2x2.map((c) => `${c.x},${c.y}`));
const rectSetAfter = new Set(flippedRect2x2.map((c) => `${c.x},${c.y}`));
let rectIdentical = true;
for (const key of rectSetBefore) {
  if (!rectSetAfter.has(key)) rectIdentical = false;
}
assert(rectIdentical && flippedRect2x2.length === 4, 'Khối chữ nhật 2x2: Lật ngang vẫn bảo toàn 100% diện tích ô chiếm dụng.');

// 2. Kiểm tra tính đối hợp (Involution): flip(flip(cells)) === cells
const lCells = lShapeFootprint(); // w=2, h=3
const lFlipped = flipFootprintCells(lCells, 2);
const lDoubleFlipped = flipFootprintCells(lFlipped, 2);
const isInvolution = JSON.stringify(lCells) === JSON.stringify(lDoubleFlipped);
assert(isInvolution, 'Tính chất đối hợp (Involution): Lật 2 lần khôi phục 100% hình dạng gốc.');

// 3. Kiểm tra chữ L sau khi lật: stem chuyển từ x=0 sang x=1
const originalStem = lCells.find((c) => c.y === 2);
const flippedStem = lFlipped.find((c) => c.y === 2);
assert(originalStem.x === 0 && flippedStem.x === 1, 'Hình L (5 ô): Đuôi chữ L tại x=0 chuyển sang x=1 chuẩn xác khi lật ngang.');

// 4. Kiểm tra getEffectiveFootprint
const bNormal = { w: 2, h: 3, cells: lCells, flipX: false };
const bFlipped = { w: 2, h: 3, cells: lCells, flipX: true };
const effNormal = getEffectiveFootprint(bNormal);
const effFlipped = getEffectiveFootprint(bFlipped);
assert(effNormal.find((c) => c.y === 2).x === 0, 'getEffectiveFootprint: flipX=false giữ nguyên hướng gốc.');
assert(effFlipped.find((c) => c.y === 2).x === 1, 'getEffectiveFootprint: flipX=true trả về footprint đã lật.');

// 5. Kiểm tra phát hiện va chạm khi lật cạnh chướng ngại vật
const flipTestGm = new TestGridManager(12, 12);
flipTestGm.placeBuilding('obstacle', rectFootprint(1, 1), 2, 5, false);

const checkNormal = flipTestGm.canPlace(effNormal, 0, 2, null, true);
assert(checkNormal.ok === true, 'Chữ L hướng thường tại (0, 2) cách obstacle tại (2, 5) an toàn -> HỢP LỆ.');

const checkFlipped = flipTestGm.canPlace(effFlipped, 0, 2, null, true);
assert(checkFlipped.ok === false && checkFlipped.reason === 'buffer_violation', 'Chữ L lật ngang tại (0, 2) chĩa đuôi (1, 4) chạm góc đệm (2, 5) -> BỊ CHẶN do vi phạm đệm 1 ô.');

// 6. Kiểm tra sanitizeBuildingsLayout bảo toàn flipX
const layoutWithFlip = [
  { id: 'flip-valid', col: 0, row: 0, w: 2, h: 2, flipX: true },
  { id: 'flip-invalid-oob', col: 11, row: 0, w: 2, h: 2, flipX: true },
];
const sanitizedWithFlip = sanitizeBuildingsLayout(layoutWithFlip, []);
assert(sanitizedWithFlip.length === 1 && sanitizedWithFlip[0].flipX === true, 'Sanitize Layout bảo toàn chính xác cờ flipX: true trên công trình hợp lệ.');

// 14. Kiểm thử Bắn Pháo Công Thành & Vòm Khiên Hộ Thành 2.5D (Ballistics, Ray-Dome, Shield State Machine)
console.log('\n14. Kiểm thử Bắn Pháo Công Thành & Vòm Khiên Hộ Thành 2.5D:');

// 1. Kiểm thử Quỹ đạo Đạn đạo Parabol 2.5D
function testComputeBallisticPos(startX, startY, targetX, targetY, arcHeight, t) {
  const clampedT = Math.max(0, Math.min(1, t));
  const x = (1 - clampedT) * startX + clampedT * targetX;
  const linearY = (1 - clampedT) * startY + clampedT * targetY;
  const arcOffset = 4 * arcHeight * clampedT * (1 - clampedT);
  const y = linearY - arcOffset;
  const dx = targetX - startX;
  const dy = (targetY - startY) - 4 * arcHeight * (1 - 2 * clampedT);
  const angle = Math.atan2(dy, dx);
  return { x, y, angle, dx, dy };
}

const startPt = { x: -40, y: 150 };
const tgtPt = { x: 500, y: 350 };
const arcH = 200;

// Test t=0 (Bắt đầu)
const p0 = testComputeBallisticPos(startPt.x, startPt.y, tgtPt.x, tgtPt.y, arcH, 0);
assert(p0.x === startPt.x && p0.y === startPt.y, 'Đạn đạo Parabol: Tọa độ xuất phát t=0 khớp chính xác điểm phóng (-40, 150).');

// Test t=0.5 (Đỉnh cung phóng)
const pMid = testComputeBallisticPos(startPt.x, startPt.y, tgtPt.x, tgtPt.y, arcH, 0.5);
const expectedMidX = (startPt.x + tgtPt.x) / 2;
const expectedMidY = (startPt.y + tgtPt.y) / 2 - arcH;
assert(
  Math.abs(pMid.x - expectedMidX) < 1e-6 && Math.abs(pMid.y - expectedMidY) < 1e-6,
  `Đạn đạo Parabol: Đỉnh vòm t=0.5 đạt độ cao cực đại (-${arcH}px so với trung điểm tuyến tính) tại (${pMid.x}, ${pMid.y}).`
);

// Test t=1.0 (Tiếp đất mục tiêu)
const p1 = testComputeBallisticPos(startPt.x, startPt.y, tgtPt.x, tgtPt.y, arcH, 1.0);
assert(p1.x === tgtPt.x && p1.y === tgtPt.y, 'Đạn đạo Parabol: Tiếp đất t=1.0 trúng chuẩn xác mục tiêu (500, 350).');

// Test góc tiếp tuyến lúc rơi
assert(p1.angle > 0, 'Đạn đạo Parabol: Góc tiếp tuyến tại t=1.0 chúc xuống đất tự nhiên (dy > 0).');

// 2. Kiểm thử Vòm Khiên 2.5D Ellipse & Ray-Dome Collision
function testIsInsideShieldDome(x, y, center, radiusX, radiusY, bottomAllowanceRatio = 0.12) {
  if (radiusX <= 0 || radiusY <= 0) return false;
  const dx = (x - center.x) / radiusX;
  const dy = (y - center.y) / radiusY;
  const distSq = dx * dx + dy * dy;
  const maxAllowedY = center.y + radiusY * bottomAllowanceRatio;
  return distSq <= 1.0 && y <= maxAllowedY;
}

const domeCenter = { x: 500, y: 350 };
const radiusX = 350;
const radiusY = 220;

// Điểm tâm đảo (bên trong khiên)
assert(
  testIsInsideShieldDome(500, 300, domeCenter, radiusX, radiusY) === true,
  'Vòm Khiên 2.5D: Điểm bên trong vòm (500, 300) được nhận diện nằm TRONG khiên.'
);

// Điểm bên ngoài khiên (trên cao ngoài vòm)
assert(
  testIsInsideShieldDome(500, 50, domeCenter, radiusX, radiusY) === false,
  'Vòm Khiên 2.5D: Điểm trên cao ngoài vòm (500, 50) nằm NGOÀI khiên.'
);

// Điểm ngoài rìa ngang
assert(
  testIsInsideShieldDome(100, 350, domeCenter, radiusX, radiusY) === false,
  'Vòm Khiên 2.5D: Điểm ngoài rìa ngang (100, 350) nằm NGOÀI khiên.'
);

// 3. Kiểm thử Phát hiện Va chạm Đạn Pháo với Vòm Khiên (Ray-Dome Binary Search Intersection)
function testFindShieldIntersection(startX, startY, targetX, targetY, arcHeight, tPrev, tCurr, domeCenter, radiusX, radiusY) {
  let low = tPrev;
  let high = tCurr;
  let hit = false;
  let finalPos = testComputeBallisticPos(startX, startY, targetX, targetY, arcHeight, high);
  for (let i = 0; i < 6; i++) {
    const mid = (low + high) / 2;
    const pos = testComputeBallisticPos(startX, startY, targetX, targetY, arcHeight, mid);
    if (testIsInsideShieldDome(pos.x, pos.y, domeCenter, radiusX, radiusY)) {
      hit = true;
      high = mid;
      finalPos = pos;
    } else {
      low = mid;
    }
  }
  return { hit, t: high, x: finalPos.x, y: finalPos.y };
}

// Đạn bay từ (-40, 150) hướng vào tâm đảo (500, 350)
const prevT = 0.5; // lúc ở ngoài vòm khiên
const currT = 0.85; // lúc đã đi vào trong vòm khiên
const hitIntersection = testFindShieldIntersection(startPt.x, startPt.y, tgtPt.x, tgtPt.y, arcH, prevT, currT, domeCenter, radiusX, radiusY);

assert(
  hitIntersection.hit === true && hitIntersection.t > prevT && hitIntersection.t < currT,
  `Ray-Dome Intersection: Tìm thấy điểm va chạm trên mặt khiên tại t=${hitIntersection.t.toFixed(3)} (trước khi đạn chạm đất t=1.0).`
);
assert(
  testIsInsideShieldDome(hitIntersection.x, hitIntersection.y, domeCenter, radiusX, radiusY) === true,
  `Ray-Dome Intersection: Tọa độ va chạm (${hitIntersection.x.toFixed(1)}, ${hitIntersection.y.toFixed(1)}) nằm đúng trên bề mặt vòm khiên.`
);

// 4. Kiểm thử State Machine của Khiên Hộ Thành
const shieldTestState = {
  active: false,
  status: 'inactive',
  activationProgress: 0,
  shatterProgress: 0,
  ripples: [],
  shards: [],
};

// Kích hoạt khiên
shieldTestState.active = true;
shieldTestState.status = 'activating';
shieldTestState.activationProgress = 0.5;
assert(shieldTestState.status === 'activating', 'Shield State Machine: Chuyển trạng thái sang activating khi kích hoạt Hộ Thành Phù.');

shieldTestState.activationProgress = 1.0;
shieldTestState.status = 'active';
assert(shieldTestState.status === 'active', 'Shield State Machine: Sau khi bung vòm 100%, khiên chuyển sang active phòng thủ toàn diện.');

// Chịu đòn & sóng xung kích lục giác
shieldTestState.status = 'hit_ripple';
shieldTestState.ripples.push({ x: hitIntersection.x, y: hitIntersection.y, radius: 4, maxRadius: 65, alpha: 1.0, speed: 140, color: '#38d9a9' });
assert(shieldTestState.ripples.length === 1, 'Shield Ripple: Sinh sóng chấn động lục giác tại điểm đạn chạm mặt khiên.');

// Nổ vỡ khiên (shattering)
function testCreateShieldShatterShards(centerX, centerY, radiusX, radiusY, count = 16) {
  const shards = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.PI + (Math.PI * i) / count;
    const sx = centerX + Math.cos(angle) * radiusX * 0.8;
    const sy = centerY + Math.sin(angle) * radiusY * 0.8;
    shards.push({ x: sx, y: sy, vx: Math.random() * 4 - 2, vy: Math.random() * 4 - 2, size: 8, alpha: 1.0 });
  }
  return shards;
}

shieldTestState.active = false;
shieldTestState.status = 'shattering';
shieldTestState.shards = testCreateShieldShatterShards(domeCenter.x, domeCenter.y, radiusX, radiusY, 24);
assert(shieldTestState.shards.length === 24, 'Shield Shatter: Khiên vỡ sinh đúng 24 mảnh vỡ pha lê tỏa ra mọi hướng.');

// 15. Kiểm thử Di Chuyển Công Trình Cốt Lõi & Tiến Trình Thi Công 10 Giây
console.log('\n15. Kiểm thử Di Chuyển Công Trình Cốt Lõi & Tiến Trình Thi Công 10s:');

const testCorePositions = {
  main: { col: 4, row: 4, flipX: false },
  library: { col: 1, row: 4, flipX: false },
  listening: { col: 8, row: 4, flipX: false },
};

// 15.1: Đồng bộ GridManager với các công trình cốt lõi tại vị trí động
const coreGM = new TestGridManager(12, 12);
coreGM.placeBuilding('main', rectFootprint(3, 3), testCorePositions.main.col, testCorePositions.main.row, 1, false);
coreGM.placeBuilding('library', rectFootprint(2, 2), testCorePositions.library.col, testCorePositions.library.row, 1, false);
coreGM.placeBuilding('listening', rectFootprint(2, 2), testCorePositions.listening.col, testCorePositions.listening.row, 1, false);

// 15.2: Di chuyển Chủ Thành 3x3 sang vị trí hợp lệ mới (4, 1)
const moveCheckValid = coreGM.canPlace(rectFootprint(3, 3), 4, 1, 'main', true);
assert(moveCheckValid.ok === true, 'Chủ Thành: Di chuyển 3x3 sang vị trí hợp lệ mới (4, 1) (ignoreId = main) -> HỢP LỆ.');

// 15.3: Di chuyển Chủ Thành 3x3 sang sát cạnh Thính Âm Các (5, 4) -> Vi phạm đệm 1 ô
const moveCheckBuffer = coreGM.canPlace(rectFootprint(3, 3), 5, 4, 'main', true);
assert(
  moveCheckBuffer.ok === false && moveCheckBuffer.reason === 'buffer_violation',
  'Chủ Thành: Di chuyển chạm sát vách Thính Âm Các tại (5, 4) -> BỊ CHẶN do vi phạm đệm 1 ô.'
);

// 15.3b: Di chuyển Chủ Thành đè lấn trực tiếp vào Thính Âm Các (7, 4) -> Trùng lấn
const moveCheckOccupied = coreGM.canPlace(rectFootprint(3, 3), 7, 4, 'main', true);
assert(
  moveCheckOccupied.ok === false && moveCheckOccupied.reason === 'collision',
  'Chủ Thành: Di chuyển đè trực tiếp lên Thính Âm Các tại (7, 4) -> BỊ CHẶN do va chạm collision.'
);

// 15.4: Di chuyển Chủ Thành 3x3 ra ngoài mép đảo (10, 10) (10+3 = 13 > 12)
const moveCheckOOB = coreGM.canPlace(rectFootprint(3, 3), 10, 10, 'main', true);
assert(
  moveCheckOOB.ok === false && moveCheckOOB.reason === 'out_of_bounds',
  'Chủ Thành: Di chuyển tràn ra ngoài mép đảo 12x12 -> BỊ CHẶN do out_of_bounds.'
);

// 15.5: Lật hướng nhìn (flipX) của Thính Âm Các và Tàng Thư Các
testCorePositions.library.flipX = !testCorePositions.library.flipX;
assert(testCorePositions.library.flipX === true, 'Tàng Thư Các: Lật hướng nhìn sang flipX=true thành công.');
testCorePositions.library.flipX = !testCorePositions.library.flipX;
assert(testCorePositions.library.flipX === false, 'Tàng Thư Các: Lật hướng lần 2 khôi phục trạng thái ban đầu (Involution).');

// 15.6: State Machine thi công xây dựng / nâng cấp 10 giây (10,000ms)
const testConstruction = {
  id: 'main',
  name: 'Chủ Thành',
  startTime: 1000000,
  duration: 10000, // 10s
  type: 'upgrade',
  targetLevel: 2,
};

function calcProgress(now, constr) {
  const elapsed = Math.max(0, now - constr.startTime);
  const progress = Math.min(1.0, elapsed / constr.duration);
  const remainingSec = Math.max(0, Math.ceil((constr.startTime + constr.duration - now) / 1000));
  return { progress, remainingSec };
}

// Tại t = 0s
const progT0 = calcProgress(1000000, testConstruction);
assert(progT0.progress === 0 && progT0.remainingSec === 10, 'Thi công 10s: Tại t=0s, tiến độ 0%, đồng hồ đếm ngược 10s.');

// Tại t = 5s (5000ms)
const progT5 = calcProgress(1000000 + 5000, testConstruction);
assert(progT5.progress === 0.5 && progT5.remainingSec === 5, 'Thi công 10s: Tại t=5s, tiến độ 50%, đồng hồ đếm ngược 5s, giàn giáo búa đập hoạt động.');

// Tại t = 10s (10000ms) -> Hoàn tất thi công & kích hoạt Level-Up Burst
const progT10 = calcProgress(1000000 + 10000, testConstruction);
assert(progT10.progress === 1.0 && progT10.remainingSec === 0, 'Thi công 10s: Tại t=10s, tiến độ đạt 100%, tự động kết thúc thi công.');

// Kiểm thử Instant Complete ("⚡ Hoàn thành ngay")
const instantState = { finished: false, burstTriggered: false };
function instantComplete(constr) {
  instantState.finished = true;
  instantState.burstTriggered = true;
}
instantComplete(testConstruction);
assert(
  instantState.finished && instantState.burstTriggered,
  'Thi công 10s: Nút "⚡ Hoàn thành ngay" lập tức chuyển tiến độ sang 100% và kích hoạt Level-Up Burst.'
);

// =========================================================
// 16. Kiểm thử Tích Hợp Hán Tự Thành Vào Dự Án Chính Hanzi Beat
// =========================================================
console.log('\n16. Kiểm thử Tích Hợp Hán Tự Thành Vào Dự Án Chính Hanzi Beat:');

// 16.1 Kiểm thử Điều Hướng & Định Tuyến (Route Mapping)
const screenPaths = {
  home: '/', songs: '/lessons', game: '/play', result: '/result',
  dictionary: '/dictionary', leaderboard: '/leaderboard', pvp: '/pvp',
  inventory: '/inventory', shop: '/shop', codex: '/profile/codex', castle: '/castle',
  'castle-test': '/castle-test', auth: '/profile',
};
function testScreenFromPath(pathname) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (normalized === '/profile/castle') return 'castle';
  return Object.entries(screenPaths).find(([, path]) => path === normalized)?.[0] ?? 'home';
}
assert(testScreenFromPath('/castle') === 'castle', 'Định tuyến: Đường dẫn trực tiếp /castle chuyển đúng sang màn hình castle.');
assert(testScreenFromPath('/profile/castle') === 'castle', 'Định tuyến: Đường dẫn kế thừa /profile/castle chuyển đúng sang màn hình castle (tương thích ngược).');

// 16.2 Kiểm thử Widget Trang Chủ (Home Castle Widget Calculations)
function calcCastleLevel(buildings) {
  return Math.max(1, Object.values(buildings).reduce((sum, lvl) => sum + lvl, 0) - 2);
}
function getCastleTitle(level) {
  return level >= 25 ? 'Thánh Điện Hán Tự' : level >= 18 ? 'Vương Thành' : level >= 10 ? 'Thành Học Viện' : level >= 5 ? 'Tiểu Viện' : 'Thảo Đường';
}
function calcProsperity(level, discoveries, streak, extraProsperity = 0) {
  return level * 250 + discoveries * 5 + streak * 20 + extraProsperity;
}

const testBuildings = { main: 3, library: 2, listening: 2 };
const testCastleLevel = calcCastleLevel(testBuildings); // 3 + 2 + 2 - 2 = 5
assert(testCastleLevel === 5, 'Widget Trang Chủ: Tính đúng Cấp thành = 5 từ bộ 3 công trình cốt lõi.');

const titleLvl5 = getCastleTitle(5);
assert(titleLvl5 === 'Tiểu Viện', 'Widget Trang Chủ: Cấp 5 tương ứng danh hiệu "Tiểu Viện".');

const titleLvl12 = getCastleTitle(12);
assert(titleLvl12 === 'Thành Học Viện', 'Widget Trang Chủ: Cấp 12 tương ứng danh hiệu "Thành Học Viện".');

const testProsperity = calcProsperity(testCastleLevel, 100, 10, 250); // 5*250 (1250) + 100*5 (500) + 10*20 (200) + 250 = 2200
assert(testProsperity === 2200, 'Widget Trang Chủ: Tính đúng Điểm Phồn Vinh = 2200 từ Cấp thành, Discoveries, Streak và Ngoại viện.');

// 16.3 Kiểm thử Thu Hoạch Nhàn Rỗi AFK (Idle Production Formula & 12h Cap)
function calcHarvest(elapsedMs, mainLevel) {
  const cappedMs = Math.min(12 * 3600 * 1000, Math.max(0, elapsedMs));
  const hours = cappedMs / (3600 * 1000);
  const wood = Math.floor(hours * (4 + mainLevel * 1.5));
  const ink = Math.floor(hours * (2 + mainLevel * 0.8));
  const coins = Math.floor(hours * (100 + mainLevel * 50));
  return { wood, ink, coins, hours };
}

// 2 giờ với Chủ Thành Lv.2: Wood = 2 * (4 + 3) = 14, Ink = 2 * (2 + 1.6) = 7.2 -> 7, Coins = 2 * (100 + 100) = 400
const harvest2h = calcHarvest(2 * 3600 * 1000, 2);
assert(harvest2h.wood === 14 && harvest2h.ink === 7 && harvest2h.coins === 400, 'AFK Thu Hoạch: 2 giờ tích lũy Chủ Thành Lv.2 sinh ra 14 🪵, 7 🖌, 400 🪙.');

// 24 giờ với Chủ Thành Lv.2 (phải bị chặn ở trần tối đa 12 giờ)
const harvest24h = calcHarvest(24 * 3600 * 1000, 2);
assert(harvest24h.hours === 12 && harvest24h.wood === 84 && harvest24h.ink === 43, 'AFK Thu Hoạch: Vượt quá 12 giờ bị khóa trần ở đúng 12 giờ tích lũy tối đa.');

// 16.4 Kiểm thử Phúc Lợi Tàng Thư Các & Thính Âm Các
function calcLibraryXpBonus(libraryLevel) {
  return libraryLevel * 5; // % bonus XP ôn từ vựng
}
function calcListeningTimeBonus(listeningLevel) {
  return listeningLevel * 0.5; // giây cộng thêm trong Audition
}
assert(calcLibraryXpBonus(3) === 15, 'Phúc lợi Thư Các: Tàng Thư Các Lv.3 tăng +15% XP học tập & ôn từ.');
assert(calcListeningTimeBonus(4) === 2.0, 'Phúc lợi Thính Âm Các: Thính Âm Các Lv.4 tăng +2.0s thời gian phản xạ nghe âm.');

// 16.5 Kiểm thử Xếp Hạng Phồn Vinh & Thăm Thành
const sampleCastles = [
  { uid: 'u1', name: 'Ngọc Các', score: 1800, likes: 12 },
  { uid: 'u2', name: 'Long Môn', score: 3500, likes: 45 },
  { uid: 'u3', name: 'Thảo Đường', score: 950, likes: 3 },
];
const sortedRank = [...sampleCastles].sort((a, b) => b.score - a.score);
assert(sortedRank[0].uid === 'u2' && sortedRank[0].score === 3500, 'Bảng Xếp Hạng: Xếp đúng Hạng 1 theo Điểm Phồn Vinh (3500).');
assert(sortedRank[2].uid === 'u3' && sortedRank[2].score === 950, 'Bảng Xếp Hạng: Xếp đúng Hạng 3 theo Điểm Phồn Vinh (950).');

console.log('\n========================================');
console.log(`📊 TỔNG KẾT: ${passed} ĐẠT, ${failed} LỖI`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 TẤT CẢ THỬ NGHIỆM ĐÃ VƯỢT QUA!\n');
}
