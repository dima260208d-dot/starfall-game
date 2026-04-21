import { Brawler } from "../entities/Brawler";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById } from "../entities/BrawlerData";
import { createCrystalsMap, GameMap } from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers } from "../utils/damageNumbers";
import { renderMap } from "../game/MapRenderer";
import { angleTo, distance, randomInt } from "../utils/helpers";
import { recordGameResult } from "../utils/localStorageAPI";

export interface Crystal {
  x: number;
  y: number;
  carrier: Brawler | null;
  dropped: boolean;
  dropTimer: number;
}

export class ClashCrystals {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  enemies: Bot[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;
  
  playerTeamCrystals = 0;
  enemyTeamCrystals = 0;
  crystals: Crystal[] = [];
  
  respawnTimers: Map<string, number> = new Map();
  
  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;
  
  private resultRecorded = false;
  private winScore = 10;

  constructor(
    canvas: HTMLCanvasElement,
    playerBrawlerId: string,
    playerLevel: number,
    onAttack: () => void,
    onSuper: () => void,
    spriteLoaded: boolean
  ) {
    this.map = createCrystalsMap();
    this.spriteLoaded = spriteLoaded;
    
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    this.player = new Brawler(playerStats, playerLevel, 600, 1750, "blue", true);
    
    const allStats = BRAWLERS.filter(b => b.id !== playerBrawlerId);
    
    this.allies.push(new Bot(allStats[0], randomInt(1, 4), 600, 1200, "blue"));
    this.allies.push(new Bot(allStats[1], randomInt(1, 4), 600, 2300, "blue"));
    
    this.enemies.push(new Bot(allStats[2], randomInt(1, 5), 2900, 1200, "red"));
    this.enemies.push(new Bot(allStats[3], randomInt(1, 5), 2900, 1750, "red"));
    this.enemies.push(new Bot(allStats[4], randomInt(1, 5), 2900, 2300, "red"));
    
    for (let i = 0; i < 5; i++) {
      this.crystals.push({
        x: 1300 + i * 200,
        y: 1600 + (i % 2 === 0 ? -100 : 100),
        carrier: null,
        dropped: false,
        dropTimer: 0,
      });
    }
    
    this.camera = new Camera(1200, 800, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const angle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
    this.player.angle = angle;
    
    const isMelee = ["goro", "ronin", "taro"].includes(this.player.stats.id);
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    
    if (isMelee) {
      this.player.meleeAttack(allBrawlers);
    } else {
      const projs = this.player.shoot(angle);
      this.projectiles.push(...projs);
    }
  }

  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    this.player.activateSuper(allBrawlers, this.map, this.projectiles);
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
    this.input.updateWorldMouse(this.camera.x, this.camera.y);
    
    const mouseAngle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
    this.player.angle = mouseAngle;
    
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    
    this.player.update(dt, this.map);
    
    for (const bot of [...this.allies, ...this.enemies]) {
      if (bot.alive) {
        const carriedCount = this.crystals.filter(c => c.carrier?.id === bot.id).length;
        if (carriedCount > 0) {
          const base = bot.team === "blue" ? { x: 300, y: 1750 } : { x: 3200, y: 1750 };
          bot.forcedTarget = base;
          bot.crystalTarget = undefined;
        } else {
          bot.forcedTarget = undefined;
          let nearestCrystal: Crystal | null = null;
          let nearestDist = 99999;
          for (const c of this.crystals) {
            if (c.carrier || c.dropped) continue;
            const d = distance(bot.x, bot.y, c.x, c.y);
            if (d < nearestDist) { nearestDist = d; nearestCrystal = c; }
          }
          if (nearestCrystal) {
            bot.crystalTarget = { x: nearestCrystal.x, y: nearestCrystal.y };
          } else {
            bot.crystalTarget = undefined;
          }
        }
        bot.update(dt, this.map);
        bot.updateAI(dt, allBrawlers, this.map, this.projectiles);
      }
    }
    
    updateProjectiles(this.projectiles, dt, this.map);
    this.handleProjectileHits(allBrawlers);
    this.projectiles = this.projectiles.filter(p => p.active);
    
    this.updateCrystals(dt, allBrawlers);
    
    for (const [id, timer] of this.respawnTimers) {
      this.respawnTimers.set(id, timer - dt);
      if (timer - dt <= 0) {
        this.respawnTimers.delete(id);
        const bot = [...this.allies, ...this.enemies].find(b => b.id === id);
        if (bot) {
          bot.alive = true;
          bot.hp = bot.maxHp;
          const spawnX = bot.team === "blue" ? randomInt(200, 800) : randomInt(2700, 3300);
          const spawnY = randomInt(1200, 2300);
          bot.x = spawnX;
          bot.y = spawnY;
        }
      }
    }
    
    for (const bot of [...this.allies, ...this.enemies]) {
      if (!bot.alive && !this.respawnTimers.has(bot.id)) {
        this.respawnTimers.set(bot.id, 5);
        const carried = this.crystals.find(c => c.carrier?.id === bot.id);
        if (carried) {
          carried.carrier = null;
          carried.dropped = true;
          carried.dropTimer = 10;
        }
      }
    }
    
    if (!this.player.alive) {
      this.over = true;
      this.won = false;
      if (!this.resultRecorded) {
        recordGameResult(false, "crystals");
        this.resultRecorded = true;
      }
    }
    
    if (this.playerTeamCrystals >= this.winScore) {
      this.over = true;
      this.won = true;
      if (!this.resultRecorded) {
        recordGameResult(true, "crystals");
        this.resultRecorded = true;
      }
    }
    
    if (this.enemyTeamCrystals >= this.winScore) {
      this.over = true;
      this.won = false;
      if (!this.resultRecorded) {
        recordGameResult(false, "crystals");
        this.resultRecorded = true;
      }
    }
    
    updateDamageNumbers(dt);
  }

  private updateCrystals(dt: number, allBrawlers: Brawler[]): void {
    for (const crystal of this.crystals) {
      if (crystal.dropped) {
        crystal.dropTimer -= dt;
        if (crystal.dropTimer <= 0) {
          crystal.dropped = false;
          crystal.x = 1300 + randomInt(0, 600);
          crystal.y = 1400 + randomInt(0, 400);
        }
        continue;
      }
      
      if (crystal.carrier) {
        crystal.x = crystal.carrier.x;
        crystal.y = crystal.carrier.y;
        
        if (!crystal.carrier.alive) {
          crystal.carrier = null;
          crystal.dropped = true;
          crystal.dropTimer = 10;
        }
        continue;
      }
      
      for (const b of allBrawlers) {
        if (!b.alive) continue;
        const d = distance(b.x, b.y, crystal.x, crystal.y);
        if (d < b.radius + 15) {
          crystal.carrier = b;
          break;
        }
      }
    }
    
    for (const b of allBrawlers) {
      if (!b.alive) continue;
      const carriedCount = this.crystals.filter(c => c.carrier?.id === b.id).length;
      if (carriedCount === 0) continue;
      
      if (b.team === "blue") {
        const d = distance(b.x, b.y, 300, 1750);
        if (d < 100) {
          this.playerTeamCrystals += carriedCount;
          this.crystals.filter(c => c.carrier?.id === b.id).forEach(c => {
            c.carrier = null;
            c.dropped = true;
            c.dropTimer = 5;
            c.x = 1300 + randomInt(0, 600);
            c.y = 1400 + randomInt(0, 400);
          });
        }
      } else {
        const d = distance(b.x, b.y, 3200, 1750);
        if (d < 100) {
          this.enemyTeamCrystals += carriedCount;
          this.crystals.filter(c => c.carrier?.id === b.id).forEach(c => {
            c.carrier = null;
            c.dropped = true;
            c.dropTimer = 5;
            c.x = 1300 + randomInt(0, 600);
            c.y = 1400 + randomInt(0, 400);
          });
        }
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
        
        const projOwner = allBrawlers.find(bw => bw.id === proj.ownerId);
        if (!projOwner) continue;
        const isEnemy = projOwner.team !== b.team;
        if (!isEnemy) continue;
        
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

  render(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, 1200, 800);
    
    renderMap(ctx, this.map, this.camera.x, this.camera.y, 1200, 800);
    
    this.renderGoalZones(ctx);
    this.renderCrystals(ctx);
    
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    const _friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    for (const b of allBrawlers) {
      b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, _friendlies);
    }
    
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    
    this.renderHUD(ctx);
  }

  private renderGoalZones(ctx: CanvasRenderingContext2D): void {
    const zones = [
      { x: 300, y: 1750, team: "blue" as const },
      { x: 3200, y: 1750, team: "red" as const },
    ];
    
    for (const zone of zones) {
      const sx = zone.x - this.camera.x;
      const sy = zone.y - this.camera.y;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = zone.team === "blue" ? "#2196F3" : "#F44336";
      ctx.beginPath();
      ctx.arc(sx, sy, 100, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = zone.team === "blue" ? "#64B5F6" : "#EF9A9A";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  private renderCrystals(ctx: CanvasRenderingContext2D): void {
    for (const crystal of this.crystals) {
      if (crystal.dropped) continue;
      if (crystal.carrier) continue;
      
      const sx = crystal.x - this.camera.x;
      const sy = crystal.y - this.camera.y;
      
      ctx.save();
      ctx.shadowColor = "#00BCD4";
      ctx.shadowBlur = 15;
      
      ctx.fillStyle = "#00E5FF";
      ctx.beginPath();
      ctx.moveTo(sx, sy - 15);
      ctx.lineTo(sx + 10, sy);
      ctx.lineTo(sx, sy + 15);
      ctx.lineTo(sx - 10, sy);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy - 8);
      ctx.lineTo(sx + 3, sy - 2);
      ctx.lineTo(sx - 1, sy + 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    
    for (const crystal of this.crystals) {
      if (!crystal.carrier) continue;
      
      const sx = crystal.x - this.camera.x;
      const sy = crystal.y - this.camera.y - 30;
      
      ctx.save();
      ctx.shadowColor = "#00BCD4";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#00E5FF";
      ctx.beginPath();
      ctx.moveTo(sx, sy - 10);
      ctx.lineTo(sx + 7, sy);
      ctx.lineTo(sx, sy + 10);
      ctx.lineTo(sx - 7, sy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(10, 10, 200, 70);
    
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
    
    ctx.fillStyle = this.player.superReady ? "#FFD700" : "rgba(255,255,255,0.5)";
    ctx.font = "bold 11px Arial";
    ctx.fillText(this.player.superReady ? "СУПЕР ГОТОВ! [E]" : "Заряжаем супер...", 20, 73);
    
    const scoreW = 220;
    const scoreX = (1200 - scoreW) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(scoreX, 5, scoreW, 50);
    
    ctx.fillStyle = "#2196F3";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${this.playerTeamCrystals}`, scoreX + 55, 38);
    
    ctx.fillStyle = "white";
    ctx.font = "bold 14px Arial";
    ctx.fillText(`/ ${this.winScore}`, scoreX + 85, 38);
    
    ctx.fillStyle = "#00E5FF";
    ctx.font = "18px Arial";
    ctx.fillText("💎", scoreX + 110, 38);
    
    ctx.fillStyle = "#F44336";
    ctx.font = "bold 22px Arial";
    ctx.fillText(`${this.enemyTeamCrystals}`, scoreX + 165, 38);
    
    ctx.fillStyle = "white";
    ctx.font = "11px Arial";
    ctx.fillText("СИНИЕ", scoreX + 45, 18);
    ctx.fillText("КРАСНЫЕ", scoreX + 170, 18);
    
    const charges = this.player.attackCharges;
    const maxCharges = this.player.maxAttackCharges;
    const chargeX = 600 - (maxCharges * 25) / 2;
    for (let i = 0; i < maxCharges; i++) {
      ctx.fillStyle = i < charges ? this.player.stats.accentColor : "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(chargeX + i * 30, 775, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "11px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Несите кристаллы на свою базу (синяя зона слева)!", 600, 760);
    
    ctx.restore();
  }

  destroy(): void {
    this.input.destroy();
    clearDamageNumbers();
  }
}
