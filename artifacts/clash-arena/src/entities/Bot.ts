import { Brawler, Team } from "./Brawler";
import { BrawlerStats } from "./BrawlerData";
import { Projectile } from "./Projectile";
import { GameMap, collidesWithWalls } from "../game/MapRenderer";
import { distance, angleTo, randomFloat, lineBlockedByWalls } from "../utils/helpers";

type BotState = "idle" | "chase" | "attack" | "retreat" | "wander" | "forced";

export class Bot extends Brawler {
  state: BotState = "idle";
  target: Brawler | null = null;
  wanderAngle = Math.random() * Math.PI * 2;
  wanderTimer = randomFloat(1, 3);
  attackTimer = 0;
  stateTimer = 0;
  crystalTarget?: { x: number; y: number };
  forcedTarget?: { x: number; y: number };
  
  constructor(stats: BrawlerStats, level: number, x: number, y: number, team: Team) {
    super(stats, level, x, y, team, false);
  }

  updateAI(dt: number, allBrawlers: Brawler[], map: GameMap, projectiles: Projectile[]): void {
    if (!this.alive) return;

    this.stateTimer -= dt;
    this.attackTimer -= dt;
    this.wanderTimer -= dt;

    // Bots no longer auto-charge their super passively — they earn it the same
    // way the player does, by landing hits on enemies (handled in Brawler.takeDamage).

    const enemies = allBrawlers.filter(b => b.alive && b.team !== this.team);

    let nearestEnemy: Brawler | null = null;
    let nearestDist = 9999;
    for (const e of enemies) {
      const d = distance(this.x, this.y, e.x, e.y);
      // Bushes hide enemies until very close
      if (e.inBush && d > 180) continue;
      if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
    }

    const hpRatio = this.hp / this.maxHp;
    
    // Use super whenever ready: low HP for escape, OR any enemy within reasonable range
    if (this.canUseSuper()) {
      const superRange = this.stats.attackRange * 1.3;
      const hasTargetInRange = nearestEnemy !== null && nearestDist < superRange;
      if (hpRatio < 0.4 || hasTargetInRange) {
        if (nearestEnemy) {
          this.angle = angleTo(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
        }
        this.activateSuper(allBrawlers, map, projectiles);
      }
    }

    const attackRange = this.stats.attackRange;
    const hasObjective = !!this.forcedTarget || !!this.crystalTarget;
    // With an objective: only engage when threats are close. Without: full 600px detection.
    const detectionRange = hasObjective ? attackRange * 1.25 : 600;

    if (this.forcedTarget) {
      const fd = distance(this.x, this.y, this.forcedTarget.x, this.forcedTarget.y);
      // Always shoot back when an enemy is in attack range, even at the destination
      if (nearestEnemy && nearestDist < attackRange) {
        this.target = nearestEnemy;
        this.angle = angleTo(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
        this.state = "attack";
      } else if (fd > 60) {
        this.target = null;
        this.state = "forced";
      } else {
        this.state = "forced";
        this.target = null;
      }
    } else if (nearestEnemy && nearestDist < detectionRange) {
      this.target = nearestEnemy;
      this.angle = angleTo(this.x, this.y, nearestEnemy.x, nearestEnemy.y);

      if (nearestDist < attackRange * 0.8) {
        this.state = "attack";
      } else {
        this.state = "chase";
      }
    } else {
      this.state = "wander";
      this.target = null;
    }

    switch (this.state) {
      case "chase":
        if (this.target) {
          const dx = this.target.x - this.x;
          const dy = this.target.y - this.y;
          const jitterX = randomFloat(-0.2, 0.2);
          const jitterY = randomFloat(-0.2, 0.2);
          const steered = this.steerAroundWalls(dx + jitterX, dy + jitterY, map);
          this.move(steered.x, steered.y, dt);
        }
        break;

      case "attack":
        if (this.target && this.target.alive) {
          const isMelee = ["goro", "ronin", "taro"].includes(this.stats.id);
          // Check that walls don't block our shot — bots understand walls
          const losBlocked = !isMelee && lineBlockedByWalls(this.x, this.y, this.target.x, this.target.y, map.walls);
          // Don't shoot if a friendly is right in our line of fire
          let friendlyInLine = false;
          if (!isMelee) {
            for (const ally of allBrawlers) {
              if (!ally.alive || ally.team !== this.team || ally.id === this.id) continue;
              // Project ally onto the bot→target line and check perpendicular distance
              const tx = this.target.x - this.x, ty = this.target.y - this.y;
              const len2 = tx * tx + ty * ty || 1;
              const ax = ally.x - this.x, ay = ally.y - this.y;
              const t = (ax * tx + ay * ty) / len2;
              if (t <= 0 || t >= 1) continue;
              const px = ax - t * tx, py = ay - t * ty;
              if (px * px + py * py < (ally.radius + 8) ** 2) { friendlyInLine = true; break; }
            }
          }

          if (this.attackTimer <= 0 && this.canAttack() && !losBlocked && !friendlyInLine) {
            const missChance = Math.random() < 0.15;
            const targetAngle = angleTo(this.x, this.y, this.target.x, this.target.y);
            const fireAngle = missChance ? targetAngle + randomFloat(-0.3, 0.3) : targetAngle;
            this.angle = fireAngle;

            if (isMelee) {
              this.meleeAttack(allBrawlers);
            } else {
              const newProjs = this.shoot(fireAngle);
              projectiles.push(...newProjs);
            }
            this.attackTimer = this.stats.attackCooldown * (0.8 + Math.random() * 0.6);
          } else if (losBlocked || friendlyInLine) {
            // No clean shot — sidestep to flank around the wall / teammate
            const toTarget = angleTo(this.x, this.y, this.target.x, this.target.y);
            const flankDir = (this.id.charCodeAt(0) % 2 === 0) ? 1 : -1;
            const flankAngle = toTarget + Math.PI / 2 * flankDir;
            const steered = this.steerAroundWalls(Math.cos(flankAngle), Math.sin(flankAngle), map);
            this.move(steered.x, steered.y, dt * 0.85);
            break;
          }
          
          // Strafe perpendicular to target to dodge incoming shots
          const toTarget = angleTo(this.x, this.y, this.target.x, this.target.y);
          const strafeDir = Math.sin(performance.now() * 0.003 + (this.wanderAngle || 0)) > 0 ? 1 : -1;
          const perp = toTarget + Math.PI / 2 * strafeDir;

          if (this.forcedTarget) {
            // Anchored attack: stay near objective, strafe in place
            const fd = distance(this.x, this.y, this.forcedTarget.x, this.forcedTarget.y);
            if (fd > 90) {
              const dx = this.forcedTarget.x - this.x;
              const dy = this.forcedTarget.y - this.y;
              const steered = this.steerAroundWalls(dx, dy, map);
              this.move(steered.x, steered.y, dt * 0.7);
            } else {
              const steered = this.steerAroundWalls(Math.cos(perp), Math.sin(perp), map);
              this.move(steered.x, steered.y, dt * 0.5);
            }
          } else if (nearestDist < attackRange * 0.5) {
            const awayAngle = angleTo(this.target.x, this.target.y, this.x, this.y) + randomFloat(-0.3, 0.3);
            this.move(Math.cos(awayAngle), Math.sin(awayAngle), dt * 0.6);
          } else if (nearestDist > attackRange * 0.85) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            this.move(dx, dy, dt * 0.5);
          } else {
            // In sweet spot — strafe to dodge
            const steered = this.steerAroundWalls(Math.cos(perp), Math.sin(perp), map);
            this.move(steered.x, steered.y, dt * 0.45);
          }
        }
        break;

      case "wander": {
        // If we have a crystal target, head straight to it instead of wandering
        if (this.crystalTarget) {
          const d = distance(this.x, this.y, this.crystalTarget.x, this.crystalTarget.y);
          if (d > 30) {
            const dx = this.crystalTarget.x - this.x;
            const dy = this.crystalTarget.y - this.y;
            const steered = this.steerAroundWalls(dx, dy, map);
            this.move(steered.x, steered.y, dt);
          }
          break;
        }
        if (this.wanderTimer <= 0) {
          this.wanderAngle += randomFloat(-Math.PI / 2, Math.PI / 2);
          this.wanderTimer = randomFloat(1.5, 4);
        }
        const wx = Math.cos(this.wanderAngle);
        const wy = Math.sin(this.wanderAngle);
        const steered = this.steerAroundWalls(wx, wy, map);
        // If still blocked, pick a new wander angle
        if (steered.x === 0 && steered.y === 0) {
          this.wanderAngle += Math.PI / 2 + randomFloat(-0.5, 0.5);
          this.wanderTimer = randomFloat(0.5, 1.5);
        }
        this.move(steered.x, steered.y, dt * 0.6);
        break;
      }

      case "forced":
        if (this.forcedTarget) {
          const dx = this.forcedTarget.x - this.x;
          const dy = this.forcedTarget.y - this.y;
          const steered = this.steerAroundWalls(dx, dy, map);
          this.move(steered.x, steered.y, dt);
        }
        break;
    }

  }

  private steerAroundWalls(dx: number, dy: number, map: GameMap): { x: number; y: number } {
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const lookahead = 70;
    const probeR = this.radius + 6;

    const test = (ax: number, ay: number) =>
      collidesWithWalls(this.x + ax * lookahead, this.y + ay * lookahead, probeR, map.walls).collides;

    if (!test(nx, ny)) return { x: nx, y: ny };

    // Try angled deviations: ±30°, ±60°, ±90°
    const deltas = [Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];
    const baseAngle = Math.atan2(ny, nx);
    for (const d of deltas) {
      const a = baseAngle + d;
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      if (!test(cx, cy)) return { x: cx, y: cy };
    }
    return { x: 0, y: 0 };
  }
}
