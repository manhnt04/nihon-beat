/**
 * FOOTPRINT OUTLINE GENERATOR
 * ---------------------------
 * Computes the exact 2D perimeter polygon (ordered loop of points)
 * for any arbitrary set of relative footprint cells, handling non-convex
 * shapes (such as L-shape or T-shape) seamlessly.
 */

export interface Pt {
  x: number;
  y: number;
}

function edgeKey(a: Pt, b: Pt): string {
  const [p1, p2] = [a, b].sort((m, n) => m.x - n.x || m.y - n.y);
  return `${p1.x},${p1.y}-${p2.x},${p2.y}`;
}

/**
 * Return the perimeter polygon points in relative grid-space coordinates.
 * Each coordinate is an integer corner: e.g. tile (0, 0) has corners (0,0), (1,0), (1,1), (0,1).
 */
export function getFootprintOutline(cells: { x: number; y: number }[]): Pt[] {
  if (!cells || cells.length === 0) {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
  }

  const edgeCount = new Map<string, { a: Pt; b: Pt; count: number }>();

  const addEdge = (a: Pt, b: Pt) => {
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

  // Edges that appear exactly once are on the boundary
  const boundary = [...edgeCount.values()].filter((e) => e.count === 1);
  if (boundary.length === 0) {
    return [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
  }

  const pointKey = (p: Pt) => `${p.x},${p.y}`;
  const adjacency = new Map<string, Pt[]>();
  for (const e of boundary) {
    const ka = pointKey(e.a);
    const kb = pointKey(e.b);
    if (!adjacency.has(ka)) adjacency.set(ka, []);
    if (!adjacency.has(kb)) adjacency.set(kb, []);
    adjacency.get(ka)!.push(e.b);
    adjacency.get(kb)!.push(e.a);
  }

  const polygon: Pt[] = [];
  const visited = new Set<string>();
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
    if (polygon.length > cells.length * 4 + 8) break; // safety guard
  }

  // Simplify collinear perimeter points to return minimal corner polygon
  if (polygon.length <= 3) return polygon;
  const simplified: Pt[] = [];
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
