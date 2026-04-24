import { useEffect, useState } from "react";
import {
  getCurrentProfile,
  getOrRollDailyQuests,
  claimQuestReward,
} from "../utils/localStorageAPI";
import { timeUntilQuestRefresh, formatHmsShort } from "../utils/quests";
import ChestVisual from "./ChestVisual";
import RewardDropModal, { type RewardInfo } from "./RewardDropModal";

interface Props {
  onClose: () => void;
}

export default function QuestsModal({ onClose }: Props) {
  const [profile, setProfile] = useState(getCurrentProfile());
  const [, setTick] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingReward, setPendingReward] = useState<RewardInfo | null>(null);

  useEffect(() => {
    // Trigger quest generation (no-op if already exists & fresh)
    getOrRollDailyQuests();
    setProfile(getCurrentProfile());
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!profile) return null;
  const dq = profile.dailyQuests;
  const left = timeUntilQuestRefresh(dq);

  const handleClaim = (q: NonNullable<typeof profile>["dailyQuests"]["quests"][number]) => {
    const r = claimQuestReward(q.id);
    setProfile(getCurrentProfile());
    if (r.success) {
      setPendingReward({
        type: q.reward.type as RewardInfo["type"],
        amount: q.reward.amount,
        chestRarity: q.reward.chestRarity,
        label: q.reward.label,
      });
    } else {
      setMsg(r.error || "Ошибка");
      setTimeout(() => setMsg(null), 1800);
    }
  };

  return (
    <>
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        animation: "fadeIn 0.18s ease",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pop { from { transform: scale(0.94); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 95vw)",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "linear-gradient(180deg, #1a0a3a 0%, #050020 100%)",
          border: "2px solid #CE93D8",
          borderRadius: 22,
          padding: 24,
          color: "white",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7), 0 0 80px rgba(206,147,216,0.4)",
          animation: "pop 0.2s ease",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 14, right: 14,
            background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 10, padding: "5px 11px",
            color: "white", cursor: "pointer", fontWeight: 800, fontSize: 14,
          }}
        >✕</button>

        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          gap: 12, marginBottom: 8, paddingRight: 30,
        }}>
          <div>
            <div style={{
              fontSize: 26, fontWeight: 900, letterSpacing: 2,
              background: "linear-gradient(135deg, #FFD700, #CE93D8)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              📋 ЕЖЕДНЕВНЫЕ КВЕСТЫ
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
              Выполняйте задания каждый день за крутые награды.
            </div>
          </div>
          <div style={{
            background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.4)",
            borderRadius: 10, padding: "6px 12px",
            color: "#FFD700", fontSize: 12, fontWeight: 800,
            whiteSpace: "nowrap",
          }}>
            ⏱ {formatHmsShort(left)}
          </div>
        </div>

        {msg && (
          <div style={{
            margin: "12px 0", padding: "8px 14px",
            background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.4)",
            borderRadius: 10, color: "#FFD700", textAlign: "center",
            fontWeight: 700, fontSize: 13,
          }}>{msg}</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          {dq?.quests.map(q => {
            const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
            const ready = q.progress >= q.target && !q.claimed;
            return (
              <div key={q.id} style={{
                background: q.claimed ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
                border: `1.5px solid ${q.claimed ? "rgba(76,175,80,0.4)" : ready ? "#FFD700" : "rgba(255,255,255,0.12)"}`,
                borderRadius: 14,
                padding: "14px 16px",
                display: "grid",
                gridTemplateColumns: "1fr 110px",
                gap: 14, alignItems: "center",
                opacity: q.claimed ? 0.55 : 1,
                boxShadow: ready ? "0 0 22px rgba(255,215,0,0.3)" : undefined,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "white", marginBottom: 4 }}>
                    {q.description}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      flex: 1, height: 8, borderRadius: 4,
                      background: "rgba(0,0,0,0.4)", overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", width: `${pct}%`,
                        background: ready
                          ? "linear-gradient(90deg, #FFD700, #FFAB40)"
                          : "linear-gradient(90deg, #CE93D8, #7B2FBE)",
                        transition: "width 0.3s",
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 50, textAlign: "right" }}>
                      {q.progress} / {q.target}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: "#FFD700", fontWeight: 700 }}>
                    🎁 {q.reward.label}
                  </div>
                </div>
                <div>
                  {q.reward.type === "chest" && q.reward.chestRarity ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <ChestVisual rarity={q.reward.chestRarity} size={56} animated={!q.claimed} />
                    </div>
                  ) : null}
                  <button
                    onClick={() => handleClaim(q)}
                    disabled={!ready}
                    style={{
                      marginTop: 6, width: "100%",
                      background: q.claimed
                        ? "rgba(76,175,80,0.2)"
                        : ready
                        ? "linear-gradient(135deg, #FF9800, #FFD700)"
                        : "rgba(255,255,255,0.08)",
                      border: "none", borderRadius: 10, padding: "8px 0",
                      color: q.claimed ? "#69F0AE" : ready ? "#000" : "rgba(255,255,255,0.4)",
                      fontSize: 12, fontWeight: 900, letterSpacing: 1,
                      cursor: ready ? "pointer" : "default",
                    }}
                  >
                    {q.claimed ? "✓ ВЗЯТО" : ready ? "ЗАБРАТЬ" : "В ПРОЦЕССЕ"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {pendingReward && (
      <RewardDropModal
        reward={pendingReward}
        onDone={() => setPendingReward(null)}
      />
    )}
    </>
  );
}
