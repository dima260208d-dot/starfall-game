import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
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

type Phase = "idle" | "shaking" | "exploding" | "dropping" | "collecting" | "done";

// ── CSS keyframes ──────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes chestShake {
    0%,100% { transform: translateX(0) rotate(0deg); }
    15%      { transform: translateX(-10px) rotate(-4deg); }
    30%      { transform: translateX(12px) rotate(4deg); }
    45%      { transform: translateX(-8px) rotate(-3deg); }
    60%      { transform: translateX(10px) rotate(3deg); }
    75%      { transform: translateX(-6px) rotate(-2deg); }
    90%      { transform: translateX(6px) rotate(2deg); }
  }
  @keyframes burstRay {
    0%   { opacity: 0; transform: scale(0.3) rotate(var(--rot)); }
    40%  { opacity: 1; transform: scale(1.3) rotate(var(--rot)); }
    100% { opacity: 0; transform: scale(1.8) rotate(var(--rot)); }
  }
  @keyframes dropBounce {
    0%   { transform: translateY(-130vh) scale(0.7) rotate(-8deg); opacity: 0.4; }
    55%  { transform: translateY(18px) scale(1.12) rotate(2deg); opacity: 1; }
    72%  { transform: translateY(-14px) scale(0.97) rotate(-1deg); }
    84%  { transform: translateY(8px) scale(1.03) rotate(0.5deg); }
    93%  { transform: translateY(-5px) scale(0.99); }
    100% { transform: translateY(0) scale(1) rotate(0deg); }
  }
  @keyframes amountPop {
    0%   { opacity: 0; transform: translate(-50%, 0) scale(0.4); }
    35%  { opacity: 1; transform: translate(-50%, -10px) scale(1.25); }
    60%  { transform: translate(-50%, -4px) scale(1); }
    80%  { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%, -50px) scale(0.9); }
  }
  @keyframes counterPop {
    0%   { transform: scale(0.7); opacity: 0.3; }
    60%  { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes flashRing {
    0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.2); }
    60%  { opacity: 0.8; }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(2.5); }
  }
  @keyframes flyOut {
    0%   { opacity: 1; transform: translate(0,0) scale(1); }
    30%  { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--fly-x), var(--fly-y)) scale(0.25); }
  }
  @keyframes hudFlash {
    0%   { opacity: 1; transform: scale(1.6); }
    100% { opacity: 0; transform: scale(1); }
  }
  @keyframes silhouetteGrow {
    0%   { transform: scale(0.15) rotate(-540deg); filter: brightness(0) saturate(0); }
    60%  { transform: scale(1.08) rotate(5deg); filter: brightness(0) saturate(0) drop-shadow(0 0 40px rgba(255,255,255,0.6)); }
    80%  { transform: scale(0.98) rotate(-2deg); filter: brightness(0) saturate(0) drop-shadow(0 0 60px rgba(255,255,255,0.9)); }
    100% { transform: scale(1) rotate(0deg); filter: brightness(0) saturate(0) drop-shadow(0 0 80px rgba(255,255,255,1)); }
  }
  @keyframes brawlerReveal {
    0%   { filter: brightness(0) saturate(0); }
    100% { filter: brightness(1.3) saturate(1.5) drop-shadow(0 0 30px var(--brawler-glow)); }
  }
  @keyframes brawlerInfoIn {
    from { opacity: 0; transform: translateX(40px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes floatUp {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-8px); }
  }
  @keyframes pulseGlow {
    0%,100% { box-shadow: 0 0 20px var(--glow-color); }
    50%     { box-shadow: 0 0 55px var(--glow-color), 0 0 90px var(--glow-color); }
  }
  @keyframes skipHint {
    0%,80%,100% { opacity: 0.35; }
    40%         { opacity: 0.65; }
  }
`;

// ── Resource metadata ─────────────────────────────────────────────────────────
function getMeta(type: ChestRoll["type"]): { icon: ReactNode; bigIcon: string; color: string; label: string; flyX: string; flyY: string } {
  const map: Record<string, { icon: ReactNode; bigIcon: string; color: string; label: string; flyX: string; flyY: string }> = {
    coins:       { icon: <CoinIcon size={22} />,  bigIcon: "🪙", color: "#FFD700", label: "монет",       flyX: "45vw",  flyY: "-44vh" },
    gems:        { icon: <GemIcon size={22} />,   bigIcon: "💎", color: "#40C4FF", label: "кристаллов",  flyX: "46vw",  flyY: "-44vh" },
    powerPoints: { icon: <PowerIcon size={22} />, bigIcon: "⚡", color: "#CE93D8", label: "ОП",          flyX: "47vw",  flyY: "-44vh" },
    brawler:     { icon: <span>🦸</span>,         bigIcon: "🦸", color: "#FF80AB", label: "боец",        flyX: "45vw",  flyY: "-44vh" },
  };
  return map[type] ?? map.coins;
}

// ── Inline brawler reveal (sequenced as a drop) ───────────────────────────────
type BPhase = "silhouette" | "reveal" | "done";
function BrawlerDropReveal({ roll, onDone }: { roll: ChestRoll; onDone: () => void }) {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const brawler = BRAWLERS.find(b => b.id === roll.brawlerId);
  const [bPhase, setBPhase] = useState<BPhase>("silhouette");

  useEffect(() => {
    const t1 = setTimeout(() => setBPhase("reveal"), 1800);
    const t2 = setTimeout(() => { setBPhase("done"); onDone(); }, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!brawler) { onDone(); return null; }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 32,
      width: "100%",
      padding: "0 24px",
    }}>
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(circle at center, ${brawler.color}33 0%, transparent 65%)`,
        animation: bPhase === "reveal" ? "pulseGlow 1.5s ease-in-out infinite" : "none",
        "--glow-color": `${brawler.color}33`,
        pointerEvents: "none",
      } as React.CSSProperties} />
      <div style={{
        animation: bPhase === "silhouette"
          ? "silhouetteGrow 1.8s cubic-bezier(0.25,0.46,0.45,0.94) forwards"
          : "brawlerReveal 0.9s ease-out forwards, floatUp 2.5s ease-in-out infinite",
        "--brawler-glow": brawler.color,
        zIndex: 2,
      } as React.CSSProperties}>
        <img
          src={`${base}brawlers/${brawler.id}_front.png`}
          alt={brawler.name}
          style={{ width: 200, height: 200, objectFit: "contain" }}
        />
      </div>
      {bPhase === "reveal" && (
        <div style={{ animation: "brawlerInfoIn 0.5s ease-out", zIndex: 2, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{
            background: `linear-gradient(135deg, ${brawler.color}, ${brawler.secondaryColor})`,
            borderRadius: 8, padding: "4px 14px",
            fontSize: 10, fontWeight: 900, letterSpacing: 3,
            color: "white", alignSelf: "flex-start", textTransform: "uppercase",
          }}>🎉 НОВЫЙ БОЕЦ</div>
          <div style={{ fontSize: 38, fontWeight: 900, color: brawler.color, lineHeight: 1, textShadow: `0 0 28px ${brawler.color}` }}>
            {brawler.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", letterSpacing: 2, textTransform: "uppercase" }}>
            {brawler.role}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, maxWidth: 260 }}>
            {brawler.description}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single item drop display ──────────────────────────────────────────────────
function ItemDrop({ roll, onDone }: { roll: ChestRoll; onDone: () => void }) {
  const [showFlash, setShowFlash] = useState(false);
  const doneCalledRef = useRef(false);
  const meta = getMeta(roll.type);

  const callDone = useCallback(() => {
    if (!doneCalledRef.current) {
      doneCalledRef.current = true;
      onDone();
    }
  }, [onDone]);

  const isBrawler = roll.type === "brawler";

  useEffect(() => {
    if (isBrawler) return; // brawler reveal manages its own timing
    const t1 = setTimeout(() => setShowFlash(true), 550);
    const t2 = setTimeout(() => callDone(), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [callDone, isBrawler]);

  if (isBrawler) {
    return <BrawlerDropReveal roll={roll} onDone={callDone} />;
  }

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Flash ring on landing */}
      {showFlash && (
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          width: 200, height: 200,
          border: `3px solid ${meta.color}`,
          borderRadius: "50%",
          animation: "flashRing 0.5s ease-out forwards",
          pointerEvents: "none",
        }} />
      )}

      {/* Main icon */}
      <div style={{
        fontSize: 110,
        lineHeight: 1,
        animation: "dropBounce 0.75s cubic-bezier(0.22,1,0.36,1) forwards",
        filter: `drop-shadow(0 0 24px ${meta.color}) drop-shadow(0 8px 16px rgba(0,0,0,0.6))`,
        userSelect: "none",
      }}>
        {meta.bigIcon}
      </div>

      {/* Amount label — pops in and floats up */}
      <div style={{
        position: "absolute",
        bottom: -32,
        left: "50%",
        fontSize: 52,
        fontWeight: 900,
        color: meta.color,
        textShadow: `0 0 20px ${meta.color}, 0 3px 8px rgba(0,0,0,0.9)`,
        letterSpacing: 2,
        whiteSpace: "nowrap",
        animation: "amountPop 1.3s ease-out forwards",
        animationDelay: "0.5s",
        opacity: 0,
      }}>
        +{roll.amount}
      </div>

      {/* Resource label */}
      <div style={{
        marginTop: 12,
        fontSize: 14,
        fontWeight: 700,
        color: "rgba(255,255,255,0.5)",
        letterSpacing: 3,
        textTransform: "uppercase",
      }}>
        {meta.label}
      </div>
    </div>
  );
}

// ── Flying resource icons for collection phase ────────────────────────────────
interface FlyIcon {
  id: number;
  type: ChestRoll["type"];
  x: number;
  y: number;
  delay: number;
}

function CollectingAnimation({ rolls, onDone }: { rolls: ChestRoll[]; onDone: () => void }) {
  const resources: FlyIcon[] = [];
  let id = 0;
  const counts: Record<string, number> = {};
  for (const r of rolls) {
    if (r.type !== "brawler") {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    }
  }

  for (const [type, count] of Object.entries(counts)) {
    const n = Math.min(count * 3, 12);
    for (let i = 0; i < n; i++) {
      resources.push({
        id: id++,
        type: type as ChestRoll["type"],
        x: (Math.random() - 0.5) * 180,
        y: (Math.random() - 0.5) * 100,
        delay: i * 60,
      });
    }
  }

  useEffect(() => {
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {resources.map(f => {
        const meta = getMeta(f.type as ChestRoll["type"]);
        return (
          <div
            key={f.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              fontSize: 26,
              transform: `translate(calc(-50% + ${f.x}px), calc(-50% + ${f.y}px))`,
              "--fly-x": meta.flyX,
              "--fly-y": meta.flyY,
              animation: "flyOut 0.9s ease-in forwards",
              animationDelay: `${f.delay}ms`,
              opacity: 0,
              filter: `drop-shadow(0 0 6px ${meta.color})`,
            } as React.CSSProperties}
          >
            {meta.bigIcon}
          </div>
        );
      })}
    </div>
  );
}

// ── Summary row shown in done phase ──────────────────────────────────────────
function SummaryRow({ rolls }: { rolls: ChestRoll[] }) {
  const coins = rolls.filter(r => r.type === "coins").reduce((s, r) => s + r.amount, 0);
  const gems = rolls.filter(r => r.type === "gems").reduce((s, r) => s + r.amount, 0);
  const power = rolls.filter(r => r.type === "powerPoints").reduce((s, r) => s + r.amount, 0);
  const brawler = rolls.find(r => r.type === "brawler");
  const brawlerData = brawler?.brawlerId ? BRAWLERS.find(b => b.id === brawler.brawlerId) : null;

  const base = (import.meta as any).env?.BASE_URL ?? "/";

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center",
      animation: "brawlerInfoIn 0.5s ease-out",
    }}>
      {coins > 0 && (
        <div style={{ background: "rgba(255,215,0,0.12)", border: "1.5px solid #FFD70077", borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, minWidth: 120 }}>
          <CoinIcon size={32} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#FFD700", lineHeight: 1, textShadow: "0 0 10px #FFD700" }}>+{coins}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginTop: 2 }}>МОНЕТ</div>
          </div>
        </div>
      )}
      {gems > 0 && (
        <div style={{ background: "rgba(64,196,255,0.12)", border: "1.5px solid #40C4FF77", borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, minWidth: 120 }}>
          <GemIcon size={32} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#40C4FF", lineHeight: 1, textShadow: "0 0 10px #40C4FF" }}>+{gems}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginTop: 2 }}>КРИСТАЛЛОВ</div>
          </div>
        </div>
      )}
      {power > 0 && (
        <div style={{ background: "rgba(206,147,216,0.12)", border: "1.5px solid #CE93D877", borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, minWidth: 120 }}>
          <PowerIcon size={32} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#CE93D8", lineHeight: 1, textShadow: "0 0 10px #CE93D8" }}>+{power}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginTop: 2 }}>ОП</div>
          </div>
        </div>
      )}
      {brawlerData && (
        <div style={{
          background: `linear-gradient(180deg, ${brawlerData.color}25 0%, rgba(0,0,0,0.6) 100%)`,
          border: `2px solid ${brawlerData.color}`,
          borderRadius: 16, padding: "14px 20px",
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: `0 0 30px ${brawlerData.color}55`,
        }}>
          <img
            src={`${base}brawlers/${brawlerData.id}_front.png`}
            alt={brawlerData.name}
            style={{ width: 64, height: 64, objectFit: "contain", filter: `drop-shadow(0 0 10px ${brawlerData.color})` }}
          />
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: brawlerData.color, letterSpacing: 2, marginBottom: 4 }}>🎉 НОВЫЙ БОЕЦ</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: brawlerData.color }}>{brawlerData.name}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 2 }}>{brawlerData.role.toUpperCase()}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ChestOpenModal({ rarity, rolls, onClose }: Props) {
  const def = CHESTS[rarity];
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentDrop, setCurrentDrop] = useState(-1);
  const [collecting, setCollecting] = useState(false);
  const skipRef = useRef(false);

  // ── Auto-advance through phases ───────────────────────────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("shaking"), 100);
    const t2 = setTimeout(() => setPhase("exploding"), 1200);
    const t3 = setTimeout(() => { setPhase("dropping"); setCurrentDrop(0); }, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // ── Advance to next drop ──────────────────────────────────────────────────
  const advanceDrop = useCallback(() => {
    setCurrentDrop(prev => {
      const next = prev + 1;
      if (next >= rolls.length) {
        setCollecting(true);
        return prev;
      }
      return next;
    });
  }, [rolls.length]);

  // ── Collecting → done ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!collecting) return;
    const t = setTimeout(() => setPhase("done"), 1400);
    return () => clearTimeout(t);
  }, [collecting]);

  // ── Tap to skip ───────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (phase === "done") { onClose(); return; }
    if (phase === "dropping" && !collecting) {
      if (!skipRef.current) {
        skipRef.current = true;
        advanceDrop();
        setTimeout(() => { skipRef.current = false; }, 100);
      }
    }
    if (phase === "idle" || phase === "shaking" || phase === "exploding") {
      setPhase("dropping");
      setCurrentDrop(0);
    }
  }, [phase, collecting, advanceDrop, onClose]);

  const isChestPhase = phase === "idle" || phase === "shaking" || phase === "exploding";
  const isDroppingPhase = phase === "dropping";
  const roll = currentDrop >= 0 && currentDrop < rolls.length ? rolls[currentDrop] : null;
  const remaining = rolls.length - currentDrop;

  const modal = (
    <div
      onClick={handleTap}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: `radial-gradient(ellipse at center, ${def.color}1a 0%, rgba(0,0,5,0.96) 70%)`,
        backdropFilter: "blur(14px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        cursor: phase === "done" ? "default" : "pointer",
        userSelect: "none",
      }}
    >
      <style>{STYLES}</style>

      {/* ── Chest name ── */}
      <div style={{
        position: "absolute", top: 24,
        fontSize: 20, fontWeight: 900, letterSpacing: 4,
        color: def.color,
        textShadow: `0 0 30px ${def.color}`,
        textTransform: "uppercase",
        zIndex: 2,
      }}>
        {def.name}
      </div>

      {/* ── Item counter ── */}
      {isDroppingPhase && !collecting && remaining > 0 && (
        <div
          key={currentDrop}
          style={{
            position: "absolute", top: 60,
            fontSize: 15, fontWeight: 700,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: 2,
            animation: "counterPop 0.3s ease-out",
            zIndex: 2,
          }}
        >
          Предмет {currentDrop + 1} / {rolls.length}
        </div>
      )}

      {/* ── Chest (idle/shaking/exploding) ── */}
      {isChestPhase && (
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
          {phase === "exploding" && Array.from({ length: 16 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute", left: "50%", top: "50%",
              width: 5, height: 280,
              background: `linear-gradient(180deg, ${def.color}ff, ${def.color}00)`,
              transformOrigin: "top center",
              "--rot": `${i * 22.5}deg`,
              animation: "burstRay 0.8s ease-out forwards",
              opacity: 0,
            } as React.CSSProperties} />
          ))}
          <div style={{
            animation: phase === "shaking" ? "chestShake 0.8s ease-in-out" : "none",
          }}>
            <ChestVisual rarity={rarity} size={220} animated shake={false} exploding={phase === "exploding"} />
          </div>
        </div>
      )}

      {/* ── Current item drop ── */}
      {isDroppingPhase && !collecting && roll && (
        <div
          key={currentDrop}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: 340,
            zIndex: 2,
          }}
        >
          <ItemDrop roll={roll} onDone={advanceDrop} />
        </div>
      )}

      {/* ── Collecting animation ── */}
      {collecting && phase !== "done" && (
        <CollectingAnimation
          rolls={rolls}
          onDone={() => {}}
        />
      )}

      {/* ── Done — summary + button ── */}
      {phase === "done" && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          zIndex: 2,
          maxWidth: 680, width: "90%",
        }}>
          <SummaryRow rolls={rolls} />
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            style={{
              marginTop: 8,
              background: `linear-gradient(135deg, ${def.color}, ${def.secondaryColor})`,
              border: "none", borderRadius: 16,
              padding: "14px 56px",
              color: "white", fontWeight: 900, fontSize: 16, letterSpacing: 4,
              cursor: "pointer",
              boxShadow: `0 8px 40px ${def.color}88`,
              textTransform: "uppercase",
              animation: "floatUp 2s ease-in-out infinite",
            }}
          >
            ОТЛИЧНО
          </button>
        </div>
      )}

      {/* ── Tap hint ── */}
      {isDroppingPhase && !collecting && phase !== "done" && roll?.type !== "brawler" && (
        <div style={{
          position: "absolute", bottom: 28,
          fontSize: 11, color: "rgba(255,255,255,0.3)",
          letterSpacing: 2, textTransform: "uppercase",
          animation: "skipHint 2.5s ease-in-out infinite",
          zIndex: 2,
        }}>
          Нажмите для пропуска
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
