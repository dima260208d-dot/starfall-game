import { useState, useEffect } from "react";
import { BRAWLERS, getScaledStats } from "../entities/BrawlerData";
import { getCurrentProfile } from "../utils/localStorageAPI";
import type { GameMode } from "../App";
import BrawlerViewer3D from "../components/BrawlerViewer3D";

interface CharacterSelectProps {
  mode: GameMode;
  onStart: (brawlerId: string) => void;
  onBack: () => void;
}

const MODE_LABELS: Record<GameMode, string> = {
  showdown: "Шоудаун",
  crystals: "Захват кристаллов",
  siege: "Осада",
  heist: "Ограбление",
  gemgrab: "Выноси кристаллы",
};

export default function CharacterSelect({ mode, onStart, onBack }: CharacterSelectProps) {
  const [selected, setSelected] = useState(0);
  const [profile, setProfile] = useState(getCurrentProfile());

  useEffect(() => {
    const interval = setInterval(() => setProfile(getCurrentProfile()), 1000);
    return () => clearInterval(interval);
  }, []);

  const brawler = BRAWLERS[selected];
  const level = profile?.brawlerLevels[brawler.id] || 1;
  const scaled = getScaledStats(brawler, level);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #050020 0%, #0a0040 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        color: "white",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 10px currentColor; } 50% { box-shadow: 0 0 25px currentColor; } }
        ::-webkit-scrollbar { height: 4px; background: rgba(255,255,255,0.05); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={onBack}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "7px 16px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          ← Назад
        </button>
        <h2
          style={{
            flex: 1,
            textAlign: "center",
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            background: "linear-gradient(135deg, #CE93D8, #FFD700)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Выберите бойца — {MODE_LABELS[mode]}
        </h2>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 30,
          }}
        >
          <BrawlerViewer3D brawlerId={brawler.id} color={brawler.color} size={340} />

          <div style={{ textAlign: "center", marginTop: 10 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: brawler.color, textShadow: `0 0 20px ${brawler.color}` }}>
              {brawler.name}
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", letterSpacing: 2, fontWeight: 600 }}>
              {brawler.role.toUpperCase()} • УР {level}
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 16,
              padding: "16px 24px",
              width: "100%",
              maxWidth: 340,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px 20px",
            }}
          >
            <Stat label="ЗДОР" value={`${scaled.hp}`} max={6200} current={scaled.hp} color="#4CAF50" />
            <Stat label="СКОР" value={`${brawler.speed.toFixed(1)}`} max={5.5} current={brawler.speed} color="#40C4FF" />
            <Stat label="УРОН" value={`${scaled.attackDamage}`} max={600} current={scaled.attackDamage} color="#FF5252" />
            <Stat label="РЕГЕН" value={`${brawler.regenRate}/с`} max={80} current={brawler.regenRate} color="#CE93D8" />
          </div>

          <div style={{ marginTop: 16, width: "100%", maxWidth: 340 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#40C4FF", fontWeight: 700, letterSpacing: 1 }}>АТАКА: {brawler.attackName}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{brawler.attackDesc}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#FFD700", fontWeight: 700, letterSpacing: 1 }}>СУПЕР: {brawler.superName}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{brawler.superDesc}</div>
            </div>
          </div>

          <button
            onClick={() => onStart(brawler.id)}
            style={{
              marginTop: 24,
              background: `linear-gradient(135deg, ${brawler.color}, ${brawler.secondaryColor})`,
              border: "none",
              borderRadius: 14,
              padding: "16px 60px",
              color: "white",
              fontWeight: 900,
              fontSize: 18,
              cursor: "pointer",
              letterSpacing: 2,
              boxShadow: `0 6px 30px ${brawler.color}50`,
              transition: "transform 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.03)"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = ""; }}
          >
            В БОЙ!
          </button>
        </div>

        <div
          style={{
            width: 420,
            overflowY: "auto",
            padding: "20px 16px",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>
ВЫБОР БОЙЦА
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {BRAWLERS.map((b, i) => {
              const lv = profile?.brawlerLevels[b.id] || 1;
              const isSelected = i === selected;
              return (
                <div
                  key={b.id}
                  onClick={() => setSelected(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 14,
                    cursor: "pointer",
                    background: isSelected ? `${b.color}20` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? b.color + "60" : "rgba(255,255,255,0.06)"}`,
                    transition: "all 0.2s",
                    transform: isSelected ? "translateX(-4px)" : "none",
                  }}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}brawlers/${b.id}_front.png`}
                    alt={b.name}
                    width={56}
                    height={56}
                    style={{
                      borderRadius: 10,
                      background: `radial-gradient(circle at 50% 60%, ${b.color}40, ${b.color}10 70%, transparent)`,
                      flexShrink: 0,
                      objectFit: "contain",
                      objectPosition: "center bottom",
                      filter: `drop-shadow(0 2px 4px ${b.color}80)`,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: isSelected ? b.color : "white" }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{b.role}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                      <MiniBar value={getScaledStats(b, lv).hp / 6200} color="#4CAF50" />
                      <MiniBar value={b.speed / 5.5} color="#40C4FF" />
                    </div>
                  </div>
                  <div
                    style={{
                      background: isSelected ? b.color : "rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "3px 9px",
                      fontSize: 11,
                      fontWeight: 800,
                      color: isSelected ? "white" : "rgba(255,255,255,0.4)",
                      flexShrink: 0,
                    }}
                  >
                    УР{lv}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, max, current, color }: { label: string; value: string; max: number; current: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 1 }}>{label}</span>
        <span style={{ fontSize: 12, color: "white", fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
        <div style={{ height: "100%", borderRadius: 2, background: color, width: `${Math.min(100, (current / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
      <div style={{ height: "100%", borderRadius: 2, background: color, width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}
