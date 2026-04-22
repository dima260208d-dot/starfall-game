import { useEffect, useRef } from "react";
import type { InputHandler } from "../game/InputHandler";

interface MobileControlsProps {
  /**
   * Lazy reference resolver. The InputHandler is created when the game
   * starts (which is one effect after this overlay mounts), so we read it
   * fresh on every pointer event instead of capturing it in a closure.
   */
  getInput: () => InputHandler | null;
  /**
   * Lazy lookup of player + brawler stats so the aim preview can scale to
   * the active brawler's attack range without re-mounting controls when the
   * player moves.
   */
  getPlayerInfo: () => {
    attackRange: number;
    canvas: HTMLCanvasElement | null;
    playerX?: number;
    playerY?: number;
  } | null;
}

const STICK_BASE = 70;          // base ring radius (px)
const STICK_THUMB = 36;         // thumb radius (px)
const TAP_THRESHOLD = 0.18;     // normalized distance under which a release is a "tap" (auto-aim)
const PREVIEW_PIXELS_PER_UNIT = 1; // canvas world units == canvas pixels (1200x800)

interface JoystickState {
  pointerId: number | null;
  originX: number;     // base center on screen
  originY: number;
  thumbX: number;      // current thumb pos on screen
  thumbY: number;
  /** Normalized vector from origin -> thumb, clamped to unit circle. */
  dx: number;
  dy: number;
  magnitude: number;
}

function emptyStick(): JoystickState {
  return { pointerId: null, originX: 0, originY: 0, thumbX: 0, thumbY: 0, dx: 0, dy: 0, magnitude: 0 };
}

/**
 * Three on-screen joysticks for touch play. Layout:
 *   - movement (blue) — bottom-right corner, draggable, 8-direction
 *   - attack (red)   — bottom-left corner
 *   - super (yellow) — sits above-and-right of the attack stick
 *
 * Behaviour for attack/super:
 *   - tap-release (no drag past deadzone) = auto-aim fire
 *   - drag-and-release = fire in the dragged direction
 *   - while dragging, a translucent gray aim preview appears in the world,
 *     anchored to the player at canvas-center (camera always follows player).
 */
export default function MobileControls({ getInput, getPlayerInfo }: MobileControlsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const moveStick = useRef<JoystickState>(emptyStick());
  const attackStick = useRef<JoystickState>(emptyStick());
  const superStick = useRef<JoystickState>(emptyStick());
  // Force-render dependency — bumped on every pointer event so the thumb and
  // base re-render at their new positions without React state on the hot path.
  const tickRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    // Aim preview render loop. Re-uses the overlay canvas at the screen
    // center (where the player is drawn since the camera always follows).
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
          const scale = Math.min(gameRect.width / info.canvas.width, gameRect.height / info.canvas.height);
          const screenX = gameRect.left + gameRect.width / 2;
          const screenY = gameRect.top + gameRect.height / 2;
          const rangePx = info.attackRange * PREVIEW_PIXELS_PER_UNIT * scale;

          const drawAimPreview = (
            color: string, angle: number, length: number, width: number,
          ) => {
            ctx.save();
            ctx.translate(screenX, screenY);
            ctx.rotate(angle);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(0, -width / 2);
            ctx.lineTo(length, -width / 2);
            ctx.lineTo(length, width / 2);
            ctx.lineTo(0, width / 2);
            ctx.closePath();
            ctx.fill();
            // Arrow tip
            ctx.beginPath();
            ctx.moveTo(length, -width);
            ctx.lineTo(length + width * 1.2, 0);
            ctx.lineTo(length, width);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          };

          if (attackStick.current.pointerId !== null && attackStick.current.magnitude > TAP_THRESHOLD) {
            const ang = Math.atan2(attackStick.current.dy, attackStick.current.dx);
            drawAimPreview("rgba(220, 220, 220, 0.32)", ang, rangePx, 16);
          }
          if (superStick.current.pointerId !== null && superStick.current.magnitude > TAP_THRESHOLD) {
            const ang = Math.atan2(superStick.current.dy, superStick.current.dx);
            // Super preview: a touch wider, same neutral gray tint.
            drawAimPreview("rgba(220, 220, 220, 0.4)", ang, rangePx * 1.05, 28);
          }
        }
      }
      rafRef.current = requestAnimationFrame(renderPreview);
    };
    rafRef.current = requestAnimationFrame(renderPreview);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getPlayerInfo]);

  const forceRender = () => {
    tickRef.current++;
    if (rootRef.current) {
      // Manually update the DOM positions of the thumbs — bypasses React's
      // reconciler so dragging stays buttery on low-end phones.
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
    }
  };

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
    stick.thumbX = e.clientX;
    stick.thumbY = e.clientY;
    stick.dx = 0;
    stick.dy = 0;
    stick.magnitude = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    forceRender();
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
    stick.thumbX = e.clientX;
    stick.thumbY = e.clientY;

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
    forceRender();
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
        // Pull the freshest player position so triggerAttack can commit the
        // joystick aim into mouseWorldX/Y synchronously.
        const info = getPlayerInfo();
        if (stick.magnitude > TAP_THRESHOLD) {
          input.setAttackJoystick(true, Math.atan2(stick.dy, stick.dx));
          input.triggerAttack(info?.playerX, info?.playerY);
          // Release on next frame so subsequent mouse aiming remains free.
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
    forceRender();
  };

  // Joystick element factory.
  const stickEl = (
    which: "move" | "attack" | "super",
    label: string,
    icon: string,
    baseColor: string,
    glow: string,
    thumbColor: string,
    posStyle: React.CSSProperties,
  ) => (
    <div
      key={which}
      onPointerDown={(e) => beginStick(which, e)}
      onPointerMove={(e) => moveStickPointer(which, e)}
      onPointerUp={(e) => endStick(which, e)}
      onPointerCancel={(e) => endStick(which, e)}
      style={{
        position: "absolute",
        width: STICK_BASE * 2,
        height: STICK_BASE * 2,
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

  return (
    <div
      ref={rootRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 6,
        pointerEvents: "none",
      }}
    >
      {/* Aim-preview overlay layer — drawn between the game canvas and the
          control elements. Pointer events disabled so it never eats taps. */}
      <canvas
        ref={previewCanvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      />

      {/* Pointer-event children below the canvas: each joystick re-enables
          pointer events on its own div. */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {stickEl(
          "move", "Движение", "🏃", "#1565C0", "#42A5F5", "#90CAF9",
          { right: 28, bottom: 36, pointerEvents: "auto" },
        )}
        {stickEl(
          "attack", "Атака", "🎯", "#B71C1C", "#FF5252", "#FFCDD2",
          { left: 28, bottom: 36, pointerEvents: "auto" },
        )}
        {stickEl(
          "super", "Супер", "⚡", "#F9A825", "#FFD54F", "#FFF59D",
          { left: 28 + STICK_BASE * 2 + 14, bottom: 36 + STICK_BASE * 2 + 14, pointerEvents: "auto" },
        )}
      </div>
    </div>
  );
}
