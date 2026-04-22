import { Brawler } from "../entities/Brawler";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, pickBotStats } from "../entities/BrawlerData";
import { createShowdownMap, GameMap, Crate } from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
import { renderMap } from "../game/MapRenderer";
import { angleTo, autoAimAngle, distance, randomInt } from "../utils/helpers";
import { recordGameResult, getCurrentUsername } from "../utils/localStorageAPI";

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
    this.map = createShowdownMap();
    this.spriteLoaded = spriteLoaded;
    
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];

    // Spawn the player and 7 bots at 8 random positions evenly spread around
    // the map perimeter, just like a real Showdown match. The player gets a
    // random one of those slots — no longer always at dead center.
    const spawnPadding = 350;
    const usedPositions: Array<{ x: number; y: number }> = [];
    const totalSlots = 8;
    const slotOffset = Math.random() * Math.PI * 2;
    const allPositions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < totalSlots; i++) {
      let sx = 0, sy = 0;
      let attempts = 0;
      do {
        const angle = (i / totalSlots) * Math.PI * 2 + slotOffset + (Math.random() - 0.5) * 0.4;
        const ringDist = 1500 + Math.random() * 700;
        sx = Math.round(2500 + Math.cos(angle) * ringDist);
        sy = Math.round(2500 + Math.sin(angle) * ringDist);
        sx = Math.max(300, Math.min(this.map.width - 300, sx));
        sy = Math.max(300, Math.min(this.map.height - 300, sy));
        attempts++;
      } while (
        usedPositions.some(p => Math.abs(p.x - sx) < spawnPadding && Math.abs(p.y - sy) < spawnPadding) &&
        attempts < 50
      );
      usedPositions.push({ x: sx, y: sy });
      allPositions.push({ x: sx, y: sy });
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
      centerX: 2500,
      centerY: 2500,
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
        } else if (bot.forcedTarget) {
          // Clear the forced target only if it was a gas-flee target (no crystal mode here)
          bot.forcedTarget = undefined;
        }
        bot.update(dt, this.map);
        bot.updateAI(dt, allBrawlers, this.map, this.projectiles);
      }
      if (wasAlive && !bot.alive) {
        // Drop power cubes equal to (bot's cubes + 1)
        const cubeCount = bot.powerCubes + 1;
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
    
    updateProjectiles(this.projectiles, dt, this.map);
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
        b.takeDamage(60 * this.gas.damageMultiplier * dt, null);
      }
    }
    
    this.handleCrateHits(allBrawlers);
    this.handleDropPickups();
    
    updateDamageNumbers(dt);
    updateEffects(dt, [this.player, ...this.bots]);

    if (!this.player.alive) {
      // Drop the player's stash of power cubes (+1) where they fell, just like bots do.
      if (!this.playerDropsSpawned) {
        const cubeCount = this.player.powerCubes + 1;
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
      this.over = true;
      this.won = false;
      if (!this.resultRecorded) {
        const aliveBots = this.bots.filter(b => b.alive).length;
        const place = 1 + aliveBots;
        recordGameResult({ won: false, mode: "showdown", place, totalPlayers: 8 });
        this.resultRecorded = true;
      }
    }

    const aliveEnemies = this.bots.filter(b => b.alive);
    if (aliveEnemies.length === 0 && this.player.alive) {
      this.over = true;
      this.won = true;
      if (!this.resultRecorded) {
        recordGameResult({ won: true, mode: "showdown", place: 1, totalPlayers: 8 });
        this.resultRecorded = true;
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
          
          if (proj.slow) b.addStatus("slow", 1, 0.3);
          if (proj.poison) b.addStatus("poison", 3, 100);
          
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
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const d = distance(this.player.x, this.player.y, drop.x, drop.y);
      if (d < drop.radius + this.player.radius) {
        if (drop.type === "health") {
          this.player.heal(300);
        } else if (drop.type === "powerup") {
          this.player.collectPowerCube();
        }
        this.drops.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, 1200, 800);
    
    renderMap(ctx, this.map, this.camera.x, this.camera.y, 1200, 800, this.frame);
    
    this.renderDrops(ctx);
    this.renderGas(ctx);
    
    const allBrawlers = [this.player, ...this.bots];
    const friendlies = [{ x: this.player.x, y: this.player.y }];
    for (const b of allBrawlers) {
      b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, friendlies);
    }
    
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    
    this.renderHUD(ctx);
  }

  private renderDrops(ctx: CanvasRenderingContext2D): void {
    for (const drop of this.drops) {
      const sx = drop.x - this.camera.x;
      const sy = drop.y - this.camera.y;
      ctx.save();
      let label = "$";
      if (drop.type === "health") {
        ctx.fillStyle = "#4CAF50";
        ctx.shadowColor = "#4CAF50";
        label = "+";
      } else if (drop.type === "powerup") {
        ctx.fillStyle = "#9C27B0";
        ctx.shadowColor = "#E040FB";
        label = "◆";
      } else {
        ctx.fillStyle = "#FFD700";
        ctx.shadowColor = "#FFD700";
      }
      ctx.shadowBlur = drop.type === "powerup" ? 18 : 10;
      ctx.beginPath();
      ctx.arc(sx, sy, drop.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = `bold ${drop.radius}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, sx, sy);
      ctx.restore();
    }
  }

  private renderGas(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const gsx = this.gas.centerX - this.camera.x;
    const gsy = this.gas.centerY - this.camera.y;
    
    ctx.beginPath();
    ctx.rect(0, 0, 1200, 800);
    ctx.arc(gsx, gsy, this.gas.safeRadius, 0, Math.PI * 2, true);
    ctx.fillStyle = "rgba(0, 200, 0, 0.15)";
    ctx.fill();
    
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
    
    const aliveCount = this.bots.filter(b => b.alive).length;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(1050, 10, 140, 40);
    ctx.fillStyle = "#FF5252";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`Враги: ${aliveCount}`, 1185, 36);
    
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
