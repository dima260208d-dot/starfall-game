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
  exploded?: boolean;
}

interface CrystalParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number; angle: number; spin: number;
  color: string;
}

const GAME_ZOOM = 1.4;
const CAM_W = Math.round(1200 / GAME_ZOOM);
const CAM_H = Math.round(800 / GAME_ZOOM);

export class ClashHeist {
  map: GameMap;
  player: Brawler;
  allies: Bot[] = [];
  enemies: Bot[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;
  safes: Safe[] = [];
  crystalParticles: CrystalParticle[] = [];
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

    this.camera = new Camera(CAM_W, CAM_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const mouseAngle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
    const angle = this.input.attackJoystick.active ? mouseAngle : autoAimAngle(this.player, this.enemies, mouseAngle);
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
    this.player.angle = this.input.superJoystick.active ? mouseAngle : autoAimAngle(this.player, this.enemies, mouseAngle);
    this.player.activateSuper(allBrawlers, this.map, this.projectiles, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
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
    // Trigger crystal explosion when safe first reaches 0 HP
    for (const safe of this.safes) {
      if (safe.hp <= 0 && !safe.exploded) {
        safe.exploded = true;
        this.spawnCrystalExplosion(safe.x, safe.y);
      }
    }
    if (enemySafe.hp <= 0) {
      this.over = true; this.won = true;
      if (!this.resultRecorded) { recordGameResult({ won: true, mode: "heist", place: 1 }); this.resultRecorded = true; }
    }
    if (playerSafe.hp <= 0) {
      this.over = true; this.won = false;
      if (!this.resultRecorded) { recordGameResult({ won: false, mode: "heist", place: 2 }); this.resultRecorded = true; }
    }
    // Update crystal particles
    for (let i = this.crystalParticles.length - 1; i >= 0; i--) {
      const p = this.crystalParticles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vy += 0.18 * dt * 60; // gravity
      p.angle += p.spin * dt * 60;
      p.life -= dt;
      if (p.life <= 0) this.crystalParticles.splice(i, 1);
    }
    updateDamageNumbers(dt);
    updateEffects(dt, [this.player, ...this.allies, ...this.enemies]);
  }

  private spawnCrystalExplosion(x: number, y: number): void {
    const colors = ["#00BCD4", "#26C6DA", "#4DD0E1", "#80DEEA", "#B2EBF2", "#00ACC1", "#006064"];
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      this.crystalParticles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1.5 + Math.random() * 1.5,
        maxLife: 3,
        size: 4 + Math.random() * 8,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.15,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
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
    ctx.save();
    ctx.scale(GAME_ZOOM, GAME_ZOOM);
    renderMap(ctx, this.map, this.camera.x, this.camera.y, CAM_W, CAM_H, this.frame);
    this.renderSafes(ctx);
    this.renderCrystalParticles(ctx);
    const allBrawlers = [this.player, ...this.allies, ...this.enemies];
    const _friendlies = [this.player, ...this.allies].filter(b => b.alive).map(b => ({ x: b.x, y: b.y }));
    for (const b of allBrawlers) b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, _friendlies);
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    ctx.restore();
    this.renderHUD(ctx);
  }

  private renderCrystalParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.crystalParticles) {
      const sx = p.x - this.camera.x;
      const sy = p.y - this.camera.y;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.angle);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      // Draw diamond/crystal shape
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.5, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.5, 0);
      ctx.closePath();
      ctx.fill();
      // Inner highlight
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.5);
      ctx.lineTo(s * 0.2, 0);
      ctx.lineTo(0, s * 0.25);
      ctx.lineTo(-s * 0.2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private renderSafes(ctx: CanvasRenderingContext2D): void {
    for (const safe of this.safes) {
      if (safe.hp <= 0) continue;
      const sx = safe.x - this.camera.x;
      const sy = safe.y - this.camera.y;
      const isBlue = safe.team === "blue";
      const teamColor = isBlue ? "#1565C0" : "#B71C1C";
      const teamGlow = isBlue ? "#40C4FF" : "#FF5252";
      const hpRatio = Math.max(0, safe.hp / safe.maxHp);

      ctx.save();
      // Drop shadow
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(sx + 6, sy + 58, 56, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.shadowColor = teamGlow;
      ctx.shadowBlur = 20;

      // Safe body — steel-gray box with extrusion
      const depth = 12;
      const W = 100, H = 100;
      // Right extrusion
      ctx.fillStyle = "#1A1A2E";
      ctx.beginPath();
      ctx.moveTo(sx + W/2, sy - H/2);
      ctx.lineTo(sx + W/2 + depth, sy - H/2 - depth * 0.5);
      ctx.lineTo(sx + W/2 + depth, sy + H/2 - depth * 0.5);
      ctx.lineTo(sx + W/2, sy + H/2);
      ctx.closePath();
      ctx.fill();
      // Top extrusion
      ctx.fillStyle = "#2D2D4E";
      ctx.beginPath();
      ctx.moveTo(sx - W/2, sy - H/2);
      ctx.lineTo(sx + W/2, sy - H/2);
      ctx.lineTo(sx + W/2 + depth, sy - H/2 - depth * 0.5);
      ctx.lineTo(sx - W/2 + depth, sy - H/2 - depth * 0.5);
      ctx.closePath();
      ctx.fill();

      // Main face gradient
      ctx.shadowBlur = 0;
      const bodyGrad = ctx.createLinearGradient(sx - W/2, sy - H/2, sx + W/2, sy + H/2);
      bodyGrad.addColorStop(0, "#546E7A");
      bodyGrad.addColorStop(0.5, "#37474F");
      bodyGrad.addColorStop(1, "#263238");
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(sx - W/2, sy - H/2, W, H);

      // Team color accent strip on top
      ctx.fillStyle = teamColor;
      ctx.fillRect(sx - W/2, sy - H/2, W, 8);
      ctx.fillStyle = teamGlow;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(sx - W/2, sy - H/2, W, H);
      ctx.globalAlpha = 1;

      // Safe door — circular vault wheel
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, 32, 0, Math.PI * 2);
      ctx.stroke();
      // Inner ring
      ctx.strokeStyle = "#B0BEC5";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 22, 0, Math.PI * 2);
      ctx.stroke();
      // Wheel spokes
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * 10, sy + Math.sin(a) * 10);
        ctx.lineTo(sx + Math.cos(a) * 30, sy + Math.sin(a) * 30);
        ctx.stroke();
      }
      // Center bolt
      ctx.fillStyle = "#FFD700";
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fill();

      // Corner rivets
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#78909C";
      for (const [rx, ry] of [[-W/2+7, -H/2+7], [W/2-7, -H/2+7], [-W/2+7, H/2-7], [W/2-7, H/2-7]]) {
        ctx.beginPath();
        ctx.arc(sx + rx, sy + ry, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outline
      ctx.strokeStyle = "#546E7A";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - W/2 + 0.5, sy - H/2 + 0.5, W - 1, H - 1);

      // Damage cracks
      if (hpRatio < 0.6) {
        ctx.strokeStyle = "rgba(255,100,0,0.65)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - W/2 + W*0.1, sy - H/2 + H*0.2);
        ctx.lineTo(sx - W/2 + W*0.4, sy - H/2 + H*0.5);
        ctx.lineTo(sx - W/2 + W*0.3, sy - H/2 + H*0.75);
        ctx.stroke();
        if (hpRatio < 0.3) {
          ctx.beginPath();
          ctx.moveTo(sx - W/2 + W*0.65, sy - H/2 + H*0.15);
          ctx.lineTo(sx - W/2 + W*0.55, sy - H/2 + H*0.55);
          ctx.lineTo(sx - W/2 + W*0.8, sy - H/2 + H*0.85);
          ctx.stroke();
        }
      }

      // HP bar
      const barW = 120;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(sx - barW/2 - 1, sy - H/2 - 17, barW + 2, 12);
      ctx.fillStyle = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FFB300" : "#F44336";
      ctx.fillRect(sx - barW/2, sy - H/2 - 16, barW * hpRatio, 10);
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(sx - barW/2, sy - H/2 - 16, barW, 10);

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
