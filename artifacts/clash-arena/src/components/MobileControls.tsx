import { useEffect, useRef } from "react";
import type { InputHandler } from "../game/InputHandler";

interface PlayerInfo {
  attackRange: number;
  canvas: HTMLCanvasElement | null;
  brawlerId: string;
  playerX?: number;
  playerY?: number;
}

interface MobileControlsProps {
  /** Lazy resolver for the InputHandler — created when the game starts. */
  getInput: () => InputHandler | null;
  /** Lazy lookup for player + brawler stats so the indicator can match the
   *  selected brawler's attack/super shape. */
  getPlayerInfo: () => PlayerInfo | null;
}

const STICK_BASE = 70;          // base ring radius (px) → 140px diameter
const STICK_THUMB = 36;         // thumb radius (px)
const TAP_THRESHOLD = 0.15;     // normalized distance below which a release is a "tap" (auto-aim)
const PLACED_AREA_MAX_WORLD = 300; // max world distance to drop a placed-area super

interface JoystickState {
  pointerId: number | null;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  magnitude: number;
}

function emptyStick(): JoystickState {
  return { pointerId: null, originX: 0, originY: 0, dx: 0, dy: 0, magnitude: 0 };
}

export default function MobileControls({ getInput, getPlayerInfo }: MobileControlsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const moveStick = useRef<JoystickState>(emptyStick());
  const attackStick = useRef<JoystickState>(emptyStick());
  const superStick = useRef<JoystickState>(emptyStick());
  const rafRef = useRef(0);

  // ----------------------- Aim-preview render loop -----------------------
  useEffect(() => {
    const renderPreview = () => {
      const cv = previewCanvasRef.current;
      const info = getPlayerInfo();
      if (cv && info?.canvas) {
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const cssW = cv.clientWidth;
        const cssH = cv.clientHeight;
        if (cv.width !== cssW * dpr || cv.height !== cssH * dpr) {
          cv.width = Math.max(1, Math.floor(cssW * dpr));
          cv.height = Math.max(1, Math.floor(cssH * dpr));
        }
        const ctx = cv.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, cssW, cssH);

          // Map game-canvas world units → CSS pixels. The game canvas uses
          // objectFit:contain so the visible scale is min(cssW/1200, cssH/800).
          const gameRect = info.canvas.getBoundingClientRect();
          const scale = Math.min(
            gameRect.width / info.canvas.width,
            gameRect.height / info.canvas.height,
          );
          const screenX = gameRect.left + gameRect.width / 2;
          const screenY = gameRect.top + gameRect.height / 2;

          if (
            attackStick.current.pointerId !== null &&
            attackStick.current.magnitude > TAP_THRESHOLD
          ) {
            const ang = Math.atan2(attackStick.current.dy, attackStick.current.dx);
            drawAttackIndicator(
              ctx, screenX, screenY, ang,
              info.brawlerId, scale, info.attackRange,
            );
          }
          if (
            superStick.current.pointerId !== null &&
            superStick.current.magnitude > TAP_THRESHOLD
          ) {
            const ang = Math.atan2(superStick.current.dy, superStick.current.dx);
            drawSuperIndicator(
              ctx, screenX, screenY, ang,
              info.brawlerId, scale,
              superStick.current.magnitude,
              cssW, cssH,
            );
          }
        }
      }
      rafRef.current = requestAnimationFrame(renderPreview);
    };
    rafRef.current = requestAnimationFrame(renderPreview);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getPlayerInfo]);

  // ----------------------- DOM thumb position update ---------------------
  const refreshThumbs = () => {
    if (!rootRef.current) return;
    const thumbs = rootRef.current.querySelectorAll<HTMLDivElement>("[data-thumb]");
    thumbs.forEach((el) => {
      const which = el.dataset.thumb!;
      const stick = which === "move" ? moveStick.current
        : which === "attack" ? attackStick.current
        : superStick.current;
      const offsetX = stick.dx * (STICK_BASE - STICK_THUMB / 2);
      const offsetY = stick.dy * (STICK_BASE - STICK_THUMB / 2);
      el.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
    });
  };

  // ----------------------- Pointer handlers ------------------------------
  const beginStick = (which: "move" | "attack" | "super", e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const stick = which === "move" ? moveStick.current
      : which === "attack" ? attackStick.current
      : superStick.current;
    if (stick.pointerId !== null) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    stick.pointerId = e.pointerId;
    stick.originX = rect.left + rect.width / 2;
    stick.originY = rect.top + rect.height / 2;
    stick.dx = 0;
    stick.dy = 0;
    stick.magnitude = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    refreshThumbs();
  };

  const moveStickPointer = (
    which: "move" | "attack" | "super", e: React.PointerEvent<HTMLDivElement>,
  ) => {
    const stick = which === "move" ? moveStick.current
      : which === "attack" ? attackStick.current
      : superStick.current;
    if (stick.pointerId !== e.pointerId) return;
    e.preventDefault();
    const rawDx = e.clientX - stick.originX;
    const rawDy = e.clientY - stick.originY;
    const mag = Math.hypot(rawDx, rawDy);
    const norm = Math.min(1, mag / STICK_BASE);
    const dx = mag === 0 ? 0 : (rawDx / mag) * norm;
    const dy = mag === 0 ? 0 : (rawDy / mag) * norm;
    stick.dx = dx;
    stick.dy = dy;
    stick.magnitude = norm;

    const input = getInput();
    if (input) {
      if (which === "move") {
        input.setMovementJoystick(dx, dy);
      } else if (which === "attack") {
        input.setAttackJoystick(true, Math.atan2(dy, dx));
      } else {
        input.setSuperJoystick(true, Math.atan2(dy, dx));
      }
    }
    refreshThumbs();
  };

  const endStick = (
    which: "move" | "attack" | "super", e: React.PointerEvent<HTMLDivElement>,
  ) => {
    const stick = which === "move" ? moveStick.current
      : which === "attack" ? attackStick.current
      : superStick.current;
    if (stick.pointerId !== e.pointerId) return;
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* noop */ }
    stick.pointerId = null;

    const input = getInput();
    if (input) {
      if (which === "move") {
        input.setMovementJoystick(0, 0);
      } else if (which === "attack") {
        const info = getPlayerInfo();
        if (stick.magnitude > TAP_THRESHOLD) {
          input.setAttackJoystick(true, Math.atan2(stick.dy, stick.dx));
          input.triggerAttack(info?.playerX, info?.playerY);
          requestAnimationFrame(() => input.setAttackJoystick(false, 0));
        } else {
          input.setAttackJoystick(false, 0);
          input.triggerAttack();
        }
      } else {
        const info = getPlayerInfo();
        if (stick.magnitude > TAP_THRESHOLD) {
          input.setSuperJoystick(true, Math.atan2(stick.dy, stick.dx));
          input.triggerSuper(info?.playerX, info?.playerY);
          requestAnimationFrame(() => input.setSuperJoystick(false, 0));
        } else {
          input.setSuperJoystick(false, 0);
          input.triggerSuper();
        }
      }
    }

    stick.dx = 0;
    stick.dy = 0;
    stick.magnitude = 0;
    refreshThumbs();
  };

  // ----------------------- Joystick element factory ----------------------
  const stickEl = (
    which: "move" | "attack" | "super",
    label: string,
    icon: string,
    baseColor: string,
    glow: string,
    thumbColor: string,
    posStyle: React.CSSProperties,
    sizeOverride?: number,
  ) => {
    const radius = sizeOverride ?? STICK_BASE;
    return (
      <div
        key={which}
        onPointerDown={(e) => beginStick(which, e)}
        onPointerMove={(e) => moveStickPointer(which, e)}
        onPointerUp={(e) => endStick(which, e)}
        onPointerCancel={(e) => endStick(which, e)}
        style={{
          position: "absolute",
          width: radius * 2,
          height: radius * 2,
          borderRadius: "50%",
          background: `radial-gradient(circle at 30% 30%, ${baseColor}cc, ${baseColor}66 60%, ${baseColor}22 100%)`,
          border: `3px solid ${glow}`,
          boxShadow: `0 0 22px ${glow}aa, inset 0 0 18px ${glow}66`,
          touchAction: "none",
          userSelect: "none",
          WebkitTouchCallout: "none",
          cursor: "pointer",
          ...posStyle,
        }}
        title={label}
        aria-label={label}
      >
        <div
          data-thumb={which}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: STICK_THUMB * 2,
            height: STICK_THUMB * 2,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, ${thumbColor}, ${baseColor})`,
            border: `2px solid ${glow}`,
            boxShadow: `0 4px 14px ${glow}, inset 0 2px 6px rgba(255,255,255,0.4)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            color: "white",
            textShadow: "0 2px 4px rgba(0,0,0,0.7)",
            pointerEvents: "none",
          }}
        >{icon}</div>
      </div>
    );
  };

  // Layout (per spec):
  //   movement (blue)  → bottom-LEFT
  //   attack   (red)   → bottom-RIGHT
  //   super    (yellow)→ above-and-slightly-left of the attack stick
  return (
    <div
      ref={rootRef}
      style={{ position: "absolute", inset: 0, zIndex: 6, pointerEvents: "none" }}
    >
      <canvas
        ref={previewCanvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {stickEl(
          "move", "Движение", "🏃", "#1565C0", "#42A5F5", "#90CAF9",
          { left: 28, bottom: 36, pointerEvents: "auto" },
        )}
        {stickEl(
          "attack", "Атака", "🎯", "#B71C1C", "#FF5252", "#FFCDD2",
          { right: 28, bottom: 36, pointerEvents: "auto" },
        )}
        {stickEl(
          "super", "Супер", "⚡", "#F9A825", "#FFD54F", "#FFF59D",
          { right: 28 + STICK_BASE * 2 + 14, bottom: 36 + STICK_BASE * 2 + 14, pointerEvents: "auto" },
          54, // super button is a touch smaller than the analog sticks
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Aim indicator drawing
// ============================================================================
//
// All indicators are drawn in screen-space, anchored to the player which is
// always rendered at the center of the game canvas (camera follows player).
// World-unit dimensions are multiplied by `scale` (CSS-px-per-world-unit) so
// the indicator visually matches the in-game projectile range.
//
// Visual language (per spec):
//   - translucent gray fill at ~0.4 alpha
//   - white / pale-blue stroke for the outline
//   - shape mirrors the actual attack hitbox (line, cone, twin-arc, circle…)
// ============================================================================

const STROKE = "rgba(255, 255, 255, 0.85)";
const FILL = "rgba(200, 200, 210, 0.4)";
const FILL_SOFT = "rgba(200, 200, 210, 0.28)";
const FILL_SUPER = "rgba(180, 220, 255, 0.42)";

function drawAttackIndicator(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, angle: number,
  brawlerId: string, scale: number, attackRangeWorld: number,
) {
  const range = attackRangeWorld * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);

  switch (brawlerId) {
    case "miya": {
      // Twin sharp curved blades, ±15° from aim axis. Each leaves a dashed
      // trajectory + a hit circle at max range.
      ctx.strokeStyle = "rgba(206, 147, 216, 0.85)"; // gray w/ violet tint
      ctx.fillStyle = "rgba(206, 147, 216, 0.32)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      for (const sign of [-1, 1]) {
        const a = sign * (Math.PI / 12); // 15°
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(range, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(range, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([8, 6]);
        ctx.restore();
      }
      break;
    }
    case "ronin": {
      // 60° cone melee swing, radius = attackRange.
      const halfArc = Math.PI / 6; // ±30°
      ctx.fillStyle = FILL;
      ctx.strokeStyle = STROKE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, range, -halfArc, halfArc);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "goro": {
      // Spin attack — circle around the player; aim direction does not
      // affect shape but joystick still chooses release timing.
      ctx.rotate(-angle); // un-rotate so the dashed ring stays oriented
      const r = 90 * scale;
      ctx.fillStyle = FILL_SOFT;
      ctx.strokeStyle = STROKE;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case "taro": {
      // Wrench melee — short circle around the player.
      ctx.rotate(-angle);
      const r = Math.max(70, 80 * scale);
      ctx.fillStyle = FILL_SOFT;
      ctx.strokeStyle = STROKE;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case "kenji": {
      // Chain lightning — line + dashed jump-radius circle at the tip.
      drawLineProjectile(ctx, range, 14, "rgba(255, 213, 79, 0.45)", "rgba(255, 245, 157, 0.95)");
      const chainR = 100 * scale;
      ctx.strokeStyle = "rgba(64, 196, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(range, 0, chainR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    // Default linear projectile (kibo, yuki, hana, sora, rin)
    case "kibo":
    case "yuki":
    case "hana":
    case "sora":
    case "rin":
    default: {
      drawLineProjectile(ctx, range, 14, FILL, STROKE);
      break;
    }
  }
  ctx.restore();
}

function drawLineProjectile(
  ctx: CanvasRenderingContext2D,
  length: number, width: number,
  fill: string, stroke: string,
) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  // Body: tall thin rectangle.
  ctx.beginPath();
  ctx.rect(0, -width / 2, length, width);
  ctx.fill();
  ctx.stroke();
  // Aim dot at the tip.
  ctx.beginPath();
  ctx.arc(length, 0, Math.max(6, width * 0.6), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawSuperIndicator(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, angle: number,
  brawlerId: string, scale: number,
  magnitude: number,
  cssW: number, cssH: number,
) {
  ctx.save();
  ctx.translate(px, py);

  switch (brawlerId) {
    case "miya": {
      // Teleport zone — circle around the player showing target search range.
      const r = 350 * scale;
      ctx.fillStyle = "rgba(180, 200, 255, 0.18)";
      ctx.strokeStyle = "rgba(255, 23, 68, 0.85)";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case "kibo": {
      // Long pierce beam — extends to the screen edge in the aim direction.
      ctx.rotate(angle);
      const length = Math.hypot(cssW, cssH); // diagonal — guaranteed to exit
      ctx.fillStyle = "rgba(64, 196, 255, 0.35)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(0, -10, length, 20);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "ronin":
    case "goro": {
      // Instant self-buff supers — tiny pulsing ring around the player + hint.
      const r = 60 * scale;
      ctx.fillStyle = "rgba(255, 215, 64, 0.18)";
      ctx.strokeStyle = "rgba(255, 215, 64, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Мгновенно", 0, -r - 8);
      break;
    }
    case "taro": {
      // Turret placement — square outline at fixed 200 world units.
      ctx.rotate(angle);
      const dist = 200 * scale;
      const size = 60 * scale;
      ctx.translate(dist, 0);
      ctx.rotate(-angle); // keep the square axis-aligned to the player
      ctx.fillStyle = FILL;
      ctx.strokeStyle = STROKE;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.rect(-size / 2, -size / 2, size, size);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      // Tiny turret silhouette inside.
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-2, 0, 4, size * 0.35);
      break;
    }
    // Placed-area supers (yuki, kenji, hana, sora, rin): a circle that
    // follows the joystick angle, capped at PLACED_AREA_MAX_WORLD from the
    // player. Radius is brawler-specific.
    case "yuki":
    case "kenji":
    case "hana":
    case "sora":
    case "rin": {
      ctx.rotate(angle);
      const dist = Math.min(1, magnitude) * PLACED_AREA_MAX_WORLD * scale;
      const radiusByBrawler: Record<string, number> = {
        yuki: 140, kenji: 110, hana: 160, sora: 120, rin: 100,
      };
      const r = (radiusByBrawler[brawlerId] ?? 120) * scale;
      ctx.translate(dist, 0);
      ctx.rotate(-angle); // keep the area circle un-rotated
      ctx.fillStyle = FILL_SUPER;
      ctx.strokeStyle = STROKE;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      // Aim line from player → area center for clarity.
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(-dist, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    default: {
      // Generic fallback — a wide line preview.
      ctx.rotate(angle);
      drawLineProjectile(ctx, 400 * scale, 26, FILL_SUPER, STROKE);
      break;
    }
  }
  ctx.restore();
}
