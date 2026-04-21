import { useState, useEffect } from "react";
import { BRAWLERS, getScaledStats } from "../entities/BrawlerData";
import {
  getCurrentProfile, upgradeBrawler,
  upgradeBrawlerWithGems, gemUpgradeShortfall,
  isBrawlerUnlocked, brawlerGemPrice, buyBrawler,
} from "../utils/localStorageAPI";
import BrawlerViewer3D from "../components/BrawlerViewer3D";
import { getBrawlerRarity, RARITY_LABEL, RARITY_COLOR } from "../utils/brawlerRarity";

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
  const handleGemUpgrade = () => {
    const brawler = BRAWLERS[selected];
    const result = upgradeBrawlerWithGems(brawler.id);
    if (result.success) {
      setProfile(getCurrentProfile());
      setMsg("Уровень повышен (кристаллами)!");
    } else {
      setMsg(result.error || "Невозможно улучшить");
    }
    setTimeout(() => setMsg(""), 3000);
  };
  const handleBuy = () => {
    const brawler = BRAWLERS[selected];
    const result = buyBrawler(brawler.id);
    if (result.success) {
      setProfile(getCurrentProfile());
      setMsg("Боец разблокирован!");
    } else {
      setMsg(result.error || "Не удалось купить");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const brawler = BRAWLERS[selected];
  const level = profile?.brawlerLevels[brawler.id] || 1;
  const scaled = getScaledStats(brawler, level);
  const nextScaled = level < 10 ? getScaledStats(brawler, level + 1) : null;
  const upgradeCost = { coins: 100 * level, pp: 5 * level };
  const canUpgrade = level < 10 && (profile?.coins || 0) >= upgradeCost.coins && (profile?.powerPoints || 0) >= upgradeCost.pp;
  const unlocked = !!profile && isBrawlerUnlocked(brawler.id);
  const rarity = getBrawlerRarity(brawler.id);
  const rColor = RARITY_COLOR[rarity];
  const gemShortfall = unlocked && level < 10
    ? gemUpgradeShortfall(brawler.id)
    : 0;
  const canGemUpgrade = unlocked && level < 10 && !canUpgrade && gemShortfall > 0 && (profile?.gems || 0) >= gemShortfall;
  const buyPrice = brawlerGemPrice(brawler.id);
  const canBuy = !unlocked && (profile?.gems || 0) >= buyPrice;

  return (
    <div
      style={{
        height: "100vh",
        background: "transparent",
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
            const itemUnlocked = !!profile && profile.unlockedBrawlers.includes(b.id);
            const itemRarity = getBrawlerRarity(b.id);
            const itemRColor = RARITY_COLOR[itemRarity];
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
                  position: "relative",
                }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}brawlers/${b.id}_front.png`}
                  alt={b.name}
                  width={48}
                  height={48}
                  style={{
                    borderRadius: 8,
                    background: `radial-gradient(circle at 50% 60%, ${itemUnlocked ? b.color + "40" : "rgba(255,255,255,0.08)"}, ${b.color}10 70%, transparent)`,
                    objectFit: "contain",
                    objectPosition: "center bottom",
                    flexShrink: 0,
                    filter: itemUnlocked
                      ? `drop-shadow(0 2px 4px ${b.color}80)`
                      : "brightness(0) drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                    opacity: itemUnlocked ? 1 : 0.55,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? b.color : (itemUnlocked ? "white" : "#aaa"), display: "flex", alignItems: "center", gap: 6 }}>
                    {!itemUnlocked && <span>🔒</span>}{b.name}
                  </div>
                  <div style={{ fontSize: 10, color: itemRColor, fontWeight: 700, letterSpacing: 1 }}>{RARITY_LABEL[itemRarity]}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    {itemUnlocked ? `УР ${lv} ${b.role}` : `💎 ${brawlerGemPrice(b.id)} • ${b.role}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "stretch", padding: "24px 30px", overflowY: "auto", minHeight: 0, gap: 24 }}>
          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <BrawlerViewer3D brawlerId={brawler.id} color={brawler.color} size={420} autoRotateInitial={true} />
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: brawler.color }}>{brawler.name}</div>
              <div style={{
                display: "inline-block", marginTop: 6,
                background: rColor, color: "white",
                fontSize: 10, fontWeight: 900, letterSpacing: 2,
                borderRadius: 6, padding: "2px 10px",
                boxShadow: `0 0 14px ${rColor}cc`,
              }}>★ {RARITY_LABEL[rarity]} ★</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: 2, marginTop: 6 }}>{brawler.role.toUpperCase()} • УРОВЕНЬ {level} / 10</div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 16,
              padding: 20,
              minWidth: 280,
              maxWidth: 460,
              alignSelf: "center",
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

            {!unlocked ? (
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8, textAlign: "center" }}>
                  Боец заблокирован. Купите за кристаллы или ловите в сундуках.
                </div>
                <button
                  onClick={handleBuy}
                  disabled={!canBuy}
                  style={{
                    width: "100%",
                    background: canBuy ? `linear-gradient(135deg, ${rColor}, #40C4FF)` : "rgba(255,255,255,0.1)",
                    border: "none", borderRadius: 12, padding: "12px 0",
                    color: canBuy ? "#fff" : "rgba(255,255,255,0.3)",
                    fontWeight: 900, fontSize: 15,
                    cursor: canBuy ? "pointer" : "not-allowed",
                    letterSpacing: 1,
                    boxShadow: canBuy ? `0 4px 20px ${rColor}aa` : "none",
                  }}
                >
                  🔓 РАЗБЛОКИРОВАТЬ — 💎 {buyPrice}
                </button>
              </div>
            ) : level < 10 ? (
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
                {!canUpgrade && gemShortfall > 0 && (
                  <button
                    onClick={handleGemUpgrade}
                    disabled={!canGemUpgrade}
                    style={{
                      width: "100%", marginTop: 8,
                      background: canGemUpgrade ? "linear-gradient(135deg, #0288D1, #40C4FF)" : "rgba(255,255,255,0.06)",
                      border: "none", borderRadius: 12, padding: "10px 0",
                      color: canGemUpgrade ? "#fff" : "rgba(255,255,255,0.4)",
                      fontWeight: 800, fontSize: 13,
                      cursor: canGemUpgrade ? "pointer" : "not-allowed",
                      letterSpacing: 1,
                    }}
                  >
                    💎 ДОПЛАТИТЬ КРИСТАЛЛАМИ ({gemShortfall})
                  </button>
                )}
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
