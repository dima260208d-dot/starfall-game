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

interface Safe {
  x: number;
  y: number;
  team: "blue" | "red";
  hp: number;
  maxHp: number;
}

export class ClashHeist {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  enemies: Bot[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;
  safes: Safe[] = [];
  respawnTimers: Map<string, number> = new Map();
  playerRespawnTimer = 0;

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
    this.player.setIdentity(getCurrentUsername() ?? "Игрок", false);

    const allStats = pickBotStats(playerBrawlerId, 5);
    this.allies.push(new Bot(allStats[0], randomInt(1, 4), 600, 1300, "blue"));
    this.allies.push(new Bot(allStats[1], randomInt(1, 4), 600, 2200, "blue"));
    this.enemies.push(new Bot(allStats[2], randomInt(1, 5), 2900, 1300, "red"));
    this.enemies.push(new Bot(allStats[3], randomInt(1, 5), 2900, 1750, "red"));
    this.enemies.push(new Bot(allStats[4], randomInt(1, 5), 2900, 2200, "red"));

    this.safes = [
      { x: 300, y: 1750, team: "blue", hp: 4000, maxHp: 4000 },
      { x: 3200, y: 1750, team: "red", hp: 4000, maxHp: 4000 },
    ];

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
      const enemySafe = this.safes.find(s => s.team === "red");
      if (enemySafe) {
        const d = distance(this.player.x, this.player.y, enemySafe.x, enemySafe.y);
        if (d < 110) {
          enemySafe.hp -= this.player.stats.attackDamage;
          spawnDamageNumber(enemySafe.x, enemySafe.y - 30, this.player.stats.attackDamage, "damage");
        }
      }
    } else {
      const projs = this.player.shoot(angle);
      this.projectiles.push(...projs);
    }
  }

  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    const mouseAngle = angleTo(
      this.player.x, this.player.y,
      this.input.state.mouseWorldX, this.input.state.mouseWorldY,
    );
    this.player.angle = autoAimAngle(this.player, this.enemies, mouseAngle);
    this.player.activateSuper(allBrawlers, this.map, this.projectiles);
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

    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    this.player.update(dt, this.map);

    for (const bot of [...this.allies, ...this.enemies]) {
      if (!bot.alive) continue;
      const targetSafe = this.safes.find(s => s.team !== bot.team && s.hp > 0);
      if (targetSafe) bot.forcedTarget = { x: targetSafe.x, y: targetSafe.y };
      bot.update(dt, this.map);
      bot.updateAI(dt, allBrawlers, this.map, this.projectiles);

      if (targetSafe) {
        const d = distance(bot.x, bot.y, targetSafe.x, targetSafe.y);
        if (d < 110 && bot.attackTimer <= 0 && bot.canAttack()) {
          targetSafe.hp -= bot.stats.attackDamage * 0.5;
          spawnDamageNumber(targetSafe.x, targetSafe.y - 30, Math.floor(bot.stats.attackDamage * 0.5), "damage");
          bot.attackTimer = bot.stats.attackCooldown;
        }
      }
    }

    updateProjectiles(this.projectiles, dt, this.map);
    this.handleProjectileHits(allBrawlers);
    this.projectiles = this.projectiles.filter(p => p.active);

    for (const [id, timer] of this.respawnTimers) {
      this.respawnTimers.set(id, timer - dt);
      if (timer - dt <= 0) {
        this.respawnTimers.delete(id);
        const bot = [...this.allies, ...this.enemies].find(b => b.id === id);
        if (bot) {
          bot.alive = true;
          bot.hp = bot.maxHp;
          bot.x = bot.team === "blue" ? randomInt(200, 700) : randomInt(2800, 3300);
          bot.y = randomInt(1300, 2200);
        }
      }
    }
    for (const bot of [...this.allies, ...this.enemies]) {
      if (!bot.alive && !this.respawnTimers.has(bot.id)) this.respawnTimers.set(bot.id, 5);
    }

    // Player respawn (team mode)
    if (!this.player.alive) {
      if (this.playerRespawnTimer <= 0) {
        this.playerRespawnTimer = 5;
      } else {
        this.playerRespawnTimer -= dt;
        if (this.playerRespawnTimer <= 0) {
          this.player.respawn(600, 1750);
        }
      }
    }
    const enemySafe = this.safes.find(s => s.team === "red")!;
    const playerSafe = this.safes.find(s => s.team === "blue")!;
    if (enemySafe.hp <= 0) {
      this.over = true; this.won = true;
      if (!this.resultRecorded) { recordGameResult({ won: true, mode: "heist", place: 1 }); this.resultRecorded = true; }
    }
    if (playerSafe.hp <= 0) {
      this.over = true; this.won = false;
      if (!this.resultRecorded) { recordGameResult({ won: false, mode: "heist", place: 2 }); this.resultRecorded = true; }
    }
    updateDamageNumbers(dt);
    updateEffects(dt, [this.player, ...this.allies, ...this.enemies]);
  }

  private handleProjectileHits(allBrawlers: Brawler[]): void {
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      // Check safes
      for (const safe of this.safes) {
        if (safe.hp <= 0) continue;
        if (proj.ownerTeam === safe.team) continue;
        const d = distance(proj.x, proj.y, safe.x, safe.y);
        if (d < 60 + proj.radius) {
          safe.hp -= proj.damage;
          spawnDamageNumber(safe.x, safe.y - 30, proj.damage, "damage");
          if (!proj.piercing) { proj.active = false; break; }
        }
      }
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
          if (!proj.piercing) { proj.active = false; break; }
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, 1200, 800);
    renderMap(ctx, this.map, this.camera.x, this.camera.y, 1200, 800, this.frame);
    this.renderSafes(ctx);
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    const _friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    for (const b of allBrawlers) b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, _friendlies);
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    this.renderHUD(ctx);
  }

  private renderSafes(ctx: CanvasRenderingContext2D): void {
    for (const safe of this.safes) {
      const sx = safe.x - this.camera.x;
      const sy = safe.y - this.camera.y;
      ctx.save();
      ctx.fillStyle = safe.team === "blue" ? "#1565C0" : "#B71C1C";
      ctx.shadowColor = safe.team === "blue" ? "#40C4FF" : "#FF5252";
      ctx.shadowBlur = 20;
      ctx.fillRect(sx - 50, sy - 50, 100, 100);
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 4;
      ctx.strokeRect(sx - 50, sy - 50, 100, 100);
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", sx, sy);
      // HP bar
      const hpRatio = Math.max(0, safe.hp / safe.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(sx - 55, sy - 75, 110, 12);
      ctx.fillStyle = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FFB300" : "#F44336";
      ctx.fillRect(sx - 55, sy - 75, 110 * hpRatio, 12);
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 55, sy - 75, 110, 12);
      ctx.restore();
    }
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    renderPlayerHUD(ctx, this.player);
    ctx.save();
    const blue = this.safes.find(s => s.team === "blue")!;
    const red = this.safes.find(s => s.team === "red")!;
    const scoreW = 280;
    const scoreX = (1200 - scoreW) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(scoreX, 5, scoreW, 60);

    ctx.font = "bold 11px Arial";
    ctx.fillStyle = "#40C4FF";
    ctx.textAlign = "center";
    ctx.fillText("ВАШ СЕЙФ", scoreX + 70, 20);
    ctx.fillStyle = "#FF5252";
    ctx.fillText("СЕЙФ ВРАГА", scoreX + 210, 20);

    const blueHp = Math.max(0, blue.hp / blue.maxHp);
    const redHp = Math.max(0, red.hp / red.maxHp);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(scoreX + 15, 30, 110, 14);
    ctx.fillRect(scoreX + 155, 30, 110, 14);
    ctx.fillStyle = "#40C4FF";
    ctx.fillRect(scoreX + 15, 30, 110 * blueHp, 14);
    ctx.fillStyle = "#FF5252";
    ctx.fillRect(scoreX + 155, 30, 110 * redHp, 14);

    ctx.fillStyle = "white";
    ctx.font = "bold 11px Arial";
    ctx.fillText(`${Math.floor(blue.hp)}/${blue.maxHp}`, scoreX + 70, 56);
    ctx.fillText(`${Math.floor(red.hp)}/${red.maxHp}`, scoreX + 210, 56);
    ctx.restore();
  }

  destroy(): void { this.input.destroy(); clearDamageNumbers(); clearEffects(); }
}
