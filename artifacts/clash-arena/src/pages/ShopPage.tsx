import { useState, useEffect } from "react";
import AnimatedBg from "../components/AnimatedBg";
import { getCurrentProfile, openBox, addGems, claimDailyBonus, buyChest, openChest, canClaimDailyLadder, unlockBrawlerWithGems } from "../utils/localStorageAPI";
import RewardDropModal, { type RewardInfo } from "../components/RewardDropModal";
import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity, type ChestRoll } from "../utils/chests";
import { BRAWLERS, BRAWLER_GEM_COST, BRAWLER_RARITY_LABEL } from "../entities/BrawlerData";
import Chest3DViewer from "../components/Chest3DViewer";
import ChestOpenAnimation from "../components/ChestOpenAnimation";
import ChestOpenModal from "../components/ChestOpenModal";
import BrawlerRevealModal from "../components/BrawlerRevealModal";
import { CoinBadge, GemBadge, PowerBadge, CoinIcon, GemIcon, PowerIcon, BoxIcon } from "../components/GameIcons";

interface ShopPageProps {
  onBack: () => void;
}

export default function ShopPage({ onBack }: ShopPageProps) {
  const [profile, setProfile] = useState(getCurrentProfile());
  const [boxResult, setBoxResult] = useState<{ type: string; amount: number } | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [msg, setMsg] = useState("");
  const [chestAnimating, setChestAnimating] = useState<{ rarity: ChestRarity; rolls: ChestRoll[] } | null>(null);
  const [chestOpening, setChestOpening] = useState<{ rarity: ChestRarity; rolls: ChestRoll[] } | null>(null);
  const [purchasedBrawler, setPurchasedBrawler] = useState<string | null>(null);
  const [pendingReward, setPendingReward] = useState<RewardInfo | null>(null);

  const handleUnlockBrawler = (brawlerId: string) => {
    const r = unlockBrawlerWithGems(brawlerId);
    if (r.success) {
      setProfile(getCurrentProfile());
      setPurchasedBrawler(brawlerId);
    } else {
      setMsg(r.error || "Ошибка");
      setTimeout(() => setMsg(""), 2200);
    }
  };

  const handleBuyChest = (rarity: ChestRarity, currency: "coins" | "gems") => {
    const r = buyChest(rarity, currency);
    setMsg(r.success ? `Куплен ${CHESTS[rarity].name}` : (r.error || "Ошибка"));
    setProfile(getCurrentProfile());
    setTimeout(() => setMsg(""), 2000);
  };

  const handleOpenChestRarity = (rarity: ChestRarity) => {
    const r = openChest(rarity);
    if (!r.success) {
      setMsg(r.error || "Ошибка");
      setTimeout(() => setMsg(""), 2000);
      return;
    }
    setProfile(getCurrentProfile());
    setChestAnimating({ rarity, rolls: r.rolls! });
  };

  const handleChestAnimationDone = () => {
    if (!chestAnimating) return;
    const data = { ...chestAnimating };
    setChestAnimating(null);
    setChestOpening(data);
  };

  useEffect(() => {
    const interval = setInterval(() => setProfile(getCurrentProfile()), 500);
    return () => clearInterval(interval);
  }, []);

  const handleOpenBox = () => {
    if (!profile || profile.coins < 100 || isOpening) return;
    setIsOpening(true);
    setBoxResult(null);

    setTimeout(() => {
      const result = openBox();
      setBoxResult(result);
      setProfile(getCurrentProfile());
      setIsOpening(false);
    }, 1200);
  };

  const handleAddGems = () => {
    addGems(100);
    setProfile(getCurrentProfile());
setMsg("+100 кристаллов добавлено!");
    setTimeout(() => setMsg(""), 3000);
  };

  const handleDailyBonus = () => {
    const r = claimDailyBonus();
    if (r.success && r.coins) {
      setProfile(getCurrentProfile());
      setPendingReward({ type: "coins", amount: r.coins, label: `${r.coins} монет` });
    } else {
      setMsg("Ежедневный бонус уже получен. Возвращайтесь завтра!");
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const canClaimDaily = !!profile && canClaimDailyLadder(profile);

  const boxTypeLabel: Record<string, string> = {
    coins: "монет",
    gems: "кристаллов",
    powerPoints: "очков силы",
    error: "Ошибка",
  };
  const boxTypeColor: Record<string, string> = {
    coins: "#FFD700",
    gems: "#40C4FF",
    powerPoints: "#CE93D8",
    error: "#FF5252",
  };
  const BoxResultIcon = ({ type }: { type: string }) => {
    if (type === "coins") return <CoinIcon size={36} />;
    if (type === "gems") return <GemIcon size={36} />;
    if (type === "powerPoints") return <PowerIcon size={36} />;
    return <span style={{ fontSize: 36 }}>❌</span>;
  };

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        color: "white",
        position: "relative",
      }}
    >
      <AnimatedBg theme="shop" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0) rotate(0deg); }
          10%,50% { transform: translateX(-5px) rotate(-3deg); }
          30%,70% { transform: translateX(5px) rotate(3deg); }
        }
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={onBack}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "7px 16px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          ← Назад
        </button>
        <h2 style={{ flex: 1, textAlign: "center", margin: 0, fontSize: 22, fontWeight: 800, color: "#FFD700" }}>Магазин</h2>
        <div style={{ display: "flex", gap: 14, fontSize: 14 }}>
          <CoinBadge value={profile?.coins || 0} />
          <GemBadge value={profile?.gems || 0} />
          <PowerBadge value={profile?.powerPoints || 0} />
        </div>
      </div>

      <div style={{ flex: 1, padding: "40px 24px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        {/* BRAWLERS UNLOCK SECTION */}
        {(() => {
          if (!profile) return null;
          const locked = BRAWLERS.filter(b => !profile.unlockedBrawlers.includes(b.id));
          if (locked.length === 0) return null;
          return (
            <div style={{ marginBottom: 28 }}>
              <div style={{
                fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 3, fontWeight: 800,
                marginBottom: 10, paddingLeft: 4,
              }}>БОЙЦЫ — РАЗБЛОКИРОВКА ЗА КРИСТАЛЛЫ</div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                gap: 14,
              }}>
                {locked.map(b => {
                  const cost = BRAWLER_GEM_COST[b.rarity];
                  const rarityColor = CHESTS[b.rarity].borderColor;
                  const canAfford = profile.gems >= cost;
                  return (
                    <div key={b.id} style={{
                      background: `linear-gradient(180deg, ${rarityColor}22 0%, rgba(0,0,0,0.45) 100%)`,
                      border: `1.5px solid ${rarityColor}66`,
                      borderRadius: 16, padding: 12,
                      display: "flex", flexDirection: "column", alignItems: "center",
                      boxShadow: `0 0 14px ${rarityColor}33`,
                      position: "relative",
                    }}>
                      <div style={{
                        position: "absolute", top: 8, left: 10,
                        background: rarityColor, color: "white",
                        fontSize: 9, fontWeight: 900, letterSpacing: 1,
                        borderRadius: 6, padding: "2px 7px",
                        textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                      }}>{BRAWLER_RARITY_LABEL[b.rarity]}</div>
                      <div style={{
                        width: 90, height: 90, marginTop: 14,
                        background: `radial-gradient(circle at 50% 60%, ${rarityColor}55, transparent 70%)`,
                        borderRadius: 12,
                        display: "flex", alignItems: "flex-end", justifyContent: "center",
                        position: "relative",
                      }}>
                        <img
                          src={`${import.meta.env.BASE_URL}brawlers/${b.id}_front.png`}
                          alt={b.name}
                          style={{
                            maxWidth: "100%", maxHeight: "100%",
                            filter: "grayscale(0.85) brightness(0.6) drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
                          }}
                        />
                        <div style={{
                          position: "absolute", inset: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 36, textShadow: "0 2px 6px rgba(0,0,0,0.8)",
                          pointerEvents: "none",
                        }}>🔒</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: b.color, marginTop: 8, letterSpacing: 1 }}>
                        {b.name}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 1, fontWeight: 600, letterSpacing: 1 }}>
                        {b.role.toUpperCase()}
                      </div>
                      <button
                        onClick={() => handleUnlockBrawler(b.id)}
                        disabled={!canAfford}
                        style={{
                          marginTop: 10, width: "100%",
                          background: canAfford
                            ? "linear-gradient(135deg, #0288D1, #40C4FF)"
                            : "rgba(255,255,255,0.05)",
                          border: canAfford ? "none" : "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 8, padding: "8px 0",
                          color: canAfford ? "white" : "rgba(255,255,255,0.4)",
                          fontWeight: 900, fontSize: 12, letterSpacing: 1,
                          cursor: canAfford ? "pointer" : "default",
                        }}
                      ><GemIcon size={12} /> {cost}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* CHESTS SECTION */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 3, fontWeight: 800,
            marginBottom: 10, paddingLeft: 4,
          }}>СУНДУКИ С НАГРАДАМИ</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 14,
          }}>
            {CHEST_RARITY_ORDER.map(rarity => {
              const def = CHESTS[rarity];
              const owned = profile?.chestInventory?.[rarity] || 0;
              const canCoin = !!profile && profile.coins >= def.priceCoins;
              const canGem  = !!profile && profile.gems >= def.priceGems;
              return (
                <div key={rarity} style={{
                  background: `linear-gradient(180deg, ${def.color}1A 0%, rgba(0,0,0,0.4) 100%)`,
                  border: `1.5px solid ${def.borderColor}55`,
                  borderRadius: 16, padding: 12,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  boxShadow: `0 0 16px ${def.color}22`,
                }}>
                  <div
                    style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", cursor: owned > 0 ? "pointer" : "default" }}
                    onClick={() => owned > 0 && handleOpenChestRarity(rarity)}
                    title={owned > 0 ? "Нажмите, чтобы открыть" : undefined}
                  >
                    <Chest3DViewer rarity={rarity} size={84} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: def.color, marginTop: 4, textAlign: "center" }}>
                    {def.name}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", textAlign: "center", marginTop: 2 }}>
                    {def.drops.rolls} наград · ★{def.tier}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: def.color, fontWeight: 800 }}>
                    В инвентаре: {owned}
                  </div>
                  <button
                    onClick={() => handleOpenChestRarity(rarity)}
                    disabled={owned < 1}
                    style={{
                      marginTop: 8, width: "100%",
                      background: owned > 0 ? `linear-gradient(135deg, ${def.color}, ${def.secondaryColor})` : "rgba(255,255,255,0.05)",
                      border: "none", borderRadius: 8, padding: "7px 0",
                      color: owned > 0 ? "white" : "rgba(255,255,255,0.4)",
                      fontWeight: 900, fontSize: 11, letterSpacing: 1,
                      cursor: owned > 0 ? "pointer" : "default",
                    }}
                  >ОТКРЫТЬ</button>
                  <div style={{ marginTop: 6, width: "100%", display: "flex", gap: 6 }}>
                    <button
                      onClick={() => handleBuyChest(rarity, "coins")}
                      disabled={!canCoin}
                      style={{
                        flex: 1, background: canCoin ? "linear-gradient(135deg, #F9A825, #FFD700)" : "rgba(255,255,255,0.05)",
                        border: "none", borderRadius: 7, padding: "6px 0",
                        color: canCoin ? "#000" : "rgba(255,255,255,0.4)",
                        fontWeight: 800, fontSize: 11, cursor: canCoin ? "pointer" : "default",
                      }}
                    ><CoinIcon size={11} /> {def.priceCoins}</button>
                    <button
                      onClick={() => handleBuyChest(rarity, "gems")}
                      disabled={!canGem}
                      style={{
                        flex: 1, background: canGem ? "linear-gradient(135deg, #0288D1, #40C4FF)" : "rgba(255,255,255,0.05)",
                        border: "none", borderRadius: 7, padding: "6px 0",
                        color: canGem ? "white" : "rgba(255,255,255,0.4)",
                        fontWeight: 800, fontSize: 11, cursor: canGem ? "pointer" : "default",
                      }}
                    ><GemIcon size={11} /> {def.priceGems}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
          <div
            style={{
              background: "rgba(255,215,0,0.06)",
              border: "1px solid rgba(255,215,0,0.2)",
              borderRadius: 20,
              padding: 30,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 80, height: 80,
                marginBottom: 12,
                animation: isOpening ? "shake 0.3s ease-in-out 3" : "none",
                display: "inline-block",
              }}
            >
              <BoxIcon size={80} />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#FFD700", marginBottom: 6 }}>Секретный сундук</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
              70% монеты • 25% очки силы • 5% кристаллы
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#FFD700", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>100 <CoinIcon size={20} /></div>
            <button
              onClick={handleOpenBox}
              disabled={!profile || profile.coins < 100 || isOpening}
              style={{
                background: profile && profile.coins >= 100 ? "linear-gradient(135deg, #F9A825, #FFD700)" : "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: 12,
                padding: "12px 32px",
                color: profile && profile.coins >= 100 ? "#000" : "rgba(255,255,255,0.3)",
                fontWeight: 800,
                fontSize: 15,
                cursor: profile && profile.coins >= 100 ? "pointer" : "not-allowed",
                letterSpacing: 1,
              }}
            >
{isOpening ? "Открытие..." : "Открыть сундук"}
            </button>

            {boxResult && (
              <div
                style={{
                  marginTop: 16,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 12,
                  padding: "16px",
                  animation: "pop 0.4s ease-out",
                }}
              >
                <div><BoxResultIcon type={boxResult.type} /></div>
                <div style={{ fontSize: 22, fontWeight: 800, color: boxTypeColor[boxResult.type] || "#white" }}>
                  +{boxResult.amount} {boxTypeLabel[boxResult.type]}!
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                background: "rgba(64,196,255,0.06)",
                border: "1px solid rgba(64,196,255,0.2)",
                borderRadius: 20,
                padding: 24,
                flex: 1,
              }}
            >
              <div style={{ marginBottom: 8 }}><GemIcon size={44} /></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#40C4FF", marginBottom: 6 }}>Кристаллы</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>
Тестовая кнопка: +100 кристаллов мгновенно
              </div>
              <button
                onClick={handleAddGems}
                style={{
                  background: "linear-gradient(135deg, #0288D1, #40C4FF)",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 24px",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
+100 кристаллов (тест)
              </button>
            </div>

            <div
              style={{
                background: canClaimDaily ? "rgba(76,175,80,0.1)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${canClaimDaily ? "rgba(76,175,80,0.4)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 20,
                padding: 24,
                flex: 1,
              }}
            >
              <div style={{ marginBottom: 8 }}><CoinIcon size={44} /></div>
              <div style={{ fontSize: 18, fontWeight: 800, color: canClaimDaily ? "#4CAF50" : "rgba(255,255,255,0.4)", marginBottom: 6 }}>
Ежедневный бонус
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>+50 монет каждые 24 часа</div>
              <button
                onClick={handleDailyBonus}
                disabled={!canClaimDaily}
                style={{
                  background: canClaimDaily ? "linear-gradient(135deg, #2E7D32, #4CAF50)" : "rgba(255,255,255,0.1)",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 24px",
                  color: canClaimDaily ? "white" : "rgba(255,255,255,0.3)",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: canClaimDaily ? "pointer" : "not-allowed",
                }}
              >
{canClaimDaily ? "Получить!" : "Уже получено"}
              </button>
            </div>
          </div>
        </div>

        {msg && (
          <div
            style={{
              textAlign: "center",
              background: "rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "14px",
              color: "#FFD700",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {msg}
          </div>
        )}
      </div>

      {chestAnimating && (
        <ChestOpenAnimation
          rarity={chestAnimating.rarity}
          onDone={handleChestAnimationDone}
        />
      )}

      {chestOpening && (
        <ChestOpenModal
          rarity={chestOpening.rarity}
          rolls={chestOpening.rolls}
          onClose={() => setChestOpening(null)}
        />
      )}

      {purchasedBrawler && (
        <BrawlerRevealModal
          brawlerId={purchasedBrawler}
          onDone={() => setPurchasedBrawler(null)}
        />
      )}
      {pendingReward && (
        <RewardDropModal
          reward={pendingReward}
          onDone={() => setPendingReward(null)}
        />
      )}
    </div>
  );
}
