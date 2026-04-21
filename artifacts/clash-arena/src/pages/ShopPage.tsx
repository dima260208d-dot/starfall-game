import { useState, useEffect } from "react";
import { getCurrentProfile, openBox, addGems, claimDailyBonus } from "../utils/localStorageAPI";

interface ShopPageProps {
  onBack: () => void;
}

export default function ShopPage({ onBack }: ShopPageProps) {
  const [profile, setProfile] = useState(getCurrentProfile());
  const [boxResult, setBoxResult] = useState<{ type: string; amount: number } | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [msg, setMsg] = useState("");

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
    if (r.success) {
      setProfile(getCurrentProfile());
      setMsg(`Ежедневный бонус: +${r.coins} монет!`);
    } else {
      setMsg("Ежедневный бонус уже получен. Возвращайтесь завтра!");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const canClaimDaily = profile && Date.now() - profile.lastDailyBonus >= 24 * 60 * 60 * 1000;

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
  const boxTypeIcon: Record<string, string> = {
    coins: "🪙",
    gems: "💎",
    powerPoints: "✨",
    error: "❌",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #050020 0%, #0a0040 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        color: "white",
      }}
    >
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
          <span style={{ color: "#FFD700" }}>🪙 {profile?.coins || 0}</span>
          <span style={{ color: "#40C4FF" }}>💎 {profile?.gems || 0}</span>
          <span style={{ color: "#CE93D8" }}>✨ {profile?.powerPoints || 0}</span>
        </div>
      </div>

      <div style={{ flex: 1, padding: "40px 24px", maxWidth: 800, margin: "0 auto", width: "100%" }}>
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
                fontSize: 64,
                marginBottom: 12,
                animation: isOpening ? "shake 0.3s ease-in-out 3" : "none",
                display: "inline-block",
              }}
            >
              📦
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#FFD700", marginBottom: 6 }}>Секретный сундук</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>
              70% монеты • 25% очки силы • 5% кристаллы
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#FFD700", marginBottom: 16 }}>100 🪙</div>
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
                <div style={{ fontSize: 36 }}>{boxTypeIcon[boxResult.type] || "🎁"}</div>
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
              <div style={{ fontSize: 32, marginBottom: 8 }}>💎</div>
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
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎁</div>
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
    </div>
  );
}
