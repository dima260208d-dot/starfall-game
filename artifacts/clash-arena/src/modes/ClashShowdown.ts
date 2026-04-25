import { Brawler } from "../entities/Brawler";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, pickBotStats } from "../entities/BrawlerData";
import { createShowdownMap, GameMap, Crate, renderTileGrid } from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
import { renderMap } from "../game/MapRenderer";
import { angleTo, autoAimAngle, distance, randomInt } from "../utils/helpers";
import { recordGameResult, getCurrentUsername } from "../utils/localStorageAPI";
import {
  TileGrid, TILE_CELL_SIZE, generateShowdownTileGrid,
  collidesWithTileGrid, projectileBlockedByTile,
  getTileHealRate, isTileInBush,
  destroyTile, nearestGrassTile,
} from "../game/TileMap";
import { getPublishedMap, OV } from "../utils/mapEditorAPI";

export interface DropItem {
  x: number;
  y: number;
  type: "health" | "coins" | "powerup";
  radius: number;
}

export interface GasZone {
  centerX: number;
  centerY: number;
  safeRadius: number;
  timer: number;
  damageMultiplier: number;
}

export class ClashShowdown {
  map: GameMap;
  tileGrid: TileGrid;
  player: Brawler;
  bots: Bot[] = [];
  projectiles: Projectile[] = [];
  drops: DropItem[] = [];
  camera: Camera;
  input: InputHandler;
  
  gas: GasZone;
  gasDoubleTimer = 30;
  
  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;
  
  private resultRecorded = false;
  private playerDropsSpawned = false;

  constructor(
    canvas: HTMLCanvasElement,
    playerBrawlerId: string,
    playerLevel: number,
    onAttack: () => void,
    onSuper: () => void,
    spriteLoaded: boolean
  ) {
    this.tileGrid = generateShowdownTileGrid();
    this.map = createShowdownMap();
    this.map.tileGrid = this.tileGrid;
    this.spriteLoaded = spriteLoaded;

    // ── Load published map if one exists ──────────────────────────────────
    const pubMap = getPublishedMap("showdown");
    if (pubMap && pubMap.cells && pubMap.cells.length === 60 * 60) {
      for (let i = 0; i < pubMap.cells.length; i++) {
        this.tileGrid.cells[i] = pubMap.cells[i];
      }
      this.map.name = pubMap.name;
    }

    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];

    // ── Collect spawn positions from SPAWN_SD overlays (published map) ────
    let overlaySpawns: Array<{ x: number; y: number }> = [];
    if (pubMap && pubMap.overlays && pubMap.overlays.length === 60 * 60) {
      for (let i = 0; i < pubMap.overlays.length; i++) {
        if (pubMap.overlays[i] === OV.SPAWN_SD) {
          const tx = i % 60;
          const ty = Math.floor(i / 60);
          overlaySpawns.push({ x: (tx + 0.5) * TILE_CELL_SIZE, y: (ty + 0.5) * TILE_CELL_SIZE });
        }
      }
      // Shuffle so every game picks a random subset of spawn points
      overlaySpawns = overlaySpawns.sort(() => Math.random() - 0.5);
    }

    const totalSlots = 10;
    const allPositions: Array<{ x: number; y: number }> = [];

    if (overlaySpawns.length >= 2) {
      // Use map-defined spawn points, cycling if there are fewer than 10
      for (let i = 0; i < totalSlots; i++) {
        allPositions.push(overlaySpawns[i % overlaySpawns.length]);
      }
    } else {
      // Procedural fallback: ring of positions around the centre
      const spawnPadding = 350;
      const usedPositions: Array<{ x: number; y: number }> = [];
      const slotOffset = Math.random() * Math.PI * 2;
      for (let i = 0; i < totalSlots; i++) {
        let sx = 0, sy = 0;
        let attempts = 0;
        do {
          const angle = (i / totalSlots) * Math.PI * 2 + slotOffset + (Math.random() - 0.5) * 0.4;
          const ringDist = 700 + Math.random() * 400;
          sx = Math.round(1500 + Math.cos(angle) * ringDist);
          sy = Math.round(1500 + Math.sin(angle) * ringDist);
          sx = Math.max(200, Math.min(this.map.width - 200, sx));
          sy = Math.max(200, Math.min(this.map.height - 200, sy));
          attempts++;
        } while (
          usedPositions.some(p => Math.abs(p.x - sx) < spawnPadding && Math.abs(p.y - sy) < spawnPadding) &&
          attempts < 50
        );
        const snapped = nearestGrassTile(this.tileGrid, sx, sy);
        sx = snapped.x; sy = snapped.y;
        usedPositions.push({ x: sx, y: sy });
        allPositions.push({ x: sx, y: sy });
      }
    }

    // Pick a random slot for the player; the rest go to bots.
    const playerSlot = randomInt(0, totalSlots - 1);
    const playerSpawn = allPositions[playerSlot];
    this.player = new Brawler(playerStats, playerLevel, playerSpawn.x, playerSpawn.y, "ffa-player", true);
    this.player.setIdentity(getCurrentUsername() ?? "Игрок", false);

    const botPicks = pickBotStats(playerBrawlerId, totalSlots - 1);
    let botIdx = 0;
    for (let i = 0; i < totalSlots; i++) {
      if (i === playerSlot) continue;
      const botStats = botPicks[botIdx];
      const level = randomInt(1, 5);
      const pos = allPositions[i];
      this.bots.push(new Bot(botStats, level, pos.x, pos.y, `ffa-${botIdx}`));
      botIdx++;
    }
    
    this.gas = {
      centerX: 1500,
      centerY: 1500,
      safeRadius: 2000,
      timer: 0,
      damageMultiplier: 1,
    };
    
    this.camera = new Camera(1200, 800, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const mouseAngle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
    const angle = this.input.attackJoystick.active ? mouseAngle : autoAimAngle(this.player, this.bots, mouseAngle);
    this.player.angle = angle;
    
    const isMelee = ["goro", "ronin", "taro"].includes(this.player.stats.id);
    if (isMelee) {
      const allBrawlers = [this.player, ...this.bots];
      this.player.meleeAttack(allBrawlers);
    } else {
      const projs = this.player.shoot(angle);
      this.projectiles.push(...projs);
    }
  }

  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const allBrawlers = [this.player, ...this.bots];
    // Auto-aim the super at the closest enemy in range so it never fires
    // straight into a wall when the player just slams the button.
    const mouseAngle = angleTo(
      this.player.x, this.player.y,
      this.input.state.mouseWorldX, this.input.state.mouseWorldY,
    );
    this.player.angle = this.input.superJoystick.active ? mouseAngle : autoAimAngle(this.player, this.bots, mouseAngle);
    this.player.activateSuper(allBrawlers, this.map, this.projectiles, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
  }

  update(dt: number): void {
    if (this.over) return;
    
    this.frame++;
    
    const { up, down, left, right } = this.input.state;
    let dx = 0, dy = 0;
    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;
    
    if (dx !== 0 || dy !== 0) {
      this.player.move(dx, dy, dt);
    }
    
    this.camera.follow(this.player.x, this.player.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, this.player.x, this.player.y);
    
    const mouseAngle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
    this.player.angle = mouseAngle;
    
    const allBrawlers = [this.player, ...this.bots];
    
    this.player.update(dt, this.map);
    // Tile-based collision correction
    {
      const tc = collidesWithTileGrid(this.player.x, this.player.y, this.player.radius, this.tileGrid);
      if (tc.collides) { this.player.x = tc.nx; this.player.y = tc.ny; }
    }
    // Heal platform
    {
      const healRate = getTileHealRate(this.player.x, this.player.y, this.tileGrid);
      if (healRate > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + healRate * dt);
    }
    // Bush detection via tile grid
    this.player.inBush = isTileInBush(this.player.x, this.player.y, this.tileGrid);
    
    for (const bot of this.bots) {
      const wasAlive = bot.alive;
      if (bot.alive) {
        // Gas-avoidance intelligence: flee inward if outside or near gas edge
        const dToCenter = distance(bot.x, bot.y, this.gas.centerX, this.gas.centerY);
        const safeBuffer = 200;
        if (dToCenter > this.gas.safeRadius - safeBuffer) {
          // Pick a point well inside the safe zone (not the exact center, spread bots out)
          const targetR = Math.max(0, this.gas.safeRadius - safeBuffer - 100);
          const angleFromCenter = Math.atan2(bot.y - this.gas.centerY, bot.x - this.gas.centerX);
          bot.forcedTarget = {
            x: this.gas.centerX + Math.cos(angleFromCenter) * targetR,
            y: this.gas.centerY + Math.sin(angleFromCenter) * targetR,
          };
        } else {
          // No gas threat — let the bot hunt power cubes when no enemy is in
          // sight. Bots head toward the nearest dropped powerup or, failing
          // that, the nearest unbroken crate (which yields cubes when smashed).
          let nearestEnemyDist = 9999;
          for (const other of allBrawlers) {
            if (!other.alive || other === bot) continue;
            const d = distance(bot.x, bot.y, other.x, other.y);
            if (d < nearestEnemyDist) nearestEnemyDist = d;
          }
          // Only seek cubes when not already busy fighting nearby
          if (nearestEnemyDist > 500) {
            let bestX = 0, bestY = 0, bestD = 1200;
            for (const drop of this.drops) {
              if (drop.type !== "powerup") continue;
              const d = distance(bot.x, bot.y, drop.x, drop.y);
              if (d < bestD) { bestD = d; bestX = drop.x; bestY = drop.y; }
            }
            if (bestD === 1200) {
              for (const crate of this.map.crates) {
                if (crate.destroyed) continue;
                const cx = crate.x + crate.w / 2;
                const cy = crate.y + crate.h / 2;
                const d = distance(bot.x, bot.y, cx, cy);
                // Stop short of the crate so the bot has room to shoot it.
                if (d < bestD) { bestD = d; bestX = cx; bestY = cy; }
              }
            }
            if (bestD < 1200) {
              bot.forcedTarget = { x: bestX, y: bestY };
            } else if (bot.forcedTarget) {
              bot.forcedTarget = undefined;
            }
          } else if (bot.forcedTarget) {
            bot.forcedTarget = undefined;
          }
        }
        bot.update(dt, this.map);
        const bc = collidesWithTileGrid(bot.x, bot.y, bot.radius, this.tileGrid);
        if (bc.collides) { bot.x = bc.nx; bot.y = bc.ny; }
        const bHeal = getTileHealRate(bot.x, bot.y, this.tileGrid);
        if (bHeal > 0) bot.hp = Math.min(bot.maxHp, bot.hp + bHeal * dt);
        bot.inBush = isTileInBush(bot.x, bot.y, this.tileGrid);
        bot.updateAI(dt, allBrawlers, this.map, this.projectiles, this.tileGrid);
      }
      if (wasAlive && !bot.alive) {
        // Drop the bot's stash of power cubes; if the bot had none, drop 1.
        const cubeCount = Math.max(1, bot.powerCubes);
        for (let i = 0; i < cubeCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 20 + Math.random() * 40;
          this.drops.push({
            x: bot.x + Math.cos(a) * r,
            y: bot.y + Math.sin(a) * r,
            type: "powerup",
            radius: 14,
          });
        }
      }
    }
    
    const homingTargets = allBrawlers
      .filter(b => b.alive)
      .map(b => ({ id: b.id, x: b.x, y: b.y, team: b.team }));
    updateProjectiles(this.projectiles, dt, this.map, homingTargets);
    this.handleTileHits();
    this.handleProjectileHits(allBrawlers);
    this.projectiles = this.projectiles.filter(p => p.active);
    
    this.gasDoubleTimer -= dt;
    
    if (this.gasDoubleTimer <= 0) {
      this.gas.damageMultiplier *= 2;
      this.gasDoubleTimer = 30;
    }
    
    // Continuous shrink, fixed center — never disappears
    if (this.gas.safeRadius > 150) {
      this.gas.safeRadius = Math.max(150, this.gas.safeRadius - 22 * dt);
    }
    
    for (const b of allBrawlers) {
      if (!b.alive) continue;
      const d = distance(b.x, b.y, this.gas.centerX, this.gas.centerY);
      if (d > this.gas.safeRadius) {
        b.takeDamage(270 * this.gas.damageMultiplier * dt, null);
      }
    }
    
    this.handleCrateHits(allBrawlers);
    this.handleDropPickups();
    
    updateDamageNumbers(dt);
    updateEffects(dt, [this.player, ...this.bots]);

    if (!this.player.alive) {
      // Drop the player's stash of power cubes (+1) where they fell, just like bots do.
      if (!this.playerDropsSpawned) {
        const cubeCount = Math.max(1, this.player.powerCubes);
        for (let i = 0; i < cubeCount; i++) {
          const a = Math.random() * Math.PI * 2;
          const r = 20 + Math.random() * 40;
          this.drops.push({
            x: this.player.x + Math.cos(a) * r,
            y: this.player.y + Math.sin(a) * r,
            type: "powerup",
            radius: 14,
          });
        }
        this.playerDropsSpawned = true;
      }
      const aliveBots = this.bots.filter(b => b.alive).length;
      const place = 1 + aliveBots;
      const isTopFour = place <= 4;
      this.over = true;
      this.won = isTopFour;
      if (!this.resultRecorded) {
        recordGameResult({ won: isTopFour, mode: "showdown", place, totalPlayers: 10 });
        this.resultRecorded = true;
      }
    }

    const aliveEnemies = this.bots.filter(b => b.alive);
    if (aliveEnemies.length === 0 && this.player.alive) {
      this.over = true;
      this.won = true;
      if (!this.resultRecorded) {
        recordGameResult({ won: true, mode: "showdown", place: 1, totalPlayers: 10 });
        this.resultRecorded = true;
      }
    }
  }

  private handleTileHits(): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      const { blocked, tx, ty } = projectileBlockedByTile(proj.x, proj.y, this.tileGrid);
      if (blocked) {
        destroyTile(this.tileGrid, tx, ty);
        if (!proj.piercing) proj.active = false;
      }
    }
  }

  private handleProjectileHits(allBrawlers: Brawler[]): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      
      for (const b of allBrawlers) {
        if (!b.alive) continue;
        if (b.id === proj.ownerId) continue;
        if (proj.hitIds.has(b.id)) continue;
        
        if (proj.ownerTeam === b.team) continue;
        
        const d = distance(proj.x, proj.y, b.x, b.y);
        if (d < proj.radius + b.radius) {
          const attacker = allBrawlers.find(bw => bw.id === proj.ownerId) || null;
          b.takeDamage(proj.damage, attacker);
          
          if (proj.slow) b.addStatus("slow", 1.5, 0.4);
          if (proj.poison) b.addStatus("poison", 3, 100);
          if (proj.stunDuration) b.addStatus("stun", proj.stunDuration, 0);
          if (proj.temporalRewind && b.posHistory.length >= 2) {
            // Rewind target to ~1s ago
            const pastIdx = Math.max(0, b.posHistory.length - 6); // ~1.2s ago at 200ms interval
            const pastPos = b.posHistory[pastIdx];
            b.x = Math.max(b.radius, Math.min(this.map.width - b.radius, pastPos.x));
            b.y = Math.max(b.radius, Math.min(this.map.height - b.radius, pastPos.y));
          }
          
          proj.hitIds.add(b.id);
          
          if (!proj.piercing) {
            proj.active = false;
            break;
          }
        }
      }
    }
  }

  private handleCrateHits(allBrawlers: Brawler[]): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      for (const crate of this.map.crates) {
        if (crate.destroyed) continue;
        if (
          proj.x > crate.x && proj.x < crate.x + crate.w &&
          proj.y > crate.y && proj.y < crate.y + crate.h
        ) {
          crate.hp--;
          if (!proj.piercing) proj.active = false;
          if (crate.hp <= 0) {
            crate.destroyed = true;
            const roll = Math.random();
            if (roll < 0.55) {
              this.drops.push({ x: crate.x + 20, y: crate.y + 20, type: "powerup", radius: 14 });
            } else if (roll < 0.85) {
              this.drops.push({ x: crate.x + 20, y: crate.y + 20, type: "health", radius: 15 });
            } else {
              this.drops.push({ x: crate.x + 20, y: crate.y + 20, type: "coins", radius: 12 });
            }
          }
          break;
        }
      }
    }
  }

  private handleDropPickups(): void {
    // Anyone alive — player or bot — can grab dropped items by walking over
    // them. This lets bots collect power cubes from crates or fallen rivals.
    const pickers: Brawler[] = [this.player, ...this.bots];
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      let claimed = false;
      for (const b of pickers) {
        if (!b.alive) continue;
        const d = distance(b.x, b.y, drop.x, drop.y);
        if (d < drop.radius + b.radius) {
          if (drop.type === "health") {
            b.heal(300);
          } else if (drop.type === "powerup") {
            b.collectPowerCube();
          }
          claimed = true;
          break;
        }
      }
      if (claimed) this.drops.splice(i, 1);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, 1200, 800);

    // ── 45° isometric view: compress Y axis by 0.65 for all world elements ──
    const ISO = 0.65;
    const ISO_SHIFT = 800 * (1 - ISO) * 0.28; // shift world up so bottom stays visible

    // ─── ISO layer: map tiles + drops + gas + projectiles + effects ───
    ctx.save();
    ctx.transform(1, 0, 0, ISO, 0, ISO_SHIFT);

    renderMap(ctx, this.map, this.camera.x, this.camera.y, 1200, 800 / ISO, this.frame);

    renderTileGrid(ctx, this.tileGrid, this.camera.x, this.camera.y, 1200, Math.ceil(800 / ISO),
      this.player.x, this.player.y, false);
    
    this.renderDrops(ctx);
    this.renderGas(ctx, ISO);
    
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);

    renderTileGrid(ctx, this.tileGrid, this.camera.x, this.camera.y, 1200, Math.ceil(800 / ISO),
      this.player.x, this.player.y, true);

    renderDamageNumbers(ctx, this.camera.x, this.camera.y);

    ctx.restore();

    // ─── Screen layer: brawlers rendered upright at iso-projected positions ───
    const allBrawlers = [this.player, ...this.bots];
    const friendlies = [{ x: this.player.x, y: this.player.y }];
    // Sort back-to-front so characters further north are drawn first (painter's algo)
    allBrawlers.sort((a, b) => a.y - b.y);
    for (const b of allBrawlers) {
      const projSY = (b.y - this.camera.y) * ISO + ISO_SHIFT;
      b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, friendlies, projSY);
    }

    // ── HUD rendered flat (no iso transform) ──
    this.renderHUD(ctx);
  }

  private renderDrops(ctx: CanvasRenderingContext2D): void {
    for (const drop of this.drops) {
      const sx = drop.x - this.camera.x;
      const sy = drop.y - this.camera.y;

      let color: string;
      let glowColor: string;
      let label: string;
      if (drop.type === "health") {
        color = "#4CAF50"; glowColor = "#4CAF50"; label = "+";
      } else if (drop.type === "powerup") {
        color = "#9C27B0"; glowColor = "#E040FB"; label = "◆";
      } else {
        color = "#FFD700"; glowColor = "#FFD700"; label = "$";
      }

      // Deterministic pseudo-random pile offsets based on drop position
      const seed = ((drop.x * 31 + drop.y * 17) | 0) & 0xffff;
      const r0 = drop.radius * 0.72;

      // Pile: 4 small circles staggered (back-to-front painter order)
      const pile = [
        { dx: (((seed * 23) % 9) - 4) * 0.36, dy: (((seed * 13) % 9) - 4) * 0.36, r: r0 * 0.78 },
        { dx: -(((seed * 7)  % 8) - 3) * 0.36, dy: (((seed * 19) % 8) - 3) * 0.36, r: r0 * 0.83 },
        { dx: (((seed * 17) % 7) - 3) * 0.36, dy: -(((seed * 11) % 7) - 2) * 0.36, r: r0 * 0.87 },
        { dx: 0, dy: 0, r: r0 },   // center / top piece
      ];

      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = drop.type === "powerup" ? 20 : 12;

      for (const piece of pile) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx + piece.dx, sy + piece.dy, piece.r, 0, Math.PI * 2);
        ctx.fill();
        // Specular highlight on each piece
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath();
        ctx.arc(sx + piece.dx - piece.r * 0.28, sy + piece.dy - piece.r * 0.28, piece.r * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }

      // Label on the topmost (center) piece
      ctx.shadowBlur = 0;
      ctx.fillStyle = "white";
      ctx.font = `bold ${Math.round(r0 * 0.9)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, sx, sy);
      ctx.restore();
    }
  }

  private renderGas(ctx: CanvasRenderingContext2D, iso: number): void {
    ctx.save();
    const gsx = this.gas.centerX - this.camera.x;
    const gsy = this.gas.centerY - this.camera.y;
    // Cover the full world-space canvas visible through the ISO transform
    const worldH = Math.ceil(800 / iso) + 400;

    ctx.beginPath();
    ctx.rect(-200, -200, 1600, worldH);
    ctx.arc(gsx, gsy, this.gas.safeRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = "rgba(0, 200, 0, 0.13)";
    ctx.fill("evenodd");
    
    ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.beginPath();
    ctx.arc(gsx, gsy, this.gas.safeRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(10, 10, 200, 70);
    
    ctx.drawImage(
      ctx.canvas,
      0, 0, 0, 0
    );
    
    ctx.fillStyle = "white";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(this.player.stats.name, 20, 30);
    
    const hpRatio = this.player.hp / this.player.maxHp;
    const r = Math.floor(255 * (1 - hpRatio));
    const g = Math.floor(255 * hpRatio);
    ctx.fillStyle = `rgb(${r},${g},0)`;
    ctx.fillRect(20, 38, 180 * hpRatio, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 38, 180, 10);
    
    ctx.fillStyle = this.player.superReady ? "#FFD700" : "#7986CB";
    ctx.fillRect(20, 52, 180 * (this.player.superCharge / this.player.maxSuperCharge), 8);
    ctx.strokeRect(20, 52, 180, 8);
    
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 11px Arial";
    ctx.fillText(this.player.superReady ? "СУПЕР ГОТОВ! [E]" : "Заряжаем супер...", 20, 73);
    
    // Enemy count shown in minimap panel — no separate top-right overlay needed
    
    // Ammo dots are now drawn above the brawler (under the HP bar) by Brawler.render().

    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("WASD: движение | ЛКМ: атака | ПКМ/E: супер", 600, 760);
    
    ctx.restore();
  }

  destroy(): void {
    this.input.destroy();
    clearDamageNumbers();
    clearEffects();
  }
}
