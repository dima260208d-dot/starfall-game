import { getPlatformTileCanvas } from "../utils/platformTile";
import { TileGrid, TileType, getTile, TILE_PROPS, TILE_CELL_SIZE } from "./TileMap";
import { getTileCanvas, TALL_TILE_TYPES, PYRAMID_TILE } from "../utils/tileModelCache";
import { getPowerBoxCanvas } from "../utils/powerModelCache";

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
  return { x, y, w: 50, h: 50, hp: 2500, maxHp: 2500, destroyed: false };
}

export function createShowdownMap(tileGrid?: TileGrid): GameMap {
  const W = 3000, H = 3000;
  const walls: Wall[] = [
    { x: 0, y: 0, w: W, h: 4, solid: true },
    { x: 0, y: H - 4, w: W, h: 4, solid: true },
    { x: 0, y: 0, w: 4, h: H, solid: true },
    { x: W - 4, y: 0, w: 4, h: H, solid: true },
  ];

  const crates: Crate[] = [];

  // Place 18 power boxes on grass tiles
  if (tileGrid) {
    const C = TILE_CELL_SIZE;
    const placed: Array<{ tx: number; ty: number }> = [];
    const target = 18;
    let tries = 0;
    const rng = () => Math.random();
    while (placed.length < target && tries < 3000) {
      tries++;
      const tx = Math.floor(rng() * 52) + 4;
      const ty = Math.floor(rng() * 52) + 4;
      const t = tileGrid.cells[ty * tileGrid.width + tx];
      if (t !== 0) continue; // only on grass
      if (placed.some(p => Math.abs(p.tx - tx) <= 2 && Math.abs(p.ty - ty) <= 2)) continue;
      const wx = tx * C + C * 0.25;
      const wy = ty * C + C * 0.25;
      crates.push({ x: wx, y: wy, w: 50, h: 50, hp: 2500, maxHp: 2500, destroyed: false });
      placed.push({ tx, ty });
    }
  }

  return { width: W, height: H, walls, bushes: [], crates, rivers: [], tileSize: 60, name: "Заброшенный храм" };
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

  const isShowdown = !!map.tileGrid;

  // ---------- GROUND — single platform image stretched across the full map ----------
  const tileCanvas = getPlatformTileCanvas();
  if (tileCanvas) {
    ctx.drawImage(tileCanvas, -camX, -camY, map.width, map.height);
  } else {
    ctx.fillStyle = isShowdown ? "#8B7040" : "#3A7D44";
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // Vignette overlay near map borders for atmosphere
  {
    const grad = ctx.createRadialGradient(
      canvasW / 2, canvasH / 2, Math.min(canvasW, canvasH) * 0.35,
      canvasW / 2, canvasH / 2, Math.max(canvasW, canvasH) * 0.75
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // Tile-grid maps handle all terrain — skip old rivers/bushes/walls/crates
  if (isShowdown) return;

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

  // ---------- POWER BOXES — rendered from 3-D GLB sprite ----------
  const _boxSprite = getPowerBoxCanvas();
  for (const crate of map.crates) {
    if (crate.destroyed) continue;
    const sx = crate.x - camX;
    const sy = crate.y - camY;
    if (sx + crate.w < 0 || sy + crate.h < 0 || sx > canvasW || sy > canvasH) continue;

    const hpRatio = crate.hp / crate.maxHp;
    const W = crate.w, H = crate.h;
    // Render slightly bigger than the tile footprint so it looks imposing
    const draw = W * 1.8;

    ctx.save();

    // Ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx + W / 2 + 2, sy + H + 4, draw * 0.45, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Purple ambient glow
    ctx.shadowColor = hpRatio > 0.5 ? "#CE93D8" : hpRatio > 0.25 ? "#FF9800" : "#F44336";
    ctx.shadowBlur = 18;

    if (_boxSprite) {
      // Draw the 3-D GLB sprite centred on the crate cell
      const dx = sx + W / 2 - draw / 2;
      const dy = sy + H / 2 - draw / 2 - 4; // nudge up slightly
      ctx.globalAlpha = hpRatio < 0.25 ? 0.55 : 1;
      ctx.drawImage(_boxSprite, dx, dy, draw, draw);
      ctx.globalAlpha = 1;
    } else {
      // Canvas fallback (shows until GLB loads)
      const faceGrad = ctx.createLinearGradient(sx, sy, sx + W, sy + H);
      faceGrad.addColorStop(0, "#7B2FBE");
      faceGrad.addColorStop(1, "#3A006E");
      ctx.fillStyle = faceGrad;
      ctx.fillRect(sx, sy, W, H);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFD700";
      ctx.font = `bold ${Math.round(W * 0.44)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✦", sx + W / 2, sy + H / 2);
    }

    ctx.shadowBlur = 0;

    // Damage cracks overlay (drawn on top of the sprite)
    if (hpRatio < 0.75) {
      ctx.strokeStyle = "rgba(255,120,0,0.75)";
      ctx.lineWidth = 2;
      const cx = sx + W / 2, cy = sy + H / 2;
      ctx.beginPath();
      ctx.moveTo(cx - W * 0.3, cy - H * 0.25);
      ctx.lineTo(cx, cy + H * 0.05);
      ctx.lineTo(cx - W * 0.15, cy + H * 0.3);
      ctx.stroke();
      if (hpRatio < 0.4) {
        ctx.beginPath();
        ctx.moveTo(cx + W * 0.2, cy - H * 0.3);
        ctx.lineTo(cx + W * 0.05, cy + H * 0.1);
        ctx.lineTo(cx + W * 0.3, cy + H * 0.35);
        ctx.stroke();
      }
    }

    // HP bar above the box
    const barW = draw;
    const barH = 5;
    const barX = sx + W / 2 - draw / 2;
    const barY = sy - 10;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    const barColor = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FFB300" : "#F44336";
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.restore();
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
  // Extra rows above the viewport to render — bushes can overflow up to ~2C
  // above their cell, so we need more look-ahead rows than for regular blocks.
  const TALL_ROWS_ABOVE = 4;
  const startTX = Math.max(0, Math.floor(camX / C));
  const endTX = Math.min(grid.width - 1, Math.ceil((camX + canvasW) / C));
  const startTY = Math.max(0, Math.floor(camY / C) - TALL_ROWS_ABOVE);
  const endTY = Math.min(grid.height - 1, Math.ceil((camY + canvasH) / C));

  // TALL_OVERFLOW: how far tall block sprites extend above their cell.
  const TALL_OVERFLOW = C * 0.9;

  // BUSH drawing constants — canvas is 256×512 (1:2 aspect).
  // The bush is drawn wider than one cell and tall enough to be proportional
  // to brawler characters (~1.5–2 cells in height).
  const BUSH_W = C * 1.35;           // draw width (slightly wider than cell)
  const BUSH_H = BUSH_W * 2.6;          // draw height (taller for better visibility)
  const BUSH_X_OFF = (C - BUSH_W) / 2; // centre horizontally on cell
  // Anchor bottom of bush to cell bottom (sy + C), then subtract full height.
  const BUSH_Y_TOP_OFF = BUSH_H - C;  // how far above sy the top of the bush is

  for (let tx = startTX; tx <= endTX; tx++) {
    for (let ty = startTY; ty <= endTY; ty++) {
      const type = getTile(grid, tx, ty);
      if (type === TileType.GRASS) continue;

      const isBush = type === TileType.BUSH;
      if (isBush !== bushLayer) continue;

      // Round to integer pixels to prevent subpixel hairline gaps between tiles.
      const sx = Math.round(tx * C - camX);
      const sy = Math.round(ty * C - camY);

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
        if (isBush) {
          // Bush uses a 256×512 (1:2) canvas rendered from a low frontal angle.
          // Draw it anchored at the bottom of the cell and extending upward so
          // it is proportional to brawler characters.
          ctx.drawImage(
            tileCanvas,
            sx + BUSH_X_OFF - 1,
            sy - BUSH_Y_TOP_OFF - 1,
            BUSH_W + 2,
            BUSH_H + 2,
          );
        } else if (TALL_TILE_TYPES.has(type)) {
          // Tall blocks: +1px bleed on all sides to eliminate subpixel seams
          ctx.drawImage(tileCanvas, sx - 1, sy - TALL_OVERFLOW - 1, C + 2, C + TALL_OVERFLOW + 2);
        } else if (type === TileType.WATER) {
          // Water: large overflow on all sides to close gaps between adjacent tiles
          const ov = C * 0.15 + 2;
          ctx.drawImage(tileCanvas, sx - ov, sy - ov, C + ov * 2, C + ov * 2);
        } else {
          // Flat tiles: +1px bleed on all sides
          ctx.drawImage(tileCanvas, sx - 1, sy - 1, C + 2, C + 2);
        }
      } else {
        const colors: Record<number, string> = {
          [TileType.WALL]:       "#8B6060",
          [TileType.MOUNTAIN]:   "#607060",
          [TileType.BUSH]:       "#4CAF50",
          [TileType.WATER]:      "#1565C0",
          [TileType.DECORATION]: "#E0E0E0",
          [TileType.FENCE]:      "#C8A45A",
          [TileType.HEAL]:       "#C2185B",
          [TileType.TREE]:       "#1B5E20",
          [TileType.CACTUS]:     "#558B2F",
          [TileType.WOOD]:       "#8D6E63",
          [TileType.SAND_WALL]:  "#78909C",
          [PYRAMID_TILE]:        "#FDD835",
        };
        const baseColor = colors[type] ?? "#888";
        // Fill with 1px bleed to prevent seams — no stroke border that creates gaps
        ctx.fillStyle = baseColor;
        ctx.fillRect(sx - 1, sy - 1, C + 2, C + 2);
        // Subtle top-face highlight and bottom-face shadow for a chunky 3-D look
        const hl = Math.round(C * 0.28);
        ctx.fillStyle = "rgba(255,255,255,0.20)";
        ctx.fillRect(sx - 1, sy - 1, C + 2, hl);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(sx - 1, sy + C - hl + 1, C + 2, hl + 1);
      }

      if (isBush) ctx.restore();
    }
  }
}
