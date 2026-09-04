'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

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
}

const GRID = 8;
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

  // Preload official building assets on mount
  useEffect(() => {
    const assets = [
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

  // Guardian statue if equipped (Memoized)
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
      col: 4,
      row: 6,
      w: 1,
      h: 1,
      height: 44,
      top: '#ffd875',
      left: '#d4aa48',
      right: '#a67e2a',
      outline: '#7c5716',
    };
  }, [castle.decorations?.guardian]);

  // Core 3 buildings using official webp images!
  const coreBuildings = useMemo<IsoBuildingData[]>(() => {
    return [
      {
        id: 'main',
        name: 'Chính Điện · Chủ Thành',
        hanzi: '主城',
        icon: '🏯',
        col: 2,
        row: 2,
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
        col: 0,
        row: 0,
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
        col: 6,
        row: 0,
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
  }, [castle.buildings.main, castle.buildings.library, castle.buildings.listening, mainStage, libraryStage, listeningStage]);

  const allBuildings = useMemo<IsoBuildingData[]>(() => {
    return [
      ...coreBuildings,
      ...(guardianBuilding ? [guardianBuilding] : []),
      ...extraBuildings,
    ];
  }, [coreBuildings, guardianBuilding, extraBuildings]);

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
  };

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

  // Algorithm 4: Depth Sorting Key
  const depthKey = useCallback((b: { col: number; row: number; w: number; h: number }) => {
    return b.col + b.w - 1 + (b.row + b.h - 1);
  }, []);

  // Algorithm 5: Silhouette & Hit Testing
  const silhouette = useCallback(
    (b: IsoBuildingData, originX: number, originY: number, tileW: number, tileH: number) => {
      const c = footprintCorners(b, originX, originY, tileW, tileH);
      const h = b.height;
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

  // Algorithm 3: Placement Validation
  const canPlace = useCallback(
    (col: number, row: number, w: number, h: number) => {
      if (col < 0 || row < 0 || col + w > GRID || row + h > GRID) return false;
      const occ: (string | null)[][] = Array.from({ length: GRID }, () =>
        Array(GRID).fill(null)
      );
      const curBuildings = allBuildingsRef.current;
      for (const b of curBuildings) {
        for (let c = b.col; c < b.col + b.w; c++) {
          for (let r = b.row; r < b.row + b.h; r++) {
            if (r < GRID && c < GRID) occ[r][c] = b.id;
          }
        }
      }
      for (let c = col; c < col + w; c++) {
        for (let r = row; r < row + h; r++) {
          if (occ[r][c] !== null) return false;
        }
      }
      return true;
    },
    []
  );

  // Helper polygon draw
  const poly = (ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) => {
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

    const { castle: cProp, selectedBuildingId: selId, showGrid: sGrid, pendingBuilding: pBuild } = propsRef.current;
    const curBuildings = allBuildingsRef.current;

    // Dynamic isometric tile scaling to fit viewport
    const scaleFactor = Math.min(1.2, Math.max(0.75, width / 740));
    const tileW = BASE_TILE_W * scaleFactor;
    const tileH = BASE_TILE_H * scaleFactor;

    // Center the island with current pan
    const originX = width / 2 + panRef.current.x;
    const originY = height * 0.3 + panRef.current.y;

    // --- 1. Draw Floating Island Cliff Depth (Underbelly) ---
    const islandE = gridToScreen(GRID - 1, 0, originX, originY, tileW, tileH);
    const islandE_edge = { x: islandE.x + tileW / 2, y: islandE.y + tileH / 2 };
    const islandS = gridToScreen(GRID - 1, GRID - 1, originX, originY, tileW, tileH);
    const islandS_edge = { x: islandS.x, y: islandS.y + tileH };
    const islandW = gridToScreen(0, GRID - 1, originX, originY, tileW, tileH);
    const islandW_edge = { x: islandW.x - tileW / 2, y: islandW.y + tileH / 2 };

    const cliffDepth = 65 * scaleFactor;

    // Fast Hardware-accelerated Radial Gradient Underbelly Shadow
    const shadowRadiusX = (GRID * tileW) / 2.2;
    const shadowRadiusY = tileH * 2.2;
    const shadowCenterY = islandS_edge.y + cliffDepth + 25;
    const underbellyGrad = ctx.createRadialGradient(
      islandS_edge.x,
      shadowCenterY,
      shadowRadiusX * 0.15,
      islandS_edge.x,
      shadowCenterY,
      shadowRadiusX
    );
    underbellyGrad.addColorStop(0, 'rgba(10, 5, 5, 0.42)');
    underbellyGrad.addColorStop(0.7, 'rgba(10, 5, 5, 0.15)');
    underbellyGrad.addColorStop(1, 'rgba(10, 5, 5, 0)');

    ctx.fillStyle = underbellyGrad;
    ctx.beginPath();
    ctx.ellipse(islandS_edge.x, shadowCenterY, shadowRadiusX, shadowRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Island rock cliff sides
    ctx.fillStyle = '#3a271d';
    poly(ctx, [
      islandW_edge,
      islandS_edge,
      { x: islandS_edge.x, y: islandS_edge.y + cliffDepth },
      { x: islandW_edge.x, y: islandW_edge.y + cliffDepth * 0.7 },
    ]);
    ctx.fill();

    ctx.fillStyle = '#2b1b13';
    poly(ctx, [
      islandS_edge,
      islandE_edge,
      { x: islandE_edge.x, y: islandE_edge.y + cliffDepth * 0.7 },
      { x: islandS_edge.x, y: islandS_edge.y + cliffDepth },
    ]);
    ctx.fill();

    // --- 2. Draw Ground Tiles ---
    const theme = cProp.theme;
    const isFrost = theme === 'frost';
    const isLantern = theme === 'lantern';
    const isCrimson = theme === 'crimson';
    const isJade = theme === 'jade';

    for (let col = 0; col < GRID; col++) {
      for (let row = 0; row < GRID; row++) {
        const p = gridToScreen(col, row, originX, originY, tileW, tileH);
        const pts = [
          { x: p.x, y: p.y },
          { x: p.x + tileW / 2, y: p.y + tileH / 2 },
          { x: p.x, y: p.y + tileH },
          { x: p.x - tileW / 2, y: p.y + tileH / 2 },
        ];

        const isAlternate = (col + row) % 2 === 0;
        let tileColor = isAlternate ? '#cbe5a3' : '#bddf90';
        let strokeColor = 'rgba(70, 100, 40, 0.22)';

        if (isFrost) {
          tileColor = isAlternate ? '#dbebf8' : '#c8e0f4';
          strokeColor = 'rgba(120, 160, 200, 0.3)';
        } else if (isLantern) {
          tileColor = isAlternate ? '#402927' : '#331e1c';
          strokeColor = 'rgba(230, 150, 70, 0.25)';
        } else if (isCrimson) {
          tileColor = isAlternate ? '#e8bd8a' : '#dcae78';
          strokeColor = 'rgba(160, 60, 40, 0.25)';
        } else if (isJade) {
          tileColor = isAlternate ? '#b5e3cb' : '#9fd9bb';
          strokeColor = 'rgba(40, 120, 80, 0.25)';
        }

        // Stone path leading to Main Hall
        const isPath = (col === 3 || col === 4) && row >= 5;
        if (isPath) {
          tileColor = isAlternate ? '#dfd6c6' : '#d4c9b6';
          strokeColor = 'rgba(90, 80, 70, 0.3)';
        }

        ctx.fillStyle = tileColor;
        poly(ctx, pts);
        ctx.fill();

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Algorithm 1 visualization: Show coordinates
        if (sGrid) {
          ctx.fillStyle = isLantern ? 'rgba(255, 230, 180, 0.75)' : 'rgba(50, 80, 30, 0.7)';
          ctx.font = `${Math.round(8 * scaleFactor)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${col},${row}`, p.x, p.y + tileH / 2);
        }
      }
    }

    // --- 3. Placement Mode Footprint Hover Preview (Algorithm 3) ---
    if (pBuild && hoverGridRef.current) {
      const { col, row } = hoverGridRef.current;
      const valid = canPlace(col, row, pBuild.w, pBuild.h);
      const fpCorners = footprintCorners({ col, row, w: pBuild.w, h: pBuild.h }, originX, originY, tileW, tileH);

      ctx.fillStyle = valid ? 'rgba(46, 204, 113, 0.38)' : 'rgba(231, 76, 60, 0.45)';
      poly(ctx, [fpCorners.N, fpCorners.E, fpCorners.S, fpCorners.W]);
      ctx.fill();

      ctx.strokeStyle = valid ? '#2ecc71' : '#e74c3c';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Ghost preview of the building image or icon
      const ghostImg = pBuild.imageSrc ? getLoadedImage(pBuild.imageSrc) : null;
      const ghostCenterX = (fpCorners.N.x + fpCorners.E.x + fpCorners.S.x + fpCorners.W.x) / 4;
      if (ghostImg) {
        ctx.globalAlpha = 0.65;
        const baseScale = pBuild.w >= 3 ? 2.3 : pBuild.w >= 2 ? 1.95 : 1.45;
        const imgW = pBuild.w * tileW * baseScale * (pBuild.imageScale ?? 1);
        const aspect = ghostImg.naturalHeight / ghostImg.naturalWidth;
        const imgH = imgW * aspect;
        const drawX = ghostCenterX - imgW / 2;
        const drawY = fpCorners.S.y - imgH + tileH * 0.45;
        ctx.drawImage(ghostImg, drawX, drawY, imgW, imgH);
        ctx.globalAlpha = 1;
      }
    }

    // --- 4. Depth Sorting (Algorithm 4) ---
    const sorted = [...curBuildings].sort((a, b) => depthKey(a) - depthKey(b));

    // --- 5. Draw Buildings with Real Images & Footprints ---
    sorted.forEach((b) => {
      const c = footprintCorners(b, originX, originY, tileW, tileH);
      const h = b.height * scaleFactor;
      const isSelected = b.id === selId;
      const footCenterX = (c.N.x + c.E.x + c.S.x + c.W.x) / 4;

      // Fast Feathered Footprint Shadow (Radial Gradient)
      const bShadowCenterX = (c.W.x + c.E.x) / 2;
      const bShadowCenterY = (c.N.y + c.S.y) / 2 + 2;
      const bShadowRadX = (b.w * tileW) / 2.1;
      const bShadowRadY = (b.h * tileH) / 2.2;

      const bGrad = ctx.createRadialGradient(
        bShadowCenterX,
        bShadowCenterY,
        bShadowRadX * 0.2,
        bShadowCenterX,
        bShadowCenterY,
        bShadowRadX
      );
      bGrad.addColorStop(0, 'rgba(15, 8, 7, 0.36)');
      bGrad.addColorStop(0.75, 'rgba(15, 8, 7, 0.12)');
      bGrad.addColorStop(1, 'rgba(15, 8, 7, 0)');

      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.ellipse(bShadowCenterX, bShadowCenterY, bShadowRadX, bShadowRadY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Check if real webp image is available & loaded in cache!
      const spriteImg = b.imageSrc ? getLoadedImage(b.imageSrc) : null;

      if (spriteImg) {
        // Compute scaled dimension matching isometric footprint
        const baseScale = b.w >= 3 ? 2.3 : b.w >= 2 ? 1.95 : 1.45;
        const imgW = b.w * tileW * baseScale * (b.imageScale ?? 1);
        const aspect = spriteImg.naturalHeight / spriteImg.naturalWidth;
        const imgH = imgW * aspect;

        // Anchor at bottom center of the ground footprint
        const drawX = footCenterX - imgW / 2;
        const drawY = c.S.y - imgH + tileH * 0.45;

        // Selected building golden aura
        if (isSelected) {
          ctx.save();
          ctx.shadowColor = '#ffd43b';
          ctx.shadowBlur = 16;
          ctx.drawImage(spriteImg, drawX, drawY, imgW, imgH);
          ctx.restore();
        } else {
          ctx.drawImage(spriteImg, drawX, drawY, imgW, imgH);
        }
      } else {
        // Fallback: 3D stylized isometric block for tree, stone, or until image loads
        const Np = { x: c.N.x, y: c.N.y - h };
        const Ep = { x: c.E.x, y: c.E.y - h };
        const Sp = { x: c.S.x, y: c.S.y - h };
        const Wp = { x: c.W.x, y: c.W.y - h };

        ctx.strokeStyle = isSelected ? '#ffd43b' : b.outline;
        ctx.lineWidth = isSelected ? 2.5 : 1.4;

        // Left Wall
        ctx.fillStyle = b.left;
        poly(ctx, [c.W, c.S, Sp, Wp]);
        ctx.fill();
        ctx.stroke();

        // Right Wall
        ctx.fillStyle = b.right;
        poly(ctx, [c.S, c.E, Ep, Sp]);
        ctx.fill();
        ctx.stroke();

        // Roof / Top Surface
        ctx.fillStyle = b.top;
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
  }, [gridToScreen, footprintCorners, depthKey, canPlace]);

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

      const scaleFactor = Math.min(1.2, Math.max(0.75, rect.width / 740));
      const tileW = BASE_TILE_W * scaleFactor;
      const tileH = BASE_TILE_H * scaleFactor;
      const originX = rect.width / 2 + panRef.current.x;
      const originY = rect.height * 0.3 + panRef.current.y;

      const g = screenToGrid(x, y, originX, originY, tileW, tileH);
      if (g.col >= 0 && g.row >= 0 && g.col < GRID && g.row < GRID) {
        hoverGridRef.current = g;
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

    const scaleFactor = Math.min(1.2, Math.max(0.75, rect.width / 740));
    const tileW = BASE_TILE_W * scaleFactor;
    const tileH = BASE_TILE_H * scaleFactor;
    const originX = rect.width / 2 + panRef.current.x;
    const originY = rect.height * 0.3 + panRef.current.y;

    const { pendingBuilding: pBuild, onSelectBuilding: selCb, onToast: toastCb, onPlacedBuilding: placeCb } = propsRef.current;
    const curBuildings = allBuildingsRef.current;

    // Case 1: Active Placement Mode with a chosen building template
    if (pBuild) {
      const g = screenToGrid(x, y, originX, originY, tileW, tileH);
      if (g.col >= 0 && g.row >= 0 && g.col + pBuild.w <= GRID && g.row + pBuild.h <= GRID) {
        if (canPlace(g.col, g.row, pBuild.w, pBuild.h)) {
          const newBuilding: IsoBuildingData = {
            id: `build-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: pBuild.name,
            hanzi: pBuild.hanzi,
            icon: pBuild.icon,
            col: g.col,
            row: g.row,
            w: pBuild.w,
            h: pBuild.h,
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
          toastCb(`Vị trí (${g.col}, ${g.row}) đã bị chiếm hoặc không đủ diện tích ${pBuild.w}×${pBuild.h}!`, 'bad');
        }
      } else {
        toastCb('Vui lòng chọn vị trí nằm trong phạm vi Tiên Đảo!', 'bad');
      }
      return;
    }

    // Case 2: Standard Mode - Click Hit Test (Algorithm 5: Reverse depth-sorted polygon silhouette)
    const sorted = [...curBuildings].sort((a, b) => depthKey(a) - depthKey(b));
    let hit: IsoBuildingData | null = null;

    for (let i = sorted.length - 1; i >= 0; i--) {
      const b = sorted[i];
      // Test 1: Hit test polygon silhouette
      const polyPts = silhouette(b, originX, originY, tileW, tileH);
      if (pointInPolygon({ x, y }, polyPts)) {
        hit = b;
        break;
      }
      // Test 2: Also test ground footprint corners
      const fc = footprintCorners(b, originX, originY, tileW, tileH);
      if (pointInPolygon({ x, y }, [fc.N, fc.E, fc.S, fc.W])) {
        hit = b;
        break;
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
          cursor: pendingBuilding ? 'crosshair' : 'grab',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
