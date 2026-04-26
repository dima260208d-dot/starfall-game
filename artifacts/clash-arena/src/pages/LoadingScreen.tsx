import { useEffect, useRef, useState, useMemo } from "react";

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

/*
 * Battle layout — two teams clash at the center (~50% mark).
 * "side": 0 = left team, 1 = right team
 * "anim": attack animation name
 * Characters closer to center have higher zIdx and slightly larger h.
 */
const FIGHTERS = [
  /* ── Left team ─────────────────────────────────────── */
  { src: taro,    left: 1,  bottom: 6,  h: 130, flip: false, anim: "castAnim",  delay: 0.7, zIdx: 3 },
  { src: hana,    left: 8,  bottom: 7,  h: 138, flip: false, anim: "shootAnim", delay: 0.3, zIdx: 4 },
  { src: kenji,   left: 15, bottom: 6,  h: 155, flip: false, anim: "shootAnim", delay: 0.9, zIdx: 5 },
  { src: goro,    left: 23, bottom: 5,  h: 195, flip: false, anim: "meleeAnim", delay: 0,   zIdx: 7 },
  { src: rin,     left: 33, bottom: 7,  h: 162, flip: false, anim: "dashAnim",  delay: 0.4, zIdx: 8 },
  /* ── Right team ─────────────────────────────────────── */
  { src: miya,    left: 53, bottom: 7,  h: 162, flip: true,  anim: "dashAnim",  delay: 0.2, zIdx: 8 },
  { src: ronin,   left: 60, bottom: 5,  h: 195, flip: true,  anim: "meleeAnim", delay: 0.1, zIdx: 7 },
  { src: sora,    left: 71, bottom: 6,  h: 155, flip: true,  anim: "castAnim",  delay: 0.5, zIdx: 5 },
  { src: yuki,    left: 79, bottom: 7,  h: 145, flip: true,  anim: "castAnim",  delay: 1.0, zIdx: 4 },
  { src: zafkiel, left: 87, bottom: 6,  h: 138, flip: true,  anim: "shootAnim", delay: 0.8, zIdx: 3 },
] as const;

/* Projectiles — fire from behind each team toward the other */
const PROJECTILES = [
  { fromLeft: true,  top: 30, color: "#00E5FF", w: 36, h: 5, dur: 0.85, delay: 0.0  },
  { fromLeft: true,  top: 37, color: "#FFD700", w: 28, h: 4, dur: 1.0,  delay: 0.45 },
  { fromLeft: true,  top: 43, color: "#FF9800", w: 22, h: 4, dur: 0.95, delay: 0.9  },
  { fromLeft: true,  top: 35, color: "#E040FB", w: 20, h: 3, dur: 1.1,  delay: 1.4  },
  { fromLeft: false, top: 32, color: "#FF1744", w: 34, h: 5, dur: 0.88, delay: 0.2  },
  { fromLeft: false, top: 40, color: "#76FF03", w: 26, h: 4, dur: 1.05, delay: 0.65 },
  { fromLeft: false, top: 28, color: "#18FFFF", w: 24, h: 3, dur: 0.92, delay: 1.1  },
  { fromLeft: false, top: 46, color: "#FF6D00", w: 20, h: 3, dur: 1.2,  delay: 1.6  },
];

/* Clash explosion flashes right in the middle */
const IMPACTS = [
  { left: 46, top: 36, color: "#FFD700", size: 28, dur: 0.65, delay: 0.0  },
  { left: 52, top: 44, color: "#FF1744", size: 22, dur: 0.80, delay: 0.3  },
  { left: 49, top: 28, color: "#E040FB", size: 24, dur: 0.72, delay: 0.6  },
  { left: 44, top: 50, color: "#00E5FF", size: 18, dur: 0.90, delay: 0.9  },
  { left: 54, top: 33, color: "#FF9800", size: 20, dur: 0.68, delay: 1.2  },
  { left: 48, top: 42, color: "#76FF03", size: 16, dur: 0.85, delay: 1.5  },
];

/* Weapon-trail slashes drawn as rotated divs in the melee zone */
const SLASHES = [
  { left: 44, top: 40, rot: -35, w: 90,  color: "#FFD700", dur: 0.6, delay: 0.15 },
  { left: 49, top: 35, rot:  50, w: 70,  color: "#FF4444", dur: 0.7, delay: 0.55 },
  { left: 46, top: 48, rot: -55, w: 60,  color: "#FFFFFF", dur: 0.5, delay: 0.95 },
];

function Stars() {
  const items = useMemo(() =>
    Array.from({ length: 70 }, (_, i) => ({
      x: Math.random() * 100, y: Math.random() * 55,
      r: Math.random() * 1.6 + 0.4,
      op: Math.random() * 0.5 + 0.3,
      dur: Math.random() * 3 + 2,
      del: Math.random() * 4,
    })), []);
  return <>
    {items.map((s, i) => (
      <div key={i} style={{
        position: "absolute", left: `${s.x}%`, top: `${s.y}%`,
        width: s.r * 2, height: s.r * 2, borderRadius: "50%",
        background: "white", opacity: s.op,
        animation: `starPulse ${s.dur}s ${s.del}s ease-in-out infinite alternate`,
      }} />
    ))}
  </>;
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
        if (p < 1) { raf = requestAnimationFrame(tick); }
        else if (!doneCalledRef.current) { doneCalledRef.current = true; setTimeout(onDone, 150); }
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
    <div style={{
      position: "fixed", inset: 0,
      background: "radial-gradient(ellipse at 50% 20%, #240060 0%, #09001a 55%, #000008 100%)",
      overflow: "hidden", zIndex: 1000,
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <Stars />

      {/* Sky atmosphere */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "50%",
        background: "linear-gradient(180deg, rgba(60,0,120,0.3) 0%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Ground dark layer */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "42%",
        background: "linear-gradient(0deg, rgba(30,0,60,0.98) 0%, rgba(70,10,140,0.35) 70%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* Ground glow line */}
      <div style={{
        position: "absolute", bottom: "19%", left: "2%", right: "2%", height: 3,
        background: "linear-gradient(90deg, transparent, rgba(160,60,255,0.5) 15%, rgba(255,140,0,1) 50%, rgba(160,60,255,0.5) 85%, transparent)",
        boxShadow: "0 0 30px rgba(255,140,0,0.8), 0 0 60px rgba(180,80,255,0.5)",
        borderRadius: 99,
      }} />

      {/* Main clash glow — always on in the melee zone */}
      <div style={{
        position: "absolute", left: "49%", top: "46%",
        transform: "translate(-50%,-50%)",
        width: 480, height: 300,
        background: "radial-gradient(ellipse, rgba(255,120,0,0.55) 0%, rgba(180,40,255,0.22) 50%, transparent 72%)",
        filter: "blur(30px)", borderRadius: "50%",
        animation: "clashGlow 0.8s ease-in-out infinite alternate",
        pointerEvents: "none",
      }} />

      {/* Weapon slash trails */}
      {SLASHES.map((s, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${s.left}%`, top: `${s.top}%`,
          width: s.w, height: 3,
          background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`,
          boxShadow: `0 0 12px ${s.color}, 0 0 24px ${s.color}80`,
          transform: `translate(-50%,-50%) rotate(${s.rot}deg)`,
          transformOrigin: "center",
          animation: `slashFlash ${s.dur}s ${s.delay}s ease-in-out infinite`,
          pointerEvents: "none",
          zIndex: 9,
          borderRadius: 99,
        }} />
      ))}

      {/* Projectiles */}
      {PROJECTILES.map((p, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${p.top}%`,
          width: p.w, height: p.h,
          borderRadius: 99,
          background: `linear-gradient(${p.fromLeft ? "90deg" : "270deg"}, transparent 0%, ${p.color} 100%)`,
          boxShadow: `0 0 ${p.h * 4}px ${p.color}, 0 0 ${p.h * 8}px ${p.color}60`,
          animation: `proj${p.fromLeft ? "LR" : "RL"} ${p.dur}s ${p.delay}s linear infinite`,
          pointerEvents: "none",
          zIndex: 7,
        }} />
      ))}

      {/* Impact flashes */}
      {IMPACTS.map((im, i) => (
        <div key={i} style={{
          position: "absolute",
          left: `${im.left}%`, top: `${im.top}%`,
          width: im.size, height: im.size,
          borderRadius: "50%",
          background: im.color,
          boxShadow: `0 0 ${im.size * 2}px ${im.color}, 0 0 ${im.size * 5}px ${im.color}60`,
          animation: `impactBurst ${im.dur}s ${im.delay}s ease-out infinite`,
          transform: "translate(-50%,-50%)",
          pointerEvents: "none",
          zIndex: 8,
        }} />
      ))}

      {/* Fighters */}
      {FIGHTERS.map((f, i) => (
        <div key={i} style={{
          position: "absolute",
          bottom: `${f.bottom + 19}%`,
          left: `${f.left}%`,
          transform: f.flip ? "scaleX(-1)" : undefined,
          zIndex: f.zIdx,
          pointerEvents: "none",
          userSelect: "none",
        }}>
          <img
            src={f.src}
            alt=""
            draggable={false}
            style={{
              display: "block", height: f.h, width: "auto",
              filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.95)) drop-shadow(0 0 10px rgba(140,70,255,0.5))",
              animation: `${f.anim} 1.6s ${f.delay}s ease-in-out infinite alternate`,
            }}
          />
        </div>
      ))}

      {/* STARFALL — top-right, bare glowing text */}
      <div style={{
        position: "absolute", top: 26, right: 30, zIndex: 10,
        lineHeight: 1, userSelect: "none", textAlign: "right",
      }}>
        <div style={{
          fontSize: 50, fontWeight: 900, letterSpacing: 5, color: "white",
          textShadow: "0 0 20px rgba(255,200,0,0.95), 0 0 55px rgba(200,80,255,0.7), 0 4px 16px rgba(0,0,0,0.95)",
          animation: "titleGlow 2.4s ease-in-out infinite alternate",
        }}>
          STARFALL
        </div>
        <div style={{
          fontSize: 12, letterSpacing: 7, color: "rgba(255,220,100,0.85)",
          marginTop: 3, textShadow: "0 0 10px rgba(255,200,0,0.7)", fontWeight: 700,
        }}>
          BATTLE ARENA
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        position: "absolute", left: "50%", bottom: 30,
        transform: "translateX(-50%)",
        width: "min(600px, 78vw)", textAlign: "center", zIndex: 9,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontSize: 13, letterSpacing: 5, color: "rgba(255,255,255,0.8)", fontWeight: 800 }}>{label}</span>
          <span style={{
            fontSize: 30, fontWeight: 900,
            background: "linear-gradient(135deg,#FFD700,#FF5252)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            letterSpacing: 1, fontVariantNumeric: "tabular-nums",
          }}>{percent}%</span>
        </div>
        <div style={{
          width: "100%", height: 22, borderRadius: 99,
          background: "rgba(20,8,40,0.9)", overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.4)",
          boxShadow: "0 0 24px rgba(123,47,190,0.5), inset 0 2px 8px rgba(0,0,0,0.8)",
        }}>
          <div style={{
            width: `${percent}%`, height: "100%",
            background: "linear-gradient(90deg,#7B2FBE,#FF5252 55%,#FFD700)",
            boxShadow: "0 0 18px rgba(255,215,0,0.8)",
            position: "relative",
            transition: hasExternal ? "width 0.3s ease" : undefined,
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.38),transparent)",
              animation: "shimmer 1.4s linear infinite",
            }} />
          </div>
        </div>
      </div>

      <style>{`
        /* ── Attack animations ── */

        /* Melee: lunge forward toward center with a heavy swing */
        @keyframes meleeAnim {
          0%   { transform: translateX(0px)  translateY(0px)  rotate(0deg)  scale(1);    }
          25%  { transform: translateX(20px) translateY(-8px) rotate(-10deg) scale(1.08); }
          55%  { transform: translateX(32px) translateY(-4px) rotate(-18deg) scale(1.12); }
          80%  { transform: translateX(18px) translateY(2px)  rotate(-6deg)  scale(1.05); }
          100% { transform: translateX(8px)  translateY(0px)  rotate(-2deg)  scale(1.02); }
        }

        /* Dash: quick forward dash with body lean */
        @keyframes dashAnim {
          0%   { transform: translateX(0px)  translateY(0px)  scaleY(1);    }
          20%  { transform: translateX(8px)  translateY(-4px) scaleY(0.92); }
          45%  { transform: translateX(28px) translateY(-10px) scaleY(0.88); }
          70%  { transform: translateX(18px) translateY(-6px) scaleY(0.95); }
          100% { transform: translateX(6px)  translateY(-2px) scaleY(1);    }
        }

        /* Shoot: recoil backward + muzzle-flash settle */
        @keyframes shootAnim {
          0%   { transform: translateX(0px)  translateY(0px);  filter: brightness(1);   }
          15%  { transform: translateX(6px)  translateY(-4px); filter: brightness(1.6); }
          30%  { transform: translateX(-6px) translateY(2px);  filter: brightness(1);   }
          55%  { transform: translateX(4px)  translateY(-2px); filter: brightness(1.3); }
          80%  { transform: translateX(-3px) translateY(0px);  filter: brightness(1);   }
          100% { transform: translateX(2px)  translateY(-3px); filter: brightness(1.15);}
        }

        /* Cast: float + glow burst */
        @keyframes castAnim {
          0%   { transform: translateY(0px)   scale(1);    filter: brightness(1);   }
          30%  { transform: translateY(-14px) scale(1.07); filter: brightness(1.8); }
          60%  { transform: translateY(-8px)  scale(1.04); filter: brightness(1.3); }
          100% { transform: translateY(-3px)  scale(1.01); filter: brightness(1);   }
        }

        /* ── Projectiles ── */
        @keyframes projLR {
          0%   { left: 36%; opacity: 0; }
          8%   { opacity: 1; }
          88%  { opacity: 1; }
          100% { left: 55%; opacity: 0; }
        }
        @keyframes projRL {
          0%   { left: 64%; opacity: 0; }
          8%   { opacity: 1; }
          88%  { opacity: 1; }
          100% { left: 45%; opacity: 0; }
        }

        /* ── Impact burst ── */
        @keyframes impactBurst {
          0%   { transform: translate(-50%,-50%) scale(0.1); opacity: 0; }
          15%  { transform: translate(-50%,-50%) scale(1.6); opacity: 1; }
          50%  { transform: translate(-50%,-50%) scale(1.0); opacity: 0.6; }
          100% { transform: translate(-50%,-50%) scale(0.2); opacity: 0; }
        }

        /* ── Slash trail ── */
        @keyframes slashFlash {
          0%   { opacity: 0; transform: translate(-50%,-50%) rotate(var(--r)) scaleX(0.3); }
          20%  { opacity: 1; transform: translate(-50%,-50%) rotate(var(--r)) scaleX(1); }
          60%  { opacity: 0.5; }
          100% { opacity: 0; }
        }

        /* ── Background ── */
        @keyframes clashGlow {
          0%   { opacity: 0.55; transform: translate(-50%,-50%) scale(0.9); }
          100% { opacity: 1;   transform: translate(-50%,-50%) scale(1.12); }
        }
        @keyframes titleGlow {
          0%   { text-shadow: 0 0 16px rgba(255,200,0,0.8), 0 0 45px rgba(200,80,255,0.5), 0 4px 16px rgba(0,0,0,0.95); }
          100% { text-shadow: 0 0 30px rgba(255,220,0,1),   0 0 75px rgba(220,100,255,0.85), 0 4px 16px rgba(0,0,0,0.95); }
        }
        @keyframes starPulse {
          0%   { opacity: 0.15; }
          100% { opacity: 0.8; }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
