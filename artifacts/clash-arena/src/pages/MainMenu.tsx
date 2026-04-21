import { useState, useEffect } from "react";
import { getCurrentProfile, logout, claimDailyBonus } from "../utils/localStorageAPI";

interface MainMenuProps {
  onPlay: () => void;
  onCollection: () => void;
  onShop: () => void;
  onSettings: () => void;
  onLogout: () => void;
}

export default function MainMenu({ onPlay, onCollection, onShop, onSettings, onLogout }: MainMenuProps) {
  const [profile, setProfile] = useState(getCurrentProfile());
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [dailyMsg, setDailyMsg] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setProfile(getCurrentProfile()), 500);
    return () => clearInterval(interval);
  }, []);

  const handleDailyBonus = () => {
    const result = claimDailyBonus();
    if (result.success) {
      setDailyClaimed(true);
      setDailyMsg(`+${result.coins} монет!`);
      setProfile(getCurrentProfile());
    } else {
      setDailyMsg("Возвращайтесь завтра!");
    }
    setTimeout(() => setDailyMsg(""), 3000);
  };

  const canClaimDaily = profile && (Date.now() - profile.lastDailyBonus) >= 24 * 60 * 60 * 1000;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #050020 0%, #0a0040 40%, #060025 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes floatChar {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 30 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: Math.random() * 3 + 1,
              height: Math.random() * 3 + 1,
              borderRadius: "50%",
              background: ["#CE93D8", "#40C4FF", "#FFD700"][i % 3],
              animation: `sparkle ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {profile && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "12px 20px",
            display: "flex",
            gap: 20,
            alignItems: "center",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 600 }}>
            {profile.username}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 14 }}>
            <span style={{ color: "#FFD700" }}>🪙 {profile.coins}</span>
            <span style={{ color: "#40C4FF" }}>💎 {profile.gems}</span>
            <span style={{ color: "#CE93D8" }}>✨ {profile.powerPoints}</span>
          </div>
          <button
            onClick={onLogout}
            style={{
              background: "rgba(255,82,82,0.2)",
              border: "1px solid rgba(255,82,82,0.3)",
              borderRadius: 8,
              padding: "4px 10px",
              color: "#FF5252",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
Сменить профиль
          </button>
        </div>
      )}

      <div style={{ textAlign: "center", marginBottom: 50, zIndex: 1 }}>
        <div
          style={{
            fontSize: 80,
            fontWeight: 900,
            background: "linear-gradient(135deg, #CE93D8 0%, #FFD700 50%, #40C4FF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundSize: "200% auto",
            animation: "shimmer 4s linear infinite",
            letterSpacing: 4,
            lineHeight: 1,
            filter: "drop-shadow(0 0 30px rgba(206,147,216,0.5))",
          }}
        >
          CLASH
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: "#CE93D8",
            letterSpacing: 16,
            marginTop: -5,
            textShadow: "0 0 20px rgba(206,147,216,0.5)",
          }}
        >
          ARENA
        </div>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 8 }}>
10 бойцов • 5 режимов • Аниме стиль
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 320, zIndex: 1 }}>
        <MenuButton
          label="ИГРАТЬ"
          gradient="linear-gradient(135deg, #7B2FBE, #CE93D8)"
          glowColor="rgba(123,47,190,0.6)"
          onClick={onPlay}
          primary
        />
        <MenuButton
          label="КОЛЛЕКЦИЯ"
          gradient="linear-gradient(135deg, #1565C0, #40C4FF)"
          glowColor="rgba(21,101,192,0.4)"
          onClick={onCollection}
        />
        <MenuButton
          label="МАГАЗИН"
          gradient="linear-gradient(135deg, #F9A825, #FFD700)"
          glowColor="rgba(249,168,37,0.4)"
          onClick={onShop}
        />
        <MenuButton
          label="НАСТРОЙКИ"
          gradient="linear-gradient(135deg, #2E7D32, #69F0AE)"
          glowColor="rgba(46,125,50,0.4)"
          onClick={onSettings}
        />
      </div>

      {canClaimDaily && (
        <button
          onClick={handleDailyBonus}
          style={{
            marginTop: 30,
            background: "rgba(255,215,0,0.1)",
            border: "2px solid rgba(255,215,0,0.5)",
            borderRadius: 12,
            padding: "10px 30px",
            color: "#FFD700",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            animation: "pulse 2s ease-in-out infinite",
            zIndex: 1,
          }}
        >
Ежедневный бонус доступен!
        </button>
      )}

      {dailyMsg && (
        <div
          style={{
            marginTop: 10,
            color: "#FFD700",
            fontWeight: 700,
            fontSize: 16,
            textShadow: "0 0 10px #FFD700",
            zIndex: 1,
          }}
        >
          {dailyMsg}
        </div>
      )}

      {profile && (
        <div style={{ marginTop: 20, color: "rgba(255,255,255,0.3)", fontSize: 12, zIndex: 1 }}>
Игр: {profile.totalGamesPlayed} | Побед: {profile.totalWins}
        </div>
      )}
    </div>
  );
}

function MenuButton({
  label, gradient, glowColor, onClick, primary = false
}: {
  label: string; gradient: string; glowColor: string; onClick: () => void; primary?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      style={{
        border: primary ? "none" : `1px solid rgba(255,255,255,0.1)`,
        borderRadius: 14,
        padding: primary ? "18px 0" : "14px 0",
        color: "white",
        fontWeight: 800,
        fontSize: primary ? 20 : 16,
        cursor: "pointer",
        letterSpacing: 2,
        boxShadow: hovered ? `0 8px 30px ${glowColor}` : `0 4px 15px rgba(0,0,0,0.3)`,
        transform: hovered ? "translateY(-3px)" : "none",
        transition: "all 0.2s",
        background: hovered && !primary ? `rgba(255,255,255,0.1)` : primary ? gradient : "rgba(255,255,255,0.05)",
      }}
    >
      {label}
    </button>
  );
}
