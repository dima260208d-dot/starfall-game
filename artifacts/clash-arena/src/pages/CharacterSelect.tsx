import { useEffect, useState } from "react";
import { BRAWLERS, BRAWLER_LORE, getScaledStats } from "../entities/BrawlerData";
import {
  getCurrentProfile,
  upgradeBrawler,
  upgradeBrawlerCost,
  upgradeBrawlerWithGems,
  gemUpgradeShortfall,
  isBrawlerUnlocked,
  brawlerGemPrice,
  buyBrawler,
  MAX_BRAWLER_LEVEL,
} from "../utils/localStorageAPI";
import BrawlerViewer3D from "../components/BrawlerViewer3D";
import { getBrawlerRarity, RARITY_LABEL, RARITY_COLOR } from "../utils/brawlerRarity";

interface CharacterSelectProps {
  onPickAsActive: (brawlerId: string) => void;
  onTraining: (brawlerId: string) => void;
  onBack: () => void;
}

export default function CharacterSelect({ onPickAsActive, onTraining, onBack }: CharacterSelectProps) {
  const [profile, setProfile] = useState(getCurrentProfile());
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setProfile(getCurrentProfile()), 500);
    return () => clearInterval(t);
  }, []);

  if (!profile) return null;

  const detailBrawler = openId ? BRAWLERS.find(b => b.id === openId) || null : null;

  return detailBrawler ? (
    <CharacterDetail
      brawler={detailBrawler}
      level={profile.brawlerLevels[detailBrawler.id] || 1}
      coins={profile.coins}
      gems={profile.gems}
      powerPoints={profile.powerPoints}
      isActive={profile.selectedBrawlerId === detailBrawler.id}
      isUnlocked={isBrawlerUnlocked(detailBrawler.id)}
      onClose={() => setOpenId(null)}
      onHome={onBack}
      onPickAsActive={() => { onPickAsActive(detailBrawler.id); }}
      onTraining={() => onTraining(detailBrawler.id)}
      onUpgrade={() => {
        const r = upgradeBrawler(detailBrawler.id);
        if (r.success) setProfile(getCurrentProfile());
        return r;
      }}
      onUpgradeWithGems={() => {
        const r = upgradeBrawlerWithGems(detailBrawler.id);
        if (r.success) setProfile(getCurrentProfile());
        return r;
      }}
      onBuy={() => {
        const r = buyBrawler(detailBrawler.id);
        if (r.success) setProfile(getCurrentProfile());
        return r;
      }}
    />
  ) : (
    <CharacterGrid
      profile={profile}
      onBack={onBack}
      onOpen={(id) => setOpenId(id)}
    />
  );
}

// =========================================================================
// GRID VIEW
// =========================================================================

interface CharacterGridProps {
  profile: ReturnType<typeof getCurrentProfile>;
  onBack: () => void;
  onOpen: (id: string) => void;
}

function CharacterGrid({ profile, onBack, onOpen }: CharacterGridProps) {
  if (!profile) return null;
  const base = (import.meta as any).env?.BASE_URL ?? "/";

  return (
    <div style={{
      minHeight: "100vh",
      background: "transparent",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      color: "white",
      padding: 20,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 24,
      }}>
        <button onClick={onBack} style={pillBtn}>← Назад</button>
        <h2 style={{
          margin: 0, fontSize: 26, fontWeight: 900,
          background: "linear-gradient(135deg, #CE93D8, #FFD700)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          letterSpacing: 2,
        }}>
          КОЛЛЕКЦИЯ БОЙЦОВ
        </h2>
        <ResourcesBar coins={profile.coins} gems={profile.gems} powerPoints={profile.powerPoints} />
      </div>

      <div style={{
        maxWidth: 1100, margin: "0 auto",
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18,
      }}>
        {BRAWLERS.map((b) => {
          const lv = profile.brawlerLevels[b.id] || 1;
          const isActive = profile.selectedBrawlerId === b.id;
          const unlocked = profile.unlockedBrawlers.includes(b.id);
          const rarity = getBrawlerRarity(b.id);
          const rColor = RARITY_COLOR[rarity];
          return (
            <button
              key={b.id}
              onClick={() => onOpen(b.id)}
              style={{
                background: unlocked
                  ? `linear-gradient(180deg, ${b.color}26 0%, rgba(0,0,0,0.4) 80%)`
                  : `linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.55) 80%)`,
                border: `2px solid ${isActive ? b.color : (unlocked ? b.color + "55" : rColor + "55")}`,
                borderRadius: 18,
                padding: "18px 14px",
                cursor: "pointer",
                color: "white",
                textAlign: "center",
                position: "relative",
                transition: "transform 0.15s, box-shadow 0.15s",
                boxShadow: isActive ? `0 0 25px ${b.color}aa` : "none",
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = unlocked ? `0 6px 25px ${b.color}cc` : `0 6px 25px ${rColor}88`; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = isActive ? `0 0 25px ${b.color}aa` : "none"; }}
            >
              {isActive && (
                <div style={{
                  position: "absolute", top: 8, right: 10,
                  background: b.color, color: "white",
                  fontSize: 10, fontWeight: 800,
                  borderRadius: 8, padding: "2px 8px",
                  letterSpacing: 1,
                }}>ВЫБРАН</div>
              )}
              {!unlocked && (
                <div style={{
                  position: "absolute", top: 8, left: 10,
                  background: "rgba(0,0,0,0.7)", color: rColor,
                  fontSize: 14, fontWeight: 800,
                  borderRadius: 8, padding: "2px 8px",
                  letterSpacing: 1, border: `1px solid ${rColor}`,
                }}>🔒</div>
              )}
              <div style={{
                width: 130, height: 130, margin: "0 auto",
                background: `radial-gradient(circle at 50% 60%, ${unlocked ? b.color + "55" : "rgba(255,255,255,0.08)"}, transparent 70%)`,
                borderRadius: 14,
                display: "flex", alignItems: "flex-end", justifyContent: "center",
                position: "relative",
              }}>
                <img
                  src={`${base}brawlers/${b.id}_front.png`}
                  alt={b.name}
                  style={{
                    maxWidth: "100%", maxHeight: "100%",
                    filter: unlocked
                      ? `drop-shadow(0 4px 10px ${b.color})`
                      : "brightness(0) drop-shadow(0 4px 10px rgba(0,0,0,0.6))",
                    opacity: unlocked ? 1 : 0.55,
                  }}
                />
              </div>
              {/* Rarity badge under icon */}
              <div style={{
                marginTop: 6,
                display: "inline-block",
                background: rColor, color: "white",
                fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
                borderRadius: 6, padding: "2px 8px",
                boxShadow: `0 0 10px ${rColor}aa`,
              }}>
                {RARITY_LABEL[rarity]}
              </div>
              <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: unlocked ? b.color : "#aaa", letterSpacing: 1 }}>
                {b.name}
              </div>
              {/* Rarity label under name */}
              <div style={{ fontSize: 10, color: rColor, marginTop: 2, fontWeight: 700, letterSpacing: 1.5 }}>
                {RARITY_LABEL[rarity]}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2, fontWeight: 600, letterSpacing: 1 }}>
                {b.role.toUpperCase()}
              </div>
              {unlocked ? (
                <div style={{
                  marginTop: 10,
                  display: "inline-block",
                  background: "rgba(0,0,0,0.45)",
                  border: `1px solid ${b.color}`,
                  borderRadius: 8, padding: "3px 12px",
                  fontSize: 12, fontWeight: 800, color: "#FFD700",
                  letterSpacing: 1,
                }}>
                  УРОВЕНЬ {lv}
                </div>
              ) : (
                <div style={{
                  marginTop: 10,
                  display: "inline-block",
                  background: "rgba(64,196,255,0.15)",
                  border: "1px solid #40C4FF",
                  borderRadius: 8, padding: "3px 12px",
                  fontSize: 12, fontWeight: 800, color: "#40C4FF",
                  letterSpacing: 1,
                }}>
                  💎 {brawlerGemPrice(b.id)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// DETAIL VIEW
// =========================================================================

interface CharacterDetailProps {
  brawler: typeof BRAWLERS[number];
  level: number;
  coins: number;
  gems: number;
  powerPoints: number;
  isActive: boolean;
  isUnlocked: boolean;
  onClose: () => void;
  onHome: () => void;
  onPickAsActive: () => void;
  onTraining: () => void;
  onUpgrade: () => { success: boolean; error?: string };
  onUpgradeWithGems: () => { success: boolean; error?: string };
  onBuy: () => { success: boolean; error?: string };
}

function CharacterDetail({
  brawler, level, coins, gems, powerPoints, isActive, isUnlocked,
  onClose, onHome, onPickAsActive, onTraining, onUpgrade, onUpgradeWithGems, onBuy,
}: CharacterDetailProps) {
  const lore = BRAWLER_LORE[brawler.id] || brawler.description;
  const scaled = getScaledStats(brawler, level);
  const isMax = level >= MAX_BRAWLER_LEVEL;
  const cost = upgradeBrawlerCost(level);
  const canAfford = coins >= cost.coins && powerPoints >= cost.powerPoints;
  const gemShortfall = isUnlocked && !isMax ? gemUpgradeShortfall(brawler.id) : 0;
  const canGemUpgrade = isUnlocked && !isMax && !canAfford && gemShortfall > 0 && gems >= gemShortfall;
  const rarity = getBrawlerRarity(brawler.id);
  const rColor = RARITY_COLOR[rarity];
  const buyPrice = brawlerGemPrice(brawler.id);
  const canBuy = !isUnlocked && gems >= buyPrice;
  const [msg, setMsg] = useState<string | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);

  const handleUpgrade = () => {
    if (isMax) { flash("Максимальный уровень!"); return; }
    if (!isUnlocked) { flash("Сначала купите бойца"); return; }
    if (!canAfford) { flash("Недостаточно ресурсов"); return; }
    const r = onUpgrade();
    flash(r.success ? "Боец прокачан!" : (r.error || "Ошибка"));
  };
  const handleGemUpgrade = () => {
    const r = onUpgradeWithGems();
    flash(r.success ? "Боец прокачан кристаллами!" : (r.error || "Ошибка"));
  };
  const handleBuy = () => {
    const r = onBuy();
    flash(r.success ? "Боец разблокирован!" : (r.error || "Ошибка"));
  };
  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 1800);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at center, ${brawler.color}22 0%, transparent 60%, transparent 100%)`,
      fontFamily: "'Segoe UI', Arial, sans-serif",
      color: "white",
      position: "relative",
      overflow: "hidden",
      zIndex: 1,
    }}>
      <style>{`
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `}</style>

      {/* Top-left: Class badge + name */}
      <div style={{
        position: "absolute", top: 18, left: 18, zIndex: 5,
        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
        maxWidth: 360,
      }}>
        <button onClick={onClose} style={{ ...pillBtn, fontSize: 12 }}>← К списку</button>
        <div style={{
          background: `linear-gradient(135deg, ${brawler.color}, ${brawler.secondaryColor})`,
          borderRadius: 14,
          padding: "10px 18px",
          boxShadow: `0 4px 20px ${brawler.color}88`,
        }}>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 2, lineHeight: 1 }}>
            {brawler.name.toUpperCase()}
          </div>
          {/* Rarity label under name */}
          <div style={{
            display: "inline-block", marginTop: 6,
            background: rColor, color: "white",
            fontSize: 10, fontWeight: 900, letterSpacing: 2,
            borderRadius: 6, padding: "2px 8px",
            boxShadow: `0 0 14px ${rColor}cc`,
          }}>
            ★ {RARITY_LABEL[rarity]} ★
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: 0.9, marginTop: 4 }}>
            {brawler.role.toUpperCase()} • УР {level}
          </div>
        </div>

        {/* Lore block */}
        <div style={{
          marginTop: 6,
          background: "rgba(0,0,0,0.45)",
          border: `1px solid ${brawler.color}55`,
          borderRadius: 12, padding: "12px 14px",
          fontSize: 13, lineHeight: 1.5,
          color: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ fontSize: 10, color: brawler.color, fontWeight: 800, letterSpacing: 2, marginBottom: 6 }}>
            ИСТОРИЯ БОЙЦА
          </div>
          {lore}
        </div>
      </div>

      {/* Top-right: resources + home button */}
      <div style={{
        position: "absolute", top: 18, right: 18, zIndex: 5,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <ResourcesBar coins={coins} gems={gems} powerPoints={powerPoints} />
        <button onClick={onHome} style={{
          ...pillBtn,
          background: "rgba(255,82,82,0.15)",
          border: "1px solid rgba(255,82,82,0.4)",
          color: "#FF8A80",
        }}>🏠 Домой</button>
      </div>

      {/* Center: brawler showcase */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <div style={{
          width: 540, height: 540,
          animation: "floatY 4s ease-in-out infinite",
          pointerEvents: "auto",
        }}>
          <BrawlerViewer3D brawlerId={brawler.id} color={brawler.color} size={540} autoRotateInitial />
        </div>
      </div>

      {/* Right side: stats + upgrade button */}
      <div style={{
        position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)",
        zIndex: 5, width: 280,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <button
          onClick={() => setShowStatsModal(true)}
          style={{
            background: "rgba(0,0,0,0.55)",
            border: `1px solid ${brawler.color}55`,
            borderRadius: 14, padding: "14px 16px",
            backdropFilter: "blur(8px)",
            color: "white", cursor: "pointer", textAlign: "left",
            fontFamily: "inherit",
            transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = `0 6px 25px ${brawler.color}66`;
            e.currentTarget.style.borderColor = brawler.color;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "";
            e.currentTarget.style.borderColor = `${brawler.color}55`;
          }}
        >
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 11, color: brawler.color, fontWeight: 800, letterSpacing: 2 }}>
              ХАРАКТЕРИСТИКИ
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 1 }}>
              ПОДРОБНЕЕ ▸
            </div>
          </div>
          <Stat label="ЗДОРОВЬЕ" value={scaled.hp.toString()} icon="❤️" color="#4CAF50" />
          <Stat label="УРОН"     value={scaled.attackDamage.toString()} icon="⚔️" color="#FF5252" />
          <Stat label="СКОРОСТЬ" value={brawler.speed.toFixed(1)} icon="👟" color="#40C4FF" />
          <Stat label="ДАЛЬН-ТЬ" value={brawler.attackRange.toString()} icon="🎯" color="#CE93D8" />
          <Stat label="РЕГЕН"    value={`${brawler.regenRate}/c`} icon="✨" color="#69F0AE" />
          <Stat label="ЗАРЯДЫ"   value={brawler.attackCharges.toString()} icon="🔋" color="#FFD700" />
        </button>

        {isUnlocked && (canAfford || isMax) && (
          <button
            onClick={handleUpgrade}
            disabled={isMax}
            style={{
              background: isMax
                ? "rgba(255,255,255,0.06)"
                : canAfford
                  ? "linear-gradient(135deg, #2E7D32, #69F0AE)"
                  : "rgba(255,82,82,0.15)",
              border: isMax ? "1px solid rgba(255,255,255,0.1)" : `1px solid ${canAfford ? "#69F0AE" : "rgba(255,82,82,0.4)"}`,
              borderRadius: 12, padding: "12px 14px",
              color: "white", fontWeight: 800, fontSize: 14, letterSpacing: 1,
              cursor: isMax ? "default" : "pointer",
              display: "flex", flexDirection: "column", gap: 2,
            }}
          >
            <span>{isMax ? "✓ МАКС. УРОВЕНЬ" : `▲ УЛУЧШИТЬ ДО УР. ${level + 1}`}</span>
            {!isMax && (
              <span style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>
                🪙 {cost.coins} • ✨ {cost.powerPoints}
              </span>
            )}
          </button>
        )}

        {/* Gem-fallback upgrade: shown when can't afford with normal currencies but has enough gems */}
        {isUnlocked && !isMax && !canAfford && gemShortfall > 0 && (
          <button
            onClick={handleGemUpgrade}
            disabled={!canGemUpgrade}
            style={{
              background: canGemUpgrade
                ? "linear-gradient(135deg, #0288D1, #40C4FF)"
                : "rgba(255,255,255,0.06)",
              border: canGemUpgrade ? "1px solid #40C4FF" : "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12, padding: "10px 14px",
              color: "white", fontWeight: 800, fontSize: 13, letterSpacing: 1,
              cursor: canGemUpgrade ? "pointer" : "not-allowed",
              display: "flex", flexDirection: "column", gap: 2,
            }}
          >
            <span>💎 ДОПЛАТИТЬ КРИСТАЛЛАМИ</span>
            <span style={{ fontSize: 11, opacity: 0.85, fontWeight: 700 }}>
              нужно ещё 💎 {gemShortfall}
            </span>
          </button>
        )}

        {!isUnlocked && (
          <button
            onClick={handleBuy}
            disabled={!canBuy}
            style={{
              background: canBuy
                ? `linear-gradient(135deg, ${rColor}, #40C4FF)`
                : "rgba(255,82,82,0.15)",
              border: canBuy ? `1px solid ${rColor}` : "1px solid rgba(255,82,82,0.4)",
              borderRadius: 12, padding: "14px 16px",
              color: "white", fontWeight: 900, fontSize: 14, letterSpacing: 1.5,
              cursor: canBuy ? "pointer" : "not-allowed",
              display: "flex", flexDirection: "column", gap: 2,
              boxShadow: canBuy ? `0 4px 20px ${rColor}aa` : "none",
            }}
          >
            <span>🔓 РАЗБЛОКИРОВАТЬ</span>
            <span style={{ fontSize: 12, opacity: 0.9, fontWeight: 800 }}>
              💎 {buyPrice}
            </span>
          </button>
        )}
      </div>

      {/* Bottom-left: Select + Training */}
      <div style={{
        position: "absolute", left: 18, bottom: 18, zIndex: 5,
        display: "flex", gap: 10,
      }}>
        <button
          onClick={onPickAsActive}
          disabled={isActive || !isUnlocked}
          style={{
            background: isActive || !isUnlocked
              ? "rgba(255,255,255,0.06)"
              : `linear-gradient(135deg, ${brawler.color}, ${brawler.secondaryColor})`,
            border: "none", borderRadius: 14,
            padding: "14px 32px",
            color: "white", fontWeight: 900, fontSize: 16, letterSpacing: 2,
            cursor: isActive || !isUnlocked ? "default" : "pointer",
            opacity: !isUnlocked ? 0.5 : 1,
            boxShadow: isActive || !isUnlocked ? "none" : `0 4px 25px ${brawler.color}aa`,
          }}
        >
          {!isUnlocked ? "🔒 ЗАБЛОКИРОВАН" : isActive ? "✓ УЖЕ ВЫБРАН" : "ВЫБРАТЬ"}
        </button>
        <button
          onClick={onTraining}
          disabled={!isUnlocked}
          style={{
            background: !isUnlocked ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #FFAB40, #FFD700)",
            border: "none", borderRadius: 14,
            padding: "14px 32px",
            color: !isUnlocked ? "rgba(255,255,255,0.4)" : "#3E2723",
            fontWeight: 900, fontSize: 16, letterSpacing: 2,
            cursor: !isUnlocked ? "not-allowed" : "pointer",
            opacity: !isUnlocked ? 0.5 : 1,
            boxShadow: !isUnlocked ? "none" : "0 4px 25px rgba(255,171,64,0.5)",
          }}
        >
          🎯 ИСПЫТАТЬ
        </button>
      </div>

      {msg && (
        <div style={{
          position: "absolute", bottom: 90, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)", border: `1px solid ${brawler.color}`,
          borderRadius: 10, padding: "10px 18px", color: "white", fontWeight: 700, fontSize: 14,
          backdropFilter: "blur(10px)", zIndex: 6,
        }}>
          {msg}
        </div>
      )}

      {showStatsModal && (
        <StatsModal
          brawler={brawler}
          level={level}
          scaled={scaled}
          onClose={() => setShowStatsModal(false)}
        />
      )}
    </div>
  );
}

// =========================================================================
// FULL STATS MODAL
// =========================================================================

interface StatsModalProps {
  brawler: typeof BRAWLERS[number];
  level: number;
  scaled: ReturnType<typeof getScaledStats>;
  onClose: () => void;
}

function StatsModal({ brawler, level, scaled, onClose }: StatsModalProps) {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "fadeIn 0.2s ease",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pop { from { transform: scale(0.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(720px, 95vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: `linear-gradient(180deg, ${brawler.color}22 0%, #0a0028 60%, #050018 100%)`,
          border: `2px solid ${brawler.color}`,
          borderRadius: 20,
          boxShadow: `0 30px 80px rgba(0,0,0,0.7), 0 0 80px ${brawler.color}55`,
          animation: "pop 0.25s ease",
          color: "white",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "20px 24px",
          background: `linear-gradient(135deg, ${brawler.color}, ${brawler.secondaryColor})`,
          borderRadius: "18px 18px 0 0",
          position: "relative",
        }}>
          <img
            src={`${base}brawlers/${brawler.id}_front.png`}
            alt={brawler.name}
            style={{ width: 90, height: 90, objectFit: "contain", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.4))" }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 2, lineHeight: 1 }}>
              {brawler.name.toUpperCase()}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, opacity: 0.9, marginTop: 6 }}>
              {brawler.role.toUpperCase()} • УРОВЕНЬ {level}/{MAX_BRAWLER_LEVEL}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 10, padding: "6px 12px",
              color: "white", fontWeight: 800, cursor: "pointer", fontSize: 14,
            }}
          >✕</button>
        </div>

        {/* Stats grid */}
        <div style={{ padding: "20px 24px" }}>
          <SectionTitle color={brawler.color}>БОЕВЫЕ ХАРАКТЕРИСТИКИ</SectionTitle>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
            marginBottom: 18,
          }}>
            <FullStat icon="❤️"  label="ЗДОРОВЬЕ"          value={`${scaled.hp}`}                  base={`${brawler.hp} базовый`} color="#4CAF50" />
            <FullStat icon="⚔️"  label="УРОН АТАКИ"        value={`${scaled.attackDamage}`}        base={`${brawler.attackDamage} базовый`} color="#FF5252" />
            <FullStat icon="👟"  label="СКОРОСТЬ"           value={brawler.speed.toFixed(1)}         base="клеток в секунду" color="#40C4FF" />
            <FullStat icon="🎯"  label="ДАЛЬНОСТЬ"          value={`${brawler.attackRange}`}         base="радиус выстрела"  color="#CE93D8" />
            <FullStat icon="✨"  label="РЕГЕНЕРАЦИЯ"        value={`${brawler.regenRate}/c`}         base="HP в секунду"     color="#69F0AE" />
            <FullStat icon="🔋"  label="ЗАРЯДЫ АТАКИ"       value={`${brawler.attackCharges}`}       base="макс. одновременно" color="#FFD700" />
            <FullStat icon="⏱"  label="ПЕРЕЗАРЯДКА"        value={`${brawler.attackCooldown.toFixed(1)}c`} base="между выстрелами" color="#FFAB40" />
            <FullStat icon="⚡"  label="ОТКАТ СУПЕРА"       value={`${brawler.superCooldown}c`}      base="максимум"         color="#E040FB" />
          </div>

          <SectionTitle color="#40C4FF">⚔️ ОСНОВНАЯ АТАКА — {brawler.attackName}</SectionTitle>
          <div style={{
            background: "rgba(64,196,255,0.08)",
            border: "1px solid rgba(64,196,255,0.3)",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 13, lineHeight: 1.55,
            color: "rgba(255,255,255,0.85)",
            marginBottom: 18,
          }}>
            {brawler.attackDesc}
          </div>

          <SectionTitle color="#FFD700">⚡ СУПЕРСПОСОБНОСТЬ — {brawler.superName}</SectionTitle>
          <div style={{
            background: "rgba(255,215,0,0.08)",
            border: "1px solid rgba(255,215,0,0.3)",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 13, lineHeight: 1.55,
            color: "rgba(255,255,255,0.85)",
            marginBottom: 18,
          }}>
            {brawler.superDesc}
          </div>

          <SectionTitle color={brawler.color}>📜 ОПИСАНИЕ</SectionTitle>
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 12, lineHeight: 1.5,
            color: "rgba(255,255,255,0.7)",
            fontStyle: "italic",
          }}>
            {brawler.description}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      fontSize: 11, color, fontWeight: 800, letterSpacing: 2,
      marginBottom: 10, marginTop: 4,
    }}>
      {children}
    </div>
  );
}

function FullStat({ icon, label, value, base, color }: { icon: string; label: string; value: string; base: string; color: string }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 10,
      padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 22, color, fontWeight: 900, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
        {base}
      </div>
    </div>
  );
}

// =========================================================================
// SHARED COMPONENTS
// =========================================================================

function ResourcesBar({ coins, gems, powerPoints }: { coins: number; gems: number; powerPoints: number }) {
  return (
    <div style={{
      display: "flex", gap: 6,
      background: "rgba(0,0,0,0.4)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12, padding: "6px 10px",
      backdropFilter: "blur(10px)",
    }}>
      <ResourceItem icon="🪙" value={coins} color="#FFD700" />
      <ResourceItem icon="💎" value={gems} color="#40C4FF" />
      <ResourceItem icon="✨" value={powerPoints} color="#CE93D8" />
    </div>
  );
}

function ResourceItem({ icon, value, color }: { icon: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 6px", fontSize: 14 }}>
      <span>{icon}</span>
      <span style={{ color, fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "5px 0",
      borderBottom: "1px dashed rgba(255,255,255,0.06)",
    }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, letterSpacing: 1 }}>
        {icon} {label}
      </span>
      <span style={{ fontSize: 14, color, fontWeight: 800 }}>{value}</span>
    </div>
  );
}

const pillBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 10, padding: "7px 16px",
  color: "rgba(255,255,255,0.85)",
  cursor: "pointer", fontSize: 13, fontWeight: 600,
};
