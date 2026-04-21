import { useState } from "react";
import {
  getCurrentProfile,
  clashPassXpForLevel,
  clashPassRewardForLevel,
  claimClashPassReward,
  buyXp,
  MAX_CLASHPASS_LEVEL,
} from "../utils/localStorageAPI";
import QuestsModal from "../components/QuestsModal";
import ChestVisual from "../components/ChestVisual";

interface Props {
  onBack: () => void;
}

const XP_BUNDLES = [
  { xp: 200, gems: 10 },
  { xp: 600, gems: 25 },
  { xp: 1500, gems: 50 },
];

export default function ClashPassPage({ onBack }: Props) {
  const [profile, setProfile] = useState(getCurrentProfile());
  const [msg, setMsg] = useState<string | null>(null);
  const [showQuests, setShowQuests] = useState(false);
  const refresh = () => setProfile(getCurrentProfile());
  if (!profile) return null;

  const levelXpNeed = clashPassXpForLevel(profile.clashPassLevel);
  const xpProgress = profile.clashPassLevel >= MAX_CLASHPASS_LEVEL
    ? 100
    : Math.min(100, Math.round((profile.xp / levelXpNeed) * 100));

  const handleClaim = (lvl: number) => {
    const r = claimClashPassReward(lvl);
    setMsg(r.success ? `Получено: ${r.reward?.label}` : (r.error || "Ошибка"));
    refresh();
    setTimeout(() => setMsg(null), 2200);
  };

  const handleBuy = (xp: number, gems: number) => {
    const r = buyXp(xp, gems);
    setMsg(r.success ? `+${xp} опыта` : (r.error || "Ошибка"));
    refresh();
    setTimeout(() => setMsg(null), 2200);
  };

  return (
    <div style={{ minHeight: "100vh", background: "transparent", padding: "30px 20px", color: "white", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <button onClick={onBack} style={backBtn}>← Назад</button>
      <button
        onClick={() => setShowQuests(true)}
        style={{
          position: "absolute", top: 20, right: 20,
          background: "linear-gradient(135deg, #FFD700, #FF8A00)",
          border: "none", borderRadius: 12, padding: "9px 18px",
          color: "#1a0a3a", cursor: "pointer", fontSize: 14, fontWeight: 900,
          letterSpacing: 1.5, boxShadow: "0 4px 18px rgba(255,215,0,0.4)",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        📋 КВЕСТЫ
      </button>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{
          fontSize: 36, fontWeight: 900, margin: 0, textAlign: "center",
          background: "linear-gradient(135deg, #FFD700, #CE93D8)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Clash Pass
        </h1>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
          Получайте награды за каждый уровень. Опыт за победы или покупка за кристаллы.
        </p>

        {/* Progress card */}
        <div style={{ ...card, marginTop: 20, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#FFD700" }}>Уровень {profile.clashPassLevel}</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 }}>
                {profile.clashPassLevel >= MAX_CLASHPASS_LEVEL
                  ? "Максимальный уровень!"
                  : `${profile.xp} / ${levelXpNeed} опыта до следующего уровня`}
              </div>
            </div>
            <div style={{ color: "#40C4FF", fontSize: 16 }}>💎 {profile.gems}</div>
          </div>
          <div style={{
            marginTop: 14, height: 14, borderRadius: 7,
            background: "rgba(0,0,0,0.4)", overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{
              height: "100%", width: `${xpProgress}%`,
              background: "linear-gradient(90deg, #FFD700, #CE93D8)",
              transition: "width 0.4s",
            }} />
          </div>

          {/* XP shop */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8, letterSpacing: 1 }}>
              КУПИТЬ ОПЫТ ЗА КРИСТАЛЛЫ
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {XP_BUNDLES.map(b => (
                <button
                  key={b.xp}
                  onClick={() => handleBuy(b.xp, b.gems)}
                  disabled={profile.gems < b.gems}
                  style={{
                    flex: 1, minWidth: 140,
                    background: profile.gems >= b.gems ? "linear-gradient(135deg, #4A148C, #CE93D8)" : "rgba(255,255,255,0.04)",
                    border: "none", borderRadius: 12, padding: "12px 14px",
                    color: "white", cursor: profile.gems >= b.gems ? "pointer" : "not-allowed",
                    fontWeight: 700, opacity: profile.gems >= b.gems ? 1 : 0.4,
                  }}
                >
                  +{b.xp} ⭐ <span style={{ opacity: 0.8 }}>за</span> 💎 {b.gems}
                </button>
              ))}
            </div>
          </div>

          {msg && (
            <div style={{ marginTop: 12, color: "#FFD700", fontWeight: 700, textAlign: "center" }}>{msg}</div>
          )}
        </div>

        {/* Levels grid */}
        <div style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 10,
        }}>
          {Array.from({ length: MAX_CLASHPASS_LEVEL }, (_, i) => i + 1).map(lvl => {
            const reward = clashPassRewardForLevel(lvl);
            const reached = profile.clashPassLevel >= lvl;
            const claimed = profile.clashPassClaimed.includes(lvl);
            const tierIcon = reward.type === "gems" ? "💎" : reward.type === "powerPoints" ? "✨" : reward.type === "chest" ? "🗝️" : "🪙";
            const tierColor = reward.type === "gems" ? "#40C4FF" : reward.type === "powerPoints" ? "#CE93D8" : reward.type === "chest" ? "#FF7043" : "#FFD700";
            return (
              <div key={lvl} style={{
                background: reached ? `${tierColor}18` : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${reached ? tierColor + (reward.type === "chest" ? "AA" : "55") : "rgba(255,255,255,0.08)"}`,
                borderRadius: 14, padding: 12, textAlign: "center",
                opacity: reached ? 1 : 0.55,
                boxShadow: reward.type === "chest" && reached ? `0 0 20px ${tierColor}55` : undefined,
              }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>УР. {lvl}</div>
                {reward.type === "chest" && reward.chestRarity ? (
                  <div style={{ height: 64, marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ChestVisual rarity={reward.chestRarity} size={56} animated={reached} />
                  </div>
                ) : (
                  <div style={{ fontSize: 32, marginTop: 4 }}>{tierIcon}</div>
                )}
                <div style={{ fontSize: 13, color: tierColor, fontWeight: 800, lineHeight: 1.2 }}>
                  {reward.type === "chest" ? reward.label : reward.amount}
                </div>
                <button
                  onClick={() => handleClaim(lvl)}
                  disabled={!reached || claimed}
                  style={{
                    marginTop: 8, width: "100%",
                    background: claimed ? "rgba(255,255,255,0.05)" : reached ? "linear-gradient(135deg, #2E7D32, #69F0AE)" : "rgba(255,255,255,0.04)",
                    border: "none", borderRadius: 8, padding: "6px 0",
                    color: claimed ? "rgba(255,255,255,0.4)" : "white",
                    fontSize: 11, fontWeight: 700,
                    cursor: reached && !claimed ? "pointer" : "default",
                  }}
                >
                  {claimed ? "✓" : reached ? "ЗАБРАТЬ" : "🔒"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {showQuests && <QuestsModal onClose={() => { setShowQuests(false); refresh(); }} />}
    </div>
  );
}

const backBtn: React.CSSProperties = {
  position: "absolute", top: 20, left: 20,
  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10, padding: "8px 18px", color: "rgba(255,255,255,0.7)",
  cursor: "pointer", fontSize: 14, fontWeight: 600,
};
const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 18,
};
