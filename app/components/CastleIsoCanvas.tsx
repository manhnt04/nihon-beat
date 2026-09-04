'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  FootprintCell,
  rectFootprint,
  lShapeFootprint,
  GridManager,
  flipFootprintCells,
  getEffectiveFootprint,
} from '../utils/castleGrid';
import { computeSpriteBounds, getVisualConfig, VISUAL_CATALOG } from '../utils/spriteBounds';
import { getFootprintOutline, Pt } from '../utils/footprintOutline';
import {
  IslandCalibration,
  DEFAULT_ISLAND_CALIBRATION,
  gridToScreenCalibrated,
  screenToGridCalibrated,
  footprintCornersCalibrated,
  drawDebugGrid,
} from '../utils/islandCalibration';
import {
  Cannonball,
  ExplosionBurst,
  ShieldDomeState,
  createCannonball,
  createShieldShatterShards,
  updateCombatFx,
  drawShieldDome,
  drawCombatEffects,
} from '../utils/castleCombatFx';

export type BuildingAnimState = 'idle' | 'working' | 'upgrading' | 'level_up_burst';

export interface CombatFxTrigger {
  type: 'cannon' | 'shield_toggle' | 'shield_hit' | 'shatter';
  targetCol?: number;
  targetRow?: number;
  targetBuildingId?: string;
  id: number;
}

export interface IsoBuildingData {
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
  animState?: BuildingAnimState;
  upgradeProgress?: number;
  cells?: FootprintCell[];
  flipX?: boolean;
}

export interface PendingBuildingTemplate {
  templateId: string;
  name: string;
  hanzi: string;
  icon: string;
  w: number;
  h: number;
  height: number;
  imageSrc?: string;
  imageScale?: number;
  top: string;
  left: string;
  right: string;
  outline: string;
  prosperity: number;
  cost: { wood: number; ink: number; coin: number };
  cells?: FootprintCell[];
  flipX?: boolean;
}

export interface CoreBuildingPositions {
  main?: { col: number; row: number; flipX?: boolean };
  library?: { col: number; row: number; flipX?: boolean };
  listening?: { col: number; row: number; flipX?: boolean };
}

interface CastleIsoCanvasProps {
  castle: {
    theme: string;
    buildings: {
      main: number;
      library: number;
      listening: number;
    };
    decorations?: {
      theme: string;
      weather: string | null;
      guardian: string | null;
      banner: string | null;
    };
  };
  environmentStage: number;
  selectedBuildingId: string | null;
  onSelectBuilding: (id: string | null) => void;
  showGrid: boolean;
  extraBuildings: IsoBuildingData[];
  onPlacedBuilding?: (newBuilding: IsoBuildingData) => void;
  onRemoveBuilding?: (id: string) => void;
  pendingBuilding: PendingBuildingTemplate | null;
  onCancelPlacement?: () => void;
  onToast: (msg: string, kind?: 'ok' | 'bad') => void;
  burstBuildingId?: string | null;
  burstText?: string;
  onBurstComplete?: () => void;
  enableIdleFx?: boolean;
  buildingAnimStates?: Record<string, { state: BuildingAnimState; progress?: number }>;
  movingBuilding?: IsoBuildingData | null;
  onConfirmMove?: (buildingId: string, newCol: number, newRow: number, newFlipX?: boolean) => void;
  onCancelMove?: () => void;
  onToggleFlip?: () => void;
  calibration?: IslandCalibration;
  showDebugGrid?: boolean;
  shieldActive?: boolean;
  combatFxTrigger?: CombatFxTrigger | null;
  onImpactBuilding?: (buildingId: string, col: number, row: number, blocked: boolean) => void;
  corePositions?: CoreBuildingPositions;
}

const GRID = 12;
const BASE_TILE_W = 64;
const BASE_TILE_H = 32;

// Shared In-Memory Image Cache for instant 60fps sprite rendering
const imageCache = new Map<string, HTMLImageElement>();

function getLoadedImage(src: string): HTMLImageElement | null {
  if (typeof window === 'undefined') return null;
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/**
 * Computes unified screen geometry, renderScale and drawOrigin for the calibrated island.
 */
export function getCalibrationGeometry(
  width: number,
  height: number,
  panX: number,
  panY: number,
  calib: IslandCalibration,
  shakeX = 0,
  shakeY = 0
) {
  const scaleFactor = Math.min(1.0, Math.max(0.55, width / 950));
  const targetPlateauW = GRID * BASE_TILE_W * scaleFactor;
  const plateauSourceW = Math.abs(calib.plateauCorners.right.x - calib.plateauCorners.left.x);
  const plateauSourceH = Math.abs(calib.plateauCorners.bottom.y - calib.plateauCorners.top.y);
  const renderScale = targetPlateauW / plateauSourceW;

  const plateauCenterSourceX =
    (calib.plateauCorners.top.x +
      calib.plateauCorners.right.x +
      calib.plateauCorners.bottom.x +
      calib.plateauCorners.left.x) /
    4;
  const plateauCenterSourceY =
    (calib.plateauCorners.top.y +
      calib.plateauCorners.right.y +
      calib.plateauCorners.bottom.y +
      calib.plateauCorners.left.y) /
    4;

  const screenCenterX = width / 2 + panX + shakeX;
  const screenCenterY = height * 0.44 + panY + shakeY;

  const drawOrigin: Pt = {
    x: screenCenterX - plateauCenterSourceX * renderScale,
    y: screenCenterY - plateauCenterSourceY * renderScale,
  };

  const tileW = targetPlateauW / calib.gridCols;
  const tileH = (plateauSourceH * renderScale) / calib.gridRows;

  return {
    scaleFactor,
    renderScale,
    imgW: calib.sourceImageSize.w * renderScale,
    imgH: calib.sourceImageSize.h * renderScale,
    drawOrigin,
    tileW,
    tileH,
    plateauCenter: { x: screenCenterX, y: screenCenterY },
  };
}

export default function CastleIsoCanvas({
  castle,
  environmentStage,
  selectedBuildingId,
  onSelectBuilding,
  showGrid,
  extraBuildings,
  onPlacedBuilding,
  onRemoveBuilding,
  pendingBuilding,
  onCancelPlacement,
  onToast,
  burstBuildingId,
  burstText,
  onBurstComplete,
  enableIdleFx = true,
  buildingAnimStates,
  movingBuilding,
  onConfirmMove,
  onCancelMove,
  onToggleFlip,
  calibration,
  showDebugGrid = false,
  shieldActive = false,
  combatFxTrigger = null,
  onImpactBuilding,
  corePositions,
}: CastleIsoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef({ width: 800, height: 600 });

  // Camera pan stored in ref to prevent 60-120Hz React re-renders while dragging
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // Hover grid cell for placement preview
  const hoverGridRef = useRef<{ col: number; row: number } | null>(null);

  // Animation Engine Refs (State Machine & Particle Systems)
  const activeBurstsRef = useRef<
    Map<string, { startTime: number; duration: number; text: string; particlesSpawned: boolean }>
  >(new Map());
  const burstParticlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; size: number; alpha: number; maxLife: number; life: number; color: string }[]
  >([]);
  const smokeParticlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; size: number; alpha: number; maxLife: number; life: number }[]
  >([]);
  const lastSmokeSpawnRef = useRef<number>(0);

  // Combat FX & Shield State Refs
  const cannonballsRef = useRef<Cannonball[]>([]);
  const explosionsRef = useRef<ExplosionBurst[]>([]);
  const shieldStateRef = useRef<ShieldDomeState>({
    active: !!shieldActive,
    status: shieldActive ? 'active' : 'inactive',
    activationProgress: shieldActive ? 1.0 : 0,
    shatterProgress: 0,
    ripples: [],
    shards: [],
    pulsePhase: 0,
  });
  const combatShakeRef = useRef<{ x: number; y: number; mag: number }>({ x: 0, y: 0, mag: 0 });
  const lastFrameTimeRef = useRef<number>(performance.now());
  const damageFlashingBuildingsRef = useRef<Map<string, number>>(new Map());
  const prevShieldActiveRef = useRef<boolean | undefined>(shieldActive);
  const prevCombatFxTriggerIdRef = useRef<number | null>(null);

  // Sync shieldActive prop changes with shield dome state
  useEffect(() => {
    if (shieldActive !== prevShieldActiveRef.current) {
      prevShieldActiveRef.current = shieldActive;
      if (shieldActive) {
        shieldStateRef.current.active = true;
        shieldStateRef.current.status = 'activating';
        shieldStateRef.current.activationProgress = 0;
      } else if (shieldStateRef.current.active) {
        const { width, height } = rectRef.current;
        const calib = propsRef.current.calibration ?? DEFAULT_ISLAND_CALIBRATION;
        const { renderScale, tileH, plateauCenter } = getCalibrationGeometry(
          width,
          height,
          panRef.current.x,
          panRef.current.y,
          calib
        );
        const radiusX = GRID * BASE_TILE_W * renderScale * 0.58;
        const radiusY = radiusX * 0.62;
        const domeCenter = { x: plateauCenter.x, y: plateauCenter.y + tileH * 0.35 };

        shieldStateRef.current.active = false;
        shieldStateRef.current.status = 'shattering';
        shieldStateRef.current.shatterProgress = 0;
        shieldStateRef.current.shards = createShieldShatterShards(domeCenter.x, domeCenter.y, radiusX, radiusY, 32);
      }
    }
  }, [shieldActive]);

  // Handle combatFxTrigger events (cannon bombardment, shield toggle, shield hit test, shatter)
  useEffect(() => {
    if (!combatFxTrigger || combatFxTrigger.id === prevCombatFxTriggerIdRef.current) return;
    prevCombatFxTriggerIdRef.current = combatFxTrigger.id;

    const { width, height } = rectRef.current;
    const calib = propsRef.current.calibration ?? DEFAULT_ISLAND_CALIBRATION;
    const { renderScale, drawOrigin, tileH, plateauCenter } = getCalibrationGeometry(
      width,
      height,
      panRef.current.x,
      panRef.current.y,
      calib
    );

    const radiusX = GRID * BASE_TILE_W * renderScale * 0.58;
    const radiusY = radiusX * 0.62;
    const domeCenter = { x: plateauCenter.x, y: plateauCenter.y + tileH * 0.35 };

    if (combatFxTrigger.type === 'cannon') {
      let targetPt: { x: number; y: number };
      if (combatFxTrigger.targetBuildingId) {
        const b = allBuildingsRef.current.find((item) => item.id === combatFxTrigger.targetBuildingId);
        if (b) {
          const c = footprintCornersCalibrated(b.col, b.row, b.w, b.h, calib, renderScale, drawOrigin);
          targetPt = { x: c.center.x, y: c.center.y };
        } else {
          targetPt = gridToScreenCalibrated(5.5, 5.5, calib, renderScale, drawOrigin);
        }
      } else if (combatFxTrigger.targetCol !== undefined && combatFxTrigger.targetRow !== undefined) {
        targetPt = gridToScreenCalibrated(
          combatFxTrigger.targetCol + 0.5,
          combatFxTrigger.targetRow + 0.5,
          calib,
          renderScale,
          drawOrigin
        );
      } else {
        targetPt = gridToScreenCalibrated(5.5, 5.5, calib, renderScale, drawOrigin);
      }

      const ball = createCannonball(targetPt.x, targetPt.y, width, height, {
        targetCol: combatFxTrigger.targetCol,
        targetRow: combatFxTrigger.targetRow,
        targetBuildingId: combatFxTrigger.targetBuildingId,
      });
      cannonballsRef.current.push(ball);
    } else if (combatFxTrigger.type === 'shield_toggle') {
      const nextActive = !shieldStateRef.current.active;
      shieldStateRef.current.active = nextActive;
      if (nextActive) {
        shieldStateRef.current.status = 'activating';
        shieldStateRef.current.activationProgress = 0;
      } else {
        shieldStateRef.current.status = 'inactive';
      }
    } else if (combatFxTrigger.type === 'shield_hit') {
      shieldStateRef.current.active = true;
      if (shieldStateRef.current.status === 'inactive' || shieldStateRef.current.status === 'shattering') {
        shieldStateRef.current.status = 'active';
        shieldStateRef.current.activationProgress = 1;
      }
      const targetPt = {
        x: domeCenter.x + (Math.random() - 0.5) * 80,
        y: domeCenter.y - radiusY * 0.55,
      };
      const ball = createCannonball(targetPt.x, targetPt.y, width, height, {
        color: '#63e6be',
      });
      cannonballsRef.current.push(ball);
    } else if (combatFxTrigger.type === 'shatter') {
      shieldStateRef.current.active = false;
      shieldStateRef.current.status = 'shattering';
      shieldStateRef.current.shatterProgress = 0;
      shieldStateRef.current.shards = createShieldShatterShards(domeCenter.x, domeCenter.y, radiusX, radiusY, 36);
    }
  }, [combatFxTrigger]);

  // Trigger burst animation when burstBuildingId prop changes
  useEffect(() => {
    if (!burstBuildingId) return;
    const building = allBuildingsRef.current.find((b) => b.id === burstBuildingId);
    const label = building ? `${building.name} Thăng Cấp!` : 'Thăng Cấp Thành Công!';
    activeBurstsRef.current.set(burstBuildingId, {
      startTime: performance.now(),
      duration: 1200,
      text: burstText || label,
      particlesSpawned: false,
    });
  }, [burstBuildingId, burstText]);

  // Preload official building assets and 12x12 empty island backdrop on mount
  useEffect(() => {
    const assets = [
      '/castle/empty-island-rim-12x12.webp',
      '/castle/empty-island-rim-12x12.png',
      '/castle/empty-island-12x12.webp',
      '/castle/empty-island-12x12.png',
      '/castle/buildings/main/stage-1.webp',
      '/castle/buildings/main/stage-2.webp',
      '/castle/buildings/main/stage-3.webp',
      '/castle/buildings/main/stage-4.webp',
      '/castle/buildings/main/stage-5.webp',
      '/castle/buildings/library/stage-1.webp',
      '/castle/buildings/listening/stage-1.webp',
    ];
    assets.forEach((src) => {
      if (!imageCache.has(src)) {
        const img = new Image();
        img.src = src;
        imageCache.set(src, img);
      }
    });
  }, []);

  // Main 3 structures synchronized with Progression
  const mainStage = Math.min(5, Math.ceil(castle.buildings.main / 2));
  const libraryStage = Math.min(5, Math.ceil(castle.buildings.library / 2));
  const listeningStage = Math.min(5, Math.ceil(castle.buildings.listening / 2));

  // Guardian statue if equipped (Memoized - positioned at front courtyard 5, 8)
  const guardianBuilding = useMemo<IsoBuildingData | null>(() => {
    if (!castle.decorations?.guardian) return null;
    const g = castle.decorations.guardian;
    return {
      id: 'guardian-statue',
      name:
        g === 'guardian-dragon'
          ? 'Thanh Long Trấn Thành'
          : g === 'guardian-qilin'
          ? 'Kỳ Lân Hiến Thụy'
          : 'Thạch Sư Uy Nghi',
      hanzi: g === 'guardian-dragon' ? '龍' : g === 'guardian-qilin' ? '麟' : '獅',
      icon: g === 'guardian-dragon' ? '🐉' : g === 'guardian-qilin' ? '🦄' : '🦁',
      col: 5,
      row: 8,
      w: 1,
      h: 1,
      height: 44,
      top: '#ffd875',
      left: '#d4aa48',
      right: '#a67e2a',
      outline: '#7c5716',
    };
  }, [castle.decorations?.guardian]);

  // Core 3 buildings on 12x12 grid with >=1 tile buffer spacing
  const coreBuildings = useMemo<IsoBuildingData[]>(() => {
    return [
      {
        id: 'main',
        name: 'Chính Điện · Chủ Thành',
        hanzi: '主城',
        icon: '🏯',
        col: corePositions?.main?.col ?? 4,
        row: corePositions?.main?.row ?? 4,
        flipX: corePositions?.main?.flipX ?? false,
        w: 3,
        h: 3,
        height: 100 + mainStage * 10,
        level: castle.buildings.main,
        imageSrc: `/castle/buildings/main/stage-${mainStage}.webp`,
        imageScale: 1.18,
        top: mainStage >= 4 ? '#ffd666' : mainStage >= 3 ? '#e0a94d' : '#f3cf7a',
        left: mainStage >= 4 ? '#c92a2a' : mainStage >= 3 ? '#9b2b2b' : '#d4a94e',
        right: mainStage >= 4 ? '#961b1b' : mainStage >= 3 ? '#781f1f' : '#b3853a',
        outline: '#7a1f1d',
        accent: '#f59f00',
      },
      {
        id: 'library',
        name: 'Tàng Thư Các',
        hanzi: '藏书阁',
        icon: '📚',
        col: corePositions?.library?.col ?? 1,
        row: corePositions?.library?.row ?? 4,
        flipX: corePositions?.library?.flipX ?? false,
        w: 2,
        h: 2,
        height: 70 + libraryStage * 8,
        level: castle.buildings.library,
        imageSrc: '/castle/buildings/library/stage-1.webp',
        imageScale: 1.08,
        top: '#74c0fc',
        left: '#1c7ed6',
        right: '#1864ab',
        outline: '#1971c2',
        accent: '#339af0',
      },
      {
        id: 'listening',
        name: 'Thính Âm Các',
        hanzi: '听音阁',
        icon: '🔔',
        col: corePositions?.listening?.col ?? 8,
        row: corePositions?.listening?.row ?? 4,
        flipX: corePositions?.listening?.flipX ?? false,
        w: 2,
        h: 2,
        height: 70 + listeningStage * 8,
        level: castle.buildings.listening,
        imageSrc: '/castle/buildings/listening/stage-1.webp',
        imageScale: 1.08,
        top: '#fcc2d7',
        left: '#d6336c',
        right: '#a61e4d',
        outline: '#c2255c',
        accent: '#f06595',
      },
    ];
  }, [
    castle.buildings.main,
    castle.buildings.library,
    castle.buildings.listening,
    mainStage,
    libraryStage,
    listeningStage,
    corePositions,
  ]);

  const allBuildings = useMemo<IsoBuildingData[]>(() => {
    return [
      ...coreBuildings,
      ...(guardianBuilding ? [guardianBuilding] : []),
      ...extraBuildings,
    ].map((b) => {
      const custom = buildingAnimStates?.[b.id];
      if (custom) {
        return { ...b, animState: custom.state, upgradeProgress: custom.progress };
      }
      return b;
    });
  }, [coreBuildings, guardianBuilding, extraBuildings, buildingAnimStates]);

  const allBuildingsRef = useRef(allBuildings);
  allBuildingsRef.current = allBuildings;

  // Keep latest props in ref for animation loop without recreating closures
  const propsRef = useRef({
    castle,
    environmentStage,
    selectedBuildingId,
    showGrid,
    pendingBuilding,
    onSelectBuilding,
    onPlacedBuilding,
    onRemoveBuilding,
    onCancelPlacement,
    onToast,
    onBurstComplete,
    enableIdleFx,
    movingBuilding,
    onConfirmMove,
    onCancelMove,
    onToggleFlip,
    calibration,
    showDebugGrid,
    shieldActive,
    combatFxTrigger,
    onImpactBuilding,
    corePositions,
  });
  propsRef.current = {
    castle,
    environmentStage,
    selectedBuildingId,
    showGrid,
    pendingBuilding,
    onSelectBuilding,
    onPlacedBuilding,
    onRemoveBuilding,
    onCancelPlacement,
    onToast,
    onBurstComplete,
    enableIdleFx,
    movingBuilding,
    onConfirmMove,
    onCancelMove,
    onToggleFlip,
    calibration,
    showDebugGrid,
    shieldActive,
    combatFxTrigger,
    onImpactBuilding,
    corePositions,
  };

  // Keyboard shortcut listener: Press 'R' / 'r' to toggle flip orientation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' || e.key === 'R') {
        propsRef.current.onToggleFlip?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // GridManager singleton ref - zero allocations during 60 FPS animation loop
  const gridManagerRef = useRef<GridManager | null>(null);
  const getGridManager = useCallback(() => {
    if (!gridManagerRef.current) {
      gridManagerRef.current = new GridManager(GRID, GRID);
    }
    return gridManagerRef.current;
  }, []);

  // Incrementally sync GridManager whenever allBuildings array changes
  useEffect(() => {
    const gm = getGridManager();
    gm.syncBuildings(
      allBuildings.map((b) => ({
        id: b.id,
        col: b.col,
        row: b.row,
        w: b.w,
        h: b.h,
        cells: getEffectiveFootprint(b),
      }))
    );
  }, [allBuildings, getGridManager]);

  // Algorithm 1: Grid ↔ Screen
  const gridToScreen = useCallback(
    (col: number, row: number, originX: number, originY: number, tileW: number, tileH: number) => {
      return {
        x: originX + (col - row) * (tileW / 2),
        y: originY + (col + row) * (tileH / 2),
      };
    },
    []
  );

  const screenToGrid = useCallback(
    (x: number, y: number, originX: number, originY: number, tileW: number, tileH: number) => {
      const dx = x - originX;
      const dy = y - originY;
      const colf = (dx / (tileW / 2) + dy / (tileH / 2)) / 2;
      const rowf = (dy / (tileH / 2) - dx / (tileW / 2)) / 2;
      return { col: Math.floor(colf), row: Math.floor(rowf) };
    },
    []
  );

  // Algorithm 2: Footprint Corners
  const footprintCorners = useCallback(
    (b: { col: number; row: number; w: number; h: number }, originX: number, originY: number, tileW: number, tileH: number) => {
      const N = gridToScreen(b.col, b.row, originX, originY, tileW, tileH);
      let E = gridToScreen(b.col + b.w - 1, b.row, originX, originY, tileW, tileH);
      E = { x: E.x + tileW / 2, y: E.y + tileH / 2 };
      let S = gridToScreen(b.col + b.w - 1, b.row + b.h - 1, originX, originY, tileW, tileH);
      S = { x: S.x, y: S.y + tileH };
      let W = gridToScreen(b.col, b.row + b.h - 1, originX, originY, tileW, tileH);
      W = { x: W.x - tileW / 2, y: W.y + tileH / 2 };
      return { N, E, S, W };
    },
    [gridToScreen]
  );

  // Algorithm 4: Depth Sorting Key & Deterministic Tie-Breaker
  const depthKey = useCallback((b: { col: number; row: number; w: number; h: number }) => {
    return b.col + b.w - 1 + (b.row + b.h - 1);
  }, []);

  const compareBuildingsDepth = useCallback(
    (a: IsoBuildingData, b: IsoBuildingData) => {
      const keyA = depthKey(a);
      const keyB = depthKey(b);
      if (keyA !== keyB) return keyA - keyB;
      // Secondary tie-breaker: sort by (col - row) then unique id for deterministic 60fps render (no Z-fighting)
      const diagA = a.col - a.row;
      const diagB = b.col - b.row;
      if (diagA !== diagB) return diagA - diagB;
      return a.id.localeCompare(b.id);
    },
    [depthKey]
  );

  // Algorithm 5: Fallback 3D Block Silhouette for hit testing
  const silhouette = useCallback(
    (b: IsoBuildingData, originX: number, originY: number, tileW: number, tileH: number, scaleFactor: number) => {
      const c = footprintCorners(b, originX, originY, tileW, tileH);
      const h = b.height * scaleFactor;
      const Np = { x: c.N.x, y: c.N.y - h };
      const Ep = { x: c.E.x, y: c.E.y - h };
      const Wp = { x: c.W.x, y: c.W.y - h };
      return [Np, Ep, c.E, c.S, c.W, Wp];
    },
    [footprintCorners]
  );

  const pointInPolygon = useCallback((pt: { x: number; y: number }, poly: { x: number; y: number }[]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x,
        yi = poly[i].y,
        xj = poly[j].x,
        yj = poly[j].y;
      const intersect =
        yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }, []);

  // Algorithm 3: Placement Validation using GridManager singleton
  const canPlace = useCallback(
    (col: number, row: number, w: number, h: number, ignoreId?: string) => {
      const gm = getGridManager();
      const cells = rectFootprint(w, h);
      return gm.canPlace(cells, col, row, ignoreId).ok;
    },
    [getGridManager]
  );

  // Helper polygon draw
  const poly = (ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) => {
    if (!pts || pts.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
  };

  // Weather particles state
  const particlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; size: number; alpha: number; kind: string }[]
  >([]);

  useEffect(() => {
    const parts = [];
    const kind = castle.decorations?.weather ?? 'petals';
    for (let i = 0; i < 28; i++) {
      parts.push({
        x: Math.random() * 1200,
        y: Math.random() * 800,
        vx: (Math.random() - 0.5) * 0.7 + 0.35,
        vy: Math.random() * 0.8 + 0.4,
        size: Math.random() * 4 + 3,
        alpha: Math.random() * 0.5 + 0.35,
        kind,
      });
    }
    particlesRef.current = parts;
  }, [castle.decorations?.weather]);

  // Main Render Frame (Called every RAF)
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = rectRef.current;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const {
      castle: cProp,
      selectedBuildingId: selId,
      showGrid: sGrid,
      pendingBuilding: pBuild,
      movingBuilding: mBuild,
      calibration: customCalib,
      showDebugGrid: sDebugGrid,
    } = propsRef.current;
    const curBuildings = allBuildingsRef.current;

    const calib = customCalib ?? DEFAULT_ISLAND_CALIBRATION;

    const now = performance.now();
    const deltaSec = Math.min(0.08, Math.max(0.001, (now - lastFrameTimeRef.current) / 1000));
    lastFrameTimeRef.current = now;

    // Advance shield dome state lifecycle
    const sState = shieldStateRef.current;
    if (sState.status === 'activating') {
      sState.activationProgress += deltaSec * 2.4;
      if (sState.activationProgress >= 1.0) {
        sState.activationProgress = 1.0;
        sState.status = 'active';
      }
    } else if (sState.status === 'hit_ripple') {
      if (sState.ripples.length === 0) {
        sState.status = 'active';
      }
    } else if (sState.status === 'shattering') {
      sState.shatterProgress += deltaSec * 1.5;
      if (sState.shatterProgress >= 1.0 && sState.shards.length === 0) {
        sState.status = 'inactive';
      }
    }

    // Screen Shake effect for active Level-Up Bursts (Section 1.3: 150ms - 350ms)
    let shakeX = 0;
    let shakeY = 0;
    for (const [, burst] of activeBurstsRef.current) {
      const elapsed = now - burst.startTime;
      if (elapsed >= 150 && elapsed <= 350) {
        const mag = (1 - (elapsed - 150) / 200) * 3.5;
        shakeX += (Math.random() - 0.5) * 2 * mag;
        shakeY += (Math.random() - 0.5) * 2 * mag;
      }
    }
    // Combat cannon hit shake
    shakeX += combatShakeRef.current.x;
    shakeY += combatShakeRef.current.y;
    combatShakeRef.current.x *= 0.84;
    combatShakeRef.current.y *= 0.84;

    const {
      scaleFactor,
      renderScale,
      imgW,
      imgH,
      drawOrigin,
      tileW,
      tileH,
      plateauCenter,
    } = getCalibrationGeometry(
      width,
      height,
      panRef.current.x,
      panRef.current.y,
      calib,
      shakeX,
      shakeY
    );

    // Shield dome dimensions centered around plateau center
    const targetPlateauW = GRID * BASE_TILE_W * scaleFactor;
    const radiusX = targetPlateauW * 0.58;
    const radiusY = targetPlateauW * 0.36;
    const domeCenter = { x: plateauCenter.x, y: plateauCenter.y + tileH * 0.35 };

    // Update combat effects physics & collisions
    const fxResult = updateCombatFx(
      cannonballsRef.current,
      explosionsRef.current,
      shieldStateRef.current,
      domeCenter,
      radiusX,
      radiusY,
      deltaSec,
      scaleFactor,
      (impact) => {
        if (!impact.blocked) {
          if (impact.targetBuildingId) {
            damageFlashingBuildingsRef.current.set(impact.targetBuildingId, now + 550);
          } else {
            for (const b of curBuildings) {
              if (impact.targetCol !== undefined && impact.targetRow !== undefined) {
                if (
                  impact.targetCol >= b.col &&
                  impact.targetCol < b.col + b.w &&
                  impact.targetRow >= b.row &&
                  impact.targetRow < b.row + b.h
                ) {
                  damageFlashingBuildingsRef.current.set(b.id, now + 550);
                  break;
                }
              }
            }
          }
        }
        propsRef.current.onImpactBuilding?.(
          impact.targetBuildingId || '',
          impact.targetCol ?? 0,
          impact.targetRow ?? 0,
          impact.blocked
        );
      }
    );
    if (fxResult.screenShake.mag > 0.4) {
      combatShakeRef.current.x = fxResult.screenShake.x;
      combatShakeRef.current.y = fxResult.screenShake.y;
    }

    // --- 1. Draw 12x12 Empty Island Backdrop or Procedural Cliff ---
    const islandImg =
      getLoadedImage(calib.imageSrc) ||
      getLoadedImage('/castle/empty-island-rim-12x12.webp') ||
      getLoadedImage('/castle/empty-island-rim-12x12.png') ||
      getLoadedImage('/castle/empty-island-12x12.webp') ||
      getLoadedImage('/castle/empty-island-12x12.png') ||
      getLoadedImage('/castle/empty-island-rim-12x12.jpg') ||
      getLoadedImage('/castle/empty-island-12x12.jpg');

    if (islandImg) {
      ctx.drawImage(islandImg, drawOrigin.x, drawOrigin.y, imgW, imgH);
    } else {
      // Fallback procedural cliff while loading
      const islandE = gridToScreenCalibrated(GRID, 0, calib, renderScale, drawOrigin);
      const islandS = gridToScreenCalibrated(GRID, GRID, calib, renderScale, drawOrigin);
      const islandW = gridToScreenCalibrated(0, GRID, calib, renderScale, drawOrigin);

      const cliffDepth = 75 * scaleFactor;
      const shadowRadiusX = (GRID * tileW) / 2.2;
      const shadowRadiusY = tileH * 2.5;
      const shadowCenterY = islandS.y + cliffDepth + 25;
      const underbellyGrad = ctx.createRadialGradient(
        islandS.x,
        shadowCenterY,
        shadowRadiusX * 0.15,
        islandS.x,
        shadowCenterY,
        shadowRadiusX
      );
      underbellyGrad.addColorStop(0, 'rgba(10, 5, 5, 0.42)');
      underbellyGrad.addColorStop(0.7, 'rgba(10, 5, 5, 0.15)');
      underbellyGrad.addColorStop(1, 'rgba(10, 5, 5, 0)');

      ctx.fillStyle = underbellyGrad;
      ctx.beginPath();
      ctx.ellipse(islandS.x, shadowCenterY, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Island rock cliff sides
      ctx.fillStyle = '#3a271d';
      poly(ctx, [
        islandW,
        islandS,
        { x: islandS.x, y: islandS.y + cliffDepth },
        { x: islandW.x, y: islandW.y + cliffDepth * 0.7 },
      ]);
      ctx.fill();

      ctx.fillStyle = '#2b1b13';
      poly(ctx, [
        islandS,
        islandE,
        { x: islandE.x, y: islandE.y + cliffDepth * 0.7 },
        { x: islandS.x, y: islandS.y + cliffDepth },
      ]);
      ctx.fill();
    }

    // --- 2. Draw Ground Tiles ---
    const activeTarget = pBuild || mBuild;

    for (let col = 0; col < GRID; col++) {
      for (let row = 0; row < GRID; row++) {
        const vTop = gridToScreenCalibrated(col, row, calib, renderScale, drawOrigin);
        const vRight = gridToScreenCalibrated(col + 1, row, calib, renderScale, drawOrigin);
        const vBottom = gridToScreenCalibrated(col + 1, row + 1, calib, renderScale, drawOrigin);
        const vLeft = gridToScreenCalibrated(col, row + 1, calib, renderScale, drawOrigin);
        const pts = [vTop, vRight, vBottom, vLeft];

        if (!islandImg) {
          const isAlternate = (col + row) % 2 === 0;
          const tileColor = isAlternate ? '#cbe5a3' : '#bddf90';
          const strokeColor = 'rgba(70, 100, 40, 0.22)';
          ctx.fillStyle = tileColor;
          poly(ctx, pts);
          ctx.fill();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (sGrid || activeTarget) {
          ctx.strokeStyle = 'rgba(120, 180, 80, 0.35)';
          ctx.lineWidth = 1;
          poly(ctx, pts);
          ctx.stroke();
        }

        // Show coordinates when sGrid is active
        if (sGrid) {
          const center = gridToScreenCalibrated(col + 0.5, row + 0.5, calib, renderScale, drawOrigin);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
          ctx.font = `${Math.round(8 * scaleFactor)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${col},${row}`, center.x, center.y);
        }
      }
    }

    // --- 3. Placement & Movement Per-Cell Grid Preview (GRID + HITBOX SYSTEM) ---
    if (activeTarget && hoverGridRef.current) {
      const { col, row } = hoverGridRef.current;
      const targetCells = getEffectiveFootprint(activeTarget);
      const ignoreId = mBuild ? mBuild.id : null;

      // Use GridManager singleton (zero per-frame allocations)
      const gm = getGridManager();
      const preview = gm.getPlacementPreview(targetCells, col, row, ignoreId);

      // --- PER-CELL ISOMETRIC HIGHLIGHT (GREEN = VALID, RED = COLLISION/OOB) ---
      for (const cell of preview.highlightCells) {
        if (cell.col >= 0 && cell.row >= 0 && cell.col < GRID && cell.row < GRID) {
          const vTop = gridToScreenCalibrated(cell.col, cell.row, calib, renderScale, drawOrigin);
          const vRight = gridToScreenCalibrated(cell.col + 1, cell.row, calib, renderScale, drawOrigin);
          const vBottom = gridToScreenCalibrated(cell.col + 1, cell.row + 1, calib, renderScale, drawOrigin);
          const vLeft = gridToScreenCalibrated(cell.col, cell.row + 1, calib, renderScale, drawOrigin);
          const pts = [vTop, vRight, vBottom, vLeft];

          ctx.fillStyle = cell.valid ? 'rgba(46, 204, 113, 0.44)' : 'rgba(231, 76, 60, 0.52)';
          poly(ctx, pts);
          ctx.fill();

          ctx.strokeStyle = cell.valid ? '#2ecc71' : '#e74c3c';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      // Footprint true perimeter outline (handles L-shape, T-shape, rect)
      const outlinePts = getFootprintOutline(targetCells);
      const outlineScreen = outlinePts.map((p) =>
        gridToScreenCalibrated(col + p.x, row + p.y, calib, renderScale, drawOrigin)
      );
      ctx.strokeStyle = preview.valid ? '#2ecc71' : '#e74c3c';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
      poly(ctx, outlineScreen);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ghost preview of the building image or icon using unified sprite bounds
      const ghostImg = activeTarget.imageSrc ? getLoadedImage(activeTarget.imageSrc) : null;
      if (ghostImg) {
        ctx.globalAlpha = 0.72;
        const fpCorners = footprintCornersCalibrated(col, row, activeTarget.w, activeTarget.h, calib, renderScale, drawOrigin);
        const floatOffsetY = mBuild ? 10 * scaleFactor : 0;
        const anchorScreen = { x: fpCorners.center.x, y: fpCorners.S.y - floatOffsetY };
        const visual = getVisualConfig(activeTarget.templateId, ghostImg.naturalHeight / ghostImg.naturalWidth);
        const bounds = computeSpriteBounds(
          anchorScreen,
          activeTarget.w,
          activeTarget.h,
          tileW,
          tileH,
          scaleFactor,
          visual,
          ghostImg.naturalWidth,
          ghostImg.naturalHeight,
          activeTarget.imageScale ?? 1
        );
        ctx.save();
        ctx.translate(anchorScreen.x, anchorScreen.y);
        ctx.scale(activeTarget.flipX ? -1 : 1, 1);
        ctx.translate(-anchorScreen.x, -anchorScreen.y);
        ctx.drawImage(ghostImg, bounds.drawX, bounds.drawY, bounds.imgW, bounds.imgH);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    // --- 4. Depth Sorting (Algorithm 4) with Deterministic Tie-Breaker ---
    const sorted = [...curBuildings].sort(compareBuildingsDepth);

    // --- 5. Draw Buildings with Two-Tier Shadows & Animations ---
    sorted.forEach((b) => {
      const c = footprintCornersCalibrated(b.col, b.row, b.w, b.h, calib, renderScale, drawOrigin);
      const h = b.height * scaleFactor;
      const isSelected = b.id === selId;
      const footCenterX = c.center.x;
      const contactY = c.center.y;

      // --- SECTION 2.1 & 2.3: TWO-TIER REALISTIC SHADOW SYSTEM ---
      // Layer 1: Ambient Contact Shadow (AO) - Sharp & Dark right at base
      const contactRadX = (b.w * tileW) / 2.35;
      const contactRadY = (b.h * tileH) / 2.4;
      ctx.fillStyle = 'rgba(10, 5, 5, 0.42)';
      ctx.beginPath();
      ctx.ellipse(footCenterX, contactY, contactRadX, contactRadY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Layer 2: Main Directional Shadow - Cast along light angle (top-left -> bottom-right)
      const dirOffsetX = 8 * scaleFactor;
      const dirOffsetY = 5 * scaleFactor;
      const dirRadX = ((b.w * tileW) / 1.85) * (b.level && b.level >= 5 ? 1.15 : 1.0);
      const dirRadY = (b.h * tileH) / 1.95;
      const dirCenterX = footCenterX + dirOffsetX;
      const dirCenterY = contactY + dirOffsetY;
      const bGrad = ctx.createRadialGradient(
        dirCenterX,
        dirCenterY,
        dirRadX * 0.15,
        dirCenterX,
        dirCenterY,
        dirRadX
      );
      bGrad.addColorStop(0, 'rgba(12, 6, 6, 0.34)');
      bGrad.addColorStop(0.65, 'rgba(12, 6, 6, 0.12)');
      bGrad.addColorStop(1, 'rgba(12, 6, 6, 0)');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.ellipse(dirCenterX, dirCenterY, dirRadX, dirRadY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Check if real webp image is available & loaded in cache!
      const spriteImg = b.imageSrc ? getLoadedImage(b.imageSrc) : null;

      // --- SECTION 1.3: LEVEL-UP BURST CINEMATIC TIMELINE ---
      let spriteScale = 1.0;
      let isFlashing = false;
      const burst = activeBurstsRef.current.get(b.id);
      let burstElapsed = 0;
      if (burst) {
        burstElapsed = now - burst.startTime;
        if (burstElapsed < 150) {
          // Phase 1 (0-150ms): Squeeze down to 0.9x
          spriteScale = 1.0 - 0.1 * (burstElapsed / 150);
        } else if (burstElapsed < 250) {
          // Phase 2 (150-250ms): White flash + expand
          isFlashing = true;
          spriteScale = 0.9 + 0.15 * ((burstElapsed - 150) / 100);
          if (!burst.particlesSpawned) {
            burst.particlesSpawned = true;
            // Spawn 32 starburst particles
            for (let k = 0; k < 32; k++) {
              const angle = Math.random() * Math.PI * 2;
              const speed = Math.random() * 4.5 + 2.5;
              const colors = ['#ffd700', '#fff3bf', '#ffec99', '#ffffff', '#69db7c', '#ffa94d'];
              burstParticlesRef.current.push({
                x: footCenterX,
                y: c.S.y - h * 0.6,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                size: Math.random() * 4 + 3,
                alpha: 1,
                maxLife: 45 + Math.random() * 25,
                life: 0,
                color: colors[Math.floor(Math.random() * colors.length)],
              });
            }
          }
        } else if (burstElapsed < 650) {
          // Phase 4 (250-650ms): Overshoot spring scale (0.8 -> 1.08 -> 1.0)
          const t = (burstElapsed - 250) / 400;
          const overshoot = 1 + 1.8 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
          spriteScale = 0.8 + 0.2 * overshoot;
        } else if (burstElapsed < burst.duration) {
          spriteScale = 1.0;
        } else {
          activeBurstsRef.current.delete(b.id);
          propsRef.current.onBurstComplete?.();
        }
      }

      // Upgrading state subtle pulsing vibration
      if (b.animState === 'upgrading') {
        spriteScale *= 1.0 + 0.012 * Math.sin(now * 0.015);
      }

      if (spriteImg) {
        // Unified Sprite Bounds calculation with bottom-center anchor & Screen Envelope containment
        const visual = getVisualConfig(b.templateId || b.id, spriteImg.naturalHeight / spriteImg.naturalWidth);
        const anchorScreen = { x: footCenterX, y: c.S.y };
        const bounds = computeSpriteBounds(
          anchorScreen,
          b.w,
          b.h,
          tileW,
          tileH,
          scaleFactor,
          visual,
          spriteImg.naturalWidth,
          spriteImg.naturalHeight,
          b.imageScale ?? 1
        );

        // --- SECTION 2.4: HIGH-LEVEL CELESTIAL AURA ---
        if ((b.id === 'main' && mainStage >= 4) || (b.level && b.level >= 7)) {
          const auraAlpha = 0.22 + 0.12 * Math.sin(now * 0.003);
          const auraGrad = ctx.createRadialGradient(
            footCenterX, bounds.drawY + bounds.imgH * 0.35, 10,
            footCenterX, bounds.drawY + bounds.imgH * 0.35, bounds.imgW * 0.65
          );
          auraGrad.addColorStop(0, `rgba(255, 215, 80, ${auraAlpha})`);
          auraGrad.addColorStop(0.65, `rgba(255, 180, 50, ${auraAlpha * 0.35})`);
          auraGrad.addColorStop(1, 'rgba(255, 215, 80, 0)');
          ctx.fillStyle = auraGrad;
          ctx.beginPath();
          ctx.arc(footCenterX, bounds.drawY + bounds.imgH * 0.35, bounds.imgW * 0.65, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draw Sprite with transform anchor at bottom-center ground contact
        ctx.save();
        ctx.translate(anchorScreen.x, anchorScreen.y);
        ctx.scale(spriteScale * (b.flipX ? -1 : 1), spriteScale);
        ctx.translate(-anchorScreen.x, -anchorScreen.y);

        const isDamageFlashing = (damageFlashingBuildingsRef.current.get(b.id) ?? 0) > now;
        if (isDamageFlashing) {
          ctx.filter = 'drop-shadow(0 0 16px #ff3b30) brightness(1.7) sepia(0.6) saturate(3)';
        } else if (isFlashing) {
          ctx.filter = 'brightness(3.2) contrast(1.4)';
        } else if (isSelected) {
          ctx.shadowColor = '#ffd43b';
          ctx.shadowBlur = 18;
        }

        ctx.drawImage(spriteImg, bounds.drawX, bounds.drawY, bounds.imgW, bounds.imgH);
        ctx.restore();

        if (isDamageFlashing) {
          ctx.save();
          ctx.globalAlpha = 0.38;
          ctx.fillStyle = '#ff4d4f';
          ctx.beginPath();
          ctx.ellipse(footCenterX, bounds.drawY + bounds.imgH * 0.5, bounds.imgW * 0.48, bounds.imgH * 0.48, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // --- SECTION 1.2: UPGRADING STATE OVERLAYS (SCAFFOLDING, HAMMER, PROGRESS BAR) ---
        if (b.animState === 'upgrading') {
          ctx.save();
          // Scaffolding lattice frame
          ctx.strokeStyle = 'rgba(235, 185, 75, 0.78)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([6, 4]);
          const scaffoldTopY = bounds.drawY - 8 * scaleFactor;
          const scaffoldBottomY = c.S.y + tileH * 0.2;
          const scaffoldLeftX = footCenterX - bounds.imgW * 0.52;
          const scaffoldRightX = footCenterX + bounds.imgW * 0.52;
          const scaffoldW = scaffoldRightX - scaffoldLeftX;
          const scaffoldH = scaffoldBottomY - scaffoldTopY;
          ctx.strokeRect(scaffoldLeftX, scaffoldTopY, scaffoldW, scaffoldH);
          // Diagonal braces
          ctx.beginPath();
          ctx.moveTo(scaffoldLeftX, scaffoldTopY);
          ctx.lineTo(scaffoldRightX, scaffoldBottomY);
          ctx.moveTo(scaffoldRightX, scaffoldTopY);
          ctx.lineTo(scaffoldLeftX, scaffoldBottomY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Bobbing Hammer
          const hammerBob = Math.sin(now * 0.009) * 6 * scaleFactor;
          const hammerY = bounds.drawY - 24 * scaleFactor + hammerBob;
          ctx.font = `${Math.round(22 * scaleFactor)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('🔨', footCenterX, hammerY);

          // Floating Progress Bar with Countdown
          const barW = Math.max(70 * scaleFactor, b.w * tileW * 0.72);
          const barH = 8 * scaleFactor;
          const barX = footCenterX - barW / 2;
          const barY = hammerY + 18 * scaleFactor;
          const pct = Math.min(1, Math.max(0, b.upgradeProgress ?? ((now % 5000) / 5000)));
          const remainingSec = Math.max(0, Math.ceil((1 - pct) * 10));

          ctx.fillStyle = 'rgba(15, 8, 6, 0.92)';
          ctx.beginPath();
          ctx.roundRect(barX, barY, barW, barH, 4);
          ctx.fill();
          ctx.strokeStyle = '#ffd43b';
          ctx.lineWidth = 1;
          ctx.stroke();

          const pGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
          pGrad.addColorStop(0, '#51cf66');
          pGrad.addColorStop(1, '#94d82d');
          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.roundRect(barX + 1, barY + 1, Math.max(2, (barW - 2) * pct), barH - 2, 3);
          ctx.fill();

          ctx.font = `bold ${Math.round(9 * scaleFactor)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = '#fff3bf';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = 4;
          ctx.fillText(`🔨 ${Math.round(pct * 100)}% (${remainingSec}s)`, footCenterX, barY - 3 * scaleFactor);
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        // --- SECTION 1.3: FLOATING LEVEL-UP BURST TEXT ---
        if (burst && burstElapsed > 180) {
          const textProgress = (burstElapsed - 180) / (burst.duration - 180);
          const textY = bounds.drawY - 12 * scaleFactor - textProgress * 45 * scaleFactor;
          const textAlpha = Math.max(0, 1 - textProgress);
          ctx.save();
          ctx.font = `bold ${Math.round(13 * scaleFactor)}px "Songti SC", "SimSun", serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = `rgba(255, 230, 120, ${textAlpha})`;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
          ctx.shadowBlur = 6;
          ctx.fillText(`✨ ${burst.text} ✨`, footCenterX, textY);
          ctx.restore();
        }
      } else {
        // Fallback: 3D stylized isometric block for tree, stone, or until image loads
        const Np = { x: c.N.x, y: c.N.y - h };
        const Ep = { x: c.E.x, y: c.E.y - h };
        const Sp = { x: c.S.x, y: c.S.y - h };
        const Wp = { x: c.W.x, y: c.W.y - h };

        const isDamageFlashing = (damageFlashingBuildingsRef.current.get(b.id) ?? 0) > now;
        ctx.strokeStyle = isDamageFlashing ? '#ff4d4f' : isSelected ? '#ffd43b' : b.outline;
        ctx.lineWidth = isDamageFlashing ? 3 : isSelected ? 2.5 : 1.4;

        // Left Wall
        ctx.fillStyle = isDamageFlashing ? '#c92a2a' : b.left;
        poly(ctx, [c.W, c.S, Sp, Wp]);
        ctx.fill();
        ctx.stroke();

        // Right Wall
        ctx.fillStyle = isDamageFlashing ? '#a61e4d' : b.right;
        poly(ctx, [c.S, c.E, Ep, Sp]);
        ctx.fill();
        ctx.stroke();

        // Roof / Top Surface
        ctx.fillStyle = isDamageFlashing ? '#ff8787' : b.top;
        poly(ctx, [Np, Ep, Sp, Wp]);
        ctx.fill();
        ctx.stroke();

        // Icon on roof
        const roofCenterX = (Np.x + Ep.x + Sp.x + Wp.x) / 4;
        const roofCenterY = (Np.y + Ep.y + Sp.y + Wp.y) / 4;
        ctx.font = `${Math.round((14 + b.w * 5) * scaleFactor)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.icon, roofCenterX, roofCenterY - 4);
      }

      // Building Label Tag pill (centered at footprint bottom)
      const labelText = b.level ? `${b.hanzi} Lv.${b.level}` : b.name;
      ctx.font = `bold ${Math.round(10 * scaleFactor)}px "Nunito", sans-serif`;
      const textWidth = ctx.measureText(labelText).width;
      const pillW = textWidth + 14 * scaleFactor;
      const pillH = 18 * scaleFactor;
      const pillX = footCenterX - pillW / 2;
      const pillY = c.S.y + 4;

      ctx.fillStyle = isSelected ? '#a61e4d' : 'rgba(25, 12, 10, 0.88)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 8 * scaleFactor);
      ctx.fill();

      ctx.strokeStyle = isSelected ? '#ffd43b' : '#dfbd68';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#fff0d0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, footCenterX, pillY + pillH / 2 + 1);

      // Algorithm 2 & 5: Highlight Selected Footprint
      if (isSelected) {
        ctx.strokeStyle = '#ffd43b';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 3]);
        poly(ctx, [c.N, c.E, c.S, c.W]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // --- 5.5 Draw Debug Grid Overlay if enabled (Bilinear Points) ---
    if (sDebugGrid) {
      drawDebugGrid(ctx, calib, renderScale, drawOrigin);
    }

    // --- 5.8 Draw 2.5D Defense Shield Dome (Wrapping Island & Buildings) ---
    drawShieldDome(ctx, shieldStateRef.current, domeCenter, radiusX, radiusY, scaleFactor, now);

    // --- 6. Idle Rooftop Smoke Particles (Section 1.1) ---
    const isIdleEnabled = propsRef.current.enableIdleFx !== false;
    if (isIdleEnabled) {
      if (now - lastSmokeSpawnRef.current > 280) {
        lastSmokeSpawnRef.current = now;
        for (const b of curBuildings) {
          const c = footprintCornersCalibrated(b.col, b.row, b.w, b.h, calib, renderScale, drawOrigin);
          const footCenterX = c.center.x;

          // Rooftop smoke for core buildings
          if (b.id === 'main' || b.id === 'library' || b.id === 'listening') {
            const roofPeakY = c.S.y - (b.height * scaleFactor * 1.32);
            if (smokeParticlesRef.current.length < 35) {
              smokeParticlesRef.current.push({
                x: footCenterX + (Math.random() - 0.5) * 10 * scaleFactor,
                y: roofPeakY,
                vx: (Math.random() - 0.5) * 0.35 + 0.18,
                vy: Math.random() * 0.55 + 0.45,
                size: Math.random() * 2.8 + 2.2,
                alpha: 0.42,
                maxLife: 55 + Math.random() * 30,
                life: 0,
              });
            }
          }

          // Construction smoke & dust puffs around building base during upgrading
          if (b.animState === 'upgrading') {
            if (smokeParticlesRef.current.length < 50) {
              smokeParticlesRef.current.push({
                x: footCenterX + (Math.random() - 0.5) * (b.w * tileW * 0.65),
                y: c.S.y - Math.random() * (b.h * tileH * 0.35),
                vx: (Math.random() - 0.5) * 0.55,
                vy: Math.random() * 0.65 + 0.45,
                size: Math.random() * 3.5 + 2.5,
                alpha: 0.52,
                maxLife: 45 + Math.random() * 25,
                life: 0,
              });
            }
          }
        }
      }

      if (smokeParticlesRef.current.length > 0) {
        ctx.save();
        for (let i = smokeParticlesRef.current.length - 1; i >= 0; i--) {
          const p = smokeParticlesRef.current[i];
          p.life++;
          p.x += p.vx + Math.sin(p.life * 0.05) * 0.4;
          p.y -= p.vy;
          p.size += 0.1;
          const progress = p.life / p.maxLife;
          const alpha = p.alpha * (1 - progress);
          if (progress >= 1 || alpha <= 0.01) {
            smokeParticlesRef.current.splice(i, 1);
            continue;
          }
          ctx.fillStyle = `rgba(235, 230, 225, ${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * scaleFactor, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // --- 7. Level-Up Burst Particles (Section 1.3) ---
    if (burstParticlesRef.current.length > 0) {
      ctx.save();
      for (let i = burstParticlesRef.current.length - 1; i >= 0; i--) {
        const p = burstParticlesRef.current[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.vx *= 0.98;
        const progress = p.life / p.maxLife;
        const alpha = p.alpha * (1 - progress);
        if (progress >= 1 || alpha <= 0.01) {
          burstParticlesRef.current.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5) * scaleFactor, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- 6. Atmospheric Weather Particles (Batched) ---
    if (particlesRef.current.length > 0) {
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > height + 10) p.y = -10;
        if (p.x > width + 10) p.x = -10;
        if (p.x < -10) p.x = width + 10;

        ctx.globalAlpha = p.alpha;
        if (p.kind === 'weather-snow') {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'weather-lanterns') {
          ctx.fillStyle = '#ff922b';
          ctx.beginPath();
          ctx.roundRect(p.x, p.y, p.size * 1.5, p.size * 2, 3);
          ctx.fill();
        } else {
          // Petals
          ctx.fillStyle = '#ff8787';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size, p.size * 0.5, p.x * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    // --- 9. Draw Ballistic Cannonballs and Explosions (Top Combat Layer) ---
    drawCombatEffects(ctx, cannonballsRef.current, explosionsRef.current, scaleFactor);
  }, [compareBuildingsDepth, getGridManager]);

  // Single Persistent Animation Loop (Decoupled from React State)
  useEffect(() => {
    let animId: number;

    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const w = rect.width > 0 ? rect.width : (typeof window !== 'undefined' ? window.innerWidth : 800);
      const h = rect.height > 0 ? rect.height : (typeof window !== 'undefined' ? window.innerHeight : 600);
      rectRef.current = { width: w, height: h };

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const loop = () => {
      if (rectRef.current.width <= 0 || rectRef.current.height <= 0) {
        handleResize();
      }
      drawFrame();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [drawFrame]);

  // Mouse & Touch Pointer Handling (Click, Drag, and Placement)
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const calib = propsRef.current.calibration ?? DEFAULT_ISLAND_CALIBRATION;
      const { renderScale, drawOrigin } = getCalibrationGeometry(
        rect.width,
        rect.height,
        panRef.current.x,
        panRef.current.y,
        calib
      );

      const g = screenToGridCalibrated(x, y, calib, renderScale, drawOrigin);
      if (g.col >= 0 && g.row >= 0 && g.col < GRID && g.row < GRID) {
        hoverGridRef.current = { col: g.col, row: g.row };
      } else {
        hoverGridRef.current = null;
      }
    }

    if (!isDraggingRef.current) return;
    const dx = Math.abs(e.clientX - (dragStartRef.current.x + panRef.current.x));
    const dy = Math.abs(e.clientY - (dragStartRef.current.y + panRef.current.y));
    if (dx > 4 || dy > 4) hasDraggedRef.current = true;

    // Directly update pan coordinates - zero React component re-renders!
    panRef.current = {
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;

    // If user was dragging to pan camera, do not trigger click / placement
    if (hasDraggedRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const calib = propsRef.current.calibration ?? DEFAULT_ISLAND_CALIBRATION;
    const { renderScale, drawOrigin, scaleFactor, tileW, tileH } = getCalibrationGeometry(
      rect.width,
      rect.height,
      panRef.current.x,
      panRef.current.y,
      calib
    );

    const {
      pendingBuilding: pBuild,
      movingBuilding: mBuild,
      onSelectBuilding: selCb,
      onToast: toastCb,
      onPlacedBuilding: placeCb,
      onConfirmMove: moveCb,
    } = propsRef.current;
    const curBuildings = allBuildingsRef.current;

    // Case 0: Moving an existing placed building
    if (mBuild) {
      const g = screenToGridCalibrated(x, y, calib, renderScale, drawOrigin);
      const targetCells = getEffectiveFootprint(mBuild);

      const gm = getGridManager();
      const check = gm.canPlace(targetCells, g.col, g.row, mBuild.id);
      if (check.ok) {
        if (moveCb) {
          moveCb(mBuild.id, g.col, g.row, mBuild.flipX);
        }
      } else {
        if (check.reason === 'out_of_bounds') {
          toastCb('Vị trí di chuyển nằm ngoài phạm vi Đảo Tiên!', 'bad');
        } else if (check.reason === 'buffer_violation') {
          toastCb('Cần đặt cách công trình khác ít nhất 1 ô trống!', 'bad');
        } else {
          toastCb(`Vị trí (${g.col}, ${g.row}) đã có công trình khác chiếm dụng!`, 'bad');
        }
      }
      return;
    }

    // Case 1: Active Placement Mode with a chosen building template
    if (pBuild) {
      const g = screenToGridCalibrated(x, y, calib, renderScale, drawOrigin);
      const targetCells = getEffectiveFootprint(pBuild);

      const gm = getGridManager();
      const check = gm.canPlace(targetCells, g.col, g.row);
      if (check.ok) {
        const newBuilding: IsoBuildingData = {
          id: `build-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          templateId: pBuild.templateId,
          name: pBuild.name,
          hanzi: pBuild.hanzi,
          icon: pBuild.icon,
          col: g.col,
          row: g.row,
          w: pBuild.w,
          h: pBuild.h,
          cells: pBuild.cells,
          flipX: !!pBuild.flipX,
          height: pBuild.height,
          imageSrc: pBuild.imageSrc,
          imageScale: pBuild.imageScale,
          top: pBuild.top,
          left: pBuild.left,
          right: pBuild.right,
          outline: pBuild.outline,
          isRemovable: true,
          prosperity: pBuild.prosperity,
          cost: pBuild.cost,
        };
        if (placeCb) placeCb(newBuilding);
      } else {
        if (check.reason === 'out_of_bounds') {
          toastCb('Vui lòng chọn vị trí nằm trong phạm vi Tiên Đảo!', 'bad');
        } else if (check.reason === 'buffer_violation') {
          toastCb('Cần đặt cách công trình khác ít nhất 1 ô trống!', 'bad');
        } else {
          toastCb(`Vị trí (${g.col}, ${g.row}) đã bị chiếm hoặc không đủ diện tích!`, 'bad');
        }
      }
      return;
    }

    // Case 2: Standard Mode - Click Hit Test (Reverse depth-sorted polygon + sprite bounding box)
    const sorted = [...curBuildings].sort(compareBuildingsDepth);
    let hit: IsoBuildingData | null = null;

    for (let i = sorted.length - 1; i >= 0; i--) {
      const b = sorted[i];

      // Test 1: Exact ground footprint perimeter (convex or non-convex outline)
      const targetCells = getEffectiveFootprint(b);
      const outlinePts = getFootprintOutline(targetCells);
      const groundPoly = outlinePts.map((p) =>
        gridToScreenCalibrated(b.col + p.x, b.row + p.y, calib, renderScale, drawOrigin)
      );
      if (pointInPolygon({ x, y }, groundPoly)) {
        hit = b;
        break;
      }

      // Test 2: Visual sprite bounding box (or fallback 3D block silhouette)
      if (b.imageSrc) {
        const c = footprintCornersCalibrated(b.col, b.row, b.w, b.h, calib, renderScale, drawOrigin);
        const footCenterX = c.center.x;
        const anchorScreen = { x: footCenterX, y: c.S.y };
        const visual = getVisualConfig(b.templateId || b.id);
        const spriteImg = getLoadedImage(b.imageSrc);
        const natW = spriteImg?.naturalWidth ?? 100;
        const natH = spriteImg?.naturalHeight ?? (visual.aspect ? 100 * visual.aspect : 100);
        const bounds = computeSpriteBounds(
          anchorScreen,
          b.w,
          b.h,
          tileW,
          tileH,
          scaleFactor,
          visual,
          natW,
          natH,
          b.imageScale ?? 1
        );
        if (
          x >= bounds.drawX &&
          x <= bounds.drawX + bounds.imgW &&
          y >= bounds.drawY &&
          y <= bounds.drawY + bounds.imgH
        ) {
          hit = b;
          break;
        }
      } else {
        const c = footprintCornersCalibrated(b.col, b.row, b.w, b.h, calib, renderScale, drawOrigin);
        const h = b.height * scaleFactor;
        const Np = { x: c.N.x, y: c.N.y - h };
        const Ep = { x: c.E.x, y: c.E.y - h };
        const Wp = { x: c.W.x, y: c.W.y - h };
        const polyPts = [Np, Ep, c.E, c.S, c.W, Wp];
        if (pointInPolygon({ x, y }, polyPts)) {
          hit = b;
          break;
        }
      }
    }

    if (hit) {
      selCb(hit.id);
      toastCb(`Đã chọn [${hit.name}] · ${hit.w}×${hit.h} ô`, 'ok');
    } else {
      selCb(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className="castle-iso-container"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        zIndex: 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        isDraggingRef.current = false;
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: (pendingBuilding || movingBuilding) ? 'crosshair' : 'grab',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
