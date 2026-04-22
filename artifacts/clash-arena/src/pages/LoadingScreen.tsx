import { useEffect, useState } from "react";

interface Props {
  onDone: () => void;
  duration?: number;
  label?: string;
}

export default function LoadingScreen({ onDone, duration = 4500, label = "ЗАГРУЗКА" }: Props) {
  const [progress, setProgress] = useState(0);
  const base = (import.meta as any).env?.BASE_URL ?? "/";

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setTimeout(onDone, 150);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, onDone]);

  const percent = Math.floor(progress * 100);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0A0014",
        overflow: "hidden",
        zIndex: 1000,
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* Battle scene with the actual in-game brawlers */}
      <img
        src={`${base}loading.png`}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "brightness(0.85) saturate(1.15)",
          animation: "loadingZoom 8s ease-in-out infinite alternate",
        }}
      />

      {/* Bottom vignette so the progress bar pops */}
      <div
        style={{
          position: "absolute", inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 55%, rgba(5,0,20,0.92) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Top-left title badge */}
      <div
        style={{
          position: "absolute",
          top: 28, left: 28,
          zIndex: 5,
          padding: "16px 28px",
          background: "linear-gradient(135deg, #FF1744 0%, #7B2FBE 50%, #00B0FF 100%)",
          borderRadius: 18,
          boxShadow:
            "0 12px 50px rgba(123,47,190,0.6), inset 0 0 30px rgba(255,255,255,0.15)",
          border: "2px solid rgba(255,255,255,0.25)",
          transform: "rotate(-2deg)",
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 900,
            letterSpacing: 4,
            color: "white",
            lineHeight: 1,
            textShadow: "0 3px 12px rgba(0,0,0,0.5)",
          }}
        >
          CLASH
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: 10,
            color: "#FFE57F",
            marginTop: 4,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          ARENA
        </div>
      </div>

      {/* Bottom-center progress block */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 60,
          transform: "translateX(-50%)",
          width: "min(620px, 80vw)",
          textAlign: "center",
          zIndex: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: 14,
              letterSpacing: 5,
              color: "rgba(255,255,255,0.85)",
              fontWeight: 800,
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: 32,
              fontWeight: 900,
              background:
                "linear-gradient(135deg, #FFD700 0%, #FF5252 70%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "0 0 18px rgba(255,215,0,0.5)",
              letterSpacing: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {percent}%
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: 26,
            borderRadius: 99,
            background:
              "linear-gradient(180deg, rgba(20,8,40,0.9), rgba(40,20,70,0.85))",
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,0.55)",
            boxShadow:
              "0 0 30px rgba(123,47,190,0.6), inset 0 2px 8px rgba(0,0,0,0.7)",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              background:
                "linear-gradient(90deg, #7B2FBE 0%, #FF5252 50%, #FFD700 100%)",
              boxShadow: "0 0 20px rgba(255,215,0,0.9)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                animation: "shimmer 1.4s linear infinite",
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes loadingZoom {
          0%   { transform: scale(1.04) translate(0, 0); }
          100% { transform: scale(1.12) translate(-1.5%, -1%); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
