import { Brawler } from "../entities/Brawler";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById } from "../entities/BrawlerData";
import { createCrystalsMap, GameMap, renderMap } from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers } from "../utils/damageNumbers";
import { angleTo, autoAimAngle, distance, randomInt } from "../utils/helpers";
import { recordGameResult } from "../utils/localStorageAPI";
import { renderPlayerHUD } from "./sharedHUD";

interface Gem { x: number; y: number; carrier: Brawler | null; }

export class ClashGemGrab {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  enemies: Bot[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;
  gems: Gem[] = [];
  spawnTimer = 2;
  blueGems = 0;
  redGems = 0;
  blueCountdown = 0; // counts down from 15 when team holds 10+
  redCountdown = 0;
  respawnTimers: Map<string, number> = new Map();

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;
  private resultRecorded = false;

  constructor(canvas: HTMLCanvasElement, playerBrawlerId: string, playerLevel: number, onAttack: () => void, onSuper: () => void, spriteLoaded: boolean) {
    this.map = createCrystalsMap();
    this.spriteLoaded = spriteLoaded;
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    this.player = new Brawler(playerStats, playerLevel, 600, 1750, "blue", true);

    const allStats = BRAWLERS.filter(b => b.id !== playerBrawlerId);
    this.allies.push(new Bot(allStats[0], randomInt(1, 4), 600, 1300, "blue"));
    this.allies.push(new Bot(allStats[1], randomInt(1, 4), 600, 2200, "blue"));
    this.enemies.push(new Bot(allStats[2], randomInt(1, 5), 2900, 1300, "red"));
    this.enemies.push(new Bot(allStats[3], randomInt(1, 5), 2900, 1750, "red"));
    this.enemies.push(new Bot(allStats[4], randomInt(1, 5), 2900, 2200, "red"));

    this.camera = new Camera(1200, 800, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const mouseAngle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
    const angle = autoAimAngle(this.player, this.enemies, mouseAngle);
    this.player.angle = angle;
    const isMelee = ["goro", "ronin", "taro"].includes(this.player.stats.id);
    const all = [this.player, ...this.allies, ...this.enemies];
    if (isMelee) this.player.meleeAttack(all);
    else this.projectiles.push(...this.player.shoot(angle));
  }
  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    this.player.activateSuper([this.player, ...this.allies, ...this.enemies], this.map, this.projectiles);
  }

  update(dt: number): void {
    if (this.over) return;
    this.frame++;
    const { up, down, left, right } = this.input.state;
    let dx = 0, dy = 0;
    if (up) dy -= 1; if (down) dy += 1; if (left) dx -= 1; if (right) dx += 1;
    if (dx !== 0 || dy !== 0) this.player.move(dx, dy, dt);

    this.camera.follow(this.player.x, this.player.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y);
    this.player.angle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);

    const all = [this.player, ...this.allies, ...this.enemies];
    this.player.update(dt, this.map);

    // Spawn gems from center
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.gems.length < 12) {
      this.gems.push({ x: 1750 + randomInt(-200, 200), y: 1750 + randomInt(-200, 200), carrier: null });
      this.spawnTimer = 2.5;
    }

    for (const bot of [...this.allies, ...this.enemies]) {
      if (!bot.alive) continue;
      const teamGems = bot.team === "blue" ? this.blueGems : this.redGems;
      if (teamGems >= 10) {
        // Hold position, retreat to safe area
        const safe = bot.team === "blue" ? { x: 600, y: 1750 } : { x: 2900, y: 1750 };
        bot.forcedTarget = safe;
      } else {
        bot.forcedTarget = undefined;
        let nearest: Gem | null = null;
        let nd = 99999;
        for (const g of this.gems) {
          if (g.carrier) continue;
          const d = distance(bot.x, bot.y, g.x, g.y);
          if (d < nd) { nd = d; nearest = g; }
        }
        if (nearest) bot.crystalTarget = { x: nearest.x, y: nearest.y };
        else bot.crystalTarget = undefined;
      }
      bot.update(dt, this.map);
      bot.updateAI(dt, all, this.map, this.projectiles);
    }

    updateProjectiles(this.projectiles, dt, this.map);
    this.handleProjectileHits(all);
    this.projectiles = this.projectiles.filter(p => p.active);

    // Pickup gems
    for (const gem of this.gems) {
      if (gem.carrier) {
        gem.x = gem.carrier.x;
        gem.y = gem.carrier.y;
        if (!gem.carrier.alive) {
          // Drop gems back to center on death
          gem.carrier = null;
          gem.x = 1750 + randomInt(-200, 200);
          gem.y = 1750 + randomInt(-200, 200);
        }
        continue;
      }
      for (const b of all) {
        if (!b.alive) continue;
        if (distance(b.x, b.y, gem.x, gem.y) < b.radius + 15) {
          gem.carrier = b;
          break;
        }
      }
    }

    // Recount team gems
    this.blueGems = this.gems.filter(g => g.carrier && g.carrier.team === "blue").length;
    this.redGems = this.gems.filter(g => g.carrier && g.carrier.team === "red").length;

    // Countdown
    if (this.blueGems >= 10) {
      if (this.blueCountdown <= 0) this.blueCountdown = 15;
      this.blueCountdown -= dt;
    } else this.blueCountdown = 0;
    if (this.redGems >= 10) {
      if (this.redCountdown <= 0) this.redCountdown = 15;
      this.redCountdown -= dt;
    } else this.redCountdown = 0;

    // Respawn
    for (const [id, timer] of this.respawnTimers) {
      this.respawnTimers.set(id, timer - dt);
      if (timer - dt <= 0) {
        this.respawnTimers.delete(id);
        const bot = [...this.allies, ...this.enemies].find(b => b.id === id);
        if (bot) {
          bot.alive = true; bot.hp = bot.maxHp;
          bot.x = bot.team === "blue" ? randomInt(200, 700) : randomInt(2800, 3300);
          bot.y = randomInt(1300, 2200);
        }
      }
    }
    for (const bot of [...this.allies, ...this.enemies]) {
      if (!bot.alive && !this.respawnTimers.has(bot.id)) this.respawnTimers.set(bot.id, 5);
    }

    if (!this.player.alive) {
      this.over = true; this.won = false;
      if (!this.resultRecorded) { recordGameResult(false, "gemgrab"); this.resultRecorded = true; }
    }
    if (this.blueCountdown < 0 && this.blueGems >= 10) {
      this.over = true; this.won = true;
      if (!this.resultRecorded) { recordGameResult(true, "gemgrab"); this.resultRecorded = true; }
    }
    if (this.redCountdown < 0 && this.redGems >= 10) {
      this.over = true; this.won = false;
      if (!this.resultRecorded) { recordGameResult(false, "gemgrab"); this.resultRecorded = true; }
    }
    updateDamageNumbers(dt);
  }

  private handleProjectileHits(all: Brawler[]): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      for (const b of all) {
        if (!b.alive) continue;
        if (b.id === proj.ownerId) continue;
        if (proj.hitIds.has(b.id)) continue;
        if (proj.ownerTeam === b.team) continue;
        const d = distance(proj.x, proj.y, b.x, b.y);
        if (d < proj.radius + b.radius) {
          const attacker = all.find(bw => bw.id === proj.ownerId) || null;
          b.takeDamage(proj.damage, attacker);
          if (proj.slow) b.addStatus("slow", 1, 0.3);
          if (proj.poison) b.addStatus("poison", 3, 100);
          proj.hitIds.add(b.id);
          if (!proj.piercing) { proj.active = false; break; }
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, 1200, 800);
    renderMap(ctx, this.map, this.camera.x, this.camera.y, 1200, 800, this.frame);
    // Center vein indicator
    const csx = 1750 - this.camera.x;
    const csy = 1750 - this.camera.y;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#CE93D8";
    ctx.beginPath();
    ctx.arc(csx, csy, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Render gems
    for (const gem of this.gems) {
      const sx = gem.x - this.camera.x;
      const sy = gem.y - this.camera.y - (gem.carrier ? 30 : 0);
      ctx.save();
      ctx.shadowColor = "#CE93D8";
      ctx.shadowBlur = 15;
      ctx.fillStyle = "#E040FB";
      ctx.beginPath();
      ctx.moveTo(sx, sy - 12);
      ctx.lineTo(sx + 8, sy);
      ctx.lineTo(sx, sy + 12);
      ctx.lineTo(sx - 8, sy);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    const all = [this.player, ...this.allies, ...this.enemies];
    const _friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    for (const b of all) b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, _friendlies);
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    this.renderHUD(ctx);
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    renderPlayerHUD(ctx, this.player);
    ctx.save();
    const scoreW = 320;
    const scoreX = (1200 - scoreW) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(scoreX, 5, scoreW, 60);
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#40C4FF";
    ctx.fillText(`${this.blueGems}`, scoreX + 60, 35);
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.fillText("/ 10", scoreX + 90, 35);
    ctx.font = "16px Arial";
    ctx.fillText("💎", scoreX + 160, 35);
    ctx.font = "bold 22px Arial";
    ctx.fillStyle = "#FF5252";
    ctx.fillText(`${this.redGems}`, scoreX + 230, 35);
    ctx.font = "11px Arial";
    ctx.fillStyle = "white";
    ctx.fillText("СИНИЕ", scoreX + 60, 18);
    ctx.fillText("КРАСНЫЕ", scoreX + 230, 18);

    if (this.blueCountdown > 0) {
      ctx.fillStyle = "#40C4FF";
      ctx.font = "bold 14px Arial";
      ctx.fillText(`Победа через: ${this.blueCountdown.toFixed(1)}с`, scoreX + scoreW / 2, 58);
    } else if (this.redCountdown > 0) {
      ctx.fillStyle = "#FF5252";
      ctx.font = "bold 14px Arial";
      ctx.fillText(`Враги побеждают через: ${this.redCountdown.toFixed(1)}с`, scoreX + scoreW / 2, 58);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "11px Arial";
      ctx.fillText("Соберите 10 камней и удержите 15 сек!", scoreX + scoreW / 2, 58);
    }
    ctx.restore();
  }

  destroy(): void { this.input.destroy(); clearDamageNumbers(); }
}
