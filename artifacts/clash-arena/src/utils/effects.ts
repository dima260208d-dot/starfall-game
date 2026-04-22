import type { Brawler } from "../entities/Brawler";

export type EffectKind =
  | "burst"        // Quick expanding ring + radial sparks (muzzle / impact)
  | "shockwave"    // Larger expanding ring (sora meteor impact, kibo super tail)
  | "spark"        // Tiny short-lived particle (gun smoke / trail dust)
  | "trail"        // Fading line segment (teleport line, dagger trace)
  | "snowZone"     // Yuki super: swirling snowflakes inside an ice circle
  | "lightCage"    // Kenji super: rotating electric arcs around a fixed area
  | "petalZone"    // Hana super: floating pink petals inside a heal circle
  | "poisonZone"   // Rin super: bubbling green fog
  | "meteor"       // Sora super: warning marker, falling rock, big impact
  | "lightningBolt"// Kenji single chain segment, also generic zigzag bolt
  | "turret"       // Taro super: stationary mech turret that fires at enemies
  | "berserkAura"  // Goro super: spinning fire ring around a brawler
  | "shieldDome"   // Ronin super: shimmering shield disc around a brawler
  | "teleportFlash"; // Miya super: shadow swirl at depart + arrival

export interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  // Persisted-target follow: when set, x/y are refreshed each frame from the brawler.
  followBrawler?: Brawler | null;

  timer: number;
  maxTimer: number;

  radius: number;
  color: string;
  secondary?: string;

  // For trail/lightning bolts and one-shot beams.
  toX?: number;
  toY?: number;

  // Meteor: time before it actually lands (countdown inside its own life).
  delay?: number;
  exploded?: boolean;
  fallHeight?: number;

  // Damage-tick for turrets and tickable zones.
  ownerId?: string;
  ownerTeam?: string;
  damagePerTick?: number;
  tickInterval?: number;
  tickTimer?: number;
  tickRange?: number;

  // Pre-baked random seeds so particles look stable over time, not jittery.
  seed: number;
  // Number of decorative sub-particles (snowflakes, petals, bubbles).
  particleCount?: number;
  // Cached zigzag points for a lightning bolt.
  zigzag?: { x: number; y: number }[];
}

const effects: Effect[] = [];
let seedCounter = 0;
const nextSeed = () => (seedCounter = (seedCounter + 1) >>> 0);

export function spawnEffect(eff: Omit<Effect, "seed"> & { seed?: number }): Effect {
  const e: Effect = { seed: eff.seed ?? nextSeed(), ...eff } as Effect;
  effects.push(e);
  return e;
}

export function clearEffects(): void {
  effects.length = 0;
}

// Build a sequence of zigzag points between two endpoints. Used for lightning bolts.
export function makeZigzag(x1: number, y1: number, x2: number, y2: number, segments = 6, jitter = 18): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Perpendicular unit vector for jitter.
  const len = Math.max(1, Math.hypot(dx, dy));
  const px = -dy / len;
  const py = dx / len;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const cx = x1 + dx * t;
    const cy = y1 + dy * t;
    const j = (Math.random() * 2 - 1) * jitter;
    pts.push({ x: cx + px * j, y: cy + py * j });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}

// ───────────────────────────────────────────────────────────────────────────
// UPDATE
// ───────────────────────────────────────────────────────────────────────────

export function updateEffects(dt: number, allBrawlers: Brawler[]): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.timer -= dt;

    // Follow a moving brawler if attached. Aura/shield should disappear the
    // instant the brawler dies or the underlying status wears off — never
    // render lingering buffs over a corpse.
    if (e.followBrawler) {
      if (!e.followBrawler.alive) { effects.splice(i, 1); continue; }
      e.x = e.followBrawler.x;
      e.y = e.followBrawler.y;
      if (e.kind === "berserkAura" && !e.followBrawler.statusEffects.some(s => s.type === "berserker")) {
        effects.splice(i, 1); continue;
      }
      if (e.kind === "shieldDome" && !e.followBrawler.statusEffects.some(s => s.type === "stun")) {
        effects.splice(i, 1); continue;
      }
    }

    // Meteor: warning → impact.
    if (e.kind === "meteor") {
      if (e.delay !== undefined && !e.exploded) {
        e.delay -= dt;
        if (e.delay <= 0) {
          e.exploded = true;
          // Apply damage on impact.
          if (e.damagePerTick && e.tickRange && e.ownerTeam) {
            for (const b of allBrawlers) {
              if (!b.alive || b.team === e.ownerTeam) continue;
              const dx = b.x - e.x, dy = b.y - e.y;
              if (dx * dx + dy * dy <= e.tickRange * e.tickRange) {
                b.takeDamage(e.damagePerTick, null);
              }
            }
          }
          // Spawn a shockwave + sparks at the impact point.
          spawnEffect({
            kind: "shockwave", x: e.x, y: e.y,
            radius: e.tickRange ?? 60, color: e.color,
            timer: 0.55, maxTimer: 0.55,
          });
          for (let s = 0; s < 8; s++) {
            const a = (s / 8) * Math.PI * 2;
            spawnEffect({
              kind: "spark", x: e.x, y: e.y, toX: e.x + Math.cos(a) * 40, toY: e.y + Math.sin(a) * 40,
              radius: 4, color: e.color,
              timer: 0.4, maxTimer: 0.4,
            });
          }
        }
      }
    }

    // Damage-ticking zones (poison, electric cage, garden friendly heals not done here).
    if (e.damagePerTick && e.tickInterval && e.tickRange && e.ownerTeam && e.kind !== "meteor") {
      e.tickTimer = (e.tickTimer ?? 0) - dt;
      if (e.tickTimer <= 0) {
        e.tickTimer = e.tickInterval;
        for (const b of allBrawlers) {
          if (!b.alive || b.team === e.ownerTeam) continue;
          const dx = b.x - e.x, dy = b.y - e.y;
          if (dx * dx + dy * dy <= e.tickRange * e.tickRange) {
            b.takeDamage(e.damagePerTick, null);
          }
        }
      }
    }

    // Turret behaviour: shoot at the nearest enemy on a fixed cadence.
    if (e.kind === "turret" && e.tickInterval && e.ownerTeam) {
      e.tickTimer = (e.tickTimer ?? 0) - dt;
      if (e.tickTimer <= 0) {
        e.tickTimer = e.tickInterval;
        // Find nearest live enemy in range.
        let best: Brawler | null = null;
        let bestD2 = (e.tickRange ?? 250) ** 2;
        for (const b of allBrawlers) {
          if (!b.alive || b.team === e.ownerTeam) continue;
          const dx = b.x - e.x, dy = b.y - e.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) { bestD2 = d2; best = b; }
        }
        if (best && e.damagePerTick) {
          best.takeDamage(e.damagePerTick, null);
          // Spawn a quick beam / spark from the turret to the target.
          spawnEffect({
            kind: "trail", x: e.x, y: e.y, toX: best.x, toY: best.y,
            radius: 3, color: "#FFEB3B", secondary: "#FF6F00",
            timer: 0.18, maxTimer: 0.18,
          });
          spawnEffect({
            kind: "burst", x: best.x, y: best.y,
            radius: 14, color: "#FFEB3B",
            timer: 0.25, maxTimer: 0.25,
          });
        }
      }
    }

    if (e.timer <= 0) effects.splice(i, 1);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// RENDER
// ───────────────────────────────────────────────────────────────────────────

export function renderEffects(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const e of effects) {
    const sx = e.x - camX;
    const sy = e.y - camY;
    const lifeT = 1 - e.timer / e.maxTimer; // 0 → 1 over lifetime
    const fade = Math.max(0, Math.min(1, e.timer / e.maxTimer));

    ctx.save();
    switch (e.kind) {
      case "burst": {
        const r = e.radius * (0.4 + lifeT * 1.2);
        ctx.globalAlpha = fade;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
        // Inner flash
        ctx.globalAlpha = fade * 0.7;
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        grad.addColorStop(0, "rgba(255,255,255,0.85)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case "shockwave": {
        const r = e.radius * (0.5 + lifeT * 1.6);
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 6 * fade + 1;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 22;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.85, 0, Math.PI * 2); ctx.stroke();
        break;
      }

      case "spark": {
        const tx = (e.toX ?? e.x) - camX;
        const ty = (e.toY ?? e.y) - camY;
        const px = sx + (tx - sx) * lifeT;
        const py = sy + (ty - sy) * lifeT;
        ctx.globalAlpha = fade;
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(px, py, e.radius * fade, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case "trail": {
        const tx = (e.toX ?? e.x) - camX;
        const ty = (e.toY ?? e.y) - camY;
        ctx.globalAlpha = fade;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = e.radius;
        ctx.lineCap = "round";
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        if (e.secondary) {
          ctx.strokeStyle = e.secondary;
          ctx.lineWidth = Math.max(1, e.radius * 0.4);
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
        }
        break;
      }

      case "teleportFlash": {
        const r = e.radius * (0.3 + lifeT);
        ctx.globalAlpha = fade;
        // Expanding purple swirl made of overlapping arcs.
        ctx.shadowColor = e.color; ctx.shadowBlur = 24;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + frame * 0.1 + e.seed * 0.3;
          ctx.strokeStyle = i % 2 === 0 ? e.color : "rgba(255,255,255,0.85)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sx, sy, r, a, a + Math.PI * 0.45);
          ctx.stroke();
        }
        // Bright core
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.6);
        grad.addColorStop(0, "rgba(255,255,255,0.9)");
        grad.addColorStop(1, "rgba(206,147,216,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.6, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case "snowZone": {
        ctx.globalAlpha = fade * 0.55;
        // Outer ring
        const grad = ctx.createRadialGradient(sx, sy, e.radius * 0.4, sx, sy, e.radius);
        grad.addColorStop(0, "rgba(225,245,254,0.55)");
        grad.addColorStop(1, "rgba(2,136,209,0.05)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(178,235,242,0.85)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        // Snowflakes
        ctx.globalAlpha = fade;
        const count = e.particleCount ?? 14;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + frame * 0.02 + e.seed;
          const rr = e.radius * (0.2 + ((i * 37 + e.seed) % 100) / 130);
          const px = sx + Math.cos(a + lifeT * 2) * rr;
          const py = sy + Math.sin(a + lifeT * 2) * rr;
          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = "#B3E5FC"; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }

      case "petalZone": {
        ctx.globalAlpha = fade * 0.55;
        const grad = ctx.createRadialGradient(sx, sy, e.radius * 0.3, sx, sy, e.radius);
        grad.addColorStop(0, "rgba(255,138,171,0.55)");
        grad.addColorStop(1, "rgba(233,30,140,0.06)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,128,171,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI * 2); ctx.stroke();
        // Petals
        ctx.globalAlpha = fade;
        const count = e.particleCount ?? 16;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + frame * 0.012 + e.seed;
          const rr = e.radius * (0.25 + ((i * 53 + e.seed) % 100) / 140);
          const px = sx + Math.cos(a) * rr;
          const py = sy + Math.sin(a) * rr + Math.sin(frame * 0.05 + i) * 4;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(a * 2 + frame * 0.05);
          ctx.fillStyle = i % 2 === 0 ? "#FF80AB" : "#FCE4EC";
          ctx.beginPath();
          ctx.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        break;
      }

      case "poisonZone": {
        ctx.globalAlpha = fade * 0.6;
        const grad = ctx.createRadialGradient(sx, sy, e.radius * 0.2, sx, sy, e.radius);
        grad.addColorStop(0, "rgba(105,240,174,0.6)");
        grad.addColorStop(1, "rgba(46,125,50,0.05)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(139,195,74,0.95)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI * 2); ctx.stroke();
        // Bubbles
        ctx.globalAlpha = fade;
        const count = e.particleCount ?? 12;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + e.seed;
          const rr = e.radius * (0.15 + ((i * 73 + e.seed) % 100) / 120);
          const wobble = Math.sin(frame * 0.06 + i + e.seed) * 4;
          const px = sx + Math.cos(a) * rr;
          const py = sy + Math.sin(a) * rr + wobble;
          ctx.fillStyle = "rgba(105,240,174,0.85)";
          ctx.shadowColor = "#69F0AE"; ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.arc(px, py, 3 + (i % 3), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }

      case "lightCage": {
        ctx.globalAlpha = fade * 0.55;
        // Floor ring
        ctx.strokeStyle = "rgba(255,235,59,0.9)";
        ctx.lineWidth = 3;
        ctx.shadowColor = "#FFEB3B"; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(sx, sy, e.radius, 0, Math.PI * 2); ctx.stroke();
        // Rotating arcs
        ctx.globalAlpha = fade;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + frame * 0.08 + e.seed;
          ctx.strokeStyle = i % 2 === 0 ? "#FFEB3B" : "#40C4FF";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(sx, sy, e.radius * 0.95, a, a + Math.PI * 0.35);
          ctx.stroke();
        }
        // Vertical zigzag bars at the perimeter (every 0.4s a fresh set).
        const phase = Math.floor(frame * 0.15) + e.seed;
        for (let i = 0; i < 4; i++) {
          const a = ((i / 4) + (phase * 0.13)) * Math.PI * 2;
          const ex = sx + Math.cos(a) * e.radius;
          const ey = sy + Math.sin(a) * e.radius;
          ctx.strokeStyle = "rgba(255,255,255,0.8)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * (e.radius * 0.5), sy + Math.sin(a) * (e.radius * 0.5));
          ctx.lineTo(ex + (Math.random() - 0.5) * 6, ey + (Math.random() - 0.5) * 6);
          ctx.stroke();
        }
        break;
      }

      case "lightningBolt": {
        ctx.globalAlpha = fade;
        ctx.shadowColor = e.color; ctx.shadowBlur = 14;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 4;
        const pts = e.zigzag ?? [];
        if (pts.length > 1) {
          ctx.beginPath();
          ctx.moveTo(pts[0].x - camX, pts[0].y - camY);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - camX, pts[i].y - camY);
          ctx.stroke();
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pts[0].x - camX, pts[0].y - camY);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - camX, pts[i].y - camY);
          ctx.stroke();
        }
        break;
      }

      case "meteor": {
        if (!e.exploded) {
          // Warning marker on the ground.
          ctx.globalAlpha = 0.55 + Math.sin(frame * 0.3) * 0.25;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 6]);
          ctx.beginPath();
          ctx.arc(sx, sy, e.tickRange ?? 60, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          // Falling meteor — slide it from above into the marker.
          const fall = Math.max(0, e.delay ?? 0) / 0.6;
          const fh = e.fallHeight ?? 320;
          const my = sy - fall * fh;
          ctx.globalAlpha = 1;
          // Tail
          const tailGrad = ctx.createLinearGradient(sx, my, sx, sy);
          tailGrad.addColorStop(0, "rgba(255,210,0,0)");
          tailGrad.addColorStop(1, e.color);
          ctx.strokeStyle = tailGrad;
          ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(sx, my); ctx.lineTo(sx, sy); ctx.stroke();
          // Rock
          ctx.fillStyle = e.color;
          ctx.shadowColor = e.color; ctx.shadowBlur = 22;
          ctx.beginPath(); ctx.arc(sx, my, 14, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#FFD740";
          ctx.beginPath(); ctx.arc(sx - 4, my - 4, 5, 0, Math.PI * 2); ctx.fill();
        } else {
          // After-impact crater fade.
          ctx.globalAlpha = fade * 0.7;
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, e.tickRange ?? 60);
          grad.addColorStop(0, e.color);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(sx, sy, e.tickRange ?? 60, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }

      case "berserkAura": {
        ctx.globalAlpha = 0.85;
        // Spinning fire ring around the brawler's feet.
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + frame * 0.18;
          const rr = e.radius + Math.sin(frame * 0.25 + i) * 5;
          const px = sx + Math.cos(a) * rr;
          const py = sy + 8 + Math.sin(a) * rr * 0.4; // squashed circle (perspective)
          ctx.fillStyle = i % 2 === 0 ? "#FF3D00" : "#FFAB40";
          ctx.shadowColor = "#FF6F00"; ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.moveTo(px, py - 8);
          ctx.lineTo(px - 5, py + 4);
          ctx.lineTo(px + 5, py + 4);
          ctx.closePath();
          ctx.fill();
        }
        // Ground ring
        ctx.strokeStyle = "rgba(255,87,34,0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(sx, sy + 18, e.radius * 1.05, e.radius * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case "shieldDome": {
        ctx.globalAlpha = 0.85;
        // Translucent dome
        const grad = ctx.createRadialGradient(sx, sy - 6, 4, sx, sy - 6, e.radius);
        grad.addColorStop(0, "rgba(255,215,0,0.05)");
        grad.addColorStop(0.7, "rgba(255,215,0,0.18)");
        grad.addColorStop(1, "rgba(255,215,0,0.45)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(sx, sy - 6, e.radius, 0, Math.PI * 2); ctx.fill();
        // Hex pattern flicker
        ctx.strokeStyle = "rgba(255,215,0,0.85)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 16;
        for (let i = 0; i < 3; i++) {
          const a = frame * 0.06 + (i / 3) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(sx, sy - 6, e.radius - i * 4, a, a + Math.PI * 0.6);
          ctx.stroke();
        }
        break;
      }

      case "turret": {
        // Stationary mech turret with a rotating cannon.
        ctx.shadowColor = "#78909C"; ctx.shadowBlur = 10;
        // Base
        ctx.fillStyle = "#5D4037";
        ctx.beginPath();
        ctx.arc(sx, sy, e.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#CD9B39";
        ctx.lineWidth = 3;
        ctx.stroke();
        // Cannon
        const ang = frame * 0.05;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.fillStyle = "#78909C";
        ctx.fillRect(-3, -e.radius * 0.85, 6, e.radius * 0.85);
        ctx.fillStyle = "#FFEB3B";
        ctx.beginPath();
        ctx.arc(0, -e.radius * 0.85, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Range hint (fades in/out)
        ctx.globalAlpha = 0.18 + Math.sin(frame * 0.08) * 0.05;
        ctx.strokeStyle = "#FFEB3B";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(sx, sy, e.tickRange ?? 250, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // Lifetime sweep
        const lifeFrac = Math.max(0, e.timer / e.maxTimer);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#FFEB3B";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, e.radius * 0.7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lifeFrac);
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }
}
