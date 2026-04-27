// ── Admin authentication ──────────────────────────────────────────────────────
const ADMIN_KEY      = "clash_admin_unlocked";
const MAPS_KEY       = "clash_editor_maps";
const PUB_PREFIX     = "clash_published_map_";

const ADMIN_LOGIN    = "ripmyself";
const ADMIN_PASSWORD = "sempay666";

export function isAdminUnlocked(): boolean {
  return localStorage.getItem(ADMIN_KEY) === "true";
}

export function tryAdminLogin(login: string, password: string): boolean {
  if (login.trim() === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    localStorage.setItem(ADMIN_KEY, "true");
    return true;
  }
  return false;
}

export function lockAdmin(): void {
  localStorage.removeItem(ADMIN_KEY);
}

// ── Map data ──────────────────────────────────────────────────────────────────
export type EditorMode = "showdown" | "gemgrab" | "heist" | "bounty" | "brawlball" | "siege";

export const EDITOR_MODES: { id: EditorMode; label: string; icon: string }[] = [
  { id: "showdown",  label: "Столкновение",         icon: "💀" },
  { id: "gemgrab",   label: "Ограбление кристаллов", icon: "💎" },
  { id: "heist",     label: "Ограбление",            icon: "💰" },
  { id: "bounty",    label: "Охота за головами",     icon: "⭐" },
  { id: "brawlball", label: "Футбол",                icon: "⚽" },
  { id: "siege",     label: "Осада",                 icon: "🏰" },
];

export interface MapSave {
  id: string;
  name: string;
  mode: EditorMode;
  cells: number[];      // GRID_SIZE × GRID_SIZE flat, value = TileType
  overlays: number[];   // same size, value = OverlayType (0 = none)
  rotations?: number[]; // same size, per-cell LINE_TILE direction (0 = H, 1 = V)
  createdAt: number;
  updatedAt: number;
}

export function getSavedMaps(): MapSave[] {
  try { return JSON.parse(localStorage.getItem(MAPS_KEY) ?? "[]"); }
  catch { return []; }
}

export function upsertMap(map: MapSave): void {
  const all = getSavedMaps();
  const idx = all.findIndex(m => m.id === map.id);
  if (idx >= 0) all[idx] = map; else all.push(map);
  localStorage.setItem(MAPS_KEY, JSON.stringify(all));
}

export function deleteMapById(id: string): void {
  localStorage.setItem(MAPS_KEY, JSON.stringify(getSavedMaps().filter(m => m.id !== id)));
}

export function getPublishedMap(mode: EditorMode): MapSave | null {
  try {
    const raw = localStorage.getItem(PUB_PREFIX + mode);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function publishMap(map: MapSave): void {
  localStorage.setItem(PUB_PREFIX + map.mode, JSON.stringify(map));
}

export function unpublishMap(mode: EditorMode): void {
  localStorage.removeItem(PUB_PREFIX + mode);
}

// ── Overlay types (special game markers placed on top of tiles) ───────────────
export const OV = {
  NONE:        0,
  SPAWN_BLUE:  1,
  SPAWN_RED:   2,
  SPAWN_SD:    3,
  GEM_CENTER:  4,
  SAFE_BLUE:   5,
  SAFE_RED:    6,
  BASE_BLUE:   7,
  BASE_RED:    8,
  GOAL_BLUE:   9,
  GOAL_RED:    10,
  POWER_BOX:   11,
} as const;
export type OVType = typeof OV[keyof typeof OV];

// ── Validation ────────────────────────────────────────────────────────────────
const GS = 60; // grid size

function tile(cells: number[], x: number, y: number): number {
  if (x < 0 || y < 0 || x >= GS || y >= GS) return -1;
  return cells[y * GS + x];
}

function overlay(ovs: number[], x: number, y: number): number {
  if (x < 0 || y < 0 || x >= GS || y >= GS) return 0;
  return ovs[y * GS + x];
}

function isWalkable(t: number): boolean {
  // GRASS=0, BUSH=3, HEAL=7, WATER=4 (slow), plus any overlay-only cell
  return t === 0 || t === 3 || t === 7 || t === 4;
}

function bfsConnected(cells: number[], starts: [number, number][]): boolean {
  if (starts.length < 2) return true;
  const visited = new Uint8Array(GS * GS);
  const queue: [number, number][] = [starts[0]];
  visited[starts[0][1] * GS + starts[0][0]] = 1;
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GS || ny >= GS) continue;
      if (visited[ny * GS + nx]) continue;
      if (!isWalkable(tile(cells, nx, ny))) continue;
      visited[ny * GS + nx] = 1;
      queue.push([nx, ny]);
    }
  }
  for (const [sx, sy] of starts.slice(1)) {
    if (!visited[sy * GS + sx]) return false;
  }
  return true;
}

export interface ValidationResult { ok: boolean; errors: string[] }

export function validateMap(cells: number[], ovs: number[], mode: EditorMode): ValidationResult {
  const errors: string[] = [];

  const spawnsSD: [number,number][] = [];
  const spawnBlue: [number,number][] = [];
  const spawnRed: [number,number][] = [];
  const gemCenters: [number,number][] = [];
  const safesBlue: [number,number][] = [];
  const safesRed: [number,number][] = [];
  const basesBlue: [number,number][] = [];
  const basesRed: [number,number][] = [];

  for (let y = 0; y < GS; y++) {
    for (let x = 0; x < GS; x++) {
      switch (overlay(ovs, x, y)) {
        case OV.SPAWN_SD:    spawnsSD.push([x,y]);    break;
        case OV.SPAWN_BLUE:  spawnBlue.push([x,y]);   break;
        case OV.SPAWN_RED:   spawnRed.push([x,y]);    break;
        case OV.GEM_CENTER:  gemCenters.push([x,y]);  break;
        case OV.SAFE_BLUE:   safesBlue.push([x,y]);   break;
        case OV.SAFE_RED:    safesRed.push([x,y]);    break;
        case OV.BASE_BLUE:   basesBlue.push([x,y]);   break;
        case OV.BASE_RED:    basesRed.push([x,y]);    break;
      }
    }
  }

  if (mode === "showdown") {
    if (spawnsSD.length < 6) errors.push(`Нужно минимум 6 спавн-точек (сейчас: ${spawnsSD.length})`);
    if (spawnsSD.length > 10) errors.push(`Максимум 10 спавн-точек (сейчас: ${spawnsSD.length})`);
    for (let i = 0; i < spawnsSD.length; i++) {
      for (let j = i + 1; j < spawnsSD.length; j++) {
        const dx = Math.abs(spawnsSD[i][0] - spawnsSD[j][0]);
        const dy = Math.abs(spawnsSD[i][1] - spawnsSD[j][1]);
        if (Math.sqrt(dx*dx+dy*dy) < 3) {
          errors.push("Спавн-точки слишком близко друг к другу (минимум 3 клетки)");
          break;
        }
      }
      if (errors.length > 5) break;
    }
    if (!bfsConnected(cells, spawnsSD)) errors.push("Карта не связна — не все спавн-точки достижимы");
  }

  if (mode === "gemgrab") {
    if (gemCenters.length === 0) errors.push("Нужен маркер центра кристаллов");
    const [cx, cy] = gemCenters[0] ?? [30, 30];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const t = tile(cells, cx + dx, cy + dy);
        if (t !== 0 && t !== 3 && t !== 7) {
          errors.push("Зона 5×5 вокруг центра кристаллов не должна содержать непроходимые блоки");
          break;
        }
      }
      if (errors.length > 5) break;
    }
    if (spawnBlue.length === 0) errors.push("Нужна синяя спавн-точка");
    if (spawnRed.length === 0) errors.push("Нужна красная спавн-точка");
  }

  if (mode === "heist") {
    if (safesBlue.length === 0) errors.push("Нужен синий сейф");
    if (safesRed.length === 0) errors.push("Нужен красный сейф");
    safesBlue.forEach(([x,y]) => {
      if (x < 5 || x >= GS-5 || y < 5 || y >= GS-5) errors.push("Сейф слишком близко к краю (мин. 5 клеток)");
      if (x >= GS/2) errors.push("Синий сейф должен быть на левой половине карты");
    });
    safesRed.forEach(([x,y]) => {
      if (x < 5 || x >= GS-5 || y < 5 || y >= GS-5) errors.push("Сейф слишком близко к краю");
      if (x < GS/2) errors.push("Красный сейф должен быть на правой половине карты");
    });
    if (spawnBlue.length === 0) errors.push("Нужна синяя спавн-точка");
    if (spawnRed.length === 0) errors.push("Нужна красная спавн-точка");
  }

  if (mode === "siege") {
    if (basesBlue.length === 0) errors.push("Нужна синяя база");
    if (basesRed.length === 0) errors.push("Нужна красная база");
    basesBlue.forEach(([x]) => { if (x >= GS/2) errors.push("Синяя база должна быть на левой половине"); });
    basesRed.forEach(([x]) => { if (x < GS/2)  errors.push("Красная база должна быть на правой половине"); });
    if (spawnBlue.length === 0) errors.push("Нужна синяя спавн-точка");
    if (spawnRed.length === 0) errors.push("Нужна красная спавн-точка");
  }

  if (mode === "bounty" || mode === "brawlball") {
    if (spawnBlue.length === 0) errors.push("Нужна синяя спавн-точка");
    if (spawnRed.length === 0) errors.push("Нужна красная спавн-точка");
  }

  return { ok: errors.length === 0, errors };
}

// ── Random map generation ─────────────────────────────────────────────────────
export function generateRandomMap(mode: EditorMode): { cells: number[]; overlays: number[] } {
  const cells = new Array<number>(GS * GS).fill(0);
  const ovs   = new Array<number>(GS * GS).fill(0);

  const rand = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
  const set  = (x: number, y: number, t: number) => { if (x>=0&&y>=0&&x<GS&&y<GS) cells[y*GS+x] = t; };
  const setOv = (x: number, y: number, v: number) => { if (x>=0&&y>=0&&x<GS&&y<GS) ovs[y*GS+x] = v; };

  // Scatter random blocks
  const BLOCK_TYPES = [1,1,2,2,3,3,4,5,6,9,10,11,12];
  for (let i = 0; i < 400; i++) {
    const x = rand(1, GS-2), y = rand(1, GS-2);
    const t = BLOCK_TYPES[rand(0, BLOCK_TYPES.length - 1)];
    const size = rand(1, 3);
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) set(x+dx, y+dy, t);
  }

  // Clear center area
  const cx = 30, cy = 30;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) set(cx+dx, cy+dy, 0);

  // Place mode-specific overlays
  if (mode === "showdown") {
    const spots: [number,number][] = [
      [5,5],[55,5],[5,55],[55,55],[30,5],[30,55],[5,30],[55,30]
    ];
    const count = rand(6, 8);
    for (let i = 0; i < count; i++) {
      const [x,y] = spots[i];
      set(x,y,0); setOv(x,y,OV.SPAWN_SD);
    }
  } else {
    // Team modes: spawns on left/right halves
    const bl: [number,number][] = [[5,28],[5,30],[5,32]];
    const rl: [number,number][] = [[55,28],[55,30],[55,32]];
    bl.forEach(([x,y]) => { set(x,y,0); setOv(x,y,OV.SPAWN_BLUE); });
    rl.forEach(([x,y]) => { set(x,y,0); setOv(x,y,OV.SPAWN_RED); });

    if (mode === "gemgrab") { set(cx,cy,0); setOv(cx,cy,OV.GEM_CENTER); }
    if (mode === "heist")   { set(8,30,0); setOv(8,30,OV.SAFE_BLUE); set(52,30,0); setOv(52,30,OV.SAFE_RED); }
    if (mode === "siege")   { set(6,30,0); setOv(6,30,OV.BASE_BLUE); set(54,30,0); setOv(54,30,OV.BASE_RED); }
    if (mode === "brawlball"){ set(cx,10,0); setOv(cx,10,OV.GOAL_BLUE); set(cx,50,0); setOv(cx,50,OV.GOAL_RED); }
  }

  return { cells: Array.from(cells), overlays: Array.from(ovs) };
}
