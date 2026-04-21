import { useMemo } from "react";

interface Props {
  variant?: "menu" | "lobby";
}

/**
 * Shared animated background.
 *
 * - "menu" variant: an aurora of moving colored blobs + drifting particles,
 *   used for every page that isn't the lobby.
 * - "lobby" variant: the same aurora plus a glowing platform circle that
 *   sits behind the main menu so the brawler appears to stand on it.
 *
 * Renders as a fixed full-viewport layer at z-index 0; all page content
 * should sit on a transparent root above it.
 */
export default function MenuBackground({ variant = "menu" }: Props) {
  const stars = useMemo(
    () =>
      Array.from({ length: 60 }).map(() => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: Math.random() * 2.5 + 1,
        delay: Math.random() * 4,
        duration: 2.5 + Math.random() * 3,
        color: ["#CE93D8", "#40C4FF", "#FFD700", "#FF80AB"][Math.floor(Math.random() * 4)],
      })),
    [],
  );

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 30% 20%, #2A0A5C 0%, transparent 60%)," +
          "radial-gradient(ellipse at 80% 80%, #08254A 0%, transparent 60%)," +
          "linear-gradient(180deg, #050020 0%, #03001A 100%)",
      }}
    >
      <style>{`
        @keyframes mb_drift1 {
          0%   { transform: translate(0,    0) scale(1); }
          50%  { transform: translate(60px, -40px) scale(1.15); }
          100% { transform: translate(0,    0) scale(1); }
        }
        @keyframes mb_drift2 {
          0%   { transform: translate(0,    0) scale(1); }
          50%  { transform: translate(-50px,30px) scale(1.1); }
          100% { transform: translate(0,    0) scale(1); }
        }
        @keyframes mb_drift3 {
          0%   { transform: translate(0,    0) scale(1); }
          50%  { transform: translate(40px, 50px) scale(1.2); }
          100% { transform: translate(0,    0) scale(1); }
        }
        @keyframes mb_twinkle {
          0%,100% { opacity: 0.25; transform: scale(0.8); }
          50%     { opacity: 1;    transform: scale(1.2); }
        }
        @keyframes mb_platSweep {
          0%   { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes mb_platPulse {
          0%,100% { transform: translate(-50%, -50%) scale(1);    opacity: 0.85; }
          50%     { transform: translate(-50%, -50%) scale(1.06); opacity: 1; }
        }
      `}</style>

      {/* Three slow-drifting colored blobs */}
      <div style={{
        position: "absolute", left: "12%", top: "18%",
        width: 420, height: 420, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(206,147,216,0.55) 0%, transparent 65%)",
        filter: "blur(40px)",
        animation: "mb_drift1 16s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", right: "10%", top: "55%",
        width: 480, height: 480, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(64,196,255,0.45) 0%, transparent 65%)",
        filter: "blur(50px)",
        animation: "mb_drift2 22s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", left: "55%", top: "8%",
        width: 360, height: 360, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,215,0,0.32) 0%, transparent 65%)",
        filter: "blur(45px)",
        animation: "mb_drift3 20s ease-in-out infinite",
      }} />

      {/* Star particles */}
      {stars.map((s, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${s.left}%`, top: `${s.top}%`,
          width: s.size, height: s.size,
          borderRadius: "50%",
          background: s.color,
          boxShadow: `0 0 ${s.size * 3}px ${s.color}`,
          animation: `mb_twinkle ${s.duration}s ease-in-out infinite`,
          animationDelay: `${s.delay}s`,
        }} />
      ))}

      {/* Lobby-only: glowing platform under the central character */}
      {variant === "lobby" && (
        <>
          {/* Outer ring sweep */}
          <div style={{
            position: "absolute",
            left: "50%", top: "62%",
            width: 460, height: 460, borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, rgba(206,147,216,0) 0deg," +
              " rgba(206,147,216,0.55) 60deg," +
              " rgba(64,196,255,0.45) 120deg," +
              " rgba(255,215,0,0.45) 200deg," +
              " rgba(206,147,216,0) 360deg)",
            filter: "blur(28px)",
            opacity: 0.7,
            animation: "mb_platSweep 18s linear infinite",
          }} />
          {/* Inner platform disc (perspective squish) */}
          <div style={{
            position: "absolute",
            left: "50%", top: "70%",
            width: 360, height: 110,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center," +
              " rgba(255,255,255,0.85) 0%," +
              " rgba(206,147,216,0.7) 18%," +
              " rgba(123,47,190,0.55) 38%," +
              " rgba(0,0,0,0) 70%)",
            boxShadow:
              "0 0 80px rgba(206,147,216,0.6)," +
              " 0 0 160px rgba(64,196,255,0.35)",
            animation: "mb_platPulse 3.5s ease-in-out infinite",
          }} />
          {/* Hard rim under the brawler's feet */}
          <div style={{
            position: "absolute",
            left: "50%", top: "70%",
            width: 280, height: 30,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center," +
              " rgba(255,255,255,0.55) 0%," +
              " rgba(255,255,255,0.0) 70%)",
            transform: "translate(-50%, -50%)",
            filter: "blur(2px)",
          }} />
        </>
      )}
    </div>
  );
}
