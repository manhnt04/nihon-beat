/**
 * 2.5D Siege Cannon & Defense Shield Dome Combat FX System
 * - Ballistic Parabolic Arc trajectory calculation with tangent rotation
 * - Ray-Dome elliptical boundary intersection
 * - Zero-GC / low-allocation particle systems for 60-120 FPS
 * - Hexagonal ripple shockwaves & crystal shatter physics
 */

export interface CombatParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxLife: number;
  life: number;
  color: string;
  kind: 'fire' | 'smoke' | 'spark' | 'debris' | 'shield_spark';
}

export interface Cannonball {
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  arcHeight: number;
  t: number; // 0.0 -> 1.0
  speed: number; // increment per second (default ~0.9 to 1.1)
  color: string;
  targetCol?: number;
  targetRow?: number;
  targetBuildingId?: string;
  trail: CombatParticle[];
  status: 'flying' | 'impacted' | 'blocked';
}

export interface ExplosionBurst {
  id: string;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  kind: 'fire' | 'shield_deflect';
  radius: number;
  maxRadius: number;
  flashAlpha: number;
  particles: CombatParticle[];
}

export interface ShieldRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
  color: string;
}

export interface ShieldShatterShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  size: number;
  alpha: number;
  color: string;
  points: { x: number; y: number }[];
}

export type ShieldStatus = 'inactive' | 'activating' | 'active' | 'hit_ripple' | 'shattering';

export interface ShieldDomeState {
  active: boolean;
  status: ShieldStatus;
  activationProgress: number; // 0.0 -> 1.0
  shatterProgress: number; // 0.0 -> 1.0
  ripples: ShieldRipple[];
  shards: ShieldShatterShard[];
  lastHitTime?: number;
  pulsePhase: number;
}

/**
 * Computes 2.5D ballistic position and trajectory angle at time t in [0, 1].
 * Parabola equation: Y(t) = (1 - t)*Y_start + t*Y_target - 4 * H_arc * t*(1 - t)
 */
export function computeBallisticPos(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  arcHeight: number,
  t: number
): { x: number; y: number; angle: number; dx: number; dy: number } {
  const clampedT = Math.max(0, Math.min(1, t));
  const x = (1 - clampedT) * startX + clampedT * targetX;
  const linearY = (1 - clampedT) * startY + clampedT * targetY;
  const arcOffset = 4 * arcHeight * clampedT * (1 - clampedT);
  const y = linearY - arcOffset;

  // Tangent derivative for facing angle
  const dx = targetX - startX;
  const dy = (targetY - startY) - 4 * arcHeight * (1 - 2 * clampedT);
  const angle = Math.atan2(dy, dx);

  return { x, y, angle, dx, dy };
}

/**
 * Checks if point (x, y) is inside the upper half of the 2.5D shield dome ellipse.
 * (x - Cx)^2 / Rx^2 + (y - Cy)^2 / Ry^2 <= 1 (y <= Cy + allowance)
 */
export function isInsideShieldDome(
  x: number,
  y: number,
  center: { x: number; y: number },
  radiusX: number,
  radiusY: number,
  bottomAllowanceRatio = 0.12
): boolean {
  if (radiusX <= 0 || radiusY <= 0) return false;
  const dx = (x - center.x) / radiusX;
  const dy = (y - center.y) / radiusY;
  const distSq = dx * dx + dy * dy;
  const maxAllowedY = center.y + radiusY * bottomAllowanceRatio;
  return distSq <= 1.0 && y <= maxAllowedY;
}

/**
 * Binary search to find exact intersection t where the cannonball enters the shield dome.
 */
export function findShieldIntersection(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  arcHeight: number,
  tPrev: number,
  tCurr: number,
  domeCenter: { x: number; y: number },
  radiusX: number,
  radiusY: number
): { hit: boolean; t: number; x: number; y: number } {
  let low = tPrev;
  let high = tCurr;
  let hit = false;
  let finalPos = computeBallisticPos(startX, startY, targetX, targetY, arcHeight, high);

  // 6 iterations give sub-pixel accuracy
  for (let i = 0; i < 6; i++) {
    const mid = (low + high) / 2;
    const pos = computeBallisticPos(startX, startY, targetX, targetY, arcHeight, mid);
    if (isInsideShieldDome(pos.x, pos.y, domeCenter, radiusX, radiusY)) {
      hit = true;
      high = mid;
      finalPos = pos;
    } else {
      low = mid;
    }
  }

  return { hit, t: high, x: finalPos.x, y: finalPos.y };
}

/**
 * Spawns a new siege cannonball fired from off-screen towards target island position.
 */
export function createCannonball(
  targetX: number,
  targetY: number,
  viewWidth: number,
  viewHeight: number,
  options?: {
    fromSide?: 'left' | 'right' | 'top';
    targetCol?: number;
    targetRow?: number;
    targetBuildingId?: string;
    speed?: number;
    color?: string;
  }
): Cannonball {
  const fromSide = options?.fromSide ?? (targetX < viewWidth / 2 ? 'left' : 'right');
  let startX = 0;
  let startY = 0;

  if (fromSide === 'left') {
    startX = -40;
    startY = targetY - Math.random() * 120 - 80;
  } else if (fromSide === 'right') {
    startX = viewWidth + 40;
    startY = targetY - Math.random() * 120 - 80;
  } else {
    startX = targetX + (Math.random() - 0.5) * 200;
    startY = -40;
  }

  const dist = Math.hypot(targetX - startX, targetY - startY);
  const arcHeight = Math.max(160, Math.min(320, dist * 0.38));

  return {
    id: `cannon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    startX,
    startY,
    targetX,
    targetY,
    arcHeight,
    t: 0,
    speed: options?.speed ?? (0.85 + Math.random() * 0.3), // 1.0 -> ~1.0-1.2s flight
    color: options?.color ?? '#ff922b',
    targetCol: options?.targetCol,
    targetRow: options?.targetRow,
    targetBuildingId: options?.targetBuildingId,
    trail: [],
    status: 'flying',
  };
}

/**
 * Creates explosion burst effects with debris, sparks and smoke.
 */
export function createExplosion(
  x: number,
  y: number,
  kind: 'fire' | 'shield_deflect' = 'fire',
  scale = 1.0
): ExplosionBurst {
  const particles: CombatParticle[] = [];
  const particleCount = kind === 'fire' ? 36 : 28;

  const fireColors = ['#fff3bf', '#ffd43b', '#ff922b', '#f76707', '#fa5252', '#495057'];
  const shieldColors = ['#e6fcf5', '#63e6be', '#20c997', '#38d9a9', '#74c0fc', '#ffffff'];
  const palette = kind === 'fire' ? fireColors : shieldColors;

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 5.5 + 2.0) * scale;
    const isSmoke = kind === 'fire' && Math.random() < 0.35;
    const color = isSmoke ? '#343a40' : palette[Math.floor(Math.random() * palette.length)];

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (kind === 'fire' ? 1.2 : 0),
      size: (isSmoke ? Math.random() * 6 + 4 : Math.random() * 4 + 2) * scale,
      alpha: 1.0,
      maxLife: Math.floor(isSmoke ? 45 + Math.random() * 25 : 25 + Math.random() * 20),
      life: 0,
      color,
      kind: isSmoke ? 'smoke' : kind === 'fire' ? 'fire' : 'shield_spark',
    });
  }

  return {
    id: `burst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    x,
    y,
    startTime: performance.now(),
    duration: kind === 'fire' ? 900 : 650,
    kind,
    radius: 8 * scale,
    maxRadius: (kind === 'fire' ? 42 : 55) * scale,
    flashAlpha: 1.0,
    particles,
  };
}

/**
 * Creates crystal shards when the shield dome shatters.
 */
export function createShieldShatterShards(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  count = 32
): ShieldShatterShard[] {
  const shards: ShieldShatterShard[] = [];
  const colors = ['#e6fcf5', '#63e6be', '#38d9a9', '#74c0fc', '#ffd43b', '#ffffff'];

  for (let i = 0; i < count; i++) {
    const angle = Math.PI + (Math.PI * i) / count + (Math.random() - 0.5) * 0.2;
    const radFactor = 0.5 + Math.random() * 0.5;
    const sx = centerX + Math.cos(angle) * radiusX * radFactor;
    const sy = centerY + Math.sin(angle) * radiusY * radFactor;

    const speed = Math.random() * 4.5 + 2.0;
    const outAngle = Math.atan2(sy - centerY, sx - centerX);
    const size = Math.random() * 10 + 6;

    // Triangle or diamond points
    const points = [
      { x: 0, y: -size * 0.8 },
      { x: size * 0.6, y: size * 0.4 },
      { x: -size * 0.5, y: size * 0.5 },
    ];

    shards.push({
      x: sx,
      y: sy,
      vx: Math.cos(outAngle) * speed + (Math.random() - 0.5) * 1.5,
      vy: Math.sin(outAngle) * speed - Math.random() * 2.0,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.25,
      size,
      alpha: 1.0,
      color: colors[Math.floor(Math.random() * colors.length)],
      points,
    });
  }

  return shards;
}

/**
 * Updates all cannonballs, detects shield or ground impacts, advances particle lifecycles.
 */
export function updateCombatFx(
  cannonballs: Cannonball[],
  explosions: ExplosionBurst[],
  shieldState: ShieldDomeState,
  domeCenter: { x: number; y: number },
  radiusX: number,
  radiusY: number,
  deltaSec: number,
  scaleFactor = 1.0,
  onImpact?: (impact: {
    x: number;
    y: number;
    blocked: boolean;
    targetBuildingId?: string;
    targetCol?: number;
    targetRow?: number;
  }) => void
): { screenShake: { x: number; y: number; mag: number } } {
  let shakeMag = 0;

  // 1. Update Cannonballs
  for (let i = cannonballs.length - 1; i >= 0; i--) {
    const ball = cannonballs[i];
    if (ball.status !== 'flying') {
      cannonballs.splice(i, 1);
      continue;
    }

    const prevT = ball.t;
    ball.t += ball.speed * deltaSec;

    const prevPos = computeBallisticPos(
      ball.startX,
      ball.startY,
      ball.targetX,
      ball.targetY,
      ball.arcHeight,
      prevT
    );
    const curPos = computeBallisticPos(
      ball.startX,
      ball.startY,
      ball.targetX,
      ball.targetY,
      ball.arcHeight,
      ball.t
    );

    // Append smoke/fire trail particles behind cannonball
    if (ball.trail.length < 24) {
      ball.trail.push({
        x: curPos.x + (Math.random() - 0.5) * 4,
        y: curPos.y + (Math.random() - 0.5) * 4,
        vx: -Math.cos(curPos.angle) * (Math.random() * 1.5 + 0.5),
        vy: -Math.sin(curPos.angle) * (Math.random() * 1.5 + 0.5),
        size: (Math.random() * 3.5 + 2.0) * scaleFactor,
        alpha: 0.85,
        maxLife: 20,
        life: 0,
        color: Math.random() < 0.4 ? '#ff922b' : Math.random() < 0.7 ? '#ffd43b' : '#495057',
        kind: 'fire',
      });
    }

    // Update trail particles
    for (let pIdx = ball.trail.length - 1; pIdx >= 0; pIdx--) {
      const p = ball.trail[pIdx];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha = 0.85 * (1 - p.life / p.maxLife);
      if (p.life >= p.maxLife || p.alpha <= 0.05) {
        ball.trail.splice(pIdx, 1);
      }
    }

    // Shield Collision Check (If Shield is actively protecting)
    const isShieldBlocking =
      shieldState.active &&
      (shieldState.status === 'active' ||
        shieldState.status === 'hit_ripple' ||
        shieldState.status === 'activating');

    if (isShieldBlocking) {
      const isInside = isInsideShieldDome(curPos.x, curPos.y, domeCenter, radiusX, radiusY);
      if (isInside) {
        // Intercepted on dome perimeter!
        const hitData = findShieldIntersection(
          ball.startX,
          ball.startY,
          ball.targetX,
          ball.targetY,
          ball.arcHeight,
          prevT,
          ball.t,
          domeCenter,
          radiusX,
          radiusY
        );

        ball.status = 'blocked';
        explosions.push(createExplosion(hitData.x, hitData.y, 'shield_deflect', scaleFactor));

        // Add impact ripple on shield dome
        shieldState.status = 'hit_ripple';
        shieldState.lastHitTime = performance.now();
        shieldState.ripples.push({
          x: hitData.x,
          y: hitData.y,
          radius: 4,
          maxRadius: 65 * scaleFactor,
          alpha: 1.0,
          speed: 140 * scaleFactor,
          color: '#38d9a9',
        });

        // Slight vibration on shield hit
        shakeMag = Math.max(shakeMag, 2.5);

        onImpact?.({
          x: hitData.x,
          y: hitData.y,
          blocked: true,
          targetBuildingId: ball.targetBuildingId,
          targetCol: ball.targetCol,
          targetRow: ball.targetRow,
        });

        cannonballs.splice(i, 1);
        continue;
      }
    }

    // Ground or Target Impact (t >= 1.0)
    if (ball.t >= 1.0) {
      ball.status = 'impacted';
      explosions.push(createExplosion(ball.targetX, ball.targetY, 'fire', scaleFactor));
      shakeMag = Math.max(shakeMag, 8.0); // Intense screen shake for direct ground hit

      onImpact?.({
        x: ball.targetX,
        y: ball.targetY,
        blocked: false,
        targetBuildingId: ball.targetBuildingId,
        targetCol: ball.targetCol,
        targetRow: ball.targetRow,
      });

      cannonballs.splice(i, 1);
    }
  }

  // 2. Update Explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    const exp = explosions[i];
    const elapsed = performance.now() - exp.startTime;
    const progress = Math.min(1, elapsed / exp.duration);

    exp.radius = exp.maxRadius * Math.sin(progress * Math.PI * 0.5);
    exp.flashAlpha = Math.max(0, 1 - progress * 1.5);

    for (let pIdx = exp.particles.length - 1; pIdx >= 0; pIdx--) {
      const p = exp.particles[pIdx];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === 'fire') {
        p.vy += 0.08; // gravity on burning debris
      } else if (p.kind === 'smoke') {
        p.vy -= 0.05; // smoke floats upward
        p.size += 0.08;
      }
      p.alpha = 1 - p.life / p.maxLife;
      if (p.life >= p.maxLife || p.alpha <= 0.02) {
        exp.particles.splice(pIdx, 1);
      }
    }

    if (progress >= 1 && exp.particles.length === 0) {
      explosions.splice(i, 1);
    }
  }

  // 3. Update Shield Ripples
  for (let rIdx = shieldState.ripples.length - 1; rIdx >= 0; rIdx--) {
    const rip = shieldState.ripples[rIdx];
    rip.radius += rip.speed * deltaSec;
    rip.alpha = Math.max(0, 1 - rip.radius / rip.maxRadius);
    if (rip.radius >= rip.maxRadius || rip.alpha <= 0.02) {
      shieldState.ripples.splice(rIdx, 1);
    }
  }

  // 4. Update Shield Shatter Shards
  for (let sIdx = shieldState.shards.length - 1; sIdx >= 0; sIdx--) {
    const shard = shieldState.shards[sIdx];
    shard.x += shard.vx;
    shard.y += shard.vy;
    shard.vy += 0.15; // gravity
    shard.rot += shard.vRot;
    shard.alpha = Math.max(0, shard.alpha - deltaSec * 0.9);
    if (shard.alpha <= 0.02) {
      shieldState.shards.splice(sIdx, 1);
    }
  }

  // Calculate screen shake vector
  const shakeX = (Math.random() - 0.5) * 2 * shakeMag;
  const shakeY = (Math.random() - 0.5) * 2 * shakeMag;

  return { screenShake: { x: shakeX, y: shakeY, mag: shakeMag } };
}

/**
 * Draws the defense shield dome with Fresnel rim glow, subtle hexagonal grid lattice,
 * rotating Chinese protection glyphs (盾, 护, 御), and expanding impact ripples.
 */
export function drawShieldDome(
  ctx: CanvasRenderingContext2D,
  shieldState: ShieldDomeState,
  center: { x: number; y: number },
  radiusX: number,
  radiusY: number,
  scaleFactor: number,
  now: number
): void {
  // If inactive and no shards, nothing to draw
  if (!shieldState.active && shieldState.status === 'inactive' && shieldState.shards.length === 0) {
    return;
  }

  ctx.save();

  // 1. Draw Shatter Shards if currently shattering
  if (shieldState.shards.length > 0) {
    for (const shard of shieldState.shards) {
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(shard.rot);
      ctx.globalAlpha = shard.alpha;
      ctx.fillStyle = shard.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(shard.points[0].x, shard.points[0].y);
      for (let i = 1; i < shard.points.length; i++) {
        ctx.lineTo(shard.points[i].x, shard.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // If status is shattering and no active dome body, exit early
  if (shieldState.status === 'shattering') {
    ctx.restore();
    return;
  }

  // Compute activation scale & breathing pulse
  let currentScale = 1.0;
  let baseAlpha = 0.55;

  if (shieldState.status === 'activating') {
    // Spring pop: 0 -> 1.08 -> 1.0
    const p = Math.min(1, shieldState.activationProgress);
    const overshoot = 1 + 1.2 * Math.pow(p - 1, 3) + 0.8 * Math.pow(p - 1, 2);
    currentScale = Math.max(0.05, p * overshoot);
    baseAlpha = p * 0.7;
  } else {
    // Subtle breathing pulse
    const breathe = Math.sin(now * 0.0025);
    baseAlpha = 0.45 + breathe * 0.08;
    currentScale = 1.0 + breathe * 0.01;
  }

  const curRx = radiusX * currentScale;
  const curRy = radiusY * currentScale;

  // Upper semi-ellipse path for the dome
  ctx.save();
  ctx.beginPath();
  // Draw top arch of dome from Pi to 2*Pi (or 0)
  ctx.ellipse(center.x, center.y, curRx, curRy, 0, Math.PI, 0, false);
  ctx.lineTo(center.x + curRx, center.y + curRy * 0.1);
  ctx.lineTo(center.x - curRx, center.y + curRy * 0.1);
  ctx.closePath();
  ctx.clip(); // Clip everything to inside the dome boundary

  // Radial Fresnel Dome Glow: cyan-teal to iridescent gold
  const domeGrad = ctx.createRadialGradient(
    center.x,
    center.y - curRy * 0.35,
    curRy * 0.1,
    center.x,
    center.y - curRy * 0.1,
    curRx
  );
  domeGrad.addColorStop(0, `rgba(56, 217, 169, ${baseAlpha * 0.12})`);
  domeGrad.addColorStop(0.65, `rgba(32, 201, 151, ${baseAlpha * 0.28})`);
  domeGrad.addColorStop(0.92, `rgba(255, 212, 59, ${baseAlpha * 0.55})`);
  domeGrad.addColorStop(1.0, `rgba(56, 217, 169, ${baseAlpha * 0.85})`);

  ctx.fillStyle = domeGrad;
  ctx.fill();

  // Subtle Isometric Longitude & Latitude Energy Arcs
  ctx.strokeStyle = `rgba(169, 227, 75, ${baseAlpha * 0.35})`;
  ctx.lineWidth = 1.2 * scaleFactor;

  // Latitude rings
  const latRatios = [0.3, 0.58, 0.82];
  for (const lat of latRatios) {
    ctx.beginPath();
    ctx.ellipse(center.x, center.y - curRy * (1 - lat) * 0.5, curRx * lat, curRy * lat * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Hexagonal Lattice Overlay Pattern (Procedural)
  const hexSize = 28 * scaleFactor;
  const hDist = hexSize * 1.5;
  const vDist = hexSize * Math.sqrt(3);
  ctx.strokeStyle = `rgba(99, 230, 190, ${baseAlpha * 0.22})`;
  ctx.lineWidth = 1.0;

  const minX = center.x - curRx;
  const maxX = center.x + curRx;
  const minY = center.y - curRy;
  const maxY = center.y;

  for (let hx = minX; hx < maxX; hx += hDist) {
    for (let hy = minY; hy < maxY; hy += vDist) {
      const offY = (Math.floor(hx / hDist) % 2 === 0 ? 0 : vDist * 0.5);
      const py = hy + offY;
      const dx = (hx - center.x) / curRx;
      const dy = (py - center.y) / curRy;
      if (dx * dx + dy * dy < 0.95 && py <= center.y) {
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const angle = (Math.PI / 3) * a;
          const px = hx + (hexSize * 0.5) * Math.cos(angle);
          const pyHex = py + (hexSize * 0.5) * Math.sin(angle);
          if (a === 0) ctx.moveTo(px, pyHex);
          else ctx.lineTo(px, pyHex);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  // Floating Protection Runes (盾, 护, 御) rotating slowly along the dome crest
  const runes = ['盾', '护', '御'];
  ctx.font = `bold ${Math.round(15 * scaleFactor)}px "Noto Serif SC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const runeAngleBase = now * 0.0008;

  for (let rIdx = 0; rIdx < runes.length; rIdx++) {
    const runeAngle = Math.PI + 0.35 + ((Math.PI - 0.7) * (rIdx + 0.5)) / runes.length + Math.sin(runeAngleBase + rIdx) * 0.12;
    const rx = center.x + Math.cos(runeAngle) * curRx * 0.78;
    const ry = center.y + Math.sin(runeAngle) * curRy * 0.78;

    ctx.fillStyle = `rgba(255, 243, 191, ${baseAlpha * 0.85})`;
    ctx.shadowColor = '#ffd43b';
    ctx.shadowBlur = 8 * scaleFactor;
    ctx.fillText(runes[rIdx], rx, ry);
    ctx.shadowBlur = 0;
  }

  ctx.restore(); // Restore from clip

  // 2. Dome Outer Border Stroke (Fresnel Rim)
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, curRx, curRy, 0, Math.PI, 0, false);
  ctx.strokeStyle = `rgba(255, 236, 153, ${Math.min(1, baseAlpha * 1.3)})`;
  ctx.lineWidth = 2.8 * scaleFactor;
  ctx.shadowColor = '#38d9a9';
  ctx.shadowBlur = 12 * scaleFactor;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 3. Render Shield Impact Ripples (Hexagonal shockwaves radiating outward)
  if (shieldState.ripples.length > 0) {
    for (const rip of shieldState.ripples) {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${rip.alpha * 0.95})`;
      ctx.fillStyle = `rgba(56, 217, 169, ${rip.alpha * 0.25})`;
      ctx.lineWidth = 2.2 * scaleFactor;
      ctx.shadowColor = '#38d9a9';
      ctx.shadowBlur = 14 * scaleFactor;

      // Hexagonal shockwave
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const hexAngle = (Math.PI / 3) * a + (rip.radius * 0.02);
        const px = rip.x + rip.radius * Math.cos(hexAngle);
        const py = rip.y + (rip.radius * 0.65) * Math.sin(hexAngle); // squashed 2.5D
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Draws all flying cannonballs and ground/shield explosion bursts.
 */
export function drawCombatEffects(
  ctx: CanvasRenderingContext2D,
  cannonballs: Cannonball[],
  explosions: ExplosionBurst[],
  scaleFactor: number
): void {
  // 1. Draw Flying Cannonballs & Trails
  for (const ball of cannonballs) {
    if (ball.status !== 'flying') continue;

    // Draw particle trail
    for (const p of ball.trail) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const pos = computeBallisticPos(
      ball.startX,
      ball.startY,
      ball.targetX,
      ball.targetY,
      ball.arcHeight,
      ball.t
    );

    // Draw Cannonball Glowing Core & Fire Aura
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(pos.angle);

    const rad = 7 * scaleFactor;
    const glowGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, rad * 2.2);
    glowGrad.addColorStop(0, '#ffffff');
    glowGrad.addColorStop(0.3, '#ffd43b');
    glowGrad.addColorStop(0.7, '#ff922b');
    glowGrad.addColorStop(1, 'rgba(247, 103, 7, 0)');

    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, rad * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Solid core projectile
    ctx.fillStyle = '#f03e3e';
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();

    // Trailing flame tongue behind projectile
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.moveTo(-rad * 0.8, -rad * 0.7);
    ctx.lineTo(-rad * 2.6, 0);
    ctx.lineTo(-rad * 0.8, rad * 0.7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // 2. Draw Explosions
  for (const exp of explosions) {
    // Shockwave ring
    if (exp.radius > 2 && exp.flashAlpha > 0.05) {
      ctx.save();
      ctx.globalAlpha = exp.flashAlpha;
      ctx.strokeStyle = exp.kind === 'fire' ? '#ffd43b' : '#38d9a9';
      ctx.lineWidth = Math.max(1, 3.5 * exp.flashAlpha * scaleFactor);
      ctx.beginPath();
      ctx.ellipse(exp.x, exp.y, exp.radius, exp.radius * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Inner flash
      if (exp.flashAlpha > 0.5) {
        ctx.fillStyle = exp.kind === 'fire' ? 'rgba(255, 230, 150, 0.45)' : 'rgba(150, 245, 220, 0.45)';
        ctx.fill();
      }
      ctx.restore();
    }

    // Debris & smoke particles
    for (const p of exp.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
