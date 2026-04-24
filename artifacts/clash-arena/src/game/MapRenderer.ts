import { getPlatformTileCanvas } from "../utils/platformTile";
import { TileGrid, TileType, getTile, TILE_PROPS } from "./TileMap";
import { getTileCanvas } from "../utils/tileModelCache";

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
}

export interface Bush {
  x: number;
  y: number;
  radius: number;
}

export interface Crate {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export interface River {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GameMap {
  width: number;
  height: number;
  walls: Wall[];
  bushes: Bush[];
  crates: Crate[];
  rivers: River[];
  tileSize: number;
  name: string;
  tileGrid?: TileGrid;
}

function makeCrate(x: number, y: number): Crate {
  return { x, y, w: 40, h: 40, hp: 3, maxHp: 3, destroyed: false };
}

export function createShowdownMap(): GameMap {
  const W = 5000, H = 5000;
  const walls: Wall[] = [
    { x: 0, y: 0, w: W, h: 60, solid: true },
    { x: 0, y: H - 60, w: W, h: 60, solid: true },
    { x: 0, y: 0, w: 60, h: H, solid: true },
    { x: W - 60, y: 0, w: 60, h: H, solid: true },
    { x: 400, y: 400, w: 200, h: 60, solid: true },
    { x: 800, y: 600, w: 60, h: 200, solid: true },
    { x: 1200, y: 300, w: 300, h: 60, solid: true },
    { x: 1800, y: 500, w: 60, h: 300, solid: true },
    { x: 2200, y: 200, w: 200, h: 60, solid: true },
    { x: 2800, y: 400, w: 60, h: 250, solid: true },
    { x: 3200, y: 300, w: 300, h: 60, solid: true },
    { x: 3800, y: 600, w: 60, h: 200, solid: true },
    { x: 4200, y: 400, w: 200, h: 60, solid: true },
    { x: 600, y: 1200, w: 60, h: 300, solid: true },
    { x: 900, y: 1600, w: 250, h: 60, solid: true },
    { x: 1500, y: 1000, w: 200, h: 60, solid: true },
    { x: 1800, y: 1400, w: 60, h: 200, solid: true },
    { x: 2400, y: 1200, w: 300, h: 60, solid: true },
    { x: 2800, y: 1600, w: 200, h: 60, solid: true },
    { x: 3200, y: 1000, w: 60, h: 300, solid: true },
    { x: 3600, y: 1400, w: 250, h: 60, solid: true },
    { x: 4200, y: 1200, w: 60, h: 300, solid: true },
    { x: 500, y: 2400, w: 300, h: 60, solid: true },
    { x: 1000, y: 2200, w: 60, h: 250, solid: true },
    { x: 1600, y: 2600, w: 200, h: 60, solid: true },
    { x: 2000, y: 2000, w: 60, h: 300, solid: true },
    { x: 2400, y: 2400, w: 200, h: 60, solid: true },
    { x: 2900, y: 2200, w: 60, h: 250, solid: true },
    { x: 3200, y: 2600, w: 300, h: 60, solid: true },
    { x: 3800, y: 2000, w: 60, h: 300, solid: true },
    { x: 4200, y: 2400, w: 200, h: 60, solid: true },
    { x: 400, y: 3400, w: 200, h: 60, solid: true },
    { x: 800, y: 3200, w: 60, h: 250, solid: true },
    { x: 1500, y: 3600, w: 300, h: 60, solid: true },
    { x: 2000, y: 3200, w: 200, h: 60, solid: true },
    { x: 2500, y: 3600, w: 60, h: 250, solid: true },
    { x: 3000, y: 3400, w: 200, h: 60, solid: true },
    { x: 3500, y: 3200, w: 60, h: 300, solid: true },
    { x: 4000, y: 3600, w: 250, h: 60, solid: true },
    { x: 600, y: 4300, w: 250, h: 60, solid: true },
    { x: 1200, y: 4100, w: 60, h: 250, solid: true },
    { x: 1800, y: 4400, w: 300, h: 60, solid: true },
    { x: 2500, y: 4100, w: 200, h: 60, solid: true },
    { x: 3000, y: 4300, w: 60, h: 250, solid: true },
    { x: 3600, y: 4100, w: 300, h: 60, solid: true },
    { x: 4200, y: 4300, w: 60, h: 250, solid: true },
    { x: 2300, y: 2300, w: 100, h: 100, solid: true },
    { x: 2600, y: 2300, w: 100, h: 100, solid: true },
    { x: 2300, y: 2600, w: 100, h: 100, solid: true },
    { x: 2600, y: 2600, w: 100, h: 100, solid: true },
  ];

  const bushes: Bush[] = [];
  for (let bx = 200; bx < W; bx += 400) {
    for (let by = 200; by < H; by += 400) {
      if (Math.random() < 0.3) {
        bushes.push({ x: bx + Math.random() * 100 - 50, y: by + Math.random() * 100 - 50, radius: 60 + Math.random() * 40 });
      }
    }
  }

  const crates: Crate[] = [];
  for (let cx = 300; cx < W - 300; cx += 300) {
    for (let cy = 300; cy < H - 300; cy += 300) {
      if (Math.random() < 0.1) {
        crates.push(makeCrate(cx, cy));
      }
    }
  }

  const rivers: River[] = [
    { x: 1000, y: 1800, w: 600, h: 80 },
    { x: 2500, y: 3000, w: 500, h: 80 },
    { x: 3500, y: 1200, w: 80, h: 500 },
    { x: 800, y: 3500, w: 80, h: 600 },
  ];

  return { width: W, height: H, walls, bushes, crates, rivers, tileSize: 60, name: "Заброшенный храм" };
}

export function createCrystalsMap(): GameMap {
  const W = 3500, H = 3500;
  const walls: Wall[] = [
    { x: 0, y: 0, w: W, h: 60, solid: true },
    { x: 0, y: H - 60, w: W, h: 60, solid: true },
    { x: 0, y: 0, w: 60, h: H, solid: true },
    { x: W - 60, y: 0, w: 60, h: H, solid: true },
    { x: 600, y: 500, w: 200, h: 60, solid: true },
    { x: 900, y: 700, w: 60, h: 200, solid: true },
    { x: 1400, y: 400, w: 250, h: 60, solid: true },
    { x: 2600, y: 500, w: 200, h: 60, solid: true },
    { x: 2500, y: 700, w: 60, h: 200, solid: true },
    { x: 1800, y: 400, w: 250, h: 60, solid: true },
    { x: 500, y: 1400, w: 60, h: 300, solid: true },
    { x: 700, y: 1200, w: 200, h: 60, solid: true },
    { x: 2700, y: 1400, w: 60, h: 300, solid: true },
    { x: 2500, y: 1200, w: 200, h: 60, solid: true },
    { x: 1600, y: 1600, w: 60, h: 250, solid: true },
    { x: 1800, y: 1600, w: 60, h: 250, solid: true },
    { x: 500, y: 2400, w: 200, h: 60, solid: true },
    { x: 600, y: 2200, w: 60, h: 250, solid: true },
    { x: 2700, y: 2400, w: 200, h: 60, solid: true },
    { x: 2800, y: 2200, w: 60, h: 250, solid: true },
    { x: 1000, y: 2800, w: 250, h: 60, solid: true },
    { x: 2200, y: 2800, w: 250, h: 60, solid: true },
  ];

  const bushes: Bush[] = [
    { x: 300, y: 1750, radius: 70 },
    { x: 500, y: 1750, radius: 60 },
    { x: 3000, y: 1750, radius: 70 },
    { x: 3200, y: 1750, radius: 60 },
    { x: 1000, y: 600, radius: 60 },
    { x: 2400, y: 600, radius: 60 },
    { x: 1000, y: 2900, radius: 60 },
    { x: 2400, y: 2900, radius: 60 },
    { x: 1750, y: 300, radius: 60 },
    { x: 1750, y: 3200, radius: 60 },
  ];

  const crates: Crate[] = [];

  const rivers: River[] = [
    { x: 1500, y: 700, w: 500, h: 60 },
    { x: 1500, y: 2700, w: 500, h: 60 },
    { x: 200, y: 1500, w: 60, h: 500 },
    { x: 3200, y: 1500, w: 60, h: 500 },
  ];

  return { width: W, height: H, walls, bushes, crates, rivers, tileSize: 60, name: "Кристальная шахта" };
}

// Deterministic pseudo-random noise from integer coords (stable per tile)
function noise2(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

const WALL_DEPTH = 16; // pseudo-3D extrusion offset for walls/crates
const WALL_SHADOW = 22;

export function renderMap(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  camX: number,
  camY: number,
  canvasW: number,
  canvasH: number,
  frame = 0
): void {
  const startTX = Math.floor(camX / map.tileSize);
  const endTX = Math.ceil((camX + canvasW) / map.tileSize);
  const startTY = Math.floor(camY / map.tileSize);
  const endTY = Math.ceil((camY + canvasH) / map.tileSize);

  const isShowdown = map.name === "Заброшенный храм";

  // ---------- GROUND — single platform image stretched across the full map ----------
  const tileCanvas = getPlatformTileCanvas();
  if (tileCanvas) {
    ctx.drawImage(tileCanvas, -camX, -camY, map.width, map.height);
  } else {
    // Fallback: solid colour while model loads
    ctx.fillStyle = "#8B7040";
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // Vignette overlay near map borders for atmosphere
  {
    const edgeFade = 240;
    const grad = ctx.createRadialGradient(
      canvasW / 2, canvasH / 2, Math.min(canvasW, canvasH) * 0.35,
      canvasW / 2, canvasH / 2, Math.max(canvasW, canvasH) * 0.75
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
    void edgeFade;
  }

  // ---------- RIVERS with animated water ----------
  const t = frame * 0.05;
  for (const river of map.rivers) {
    const sx = river.x - camX;
    const sy = river.y - camY;
    if (sx + river.w < 0 || sy + river.h < 0 || sx > canvasW || sy > canvasH) continue;

    // Recessed dark base (depth)
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(sx - 2, sy - 2, river.w + 4, river.h + 4);

    const grad = ctx.createLinearGradient(sx, sy, sx, sy + river.h);
    grad.addColorStop(0, "#0D47A1");
    grad.addColorStop(0.5, "#1976D2");
    grad.addColorStop(1, "#0D47A1");
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, river.w, river.h);

    // Caustic / wave shimmer
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, river.w, river.h);
    ctx.clip();
    ctx.strokeStyle = "rgba(180,220,255,0.45)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const baseY = sy + (river.h * (i + 0.5)) / 5;
      ctx.moveTo(sx, baseY);
      const step = 14;
      for (let xx = 0; xx <= river.w; xx += step) {
        const yy = baseY + Math.sin((xx + t * 30 + i * 50) * 0.06) * 3.2;
        ctx.lineTo(sx + xx, yy);
      }
      ctx.stroke();
    }
    // Highlight specular dots
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 6; i++) {
      const px = sx + ((i * 73 + frame * 0.7) % river.w);
      const py = sy + ((i * 41) % river.h);
      ctx.fillRect(px, py, 2, 1);
    }
    ctx.restore();

    // Bank highlight
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 0.5, sy + 0.5, river.w - 1, river.h - 1);
  }

  // ---------- BUSHES — multi-layer foliage with bevel ----------
  for (const bush of map.bushes) {
    const sx = bush.x - camX;
    const sy = bush.y - camY;
    if (sx + bush.radius < 0 || sy + bush.radius < 0 || sx - bush.radius > canvasW || sy - bush.radius > canvasH) continue;

    ctx.save();
    // Soft ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy + bush.radius * 0.55, bush.radius * 0.95, bush.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark base layer
    ctx.fillStyle = "#1B5E20";
    ctx.beginPath();
    ctx.arc(sx, sy + 4, bush.radius, 0, Math.PI * 2);
    ctx.fill();

    // Mid layer clusters
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const ox = Math.cos(a) * bush.radius * 0.45;
      const oy = Math.sin(a) * bush.radius * 0.4;
      ctx.beginPath();
      ctx.arc(sx + ox, sy + oy, bush.radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? "#2E7D32" : "#388E3C";
      ctx.fill();
    }

    // Top highlight cluster
    ctx.beginPath();
    ctx.arc(sx, sy - bush.radius * 0.1, bush.radius * 0.55, 0, Math.PI * 2);
    const bgrad = ctx.createRadialGradient(
      sx - bush.radius * 0.2, sy - bush.radius * 0.3, 2,
      sx, sy, bush.radius * 0.7
    );
    bgrad.addColorStop(0, "#A5D6A7");
    bgrad.addColorStop(0.5, "#66BB6A");
    bgrad.addColorStop(1, "#43A047");
    ctx.fillStyle = bgrad;
    ctx.fill();

    // Specular leaf highlights
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx - bush.radius * 0.25, sy - bush.radius * 0.3, bush.radius * 0.15, bush.radius * 0.07, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- CRATES — pseudo-3D wooden boxes ----------
  for (const crate of map.crates) {
    if (crate.destroyed) continue;
    const sx = crate.x - camX;
    const sy = crate.y - camY;
    if (sx + crate.w < 0 || sy + crate.h < 0 || sx > canvasW || sy > canvasH) continue;

    const depth = 10;
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(sx + crate.w / 2 + 4, sy + crate.h + 6, crate.w * 0.55, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const hpRatio = crate.hp / crate.maxHp;
    const baseR = hpRatio > 0.66 ? 141 : hpRatio > 0.33 ? 121 : 109;
    const baseG = hpRatio > 0.66 ? 110 : hpRatio > 0.33 ? 85 : 76;
    const baseB = hpRatio > 0.66 ? 99 : hpRatio > 0.33 ? 72 : 65;

    // Right side face (extrusion)
    ctx.fillStyle = `rgb(${baseR - 35},${baseG - 30},${baseB - 25})`;
    ctx.beginPath();
    ctx.moveTo(sx + crate.w, sy);
    ctx.lineTo(sx + crate.w + depth, sy - depth * 0.5);
    ctx.lineTo(sx + crate.w + depth, sy + crate.h - depth * 0.5);
    ctx.lineTo(sx + crate.w, sy + crate.h);
    ctx.closePath();
    ctx.fill();

    // Top face
    const topGrad = ctx.createLinearGradient(sx, sy, sx + crate.w, sy + crate.h);
    topGrad.addColorStop(0, `rgb(${baseR + 25},${baseG + 20},${baseB + 15})`);
    topGrad.addColorStop(1, `rgb(${baseR - 10},${baseG - 8},${baseB - 6})`);
    ctx.fillStyle = topGrad;
    ctx.fillRect(sx, sy, crate.w, crate.h);

    // Wood plank lines
    ctx.strokeStyle = `rgb(${baseR - 35},${baseG - 30},${baseB - 25})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy + crate.h / 2);
    ctx.lineTo(sx + crate.w, sy + crate.h / 2);
    ctx.stroke();

    // Iron straps
    ctx.fillStyle = "rgba(60,50,45,0.85)";
    ctx.fillRect(sx, sy, crate.w, 4);
    ctx.fillRect(sx, sy + crate.h - 4, crate.w, 4);
    // Rivets
    ctx.fillStyle = "#3E2723";
    for (const px of [sx + 4, sx + crate.w - 6]) {
      ctx.beginPath();
      ctx.arc(px + 1, sy + 2, 1.5, 0, Math.PI * 2);
      ctx.arc(px + 1, sy + crate.h - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bevel highlight on top edge
    ctx.fillStyle = "rgba(255,235,200,0.3)";
    ctx.fillRect(sx, sy, crate.w, 2);
    ctx.fillRect(sx, sy, 2, crate.h);

    // Outline
    ctx.strokeStyle = "rgba(40,25,15,0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + 0.5, sy + 0.5, crate.w - 1, crate.h - 1);

    // Damage cracks
    if (hpRatio < 1) {
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx + crate.w * 0.2, sy + crate.h * 0.3);
      ctx.lineTo(sx + crate.w * 0.5, sy + crate.h * 0.5);
      ctx.lineTo(sx + crate.w * 0.4, sy + crate.h * 0.7);
      ctx.stroke();
      if (hpRatio < 0.5) {
        ctx.beginPath();
        ctx.moveTo(sx + crate.w * 0.7, sy + crate.h * 0.2);
        ctx.lineTo(sx + crate.w * 0.6, sy + crate.h * 0.6);
        ctx.lineTo(sx + crate.w * 0.85, sy + crate.h * 0.8);
        ctx.stroke();
      }
    }
  }

  // ---------- WALLS — pseudo-3D extruded blocks ----------
  // Pass 1: drop shadows (soft)
  for (const wall of map.walls) {
    const sx = wall.x - camX;
    const sy = wall.y - camY;
    if (sx + wall.w + WALL_SHADOW < 0 || sy + wall.h + WALL_SHADOW < 0 || sx > canvasW || sy > canvasH) continue;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(sx + WALL_SHADOW * 0.6, sy + WALL_SHADOW, wall.w, wall.h);
  }

  // Pass 2: side faces (right and bottom extrusion)
  for (const wall of map.walls) {
    const sx = wall.x - camX;
    const sy = wall.y - camY;
    if (sx + wall.w + WALL_DEPTH < 0 || sy + wall.h + WALL_DEPTH < 0 || sx > canvasW || sy > canvasH) continue;

    // Right face
    ctx.fillStyle = isShowdown ? "#3E3E3E" : "#2A0E55";
    ctx.beginPath();
    ctx.moveTo(sx + wall.w, sy);
    ctx.lineTo(sx + wall.w + WALL_DEPTH, sy + WALL_DEPTH);
    ctx.lineTo(sx + wall.w + WALL_DEPTH, sy + wall.h + WALL_DEPTH);
    ctx.lineTo(sx + wall.w, sy + wall.h);
    ctx.closePath();
    ctx.fill();

    // Bottom face
    ctx.fillStyle = isShowdown ? "#2E2E2E" : "#1F0840";
    ctx.beginPath();
    ctx.moveTo(sx, sy + wall.h);
    ctx.lineTo(sx + WALL_DEPTH, sy + wall.h + WALL_DEPTH);
    ctx.lineTo(sx + wall.w + WALL_DEPTH, sy + wall.h + WALL_DEPTH);
    ctx.lineTo(sx + wall.w, sy + wall.h);
    ctx.closePath();
    ctx.fill();
  }

  // Pass 3: top faces with gradient + bevel
  for (const wall of map.walls) {
    const sx = wall.x - camX;
    const sy = wall.y - camY;
    if (sx + wall.w < 0 || sy + wall.h < 0 || sx > canvasW || sy > canvasH) continue;

    const grad = ctx.createLinearGradient(sx, sy, sx + wall.w, sy + wall.h);
    if (isShowdown) {
      grad.addColorStop(0, "#A8A8A8");
      grad.addColorStop(0.5, "#888888");
      grad.addColorStop(1, "#5C5C5C");
    } else {
      grad.addColorStop(0, "#9C27B0");
      grad.addColorStop(0.5, "#7B1FA2");
      grad.addColorStop(1, "#4A148C");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, wall.w, wall.h);

    // Stone block subdivision lines
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    const blockSize = 40;
    for (let bx = blockSize; bx < wall.w; bx += blockSize) {
      ctx.beginPath();
      ctx.moveTo(sx + bx, sy);
      ctx.lineTo(sx + bx, sy + wall.h);
      ctx.stroke();
    }
    for (let by = blockSize; by < wall.h; by += blockSize) {
      ctx.beginPath();
      ctx.moveTo(sx, sy + by);
      ctx.lineTo(sx + wall.w, sy + by);
      ctx.stroke();
    }

    // Top + left bevel highlight (light from top-left)
    ctx.fillStyle = isShowdown ? "rgba(255,255,255,0.35)" : "rgba(225,180,255,0.35)";
    ctx.fillRect(sx, sy, wall.w, 3);
    ctx.fillRect(sx, sy, 3, wall.h);

    // Right + bottom inner shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(sx, sy + wall.h - 2, wall.w, 2);
    ctx.fillRect(sx + wall.w - 2, sy, 2, wall.h);

    // Outline
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + 0.5, sy + 0.5, wall.w - 1, wall.h - 1);
  }
}

export function isInBush(x: number, y: number, bushes: Bush[]): boolean {
  for (const b of bushes) {
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx * dx + dy * dy < b.radius * b.radius) return true;
  }
  return false;
}

export function isInRiver(x: number, y: number, rivers: River[]): boolean {
  for (const r of rivers) {
    if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
  }
  return false;
}

export function collidesWithWalls(x: number, y: number, radius: number, walls: Wall[]): { collides: boolean; nx: number; ny: number } {
  let nx = x, ny = y;
  let collides = false;
  for (const wall of walls) {
    const nearX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
    const nearY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
    const dx = x - nearX;
    const dy = y - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq < radius * radius) {
      collides = true;
      const dist = Math.sqrt(distSq) || 0.01;
      const overlap = radius - dist;
      nx += (dx / dist) * overlap;
      ny += (dy / dist) * overlap;
    }
  }
  return { collides, nx, ny };
}

const BUSH_REVEAL_RADIUS = 4 * 50; // 4 tiles in world units

export function renderTileGrid(
  ctx: CanvasRenderingContext2D,
  grid: TileGrid,
  camX: number, camY: number,
  canvasW: number, canvasH: number,
  playerX: number, playerY: number,
  bushLayer: boolean
): void {
  const C = grid.cellSize;
  const startTX = Math.max(0, Math.floor(camX / C));
  const endTX = Math.min(grid.width - 1, Math.ceil((camX + canvasW) / C));
  const startTY = Math.max(0, Math.floor(camY / C));
  const endTY = Math.min(grid.height - 1, Math.ceil((camY + canvasH) / C));

  for (let tx = startTX; tx <= endTX; tx++) {
    for (let ty = startTY; ty <= endTY; ty++) {
      const type = getTile(grid, tx, ty);
      if (type === TileType.GRASS) continue;

      const isBush = type === TileType.BUSH;
      if (isBush !== bushLayer) continue;

      const sx = tx * C - camX;
      const sy = ty * C - camY;

      if (isBush) {
        const worldX = tx * C + C / 2;
        const worldY = ty * C + C / 2;
        const dx = worldX - playerX;
        const dy = worldY - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const alpha = dist < BUSH_REVEAL_RADIUS ? 0.35 : 1.0;
        ctx.save();
        ctx.globalAlpha = alpha;
      }

      const tileCanvas = getTileCanvas(type);
      if (tileCanvas) {
        ctx.drawImage(tileCanvas, sx, sy, C, C);
      } else {
        const props = TILE_PROPS[type];
        const colors: Record<number, string> = {
          [TileType.WALL]:       "#6E6E6E",
          [TileType.MOUNTAIN]:   "#404040",
          [TileType.BUSH]:       "#2D7A2D",
          [TileType.WATER]:      "#1565C0",
          [TileType.DECORATION]: "#8B4513",
          [TileType.FENCE]:      "#C8A45A",
          [TileType.HEAL]:       "#C2185B",
          [TileType.TREE]:       "#1B5E20",
          [TileType.CACTUS]:     "#558B2F",
          [TileType.WOOD]:       "#A0522D",
          [TileType.SAND_WALL]:  "#C2A04A",
        };
        void props;
        ctx.fillStyle = colors[type] ?? "#888";
        ctx.fillRect(sx, sy, C, C);
        ctx.strokeStyle = "rgba(0,0,0,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, C - 1, C - 1);
      }

      if (isBush) ctx.restore();
    }
  }
}
