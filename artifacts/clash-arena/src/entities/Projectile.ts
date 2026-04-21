import { GameMap, collidesWithWalls } from "../game/MapRenderer";

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  speed: number;
  range: number;
  distanceTraveled: number;
  ownerId: string;
  ownerTeam: string;
  color: string;
  type: "bullet" | "shuriken" | "snowball" | "fireball" | "dagger" | "chain" | "beam";
  active: boolean;
  piercing: boolean;
  hitIds: Set<string>;
  poison?: boolean;
  slow?: boolean;
  explosionRadius?: number;
}

let projIdCounter = 0;

export function createProjectile(params: Omit<Projectile, "id" | "active" | "hitIds" | "distanceTraveled">): Projectile {
  return {
    ...params,
    id: `proj_${projIdCounter++}`,
    active: true,
    hitIds: new Set(),
    distanceTraveled: 0,
  };
}

export function updateProjectiles(
  projectiles: Projectile[],
  dt: number,
  map: GameMap
): void {
  for (const proj of projectiles) {
    if (!proj.active) continue;

    const prevX = proj.x;
    const prevY = proj.y;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    const dx = proj.x - prevX;
    const dy = proj.y - prevY;
    proj.distanceTraveled += Math.sqrt(dx * dx + dy * dy);

    if (proj.distanceTraveled >= proj.range) {
      proj.active = false;
      continue;
    }

    if (proj.x < 0 || proj.x > map.width || proj.y < 0 || proj.y > map.height) {
      proj.active = false;
      continue;
    }

    if (proj.type !== "beam") {
      const col = collidesWithWalls(proj.x, proj.y, proj.radius, map.walls);
      if (col.collides && !proj.piercing) {
        if (proj.type === "fireball") {
        } else {
          proj.active = false;
        }
      }
    }
  }
}

export function renderProjectiles(
  ctx: CanvasRenderingContext2D,
  projectiles: Projectile[],
  camX: number,
  camY: number,
  frame: number
): void {
  for (const proj of projectiles) {
    if (!proj.active) continue;

    const sx = proj.x - camX;
    const sy = proj.y - camY;

    ctx.save();
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 10;

    switch (proj.type) {
      case "shuriken": {
        ctx.translate(sx, sy);
        ctx.rotate(frame * 0.3);
        ctx.fillStyle = proj.color;
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 2);
          ctx.beginPath();
          ctx.moveTo(0, -proj.radius * 1.5);
          ctx.lineTo(proj.radius * 0.5, 0);
          ctx.lineTo(0, proj.radius * 1.5);
          ctx.lineTo(-proj.radius * 0.5, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        break;
      }
      case "snowball": {
        ctx.beginPath();
        ctx.arc(sx, sy, proj.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#B3E5FC";
        ctx.fill();
        ctx.strokeStyle = "#E1F5FE";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.beginPath();
        ctx.arc(sx - proj.radius * 0.3, sy - proj.radius * 0.3, proj.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "fireball": {
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, proj.radius * 1.5);
        grad.addColorStop(0, "#FFFF00");
        grad.addColorStop(0.5, "#FF6600");
        grad.addColorStop(1, "rgba(255,0,0,0)");
        ctx.beginPath();
        ctx.arc(sx, sy, proj.radius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        break;
      }
      case "dagger": {
        ctx.translate(sx, sy);
        ctx.rotate(Math.atan2(proj.vy, proj.vx));
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.moveTo(proj.radius * 1.5, 0);
        ctx.lineTo(-proj.radius * 0.5, -proj.radius * 0.4);
        ctx.lineTo(-proj.radius * 0.5, proj.radius * 0.4);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "beam": {
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(
          sx + Math.cos(Math.atan2(proj.vy, proj.vx)) * proj.range,
          sy + Math.sin(Math.atan2(proj.vy, proj.vx)) * proj.range
        );
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      }
      default: {
        ctx.beginPath();
        ctx.arc(sx, sy, proj.radius, 0, Math.PI * 2);
        ctx.fillStyle = proj.color;
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
