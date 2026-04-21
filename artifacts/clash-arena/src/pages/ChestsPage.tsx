import { useEffect, useState } from "react";
import {
  getCurrentProfile,
  buyChest,
  openChest,
} from "../utils/localStorageAPI";
import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity, type ChestRoll } from "../utils/chests";
import ChestVisual from "../components/ChestVisual";
import ChestOpenModal from "../components/ChestOpenModal";

interface Props {
  onBack: () => void;
}

export default function ChestsPage({ onBack }: Props) {
  const [profile, setProfile] = useState(getCurrentProfile());
  const [msg, setMsg] = useState<string | null>(null);
  const [opening, setOpening] = useState<{ rarity: ChestRarity; rolls: ChestRoll[] } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setProfile(getCurrentProfile()), 500);
    return () => clearInterval(id);
  }, []);

  if (!profile) return null;

  const handleBuy = (rarity: ChestRarity, currency: "coins" | "gems") => {
    const r = buyChest(rarity, currency);
    setMsg(r.success ? `Куплен ${CHESTS[rarity].name}` : (r.error || "Ошибка"));
    setProfile(getCurrentProfile());
    setTimeout(() => setMsg(null), 2000);
  };

  const handleOpen = (rarity: ChestRarity) => {
    const r = openChest(rarity);
    if (!r.success) {
      setMsg(r.error || "Ошибка");
      setTimeout(() => setMsg(null), 2000);
      return;
    }
    setOpening({ rarity, rolls: r.rolls! });
    setProfile(getCurrentProfile());
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #050020 0%, #0a0040 100%)",
      padding: "24px 18px 60px",
      color: "white",
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18, maxWidth: 1100, margin: "0 auto 18px" }}>
        <button
          onClick={onBack}
          style={{
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10, padding: "8px 18px", color: "rgba(255,255,255,0.7)",
            cursor: "pointer", fontSize: 14, fontWeight: 600,
          }}
        >← Назад</button>
        <h1 style={{
          flex: 1, textAlign: "center", margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: 3,
          background: "linear-gradient(135deg, #FFD700, #FF6E40, #FF1744)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          СУНДУКИ
        </h1>
        <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
          <span style={{ color: "#FFD700" }}>🪙 {profile.coins}</span>
          <span style={{ color: "#40C4FF" }}>💎 {profile.gems}</span>
          <span style={{ color: "#CE93D8" }}>✨ {profile.powerPoints}</span>
        </div>
      </div>

      {msg && (
        <div style={{
          maxWidth: 600, margin: "0 auto 14px",
          background: "rgba(255,215,0,0.15)", color: "#FFD700",
          border: "1px solid rgba(255,215,0,0.4)",
          borderRadius: 10, padding: "8px 14px",
          textAlign: "center", fontWeight: 700, fontSize: 14,
        }}>{msg}</div>
      )}

      <div style={{
        maxWidth: 1100, margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16,
      }}>
        {CHEST_RARITY_ORDER.map(rarity => {
          const def = CHESTS[rarity];
          const owned = profile.chestInventory[rarity] || 0;
          const canBuyCoins = profile.coins >= def.priceCoins;
          const canBuyGems = profile.gems >= def.priceGems;
          return (
            <div key={rarity} style={{
              background: `linear-gradient(180deg, ${def.color}1A 0%, rgba(0,0,0,0.45) 100%)`,
              border: `2px solid ${def.borderColor}55`,
              borderRadius: 18,
              padding: 16,
              display: "flex", flexDirection: "column", alignItems: "center",
              boxShadow: `0 0 30px ${def.color}33`,
            }}>
              <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChestVisual rarity={rarity} size={130} animated />
              </div>
              <div style={{
                fontSize: 17, fontWeight: 900, color: def.color, marginTop: 8,
                letterSpacing: 1, textAlign: "center",
              }}>
                {def.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4, textAlign: "center", minHeight: 30 }}>
                {def.description}
              </div>
              <div style={{
                marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.65)",
                background: "rgba(0,0,0,0.35)", border: `1px solid ${def.color}33`,
                borderRadius: 8, padding: "4px 10px",
              }}>
                {def.drops.rolls} наград + бонусы · ★{def.tier}
              </div>

              {/* Owned + open */}
              <div style={{ marginTop: 12, width: "100%" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 6,
                }}>
                  <span>В инвентаре:</span>
                  <span style={{ color: def.color, fontWeight: 900, fontSize: 14 }}>{owned}</span>
                </div>
                <button
                  onClick={() => handleOpen(rarity)}
                  disabled={owned < 1}
                  style={{
                    width: "100%",
                    background: owned > 0
                      ? `linear-gradient(135deg, ${def.color}, ${def.secondaryColor})`
                      : "rgba(255,255,255,0.05)",
                    border: "none", borderRadius: 10, padding: "10px 0",
                    color: owned > 0 ? "white" : "rgba(255,255,255,0.4)",
                    fontWeight: 900, letterSpacing: 1, fontSize: 13,
                    cursor: owned > 0 ? "pointer" : "default",
                  }}
                >
                  ОТКРЫТЬ
                </button>
              </div>

              {/* Buy options */}
              <div style={{ marginTop: 10, width: "100%", display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleBuy(rarity, "coins")}
                  disabled={!canBuyCoins}
                  style={{
                    flex: 1,
                    background: canBuyCoins ? "linear-gradient(135deg, #F9A825, #FFD700)" : "rgba(255,255,255,0.05)",
                    border: "none", borderRadius: 8, padding: "8px 0",
                    color: canBuyCoins ? "#000" : "rgba(255,255,255,0.4)",
                    fontWeight: 800, fontSize: 12,
                    cursor: canBuyCoins ? "pointer" : "default",
                  }}
                >
                  🪙 {def.priceCoins}
                </button>
                <button
                  onClick={() => handleBuy(rarity, "gems")}
                  disabled={!canBuyGems}
                  style={{
                    flex: 1,
                    background: canBuyGems ? "linear-gradient(135deg, #0288D1, #40C4FF)" : "rgba(255,255,255,0.05)",
                    border: "none", borderRadius: 8, padding: "8px 0",
                    color: canBuyGems ? "white" : "rgba(255,255,255,0.4)",
                    fontWeight: 800, fontSize: 12,
                    cursor: canBuyGems ? "pointer" : "default",
                  }}
                >
                  💎 {def.priceGems}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {opening && (
        <ChestOpenModal
          rarity={opening.rarity}
          rolls={opening.rolls}
          onClose={() => setOpening(null)}
        />
      )}
    </div>
  );
}
