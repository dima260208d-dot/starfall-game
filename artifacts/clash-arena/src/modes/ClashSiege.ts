import { Brawler } from "../entities/Brawler";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, pickBotStats } from "../entities/BrawlerData";
import { createCrystalsMap, GameMap, renderMap } from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers, spawnDamageNumber } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
import { angleTo, autoAimAngle, distance, randomInt } from "../utils/helpers";
import { recordGameResult, getCurrentUsername } from "../utils/localStorageAPI";
import { renderPlayerHUD } from "./sharedHUD";

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);

export class ClashSiege {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  enemies: Bot[] = [];
  projectiles: Projectile[] = [];
  respawnTimers: Map<string, number> = new Map();
  playerRespawnTimer = 0;
  camera: Camera;
  input: InputHandler;

  baseHp = 3000;
  baseMaxHp = 3000;
  baseX = 1750;
  baseY = 1750;

  wave = 1;
  maxWaves = 3;
  waveSpawnTimer = 3;
  enemiesToSpawn = 3;
  waveCleared = false;

  over = false;
  won = false;
  frame = 0;
  spriteLoaded: boolean;
  private resultRecorded = false;

  constructor(canvas: HTMLCanvasElement, playerBrawlerId: string, playerLevel: number, onAttack: () => void, onSuper: () => void, spriteLoaded: boolean) {
    this.map = createCrystalsMap();
    this.spriteLoaded = spriteLoaded;
    const playerStats = getBrawlerById(playerBrawlerId) || BRAWLERS[0];
    this.player = new Brawler(playerStats, playerLevel, 1750, 1900, "blue", true);
    this.player.setIdentity(getCurrentUsername() ?? "Игрок", false);
    // Spawn 3 allied bots to defend the base together with the player
    const allyStats = BRAWLERS.filter(b => b.id !== playerBrawlerId);
    const allyPos: Array<{ x: number; y: number }> = [
      { x: 1500, y: 1900 },
      { x: 2000, y: 1900 },
      { x: 1750, y: 2150 },
    ];
    for (let i = 0; i < 3; i++) {
      const stats = allyStats[i % allyStats.length];
      this.allies.push(new Bot(stats, Math.max(1, playerLevel - 1), allyPos[i].x, allyPos[i].y, "blue"));
    }
    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const mouseAngle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
    const angle = this.input.attackJoystick.active ? mouseAngle : autoAimAngle(this.player, this.enemies, mouseAngle);
    this.player.angle = angle;
    const isMelee = ["goro", "ronin", "taro"].includes(this.player.stats.id);
    const all = [this.player, ...this.allies, ...this.enemies];
    if (isMelee) this.player.meleeAttack(all);
    else this.projectiles.push(...this.player.shoot(angle));
  }
  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const mouseAngle = angleTo(
      this.player.x, this.player.y,
      this.input.state.mouseWorldX, this.input.state.mouseWorldY,
    );
    this.player.angle = this.input.superJoystick.active ? mouseAngle : autoAimAngle(this.player, this.enemies, mouseAngle);
    this.player.activateSuper([this.player, ...this.allies, ...this.enemies], this.map, this.projectiles, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
  }

  private spawnWave(): void {
    const enemyCount = 2 + this.wave;
    const enemyLevel = Math.min(10, this.wave * 2);
    const allStats = BRAWLERS.filter(b => b.id !== this.player.stats.id);
    for (let i = 0; i < enemyCount; i++) {
      const stats = allStats[randomInt(0, allStats.length - 1)];
      const angle = (i / enemyCount) * Math.PI * 2;
      const r = 1400;
      const ex = this.baseX + Math.cos(angle) * r;
      const ey = this.baseY + Math.sin(angle) * r;
      const ecx = Math.max(200, Math.min(this.map.width - 200, ex));
      const ecy = Math.max(200, Math.min(this.map.height - 200, ey));
      this.enemies.push(new Bot(stats, enemyLevel, ecx, ecy, "red"));
    }
    this.enemiesToSpawn = enemyCount;
    this.waveCleared = false;
  }

  update(dt: number): void {
    if (this.over) return;
    this.frame++;
    const { up, down, left, right } = this.input.state;
    let dx = 0, dy = 0;
    if (up) dy -= 1; if (down) dy += 1; if (left) dx -= 1; if (right) dx += 1;
    if (dx !== 0 || dy !== 0) this.player.move(dx, dy, dt);

    this.camera.follow(this.player.x, this.player.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, this.player.x, this.player.y, GAME_ZOOM);
    this.player.angle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);

    const all = [this.player, ...this.allies, ...this.enemies];
    this.player.update(dt, this.map);

    // Spawn waves
    if (this.waveCleared || this.enemies.length === 0) {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0) {
        if (this.wave > this.maxWaves) {
          this.over = true; this.won = true;
          if (!this.resultRecorded) { recordGameResult({ won: true, mode: "siege", place: 1 }); this.resultRecorded = true; }
          return;
        }
        this.spawnWave();
        this.waveSpawnTimer = 3;
      }
    }

    // Allies defend the base — patrol around it and engage enemies that come close
    for (const ally of this.allies) {
      if (!ally.alive) continue;
      // Pick the nearest enemy as a roaming target if any are reasonably close to base
      let bestEnemy: Bot | null = null;
      let bestDist = 99999;
      for (const en of this.enemies) {
        if (!en.alive) continue;
        const d = distance(en.x, en.y, this.baseX, this.baseY);
        if (d < 700 && d < bestDist) { bestDist = d; bestEnemy = en; }
      }
      if (bestEnemy) {
        ally.forcedTarget = { x: bestEnemy.x, y: bestEnemy.y };
      } else {
        // Stay near base
        ally.forcedTarget = { x: this.baseX + Math.cos(ally.id.charCodeAt(0)) * 200, y: this.baseY + Math.sin(ally.id.charCodeAt(0)) * 200 };
      }
      ally.update(dt, this.map);
      ally.updateAI(dt, all, this.map, this.projectiles);
    }

    // Bots target nearby defenders if any are close, otherwise march on the base
    const defenders: Brawler[] = [this.player, ...this.allies].filter(b => b.alive);
    for (const bot of this.enemies) {
      if (!bot.alive) continue;
      let nearestDef: Brawler | null = null;
      let nd = 99999;
      for (const def of defenders) {
        const d = distance(bot.x, bot.y, def.x, def.y);
        if (d < nd) { nd = d; nearestDef = def; }
      }
      if (nearestDef && nd < 600) {
        // Engage the defender (they will path toward it and attack via normal AI)
        bot.forcedTarget = { x: nearestDef.x, y: nearestDef.y };
      } else {
        bot.forcedTarget = { x: this.baseX, y: this.baseY };
      }
      bot.update(dt, this.map);
      bot.updateAI(dt, all, this.map, this.projectiles);

      // Always damage the base when in melee range
      const dBase = distance(bot.x, bot.y, this.baseX, this.baseY);
      if (dBase < 110 && bot.attackTimer <= 0 && bot.canAttack()) {
        const dmg = bot.stats.attackDamage * 0.4;
        this.baseHp -= dmg;
        spawnDamageNumber(this.baseX, this.baseY - 50, Math.floor(dmg), "damage");
        bot.attackTimer = bot.stats.attackCooldown;
      }
    }

    // Respawn fallen allies after a delay so the team stays alive
    for (const ally of this.allies) {
      if (!ally.alive && !this.respawnTimers.has(ally.id)) {
        this.respawnTimers.set(ally.id, 6);
      }
    }
    for (const [id, timer] of this.respawnTimers) {
      const nt = timer - dt;
      this.respawnTimers.set(id, nt);
      if (nt <= 0) {
        this.respawnTimers.delete(id);
        const ally = this.allies.find(a => a.id === id);
        if (ally) {
          ally.alive = true;
          ally.hp = ally.maxHp;
          ally.x = this.baseX + randomInt(-200, 200);
          ally.y = this.baseY + randomInt(150, 280);
        }
      }
    }

    updateProjectiles(this.projectiles, dt, this.map);
    this.handleProjectileHits(all);
    this.projectiles = this.projectiles.filter(p => p.active);

    // Remove dead enemies, advance wave when all dead
    const aliveEnemies = this.enemies.filter(e => e.alive);
    if (aliveEnemies.length === 0 && !this.waveCleared && this.enemies.length > 0) {
      this.waveCleared = true;
      this.wave++;
      this.waveSpawnTimer = 4;
      this.enemies = [];
      // Heal player a bit between waves
      this.player.heal(this.player.maxHp * 0.3);
      this.baseHp = Math.min(this.baseMaxHp, this.baseHp + 300);
    }

    // Player respawn (team mode): death does NOT end the match
    if (!this.player.alive) {
      if (this.playerRespawnTimer <= 0) {
        this.playerRespawnTimer = 5;
      } else {
        this.playerRespawnTimer -= dt;
        if (this.playerRespawnTimer <= 0) {
          this.player.respawn(1750, 1900);
        }
      }
    }
    // Loss only if the base falls
    if (this.baseHp <= 0) {
      this.over = true; this.won = false;
      if (!this.resultRecorded) { recordGameResult({ won: false, mode: "siege", place: 2 }); this.resultRecorded = true; }
    }
    updateDamageNumbers(dt);
    updateEffects(dt, [this.player, ...this.allies, ...this.enemies]);
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
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);
    renderMap(ctx, this.map, this.camera.x, this.camera.y, CAM_W, CAM_H, this.frame);

    // Render base
    const sx = this.baseX - this.camera.x;
    const sy = this.baseY - this.camera.y;
    ctx.save();
    ctx.shadowColor = "#FFD700";
    ctx.shadowBlur = 25;
    const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, 80);
    grad.addColorStop(0, "#FFD700");
    grad.addColorStop(0.5, "#FFB300");
    grad.addColorStop(1, "#F57F17");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "white";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚙", sx, sy);
    // HP bar
    const hpRatio = Math.max(0, this.baseHp / this.baseMaxHp);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(sx - 70, sy - 95, 140, 14);
    ctx.fillStyle = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FFB300" : "#F44336";
    ctx.fillRect(sx - 70, sy - 95, 140 * hpRatio, 14);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 70, sy - 95, 140, 14);
    ctx.restore();

    const all = [this.player, ...this.allies, ...this.enemies];
    const _friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    for (const b of all) b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, _friendlies);
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    ctx.restore();
    this.renderHUD(ctx);
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    renderPlayerHUD(ctx, this.player);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(490, 5, 220, 60);
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    const wDisp = Math.min(this.wave, this.maxWaves);
    ctx.fillText(`Волна ${wDisp} / ${this.maxWaves}`, 600, 28);
    ctx.fillStyle = "white";
    ctx.font = "bold 13px Arial";
    const aliveCount = this.enemies.filter(e => e.alive).length;
    if (aliveCount > 0) {
      ctx.fillText(`Врагов: ${aliveCount}`, 600, 50);
    } else if (this.wave <= this.maxWaves) {
      ctx.fillStyle = "#69F0AE";
      ctx.fillText(`Следующая волна через ${Math.max(0, this.waveSpawnTimer).toFixed(1)}с`, 600, 50);
    }

    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 11px Arial";
    ctx.fillRect(1050, 10, 140, 40);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(1050, 10, 140, 40);
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("БАЗА", 1120, 24);
    const hpRatio = Math.max(0, this.baseHp / this.baseMaxHp);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(1060, 30, 120, 12);
    ctx.fillStyle = hpRatio > 0.5 ? "#4CAF50" : "#FF5252";
    ctx.fillRect(1060, 30, 120 * hpRatio, 12);
    ctx.restore();
  }

  destroy(): void { this.input.destroy(); clearDamageNumbers(); clearEffects(); }
}
