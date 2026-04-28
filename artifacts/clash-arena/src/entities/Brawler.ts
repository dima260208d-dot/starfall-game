import { BrawlerStats, getScaledStats } from "./BrawlerData";
import { GameMap, collidesWithWalls, isInBush, isInRiver } from "../game/MapRenderer";
import { Projectile, createProjectile } from "./Projectile";
import { spawnDamageNumber } from "../utils/damageNumbers";
import { spawnEffect, makeZigzag } from "../utils/effects";
import { clamp, distance, angleTo } from "../utils/helpers";
import { addMatchStat } from "../utils/matchStats";
import { drawCharacterSprite, drawBrawlerImage } from "../game/sprites";
import { setRenderersBase, getCharRenderer, CHAR_3D_IDS, type CharAnim } from "../game/miyaTopDownRenderer";

// Record the base URL so lazy renderers know where to find the GLBs.
// Models are loaded on-demand the first time a character is rendered in-battle.
if (typeof window !== "undefined") {
  setRenderersBase((import.meta as any).env?.BASE_URL ?? "/");
}

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
  lastAttackTime = 0;
  
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

  // Tracked between frames so we can detect "is moving" for 3D-model brawlers
  // without changing the call sites that mutate position directly.
  private _lastRenderX = 0;
  private _lastRenderY = 0;
  private _movingSmoothed = 0; // 0 = idle, 1 = running, smoothed via lerp

  // Separate movement-facing angle: 3D characters face movement direction
  // when running/idle, and only briefly face attack direction when shooting.
  moveAngle = 0;
  private _smoothMoveAngle = 0;
  private _lastSmoothTs = 0;
  
  inBush = false;
  inRiver = false;
  bushRevealTimer = 0; // > 0 while briefly visible after attacking from a bush
  
  turret: Brawler | null = null;
  
  powerCubes = 0;

  // Display name shown above the brawler in match. For bots this is set to a
  // Russian-sounding nickname; for the local player it is set to the active
  // account username at match start.
  displayName: string = "";
  isBot: boolean = false;

  // ── Zafkiel "Time Cycle" mechanic ────────────────────────────────────────
  // normal mode: charges 0=Dalet, 1=Bet, 2=Zayin
  // enhanced mode (after super): 0=Aleph, 1=Gimmel, 2=Yud
  zafkielMode: "normal" | "enhanced" = "normal";
  zafkielChargeIdx: number = 0;
  // Position history for temporal-rewind effect (Dalet / super)
  posHistory: Array<{ x: number; y: number }> = [];
  private _posHistoryTimer: number = 0;

  // ── Per-mode badge (e.g. crystals carried, power cubes) ──────────────────
  // Set by game modes each frame; rendered above the name label.
  crystalCount: number = 0;

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

    // Initial spawn shield: 100% damage immunity for 5 seconds.
    this.grantSpawnShield(5);
  }

  setIdentity(displayName: string, isBot: boolean): void {
    this.displayName = displayName;
    this.isBot = isBot;
  }

  /** Restore this brawler at (x,y) with full HP, no statuses, charges reset
   *  and a 3-second invulnerability shield (used by team modes on respawn). */
  respawn(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.hp = this.maxHp;
    this.alive = true;
    this.deathAnim = 0;
    this.statusEffects = [];
    this.attackCharges = this.maxAttackCharges;
    this.attackCooldownTimer = 0;
    this.superCharge = 0;
    this.superReady = false;
    this.hitFlash = 0;
    this.grantSpawnShield(3);
  }

  /** Grant a damage-immunity bubble for `seconds` and spawn its visual ring. */
  grantSpawnShield(seconds: number): void {
    this.invulnerable = true;
    this.invulnerableTimer = seconds;
    spawnEffect({
      kind: "shieldDome",
      x: this.x, y: this.y,
      radius: this.radius + 14,
      color: "#80D8FF",
      timer: seconds, maxTimer: seconds,
      followBrawler: this,
    });
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
    if (this.attackAnim > 0) {
      this.attackAnim -= dt * 3;
      if (this.attackAnim <= 0) this.isAttacking = false;
    }
    if (this.superAnim > 0) this.superAnim -= dt * 2;
    
    if (this.hitFlash > 0) this.hitFlash -= dt * 3;
    if (this.bushRevealTimer > 0) this.bushRevealTimer -= dt;
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

    const now = Date.now() / 1000;
    const timeSinceDamage = now - this.lastDamageTime;
    const timeSinceAttack = now - this.lastAttackTime;
    if (
      timeSinceDamage >= this.regenDelay &&
      timeSinceAttack >= this.regenDelay &&
      !this.isAttacking &&
      this.hp < this.maxHp
    ) {
      this.hp = Math.min(this.maxHp, this.hp + this.stats.regenRate * dt);
    }

    // Track position history for temporal-rewind effect (Zafkiel Dalet / super)
    this._posHistoryTimer -= dt;
    if (this._posHistoryTimer <= 0) {
      this._posHistoryTimer = 0.2; // store every 200 ms
      this.posHistory.push({ x: this.x, y: this.y });
      if (this.posHistory.length > 10) this.posHistory.shift(); // keep ~2s
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
    
    // Stun freezes all movement
    if (this.statusEffects.some(e => e.type === "stun")) return;
    
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
      this.moveAngle = Math.atan2(dy, dx);
      if (!this.isPlayer) {
        this.angle = this.moveAngle;
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
      // Track damage for quest stats (player attacking enemy)
      if (attacker.isPlayer) addMatchStat("damageDealt", dmg);
    }
    
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.deathAnim = 0;
      // Track kill for quest stats (player killed an enemy)
      if (attacker?.isPlayer && !this.isPlayer) addMatchStat("killCount", 1);
    }
    
    return dmg;
  }

  heal(amount: number): void {
    if (!this.alive) return;
    const actual = Math.min(this.maxHp - this.hp, amount);
    this.hp = Math.min(this.maxHp, this.hp + amount);
    spawnDamageNumber(this.x, this.y - this.radius - 10, Math.floor(amount), "heal");
    if (this.isPlayer && actual > 0) addMatchStat("healingDone", actual);
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
    this.lastAttackTime = Date.now() / 1000;
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
    
    // Shooting from a bush briefly reveals the brawler to enemies (0.8s)
    if (this.inBush) this.bushRevealTimer = 0.8;
    
    this.useAttackCharge();

    // Generic muzzle flash so every shot has visual feedback (size keyed
    // off accentColor — this gives each brawler a uniquely tinted burst).
    spawnEffect({
      kind: "burst",
      x: this.x + Math.cos(angle) * (this.radius + 4),
      y: this.y + Math.sin(angle) * (this.radius + 4),
      radius: 14,
      color: this.stats.accentColor || this.stats.color,
      timer: 0.22, maxTimer: 0.22,
    });
    // A few outward sparks for kinetic punch.
    for (let i = 0; i < 4; i++) {
      const a = angle + (Math.random() - 0.5) * 0.7;
      const dist = 22 + Math.random() * 14;
      spawnEffect({
        kind: "spark",
        x: this.x + Math.cos(angle) * (this.radius + 4),
        y: this.y + Math.sin(angle) * (this.radius + 4),
        toX: this.x + Math.cos(angle) * (this.radius + 4) + Math.cos(a) * dist,
        toY: this.y + Math.sin(angle) * (this.radius + 4) + Math.sin(a) * dist,
        radius: 3,
        color: this.stats.accentColor || this.stats.color,
        timer: 0.28, maxTimer: 0.28,
      });
    }

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
      case "zafkiel": {
        const cIdx = this.zafkielChargeIdx % 3;
        // Muzzle origin slightly ahead of the caster
        const muzzleX = this.x + Math.cos(angle) * 18;
        const muzzleY = this.y + Math.sin(angle) * 18;

        if (this.zafkielMode === "normal") {
          if (cIdx === 0) {
            // ── Dalet: temporal ash beam — grey-white, slow + rewind ──
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 380, vy: Math.sin(angle) * 380,
              radius: 11, damage: 300,
              speed: 380, range: this.stats.attackRange,
              ownerId: this.id, ownerTeam: this.team,
              color: "#ECEFF1", type: "beam", piercing: false,
              slow: true, temporalRewind: 1.0,
            }));
            // Ghostly muzzle burst — clockface particles
            spawnEffect({ kind: "burst", x: muzzleX, y: muzzleY, radius: 28, color: "#CFD8DC", timer: 0.35, maxTimer: 0.35, secondary: "#90A4AE" });
            // Pale shockwave ring around caster
            spawnEffect({ kind: "shockwave", x: this.x, y: this.y, radius: 18, color: "#B0BEC5", timer: 0.22, maxTimer: 0.22 });
            // Trailing clock-hand spark along fire direction
            spawnEffect({ kind: "trail", x: this.x, y: this.y, toX: muzzleX + Math.cos(angle) * 40, toY: muzzleY + Math.sin(angle) * 40, radius: 3, color: "#E0E0E0", timer: 0.18, maxTimer: 0.18 });
          } else if (cIdx === 1) {
            // ── Bet: deep-blue slow orb ──
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 360, vy: Math.sin(angle) * 360,
              radius: 13, damage: 350,
              speed: 360, range: this.stats.attackRange,
              ownerId: this.id, ownerTeam: this.team,
              color: "#1E88E5", type: "snowball", piercing: false,
              slow: true,
            }));
            // Frosty muzzle burst with cyan inner glow
            spawnEffect({ kind: "burst", x: muzzleX, y: muzzleY, radius: 26, color: "#42A5F5", timer: 0.30, maxTimer: 0.30, secondary: "#0D47A1" });
            spawnEffect({ kind: "shockwave", x: this.x, y: this.y, radius: 16, color: "#1565C0", timer: 0.20, maxTimer: 0.20 });
          } else {
            // ── Zayin: purple stun beam ──
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 340, vy: Math.sin(angle) * 340,
              radius: 11, damage: 450,
              speed: 340, range: this.stats.attackRange,
              ownerId: this.id, ownerTeam: this.team,
              color: "#9C27B0", type: "beam", piercing: false,
              stunDuration: 0.6,
            }));
            spawnEffect({ kind: "burst", x: muzzleX, y: muzzleY, radius: 30, color: "#CE93D8", timer: 0.35, maxTimer: 0.35, secondary: "#6A1B9A" });
            // Lightning snap along attack direction
            spawnEffect({ kind: "lightningBolt", x: this.x, y: this.y, toX: muzzleX + Math.cos(angle) * 55, toY: muzzleY + Math.sin(angle) * 55, radius: 4, color: "#E040FB", timer: 0.18, maxTimer: 0.18 });
            spawnEffect({ kind: "shockwave", x: this.x, y: this.y, radius: 20, color: "#7B1FA2", timer: 0.25, maxTimer: 0.25 });
          }
        } else {
          // ── Enhanced mode (after Врата Вечности super) ──
          if (cIdx === 0) {
            // Aleph: blazing red hyper-beam (2× speed, deep pierce)
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 760, vy: Math.sin(angle) * 760,
              radius: 10, damage: 380,
              speed: 760, range: this.stats.attackRange * 1.2,
              ownerId: this.id, ownerTeam: this.team,
              color: "#FF1744", type: "beam", piercing: false,
            }));
            spawnEffect({ kind: "burst", x: muzzleX, y: muzzleY, radius: 28, color: "#FF5252", timer: 0.22, maxTimer: 0.22, secondary: "#B71C1C" });
            spawnEffect({ kind: "lightningBolt", x: this.x, y: this.y, toX: muzzleX + Math.cos(angle) * 60, toY: muzzleY + Math.sin(angle) * 60, radius: 5, color: "#FF6D00", timer: 0.16, maxTimer: 0.16 });
            spawnEffect({ kind: "shockwave", x: this.x, y: this.y, radius: 22, color: "#D50000", timer: 0.22, maxTimer: 0.22 });
          } else if (cIdx === 1) {
            // Gimmel: lime-gold poison dagger
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 380, vy: Math.sin(angle) * 380,
              radius: 11, damage: 300,
              speed: 380, range: this.stats.attackRange,
              ownerId: this.id, ownerTeam: this.team,
              color: "#AEEA00", type: "dagger", piercing: false,
              poison: true,
            }));
            spawnEffect({ kind: "burst", x: muzzleX, y: muzzleY, radius: 26, color: "#CCFF90", timer: 0.30, maxTimer: 0.30, secondary: "#33691E" });
            // Poison cloud wisps
            spawnEffect({ kind: "spark", x: muzzleX, y: muzzleY, radius: 14, color: "#76FF03", timer: 0.40, maxTimer: 0.40 });
            spawnEffect({ kind: "shockwave", x: this.x, y: this.y, radius: 16, color: "#AEEA00", timer: 0.20, maxTimer: 0.20 });
          } else {
            // Yud: amber homing orb — locks on and chases
            projs.push(createProjectile({
              x: this.x, y: this.y,
              vx: Math.cos(angle) * 360, vy: Math.sin(angle) * 360,
              radius: 14, damage: 400,
              speed: 360, range: this.stats.attackRange * 1.5,
              ownerId: this.id, ownerTeam: this.team,
              color: "#FFAB00", type: "bullet", piercing: false,
              homing: true,
            }));
            spawnEffect({ kind: "burst", x: muzzleX, y: muzzleY, radius: 30, color: "#FFD740", timer: 0.35, maxTimer: 0.35, secondary: "#E65100" });
            spawnEffect({ kind: "shockwave", x: this.x, y: this.y, radius: 24, color: "#FF8F00", timer: 0.28, maxTimer: 0.28 });
          }
          // After all 3 enhanced charges, cycle returns to normal
          if (cIdx === 2) {
            this.zafkielMode = "normal";
            this.zafkielChargeIdx = 0;
            // Grand cycle-end visual: double shockwave + burst
            spawnEffect({ kind: "shockwave", x: this.x, y: this.y, radius: 40, color: "#7C4DFF", timer: 0.5, maxTimer: 0.5 });
            spawnEffect({ kind: "burst",     x: this.x, y: this.y, radius: 36, color: "#B388FF", timer: 0.4, maxTimer: 0.4 });
            break;
          }
        }
        this.zafkielChargeIdx = (this.zafkielChargeIdx + 1) % 3;
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
    // Visual swing arc — a quick crescent burst in front of the brawler.
    const reach = this.stats.attackRange + this.radius;
    spawnEffect({
      kind: "burst",
      x: this.x + Math.cos(this.angle) * reach * 0.5,
      y: this.y + Math.sin(this.angle) * reach * 0.5,
      radius: reach * 0.55,
      color: this.stats.accentColor || this.stats.color,
      timer: 0.28, maxTimer: 0.28,
    });
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

  activateSuper(targets: Brawler[], map: GameMap, projectiles: Projectile[], targetX?: number, targetY?: number): void {
    if (!this.canUseSuper()) return;
    if (this.isPlayer) addMatchStat("superUses", 1);
    this.useSuper();

    // Generic "super-cast" flash centered on the brawler — every super
    // gets a bright golden ring so the moment of activation is unmistakable.
    spawnEffect({
      kind: "shockwave", x: this.x, y: this.y,
      radius: this.radius * 2.5, color: "#FFD700",
      timer: 0.55, maxTimer: 0.55,
    });

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
          const fromX = this.x, fromY = this.y;
          const angle = angleTo(nearest.x, nearest.y, this.x, this.y);
          this.x = clamp(nearest.x + Math.cos(angle) * 40, this.radius, map.width - this.radius);
          this.y = clamp(nearest.y + Math.sin(angle) * 40, this.radius, map.height - this.radius);
          // Teleport strike: Miya deals her standard super burst on arrival.
          nearest.takeDamage(this.scaledDamage * 1.6, this);
          nearest.addStatus("slow", 1.5, 0.5);
          // Departure swirl
          spawnEffect({
            kind: "teleportFlash", x: fromX, y: fromY,
            radius: 36, color: "#CE93D8",
            timer: 0.6, maxTimer: 0.6,
          });
          // Purple trail line connecting both points
          spawnEffect({
            kind: "trail", x: fromX, y: fromY, toX: this.x, toY: this.y,
            radius: 6, color: "#CE93D8", secondary: "#FFFFFF",
            timer: 0.45, maxTimer: 0.45,
          });
          // Arrival swirl
          spawnEffect({
            kind: "teleportFlash", x: this.x, y: this.y,
            radius: 38, color: "#CE93D8",
            timer: 0.6, maxTimer: 0.6,
          });
        }
        break;
      }
      case "ronin": {
        this.addStatus("stun", 4, 0);
        this.invulnerable = false;
        // Persistent shield dome that follows the brawler for the duration.
        spawnEffect({
          kind: "shieldDome", x: this.x, y: this.y,
          radius: this.radius + 18, color: "#FFD700",
          timer: 4, maxTimer: 4,
          followBrawler: this,
          linkedStatus: "stun",
        });
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
        // Snow zone visual lasting for the buff duration.
        spawnEffect({
          kind: "snowZone", x: this.x, y: this.y,
          radius: 140, color: "#B3E5FC",
          timer: 6, maxTimer: 6,
          particleCount: 18,
        });
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
            // Lightning chain segment from last hit to this target.
            spawnEffect({
              kind: "lightningBolt", x: lastX, y: lastY, toX: t.x, toY: t.y,
              radius: 4, color: "#FFEB3B",
              timer: 0.5, maxTimer: 0.5,
              zigzag: makeZigzag(lastX, lastY, t.x, t.y, 7, 22),
            });
            spawnEffect({
              kind: "burst", x: t.x, y: t.y,
              radius: 28, color: "#FFEB3B",
              timer: 0.45, maxTimer: 0.45,
            });
            lastX = t.x; lastY = t.y;
            chain--;
          }
        }
        // Persistent electric cage centered on the activator (5 sec).
        spawnEffect({
          kind: "lightCage", x: this.x, y: this.y,
          radius: 110, color: "#FFEB3B",
          timer: 5, maxTimer: 5,
        });
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
        // Garden zone visual that lingers for 5 seconds.
        spawnEffect({
          kind: "petalZone", x: this.x, y: this.y,
          radius: 160, color: "#FF80AB",
          timer: 5, maxTimer: 5,
          particleCount: 20,
        });
        break;
      }
      case "goro": {
        this.addStatus("berserker", 5, 0.4);
        // Fire aura that follows the brawler while berserker is active.
        spawnEffect({
          kind: "berserkAura", x: this.x, y: this.y,
          radius: this.radius + 8, color: "#FF3D00",
          timer: 5, maxTimer: 5,
          followBrawler: this,
          linkedStatus: "berserker",
        });
        break;
      }
      case "sora": {
        const targetX = this.x + Math.cos(this.angle) * 200;
        const targetY = this.y + Math.sin(this.angle) * 200;
        // Spawn 5 staggered meteors with a 0.6s warning each. The meteor
        // effect itself handles delay → damage → shockwave.
        for (let i = 0; i < 5; i++) {
          const mx = targetX + (Math.random() - 0.5) * 200;
          const my = targetY + (Math.random() - 0.5) * 200;
          spawnEffect({
            kind: "meteor", x: mx, y: my,
            radius: 16, color: "#FF6F00",
            timer: 1.6 + i * 0.25, maxTimer: 1.6 + i * 0.25,
            delay: 0.6 + i * 0.25,
            tickRange: 60,
            ownerId: this.id, ownerTeam: this.team,
            damagePerTick: 250,
            fallHeight: 360,
          });
        }
        break;
      }
      case "rin": {
        // Place the poison cloud at the aimed location (capped to 300 units
        // from Rin). When no aim is supplied (e.g. bots) it falls back to
        // her current position.
        let zx = this.x, zy = this.y;
        if (typeof targetX === "number" && typeof targetY === "number") {
          const dx = targetX - this.x, dy = targetY - this.y;
          const d = Math.hypot(dx, dy);
          const maxR = 300;
          if (d > maxR && d > 0) {
            zx = this.x + (dx / d) * maxR;
            zy = this.y + (dy / d) * maxR;
          } else {
            zx = targetX; zy = targetY;
          }
          zx = clamp(zx, this.radius, map.width - this.radius);
          zy = clamp(zy, this.radius, map.height - this.radius);
        }
        for (const t of targets) {
          if (!t.alive || t.team === this.team) continue;
          if (distance(zx, zy, t.x, t.y) < 100) {
            t.addStatus("poison", 6, 150);
          }
        }
        spawnEffect({
          kind: "poisonZone", x: zx, y: zy,
          radius: 100, color: "#69F0AE",
          timer: 4, maxTimer: 4,
          particleCount: 14,
        });
        break;
      }
      case "taro": {
        // Drop a stationary mech turret in front of the brawler.
        const tx = clamp(this.x + Math.cos(this.angle) * 50, this.radius, map.width - this.radius);
        const ty = clamp(this.y + Math.sin(this.angle) * 50, this.radius, map.height - this.radius);
        spawnEffect({
          kind: "turret", x: tx, y: ty,
          radius: 30, color: "#FFEB3B",
          timer: 12, maxTimer: 12,
          ownerId: this.id, ownerTeam: this.team,
          tickInterval: 0.55, tickTimer: 0.4,
          tickRange: 250, damagePerTick: 150,
        });
        break;
      }
      case "zafkiel": {
        // Врата Вечности — area that rewinds enemies to their past position
        const superRadius = 120;
        const superX = typeof targetX === "number" ? clamp(targetX, this.radius, map.width - this.radius) : this.x;
        const superY = typeof targetY === "number" ? clamp(targetY, this.radius, map.height - this.radius) : this.y;

        // Rewind all enemies in range to 2s-ago position
        for (const t of targets) {
          if (!t.alive || t.team === this.team) continue;
          if (distance(superX, superY, t.x, t.y) < superRadius) {
            // Teleport to 2s-ago position (posHistory[0]) or slow if no history
            if (t.posHistory.length >= 2) {
              const pastPos = t.posHistory[0];
              // Flash at current position
              spawnEffect({
                kind: "teleportFlash", x: t.x, y: t.y,
                radius: 28, color: "#B388FF",
                timer: 0.5, maxTimer: 0.5,
              });
              t.x = clamp(pastPos.x, t.radius, map.width - t.radius);
              t.y = clamp(pastPos.y, t.radius, map.height - t.radius);
              spawnEffect({
                kind: "teleportFlash", x: t.x, y: t.y,
                radius: 28, color: "#7C4DFF",
                timer: 0.5, maxTimer: 0.5,
              });
            } else {
              // No position history — apply slow instead
              t.addStatus("slow", 2, 0.5);
            }
          }
        }

        // ── Врата Вечности: layered gate-opening visual ──
        // 1. Outer golden shockwave — announces the gate
        spawnEffect({ kind: "shockwave", x: superX, y: superY, radius: superRadius * 1.2, color: "#FFD700", timer: 0.55, maxTimer: 0.55 });
        // 2. Inner dark-purple shockwave
        spawnEffect({ kind: "shockwave", x: superX, y: superY, radius: superRadius * 0.7, color: "#7C4DFF", timer: 0.45, maxTimer: 0.45 });
        // 3. Swirling temporal zone (snowZone = swirling particles)
        spawnEffect({
          kind: "snowZone", x: superX, y: superY,
          radius: superRadius, color: "#9C27B0",
          timer: 4.5, maxTimer: 4.5,
          particleCount: 28,
        });
        // 4. Lightning arcs around the gate centre
        spawnEffect({ kind: "lightningBolt", x: superX, y: superY, toX: superX + superRadius * 0.8, toY: superY, radius: 5, color: "#E040FB", timer: 0.25, maxTimer: 0.25 });
        spawnEffect({ kind: "lightningBolt", x: superX, y: superY, toX: superX - superRadius * 0.8, toY: superY, radius: 5, color: "#E040FB", timer: 0.25, maxTimer: 0.25 });
        spawnEffect({ kind: "lightningBolt", x: superX, y: superY, toX: superX, toY: superY - superRadius * 0.8, radius: 5, color: "#CE93D8", timer: 0.25, maxTimer: 0.25 });
        // 5. Large burst at centre
        spawnEffect({ kind: "burst", x: superX, y: superY, radius: 55, color: "#B388FF", timer: 0.40, maxTimer: 0.40, secondary: "#4A148C" });

        // Switch to enhanced mode with 3 powered charges
        this.zafkielMode = "enhanced";
        this.zafkielChargeIdx = 0;
        // 6. Violet berserk aura on Zafkiel herself while enhanced
        spawnEffect({
          kind: "berserkAura", x: this.x, y: this.y,
          radius: this.radius + 12, color: "#7C4DFF",
          timer: 4.5, maxTimer: 4.5,
          followBrawler: this,
        });
        // 7. Teleport flash at caster to signal power-up
        spawnEffect({ kind: "teleportFlash", x: this.x, y: this.y, radius: 32, color: "#EDE7F6", timer: 0.45, maxTimer: 0.45 });
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
    friendlies?: { x: number; y: number }[],
    projSY?: number
  ): void {
    // Dead brawlers remain visible (lying on the ground) — never fully hidden.
    
    const sx = this.x - camX;
    const sy = projSY !== undefined ? projSY : this.y - camY;
    
    if (sx < -this.radius * 2 || sx > 1200 + this.radius * 2) return;
    if (sy < -this.radius * 2 || sy > 800 + this.radius * 2) return;
    
    // Hide enemies in bushes — revealed only when a friendly is close or they shot recently
    const isEnemyToViewer = viewerTeam !== undefined && !this.isPlayer && this.team !== viewerTeam;
    if (this.alive && this.inBush && isEnemyToViewer) {
      const REVEAL_RADIUS = 140;
      let revealed = this.bushRevealTimer > 0; // briefly visible after shooting
      if (!revealed && friendlies) {
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
      // Fade from 1 → 0.45 over ~0.4 s, then hold at 0.45 so the body stays visible.
      alpha = Math.max(0.45, 1 - this.deathAnim * 1.4);
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

    // 3D characters are rendered via an off-screen WebGL renderer.
    let drewImage = false;
    const charRenderer = CHAR_3D_IDS.has(this.stats.id) ? getCharRenderer(this.stats.id) : null;
    if (charRenderer && charRenderer.isReady()) {
      const dx = this.x - this._lastRenderX;
      const dy = this.y - this._lastRenderY;
      const moved = Math.hypot(dx, dy);
      const isMovingNow = moved > 0.3 ? 1 : 0;
      this._movingSmoothed = this._movingSmoothed * 0.7 + isMovingNow * 0.3;
      this._lastRenderX = this.x;
      this._lastRenderY = this.y;

      // Smooth the movement angle towards the target (shortest arc, 360°).
      const now = performance.now();
      const rdt = this._lastSmoothTs > 0 ? Math.min(0.1, (now - this._lastSmoothTs) / 1000) : 1 / 60;
      this._lastSmoothTs = now;
      let diff = this.moveAngle - this._smoothMoveAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      this._smoothMoveAngle += diff * Math.min(1, rdt * 14);

      const anim: CharAnim = !this.alive
        ? "dead"
        : this.attackAnim > 0.05
          ? "attack"
          : this._movingSmoothed > 0.5 ? "run" : "idle";
      // Dead: keep last facing angle. Attack: aim direction. Otherwise: smooth move angle.
      const renderAngle = anim === "dead" ? this._smoothMoveAngle
        : anim === "attack" ? this.angle : this._smoothMoveAngle;
      const off = charRenderer.render(this.id, anim, renderAngle);
      if (off) {
        const drawSize = this.radius * 3.2;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (glowColor) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 24;
        }
        ctx.drawImage(off, sx - drawSize / 2, sy - drawSize * 0.62, drawSize, drawSize);
        ctx.restore();
        drewImage = true;
      }
    }

    if (!drewImage) {
      drewImage = drawBrawlerImage(
        ctx,
        this.stats.id,
        sx,
        sy + 10,
        this.radius * 1.8,
        this.angle,
        alpha,
        glowColor,
      );
    }

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
      this.renderNameLabel(ctx, sx, sy, viewerTeam);
      this.renderHPBar(ctx, sx, sy, viewerTeam);
      this.renderAmmoBar(ctx, sx, sy, viewerTeam);
    }

    if (this.alive && this.isPlayer) {
      this.renderSuperBar(ctx, sx, sy);
    }

  }

  private renderNameLabel(ctx: CanvasRenderingContext2D, sx: number, sy: number, viewerTeam?: string): void {
    if (!this.displayName) return;
    const labelY = sy - this.radius - 56;
    ctx.save();
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 4;

    if (this.isBot) {
      const tag = "БОТ";
      const nm = ` ${this.displayName}`;
      const tagW = ctx.measureText(tag).width;
      const nmW = ctx.measureText(nm).width;
      const totalW = tagW + nmW;
      const startX = sx - totalW / 2;
      ctx.textAlign = "left";
      ctx.fillStyle = "#FFD740";
      ctx.fillText(tag, startX, labelY);
      ctx.fillStyle = viewerTeam !== undefined && this.team !== viewerTeam
        ? "#FF8A80"
        : "rgba(255,255,255,0.92)";
      ctx.fillText(nm, startX + tagW, labelY);
    } else {
      ctx.fillStyle = this.isPlayer
        ? "#FFFFFF"
        : (viewerTeam !== undefined && this.team !== viewerTeam ? "#FF8A80" : "#A5D6A7");
      ctx.fillText(this.displayName, sx, labelY);
    }
    ctx.restore();

    // ── Badges above the name ──────────────────────────────────────────────
    // Stack up from labelY - 2: powerCubes (jars) and crystalCount
    let badgeTop = labelY - 14;

    if (this.powerCubes > 0) {
      // Mini jar + count
      const jarR = 6;
      ctx.save();
      ctx.shadowColor = "#E040FB";
      ctx.shadowBlur = 6;
      // pill background
      const pillW = 36, pillH = 14;
      ctx.fillStyle = "rgba(0,0,0,0.68)";
      ctx.beginPath();
      ctx.roundRect(sx - pillW / 2, badgeTop - pillH / 2, pillW, pillH, 5);
      ctx.fill();
      // jar body
      const jGrad = ctx.createLinearGradient(sx - pillW * 0.4, badgeTop - jarR, sx - pillW * 0.4 + jarR * 1.4, badgeTop + jarR);
      jGrad.addColorStop(0, "#CE93D8");
      jGrad.addColorStop(1, "#7B1FA2");
      ctx.fillStyle = jGrad;
      ctx.beginPath();
      ctx.roundRect(sx - pillW * 0.42, badgeTop - jarR * 0.85, jarR * 1.3, jarR * 1.7, jarR * 0.35);
      ctx.fill();
      // jar lid
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(sx - pillW * 0.42, badgeTop - jarR * 0.85 - 2, jarR * 1.3, 2.5);
      // count
      ctx.fillStyle = "#FFE082";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`×${this.powerCubes}`, sx + pillW * 0.13, badgeTop);
      ctx.restore();
      badgeTop -= 16;
    }

    if (this.crystalCount > 0) {
      // Mini crystal + count
      ctx.save();
      ctx.shadowColor = "#00E5FF";
      ctx.shadowBlur = 6;
      const pillW = 34, pillH = 14;
      ctx.fillStyle = "rgba(0,0,0,0.68)";
      ctx.beginPath();
      ctx.roundRect(sx - pillW / 2, badgeTop - pillH / 2, pillW, pillH, 5);
      ctx.fill();
      // diamond shape
      const cs = 5;
      const cx0 = sx - pillW * 0.25, cy0 = badgeTop;
      ctx.fillStyle = "#00E5FF";
      ctx.beginPath();
      ctx.moveTo(cx0, cy0 - cs); ctx.lineTo(cx0 + cs * 0.7, cy0);
      ctx.lineTo(cx0, cy0 + cs); ctx.lineTo(cx0 - cs * 0.7, cy0);
      ctx.closePath();
      ctx.fill();
      // highlight
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.beginPath();
      ctx.moveTo(cx0 - cs * 0.2, cy0 - cs * 0.6); ctx.lineTo(cx0 + cs * 0.3, cy0 - cs * 0.1);
      ctx.lineTo(cx0 - cs * 0.05, cy0 + cs * 0.4); ctx.closePath();
      ctx.fill();
      // count
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#80DEEA";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`×${this.crystalCount}`, sx + pillW * 0.15, badgeTop);
      ctx.restore();
    }
  }

  private renderAmmoBar(ctx: CanvasRenderingContext2D, sx: number, sy: number, viewerTeam?: string): void {
    if (this.maxAttackCharges <= 0) return;
    // Don't show ammo count to enemies — only player and allies see ammo bars
    if (viewerTeam !== undefined && !this.isPlayer && this.team !== viewerTeam) return;
    // Sit just below the HP bar, which now lives at sy - radius - 38.
    const by = sy - this.radius - 26;
    const totalW = this.radius * 2.6;
    const segGap = 2;
    const segW = (totalW - segGap * (this.maxAttackCharges - 1)) / this.maxAttackCharges;
    const segH = 4;
    const startX = sx - totalW / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(startX - 1, by - 1, totalW + 2, segH + 2);
    for (let i = 0; i < this.maxAttackCharges; i++) {
      const x = startX + i * (segW + segGap);
      const filled = i < this.attackCharges;
      if (filled) {
        ctx.fillStyle = this.stats.accentColor;
      } else {
        // Show recharge progress on the next-empty slot.
        const isNext = i === Math.floor(this.attackCharges);
        const partial = isNext ? 1 - (this.attackCooldownTimer / this.attackCooldown) : 0;
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(x, by, segW, segH);
        if (partial > 0) {
          ctx.fillStyle = `${this.stats.accentColor}`;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(x, by, segW * partial, segH);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      ctx.fillRect(x, by, segW, segH);
    }
    ctx.restore();
  }

  private renderHPBar(ctx: CanvasRenderingContext2D, sx: number, sy: number, viewerTeam?: string): void {
    const bw = this.radius * 2.6;
    const bh = 7;
    const bx = sx - bw / 2;
    // Raised so the HP bar (and the ammo row right under it) no longer
    // overlaps the brawler sprite. Was sy-radius-20.
    const by = sy - this.radius - 38;
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
    // Slim super-charge bar tucked just above the HP/ammo cluster.
    const by = sy - this.radius - 46;
    const ratio = this.superCharge / this.maxSuperCharge;
    
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = this.superReady ? "#FFD700" : "#7986CB";
    ctx.fillRect(bx, by, bw * ratio, bh);
  }
}
