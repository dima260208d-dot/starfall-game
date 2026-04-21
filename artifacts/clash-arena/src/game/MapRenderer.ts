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
    // Inner walls
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
    // Center pillars
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
  for (let i = 0; i < 40; i++) {
    crates.push(makeCrate(
      Math.random() * (W - 200) + 100,
      Math.random() * (H - 200) + 100
    ));
  }

  const rivers: River[] = [
    { x: 1500, y: 700, w: 500, h: 60 },
    { x: 1500, y: 2700, w: 500, h: 60 },
    { x: 200, y: 1500, w: 60, h: 500 },
    { x: 3200, y: 1500, w: 60, h: 500 },
  ];

  return { width: W, height: H, walls, bushes, crates, rivers, tileSize: 60, name: "Кристальная шахта" };
}

export function renderMap(ctx: CanvasRenderingContext2D, map: GameMap, camX: number, camY: number, canvasW: number, canvasH: number): void {
  const startTX = Math.floor(camX / map.tileSize);
  const endTX = Math.ceil((camX + canvasW) / map.tileSize);
  const startTY = Math.floor(camY / map.tileSize);
  const endTY = Math.ceil((camY + canvasH) / map.tileSize);

  const isShowdown = map.name === "Заброшенный храм";

  for (let tx = startTX; tx <= endTX; tx++) {
    for (let ty = startTY; ty <= endTY; ty++) {
      const wx = tx * map.tileSize;
      const wy = ty * map.tileSize;
      const sx = wx - camX;
      const sy = wy - camY;

      const isEdge = wx < 200 || wy < 200 || wx > map.width - 200 || wy > map.height - 200;
      const isCenter = Math.abs(wx - map.width / 2) < 400 && Math.abs(wy - map.height / 2) < 400;

      let tileColor: string;
      if (isEdge) {
        tileColor = isShowdown ? "#2D4A1E" : "#1A3A2A";
      } else if (isCenter) {
        tileColor = isShowdown ? "#B8965A" : "#4A3060";
      } else {
        const checker = (tx + ty) % 2;
        tileColor = isShowdown
          ? (checker ? "#8B7355" : "#9B8365")
          : (checker ? "#2D1B4E" : "#341F5A");
      }

      ctx.fillStyle = tileColor;
      ctx.fillRect(sx, sy, map.tileSize + 1, map.tileSize + 1);
    }
  }

  for (const river of map.rivers) {
    const sx = river.x - camX;
    const sy = river.y - camY;
    if (sx + river.w < 0 || sy + river.h < 0 || sx > canvasW || sy > canvasH) continue;

    const grad = ctx.createLinearGradient(sx, sy, sx + river.w, sy + river.h);
    grad.addColorStop(0, "#1565C0");
    grad.addColorStop(0.5, "#1976D2");
    grad.addColorStop(1, "#1565C0");
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, river.w, river.h);

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const waveY = sy + river.h * 0.3 + i * river.h * 0.2;
      ctx.beginPath();
      ctx.moveTo(sx, waveY);
      ctx.lineTo(sx + river.w, waveY);
      ctx.stroke();
    }
  }

  for (const bush of map.bushes) {
    const sx = bush.x - camX;
    const sy = bush.y - camY;
    if (sx + bush.radius < 0 || sy + bush.radius < 0 || sx - bush.radius > canvasW || sy - bush.radius > canvasH) continue;

    ctx.save();
    for (let i = 0; i < 3; i++) {
      const ox = (i - 1) * bush.radius * 0.4;
      ctx.beginPath();
      ctx.arc(sx + ox, sy, bush.radius * (0.7 + i * 0.1), 0, Math.PI * 2);
      ctx.fillStyle = i === 1 ? "#2E7D32" : "#388E3C";
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(sx, sy, bush.radius * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = "#43A047";
    ctx.fill();
    ctx.restore();
  }

  for (const crate of map.crates) {
    if (crate.destroyed) continue;
    const sx = crate.x - camX;
    const sy = crate.y - camY;
    if (sx + crate.w < 0 || sy + crate.h < 0 || sx > canvasW || sy > canvasH) continue;

    const hpRatio = crate.hp / crate.maxHp;
    const crateColor = hpRatio > 0.66 ? "#8D6E63" : hpRatio > 0.33 ? "#795548" : "#6D4C41";

    ctx.fillStyle = crateColor;
    ctx.fillRect(sx, sy, crate.w, crate.h);
    ctx.strokeStyle = "#5D4037";
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, sy, crate.w, crate.h);

    ctx.strokeStyle = "#A1887F";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + crate.w, sy + crate.h);
    ctx.moveTo(sx + crate.w, sy);
    ctx.lineTo(sx, sy + crate.h);
    ctx.stroke();

    if (hpRatio < 1) {
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 5, sy + 10);
      ctx.lineTo(sx + 15, sy + 5);
      ctx.stroke();
    }
  }

  for (const wall of map.walls) {
    const sx = wall.x - camX;
    const sy = wall.y - camY;
    if (sx + wall.w < 0 || sy + wall.h < 0 || sx > canvasW || sy > canvasH) continue;

    const grad = ctx.createLinearGradient(sx, sy, sx + wall.w, sy + wall.h);
    grad.addColorStop(0, isShowdown ? "#757575" : "#4A148C");
    grad.addColorStop(1, isShowdown ? "#616161" : "#6A1B9A");
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, wall.w, wall.h);

    ctx.strokeStyle = isShowdown ? "#9E9E9E" : "#7B1FA2";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, wall.w, wall.h);

    ctx.fillStyle = isShowdown ? "rgba(255,255,255,0.1)" : "rgba(150,100,255,0.1)";
    ctx.fillRect(sx, sy, wall.w * 0.4, wall.h * 0.3);
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
