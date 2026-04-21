import { useState, useEffect } from "react";
import { getCurrentProfile, MAX_TROPHIES, clashPassXpForLevel, MAX_CLASHPASS_LEVEL, canClaimDailyLadder, getOrRollDailyQuests } from "../utils/localStorageAPI";
import { BRAWLERS } from "../entities/BrawlerData";
import { getModeInfo } from "../data/modes";
import DailyRewardModal from "../components/DailyRewardModal";
import QuestsModal from "../components/QuestsModal";

interface MainMenuProps {
  onPlay: () => void;
  onCollection: () => void;
  onShop: () => void;
  onSettings: () => void;
  onProfile: () => void;
  onClashPass: () => void;
  onTrophyRoad: () => void;
  onChests: () => void;
  onModeSelect: () => void;
  onBrawlerSelect: () => void;
  onLogout: () => void;
}

export default function MainMenu(props: MainMenuProps) {
  const {
    onPlay, onCollection, onShop, onSettings,
    onProfile, onClashPass, onTrophyRoad, onChests,
    onModeSelect, onBrawlerSelect, onLogout,
  } = props;

  const [profile, setProfile] = useState(getCurrentProfile());
  const [notif, setNotif] = useState<string | null>(null);
  const [showDaily, setShowDaily] = useState(false);
  const [showQuests, setShowQuests] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setProfile(getCurrentProfile()), 500);
    return () => clearInterval(interval);
  }, []);

  // Ensure today's quests are rolled the first time the lobby opens each day.
  useEffect(() => { getOrRollDailyQuests(); }, []);

  if (!profile) return null;

  const mode = getModeInfo(profile.selectedMode);
  const brawler = BRAWLERS.find(b => b.id === profile.selectedBrawlerId) || BRAWLERS[0];
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const passLevel = profile.clashPassLevel;
  const passNeed = clashPassXpForLevel(passLevel);
  const passPct = passLevel >= MAX_CLASHPASS_LEVEL
    ? 100
    : Math.min(100, Math.round((profile.xp / passNeed) * 100));
  const canClaimDaily = canClaimDailyLadder(profile);
  const hasUnclaimedQuest = !!profile.dailyQuests?.quests.some(
    q => !q.claimed && q.progress >= q.target,
  );

  const handleSoonNotice = (text: string) => {
    setNotif(text);
    setTimeout(() => setNotif(null), 1800);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at center, #160048 0%, #060025 70%, #03001a 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <style>{`
        @keyframes pulse { 0%,100% { transform: scale(1);} 50% { transform: scale(1.04);} }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes floatY { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-12px);} }
        @keyframes sparkle {
          0%,100% { opacity: 0.25; transform: scale(0.8);} 50% { opacity:1; transform:scale(1.2);}
        }
        @keyframes glow {
          0%,100% { box-shadow: 0 0 30px rgba(206,147,216,0.3);}
          50% { box-shadow: 0 0 60px rgba(206,147,216,0.6);}
        }
      `}</style>

      {/* Star particles */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {Array.from({ length: 50 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            width: Math.random() * 3 + 1, height: Math.random() * 3 + 1,
            borderRadius: "50%",
            background: ["#CE93D8", "#40C4FF", "#FFD700"][i % 3],
            animation: `sparkle ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }} />
        ))}
      </div>

      {/* TOP-LEFT: profile pill + trophies */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 5, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={onProfile}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 14, padding: "6px 14px 6px 6px",
            cursor: "pointer", color: "white",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `radial-gradient(circle at 50% 30%, ${brawler.color}88, transparent 70%)`,
            border: `1.5px solid ${brawler.color}`,
            overflow: "hidden",
          }}>
            <img src={`${base}brawlers/${profile.favoriteBrawlerId}_front.png`} alt="" style={{ width: "100%" }} />
          </div>
          <div style={{ textAlign: "left", lineHeight: 1.1 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{profile.username}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
              Игр: {profile.totalGamesPlayed} • Побед: {profile.totalWins}
            </div>
          </div>
        </button>
        <button
          onClick={onTrophyRoad}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,171,64,0.18))",
            border: "1.5px solid rgba(255,215,0,0.5)",
            borderRadius: 12, padding: "8px 14px",
            color: "#FFD700", fontWeight: 800, fontSize: 17, cursor: "pointer",
            boxShadow: "0 0 20px rgba(255,215,0,0.25)",
          }}
        >
          🏆 {profile.trophies}
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600, marginLeft: 4 }}>
            / {MAX_TROPHIES}
          </span>
        </button>
      </div>

      {/* TOP-RIGHT: resources */}
      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 5 }}>
        <div style={{
          display: "flex", gap: 6,
          background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: "6px 10px", backdropFilter: "blur(10px)",
        }}>
          <Resource icon="🪙" value={profile.coins} color="#FFD700" />
          <Resource icon="💎" value={profile.gems} color="#40C4FF" />
          <Resource icon="✨" value={profile.powerPoints} color="#CE93D8" />
        </div>
      </div>

      {/* CENTER: brawler showcase + name (anchored higher) */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none", paddingTop: 80,
      }}>
        <div style={{
          fontSize: 52, fontWeight: 900,
          background: "linear-gradient(135deg, #CE93D8 0%, #FFD700 50%, #40C4FF 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundSize: "200% auto", animation: "shimmer 4s linear infinite",
          letterSpacing: 6, marginBottom: 4,
          filter: "drop-shadow(0 0 30px rgba(206,147,216,0.5))",
        }}>CLASH</div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: "#CE93D8",
          letterSpacing: 14, marginTop: -6,
          textShadow: "0 0 20px rgba(206,147,216,0.5)",
          marginBottom: 0,
        }}>ARENA</div>

        <div
          onClick={onBrawlerSelect}
          style={{
            pointerEvents: "auto", cursor: "pointer",
            position: "relative", marginTop: 0,
            width: 300, height: 320,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "floatY 3.5s ease-in-out infinite",
          }}
        >
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(circle at 50% 60%, ${brawler.color}55 0%, transparent 65%)`,
          }} />
          <img
            src={`${base}brawlers/${brawler.id}_front.png`}
            alt={brawler.name}
            style={{
              width: "85%",
              filter: `drop-shadow(0 12px 35px ${brawler.color})`,
              position: "relative",
            }}
          />
          <div style={{
            position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.55)", border: `1px solid ${brawler.color}`,
            borderRadius: 12, padding: "6px 18px",
            fontSize: 18, fontWeight: 800, color: brawler.color,
            letterSpacing: 2, whiteSpace: "nowrap",
          }}>
            {brawler.name.toUpperCase()}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE BUTTONS */}
      <div style={{
        position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)",
        display: "flex", flexDirection: "column", gap: 12, zIndex: 4,
      }}>
        <SideButton icon="🛒" label="Магазин" onClick={onShop} color="#FFD700" />
        <SideButton icon="🎒" label="Коллекция" onClick={onCollection} color="#40C4FF" />
        <SideButton icon="⚙️" label="Настройки" onClick={onSettings} color="#69F0AE" />
        <SideButton icon="👥" label="Друзья" onClick={() => handleSoonNotice("Друзья — скоро")} color="#CE93D8" />
        <SideButton icon="🔔" label="Уведомления" onClick={() => handleSoonNotice("Новых уведомлений нет")} color="#FFAB40" />
        <SideButton icon="🚪" label="Выйти" onClick={onLogout} color="#FF5252" />
      </div>

      {/* LEFT SIDE — character pick shortcut */}
      <div style={{
        position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)",
        display: "flex", flexDirection: "column", gap: 12, zIndex: 4,
      }}>
        <SideButton icon="🦸" label="Персонаж" onClick={onBrawlerSelect} color="#CE93D8" />
        <SideButton
          icon="🎁"
          label={canClaimDaily ? "Бонус дня" : "Бонус дня"}
          onClick={() => setShowDaily(true)}
          color={canClaimDaily ? "#FFD700" : "#888"}
          pulse={canClaimDaily}
        />
        <SideButton icon="🗝️" label="Сундуки" onClick={onChests} color="#FF7043" />
      </div>

      {/* BOTTOM-LEFT: Quests button + Clash Pass card */}
      <button
        onClick={() => setShowQuests(true)}
        style={{
          position: "absolute", bottom: 16, left: 266, zIndex: 5,
          background: hasUnclaimedQuest
            ? "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,138,0,0.3))"
            : "linear-gradient(135deg, rgba(74,20,140,0.5), rgba(206,147,216,0.3))",
          border: `1.5px solid ${hasUnclaimedQuest ? "#FFD700" : "rgba(206,147,216,0.5)"}`,
          borderRadius: 14, padding: "10px 14px",
          color: "white", cursor: "pointer",
          backdropFilter: "blur(10px)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          minWidth: 84,
          animation: hasUnclaimedQuest ? "pulse 1.6s ease-in-out infinite" : undefined,
          boxShadow: hasUnclaimedQuest ? "0 0 20px rgba(255,215,0,0.55)" : undefined,
        }}
        title="Ежедневные квесты"
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>📋</span>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: hasUnclaimedQuest ? "#FFD700" : "#CE93D8" }}>
          КВЕСТЫ
        </span>
      </button>

      <button
        onClick={onClashPass}
        style={{
          position: "absolute", bottom: 16, left: 16, zIndex: 5,
          background: "linear-gradient(135deg, rgba(74,20,140,0.6), rgba(206,147,216,0.4))",
          border: "1.5px solid rgba(206,147,216,0.6)",
          borderRadius: 16, padding: 14,
          width: 240, cursor: "pointer", color: "white",
          textAlign: "left", backdropFilter: "blur(10px)",
          animation: "glow 3s ease-in-out infinite",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontWeight: 900, letterSpacing: 1, fontSize: 14, color: "#FFD700" }}>
            🎟️ CLASH PASS
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#CE93D8" }}>УР. {passLevel}</div>
        </div>
        <div style={{
          marginTop: 8, height: 8, borderRadius: 4,
          background: "rgba(0,0,0,0.4)", overflow: "hidden",
        }}>
          <div style={{
            height: "100%", width: `${passPct}%`,
            background: "linear-gradient(90deg, #FFD700, #CE93D8)",
            transition: "width 0.4s",
          }} />
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
          {passLevel >= MAX_CLASHPASS_LEVEL
            ? "Максимум достигнут!"
            : `${profile.xp} / ${passNeed} опыта`}
        </div>
      </button>

      {/* BOTTOM-CENTER: mode selector + PLAY */}
      <div style={{
        position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 5, display: "flex", flexDirection: "column", gap: 10, alignItems: "center",
      }}>
        <button
          onClick={onModeSelect}
          style={{
            background: `linear-gradient(135deg, ${mode.color}33, rgba(0,0,0,0.4))`,
            border: `1.5px solid ${mode.color}`,
            borderRadius: 14, padding: "10px 22px",
            color: "white", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
            backdropFilter: "blur(10px)",
            minWidth: 320,
          }}
        >
          <span style={{ fontSize: 28 }}>{mode.icon}</span>
          <span style={{ flex: 1, textAlign: "left" }}>
            <span style={{ display: "block", color: "rgba(255,255,255,0.5)", fontSize: 10, letterSpacing: 1 }}>РЕЖИМ</span>
            <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: mode.color }}>{mode.name}</span>
          </span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>► СМЕНИТЬ</span>
        </button>
        <button
          onClick={onPlay}
          style={{
            background: "linear-gradient(135deg, #7B2FBE, #CE93D8)",
            border: "none", borderRadius: 16,
            padding: "16px 90px",
            color: "white", fontWeight: 900, fontSize: 24, letterSpacing: 4,
            cursor: "pointer",
            boxShadow: "0 8px 35px rgba(123,47,190,0.6)",
          }}
        >
          ИГРАТЬ
        </button>
      </div>

      {showDaily && <DailyRewardModal onClose={() => { setShowDaily(false); setProfile(getCurrentProfile()); }} />}
      {showQuests && <QuestsModal onClose={() => { setShowQuests(false); setProfile(getCurrentProfile()); }} />}

      {notif && (
        <div style={{
          position: "absolute", top: 90, right: 20, zIndex: 6,
          background: "rgba(0,0,0,0.85)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 10, padding: "10px 16px",
          color: "white", fontSize: 13, fontWeight: 600,
          backdropFilter: "blur(10px)",
        }}>
          {notif}
        </div>
      )}
    </div>
  );
}

function Resource({ icon, value, color }: { icon: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 6px", fontSize: 14 }}>
      <span>{icon}</span>
      <span style={{ color, fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function SideButton({
  icon, label, onClick, color, pulse,
}: { icon: string; label: string; onClick: () => void; color: string; pulse?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        background: hovered ? `${color}26` : "rgba(0,0,0,0.4)",
        border: `1.5px solid ${hovered ? color : "rgba(255,255,255,0.1)"}`,
        borderRadius: 14, padding: "10px 14px",
        color: "white", cursor: "pointer", minWidth: 130,
        backdropFilter: "blur(10px)",
        transition: "all 0.2s",
        transform: hovered ? "translateX(0)" : "translateX(0)",
        boxShadow: hovered ? `0 0 18px ${color}66` : "none",
        animation: pulse ? "pulse 1.6s ease-in-out infinite" : undefined,
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{label}</span>
    </button>
  );
}
