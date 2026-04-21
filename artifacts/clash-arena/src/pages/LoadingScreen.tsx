import { useEffect, useState } from "react";

interface Props {
  onDone: () => void;
  duration?: number;
  label?: string;
}

export default function LoadingScreen({ onDone, duration = 2200, label = "ЗАГРУЗКА" }: Props) {
  const [progress, setProgress] = useState(0);
  const base = (import.meta as any).env?.BASE_URL ?? "/";

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setProgress(p);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(onDone, 120);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0A0014",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        zIndex: 1000,
      }}
    >
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
          animation: "loadingZoom 6s ease-in-out infinite alternate",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(10,0,20,0.85) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          textAlign: "center",
          marginBottom: 60,
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            letterSpacing: 6,
            background: "linear-gradient(135deg, #FFD700 0%, #FF5252 50%, #7B2FBE 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 40px rgba(255,215,0,0.4)",
            lineHeight: 1,
          }}
        >
          CLASH
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 14,
            color: "#CE93D8",
            textShadow: "0 0 20px rgba(206,147,216,0.6)",
          }}
        >
          ARENA
        </div>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 2,
          width: "min(420px, 70vw)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 13,
            letterSpacing: 4,
            color: "rgba(255,255,255,0.7)",
            marginBottom: 12,
            fontWeight: 700,
          }}
        >
          {label}
          <span style={{ display: "inline-block", marginLeft: 8 }}>
            {Math.floor(progress * 100)}%
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: 10,
            borderRadius: 99,
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 0 20px rgba(123,47,190,0.3)",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg, #7B2FBE, #FFD700, #FF5252)",
              transition: "width 80ms linear",
              boxShadow: "0 0 12px rgba(255,215,0,0.7)",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes loadingZoom {
          0%   { transform: scale(1.02) translate(0,0); }
          100% { transform: scale(1.10) translate(-1.5%, -1%); }
        }
      `}</style>
    </div>
  );
}
