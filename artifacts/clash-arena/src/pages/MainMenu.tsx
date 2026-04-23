import { useState, useEffect } from "react";
import {
  getCurrentProfile, MAX_TROPHIES, clashPassXpForLevel, MAX_CLASHPASS_LEVEL,
  canClaimDailyLadder, getOrRollDailyQuests,
  getUnclaimedTrophyRoadCount, getUnclaimedClashPassCount, getUnopenedChestCount,
  getBrawlerTrophies, getBrawlerRank, MAX_BRAWLER_RANK,
} from "../utils/localStorageAPI";
import { BRAWLERS } from "../entities/BrawlerData";
import { getModeInfo, type ModeInfo } from "../data/modes";
import DailyRewardModal from "../components/DailyRewardModal";
import QuestsModal from "../components/QuestsModal";
import BrawlerRankRewardsModal from "../components/BrawlerRankRewardsModal";
import BrawlerViewer3D from "../components/BrawlerViewer3D";

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
  const [showModeInfo, setShowModeInfo] = useState(false);
  const [rankModalBrawlerId, setRankModalBrawlerId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== "undefined" && !!document.fullscreenElement,
  );
  const [vw, setVw] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1280);
  const [vh, setVh] = useState<number>(typeof window !== "undefined" ? window.innerHeight : 720);
  // "Compact" applies the mobile-optimised layout: smaller buttons, tighter
  // spacing, no overlapping panels. Triggered on phones (short side ≤ 500)
  // OR narrow desktop windows (width < 900).
  const compact = vw < 900 || vh < 500;

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    const onResize = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Try to lock landscape on entry — useful on mobile, silently
        // ignored elsewhere.
        await document.documentElement.requestFullscreen();
        const so = (screen as any).orientation;
        if (so && typeof so.lock === "function") {
          so.lock("landscape").catch(() => { /* unsupported on desktop */ });
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Some browsers reject the request when not user-initiated; the
      // button click satisfies that, so failures are usually permission-based.
    }
  };

  useEffect(() => {
    const interval = setInterval(() => setProfile(getCurrentProfile()), 500);
    return () => clearInterval(interval);
  }, []);

  // Ensure today's quests are rolled the first time the lobby opens each day.
  useEffect(() => { getOrRollDailyQuests(); }, []);

  if (!profile) return null;

  const mode = getModeInfo(profile.selectedMode);
  const brawler = BRAWLERS.find(b => b.id === profile.selectedBrawlerId) || BRAWLERS[0];
  const brawlerLevel = profile.brawlerLevels[brawler.id] || 1;
  const brawlerTrophies = getBrawlerTrophies(profile, brawler.id);
  const brawlerRank = getBrawlerRank(brawlerTrophies);
  const favBrawler = BRAWLERS.find(b => b.id === profile.favoriteBrawlerId) || BRAWLERS[0];
  const favTrophies = getBrawlerTrophies(profile, favBrawler.id);
  const favRank = getBrawlerRank(favTrophies);
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
  const trophyRoadBadge = getUnclaimedTrophyRoadCount(profile);
  const clashPassBadge = getUnclaimedClashPassCount(profile);
  const chestsBadge = getUnopenedChestCount(profile);
  const questsBadge = profile.dailyQuests?.quests.filter(q => !q.claimed && q.progress >= q.target).length ?? 0;

  const handleSoonNotice = (text: string) => {
    setNotif(text);
    setTimeout(() => setNotif(null), 1800);
  };

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
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
            position: "relative",
            width: 36, height: 36, borderRadius: 10,
            background: `radial-gradient(circle at 50% 30%, ${favBrawler.color}88, transparent 70%)`,
            border: `1.5px solid ${favBrawler.color}`,
            overflow: "visible",
          }}>
            <div style={{ width: "100%", height: "100%", borderRadius: 9, overflow: "hidden" }}>
              <img src={`${base}brawlers/${profile.favoriteBrawlerId}_front.png`} alt="" style={{ width: "100%" }} />
            </div>
            <div
              onClick={(e) => { e.stopPropagation(); setRankModalBrawlerId(favBrawler.id); }}
              title="Награды за ранги"
              style={{
                position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
                background: "linear-gradient(135deg, #F9A825, #FFD700)",
                color: "#000",
                fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                borderRadius: 6, padding: "1px 5px",
                border: "1px solid rgba(0,0,0,0.4)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                minWidth: 16, textAlign: "center", cursor: "pointer",
              }}
            >{favRank}</div>
          </div>
          <div style={{ textAlign: "left", lineHeight: 1.1 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{profile.username}</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
              🏆 {favTrophies} • Игр: {profile.totalGamesPlayed} • Побед: {profile.totalWins}
            </div>
          </div>
        </button>
        <button
          onClick={onTrophyRoad}
          style={{
            position: "relative",
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
          <NotificationBadge count={trophyRoadBadge} />
        </button>
      </div>

      {/* TOP-RIGHT: fullscreen toggle + resources */}
      <div style={{
        position: "absolute", top: 16, right: 16, zIndex: 5,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Выйти из полного экрана" : "Полный экран"}
          style={{
            width: compact ? 30 : 34, height: compact ? 30 : 34,
            borderRadius: 10,
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(64,196,255,0.55)",
            color: "#40C4FF",
            fontSize: compact ? 14 : 16, fontWeight: 900,
            cursor: "pointer", lineHeight: 1,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(10px)",
            boxShadow: "0 0 10px rgba(64,196,255,0.25)",
          }}
        >{isFullscreen ? "🗗" : "⛶"}</button>
        <div style={{
          display: "flex", gap: compact ? 2 : 6,
          background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12, padding: compact ? "4px 6px" : "6px 10px", backdropFilter: "blur(10px)",
        }}>
          <Resource icon="🪙" value={profile.coins} color="#FFD700" compact={compact} />
          <Resource icon="💎" value={profile.gems} color="#40C4FF" compact={compact} />
          <Resource icon="✨" value={profile.powerPoints} color="#CE93D8" compact={compact} />
        </div>
      </div>

      {/* TOP-CENTER: title on a bright panel so it pops against the radial bg */}
      <div style={{
        position: "absolute", top: compact ? 8 : 14, left: "50%", transform: "translateX(-50%)",
        zIndex: 5, pointerEvents: "none",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-flex", flexDirection: "column", alignItems: "center",
          padding: compact ? "5px 16px 6px" : "10px 32px 12px",
          background: "linear-gradient(135deg, #CE93D8 0%, #FFD700 50%, #40C4FF 100%)",
          backgroundSize: "200% auto", animation: "shimmer 4s linear infinite",
          borderRadius: compact ? 12 : 18,
          boxShadow: "0 0 50px rgba(206,147,216,0.55), 0 6px 22px rgba(0,0,0,0.5)",
          border: "2px solid rgba(255,255,255,0.35)",
        }}>
          <div style={{
            fontSize: compact ? 22 : 44, fontWeight: 900, color: "white",
            letterSpacing: compact ? 4 : 8, lineHeight: 1,
            textShadow: "0 2px 10px rgba(0,0,0,0.55), 0 0 18px rgba(255,255,255,0.4)",
          }}>CLASH</div>
          <div style={{
            fontSize: compact ? 9 : 16, fontWeight: 800, color: "white",
            letterSpacing: compact ? 6 : 12, marginTop: 2,
            textShadow: "0 2px 8px rgba(0,0,0,0.55)",
          }}>ARENA</div>
        </div>
      </div>

      {/* CENTER: brawler showcase */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        pointerEvents: "none", paddingTop: 40,
      }}>
        <div
          onClick={onBrawlerSelect}
          style={{
            pointerEvents: "auto", cursor: "pointer",
            position: "relative",
            width: compact ? 243 : 270,
            height: compact ? 259 : 288,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "floatY 3.5s ease-in-out infinite",
            transform: "translateX(-24px)",
          }}
        >
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(circle at 50% 60%, ${brawler.color}55 0%, transparent 65%)`,
          }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <BrawlerViewer3D brawlerId={brawler.id} color={brawler.color} size={compact ? 243 : 270} />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setRankModalBrawlerId(brawler.id); }}
            style={{
              position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,215,0,0.5)",
              borderRadius: 10, padding: "4px 10px",
              boxShadow: "0 0 12px rgba(255,215,0,0.25)",
              whiteSpace: "nowrap",
              pointerEvents: "auto",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            title="Награды за ранги"
          >
            <RankPill rank={brawlerRank} />
            <PowerPill level={brawlerLevel} />
            <span style={{ color: "#FFD700", fontSize: 12, fontWeight: 800 }}>🏆 {brawlerTrophies}</span>
          </button>
          <div style={{
            position: "absolute", bottom: -32, left: "50%", transform: "translateX(-50%)",
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
        position: "absolute", right: compact ? 8 : 18, top: "50%", transform: "translateY(-50%)",
        display: "flex", flexDirection: "column", gap: compact ? 6 : 12, zIndex: 4,
      }}>
        <SideButton icon="🛒" label="Магазин" onClick={onShop} color="#FFD700" compact={compact} />
        <SideButton icon="🎒" label="Коллекция" onClick={onCollection} color="#40C4FF" compact={compact} />
        <SideButton icon="⚙️" label="Настройки" onClick={onSettings} color="#69F0AE" compact={compact} />
        <SideButton icon="👥" label="Друзья" onClick={() => handleSoonNotice("Друзья — скоро")} color="#CE93D8" compact={compact} />
        <SideButton icon="🔔" label="Сообщения" onClick={() => handleSoonNotice("Новых уведомлений нет")} color="#FFAB40" compact={compact} />
        <SideButton icon="🚪" label="Выйти" onClick={onLogout} color="#FF5252" compact={compact} />
      </div>

      {/* LEFT SIDE — character pick shortcut */}
      <div style={{
        position: "absolute", left: compact ? 8 : 18, top: "50%", transform: "translateY(-50%)",
        display: "flex", flexDirection: "column", gap: compact ? 6 : 12, zIndex: 4,
      }}>
        <SideButton icon="🦸" label="Персонаж" onClick={onBrawlerSelect} color="#CE93D8" compact={compact} />
        <SideButton
          icon="🎁"
          label="Бонус дня"
          onClick={() => setShowDaily(true)}
          color={canClaimDaily ? "#FFD700" : "#888"}
          pulse={canClaimDaily}
          compact={compact}
        />
        <SideButton icon="🗝️" label="Сундуки" onClick={onChests} color="#FF7043" badge={chestsBadge} compact={compact} />
      </div>

      {/* BOTTOM-LEFT: Quests button + Clash Pass card */}
      {compact ? (
        <button
          onClick={() => setShowQuests(true)}
          title="Ежедневные квесты"
          style={{
            position: "absolute", bottom: 8, left: 64, zIndex: 5,
            width: 48, height: 44,
            background: hasUnclaimedQuest
              ? "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,138,0,0.3))"
              : "rgba(0,0,0,0.4)",
            border: `1.5px solid ${hasUnclaimedQuest ? "#FFD700" : "rgba(206,147,216,0.5)"}`,
            borderRadius: 10,
            display: "inline-flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            color: "white", cursor: "pointer",
            backdropFilter: "blur(10px)",
            animation: hasUnclaimedQuest ? "pulse 1.6s ease-in-out infinite" : undefined,
            boxShadow: hasUnclaimedQuest ? "0 0 14px rgba(255,215,0,0.55)" : undefined,
          }}
        >
          <NotificationBadge count={questsBadge} />
          <span style={{ fontSize: 18, lineHeight: 1 }}>📋</span>
          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.4, marginTop: 1, color: hasUnclaimedQuest ? "#FFD700" : "#CE93D8" }}>КВЕСТЫ</span>
        </button>
      ) : (
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
          <NotificationBadge count={questsBadge} />
          <span style={{ fontSize: 22, lineHeight: 1 }}>📋</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: hasUnclaimedQuest ? "#FFD700" : "#CE93D8" }}>
            КВЕСТЫ
          </span>
        </button>
      )}

      {compact ? (
        <button
          onClick={onClashPass}
          title="Clash Pass"
          style={{
            position: "absolute", bottom: 8, left: 8, zIndex: 5,
            width: 48, height: 44,
            background: "linear-gradient(135deg, rgba(74,20,140,0.6), rgba(206,147,216,0.4))",
            border: "1.5px solid rgba(206,147,216,0.6)",
            borderRadius: 10,
            display: "inline-flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            color: "white", cursor: "pointer",
            backdropFilter: "blur(10px)",
          }}
        >
          <NotificationBadge count={clashPassBadge} />
          <span style={{ fontSize: 16, lineHeight: 1 }}>🎟️</span>
          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.4, marginTop: 1, color: "#FFD700" }}>УР.{passLevel}</span>
        </button>
      ) : (
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
          <NotificationBadge count={clashPassBadge} />
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
      )}

      {/* BOTTOM-CENTER: mode selector pinned to the bottom edge */}
      <div
        style={{
          position: "absolute",
          bottom: compact ? 8 : 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 5,
        }}
      >
        <button
          onClick={onModeSelect}
          style={{
            position: "relative",
            background: `linear-gradient(135deg, ${mode.color}33, rgba(0,0,0,0.5))`,
            border: `1.5px solid ${mode.color}`,
            borderRadius: compact ? 10 : 14,
            padding: compact ? "5px 10px" : "10px 22px",
            color: "white", cursor: "pointer",
            display: "flex", alignItems: "center", gap: compact ? 6 : 12,
            backdropFilter: "blur(10px)",
            minWidth: compact ? 0 : 320,
            boxShadow: `0 4px 22px ${mode.color}55`,
            fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: compact ? 16 : 28 }}>{mode.icon}</span>
          <span style={{ flex: 1, textAlign: "left" }}>
            {!compact && (
              <span style={{ display: "block", color: "rgba(255,255,255,0.55)", fontSize: 10, letterSpacing: 1 }}>РЕЖИМ</span>
            )}
            <span style={{ display: "block", fontSize: compact ? 11 : 16, fontWeight: 800, color: mode.color, whiteSpace: "nowrap" }}>{mode.name}</span>
          </span>
          {!compact && (
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>► СМЕНИТЬ</span>
          )}
          <span
            role="button"
            title="О режиме"
            onClick={(e) => { e.stopPropagation(); setShowModeInfo(true); }}
            style={{
              position: "absolute",
              top: compact ? -6 : -8,
              right: compact ? -6 : -8,
              width: compact ? 18 : 26,
              height: compact ? 18 : 26,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.85)",
              border: `1.5px solid ${mode.color}`,
              color: mode.color,
              fontSize: compact ? 10 : 14,
              fontWeight: 900, fontStyle: "italic",
              fontFamily: "Georgia, serif",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              boxShadow: `0 0 10px ${mode.color}88`,
              lineHeight: 1,
            }}
          >i</span>
        </button>
      </div>

      {/* BOTTOM-RIGHT: massive PLAY button anchored in the corner */}
      <button
        onClick={onPlay}
        style={{
          position: "absolute",
          bottom: compact ? 8 : 24,
          right: compact ? 8 : 24,
          zIndex: 6,
          background: "linear-gradient(135deg, #7B2FBE, #CE93D8)",
          border: "none",
          borderRadius: compact ? 14 : 22,
          padding: compact ? "8px 20px" : "22px 56px",
          color: "white", fontWeight: 900,
          fontSize: compact ? 14 : 28,
          letterSpacing: compact ? 2 : 5,
          cursor: "pointer",
          boxShadow: "0 10px 40px rgba(123,47,190,0.75), 0 0 30px rgba(206,147,216,0.5)",
          animation: "pulse 2.4s ease-in-out infinite",
        }}
      >
        ▶ ИГРАТЬ
      </button>

      {showDaily && <DailyRewardModal onClose={() => { setShowDaily(false); setProfile(getCurrentProfile()); }} />}
      {showQuests && <QuestsModal onClose={() => { setShowQuests(false); setProfile(getCurrentProfile()); }} />}
      {showModeInfo && (
        <ModeInfoModal mode={mode} onClose={() => setShowModeInfo(false)} />
      )}
      {rankModalBrawlerId && (
        <BrawlerRankRewardsModal
          brawlerId={rankModalBrawlerId}
          onClose={() => { setRankModalBrawlerId(null); setProfile(getCurrentProfile()); }}
        />
      )}

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

function ModeInfoModal({ mode, onClose }: { mode: ModeInfo; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, #160048 0%, #060025 100%)",
          border: `2px solid ${mode.color}`,
          borderRadius: 18, padding: 24,
          maxWidth: 460, width: "100%",
          boxShadow: `0 0 50px ${mode.color}66, 0 10px 40px rgba(0,0,0,0.7)`,
          color: "white",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 10, right: 12,
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.6)", fontSize: 22,
            cursor: "pointer", lineHeight: 1,
          }}
        >×</button>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 14,
              background: mode.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32,
              boxShadow: `0 4px 14px ${mode.color}88`,
            }}
          >{mode.icon}</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: mode.color, letterSpacing: 1 }}>
              {mode.name}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>
              {mode.subtitle.toUpperCase()}
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 10,
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 22 }}>🗺️</span>
          <div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>КАРТА</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#FFD700" }}>{mode.mapName}</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>ИГРОКИ</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: mode.color }}>{mode.players}</div>
          </div>
        </div>

        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginBottom: 6 }}>
          КАК ИГРАТЬ
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.92)" }}>
          {mode.desc}
        </div>
      </div>
    </div>
  );
}

function RankPill({ rank }: { rank: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "linear-gradient(135deg, #F9A825, #FFD700)",
      color: "#000",
      borderRadius: 6, padding: "2px 7px",
      fontSize: 11, fontWeight: 900, letterSpacing: 0.5,
      boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
    }}>
      РАНГ {rank}/{MAX_BRAWLER_RANK}
    </span>
  );
}

function PowerPill({ level }: { level: number }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "linear-gradient(135deg, #311B92, #7B2FBE)",
      color: "white",
      borderRadius: 6, padding: "2px 7px",
      fontSize: 11, fontWeight: 900, letterSpacing: 0.5,
      border: "1px solid rgba(206,147,216,0.6)",
    }}>
      ⚡ СИЛА {level}
    </span>
  );
}

function Resource({ icon, value, color, compact }: { icon: string; value: number; color: string; compact?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: compact ? 2 : 4,
      padding: compact ? "0 3px" : "0 6px",
      fontSize: compact ? 11 : 14,
    }}>
      <span>{icon}</span>
      <span style={{ color, fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function SideButton({
  icon, label, onClick, color, pulse, badge, compact,
}: { icon: string; label: string; onClick: () => void; color: string; pulse?: boolean; badge?: number; compact?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={compact ? label : undefined}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: compact ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 0 : 10,
        background: hovered ? `${color}26` : "rgba(0,0,0,0.4)",
        border: `1.5px solid ${hovered ? color : "rgba(255,255,255,0.1)"}`,
        borderRadius: compact ? 10 : 14,
        padding: compact ? "4px 4px" : "10px 14px",
        color: "white", cursor: "pointer",
        minWidth: compact ? 0 : 130,
        width: compact ? 50 : undefined,
        backdropFilter: "blur(10px)",
        transition: "all 0.2s",
        boxShadow: hovered ? `0 0 18px ${color}66` : "none",
        animation: pulse ? "pulse 1.6s ease-in-out infinite" : undefined,
      }}
    >
      <span style={{ fontSize: compact ? 20 : 20, lineHeight: 1 }}>{icon}</span>
      {compact ? (
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: 0.4, marginTop: 2,
          color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap",
        }}>{label}</span>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{label}</span>
      )}
      <NotificationBadge count={badge ?? 0} />
    </button>
  );
}

// Small red circular indicator showing the number of unclaimed/unread items.
// Positioned in the top-right corner of any `position: relative` container.
// Renders nothing when count is 0 so it disappears once everything is claimed.
function NotificationBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      style={{
        position: "absolute", top: -6, right: -6,
        minWidth: 20, height: 20,
        padding: "0 6px",
        borderRadius: 10,
        background: "linear-gradient(135deg, #FF1744, #D50000)",
        border: "2px solid #160048",
        color: "white",
        fontSize: 11, fontWeight: 900, letterSpacing: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 10px rgba(255,23,68,0.7)",
        animation: "pulse 1.4s ease-in-out infinite",
        pointerEvents: "none",
        zIndex: 10,
        lineHeight: 1,
      }}
    >
      {display}
    </span>
  );
}
