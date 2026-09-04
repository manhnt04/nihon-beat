/**
 * GRID + HITBOX SYSTEM (LOGIC LAYER)
 * ----------------------------------
 * Decoupled logic engine for isometric grid coordinates, footprints,
 * collision detection, occupancy tracking and movement.
 */

export interface FootprintCell {
  x: number;
  y: number;
}

export type PlacementFailureReason = 'out_of_bounds' | 'collision' | 'buffer_violation';

export interface PlacementCheckResult {
  ok: boolean;
  reason?: PlacementFailureReason;
  conflictWith?: string;
}

export interface PlacementPreviewResult {
  valid: boolean;
  reason?: PlacementFailureReason;
  gridX: number;
  gridY: number;
  highlightCells: { col: number; row: number; valid: boolean }[];
}

/**
 * Rectangular footprint (w x h)
 */
export function rectFootprint(w: number, h: number): FootprintCell[] {
  const cells: FootprintCell[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * Non-rectangular L-shaped footprint (5 cells: 2x2 base + 1 extension)
 */
export function lShapeFootprint(): FootprintCell[] {
  return [
    { x: 0, y: 0 }, { x: 1, y: 0 },
    { x: 0, y: 1 }, { x: 1, y: 1 },
    { x: 0, y: 2 },
  ];
}

/**
 * Non-rectangular T-shaped footprint (4 cells: top bar of 3 + 1 stem)
 */
export function tShapeFootprint(): FootprintCell[] {
  return [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
    { x: 1, y: 1 },
  ];
}

/**
 * Flip relative footprint cells horizontally across vertical bounding axis x' = (w - 1) - x
 * Mathematically involutive: flip(flip(cells)) === cells
 */
export function flipFootprintCells(cells: FootprintCell[], w: number): FootprintCell[] {
  return cells.map((c) => ({
    x: w - 1 - c.x,
    y: c.y,
  }));
}

/**
 * Compute the effective footprint cells for any building, taking into account flipX.
 */
export function getEffectiveFootprint(b: {
  w: number;
  h: number;
  cells?: FootprintCell[];
  flipX?: boolean;
}): FootprintCell[] {
  const base = b.cells && b.cells.length > 0 ? b.cells : rectFootprint(b.w, b.h);
  if (!b.flipX) return base;
  return flipFootprintCells(base, b.w);
}

/**
 * GridManager manages occupancy, collision checks, placement and moving
 */
export class GridManager {
  cols: number;
  rows: number;
  occupied: (string | null)[][];
  buildings: Map<string, { cells: FootprintCell[]; gridX: number; gridY: number; level?: number }>;

  constructor(cols = 12, rows = 12) {
    this.cols = cols;
    this.rows = rows;
    this.occupied = Array.from({ length: rows }, () => Array(cols).fill(null));
    this.buildings = new Map();
  }

  /**
   * Return absolute cells occupied by footprint at (gridX, gridY)
   */
  getAbsoluteCells(cells: FootprintCell[], gridX: number, gridY: number): { col: number; row: number }[] {
    return cells.map((c) => ({
      col: gridX + c.x,
      row: gridY + c.y,
    }));
  }

  /**
   * Check if footprint can be placed at (gridX, gridY).
   * ignoreInstanceId is critical for move operations so a building does not collide with itself.
   * requireBuffer ensures buildings are separated by at least 1 empty cell (8-neighbor rule).
   */
  canPlace(
    cells: FootprintCell[],
    gridX: number,
    gridY: number,
    ignoreInstanceId: string | null = null,
    requireBuffer = true
  ): PlacementCheckResult {
    const absCells = this.getAbsoluteCells(cells, gridX, gridY);
    const footprintKeySet = new Set(absCells.map((c) => `${c.col},${c.row}`));

    // 1. Check bounds and direct collisions
    for (const { col, row } of absCells) {
      if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) {
        return { ok: false, reason: 'out_of_bounds' };
      }
      const occupant = this.occupied[row]?.[col];
      if (occupant !== null && occupant !== undefined && occupant !== ignoreInstanceId) {
        return { ok: false, reason: 'collision', conflictWith: occupant };
      }
    }

    // 2. Check 1-tile buffer zone around all cells (cannot touch another building)
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

  /**
   * Place or register building into the grid
   */
  placeBuilding(
    instanceId: string,
    cells: FootprintCell[],
    gridX: number,
    gridY: number,
    level = 1,
    requireBuffer = true
  ): boolean {
    const check = this.canPlace(cells, gridX, gridY, null, requireBuffer);
    if (!check.ok) return false;

    const absCells = this.getAbsoluteCells(cells, gridX, gridY);
    for (const { col, row } of absCells) {
      this.occupied[row][col] = instanceId;
    }

    this.buildings.set(instanceId, { cells, gridX, gridY, level });
    return true;
  }

  /**
   * Remove building and free its cells
   */
  removeBuilding(instanceId: string): boolean {
    const b = this.buildings.get(instanceId);
    if (!b) return false;

    const absCells = this.getAbsoluteCells(b.cells, b.gridX, b.gridY);
    for (const { col, row } of absCells) {
      if (this.occupied[row]?.[col] === instanceId) {
        this.occupied[row][col] = null;
      }
    }

    this.buildings.delete(instanceId);
    return true;
  }

  /**
   * Move building to a new grid coordinate atomically
   */
  moveBuilding(
    instanceId: string,
    newGridX: number,
    newGridY: number,
    requireBuffer = true
  ): PlacementCheckResult {
    const b = this.buildings.get(instanceId);
    if (!b) return { ok: false, reason: 'collision' };

    const check = this.canPlace(b.cells, newGridX, newGridY, instanceId, requireBuffer);
    if (!check.ok) return check;

    // Free old cells
    const oldCells = this.getAbsoluteCells(b.cells, b.gridX, b.gridY);
    for (const { col, row } of oldCells) {
      if (this.occupied[row]?.[col] === instanceId) {
        this.occupied[row][col] = null;
      }
    }

    // Assign new cells
    const newCells = this.getAbsoluteCells(b.cells, newGridX, newGridY);
    for (const { col, row } of newCells) {
      this.occupied[row][col] = instanceId;
    }

    b.gridX = newGridX;
    b.gridY = newGridY;
    return { ok: true };
  }

  /**
   * Get preview details for dragging/hovering
   */
  getPlacementPreview(
    cells: FootprintCell[],
    gridX: number,
    gridY: number,
    ignoreInstanceId: string | null = null,
    requireBuffer = true
  ): PlacementPreviewResult {
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

    return {
      valid: check.ok,
      reason: check.reason,
      gridX,
      gridY,
      highlightCells,
    };
  }

  /**
   * Reset grid and clear all buildings
   */
  clear(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.occupied[r][c] = null;
      }
    }
    this.buildings.clear();
  }

  /**
   * Incrementally sync the GridManager with an array of buildings
   */
  syncBuildings(
    buildings: { id: string; cells?: FootprintCell[]; w: number; h: number; col: number; row: number; level?: number }[]
  ): void {
    const currentIds = new Set(buildings.map((b) => b.id));

    // 1. Remove missing buildings
    for (const id of Array.from(this.buildings.keys())) {
      if (!currentIds.has(id)) {
        this.removeBuilding(id);
      }
    }

    // 2. Add or move buildings (core synchronization skips buffer check so existing valid states remain stable)
    for (const b of buildings) {
      const bCells = b.cells && b.cells.length > 0 ? b.cells : rectFootprint(b.w, b.h);
      const existing = this.buildings.get(b.id);
      if (!existing) {
        this.placeBuilding(b.id, bCells, b.col, b.row, b.level ?? 1, false);
      } else if (existing.gridX !== b.col || existing.gridY !== b.row) {
        this.moveBuilding(b.id, b.col, b.row, false);
      }
    }
  }
}

export interface SerializedBuilding {
  id: string;
  name: string;
  hanzi: string;
  icon: string;
  col: number;
  row: number;
  w: number;
  h: number;
  height: number;
  templateId?: string;
  level?: number;
  imageSrc?: string;
  imageScale?: number;
  top: string;
  left: string;
  right: string;
  outline: string;
  accent?: string;
  isRemovable?: boolean;
  prosperity?: number;
  cost?: { wood: number; ink: number; coin: number };
  animState?: 'idle' | 'working' | 'upgrading' | 'level_up_burst';
  upgradeProgress?: number;
  cells?: FootprintCell[];
  flipX?: boolean;
}

/**
 * Validates and sanitizes a raw buildings layout loaded from storage or cloud.
 * Discards any corrupted, out-of-bounds, or overlapping buildings using GridManager.
 */
export function sanitizeBuildingsLayout(
  rawList: unknown,
  coreObstacles: { id: string; col: number; row: number; w: number; h: number; cells?: FootprintCell[] }[] = [],
  cols = 12,
  rows = 12
): SerializedBuilding[] {
  if (!Array.isArray(rawList)) return [];

  const gm = new GridManager(cols, rows);
  for (const core of coreObstacles) {
    const cells = core.cells && core.cells.length > 0 ? core.cells : rectFootprint(core.w, core.h);
    gm.placeBuilding(core.id, cells, core.col, core.row, 1, false);
  }

  const validBuildings: SerializedBuilding[] = [];

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const b = item as Partial<SerializedBuilding>;
    if (typeof b.id !== 'string' || typeof b.col !== 'number' || typeof b.row !== 'number') continue;
    const w = typeof b.w === 'number' && b.w > 0 ? b.w : 1;
    const h = typeof b.h === 'number' && b.h > 0 ? b.h : 1;
    const flipX = typeof b.flipX === 'boolean' ? b.flipX : false;
    const baseCells = Array.isArray(b.cells) && b.cells.length > 0 ? b.cells : rectFootprint(w, h);
    const effectiveCells = getEffectiveFootprint({ w, h, cells: baseCells, flipX });

    const check = gm.canPlace(effectiveCells, b.col, b.row, null, true);
    if (check.ok) {
      gm.placeBuilding(b.id, effectiveCells, b.col, b.row, b.level ?? 1, false);
      validBuildings.push({
        id: b.id,
        name: typeof b.name === 'string' ? b.name : 'Công trình',
        hanzi: typeof b.hanzi === 'string' ? b.hanzi : '筑',
        icon: typeof b.icon === 'string' ? b.icon : '🏛️',
        col: b.col,
        row: b.row,
        w,
        h,
        height: typeof b.height === 'number' ? b.height : 48,
        templateId: typeof b.templateId === 'string' ? b.templateId : undefined,
        level: typeof b.level === 'number' ? b.level : undefined,
        imageSrc: typeof b.imageSrc === 'string' ? b.imageSrc : undefined,
        imageScale: typeof b.imageScale === 'number' ? b.imageScale : undefined,
        top: typeof b.top === 'string' ? b.top : '#e8c9a0',
        left: typeof b.left === 'string' ? b.left : '#c8a374',
        right: typeof b.right === 'string' ? b.right : '#a8825a',
        outline: typeof b.outline === 'string' ? b.outline : '#7a5c3a',
        accent: typeof b.accent === 'string' ? b.accent : undefined,
        isRemovable: typeof b.isRemovable === 'boolean' ? b.isRemovable : true,
        prosperity: typeof b.prosperity === 'number' ? b.prosperity : 100,
        cost: b.cost && typeof b.cost === 'object' ? b.cost : { wood: 100, ink: 0, coin: 500 },
        animState: b.animState,
        upgradeProgress: typeof b.upgradeProgress === 'number' ? b.upgradeProgress : undefined,
        cells: baseCells,
        flipX,
      });
    }
  }

  return validBuildings;
}
