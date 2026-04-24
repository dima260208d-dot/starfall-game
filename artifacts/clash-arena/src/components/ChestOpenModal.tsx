import { useEffect, useState, type ReactNode } from "react";
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

export default function ChestOpenModal({ rarity, rolls, onClose }: Props) {
  const def = CHESTS[rarity];
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("shaking"), 150);
    const t2 = setTimeout(() => setPhase("exploding"), 1500);
    const t3 = setTimeout(() => setPhase("results"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (phase !== "results") return;
    if (revealed >= rolls.length) return;
    const t = setTimeout(() => setRevealed(v => v + 1), 130);
    return () => clearTimeout(t);
  }, [phase, revealed, rolls.length]);

  return (
    <div
      onClick={() => phase === "results" && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: `radial-gradient(circle at center, ${def.color}33 0%, rgba(0,0,0,0.92) 80%)`,
        backdropFilter: "blur(8px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <style>{`
        @keyframes openTitle {
          from { opacity: 0; transform: translateY(-30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rewardPop {
          0%   { opacity: 0; transform: scale(0.4) translateY(20px); }
          70%  { transform: scale(1.15) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes burstRay {
          0%   { opacity: 0; transform: scale(0.3) rotate(var(--rot)); }
          50%  { opacity: 1; transform: scale(1.2) rotate(var(--rot)); }
          100% { opacity: 0; transform: scale(1.6) rotate(var(--rot)); }
        }
      `}</style>

      <div style={{
        fontSize: 28, fontWeight: 900, letterSpacing: 3,
        color: def.color,
        marginBottom: 10,
        textShadow: `0 0 30px ${def.color}, 0 4px 10px rgba(0,0,0,0.8)`,
        animation: "openTitle 0.4s ease",
      }}>
        {def.name.toUpperCase()}
      </div>

      <div style={{ position: "relative", width: 280, height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Burst rays during explode */}
        {phase === "exploding" && Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "50%",
            width: 8, height: 280,
            background: `linear-gradient(180deg, ${def.color}, transparent)`,
            transformOrigin: "top center",
            "--rot": `${i * 30}deg`,
            animation: "burstRay 0.7s ease-out forwards",
          } as React.CSSProperties} />
        ))}
        {phase !== "results" && (
          <ChestVisual
            rarity={rarity}
            size={220}
            animated
            shake={phase === "shaking"}
            exploding={phase === "exploding"}
          />
        )}
      </div>

      {/* Rewards */}
      {phase === "results" && (
        <div style={{
          marginTop: 4, maxWidth: 600,
          display: "flex", flexWrap: "wrap", gap: 12,
          justifyContent: "center",
        }}>
          {rolls.slice(0, revealed).map((r, i) => (
            <RewardCard key={i} roll={r} />
          ))}
        </div>
      )}

      {phase === "results" && revealed >= rolls.length && (
        <button
          onClick={onClose}
          style={{
            marginTop: 28,
            background: `linear-gradient(135deg, ${def.color}, ${def.secondaryColor})`,
            border: "none", borderRadius: 14,
            padding: "14px 50px",
            color: "white", fontWeight: 900, fontSize: 16, letterSpacing: 3,
            cursor: "pointer",
            boxShadow: `0 8px 30px ${def.color}77`,
          }}
        >
          ОТЛИЧНО
        </button>
      )}
    </div>
  );
}

function RewardCard({ roll }: { roll: ChestRoll }) {
  const base = (import.meta as any).env?.BASE_URL ?? "/";

  if (roll.type === "brawler" && roll.brawlerId) {
    const brawler = BRAWLERS.find(b => b.id === roll.brawlerId);
    if (!brawler) return null;
    return (
      <div style={{
        background: `linear-gradient(180deg, ${brawler.color}33 0%, rgba(0,0,0,0.6) 100%)`,
        border: `2px solid ${brawler.color}`,
        borderRadius: 16,
        padding: "14px 20px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        animation: "rewardPop 0.5s ease-out",
        boxShadow: `0 0 35px ${brawler.color}aa`,
        minWidth: 180,
        position: "relative",
      }}>
        <div style={{
          position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
          background: brawler.color, color: "white",
          fontSize: 10, fontWeight: 900, letterSpacing: 2,
          borderRadius: 8, padding: "3px 10px",
          boxShadow: `0 2px 12px ${brawler.color}`,
          whiteSpace: "nowrap",
        }}>
          🎉 НОВЫЙ БОЕЦ
        </div>
        <img
          src={`${base}brawlers/${brawler.id}_front.png`}
          alt={brawler.name}
          style={{
            width: 80, height: 80, objectFit: "contain",
            filter: `drop-shadow(0 4px 14px ${brawler.color})`,
            marginTop: 6,
          }}
        />
        <div style={{ fontSize: 18, fontWeight: 900, color: brawler.color, marginTop: 2, letterSpacing: 1 }}>
          {brawler.name}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1 }}>
          {brawler.role.toUpperCase()}
        </div>
      </div>
    );
  }

  const meta: { icon: ReactNode; color: string; label: string } = {
    coins:        { icon: <CoinIcon size={36} />, color: "#FFD700", label: "монет" },
    gems:         { icon: <GemIcon size={36} />,  color: "#40C4FF", label: "кристаллов" },
    powerPoints:  { icon: <PowerIcon size={36} />, color: "#CE93D8", label: "ОП" },
    brawler:      { icon: "🦸", color: "#CE93D8", label: "боец" },
  }[roll.type] ?? { icon: "🎁", color: "#FFD700", label: "" };
  return (
    <div style={{
      background: "rgba(255,255,255,0.06)",
      border: `1px solid ${meta.color}66`,
      borderRadius: 12,
      padding: "12px 18px",
      display: "flex", alignItems: "center", gap: 10,
      animation: "rewardPop 0.4s ease-out",
      boxShadow: `0 0 20px ${meta.color}33`,
      minWidth: 120,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40 }}>{meta.icon}</div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: meta.color, lineHeight: 1 }}>
          +{roll.amount}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginTop: 2 }}>
          {meta.label}
        </div>
      </div>
    </div>
  );
}
