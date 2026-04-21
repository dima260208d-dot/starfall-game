import { Brawler, Team } from "./Brawler";
import { BrawlerStats } from "./BrawlerData";
import { Projectile } from "./Projectile";
import { GameMap, collidesWithWalls } from "../game/MapRenderer";
import { distance, angleTo, randomFloat } from "../utils/helpers";

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
    
    if (hpRatio < 0.3 && this.canUseSuper()) {
      this.activateSuper(allBrawlers, map, projectiles);
    }

    const detectionRange = this.forcedTarget ? this.stats.attackRange * 1.1 : 600;
    const attackRange = this.stats.attackRange;

    if (this.forcedTarget) {
      const fd = distance(this.x, this.y, this.forcedTarget.x, this.forcedTarget.y);
      if (fd > 60) {
        if (nearestEnemy && nearestDist < attackRange * 0.9) {
          this.target = nearestEnemy;
          this.angle = angleTo(this.x, this.y, nearestEnemy.x, nearestEnemy.y);
          this.state = "attack";
        } else {
          this.target = null;
          this.state = "forced";
        }
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
          if (this.attackTimer <= 0 && this.canAttack()) {
            const missChance = Math.random() < 0.15;
            const targetAngle = angleTo(this.x, this.y, this.target.x, this.target.y);
            const fireAngle = missChance ? targetAngle + randomFloat(-0.3, 0.3) : targetAngle;
            this.angle = fireAngle;
            
            const isMelee = ["goro", "ronin", "taro"].includes(this.stats.id);
            if (isMelee) {
              this.meleeAttack(allBrawlers);
            } else {
              const newProjs = this.shoot(fireAngle);
              projectiles.push(...newProjs);
            }
            this.attackTimer = this.stats.attackCooldown * (0.8 + Math.random() * 0.6);
          }
          
          if (nearestDist < attackRange * 0.5) {
            const awayAngle = angleTo(this.target.x, this.target.y, this.x, this.y) + randomFloat(-0.3, 0.3);
            this.move(Math.cos(awayAngle), Math.sin(awayAngle), dt * 0.5);
          } else if (nearestDist > attackRange * 0.9) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            this.move(dx, dy, dt * 0.4);
          }
        }
        break;

      case "wander": {
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

    if (!this.forcedTarget && this.crystalTarget && this.state === "wander") {
      const d = distance(this.x, this.y, this.crystalTarget.x, this.crystalTarget.y);
      if (d > 60) {
        const dx = this.crystalTarget.x - this.x;
        const dy = this.crystalTarget.y - this.y;
        const steered = this.steerAroundWalls(dx, dy, map);
        this.move(steered.x, steered.y, dt * 0.9);
      }
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
