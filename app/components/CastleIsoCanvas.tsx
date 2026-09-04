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
  top: string;
  left: string;
  right: string;
  outline: string;
  accent?: string;
  isRemovable?: boolean;
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
  showOrder: boolean;
  placeMode: boolean;
  onPlacedBuilding?: (name: string) => void;
  onToast: (msg: string, kind?: 'ok' | 'bad') => void;
}

const GRID = 8;
const BASE_TILE_W = 64;
const BASE_TILE_H = 32;

export default function CastleIsoCanvas({
  castle,
  environmentStage,
  selectedBuildingId,
  onSelectBuilding,
  showGrid,
  showOrder,
  placeMode,
  onPlacedBuilding,
  onToast,
}: CastleIsoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef({ width: 800, height: 600 });

  // Camera pan stored in ref to prevent 60fps-120fps React re-renders during dragging
  const panRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);

  // Keep latest props in ref for animation loop without recreating closures
  const propsRef = useRef({
    castle,
    environmentStage,
    selectedBuildingId,
    showGrid,
    showOrder,
    placeMode,
    onSelectBuilding,
    onPlacedBuilding,
    onToast,
  });
  propsRef.current = {
    castle,
    environmentStage,
    selectedBuildingId,
    showGrid,
    showOrder,
    placeMode,
    onSelectBuilding,
    onPlacedBuilding,
    onToast,
  };

  // Placed extra decorative structures
  const [extraBuildings, setExtraBuildings] = useState<IsoBuildingData[]>([
    {
      id: 'watchtower-1',
      name: 'Trạm gác Tiền đồn',
      hanzi: '哨',
      icon: '🏹',
      col: 0,
      row: 6,
      w: 1,
      h: 1,
      height: 48,
      top: '#e8c9a0',
      left: '#c8a374',
      right: '#a8825a',
      outline: '#7a5c3a',
      isRemovable: true,
    },
    {
      id: 'granary-1',
      name: 'Kho lương Phong túc',
      hanzi: '仓',
      icon: '📦',
      col: 6,
      row: 6,
      w: 1,
      h: 1,
      height: 44,
      top: '#f0d090',
      left: '#d0a960',
      right: '#b08a44',
      outline: '#8a6a2e',
      isRemovable: true,
    },
    {
      id: 'tree-1',
      name: 'Cổ thụ Linh mộc',
      hanzi: '木',
      icon: '🌲',
      col: 2,
      row: 6,
      w: 1,
      h: 1,
      height: 52,
      top: '#a8d98a',
      left: '#87bd67',
      right: '#699e49',
      outline: '#4a7a30',
      isRemovable: true,
    },
    {
      id: 'rock-1',
      name: 'Kỳ thạch Phong thuỷ',
      hanzi: '石',
      icon: '🪨',
      col: 5,
      row: 5,
      w: 1,
      h: 1,
      height: 32,
      top: '#c9c3b8',
      left: '#a8a196',
      right: '#8a8378',
      outline: '#605a50',
      isRemovable: true,
    },
  ]);

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
      height: 42,
      top: '#ffd875',
      left: '#d4aa48',
      right: '#a67e2a',
      outline: '#7c5716',
    };
  }, [castle.decorations?.guardian]);

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
        height: 96 + mainStage * 10,
        level: castle.buildings.main,
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
        height: 64 + libraryStage * 8,
        level: castle.buildings.library,
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
        height: 64 + listeningStage * 8,
        level: castle.buildings.listening,
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
    (b: IsoBuildingData, originX: number, originY: number, tileW: number, tileH: number) => {
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
  const depthKey = useCallback((b: IsoBuildingData) => {
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

    const { castle: cProp, selectedBuildingId: selId, showGrid: sGrid, showOrder: sOrder } = propsRef.current;
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

    // Fast Hardware-accelerated Radial Gradient Underbelly Shadow (NO ctx.filter blur)
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

    // --- 3. Depth Sorting (Algorithm 4) ---
    const sorted = [...curBuildings].sort((a, b) => depthKey(a) - depthKey(b));

    // --- 4. Draw Buildings (Back-to-Front Painter's Algorithm) ---
    sorted.forEach((b, idx) => {
      const c = footprintCorners(b, originX, originY, tileW, tileH);
      const h = b.height * scaleFactor;
      const isSelected = b.id === selId;

      // Fast Feathered Footprint Shadow (Radial Gradient, ZERO blur filter cost)
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

      // Building 3D geometry vertices
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

      // Center of roof for icon
      const roofCenterX = (Np.x + Ep.x + Sp.x + Wp.x) / 4;
      const roofCenterY = (Np.y + Ep.y + Sp.y + Wp.y) / 4;

      // Draw traditional pagoda tier line for taller buildings
      if (b.h >= 2 && b.w >= 2) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        const midH = h * 0.5;
        poly(ctx, [
          { x: c.N.x, y: c.N.y - midH },
          { x: c.E.x, y: c.E.y - midH },
          { x: c.S.x, y: c.S.y - midH },
          { x: c.W.x, y: c.W.y - midH },
        ]);
        ctx.stroke();
      }

      // Icon on roof
      ctx.font = `${Math.round((14 + b.w * 5) * scaleFactor)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, roofCenterX, roofCenterY - 4);

      // Footprint center for exact Labeling (Algorithm 2: centered on ground footprint)
      const footCenterX = (c.N.x + c.E.x + c.S.x + c.W.x) / 4;

      // Building Label Tag pill
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

      // Algorithm 4 visualization: Show draw order badge
      if (sOrder) {
        ctx.fillStyle = '#2b1b13';
        ctx.beginPath();
        ctx.arc(c.S.x, c.S.y + pillH + 12, 10 * scaleFactor, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd875';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.round(10 * scaleFactor)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), c.S.x, c.S.y + pillH + 12);
      }
    });

    // --- 5. Atmospheric Weather Particles (Batched without save/restore overhead) ---
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
  }, [gridToScreen, footprintCorners, depthKey]);

  // Single Persistent Animation Loop (Decoupled from React State)
  useEffect(() => {
    let animId: number;

    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      rectRef.current = { width: rect.width, height: rect.height };

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const loop = () => {
      drawFrame();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [drawFrame]);

  // Mouse & Touch Pointer Handling (Click & Pan without React State Triggers)
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
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

    // If user was dragging to pan camera, do not trigger click hit test
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

    const { placeMode: pMode, onSelectBuilding: selCb, onToast: toastCb, onPlacedBuilding: placeCb } = propsRef.current;
    const curBuildings = allBuildingsRef.current;

    // Algorithm 5: Reverse depth-sorted polygon silhouette test
    const sorted = [...curBuildings].sort((a, b) => depthKey(a) - depthKey(b));
    let hit: IsoBuildingData | null = null;

    for (let i = sorted.length - 1; i >= 0; i--) {
      const b = sorted[i];
      const polyPts = silhouette(b, originX, originY, tileW, tileH);
      if (pointInPolygon({ x, y }, polyPts)) {
        hit = b;
        break;
      }
    }

    if (hit) {
      if (pMode) {
        toastCb(`Ô đã có công trình [${hit.name}]`, 'bad');
      } else {
        selCb(hit.id);
        toastCb(`Đã chọn [${hit.name}] · ${hit.w}×${hit.h} ô`, 'ok');
      }
      return;
    }

    // Algorithm 1 & 3: Check ground tile placement
    const g = screenToGrid(x, y, originX, originY, tileW, tileH);
    if (g.col >= 0 && g.row >= 0 && g.col < GRID && g.row < GRID) {
      if (pMode) {
        if (canPlace(g.col, g.row, 1, 1)) {
          const newId = `tower-${Date.now()}`;
          const newTower: IsoBuildingData = {
            id: newId,
            name: 'Trạm gác Mới',
            hanzi: '哨',
            icon: '🏹',
            col: g.col,
            row: g.row,
            w: 1,
            h: 1,
            height: 44,
            top: '#e8c9a0',
            left: '#c8a374',
            right: '#a8825a',
            outline: '#7a5c3a',
            isRemovable: true,
          };
          setExtraBuildings((prev) => [...prev, newTower]);
          toastCb(`Đã dựng Trạm gác mới tại (${g.col}, ${g.row})`, 'ok');
          if (placeCb) placeCb('Trạm gác mới');
          selCb(newId);
        } else {
          toastCb(`Ô (${g.col}, ${g.row}) đã bị chiếm dụng!`, 'bad');
        }
      } else {
        selCb(null);
      }
    } else {
      if (!pMode) selCb(null);
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
          cursor: placeMode ? 'crosshair' : 'grab',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
