import { BrawlerStats, getScaledStats } from "./BrawlerData";
import { GameMap, collidesWithWalls, isInBush, isInRiver } from "../game/MapRenderer";
import { Projectile, createProjectile } from "./Projectile";
import { spawnDamageNumber } from "../utils/damageNumbers";
import { clamp, distance, angleTo } from "../utils/helpers";
import { drawCharacterSprite, drawBrawlerImage } from "../game/sprites";

export type Team = string;

export interface StatusEffect {
  type: "slow" | "poison" | "stun" | "berserker";
  duration: number;
  value: number;
}

export class Brawler {
  id: string;
  stats: BrawlerStats;
  level: number;
  x: number;
  y: number;
  radius = 24;
  team: Team;
  isPlayer: boolean;

  maxHp: number;
  hp: number;
  speed: number;
  angle = 0;
  
  attackCharges: number;
  maxAttackCharges: number;
  attackCooldownTimer = 0;
  attackCooldown: number;
  
  superCharge = 0;
  maxSuperCharge = 100;
  superReady = false;
  
  regenTimer = 0;
  regenDelay = 3;
  lastDamageTime = 0;
  
  statusEffects: StatusEffect[] = [];
  
  alive = true;
  invulnerable = false;
  invulnerableTimer = 0;
  hitFlash = 0;
  
  animFrame = 0;
  attackAnim = 0;
  superAnim = 0;
  deathAnim = 0;
  isAttacking = false;
  
  inBush = false;
  inRiver = false;
  
  turret: Brawler | null = null;
  
  powerCubes = 0;
  
  constructor(stats: BrawlerStats, level: number, x: number, y: number, team: Team, isPlayer = false) {
    this.id = `brawler_${Math.random().toString(36).slice(2)}`;
    this.stats = stats;
    this.level = level;
    this.x = x;
    this.y = y;
    this.team = team;
    this.isPlayer = isPlayer;
    
    const scaled = getScaledStats(stats, level);
    this.maxHp = scaled.hp;
    this.hp = scaled.hp;
    this.speed = scaled.speed;
    this.attackCharges = scaled.attackCharges;
    this.maxAttackCharges = scaled.attackCharges;
    this.attackCooldown = scaled.attackCooldown;
  }

  get scaledDamage(): number {
    return getScaledStats(this.stats, this.level).attackDamage * (1 + this.powerCubes * 0.1);
  }
  
  collectPowerCube(): void {
    this.powerCubes++;
    const baseHp = getScaledStats(this.stats, this.level).hp;
    this.maxHp = Math.floor(baseHp * (1 + this.powerCubes * 0.1));
    this.hp = Math.min(this.maxHp, this.hp + Math.floor(baseHp * 0.1));
  }

  update(dt: number, map: GameMap): void {
    if (!this.alive) {
      this.deathAnim += dt;
      return;
    }
    
    this.animFrame += dt * 60;
    if (this.attackAnim > 0) this.attackAnim -= dt * 3;
    if (this.superAnim > 0) this.superAnim -= dt * 2;
    
    if (this.hitFlash > 0) this.hitFlash -= dt * 3;
    if (this.invulnerable) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) this.invulnerable = false;
    }

    for (let i = this.statusEffects.length - 1; i >= 0; i--) {
      this.statusEffects[i].duration -= dt;
      if (this.statusEffects[i].type === "poison") {
        this.takeDamage(this.statusEffects[i].value * dt, null);
      }
      if (this.statusEffects[i].duration <= 0) {
        this.statusEffects.splice(i, 1);
      }
    }

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer -= dt;
      if (this.attackCooldownTimer <= 0 && this.attackCharges < this.maxAttackCharges) {
        this.attackCharges++;
        if (this.attackCharges < this.maxAttackCharges) {
          this.attackCooldownTimer = this.attackCooldown;
        }
      }
    }

    const timeSinceDamage = (Date.now() / 1000) - this.lastDamageTime;
    if (timeSinceDamage >= this.regenDelay && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.stats.regenRate * dt);
    }

    this.inBush = isInBush(this.x, this.y, map.bushes);
    this.inRiver = isInRiver(this.x, this.y, map.rivers);

    const result = collidesWithWalls(this.x, this.y, this.radius, map.walls);
    if (result.collides) {
      this.x = clamp(result.nx, this.radius, map.width - this.radius);
      this.y = clamp(result.ny, this.radius, map.height - this.radius);
    }

    this.x = clamp(this.x, this.radius, map.width - this.radius);
    this.y = clamp(this.y, this.radius, map.height - this.radius);
  }

  move(dx: number, dy: number, dt: number): void {
    if (!this.alive) return;
    
    let spd = this.speed * 60;
    
    if (this.inRiver) spd *= 0.6;
    
    const slowEffect = this.statusEffects.find(e => e.type === "slow");
    if (slowEffect) spd *= (1 - slowEffect.value);
    
    const berserk = this.statusEffects.find(e => e.type === "berserker");
    if (berserk) spd *= 1.4;
    
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      this.x += (dx / len) * spd * dt;
      this.y += (dy / len) * spd * dt;
      if (!this.isPlayer) {
        this.angle = Math.atan2(dy, dx);
      }
    }
  }

  takeDamage(amount: number, attacker: Brawler | null): number {
    if (!this.alive || this.invulnerable) return 0;
    
    let dmg = amount;
    
    const shield = this.statusEffects.find(e => e.type === "stun");
    if (shield && this.stats.id === "ronin") {
      dmg *= 0.5;
      if (attacker) {
        attacker.takeDamage(dmg * 0.3, null);
      }
    }
    
    const berserk = this.statusEffects.find(e => e.type === "berserker");
    if (berserk) dmg *= 1.2;
    
    this.hp -= dmg;
    this.lastDamageTime = Date.now() / 1000;
    this.hitFlash = 1;
    
    if (this.isPlayer) {
      spawnDamageNumber(this.x, this.y - this.radius - 10, Math.floor(dmg), "player");
    } else {
      spawnDamageNumber(this.x, this.y - this.radius - 10, Math.floor(dmg), "damage");
    }
    
    // Super now charges ONLY from successfully landing a hit on an enemy —
    // no passive/auto-fill. Each brawler has its own per-hit charge rate
    // (see BrawlerStats.superChargePerHit). Damage-over-time / environmental
    // ticks pass attacker = null and intentionally award no charge.
    if (attacker && attacker.alive && attacker.team !== this.team) {
      const gain = (attacker.stats.superChargePerHit / 100) * attacker.maxSuperCharge;
      attacker.superCharge = Math.min(attacker.maxSuperCharge, attacker.superCharge + gain);
      if (attacker.superCharge >= attacker.maxSuperCharge) attacker.superReady = true;
    }
    
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deathAnim = 0;
    }
    
    return dmg;
  }

  heal(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    spawnDamageNumber(this.x, this.y - this.radius - 10, Math.floor(amount), "heal");
  }

  addStatus(type: StatusEffect["type"], duration: number, value = 0): void {
    const existing = this.statusEffects.findIndex(e => e.type === type);
    if (existing >= 0) {
      this.statusEffects[existing].duration = duration;
    } else {
      this.statusEffects.push({ type, duration, value });
    }
  }

  canAttack(): boolean {
    return this.alive && this.attackCharges > 0;
  }

  useAttackCharge(): void {
    if (this.attackCharges <= 0) return;
    this.attackCharges--;
    this.isAttacking = true;
    this.attackAnim = 1;
    if (this.attackCharges < this.maxAttackCharges && this.attackCooldownTimer <= 0) {
      this.attackCooldownTimer = this.attackCooldown;
    }
  }

  canUseSuper(): boolean {
    return this.alive && this.superReady;
  }

  useSuper(): void {
    this.superReady = false;
    this.superCharge = 0;
    this.superAnim = 1;
  }

  shoot(angle: number): Projectile[] {
    const projs: Projectile[] = [];
    const spd = 400;
    const dmg = this.scaledDamage;
    
    this.useAttackCharge();

    switch (this.stats.id) {
      case "miya": {
        for (const offset of [-0.26, 0.26]) {
          const a = angle + offset;
          projs.push(createProjectile({
            x: this.x, y: this.y,
            vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
            radius: 8, damage: dmg,
            speed: spd, range: this.stats.attackRange,
            ownerId: this.id, ownerTeam: this.team,
            color: "#CE93D8", type: "shuriken", piercing: true,
          }));
        }
        break;
      }
      case "kibo": {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * 800, vy: Math.sin(angle) * 800,
          radius: 4, damage: dmg,
          speed: 800, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: "#40C4FF", type: "beam", piercing: true,
        }));
        break;
      }
      case "yuki": {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * 300, vy: Math.sin(angle) * 300,
          radius: 12, damage: dmg,
          speed: 300, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: "#B3E5FC", type: "snowball", piercing: false, slow: true,
        }));
        break;
      }
      case "sora": {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * 350, vy: Math.sin(angle) * 350,
          radius: 12, damage: dmg,
          speed: 350, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: "#FF6F00", type: "fireball", piercing: false,
          explosionRadius: 60,
        }));
        break;
      }
      case "rin": {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * 450, vy: Math.sin(angle) * 450,
          radius: 8, damage: dmg,
          speed: 450, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: "#69F0AE", type: "dagger", piercing: false, poison: true,
        }));
        break;
      }
      case "hana": {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * 420, vy: Math.sin(angle) * 420,
          radius: 8, damage: dmg,
          speed: 420, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: "#FF80AB", type: "bullet", piercing: false,
        }));
        break;
      }
      default: {
        projs.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
          radius: 8, damage: dmg,
          speed: spd, range: this.stats.attackRange,
          ownerId: this.id, ownerTeam: this.team,
          color: this.stats.color, type: "bullet", piercing: false,
        }));
      }
    }
    
    return projs;
  }

  meleeAttack(targets: Brawler[]): void {
    this.useAttackCharge();
    for (const target of targets) {
      if (target.id === this.id || !target.alive) continue;
      if (target.team === this.team) continue;
      const d = distance(this.x, this.y, target.x, target.y);
      
      let range = this.stats.attackRange;
      
      if (this.stats.id === "goro") {
        range = 90;
        if (d < range + target.radius) {
          const berserk = this.statusEffects.find(e => e.type === "berserker");
          const dmgMult = berserk ? 1.5 : 1;
          target.takeDamage(this.scaledDamage * dmgMult, this);
        }
      } else if (this.stats.id === "ronin") {
        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        const diff = Math.abs(angleTo(this.x, this.y, target.x, target.y) - this.angle);
        if (d < range + target.radius && diff < Math.PI / 3) {
          target.takeDamage(this.scaledDamage, this);
        }
      } else if (this.stats.id === "taro") {
        if (d < range + target.radius) {
          target.takeDamage(this.scaledDamage, this);
        }
      }
    }
  }

  activateSuper(targets: Brawler[], map: GameMap, projectiles: Projectile[]): void {
    if (!this.canUseSuper()) return;
    this.useSuper();

    switch (this.stats.id) {
      case "miya": {
        let nearest: Brawler | null = null;
        let nearestDist = 350;
        for (const t of targets) {
          if (!t.alive || t.team === this.team) continue;
          const d = distance(this.x, this.y, t.x, t.y);
          if (d < nearestDist) { nearestDist = d; nearest = t; }
        }
        if (nearest) {
          const angle = angleTo(nearest.x, nearest.y, this.x, this.y);
          this.x = clamp(nearest.x + Math.cos(angle) * 40, this.radius, map.width - this.radius);
          this.y = clamp(nearest.y + Math.sin(angle) * 40, this.radius, map.height - this.radius);
          // Teleport no longer deals damage — the player must follow up with attacks.
          nearest.addStatus("slow", 1.5, 0.5);
        }
        break;
      }
      case "kibo": {
        const angle = this.angle;
        projectiles.push(createProjectile({
          x: this.x, y: this.y,
          vx: Math.cos(angle) * 1000, vy: Math.sin(angle) * 1000,
          radius: 6, damage: 1200,
          speed: 1000, range: map.width + map.height,
          ownerId: this.id, ownerTeam: this.team,
          color: "#00E5FF", type: "beam", piercing: true,
        }));
        break;
      }
      case "ronin": {
        this.addStatus("stun", 4, 0);
        this.invulnerable = false;
        break;
      }
      case "yuki": {
        for (const t of targets) {
          if (!t.alive || t.team !== this.team) continue;
          if (distance(this.x, this.y, t.x, t.y) < 140) {
            t.addStatus("slow", 3, -0.3);
            t.heal(900);
          }
        }
        break;
      }
      case "kenji": {
        let chain = 3;
        let lastX = this.x, lastY = this.y;
        for (const t of targets) {
          if (!t.alive || t.team === this.team || chain <= 0) continue;
          if (distance(lastX, lastY, t.x, t.y) < 200) {
            t.takeDamage(this.scaledDamage * 2, this);
            t.addStatus("slow", 5, 0.3);
            lastX = t.x; lastY = t.y;
            chain--;
          }
        }
        break;
      }
      case "hana": {
        for (const t of targets) {
          if (!t.alive || t.team !== this.team) continue;
          if (distance(this.x, this.y, t.x, t.y) < 160) {
            t.heal(1200);
          }
        }
        for (const t of targets) {
          if (!t.alive || t.team === this.team) continue;
          if (distance(this.x, this.y, t.x, t.y) < 160) {
            t.takeDamage(300, this);
          }
        }
        break;
      }
      case "goro": {
        this.addStatus("berserker", 5, 0.4);
        break;
      }
      case "sora": {
        const targetX = this.x + Math.cos(this.angle) * 200;
        const targetY = this.y + Math.sin(this.angle) * 200;
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            const mx = targetX + (Math.random() - 0.5) * 200;
            const my = targetY + (Math.random() - 0.5) * 200;
            for (const t of targets) {
              if (!t.alive || t.team === this.team) continue;
              if (distance(mx, my, t.x, t.y) < 60) {
                t.takeDamage(250, this);
              }
            }
          }, i * 200);
        }
        break;
      }
      case "rin": {
        for (const t of targets) {
          if (!t.alive || t.team === this.team) continue;
          if (distance(this.x, this.y, t.x, t.y) < 100) {
            t.addStatus("poison", 6, 150);
          }
        }
        break;
      }
      case "taro": {
        break;
      }
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    spriteLoaded: boolean,
    viewerTeam?: string,
    friendlies?: { x: number; y: number }[]
  ): void {
    if (!this.alive && this.deathAnim > 1) return;
    
    const sx = this.x - camX;
    const sy = this.y - camY;
    
    if (sx < -this.radius * 2 || sx > 1200 + this.radius * 2) return;
    if (sy < -this.radius * 2 || sy > 800 + this.radius * 2) return;
    
    // Hide enemies in bushes completely until a friendly is close enough
    const isEnemyToViewer = viewerTeam !== undefined && !this.isPlayer && this.team !== viewerTeam;
    if (this.alive && this.inBush && isEnemyToViewer) {
      const REVEAL_RADIUS = 140;
      let revealed = false;
      if (friendlies) {
        for (const f of friendlies) {
          const ddx = f.x - this.x;
          const ddy = f.y - this.y;
          if (ddx * ddx + ddy * ddy <= REVEAL_RADIUS * REVEAL_RADIUS) {
            revealed = true;
            break;
          }
        }
      }
      if (!revealed) return;
    }
    
    let alpha = 1;
    if (!this.alive) {
      alpha = Math.max(0, 1 - this.deathAnim);
    } else if (this.inBush && this.isPlayer) {
      alpha = 0.6;
    } else if (this.inBush) {
      alpha = 0.85;
    }
    
    // Team relation indicator ring at feet
    if (this.alive && viewerTeam !== undefined) {
      let ringColor: string;
      if (this.isPlayer) ringColor = "#4CAF50";
      else if (this.team === viewerTeam) ringColor = "#2196F3";
      else ringColor = "#F44336";
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 4;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(sx, sy + this.radius - 2, this.radius * 1.15, this.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = ringColor;
      ctx.beginPath();
      ctx.ellipse(sx, sy + this.radius - 2, this.radius * 1.15, this.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    if (this.hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = this.hitFlash * 0.5;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(sx, sy, this.radius + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const glowColor = this.statusEffects.some(e => e.type === "berserker") ? "#FF0000" :
                      this.statusEffects.some(e => e.type === "stun") ? "#FFD700" : undefined;

    const drewImage = drawBrawlerImage(
      ctx,
      this.stats.id,
      sx,
      sy + 10,
      this.radius * 2.2,
      this.angle,
      alpha,
      glowColor,
    );

    if (drewImage) {
      // image rendered
    } else if (spriteLoaded) {
      drawCharacterSprite(
        ctx,
        this.stats.spriteRow,
        this.stats.spriteCol,
        sx,
        sy,
        this.radius * 3.5,
        this.angle > Math.PI / 2 || this.angle < -Math.PI / 2,
        alpha,
        glowColor
      );
    } else {
      ctx.save();
      ctx.globalAlpha = alpha;
      const bounce = !this.alive ? 0 : Math.sin(this.animFrame * 0.05) * 2;
      ctx.shadowColor = this.stats.color;
      ctx.shadowBlur = glowColor ? 20 : 8;
      ctx.beginPath();
      ctx.arc(sx, sy + bounce, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.hitFlash > 0 ? "#FFFFFF" : this.stats.color;
      ctx.fill();
      ctx.strokeStyle = this.stats.secondaryColor;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    if (this.attackAnim > 0) {
      ctx.save();
      ctx.globalAlpha = this.attackAnim * 0.7;
      ctx.strokeStyle = this.stats.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, this.radius + 8 + (1 - this.attackAnim) * 10, -0.5, 0.5);
      ctx.stroke();
      ctx.restore();
    }

    if (this.superAnim > 0) {
      ctx.save();
      ctx.globalAlpha = this.superAnim * 0.8;
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + this.superAnim * Math.PI;
        const r = this.radius + 15 + (1 - this.superAnim) * 20;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * (r - 8), sy + Math.sin(a) * (r - 8));
        ctx.lineTo(sx + Math.cos(a) * (r + 8), sy + Math.sin(a) * (r + 8));
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.alive) {
      this.renderHPBar(ctx, sx, sy, viewerTeam);
    }
    
    if (this.alive && this.isPlayer) {
      this.renderSuperBar(ctx, sx, sy);
    }
    
    if (this.alive && this.powerCubes > 0) {
      ctx.save();
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.shadowBlur = 3;
      ctx.fillText(`◆${this.powerCubes}`, sx, sy - this.radius - 30);
      ctx.restore();
    }
  }

  private renderHPBar(ctx: CanvasRenderingContext2D, sx: number, sy: number, viewerTeam?: string): void {
    const bw = this.radius * 2.6;
    const bh = 7;
    const bx = sx - bw / 2;
    const by = sy - this.radius - 20;
    const ratio = Math.max(0, Math.min(1, this.hp / this.maxHp));
    
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    
    let barColor = "#4CAF50";
    if (viewerTeam !== undefined) {
      if (this.isPlayer || this.team === viewerTeam) barColor = "#4CAF50";
      else barColor = "#F44336";
    } else {
      const r = Math.floor(255 * (1 - ratio));
      const g = Math.floor(255 * ratio);
      barColor = `rgb(${r},${g},0)`;
    }
    ctx.fillStyle = barColor;
    ctx.fillRect(bx, by, bw * ratio, bh);
    
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 10px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 3;
    ctx.fillText(`${Math.ceil(this.hp)} / ${this.maxHp}`, sx, by + bh / 2 + 0.5);
    ctx.restore();
  }

  private renderSuperBar(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    const bw = this.radius * 2.5;
    const bh = 4;
    const bx = sx - bw / 2;
    const by = sy - this.radius - 26;
    const ratio = this.superCharge / this.maxSuperCharge;
    
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = this.superReady ? "#FFD700" : "#7986CB";
    ctx.fillRect(bx, by, bw * ratio, bh);
  }
}
