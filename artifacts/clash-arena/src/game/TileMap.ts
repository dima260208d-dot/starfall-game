export const TILE_CELL_SIZE = 50;
export const GRID_SIZE = 100;

export enum TileType {
  GRASS = 0,
  WALL = 1,
  MOUNTAIN = 2,
  BUSH = 3,
  WATER = 4,
  DECORATION = 5,
  FENCE = 6,
  HEAL = 7,
  TREE = 8,
  CACTUS = 9,
  WOOD = 10,
  SAND_WALL = 11,
}

export interface TileProps {
  walkable: boolean;
  shootThrough: boolean;
  destructible: boolean;
  soraDestructible: boolean;
  healRate: number;
  cover: boolean;
}

export const TILE_PROPS: Record<number, TileProps> = {
  [TileType.GRASS]:      { walkable: true,  shootThrough: true,  destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.WALL]:       { walkable: false, shootThrough: false, destructible: false, soraDestructible: true,  healRate: 0,   cover: false },
  [TileType.MOUNTAIN]:   { walkable: false, shootThrough: false, destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.BUSH]:       { walkable: true,  shootThrough: true,  destructible: false, soraDestructible: false, healRate: 0,   cover: true  },
  [TileType.WATER]:      { walkable: false, shootThrough: true,  destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.DECORATION]: { walkable: false, shootThrough: false, destructible: true,  soraDestructible: true,  healRate: 0,   cover: false },
  [TileType.FENCE]:      { walkable: false, shootThrough: true,  destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.HEAL]:       { walkable: true,  shootThrough: true,  destructible: false, soraDestructible: false, healRate: 500, cover: false },
  [TileType.TREE]:       { walkable: false, shootThrough: false, destructible: false, soraDestructible: true,  healRate: 0,   cover: false },
  [TileType.CACTUS]:     { walkable: false, shootThrough: false, destructible: false, soraDestructible: true,  healRate: 0,   cover: false },
  [TileType.WOOD]:       { walkable: false, shootThrough: false, destructible: true,  soraDestructible: true,  healRate: 0,   cover: false },
  [TileType.SAND_WALL]:  { walkable: false, shootThrough: false, destructible: false, soraDestructible: true,  healRate: 0,   cover: false },
};

export interface TileGrid {
  cells: Uint8Array;
  destroyed: Uint8Array;
  width: number;
  height: number;
  cellSize: number;
}

export function getTile(grid: TileGrid, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return TileType.MOUNTAIN;
  const idx = ty * grid.width + tx;
  if (grid.destroyed[idx]) return TileType.GRASS;
  return grid.cells[idx];
}

export function setTile(grid: TileGrid, tx: number, ty: number, type: TileType): void {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return;
  grid.cells[ty * grid.width + tx] = type;
}

export function destroyTile(grid: TileGrid, tx: number, ty: number): void {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return;
  const type = grid.cells[ty * grid.width + tx];
  const props = TILE_PROPS[type];
  if (props?.destructible) {
    grid.destroyed[ty * grid.width + tx] = 1;
  }
}

export function soraDestroyTile(grid: TileGrid, tx: number, ty: number): void {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return;
  const type = grid.cells[ty * grid.width + tx];
  const props = TILE_PROPS[type];
  if (props?.soraDestructible) {
    grid.destroyed[ty * grid.width + tx] = 1;
  }
}

export function collidesWithTileGrid(
  x: number, y: number, radius: number,
  grid: TileGrid
): { collides: boolean; nx: number; ny: number } {
  const C = grid.cellSize;
  const minTX = Math.max(0, Math.floor((x - radius) / C));
  const maxTX = Math.min(grid.width - 1, Math.floor((x + radius) / C));
  const minTY = Math.max(0, Math.floor((y - radius) / C));
  const maxTY = Math.min(grid.height - 1, Math.floor((y + radius) / C));

  let nx = x, ny = y;
  let collides = false;

  for (let tx = minTX; tx <= maxTX; tx++) {
    for (let ty = minTY; ty <= maxTY; ty++) {
      const type = getTile(grid, tx, ty);
      const props = TILE_PROPS[type];
      if (!props || props.walkable) continue;

      const tileX = tx * C;
      const tileY = ty * C;
      const nearX = Math.max(tileX, Math.min(nx, tileX + C));
      const nearY = Math.max(tileY, Math.min(ny, tileY + C));
      const dx = nx - nearX;
      const dy = ny - nearY;
      const distSq = dx * dx + dy * dy;
      if (distSq < radius * radius) {
        collides = true;
        const dist = Math.sqrt(distSq) || 0.01;
        const overlap = radius - dist;
        nx += (dx / dist) * overlap;
        ny += (dy / dist) * overlap;
      }
    }
  }

  return { collides, nx, ny };
}

export function projectileBlockedByTile(
  x: number, y: number,
  grid: TileGrid
): { blocked: boolean; tx: number; ty: number } {
  const C = grid.cellSize;
  const tx = Math.floor(x / C);
  const ty = Math.floor(y / C);
  const type = getTile(grid, tx, ty);
  const props = TILE_PROPS[type];
  if (!props || props.shootThrough) return { blocked: false, tx, ty };
  return { blocked: true, tx, ty };
}

export function getTileHealRate(x: number, y: number, grid: TileGrid): number {
  const C = grid.cellSize;
  const tx = Math.floor(x / C);
  const ty = Math.floor(y / C);
  const type = getTile(grid, tx, ty);
  return TILE_PROPS[type]?.healRate ?? 0;
}

export function isTileInBush(x: number, y: number, grid: TileGrid): boolean {
  const C = grid.cellSize;
  const tx = Math.floor(x / C);
  const ty = Math.floor(y / C);
  return getTile(grid, tx, ty) === TileType.BUSH;
}

export function nearestGrassTile(
  grid: TileGrid,
  worldX: number, worldY: number
): { x: number; y: number } {
  const C = grid.cellSize;
  let tx = Math.floor(worldX / C);
  let ty = Math.floor(worldY / C);
  tx = Math.max(0, Math.min(grid.width - 1, tx));
  ty = Math.max(0, Math.min(grid.height - 1, ty));

  if (getTile(grid, tx, ty) === TileType.GRASS) {
    return { x: (tx + 0.5) * C, y: (ty + 0.5) * C };
  }

  for (let r = 1; r < 10; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (getTile(grid, nx, ny) === TileType.GRASS) {
          return { x: (nx + 0.5) * C, y: (ny + 0.5) * C };
        }
      }
    }
  }

  return { x: (tx + 0.5) * C, y: (ty + 0.5) * C };
}

function lcg(seed: { v: number }): number {
  seed.v = Math.imul(seed.v, 1664525) + 1013904223;
  return ((seed.v >>> 0) / 0xffffffff);
}

export function generateShowdownTileGrid(seedVal = Date.now()): TileGrid {
  const W = GRID_SIZE, H = GRID_SIZE;
  const grid: TileGrid = {
    cells: new Uint8Array(W * H),
    destroyed: new Uint8Array(W * H),
    width: W, height: H,
    cellSize: TILE_CELL_SIZE,
  };
  const seed = { v: seedVal | 0 };

  grid.cells.fill(TileType.GRASS);

  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      if (x < 3 || x >= W - 3 || y < 3 || y >= H - 3) {
        setTile(grid, x, y, TileType.MOUNTAIN);
      }
    }
  }

  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  const numRooms = 4 + Math.floor(lcg(seed) * 4);
  for (let i = 0; i < numRooms; i++) {
    const rw = 6 + Math.floor(lcg(seed) * 5);
    const rh = 6 + Math.floor(lcg(seed) * 5);
    const rx = 5 + Math.floor(lcg(seed) * (W - 10 - rw));
    const ry = 5 + Math.floor(lcg(seed) * (H - 10 - rh));
    const overlaps = rooms.some(r =>
      rx < r.x + r.w + 2 && rx + rw + 2 > r.x &&
      ry < r.y + r.h + 2 && ry + rh + 2 > r.y
    );
    if (!overlaps) rooms.push({ x: rx, y: ry, w: rw, h: rh });
  }
  rooms.push({ x: 43, y: 43, w: 14, h: 14 });

  const numWalls = 20 + Math.floor(lcg(seed) * 20);
  for (let i = 0; i < numWalls; i++) {
    const wx = 5 + Math.floor(lcg(seed) * (W - 10));
    const wy = 5 + Math.floor(lcg(seed) * (H - 10));
    const wtype = lcg(seed) < 0.35 ? TileType.SAND_WALL : lcg(seed) < 0.6 ? TileType.WALL : TileType.MOUNTAIN;
    const ww = lcg(seed) < 0.5 ? 1 : 2;
    const wh = ww === 1 ? (lcg(seed) < 0.5 ? 1 : 2) : 1;
    const inRoom = rooms.some(r =>
      wx < r.x + r.w && wx + ww > r.x && wy < r.y + r.h && wy + wh > r.y
    );
    if (!inRoom) {
      for (let xx = 0; xx < ww; xx++) {
        for (let yy = 0; yy < wh; yy++) {
          if (getTile(grid, wx + xx, wy + yy) === TileType.GRASS) {
            setTile(grid, wx + xx, wy + yy, wtype);
          }
        }
      }
    }
  }

  const numBushClusters = 12 + Math.floor(lcg(seed) * 18);
  for (let i = 0; i < numBushClusters; i++) {
    const bx = 5 + Math.floor(lcg(seed) * (W - 10));
    const by = 5 + Math.floor(lcg(seed) * (H - 10));
    const br = 2 + Math.floor(lcg(seed) * 3);
    for (let dx = -br; dx <= br; dx++) {
      for (let dy = -br; dy <= br; dy++) {
        if (dx * dx + dy * dy <= br * br && getTile(grid, bx + dx, by + dy) === TileType.GRASS) {
          setTile(grid, bx + dx, by + dy, TileType.BUSH);
        }
      }
    }
  }

  const numRivers = 1 + Math.floor(lcg(seed) * 2);
  for (let i = 0; i < numRivers; i++) {
    const horizontal = lcg(seed) < 0.5;
    let cx = 5 + Math.floor(lcg(seed) * (W - 10));
    let cy = 5 + Math.floor(lcg(seed) * (H - 10));
    const steps = horizontal ? W - 6 : H - 6;
    for (let s = 0; s < steps; s++) {
      const t = getTile(grid, cx, cy);
      if (t === TileType.GRASS || t === TileType.BUSH) {
        setTile(grid, cx, cy, TileType.WATER);
        const px = cx + (horizontal ? 0 : 1);
        const py = cy + (horizontal ? 1 : 0);
        const t2 = getTile(grid, px, py);
        if (t2 === TileType.GRASS || t2 === TileType.BUSH) setTile(grid, px, py, TileType.WATER);
      }
      if (horizontal) cx++; else cy++;
      if (lcg(seed) < 0.25) {
        if (horizontal) cy += lcg(seed) < 0.5 ? 1 : -1;
        else cx += lcg(seed) < 0.5 ? 1 : -1;
      }
      cx = Math.max(3, Math.min(W - 4, cx));
      cy = Math.max(3, Math.min(H - 4, cy));
    }
  }

  const numTrees = 12 + Math.floor(lcg(seed) * 18);
  for (let i = 0; i < numTrees; i++) {
    const tx = 4 + Math.floor(lcg(seed) * (W - 8));
    const ty = 4 + Math.floor(lcg(seed) * (H - 8));
    if (getTile(grid, tx, ty) === TileType.GRASS) setTile(grid, tx, ty, TileType.TREE);
  }

  const numCacti = 8 + Math.floor(lcg(seed) * 12);
  for (let i = 0; i < numCacti; i++) {
    const tx = 4 + Math.floor(lcg(seed) * (W - 8));
    const ty = 4 + Math.floor(lcg(seed) * (H - 8));
    if (getTile(grid, tx, ty) === TileType.GRASS) setTile(grid, tx, ty, TileType.CACTUS);
  }

  const numDecorations = 18 + Math.floor(lcg(seed) * 22);
  for (let i = 0; i < numDecorations; i++) {
    const tx = 4 + Math.floor(lcg(seed) * (W - 8));
    const ty = 4 + Math.floor(lcg(seed) * (H - 8));
    if (getTile(grid, tx, ty) === TileType.GRASS) {
      setTile(grid, tx, ty, lcg(seed) < 0.5 ? TileType.DECORATION : TileType.WOOD);
    }
  }

  const numFenceLines = 6 + Math.floor(lcg(seed) * 8);
  for (let i = 0; i < numFenceLines; i++) {
    const fx = 5 + Math.floor(lcg(seed) * (W - 10));
    const fy = 5 + Math.floor(lcg(seed) * (H - 10));
    const flen = 2 + Math.floor(lcg(seed) * 5);
    const horiz = lcg(seed) < 0.5;
    for (let j = 0; j < flen; j++) {
      const tx = fx + (horiz ? j : 0);
      const ty = fy + (horiz ? 0 : j);
      if (getTile(grid, tx, ty) === TileType.GRASS) setTile(grid, tx, ty, TileType.FENCE);
    }
  }

  const numHeal = 3 + Math.floor(lcg(seed) * 3);
  for (let i = 0; i < numHeal; i++) {
    const tx = 10 + Math.floor(lcg(seed) * (W - 20));
    const ty = 10 + Math.floor(lcg(seed) * (H - 20));
    if (getTile(grid, tx, ty) === TileType.GRASS) setTile(grid, tx, ty, TileType.HEAL);
  }

  for (let dx = -7; dx <= 7; dx++) {
    for (let dy = -7; dy <= 7; dy++) {
      const tx = 50 + dx, ty = 50 + dy;
      const t = getTile(grid, tx, ty);
      if (t !== TileType.GRASS && t !== TileType.HEAL && t !== TileType.BUSH) {
        setTile(grid, tx, ty, TileType.GRASS);
      }
    }
  }

  return grid;
}
