import { Brawler } from "../entities/Brawler";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, pickBotStats } from "../entities/BrawlerData";
import { createCrystalsMap, GameMap, collidesWithWalls } from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers } from "../utils/damageNumbers";
import { renderMap } from "../game/MapRenderer";
import { angleTo, autoAimAngle, distance, randomInt } from "../utils/helpers";
import { recordGameResult } from "../utils/localStorageAPI";

export interface Crystal {
  x: number;
  y: number;
  carrier: Brawler | null;
  dropped: boolean;
  dropTimer: number;
  depositedTeam?: "blue" | "red"; // sits at base, can be stolen by enemies
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
  spawnTimer = 0;

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;
  
  private resultRecorded = false;
  private winScore = 10;
  private centerX = 1750;
  private centerY = 1750;
  private centerR = 250;
  private blueBase = { x: 300, y: 1750 };
  private redBase = { x: 3200, y: 1750 };

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
    
    const allStats = pickBotStats(playerBrawlerId, 5);

    this.allies.push(new Bot(allStats[0], randomInt(1, 4), 600, 1200, "blue"));
    this.allies.push(new Bot(allStats[1], randomInt(1, 4), 600, 2300, "blue"));

    this.enemies.push(new Bot(allStats[2], randomInt(1, 5), 2900, 1200, "red"));
    this.enemies.push(new Bot(allStats[3], randomInt(1, 5), 2900, 1750, "red"));
    this.enemies.push(new Bot(allStats[4], randomInt(1, 5), 2900, 2300, "red"));
    
    this.camera = new Camera(1200, 800, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const mouseAngle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
    const angle = autoAimAngle(this.player, this.enemies, mouseAngle);
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

    // Spawn one new crystal in the central circle every 10s (avoid walls)
    this.spawnTimer -= dt;
    const looseCount = this.crystals.filter(c => !c.carrier && !c.depositedTeam).length;
    if (this.spawnTimer <= 0 && looseCount < 12) {
      const pos = this.findValidCrystalPos();
      this.crystals.push({ x: pos.x, y: pos.y, carrier: null, dropped: false, dropTimer: 0 });
      this.spawnTimer = 10;
    }

    for (const bot of [...this.allies, ...this.enemies]) {
      if (bot.alive) {
        const carriedCount = this.crystals.filter(c => c.carrier?.id === bot.id).length;
        if (carriedCount > 0) {
          const base = bot.team === "blue" ? this.blueBase : this.redBase;
          bot.forcedTarget = base;
          bot.crystalTarget = undefined;
        } else {
          bot.forcedTarget = undefined;
          // Prefer stealing from enemy base if there are any deposited crystals there
          const enemyTeam = bot.team === "blue" ? "red" : "blue";
          const stealable = this.crystals.find(c => c.depositedTeam === enemyTeam && !c.carrier);
          let target: Crystal | null = stealable ?? null;
          if (!target) {
            let nd = 99999;
            for (const c of this.crystals) {
              if (c.carrier) continue;
              const d = distance(bot.x, bot.y, c.x, c.y);
              if (d < nd) { nd = d; target = c; }
            }
          }
          bot.crystalTarget = target ? { x: target.x, y: target.y } : undefined;
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
    
    if (this.playerTeamCrystals >= this.winScore || this.enemyTeamCrystals >= this.winScore) {
      // Deterministic resolution: higher score wins; if tied, player wins (defender's edge)
      const playerWins = this.playerTeamCrystals >= this.enemyTeamCrystals;
      this.over = true;
      this.won = playerWins;
      if (!this.resultRecorded) {
        recordGameResult(playerWins, "crystals");
        this.resultRecorded = true;
      }
    }
    
    updateDamageNumbers(dt);
  }

  private findValidCrystalPos(): { x: number; y: number } {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.centerR;
      const x = this.centerX + Math.cos(a) * r;
      const y = this.centerY + Math.sin(a) * r;
      if (!collidesWithWalls(x, y, 14, this.map.walls).collides) {
        return { x, y };
      }
    }
    return { x: this.centerX, y: this.centerY };
  }

  private placeAtBase(crystal: Crystal, team: "blue" | "red"): void {
    const base = team === "blue" ? this.blueBase : this.redBase;
    // Spread deposited crystals in a small ring around the base center so they're visible
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 55;
      const x = base.x + Math.cos(a) * r;
      const y = base.y + Math.sin(a) * r;
      if (!collidesWithWalls(x, y, 12, this.map.walls).collides) {
        crystal.x = x;
        crystal.y = y;
        crystal.depositedTeam = team;
        crystal.carrier = null;
        crystal.dropped = false;
        return;
      }
    }
    crystal.x = base.x;
    crystal.y = base.y;
    crystal.depositedTeam = team;
    crystal.carrier = null;
    crystal.dropped = false;
  }

  private updateCrystals(dt: number, allBrawlers: Brawler[]): void {
    for (const crystal of this.crystals) {
      // Carried follows the carrier
      if (crystal.carrier) {
        crystal.x = crystal.carrier.x;
        crystal.y = crystal.carrier.y;
        if (!crystal.carrier.alive) {
          // Drop where the carrier died, scattered slightly so others can grab
          const dx0 = crystal.carrier.x;
          const dy0 = crystal.carrier.y;
          let nx = dx0 + randomInt(-30, 30);
          let ny = dy0 + randomInt(-30, 30);
          // If inside a wall, search locally around the death point first
          if (collidesWithWalls(nx, ny, 12, this.map.walls).collides) {
            let placed = false;
            for (let i = 0; i < 24; i++) {
              const a = Math.random() * Math.PI * 2;
              const r = 20 + Math.random() * 80;
              const tx = dx0 + Math.cos(a) * r;
              const ty = dy0 + Math.sin(a) * r;
              if (!collidesWithWalls(tx, ty, 12, this.map.walls).collides) {
                nx = tx; ny = ty; placed = true; break;
              }
            }
            if (!placed) {
              const safe = this.findValidCrystalPos();
              nx = safe.x; ny = safe.y;
            }
          }
          crystal.x = nx;
          crystal.y = ny;
          crystal.carrier = null;
          crystal.dropped = true;
          crystal.dropTimer = 0;
          crystal.depositedTeam = undefined;
        }
        continue;
      }

      // Loose: anyone can grab. Deposited: only enemies of the depositing team can steal.
      for (const b of allBrawlers) {
        if (!b.alive) continue;
        if (crystal.depositedTeam && crystal.depositedTeam === b.team) continue;
        const d = distance(b.x, b.y, crystal.x, crystal.y);
        if (d < b.radius + 18) {
          crystal.carrier = b;
          crystal.depositedTeam = undefined;
          crystal.dropped = false;
          break;
        }
      }
    }

    // Deposit carried crystals when carrier reaches own base
    for (const b of allBrawlers) {
      if (!b.alive) continue;
      const carried = this.crystals.filter(c => c.carrier?.id === b.id);
      if (carried.length === 0) continue;
      const base = b.team === "blue" ? this.blueBase : this.redBase;
      const d = distance(b.x, b.y, base.x, base.y);
      if (d < 100) {
        for (const c of carried) this.placeAtBase(c, b.team as "blue" | "red");
      }
    }

    // Recompute scores from physically deposited crystals
    this.playerTeamCrystals = this.crystals.filter(c => c.depositedTeam === "blue").length;
    this.enemyTeamCrystals = this.crystals.filter(c => c.depositedTeam === "red").length;
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
    
    renderMap(ctx, this.map, this.camera.x, this.camera.y, 1200, 800, this.frame);
    
    this.renderGoalZones(ctx);
    this.renderCrystals(ctx);
    
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    const _friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    for (const b of allBrawlers) {
      b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, _friendlies);
    }

    // Carried-crystal badge above the HP bar for every carrier
    for (const b of allBrawlers) {
      if (!b.alive) continue;
      const carried = this.crystals.filter(c => c.carrier?.id === b.id).length;
      if (carried <= 0) continue;
      const sx = b.x - this.camera.x;
      const sy = b.y - this.camera.y - b.radius - 38;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.strokeStyle = "#00E5FF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#00E5FF";
      ctx.font = "10px Arial";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("💎", sx - 11, sy);
      ctx.fillStyle = "white";
      ctx.font = "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`${carried}`, sx + 4, sy + 1);
      ctx.restore();
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
