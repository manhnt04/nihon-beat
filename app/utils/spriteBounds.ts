/**
 * BOUNDING VOLUME & SPRITE ENVELOPE SYSTEM
 * ----------------------------------------
 * Replaces arbitrary baseScale multipliers with a deterministic Screen Envelope
 * calculated directly from the building's footprint and a VisualBudget.
 * Guarantees that sprites never exceed permissible horizontal/crown bleed.
 */

export const UNIT_PX = 40; // 1 heightUnit corresponds to 40px vertically at scaleFactor = 1.0

export interface VisualBudget {
  heightUnits: number; // Abstract vertical height unit
  maxHorizontalBleed: number; // 1.0 = flush to footprint diamond, 1.15 = 15% body bleed
  crownBleedExtra: number; // Extra horizontal bleed allowed specifically for roofs/eaves
  anchor: { x: number; y: number }; // Ground contact anchor point (e.g. { x: 0.5, y: 0.94 })
  aspect?: number; // Optional default aspect ratio when image isn't loaded yet
}

export interface ScreenEnvelope {
  baseMaxW: number;
  baseMaxH: number;
  crownMaxW: number;
}

export interface FitResult {
  drawX: number;
  drawY: number;
  imgW: number;
  imgH: number;
}

// Backward compatibility interface
export interface SpriteBounds extends FitResult {}

export const DEFAULT_VISUAL_BUDGET: VisualBudget = {
  heightUnits: 1.5,
  maxHorizontalBleed: 1.12,
  crownBleedExtra: 0.18,
  anchor: { x: 0.5, y: 0.95 },
  aspect: 1.0,
};

export const VISUAL_BUDGET: Record<string, VisualBudget> = {
  main: {
    heightUnits: 2.6,
    maxHorizontalBleed: 1.15,
    crownBleedExtra: 0.25,
    anchor: { x: 0.5, y: 0.94 },
    aspect: 1.15,
  },
  'celestial-hall': {
    heightUnits: 2.8,
    maxHorizontalBleed: 1.15,
    crownBleedExtra: 0.25,
    anchor: { x: 0.5, y: 0.94 },
    aspect: 1.15,
  },
  library: {
    heightUnits: 1.8,
    maxHorizontalBleed: 1.12,
    crownBleedExtra: 0.20,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 1.08,
  },
  listening: {
    heightUnits: 1.8,
    maxHorizontalBleed: 1.12,
    crownBleedExtra: 0.20,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 1.08,
  },
  watchtower: {
    heightUnits: 1.3,
    maxHorizontalBleed: 1.10,
    crownBleedExtra: 0.10,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 1.25,
  },
  'library-annex': {
    heightUnits: 1.7,
    maxHorizontalBleed: 1.12,
    crownBleedExtra: 0.20,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 1.08,
  },
  'listening-pavilion': {
    heightUnits: 1.7,
    maxHorizontalBleed: 1.12,
    crownBleedExtra: 0.20,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 1.08,
  },
  'palace-hut': {
    heightUnits: 1.6,
    maxHorizontalBleed: 1.10,
    crownBleedExtra: 0.18,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 1.10,
  },
  'grand-mansion': {
    heightUnits: 1.9,
    maxHorizontalBleed: 1.15,
    crownBleedExtra: 0.22,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 1.15,
  },
  'lac-ha-corridor': {
    heightUnits: 1.4,
    maxHorizontalBleed: 1.10,
    crownBleedExtra: 0.15,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 1.0,
  },
  'sacred-tree': {
    heightUnits: 1.5,
    maxHorizontalBleed: 1.15,
    crownBleedExtra: 0.20,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 1.30,
  },
  'guardian-lion': {
    heightUnits: 1.1,
    maxHorizontalBleed: 1.08,
    crownBleedExtra: 0.08,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 1.20,
  },
  'spirit-rock': {
    heightUnits: 0.9,
    maxHorizontalBleed: 1.05,
    crownBleedExtra: 0.05,
    anchor: { x: 0.5, y: 0.95 },
    aspect: 0.90,
  },
};

/**
 * Retrieve VisualBudget for a building template ID.
 */
export function getVisualBudget(defId?: string): VisualBudget {
  if (defId && VISUAL_BUDGET[defId]) {
    return VISUAL_BUDGET[defId];
  }
  return DEFAULT_VISUAL_BUDGET;
}

/**
 * Compute the bounding screen envelope based on footprint dimensions (W x D).
 */
export function computeScreenEnvelope(
  footprintW: number,
  footprintD: number,
  budget: VisualBudget = DEFAULT_VISUAL_BUDGET,
  tileW: number,
  tileH: number,
  scaleFactor: number = 1,
  imageScale: number = 1
): ScreenEnvelope {
  const safeBudget = budget ?? DEFAULT_VISUAL_BUDGET;
  const baseScreenW = (footprintW + footprintD) * (tileW / 2);
  const baseScreenH =
    (footprintW + footprintD) * (tileH / 2) +
    (safeBudget.heightUnits ?? 1.5) * UNIT_PX * scaleFactor;

  return {
    baseMaxW: baseScreenW * (safeBudget.maxHorizontalBleed ?? 1.12) * imageScale,
    baseMaxH: baseScreenH * imageScale,
    crownMaxW: baseScreenW * ((safeBudget.maxHorizontalBleed ?? 1.12) + (safeBudget.crownBleedExtra ?? 0.18)) * imageScale,
  };
}

/**
 * Fit sprite into the screen envelope with contain-scale preserving aspect ratio.
 */
export function fitSpriteToEnvelope(
  nativeImgW: number,
  nativeImgH: number,
  anchorScreen: { x: number; y: number },
  envelope: ScreenEnvelope,
  budget: VisualBudget = DEFAULT_VISUAL_BUDGET
): FitResult {
  const safeBudget = budget ?? DEFAULT_VISUAL_BUDGET;
  const aspect = nativeImgH > 0 && nativeImgW > 0 ? nativeImgH / nativeImgW : (safeBudget.aspect ?? 1.0);

  // Step 1: Scale by height first
  let imgH = envelope.baseMaxH;
  let imgW = imgH / aspect;

  // Step 2: If horizontal span exceeds crownMaxW (eaves/roof), clamp to crownMaxW
  if (imgW > envelope.crownMaxW) {
    imgW = envelope.crownMaxW;
    imgH = imgW * aspect;
  }

  const anchorX = safeBudget.anchor?.x ?? 0.5;
  const anchorY = safeBudget.anchor?.y ?? 0.95;
  const drawX = anchorScreen.x - imgW * anchorX;
  const drawY = anchorScreen.y - imgH * anchorY;

  return { drawX, drawY, imgW, imgH };
}

/**
 * Unified helper to compute SpriteBounds directly from footprint and visual budget.
 */
export function computeSpriteBounds(
  anchorScreen: { x: number; y: number },
  footprintW: number,
  footprintD: number,
  tileW: number,
  tileH: number,
  scaleFactor: number,
  budget: VisualBudget,
  nativeImgW = 100,
  nativeImgH = 100,
  imageScale = 1
): FitResult {
  const envelope = computeScreenEnvelope(
    footprintW,
    footprintD,
    budget,
    tileW,
    tileH,
    scaleFactor,
    imageScale
  );
  return fitSpriteToEnvelope(nativeImgW, nativeImgH, anchorScreen, envelope, budget);
}

// Backward compatibility exports
export interface VisualConfig extends VisualBudget {
  baseScaleByWidth?: (w: number) => number;
}
export const VISUAL_CATALOG = VISUAL_BUDGET;
export function getVisualConfig(defId?: string, naturalAspect?: number): VisualConfig {
  const b = getVisualBudget(defId);
  return { ...b, aspect: naturalAspect ?? b.aspect ?? 1.0 };
}
