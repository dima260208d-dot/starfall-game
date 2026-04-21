import { Brawler, Team } from "./Brawler";
import { BrawlerStats } from "./BrawlerData";
import { Projectile } from "./Projectile";
import { GameMap } from "../game/MapRenderer";
import { distance, angleTo, randomFloat } from "../utils/helpers";

type BotState = "idle" | "chase" | "attack" | "retreat" | "wander";

export class Bot extends Brawler {
  state: BotState = "idle";
  target: Brawler | null = null;
  wanderAngle = Math.random() * Math.PI * 2;
  wanderTimer = randomFloat(1, 3);
  attackTimer = 0;
  stateTimer = 0;
  crystalTarget?: { x: number; y: number };
  
  constructor(stats: BrawlerStats, level: number, x: number, y: number, team: Team) {
    super(stats, level, x, y, team, false);
  }

  updateAI(dt: number, allBrawlers: Brawler[], map: GameMap, projectiles: Projectile[]): void {
    if (!this.alive) return;

    this.stateTimer -= dt;
    this.attackTimer -= dt;
    this.wanderTimer -= dt;

    const enemies = allBrawlers.filter(b => b.alive && b.team !== this.team);
    const allies = allBrawlers.filter(b => b.alive && b.team === this.team && b.id !== this.id);

    let nearestEnemy: Brawler | null = null;
    let nearestDist = 9999;
    for (const e of enemies) {
      const d = distance(this.x, this.y, e.x, e.y);
      if (d < nearestDist) { nearestDist = d; nearestEnemy = e; }
    }

    const hpRatio = this.hp / this.maxHp;
    
    if (hpRatio < 0.3 && this.canUseSuper()) {
      this.activateSuper(allBrawlers, map, projectiles);
    }

    const detectionRange = 350;
    const attackRange = this.stats.attackRange;

    if (nearestEnemy && nearestDist < detectionRange) {
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
          this.move(dx + jitterX, dy + jitterY, dt);
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

      case "wander":
        if (this.wanderTimer <= 0) {
          this.wanderAngle += randomFloat(-Math.PI / 2, Math.PI / 2);
          this.wanderTimer = randomFloat(1.5, 4);
        }
        this.move(Math.cos(this.wanderAngle), Math.sin(this.wanderAngle), dt * 0.6);
        break;
    }

    if (this.crystalTarget) {
      const d = distance(this.x, this.y, this.crystalTarget.x, this.crystalTarget.y);
      if (d > 60 && !nearestEnemy) {
        const dx = this.crystalTarget.x - this.x;
        const dy = this.crystalTarget.y - this.y;
        this.move(dx, dy, dt * 0.8);
      }
    }
  }
}
