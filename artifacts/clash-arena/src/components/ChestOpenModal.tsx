import { useEffect, useState, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CHESTS, type ChestRarity, type ChestRoll } from "../utils/chests";
import { BRAWLERS } from "../entities/BrawlerData";
import ChestVisual from "./ChestVisual";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";

interface Props {
  rarity: ChestRarity;
  rolls: ChestRoll[];
  onClose: () => void;
}

type Phase = "idle" | "shaking" | "exploding" | "results";

const STYLES = `
  @keyframes chestOpenTitle {
    from { opacity: 0; transform: translateY(-30px) scale(0.8); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes rewardPop {
    0%   { opacity: 0; transform: scale(0.3) translateY(30px); }
    60%  { transform: scale(1.18) translateY(-4px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes burstRay {
    0%   { opacity: 0; transform: scale(0.3) rotate(var(--rot)); }
    40%  { opacity: 1; transform: scale(1.3) rotate(var(--rot)); }
    100% { opacity: 0; transform: scale(1.8) rotate(var(--rot)); }
  }
  @keyframes particleFall {
    0%   { opacity: 1; transform: translateY(0) rotate(var(--spin-start)) scale(1); }
    80%  { opacity: 0.8; }
    100% { opacity: 0; transform: translateY(var(--fall-dist)) rotate(var(--spin-end)) scale(0.6); }
  }
  @keyframes silhouetteGrow {
    0%   { transform: scale(0.15) rotate(-540deg); filter: brightness(0) saturate(0) drop-shadow(0 0 0px transparent); }
    60%  { transform: scale(1.08) rotate(5deg); filter: brightness(0) saturate(0) drop-shadow(0 0 40px rgba(255,255,255,0.6)); }
    80%  { transform: scale(0.98) rotate(-2deg); filter: brightness(0) saturate(0) drop-shadow(0 0 60px rgba(255,255,255,0.9)); }
    100% { transform: scale(1) rotate(0deg); filter: brightness(0) saturate(0) drop-shadow(0 0 80px rgba(255,255,255,1)); }
  }
  @keyframes brawlerReveal {
    0%   { filter: brightness(0) saturate(0); }
    100% { filter: brightness(1.3) saturate(1.5) drop-shadow(0 0 30px var(--brawler-glow)); }
  }
  @keyframes brawlerSlideLeft {
    from { transform: translateX(0); }
    to   { transform: translateX(-120px); }
  }
  @keyframes brawlerInfoIn {
    from { opacity: 0; transform: translateX(60px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 20px var(--glow-color); }
    50%       { box-shadow: 0 0 50px var(--glow-color), 0 0 80px var(--glow-color); }
  }
  @keyframes floatUp {
    0%   { transform: translateY(0) scale(1); }
    50%  { transform: translateY(-8px) scale(1.05); }
    100% { transform: translateY(0) scale(1); }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
`;

interface Particle {
  id: number;
  x: number;
  delay: number;
  duration: number;
  spinStart: number;
  spinEnd: number;
  fallDist: number;
  size: number;
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: Math.min(count, 28) }, (_, i) => ({
    id: i,
    x: 5 + Math.random() * 90,
    delay: Math.random() * 1.2,
    duration: 1.8 + Math.random() * 1.0,
    spinStart: Math.random() * 360,
    spinEnd: Math.random() * 720 - 360,
    fallDist: 75 + Math.random() * 20,
    size: 20 + Math.random() * 18,
  }));
}

function ParticleLayer({ type, count, color }: { type: "coins" | "gems" | "powerPoints"; count: number; color: string }) {
  const particles = useRef(makeParticles(count)).current;
  const icon = type === "coins" ? "🪙" : type === "gems" ? "💎" : "⚡";
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: "-5%",
            left: `${p.x}%`,
            fontSize: p.size,
            lineHeight: 1,
            animationName: "particleFall",
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            animationFillMode: "both",
            "--fall-dist": `${p.fallDist}vh`,
            "--spin-start": `${p.spinStart}deg`,
            "--spin-end": `${p.spinEnd}deg`,
            filter: `drop-shadow(0 0 4px ${color})`,
          } as React.CSSProperties}
        >
          {icon}
        </div>
      ))}
    </div>
  );
}

type BrawlerPhase = "silhouette" | "reveal" | "slide";

function BrawlerReveal({ roll, chestColor, onDone }: { roll: ChestRoll; chestColor: string; onDone: () => void }) {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const brawler = BRAWLERS.find(b => b.id === roll.brawlerId);
  const [bPhase, setBPhase] = useState<BrawlerPhase>("silhouette");

  useEffect(() => {
    const t1 = setTimeout(() => setBPhase("reveal"), 2000);
    const t2 = setTimeout(() => { setBPhase("slide"); onDone(); }, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!brawler) return null;

  return (
    <div style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(circle at center, ${brawler.color}44 0%, transparent 70%)`,
        animation: bPhase === "reveal" || bPhase === "slide" ? "pulseGlow 1.5s ease-in-out infinite" : "none",
        "--glow-color": `${brawler.color}44`,
      } as React.CSSProperties} />

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        position: "relative",
        zIndex: 2,
      }}>
        <div style={{
          animation: bPhase === "silhouette"
            ? "silhouetteGrow 2s cubic-bezier(0.25,0.46,0.45,0.94) forwards"
            : bPhase === "reveal"
              ? "brawlerReveal 1s ease-out forwards, floatUp 3s ease-in-out infinite"
              : "brawlerSlideLeft 0.6s ease-out forwards",
          "--brawler-glow": brawler.color,
        } as React.CSSProperties}>
          <img
            src={`${base}brawlers/${brawler.id}_front.png`}
            alt={brawler.name}
            style={{ width: 220, height: 220, objectFit: "contain" }}
          />
        </div>

        {(bPhase === "reveal" || bPhase === "slide") && (
          <div style={{
            animation: "brawlerInfoIn 0.6s ease-out",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 220,
          }}>
            <div style={{
              background: `linear-gradient(135deg, ${brawler.color}, ${brawler.secondaryColor})`,
              borderRadius: 8, padding: "4px 14px",
              fontSize: 11, fontWeight: 900, letterSpacing: 3,
              color: "white", alignSelf: "flex-start",
              textTransform: "uppercase",
            }}>
              🎉 НОВЫЙ БОЕЦ
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: brawler.color, lineHeight: 1, letterSpacing: 2, textShadow: `0 0 30px ${brawler.color}` }}>
              {brawler.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", letterSpacing: 2, textTransform: "uppercase" }}>
              {brawler.role}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: 280 }}>
              {brawler.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChestOpenModal({ rarity, rolls, onClose }: Props) {
  const def = CHESTS[rarity];
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealed, setRevealed] = useState(0);
  const [showParticles, setShowParticles] = useState(false);
  const [brawlerDone, setBrawlerDone] = useState(false);

  const brawlerRoll = rolls.find(r => r.type === "brawler");
  const resourceRolls = rolls.filter(r => r.type !== "brawler");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("shaking"), 150);
    const t2 = setTimeout(() => setPhase("exploding"), 1500);
    const t3 = setTimeout(() => {
      setPhase("results");
      setShowParticles(true);
    }, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (phase !== "results") return;
    if (revealed >= rolls.length) return;
    const delay = revealed === 0 ? 600 : 130;
    const t = setTimeout(() => setRevealed(v => v + 1), delay);
    return () => clearTimeout(t);
  }, [phase, revealed, rolls.length]);

  const totalCoins = rolls.filter(r => r.type === "coins").reduce((s, r) => s + r.amount, 0);
  const totalGems = rolls.filter(r => r.type === "gems").reduce((s, r) => s + r.amount, 0);
  const totalPower = rolls.filter(r => r.type === "powerPoints").reduce((s, r) => s + r.amount, 0);

  const modal = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: `radial-gradient(ellipse at center, ${def.color}22 0%, rgba(0,0,5,0.96) 75%)`,
        backdropFilter: "blur(12px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <style>{STYLES}</style>

      {showParticles && phase === "results" && totalCoins > 0 && (
        <ParticleLayer type="coins" count={Math.floor(totalCoins / 40) + 3} color="#FFD700" />
      )}
      {showParticles && phase === "results" && totalGems > 0 && (
        <ParticleLayer type="gems" count={Math.floor(totalGems / 5) + 3} color="#40C4FF" />
      )}
      {showParticles && phase === "results" && totalPower > 0 && (
        <ParticleLayer type="powerPoints" count={Math.floor(totalPower / 5) + 3} color="#CE93D8" />
      )}

      <div style={{
        fontSize: 26, fontWeight: 900, letterSpacing: 4,
        color: def.color, marginBottom: 12,
        textShadow: `0 0 40px ${def.color}, 0 4px 14px rgba(0,0,0,0.9)`,
        animation: "chestOpenTitle 0.5s ease",
        textTransform: "uppercase",
        zIndex: 2,
      }}>
        {def.name}
      </div>

      {phase !== "results" && (
        <div style={{ position: "relative", width: 300, height: 280, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
          {phase === "exploding" && Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute", left: "50%", top: "50%",
              width: 6, height: 300,
              background: `linear-gradient(180deg, ${def.color}ff, ${def.color}00)`,
              transformOrigin: "top center",
              "--rot": `${i * 22.5}deg`,
              animation: "burstRay 0.75s ease-out forwards",
              opacity: 0,
            } as React.CSSProperties} />
          ))}
          <ChestVisual rarity={rarity} size={230} animated shake={phase === "shaking"} exploding={phase === "exploding"} />
        </div>
      )}

      {phase === "results" && brawlerRoll && !brawlerDone && (
        <div style={{ position: "relative", width: "100%", height: 340, zIndex: 2 }}>
          <BrawlerReveal roll={brawlerRoll} chestColor={def.color} onDone={() => setBrawlerDone(true)} />
        </div>
      )}

      {phase === "results" && (brawlerDone || !brawlerRoll) && (
        <div style={{
          zIndex: 2,
          maxWidth: 680,
          width: "90%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 12,
            justifyContent: "center",
          }}>
            {resourceRolls.slice(0, revealed).map((r, i) => (
              <RewardCard key={i} roll={r} />
            ))}
          </div>

          {revealed >= rolls.length && (
            <button
              onClick={onClose}
              style={{
                marginTop: 8,
                background: `linear-gradient(135deg, ${def.color}, ${def.secondaryColor})`,
                border: "none", borderRadius: 16,
                padding: "16px 60px",
                color: "white", fontWeight: 900, fontSize: 18, letterSpacing: 4,
                cursor: "pointer",
                boxShadow: `0 8px 40px ${def.color}88`,
                textTransform: "uppercase",
                animation: "floatUp 2s ease-in-out infinite",
              }}
            >
              ОТЛИЧНО
            </button>
          )}
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}

function RewardCard({ roll }: { roll: ChestRoll }) {
  const base = (import.meta as any).env?.BASE_URL ?? "/";

  if (roll.type === "brawler" && roll.brawlerId) {
    const brawler = BRAWLERS.find(b => b.id === roll.brawlerId);
    if (!brawler) return null;
    return (
      <div style={{
        background: `linear-gradient(180deg, ${brawler.color}33 0%, rgba(0,0,0,0.7) 100%)`,
        border: `2px solid ${brawler.color}`,
        borderRadius: 20, padding: "18px 24px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        animation: "rewardPop 0.5s ease-out",
        boxShadow: `0 0 40px ${brawler.color}aa`,
        minWidth: 200, position: "relative",
      }}>
        <div style={{
          position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
          background: brawler.color, color: "white",
          fontSize: 10, fontWeight: 900, letterSpacing: 2,
          borderRadius: 10, padding: "4px 12px",
          whiteSpace: "nowrap",
        }}>
          🎉 НОВЫЙ БОЕЦ
        </div>
        <img
          src={`${base}brawlers/${brawler.id}_front.png`}
          alt={brawler.name}
          style={{ width: 90, height: 90, objectFit: "contain", filter: `drop-shadow(0 4px 16px ${brawler.color})`, marginTop: 8 }}
        />
        <div style={{ fontSize: 20, fontWeight: 900, color: brawler.color, letterSpacing: 1 }}>{brawler.name}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 2 }}>{brawler.role.toUpperCase()}</div>
      </div>
    );
  }

  const meta: { icon: ReactNode; color: string; label: string } = {
    coins:        { icon: <CoinIcon size={40} />, color: "#FFD700", label: "монет" },
    gems:         { icon: <GemIcon size={40} />,  color: "#40C4FF", label: "кристаллов" },
    powerPoints:  { icon: <PowerIcon size={40} />, color: "#CE93D8", label: "ОП" },
    brawler:      { icon: "🦸", color: "#CE93D8", label: "боец" },
  }[roll.type] ?? { icon: "🎁", color: "#FFD700", label: "" };

  return (
    <div style={{
      background: `linear-gradient(135deg, ${meta.color}15, rgba(0,0,0,0.5))`,
      border: `1.5px solid ${meta.color}77`,
      borderRadius: 16,
      padding: "16px 22px",
      display: "flex", alignItems: "center", gap: 14,
      animation: "rewardPop 0.45s cubic-bezier(0.34,1.56,0.64,1)",
      boxShadow: `0 0 24px ${meta.color}44`,
      minWidth: 140,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44 }}>
        {meta.icon}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 900, color: meta.color, lineHeight: 1, textShadow: `0 0 12px ${meta.color}` }}>
          +{roll.amount}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginTop: 2, textTransform: "uppercase" }}>
          {meta.label}
        </div>
      </div>
    </div>
  );
}
