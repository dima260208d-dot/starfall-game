import { Brawler } from "../entities/Brawler";
import { Bot } from "../entities/Bot";
import { BRAWLERS, getBrawlerById, pickBotStats } from "../entities/BrawlerData";
import { createCrystalsMap, GameMap, renderMap } from "../game/MapRenderer";
import { Projectile, updateProjectiles, renderProjectiles } from "../entities/Projectile";
import { Camera } from "../game/Camera";
import { InputHandler } from "../game/InputHandler";
import { updateDamageNumbers, renderDamageNumbers, clearDamageNumbers } from "../utils/damageNumbers";
import { updateEffects, renderEffects, clearEffects } from "../utils/effects";
import { angleTo, autoAimAngle, distance } from "../utils/helpers";
import { renderPlayerHUD } from "./sharedHUD";
import { getCurrentUsername } from "../utils/localStorageAPI";

interface Dummy {
  bot: Bot;
  spawnX: number;
  spawnY: number;
  respawnTimer: number;
}

const TRAINING_MAP_W = 1200;
const TRAINING_MAP_H = 800;

export class ClashTraining {
  map: GameMap;
  player: Brawler;
  dummies: Dummy[] = [];
  projectiles: Projectile[] = [];
  camera: Camera;
  input: InputHandler;
  frame = 0;
  spriteLoaded: boolean;

  // Required by GameScreen polling — training never ends.
  over = false;
  won = false;

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
    // Player spawns dead-center; dummies form a ring around them.
    const cx = this.map.width / 2;
    const cy = this.map.height / 2;
    this.player = new Brawler(playerStats, playerLevel, cx, cy, "blue", true);
    this.player.setIdentity(getCurrentUsername() ?? "Игрок", false);

    // Five training dummies in an evenly-spaced ring around the player.
    const dummyStats = pickBotStats(playerBrawlerId, 5);
    const ringRadius = 320;
    const positions = Array.from({ length: 5 }, (_, i) => {
      // Start the first dummy slightly above the player and rotate clockwise.
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      return {
        x: cx + Math.cos(angle) * ringRadius,
        y: cy + Math.sin(angle) * ringRadius,
      };
    });
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      // Dummies are on team "red" so the player can damage them; level 5 for healthy HP bags.
      const bot = new Bot(dummyStats[i], 5, pos.x, pos.y, "red");
      this.dummies.push({ bot, spawnX: pos.x, spawnY: pos.y, respawnTimer: 0 });
    }

    this.camera = new Camera(TRAINING_MAP_W, TRAINING_MAP_H, this.map.width, this.map.height);
    this.input = new InputHandler(canvas, onAttack, onSuper);
  }

  handleAttack(): void {
    if (!this.player.canAttack()) return;
    const enemies = this.dummies.map(d => d.bot).filter(b => b.alive);
    const mouseAngle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
    const angle = this.input.attackJoystick.active ? mouseAngle : autoAimAngle(this.player, enemies, mouseAngle);
    this.player.angle = angle;
    const isMelee = ["goro", "ronin", "taro"].includes(this.player.stats.id);
    const allBrawlers = [this.player, ...enemies];
    if (isMelee) {
      this.player.meleeAttack(allBrawlers);
    } else {
      const projs = this.player.shoot(angle);
      this.projectiles.push(...projs);
    }
  }

  handleSuper(): void {
    if (!this.player.canUseSuper()) return;
    const enemies = this.dummies.map(d => d.bot).filter(b => b.alive);
    const allBrawlers = [this.player, ...enemies];
    const mouseAngle = angleTo(
      this.player.x, this.player.y,
      this.input.state.mouseWorldX, this.input.state.mouseWorldY,
    );
    this.player.angle = this.input.superJoystick.active ? mouseAngle : autoAimAngle(this.player, enemies, mouseAngle);
    this.player.activateSuper(allBrawlers, this.map, this.projectiles, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
  }

  update(dt: number): void {
    this.frame++;
    const { up, down, left, right } = this.input.state;
    let dx = 0, dy = 0;
    if (up) dy -= 1; if (down) dy += 1; if (left) dx -= 1; if (right) dx += 1;
    if (dx !== 0 || dy !== 0) this.player.move(dx, dy, dt);

    this.camera.follow(this.player.x, this.player.y);
    this.input.updateWorldMouse(this.camera.x, this.camera.y, this.player.x, this.player.y);
    this.player.angle = angleTo(this.player.x, this.player.y, this.input.state.mouseWorldX, this.input.state.mouseWorldY);
    this.player.update(dt, this.map);

    // Training no longer auto-charges the super; the player must land hits
    // on the training dummies to charge it, just like in real matches.

    // Dummies: take damage but never attack. Tick statuses; respawn handled below
    // after combat resolution so newly-dead dummies always get the full 2s timer.
    for (const d of this.dummies) {
      if (d.bot.alive) {
        // Just tick statuses + slow regen. Do NOT call updateAI so they never shoot/move.
        d.bot.update(dt, this.map);
      }
    }

    updateProjectiles(this.projectiles, dt, this.map);
    this.handleProjectileHits();
    this.projectiles = this.projectiles.filter(p => p.active);

    // Player can't actually die in training — full revive immediately.
    if (!this.player.alive) {
      this.player.alive = true;
      this.player.hp = this.player.maxHp;
    }

    // Resolve dummy death/respawn AFTER hits this frame:
    // - On death transition (alive=false, timer not yet armed): arm 2s timer.
    // - On timer elapsing: revive at spawn position with full HP.
    for (const d of this.dummies) {
      if (!d.bot.alive) {
        if (d.respawnTimer <= 0) {
          // Just died this frame — arm timer.
          d.respawnTimer = 2;
        } else {
          d.respawnTimer -= dt;
          if (d.respawnTimer <= 0) {
            d.bot.alive = true;
            d.bot.hp = d.bot.maxHp;
            d.bot.x = d.spawnX;
            d.bot.y = d.spawnY;
            d.bot.statusEffects = [];
            d.bot.attackCharges = d.bot.maxAttackCharges;
            d.respawnTimer = 0;
          }
        }
      }
    }

    updateDamageNumbers(dt);
    updateEffects(dt, [this.player, ...this.dummies.map(d => d.bot)]);
  }

  private handleProjectileHits(): void {
    const enemies = this.dummies.map(d => d.bot);
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      for (const b of enemies) {
        if (!b.alive) continue;
        if (b.id === proj.ownerId) continue;
        if (proj.hitIds.has(b.id)) continue;
        if (proj.ownerTeam === b.team) continue;
        const d = distance(proj.x, proj.y, b.x, b.y);
        if (d < proj.radius + b.radius) {
          b.takeDamage(proj.damage, this.player);
          if (proj.slow) b.addStatus("slow", 1, 0.3);
          if (proj.poison) b.addStatus("poison", 3, 100);
          proj.hitIds.add(b.id);
          if (!proj.piercing) { proj.active = false; break; }
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, TRAINING_MAP_W, TRAINING_MAP_H);
    renderMap(ctx, this.map, this.camera.x, this.camera.y, TRAINING_MAP_W, TRAINING_MAP_H, this.frame);
    const allBrawlers = [this.player, ...this.dummies.map(d => d.bot)];
    const friendlies = [this.player].map(b => ({ x: b.x, y: b.y }));
    for (const b of allBrawlers) b.render(ctx, this.camera.x, this.camera.y, this.spriteLoaded, this.player.team, friendlies);
    renderProjectiles(ctx, this.projectiles, this.camera.x, this.camera.y, this.frame);
    renderEffects(ctx, this.camera.x, this.camera.y, this.frame);
    renderDamageNumbers(ctx, this.camera.x, this.camera.y);
    this.renderHUD(ctx);
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    renderPlayerHUD(ctx, this.player);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect((TRAINING_MAP_W - 320) / 2, 5, 320, 36);
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("ТРЕНИРОВКА — мишени не атакуют", TRAINING_MAP_W / 2, 28);
    ctx.restore();
  }

  destroy(): void { this.input.destroy(); clearDamageNumbers(); clearEffects(); }
}
