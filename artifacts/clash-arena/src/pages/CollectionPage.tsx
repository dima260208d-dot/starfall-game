import { useState, useEffect } from "react";
import { BRAWLERS, getScaledStats } from "../entities/BrawlerData";
import { getCurrentProfile, upgradeBrawler } from "../utils/localStorageAPI";
import BrawlerViewer3D from "../components/BrawlerViewer3D";

interface CollectionPageProps {
  onBack: () => void;
}

export default function CollectionPage({ onBack }: CollectionPageProps) {
  const [profile, setProfile] = useState(getCurrentProfile());
  const [selected, setSelected] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {}, []);

  const handleUpgrade = () => {
    const brawler = BRAWLERS[selected];
    const result = upgradeBrawler(brawler.id);
    if (result.success) {
      setProfile(getCurrentProfile());
      setMsg("Уровень повышен!");
    } else {
      setMsg(result.error || "Невозможно улучшить");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const brawler = BRAWLERS[selected];
  const level = profile?.brawlerLevels[brawler.id] || 1;
  const scaled = getScaledStats(brawler, level);
  const nextScaled = level < 10 ? getScaledStats(brawler, level + 1) : null;
  const upgradeCost = { coins: 100 * level, pp: 5 * level };
  const canUpgrade = level < 10 && (profile?.coins || 0) >= upgradeCost.coins && (profile?.powerPoints || 0) >= upgradeCost.pp;

  return (
    <div
      style={{
        height: "100vh",
        background: "linear-gradient(135deg, #050020 0%, #0a0040 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        color: "white",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={onBack}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "7px 16px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          ← Назад
        </button>
        <h2 style={{ flex: 1, textAlign: "center", margin: 0, fontSize: 22, fontWeight: 800, color: "#CE93D8" }}>
Коллекция
        </h2>
        <div style={{ display: "flex", gap: 14, fontSize: 14 }}>
          <span style={{ color: "#FFD700" }}>🪙 {profile?.coins || 0}</span>
          <span style={{ color: "#CE93D8" }}>✨ {profile?.powerPoints || 0}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <div style={{ width: 260, overflowY: "auto", padding: 16, borderRight: "1px solid rgba(255,255,255,0.06)", minHeight: 0 }}>
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
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  cursor: "pointer",
                  marginBottom: 6,
                  background: isSelected ? `${b.color}20` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isSelected ? b.color + "60" : "rgba(255,255,255,0.05)"}`,
                  transition: "all 0.2s",
                }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}brawlers/${b.id}_front.png`}
                  alt={b.name}
                  width={48}
                  height={48}
                  style={{
                    borderRadius: 8,
                    background: `radial-gradient(circle at 50% 60%, ${b.color}40, ${b.color}10 70%, transparent)`,
                    objectFit: "contain",
                    objectPosition: "center bottom",
                    flexShrink: 0,
                    filter: `drop-shadow(0 2px 4px ${b.color}80)`,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? b.color : "white" }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>УР {lv} {b.role}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 30px", overflowY: "auto", minHeight: 0 }}>
          <BrawlerViewer3D brawlerId={brawler.id} color={brawler.color} size={380} autoRotateInitial={true} />

          <div style={{ textAlign: "center", marginTop: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: brawler.color }}>{brawler.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: 2 }}>{brawler.role.toUpperCase()} • УРОВЕНЬ {level} / 10</div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 16,
              padding: 20,
              width: "100%",
              maxWidth: 400,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "ЗДОРОВЬЕ", base: brawler.hp, current: scaled.hp, color: "#4CAF50" },
                { label: "УРОН", base: brawler.attackDamage, current: scaled.attackDamage, color: "#FF5252" },
                { label: "СКОРОСТЬ", base: brawler.speed, current: scaled.speed, color: "#40C4FF" },
                { label: "РЕГЕН", base: brawler.regenRate, current: brawler.regenRate, color: "#CE93D8" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 1 }}>{stat.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.current}</div>
                  {nextScaled && stat.label === "ЗДОРОВЬЕ" && <div style={{ fontSize: 10, color: "#4CAF50" }}>→ {nextScaled.hp}</div>}
                  {nextScaled && stat.label === "УРОН" && <div style={{ fontSize: 10, color: "#FF5252" }}>→ {nextScaled.attackDamage}</div>}
                </div>
              ))}
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 11, color: "#40C4FF", fontWeight: 700, marginBottom: 3 }}>АТАКА: {brawler.attackName}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{brawler.attackDesc}</div>
              <div style={{ fontSize: 11, color: "#FFD700", fontWeight: 700, marginBottom: 3, marginTop: 8 }}>СУПЕР: {brawler.superName}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{brawler.superDesc}</div>
            </div>

            {level < 10 ? (
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8, textAlign: "center" }}>
Улучшить до уровня {level + 1}: {upgradeCost.coins} монет + {upgradeCost.pp} очков
                </div>
                <button
                  onClick={handleUpgrade}
                  disabled={!canUpgrade}
                  style={{
                    width: "100%",
                    background: canUpgrade ? "linear-gradient(135deg, #F9A825, #FFD700)" : "rgba(255,255,255,0.1)",
                    border: "none",
                    borderRadius: 12,
                    padding: "12px 0",
                    color: canUpgrade ? "#000" : "rgba(255,255,255,0.3)",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: canUpgrade ? "pointer" : "not-allowed",
                    letterSpacing: 1,
                  }}
                >
{canUpgrade ? "УЛУЧШИТЬ" : `Нужно ${upgradeCost.coins} монет + ${upgradeCost.pp} очков`}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#FFD700", fontWeight: 700, fontSize: 14 }}>МАКСИМАЛЬНЫЙ УРОВЕНЬ!</div>
            )}

            {msg && (
              <div style={{ textAlign: "center", marginTop: 10, color: msg === "Уровень повышен!" ? "#4CAF50" : "#FF5252", fontWeight: 700 }}>
                {msg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
