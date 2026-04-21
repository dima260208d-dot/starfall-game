export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function angleTo(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function rectCircleCollide(
  rx: number, ry: number, rw: number, rh: number,
  cx: number, cy: number, cr: number
): boolean {
  const nearX = clamp(cx, rx, rx + rw);
  const nearY = clamp(cy, ry, ry + rh);
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

export function circleCircleCollide(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  const d = distance(x1, y1, x2, y2);
  return d < r1 + r2;
}

export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export interface AutoAimTarget {
  alive: boolean;
  inBush: boolean;
  team: string;
  x: number;
  y: number;
  radius: number;
}

export function autoAimAngle(
  player: { x: number; y: number; team: string; stats: { attackRange: number } },
  candidates: AutoAimTarget[],
  fallbackAngle: number,
  rangeMultiplier = 1.15
): number {
  const range = player.stats.attackRange * rangeMultiplier;
  let best: AutoAimTarget | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    if (!c.alive) continue;
    if (c.team === player.team) continue;
    if (c.inBush) {
      const dd = distance(player.x, player.y, c.x, c.y);
      if (dd > 140) continue;
    }
    const d = distance(player.x, player.y, c.x, c.y);
    if (d < range + c.radius && d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best) return angleTo(player.x, player.y, best.x, best.y);
  return fallbackAngle;
}

export function hpColor(ratio: number): string {
  const r = Math.floor(255 * (1 - ratio));
  const g = Math.floor(255 * ratio);
  return `rgb(${r},${g},0)`;
}
