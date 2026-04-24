import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { CHESTS, type ChestRarity, type ChestRoll } from "../utils/chests";
import { BRAWLERS } from "../entities/BrawlerData";
import ChestVisual from "./ChestVisual";
import ChestItemScene from "./ChestItemScene";

interface Props {
  rarity: ChestRarity;
  rolls: ChestRoll[];
  onClose: () => void;
}

type Phase = "chest" | "dropping" | "brawler" | "collecting" | "done";

// ── Keyframes ─────────────────────────────────────────────────────────────────
const STYLES = `
  @keyframes chestShake {
    0%,100% { transform: rotate(0deg); }
    15%      { transform: rotate(-5deg) translateX(-6px); }
    30%      { transform: rotate(5deg) translateX(8px); }
    50%      { transform: rotate(-3deg) translateX(-5px); }
    70%      { transform: rotate(3deg) translateX(5px); }
    85%      { transform: rotate(-2deg); }
  }
  @keyframes burstRay {
    0%   { opacity: 0; transform: scale(0.2) rotate(var(--rot)); }
    35%  { opacity: 1; transform: scale(1.4) rotate(var(--rot)); }
    100% { opacity: 0; transform: scale(2) rotate(var(--rot)); }
  }
  @keyframes counterPulse {
    0%,100% { transform: scale(1); }
    50%     { transform: scale(1.15); }
  }
  @keyframes counterAppear {
    from { transform: scale(0.5); opacity: 0; }
    to   { transform: scale(1); opacity: 1; }
  }
  @keyframes brawlerGlow {
    0%,100% { box-shadow: 0 0 20px #FFD700, 0 4px 24px rgba(0,0,0,0.6); }
    50%     { box-shadow: 0 0 50px #FFD700, 0 0 80px #FFD70066; }
  }
  @keyframes silhouetteGrow {
    0%   { transform: scale(0.1) rotate(-540deg); filter: brightness(0) saturate(0); }
    65%  { transform: scale(1.06) rotate(4deg); filter: brightness(0) saturate(0) drop-shadow(0 0 40px rgba(255,255,255,0.7)); }
    82%  { transform: scale(0.97) rotate(-2deg); filter: brightness(0) saturate(0) drop-shadow(0 0 70px rgba(255,255,255,1)); }
    100% { transform: scale(1) rotate(0deg); filter: brightness(0) saturate(0) drop-shadow(0 0 90px rgba(255,255,255,1)); }
  }
  @keyframes brawlerReveal {
    0%   { filter: brightness(0) saturate(0); }
    100% { filter: brightness(1.4) saturate(1.6) drop-shadow(0 0 32px var(--glow)); }
  }
  @keyframes brawlerInfoIn {
    from { opacity: 0; transform: translateX(48px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes floatUp {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-10px); }
  }
  @keyframes pulseGlow {
    0%,100% { box-shadow: 0 0 20px var(--gc); }
    50%     { box-shadow: 0 0 60px var(--gc), 0 0 100px var(--gc); }
  }
  @keyframes flyOut {
    0%   { opacity: 1; transform: translate(0,0) scale(1); }
    25%  { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--fx), var(--fy)) scale(0.2); }
  }
  @keyframes summaryIn {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes tapHint {
    0%,70%,100% { opacity: 0.3; }
    35%         { opacity: 0.7; }
  }
`;

// ── Brawler reveal (during "brawler" phase) ───────────────────────────────────
function BrawlerReveal({ roll, onRevealDone }: { roll: ChestRoll; onRevealDone: () => void }) {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const brawler = BRAWLERS.find(b => b.id === roll.brawlerId);
  const [phase, setPhase] = useState<"silhouette" | "reveal">("silhouette");

  useEffect(() => {
    const t = setTimeout(() => { setPhase("reveal"); onRevealDone(); }, 2000);
    return () => clearTimeout(t);
  }, []);

  if (!brawler) { onRevealDone(); return null; }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at center, ${brawler.color}33 0%, transparent 68%)`,
        animation: phase === "reveal" ? "pulseGlow 1.6s ease-in-out infinite" : "none",
        "--gc": `${brawler.color}55`,
      } as React.CSSProperties} />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 36, zIndex: 2, padding: "0 24px",
      }}>
        <div style={{
          animation: phase === "silhouette"
            ? "silhouetteGrow 2s cubic-bezier(0.22,1,0.36,1) forwards"
            : "brawlerReveal 1s ease-out forwards, floatUp 2.5s ease-in-out infinite",
          "--glow": brawler.color,
        } as React.CSSProperties}>
          <img
            src={`${base}brawlers/${brawler.id}_front.png`}
            alt={brawler.name}
            style={{ width: 200, height: 200, objectFit: "contain" }}
          />
        </div>
        {phase === "reveal" && (
          <div style={{ animation: "brawlerInfoIn 0.5s ease-out", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              background: `linear-gradient(135deg, ${brawler.color}, ${brawler.secondaryColor})`,
              borderRadius: 8, padding: "4px 14px",
              fontSize: 10, fontWeight: 900, letterSpacing: 3, color: "white",
              alignSelf: "flex-start", textTransform: "uppercase",
            }}>🎉 НОВЫЙ БОЕЦ</div>
            <div style={{ fontSize: 38, fontWeight: 900, color: brawler.color, lineHeight: 1, textShadow: `0 0 28px ${brawler.color}` }}>
              {brawler.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", letterSpacing: 2, textTransform: "uppercase" }}>{brawler.role}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, maxWidth: 260 }}>{brawler.description}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
function Summary({ rolls, def, onClose }: { rolls: ChestRoll[]; def: ReturnType<typeof CHESTS[keyof typeof CHESTS]>; onClose: () => void }) {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const coins = rolls.filter(r => r.type === "coins").reduce((s, r) => s + r.amount, 0);
  const gems  = rolls.filter(r => r.type === "gems").reduce((s, r) => s + r.amount, 0);
  const power = rolls.filter(r => r.type === "powerPoints").reduce((s, r) => s + r.amount, 0);
  const brawlerRoll = rolls.find(r => r.type === "brawler");
  const brawler = brawlerRoll?.brawlerId ? BRAWLERS.find(b => b.id === brawlerRoll.brawlerId) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, animation: "summaryIn 0.5s ease-out" }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: def.color, letterSpacing: 4, textShadow: `0 0 20px ${def.color}` }}>
        ИТОГО
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        {coins > 0 && <SummaryCard icon="🪙" color="#FFD700" value={coins} label="МОНЕТ" />}
        {gems > 0  && <SummaryCard icon="💎" color="#40C4FF" value={gems}  label="КРИСТАЛЛОВ" />}
        {power > 0 && <SummaryCard icon="⚡" color="#CE93D8" value={power} label="ОП" />}
        {brawler && (
          <div style={{
            background: `linear-gradient(180deg, ${brawler.color}22 0%, rgba(0,0,0,0.55) 100%)`,
            border: `2px solid ${brawler.color}`,
            borderRadius: 16, padding: "14px 20px",
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: `0 0 32px ${brawler.color}55`,
          }}>
            <img src={`${base}brawlers/${brawler.id}_front.png`} alt={brawler.name}
              style={{ width: 60, height: 60, objectFit: "contain", filter: `drop-shadow(0 0 8px ${brawler.color})` }} />
            <div>
              <div style={{ fontSize: 9, color: brawler.color, fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}>🎉 НОВЫЙ БОЕЦ</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: brawler.color }}>{brawler.name}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 2 }}>{brawler.role.toUpperCase()}</div>
            </div>
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: 8,
          background: `linear-gradient(135deg, ${def.color}, ${def.secondaryColor})`,
          border: "none", borderRadius: 16, padding: "14px 56px",
          color: "white", fontWeight: 900, fontSize: 16, letterSpacing: 4,
          cursor: "pointer", boxShadow: `0 8px 40px ${def.color}88`,
          textTransform: "uppercase", animation: "floatUp 2s ease-in-out infinite",
        }}
      >
        ОТЛИЧНО
      </button>
    </div>
  );
}

function SummaryCard({ icon, color, value, label }: { icon: string; color: string; value: number; label: string }) {
  return (
    <div style={{
      background: `rgba(0,0,0,0.4)`, border: `1.5px solid ${color}66`,
      borderRadius: 14, padding: "12px 20px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontSize: 32, filter: `drop-shadow(0 0 8px ${color})` }}>{icon}</span>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, textShadow: `0 0 10px ${color}` }}>+{value}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Flying particles during collecting ────────────────────────────────────────
type FlyType = "coins" | "gems" | "powerPoints";
const FLY_META: Record<FlyType, { icon: string; fx: string; fy: string }> = {
  coins:       { icon: "🪙", fx: "45vw",  fy: "-46vh" },
  gems:        { icon: "💎", fx: "46.5vw",fy: "-46vh" },
  powerPoints: { icon: "⚡", fx: "48vw",  fy: "-46vh" },
};

function CollectOverlay({ rolls }: { rolls: ChestRoll[] }) {
  const particles: { id: number; type: FlyType; ox: number; oy: number; delay: number }[] = [];
  let id = 0;
  for (const r of rolls) {
    if (r.type === "brawler") continue;
    const count = Math.min((r.amount > 20 ? 10 : r.amount > 5 ? 6 : 3), 12);
    for (let i = 0; i < count; i++) {
      particles.push({
        id: id++,
        type: r.type as FlyType,
        ox: (Math.random() - 0.5) * 160,
        oy: (Math.random() - 0.5) * 100,
        delay: i * 55,
      });
    }
  }

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {particles.map(p => {
        const m = FLY_META[p.type];
        return (
          <div key={p.id} style={{
            position: "absolute", left: "50%", top: "50%",
            fontSize: 22,
            transform: `translate(calc(-50% + ${p.ox}px), calc(-50% + ${p.oy}px))`,
            "--fx": m.fx, "--fy": m.fy,
            animation: "flyOut 0.85s ease-in forwards",
            animationDelay: `${p.delay}ms`,
            opacity: 0,
          } as React.CSSProperties}>{m.icon}</div>
        );
      })}
    </div>
  );
}

// ── Item type meta (for overlay text) ────────────────────────────────────────
const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  coins:       { icon: "🪙", color: "#FFD700", label: "монет" },
  gems:        { icon: "💎", color: "#40C4FF", label: "кристаллов" },
  powerPoints: { icon: "⚡", color: "#CE93D8", label: "очков" },
};

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ChestOpenModal({ rarity, rolls, onClose }: Props) {
  const def = CHESTS[rarity];
  const [phase, setPhase]           = useState<Phase>("chest");
  const [chestSub, setChestSub]     = useState<"idle" | "shaking" | "exploding">("idle");
  const [currentDrop, setCurrentDrop] = useState(-1);  // -1 = not started
  const [revealDone, setRevealDone] = useState(false);
  const canTapRef = useRef(true);

  // ── Chest opening auto-sequence ──────────────────────────────────────────
  useEffect(() => {
    const t1 = setTimeout(() => setChestSub("shaking"), 200);
    const t2 = setTimeout(() => setChestSub("exploding"), 1200);
    const t3 = setTimeout(() => {
      setPhase(rolls[0]?.type === "brawler" ? "brawler" : "dropping");
      setCurrentDrop(0);
    }, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // current roll
  const roll = currentDrop >= 0 && currentDrop < rolls.length ? rolls[currentDrop] : null;

  // remaining = items still to show AFTER the current one
  const remaining = currentDrop >= 0 ? rolls.length - currentDrop - 1 : rolls.length;
  const nextRoll = rolls[currentDrop + 1] ?? null;
  const nextIsBrawler = nextRoll?.type === "brawler";

  // ── Advance to next item ──────────────────────────────────────────────────
  const advance = useCallback(() => {
    if (!canTapRef.current) return;
    canTapRef.current = false;
    setTimeout(() => { canTapRef.current = true; }, 180);

    setCurrentDrop(prev => {
      const next = prev + 1;
      if (next >= rolls.length) {
        // All items shown → collecting
        setPhase("collecting");
        setTimeout(() => setPhase("done"), 1200);
        return prev;
      }
      setRevealDone(false);
      const nextR = rolls[next];
      setPhase(nextR.type === "brawler" ? "brawler" : "dropping");
      return next;
    });
  }, [rolls]);

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (phase === "done") { onClose(); return; }

    // Skip chest animation early
    if (phase === "chest") {
      setChestSub("exploding");
      setTimeout(() => {
        setPhase(rolls[0]?.type === "brawler" ? "brawler" : "dropping");
        setCurrentDrop(0);
      }, 200);
      return;
    }

    // Brawler: only advance after reveal animation has started
    if (phase === "brawler" && !revealDone) return;

    if (phase === "dropping" || (phase === "brawler" && revealDone)) {
      advance();
    }
  }, [phase, revealDone, advance, onClose]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const isResourceDrop = phase === "dropping" && roll && roll.type !== "brawler";
  const isBrawlerDrop  = phase === "brawler"  && roll?.type === "brawler";
  const meta = roll ? TYPE_META[roll.type] : null;

  const modal = (
    <div
      onClick={handleTap}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: `radial-gradient(ellipse at center, ${def.color}18 0%, rgba(0,0,5,0.97) 72%)`,
        backdropFilter: "blur(14px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <style>{STYLES}</style>

      {/* ── Chest name ── */}
      <div style={{
        position: "absolute", top: 22,
        fontSize: 18, fontWeight: 900, letterSpacing: 4,
        color: def.color, textShadow: `0 0 28px ${def.color}`,
        textTransform: "uppercase", zIndex: 3,
      }}>
        {def.name}
      </div>

      {/* ── Chest phase ── */}
      {phase === "chest" && (
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
          {chestSub === "exploding" && Array.from({ length: 18 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute", left: "50%", top: "50%",
              width: 5, height: 260,
              background: `linear-gradient(180deg, ${def.color}ff, transparent)`,
              transformOrigin: "top center",
              "--rot": `${i * 20}deg`,
              animation: "burstRay 0.9s ease-out forwards",
              opacity: 0,
            } as React.CSSProperties} />
          ))}
          <div style={{ animation: chestSub === "shaking" ? "chestShake 0.7s ease-in-out" : "none" }}>
            <ChestVisual rarity={rarity} size={210} animated shake={false} exploding={chestSub === "exploding"} />
          </div>
        </div>
      )}

      {/* ── 3D resource drop ── */}
      {isResourceDrop && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <ChestItemScene
            key={currentDrop}
            type={roll.type as "coins" | "gems" | "powerPoints"}
            amount={roll.amount}
            onAllSettled={() => { /* settled = user can still tap to advance */ }}
          />

          {/* Amount overlay */}
          {meta && (
            <div style={{
              position: "absolute", top: "14%", left: "50%", transform: "translateX(-50%)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              zIndex: 4, pointerEvents: "none",
            }}>
              <div style={{
                fontSize: 72, fontWeight: 900, lineHeight: 1,
                color: meta.color,
                textShadow: `0 0 30px ${meta.color}, 0 4px 12px rgba(0,0,0,0.8)`,
                letterSpacing: 2,
              }}>
                +{roll.amount}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 700, letterSpacing: 3,
                color: "rgba(255,255,255,0.5)", textTransform: "uppercase",
              }}>
                {meta.label}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Brawler reveal ── */}
      {isBrawlerDrop && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
          <BrawlerReveal
            roll={roll}
            onRevealDone={() => setRevealDone(true)}
          />
        </div>
      )}

      {/* ── Collecting overlay ── */}
      {phase === "collecting" && <CollectOverlay rolls={rolls} />}

      {/* ── Done / summary ── */}
      {phase === "done" && (
        <div style={{ zIndex: 4, maxWidth: 680, width: "90%" }} onClick={e => e.stopPropagation()}>
          <Summary rolls={rolls} def={def} onClose={onClose} />
        </div>
      )}

      {/* ── Bottom-right counter ── */}
      {(phase === "dropping" || phase === "brawler") && remaining > 0 && (
        <div
          key={remaining}
          style={{
            position: "absolute",
            bottom: 28, right: 28,
            width: 58, height: 58,
            background: "#CC1111",
            borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2.5px solid #FF4444",
            boxShadow: nextIsBrawler
              ? "0 0 0 0 transparent"
              : "0 4px 16px rgba(0,0,0,0.6)",
            animation: nextIsBrawler
              ? "counterAppear 0.3s ease-out, brawlerGlow 1s ease-in-out infinite"
              : "counterAppear 0.3s ease-out",
            zIndex: 10,
          }}
        >
          <span style={{
            fontSize: 28, fontWeight: 900, lineHeight: 1,
            color: nextIsBrawler ? "#FFD700" : "white",
            textShadow: nextIsBrawler ? "0 0 14px #FFD700, 0 0 30px #FFD70088" : "0 2px 6px rgba(0,0,0,0.8)",
          }}>
            {remaining}
          </span>
        </div>
      )}

      {/* ── Tap hint ── */}
      {(phase === "dropping" || (phase === "brawler" && revealDone)) && (
        <div style={{
          position: "absolute", bottom: 40,
          left: "50%", transform: "translateX(-50%)",
          fontSize: 11, color: "rgba(255,255,255,0.3)",
          letterSpacing: 2, textTransform: "uppercase",
          animation: "tapHint 2.5s ease-in-out infinite",
          zIndex: 3, whiteSpace: "nowrap",
        }}>
          Нажмите для продолжения
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}
