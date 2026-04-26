import { useEffect, useRef, useState } from "react";

import zafkiel from "@assets/иконка_зафкиэль_1777201259430.png";
import taro    from "@assets/Meshy_AI_afc9748ce6a3539d3791bcddd97eaf3119c248f2625383d6ec9b0_1777201259431.png";
import rin     from "@assets/rin_front_1777201259432.png";
import sora    from "@assets/sora_front_1777201259432.png";
import goro    from "@assets/goro_front_1777201259433.png";
import hana    from "@assets/hana_front_1777201259434.png";
import kenji   from "@assets/kenji_front_1777201259434.png";
import yuki    from "@assets/yuki_front_1777201259435.png";
import ronin   from "@assets/ronin_front_1777201259436.png";
import miya    from "@assets/miya_front_1777201259436.png";

interface Props {
  onDone: () => void;
  duration?: number;
  label?: string;
  progress?: number;
}

/* Each character: src, bottom offset (%), left pos (%), height (px), horizontal flip, bob-delay (s) */
const FIGHTERS: {
  src: string;
  bottom: number;
  left: number;
  h: number;
  flip?: boolean;
  delay: number;
  phase?: number; // 0=left team, 1=right team
}[] = [
  { src: goro,   bottom: -2,  left: 1,   h: 200, flip: false, delay: 0,    phase: 0 },
  { src: kenji,  bottom: 0,   left: 9,   h: 168, flip: false, delay: 0.3,  phase: 0 },
  { src: rin,    bottom: 1,   left: 17,  h: 152, flip: false, delay: 0.6,  phase: 0 },
  { src: hana,   bottom: 2,   left: 25,  h: 144, flip: false, delay: 0.9,  phase: 0 },
  { src: taro,   bottom: 0,   left: 33,  h: 148, flip: false, delay: 1.1,  phase: 0 },
  { src: ronin,  bottom: -2,  left: 58,  h: 200, flip: true,  delay: 0,    phase: 1 },
  { src: miya,   bottom: 0,   left: 67,  h: 156, flip: true,  delay: 0.4,  phase: 1 },
  { src: sora,   bottom: 1,   left: 75,  h: 144, flip: true,  delay: 0.7,  phase: 1 },
  { src: yuki,   bottom: 0,   left: 82,  h: 158, flip: true,  delay: 1.0,  phase: 1 },
  { src: zafkiel,bottom: 2,   left: 90,  h: 148, flip: true,  delay: 1.2,  phase: 1 },
];

/* Tiny star particles rendered with CSS */
function Stars() {
  const stars = Array.from({ length: 80 }, (_, i) => ({
    x: Math.random() * 100,
    y: Math.random() * 65,
    r: Math.random() * 1.8 + 0.4,
    op: Math.random() * 0.7 + 0.3,
    dur: Math.random() * 3 + 2,
    del: Math.random() * 4,
  }));
  return (
    <>
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.r * 2,
            height: s.r * 2,
            borderRadius: "50%",
            background: "white",
            opacity: s.op,
            animation: `starPulse ${s.dur}s ${s.del}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </>
  );
}

/* Floating combat particles (sparks) around the center clash zone */
function Sparks() {
  const sparks = Array.from({ length: 18 }, (_, i) => ({
    x: 38 + Math.random() * 24,
    y: 30 + Math.random() * 40,
    color: ["#FFD700", "#FF5252", "#7B2FBE", "#00B0FF", "#FF9800"][i % 5],
    dur: Math.random() * 1.2 + 0.8,
    del: Math.random() * 2,
    size: Math.random() * 6 + 3,
  }));
  return (
    <>
      {sparks.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: s.color,
            boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
            animation: `sparkFloat ${s.dur}s ${s.del}s ease-in-out infinite alternate`,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

export default function LoadingScreen({
  onDone,
  duration,
  label = "ЗАГРУЗКА",
  progress: externalProgress,
}: Props) {
  const hasExternal = externalProgress !== undefined;
  const minDuration = duration ?? (hasExternal ? 1500 : 4500);

  const [timerProgress, setTimerProgress] = useState(0);
  const startRef = useRef(performance.now());
  const doneCalledRef = useRef(false);

  useEffect(() => {
    startRef.current = performance.now();
    doneCalledRef.current = false;

    if (!hasExternal) {
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
    const timer = setTimeout(() => setTimerProgress(1), minDuration);
    return () => clearTimeout(timer);
  }, [hasExternal, minDuration, onDone]);

  useEffect(() => {
    if (!hasExternal) return;
    if ((externalProgress ?? 0) >= 1 && timerProgress >= 1 && !doneCalledRef.current) {
      doneCalledRef.current = true;
      setTimeout(onDone, 300);
    }
  }, [hasExternal, externalProgress, timerProgress, onDone]);

  const displayProgress = hasExternal ? (externalProgress ?? 0) : timerProgress;
  const percent = Math.floor(displayProgress * 100);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 30%, #1a0040 0%, #0a0018 55%, #000008 100%)",
        overflow: "hidden",
        zIndex: 1000,
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      {/* Stars */}
      <Stars />

      {/* Clash glow — centre of the screen */}
      <div style={{
        position: "absolute",
        left: "50%", top: "38%",
        transform: "translate(-50%, -50%)",
        width: 420, height: 280,
        background: "radial-gradient(ellipse, rgba(255,100,0,0.38) 0%, rgba(123,47,190,0.18) 50%, transparent 75%)",
        borderRadius: "50%",
        filter: "blur(24px)",
        animation: "clashPulse 1.6s ease-in-out infinite alternate",
        pointerEvents: "none",
      }} />

      {/* Ground glow strip */}
      <div style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: "38%",
        background: "linear-gradient(0deg, rgba(60,10,100,0.85) 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Battlefield ground line */}
      <div style={{
        position: "absolute",
        bottom: "18%", left: "5%", right: "5%",
        height: 2,
        background: "linear-gradient(90deg, transparent, rgba(200,100,255,0.6) 20%, rgba(255,180,0,0.8) 50%, rgba(200,100,255,0.6) 80%, transparent)",
        boxShadow: "0 0 18px rgba(200,100,255,0.6)",
        borderRadius: 99,
      }} />

      {/* Sparks in the clash zone */}
      <Sparks />

      {/* STARFALL title — top-right, no background */}
      <div style={{
        position: "absolute",
        top: 28, right: 32,
        zIndex: 10,
        lineHeight: 1,
        userSelect: "none",
      }}>
        <div style={{
          fontSize: 52,
          fontWeight: 900,
          letterSpacing: 5,
          color: "white",
          textShadow: [
            "0 0 24px rgba(255,200,0,0.9)",
            "0 0 60px rgba(200,80,255,0.7)",
            "0 4px 18px rgba(0,0,0,0.9)",
            "0 2px 4px rgba(0,0,0,1)",
          ].join(", "),
          animation: "titleGlow 2.4s ease-in-out infinite alternate",
        }}>
          STARFALL
        </div>
        <div style={{
          fontSize: 13,
          letterSpacing: 7,
          color: "rgba(255,220,100,0.85)",
          textAlign: "right",
          marginTop: 2,
          textShadow: "0 0 12px rgba(255,200,0,0.7)",
          fontWeight: 700,
        }}>
          BATTLE ARENA
        </div>
      </div>

      {/* Fighters — wrapper handles position+flip; img handles bob */}
      {FIGHTERS.map((f, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            bottom: `${f.bottom + 18}%`,
            left: `${f.left}%`,
            transform: f.flip ? "scaleX(-1)" : undefined,
            zIndex: f.phase === 0 ? 3 : 4,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <img
            src={f.src}
            alt=""
            draggable={false}
            style={{
              display: "block",
              height: f.h,
              width: "auto",
              imageRendering: "auto",
              filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.9)) drop-shadow(0 0 12px rgba(120,60,220,0.5))",
              animation: `fighterBob 2.2s ${f.delay}s ease-in-out infinite alternate`,
            }}
          />
        </div>
      ))}

      {/* Clash "VS" burst in the centre */}
      <div style={{
        position: "absolute",
        left: "50%", bottom: "30%",
        transform: "translateX(-50%)",
        zIndex: 5,
        fontSize: 56,
        fontWeight: 900,
        color: "white",
        letterSpacing: 4,
        textShadow: "0 0 30px #FFD700, 0 0 60px #FF5252, 0 4px 8px rgba(0,0,0,1)",
        animation: "vsPulse 1.2s ease-in-out infinite alternate",
        userSelect: "none",
        pointerEvents: "none",
        lineHeight: 1,
      }}>
        VS
      </div>

      {/* Bottom progress block */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 36,
          transform: "translateX(-50%)",
          width: "min(600px, 78vw)",
          textAlign: "center",
          zIndex: 9,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontSize: 13, letterSpacing: 5, color: "rgba(255,255,255,0.8)", fontWeight: 800 }}>
            {label}
          </span>
          <span style={{
            fontSize: 30, fontWeight: 900,
            background: "linear-gradient(135deg, #FFD700 0%, #FF5252 70%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            letterSpacing: 1, fontVariantNumeric: "tabular-nums",
          }}>
            {percent}%
          </span>
        </div>
        <div style={{
          width: "100%", height: 22, borderRadius: 99,
          background: "rgba(20,8,40,0.9)",
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.4)",
          boxShadow: "0 0 24px rgba(123,47,190,0.5), inset 0 2px 8px rgba(0,0,0,0.8)",
          position: "relative",
        }}>
          <div style={{
            width: `${percent}%`, height: "100%",
            background: "linear-gradient(90deg, #7B2FBE 0%, #FF5252 55%, #FFD700 100%)",
            boxShadow: "0 0 18px rgba(255,215,0,0.8)",
            position: "relative",
            transition: hasExternal ? "width 0.3s ease" : undefined,
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent)",
              animation: "shimmer 1.4s linear infinite",
            }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fighterBob {
          0%   { transform: translateY(0px); }
          100% { transform: translateY(-10px); }
        }
        @keyframes clashPulse {
          0%   { opacity: 0.6; transform: translate(-50%,-50%) scale(0.95); }
          100% { opacity: 1;   transform: translate(-50%,-50%) scale(1.08); }
        }
        @keyframes vsPulse {
          0%   { transform: translateX(-50%) scale(0.92) rotate(-3deg); opacity: 0.85; }
          100% { transform: translateX(-50%) scale(1.08) rotate(3deg);  opacity: 1; }
        }
        @keyframes titleGlow {
          0%   { text-shadow: 0 0 18px rgba(255,200,0,0.8), 0 0 50px rgba(200,80,255,0.5), 0 4px 18px rgba(0,0,0,0.9); }
          100% { text-shadow: 0 0 32px rgba(255,220,0,1),   0 0 80px rgba(220,100,255,0.8), 0 4px 18px rgba(0,0,0,0.9); }
        }
        @keyframes starPulse {
          0%   { opacity: 0.2; }
          100% { opacity: 0.9; }
        }
        @keyframes sparkFloat {
          0%   { transform: translateY(0) scale(0.8); opacity: 0.5; }
          100% { transform: translateY(-18px) scale(1.3); opacity: 1; }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
