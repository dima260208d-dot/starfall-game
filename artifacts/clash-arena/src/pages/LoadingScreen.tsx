import { useEffect, useRef, useState } from "react";

interface Props {
  onDone: () => void;
  /**
   * Minimum time (ms) the screen stays visible even when real loading is done.
   * Defaults to 1500 ms in progress-driven mode, 4500 in timer-only mode.
   */
  duration?: number;
  label?: string;
  /**
   * If provided (0 → 1), the progress bar mirrors real asset loading instead
   * of the timer.  onDone fires once progress >= 1 AND duration ms have passed.
   */
  progress?: number;
}

export default function LoadingScreen({
  onDone,
  duration,
  label = "ЗАГРУЗКА",
  progress: externalProgress,
}: Props) {
  const hasExternal = externalProgress !== undefined;
  const minDuration = duration ?? (hasExternal ? 1500 : 4500);

  // Timer-only mode: drive progress from elapsed time
  const [timerProgress, setTimerProgress] = useState(0);
  const startRef = useRef(performance.now());
  const doneCalledRef = useRef(false);

  useEffect(() => {
    startRef.current = performance.now();
    doneCalledRef.current = false;

    if (!hasExternal) {
      // Timer-based mode (transition loading screens)
      let raf = 0;
      const tick = (t: number) => {
        const p = Math.min(1, (t - startRef.current) / minDuration);
        setTimerProgress(p);
        if (p < 1) {
          raf = requestAnimationFrame(tick);
        } else if (!doneCalledRef.current) {
          doneCalledRef.current = true;
          setTimeout(onDone, 150);
        }
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    // progress-driven: just tick to know when minDuration has elapsed
    const timer = setTimeout(() => setTimerProgress(1), minDuration);
    return () => clearTimeout(timer);
  }, [hasExternal, minDuration, onDone]);

  // In progress-driven mode call onDone once BOTH real loading is done AND
  // the minimum duration has elapsed.
  useEffect(() => {
    if (!hasExternal) return;
    if ((externalProgress ?? 0) >= 1 && timerProgress >= 1 && !doneCalledRef.current) {
      doneCalledRef.current = true;
      setTimeout(onDone, 300);
    }
  }, [hasExternal, externalProgress, timerProgress, onDone]);

  const displayProgress = hasExternal ? (externalProgress ?? 0) : timerProgress;
  const percent = Math.floor(displayProgress * 100);
  const base = (import.meta as any).env?.BASE_URL ?? "/";

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
      {/* Battle scene background */}
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

      {/* Bottom vignette */}
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
        <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 4, color: "white", lineHeight: 1, textShadow: "0 3px 12px rgba(0,0,0,0.5)" }}>
          CLASH
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 10, color: "#FFE57F", marginTop: 4, textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
          ARENA
        </div>
      </div>

      {/* Bottom progress block */}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <span style={{ fontSize: 14, letterSpacing: 5, color: "rgba(255,255,255,0.85)", fontWeight: 800 }}>
            {label}
          </span>
          <span
            style={{
              fontSize: 32, fontWeight: 900,
              background: "linear-gradient(135deg, #FFD700 0%, #FF5252 70%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              textShadow: "0 0 18px rgba(255,215,0,0.5)",
              letterSpacing: 1, fontVariantNumeric: "tabular-nums",
            }}
          >
            {percent}%
          </span>
        </div>
        <div
          style={{
            width: "100%", height: 26, borderRadius: 99,
            background: "linear-gradient(180deg, rgba(20,8,40,0.9), rgba(40,20,70,0.85))",
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,0.55)",
            boxShadow: "0 0 30px rgba(123,47,190,0.6), inset 0 2px 8px rgba(0,0,0,0.7)",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${percent}%`, height: "100%",
              background: "linear-gradient(90deg, #7B2FBE 0%, #FF5252 50%, #FFD700 100%)",
              boxShadow: "0 0 20px rgba(255,215,0,0.9)",
              position: "relative",
              transition: hasExternal ? "width 0.3s ease" : undefined,
            }}
          >
            <div
              style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
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
