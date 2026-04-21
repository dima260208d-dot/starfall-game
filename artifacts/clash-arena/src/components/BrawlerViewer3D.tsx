import { useEffect, useRef, useState } from "react";

interface BrawlerViewer3DProps {
  brawlerId: string;
  color: string;
  size?: number;
}

export default function BrawlerViewer3D({ brawlerId, color, size = 320 }: BrawlerViewer3DProps) {
  const [angle, setAngle] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const dragRef = useRef<{ startX: number; startAngle: number } | null>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    setAngle(0);
    setAutoRotate(true);
  }, [brawlerId]);

  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      tRef.current += dt;
      if (autoRotate && !dragging) {
        setAngle((a) => (a + dt * 35) % 360);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [autoRotate, dragging]);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    setAutoRotate(false);
    dragRef.current = { startX: e.clientX, startAngle: angle };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    setAngle(((dragRef.current.startAngle + dx * 0.6) % 360 + 360) % 360);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Determine which face to show. 0° = front facing camera. 180° = back.
  // Both images share same Y rotation; we flip the back image's local rotation
  // so as the model "spins" we see continuous side-to-side motion.
  const a = angle;
  const frontVisible = a < 90 || a > 270;
  const bob = Math.sin(tRef.current * 2) * 4;

  // base path for vite (handles subpath deployments)
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const frontSrc = `${base}brawlers/${brawlerId}_front.png`;
  const backSrc = `${base}brawlers/${brawlerId}_back.png`;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        perspective: "1200px",
        userSelect: "none",
        cursor: dragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => setAutoRotate((v) => !v)}
      title="Перетащи, чтобы повернуть. Двойной клик — авто-вращение."
    >
      {/* radial glow backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 55%, ${color}40 0%, ${color}10 35%, transparent 70%)`,
          filter: "blur(2px)",
        }}
      />
      {/* rotating ground ring */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "82%",
          width: size * 0.8,
          height: size * 0.18,
          marginLeft: -(size * 0.4),
          borderRadius: "50%",
          background: `conic-gradient(from ${a * 2}deg, ${color}80, transparent 30%, ${color}40 60%, transparent 90%, ${color}80)`,
          opacity: 0.55,
          filter: "blur(1px)",
          transform: "rotateX(70deg)",
          transformStyle: "preserve-3d",
        }}
      />
      {/* contact shadow */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "84%",
          width: size * 0.5,
          height: size * 0.08,
          marginLeft: -(size * 0.25),
          borderRadius: "50%",
          background: "rgba(0,0,0,0.55)",
          filter: "blur(8px)",
          transform: `scaleX(${0.85 + Math.abs(Math.sin((a * Math.PI) / 180)) * 0.3})`,
        }}
      />

      {/* the 3D model: two billboards rotated 180° apart so user always sees correct face */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: `translateY(${bob}px)`,
        }}
      >
        <img
          src={frontSrc}
          alt=""
          draggable={false}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center bottom",
            transform: `rotateY(${a}deg)`,
            transition: "none",
            backfaceVisibility: "hidden",
            filter: `drop-shadow(0 12px 18px rgba(0,0,0,0.5)) drop-shadow(0 0 24px ${color}60)`,
            opacity: frontVisible ? 1 : 0,
          }}
        />
        <img
          src={backSrc}
          alt=""
          draggable={false}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center bottom",
            transform: `rotateY(${a + 180}deg)`,
            transition: "none",
            backfaceVisibility: "hidden",
            filter: `drop-shadow(0 12px 18px rgba(0,0,0,0.5)) drop-shadow(0 0 24px ${color}60)`,
            opacity: frontVisible ? 0 : 1,
          }}
        />
      </div>

      {/* hint label */}
      <div
        style={{
          position: "absolute",
          bottom: 4,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 10,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: 1.5,
          fontWeight: 600,
          pointerEvents: "none",
        }}
      >
        ↔ ПЕРЕТАЩИ • 2× КЛИК — АВТО
      </div>
    </div>
  );
}
