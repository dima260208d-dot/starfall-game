import { useState, useEffect } from "react";
import BrawlerResultCanvas from "./BrawlerResultCanvas";
import { getQuestPool, getCurrentProfile } from "../utils/localStorageAPI";
import type { GameParticipant } from "../types/gameResult";

export type { GameParticipant };

interface ResultScreenProps {
  won: boolean;
  mode: string;
  participants: GameParticipant[];
  result: { trophyDelta: number; xpGained: number; place: number } | null;
  matchStats: { damageDealt: number; healingDone: number; superUses: number; killCount: number; powerCubesCollected: number };
  preQuestSnapshot: Array<{ id: string; progress: number }>;
  onExit: () => void;
  onPlayAgain: () => void;
}

const isTeamMode = (mode: string) =>
  ["gemgrab", "heist", "crystals", "siege"].includes(mode);

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Quest progress delta ────────────────────────────────────────────────────
interface QuestDelta {
  description: string;
  before: number;
  after: number;
  target: number;
  delta: number;
}

function computeQuestDeltas(preSnap: Array<{ id: string; progress: number }>): QuestDelta[] {
  const pool = getQuestPool();
  if (!pool) return [];
  const snapMap = new Map(preSnap.map(q => [q.id, q.progress]));
  return pool.activeQuests
    .filter(q => !q.claimed && q.progress > (snapMap.get(q.id) ?? q.progress - 1))
    .map(q => ({
      description: q.description,
      before: snapMap.get(q.id) ?? 0,
      after: q.progress,
      target: q.target,
      delta: q.progress - (snapMap.get(q.id) ?? 0),
    }))
    .filter(d => d.delta > 0)
    .slice(0, 4);
}

// ── Small stat chip ─────────────────────────────────────────────────────────
function StatChip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(255,255,255,0.07)",
      border: `1px solid ${color}44`,
      borderRadius: 12, padding: "9px 14px",
      boxShadow: `0 0 14px ${color}22`,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      </div>
    </div>
  );
}

// ── One brawler column in the team split ────────────────────────────────────
function ParticipantCard({
  p, size, highlight, revealed,
}: {
  p: GameParticipant;
  size: number;
  highlight?: boolean;
  revealed: boolean;
}) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}
    >
      {highlight && (
        <div style={{
          background: "linear-gradient(90deg, #ffd700, #ffab40)",
          borderRadius: 6, padding: "2px 10px",
          fontSize: 11, fontWeight: 900, letterSpacing: 1.5,
          color: "#1a0000", marginBottom: 4,
        }}>
          ★ ЛИДЕР
        </div>
      )}
      <div style={{
        borderRadius: 16,
        border: highlight ? "3px solid #ffd700" : "2px solid rgba(255,255,255,0.12)",
        boxShadow: highlight ? "0 0 28px #ffd70088" : "none",
        overflow: "hidden", background: "rgba(0,0,0,0.25)",
        width: size, height: size,
      }}>
        <BrawlerResultCanvas
          brawlerId={p.brawlerId}
          size={size}
          team={p.team === "blue" ? "blue" : "red"}
        />
      </div>
      <div style={{ marginTop: 6, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px #000" }}>
          {p.displayName}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 3, justifyContent: "center" }}>
          <span style={{ fontSize: 12, color: "#ffd700", fontWeight: 700 }}>🏆 {p.trophies}</span>
          <span style={{ fontSize: 12, color: "#80d8ff", fontWeight: 700 }}>⚡{p.level}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ResultScreen({
  won, mode, participants, result, matchStats, preQuestSnapshot, onExit, onPlayAgain,
}: ResultScreenProps) {
  const [phase, setPhase] = useState<1 | 2>(1);
  const [revealed, setRevealed] = useState(false);
  const [phase2In, setPhase2In] = useState(false);
  const [questDeltas, setQuestDeltas] = useState<QuestDelta[]>([]);

  const isTeam = isTeamMode(mode);
  const blueTeam = participants.filter(p => p.team === "blue").slice(0, 3);
  const redTeam = participants.filter(p => p.team === "red").slice(0, 3);
  const player = participants.find(p => p.isPlayer) || participants[0];
  const allies = blueTeam.filter(p => !p.isPlayer);
  const profile = getCurrentProfile();
  const totalTrophies = profile?.trophies ?? 0;

  // Staggered reveal
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 120);
    return () => clearTimeout(t);
  }, []);

  // Compute quest deltas once on mount
  useEffect(() => {
    setQuestDeltas(computeQuestDeltas(preQuestSnapshot));
  }, []);

  const handleNext = () => {
    setPhase(2);
    setTimeout(() => setPhase2In(true), 50);
  };

  const trophyLabel = result
    ? (result.trophyDelta >= 0 ? `+${result.trophyDelta}` : `${result.trophyDelta}`)
    : "—";
  const trophyColor = result && result.trophyDelta >= 0 ? "#ffd700" : "#ff5252";
  const placeText = mode === "showdown" && result ? `${result.place} место` : "";

  // ── Phase 1 – Team split ─────────────────────────────────────────────────
  if (phase === 1 && isTeam) {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 20, overflow: "hidden", fontFamily: "'Segoe UI', sans-serif" }}>
        {/* Blue half */}
        <div style={{
          position: "absolute", inset: 0, right: "45%",
          background: won
            ? "linear-gradient(170deg, #003a7a 0%, #0050aa 100%)"
            : "linear-gradient(170deg, #1a003a 0%, #250050 100%)",
          clipPath: "polygon(0 0, 100% 0, 85% 100%, 0 100%)",
        }} />
        {/* Red half */}
        <div style={{
          position: "absolute", inset: 0, left: "45%",
          background: !won
            ? "linear-gradient(170deg, #5a0000 0%, #900000 100%)"
            : "linear-gradient(170deg, #3a0000 0%, #550000 100%)",
          clipPath: "polygon(15% 0, 100% 0, 100% 100%, 0 100%)",
        }} />
        {/* BG overlay fade */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />

        {/* Top left – result badge */}
        <div style={{
          position: "absolute", top: 28, left: 36,
          opacity: revealed ? 1 : 0, transform: revealed ? "translateX(0)" : "translateX(-40px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}>
          <div style={{
            fontSize: 52, fontWeight: 900, letterSpacing: 3,
            color: won ? "#ffd700" : "#ff5252",
            textShadow: `0 0 30px ${won ? "#ffd700" : "#ff5252"}, 0 2px 0 #000`,
            lineHeight: 1,
          }}>
            {won ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}
          </div>
          <div style={{
            fontSize: 28, fontWeight: 800, color: trophyColor,
            textShadow: `0 0 16px ${trophyColor}`,
            marginTop: 6,
          }}>
            🏆 {trophyLabel}
          </div>
        </div>

        {/* Team labels */}
        <div style={{ position: "absolute", top: 90, left: "4%", color: "#82b1ff", fontWeight: 800, fontSize: 13, letterSpacing: 2, opacity: 0.7 }}>
          СИНЯЯ КОМАНДА
        </div>
        <div style={{ position: "absolute", top: 90, right: "4%", color: "#ff8a80", fontWeight: 800, fontSize: 13, letterSpacing: 2, opacity: 0.7 }}>
          КРАСНАЯ КОМАНДА
        </div>

        {/* Blue team row */}
        <div style={{
          position: "absolute", bottom: "18%", left: 0, width: "48%",
          display: "flex", justifyContent: "space-evenly", alignItems: "flex-end",
          paddingLeft: 20,
        }}>
          {blueTeam.map((p, i) => (
            <ParticipantCard
              key={p.brawlerId + i}
              p={p}
              size={150}
              highlight={p.isPlayer && won}
              revealed={revealed}
            />
          ))}
        </div>

        {/* Red team row */}
        <div style={{
          position: "absolute", bottom: "18%", right: 0, width: "48%",
          display: "flex", justifyContent: "space-evenly", alignItems: "flex-end",
          paddingRight: 20,
        }}>
          {redTeam.map((p, i) => (
            <ParticipantCard
              key={p.brawlerId + i}
              p={p}
              size={150}
              revealed={revealed}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          style={{
            position: "absolute", bottom: 30, right: 36,
            background: "linear-gradient(135deg, #ffd700, #ff9800)",
            border: "none", borderRadius: 14, padding: "14px 40px",
            color: "#1a0800", fontWeight: 900, fontSize: 18, letterSpacing: 2,
            cursor: "pointer", boxShadow: "0 6px 24px rgba(255,180,0,0.5)",
            opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s",
          }}
        >
          ДАЛЕЕ ›
        </button>

        <style>{`
          @keyframes slideInLeft { from { opacity:0; transform: translateX(-40px); } to { opacity:1; transform: none; } }
        `}</style>
      </div>
    );
  }

  // ── Phase 1 – Showdown / training (solo) ─────────────────────────────────
  if (phase === 1 && !isTeam) {
    return (
      <div style={{
        position: "absolute", inset: 0, zIndex: 20, overflow: "hidden",
        background: won
          ? "radial-gradient(ellipse at 50% 40%, #003a70 0%, #001030 100%)"
          : "radial-gradient(ellipse at 50% 40%, #3a0000 0%, #100008 100%)",
        fontFamily: "'Segoe UI', sans-serif",
      }}>
        {/* Glow orb behind brawler */}
        <div style={{
          position: "absolute", left: "50%", top: "38%", width: 280, height: 280,
          borderRadius: "50%", transform: "translate(-50%, -50%)",
          background: won
            ? "radial-gradient(circle, #40c4ff33 0%, transparent 70%)"
            : "radial-gradient(circle, #ff525233 0%, transparent 70%)",
          filter: "blur(20px)",
        }} />

        {/* Top left */}
        <div style={{
          position: "absolute", top: 28, left: 36,
          opacity: revealed ? 1 : 0, transform: revealed ? "none" : "translateX(-30px)",
          transition: "all 0.5s ease",
        }}>
          <div style={{
            fontSize: 52, fontWeight: 900, letterSpacing: 3,
            color: won ? "#ffd700" : "#ff5252",
            textShadow: `0 0 30px ${won ? "#ffd700" : "#ff5252"}`,
          }}>
            {won ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: trophyColor, marginTop: 6 }}>
            🏆 {trophyLabel}
          </div>
        </div>

        {/* Player brawler centered */}
        <div style={{
          position: "absolute", left: "50%", top: "30%", transform: "translate(-50%, 0)",
          opacity: revealed ? 1 : 0, transition: "all 0.5s ease 0.1s",
        }}>
          <BrawlerResultCanvas brawlerId={player.brawlerId} size={240} team="blue" />
        </div>

        {/* Player info below */}
        <div style={{
          position: "absolute", left: "50%", top: "70%", transform: "translateX(-50%)",
          textAlign: "center",
          opacity: revealed ? 1 : 0, transition: "all 0.5s ease 0.2s",
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{player.displayName}</div>
          <div style={{ display: "flex", gap: 16, marginTop: 6, justifyContent: "center" }}>
            <span style={{ fontSize: 16, color: "#ffd700", fontWeight: 700 }}>🏆 {player.trophies}</span>
            <span style={{ fontSize: 16, color: "#80d8ff", fontWeight: 700 }}>⚡ {player.level}</span>
          </div>
          {placeText && (
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{placeText}</div>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          style={{
            position: "absolute", bottom: 30, right: 36,
            background: "linear-gradient(135deg, #ffd700, #ff9800)",
            border: "none", borderRadius: 14, padding: "14px 40px",
            color: "#1a0800", fontWeight: 900, fontSize: 18, letterSpacing: 2,
            cursor: "pointer", boxShadow: "0 6px 24px rgba(255,180,0,0.5)",
            opacity: revealed ? 1 : 0, transition: "all 0.5s ease 0.4s",
          }}
        >
          ДАЛЕЕ ›
        </button>
      </div>
    );
  }

  // ── Phase 2 – Personal stats ─────────────────────────────────────────────
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20, overflow: "hidden",
      background: won
        ? "radial-gradient(ellipse at 50% 40%, #003a70 0%, #00285a 60%, #001030 100%)"
        : "radial-gradient(ellipse at 50% 40%, #3a0000 0%, #250010 60%, #100008 100%)",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      {/* Subtle glow orb */}
      <div style={{
        position: "absolute", left: "50%", top: "45%", width: 320, height: 320,
        borderRadius: "50%", transform: "translate(-50%,-50%)",
        background: won ? "radial-gradient(#40c4ff22, transparent 70%)" : "radial-gradient(#ff525222, transparent 70%)",
        filter: "blur(30px)",
      }} />

      {/* ── Left ally (dimmed) ──────────────────────────────────────────── */}
      {isTeam && allies[0] && (
        <div style={{
          position: "absolute", left: "3%", bottom: "18%",
          opacity: phase2In ? 0.35 : 0,
          transform: phase2In ? "none" : "translateX(-40px)",
          transition: "all 0.6s ease",
        }}>
          <BrawlerResultCanvas brawlerId={allies[0].brawlerId} size={140} dimmed team="blue" />
          <div style={{ textAlign: "center", marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
            {allies[0].displayName}
          </div>
        </div>
      )}

      {/* ── Right ally (dimmed) ─────────────────────────────────────────── */}
      {isTeam && allies[1] && (
        <div style={{
          position: "absolute", right: "28%", bottom: "18%",
          opacity: phase2In ? 0.35 : 0,
          transform: phase2In ? "none" : "translateX(40px)",
          transition: "all 0.6s ease",
        }}>
          <BrawlerResultCanvas brawlerId={allies[1].brawlerId} size={140} dimmed team="blue" />
          <div style={{ textAlign: "center", marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
            {allies[1].displayName}
          </div>
        </div>
      )}

      {/* ── Player's brawler (center) ───────────────────────────────────── */}
      <div style={{
        position: "absolute",
        left: isTeam ? "30%" : "50%",
        bottom: "14%",
        transform: isTeam ? "translateX(-50%)" : "translateX(-50%)",
        opacity: phase2In ? 1 : 0,
        transition: "all 0.55s ease 0.05s",
      }}>
        <BrawlerResultCanvas brawlerId={player.brawlerId} size={220} team="blue" />
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{player.displayName}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 4, justifyContent: "center" }}>
            <span style={{ fontSize: 14, color: "#ffd700", fontWeight: 700 }}>🏆 {player.trophies}</span>
            <span style={{ fontSize: 14, color: "#80d8ff", fontWeight: 700 }}>⚡ {player.level}</span>
          </div>
        </div>
      </div>

      {/* ── Top left – result badge ──────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 24, left: 28,
        opacity: phase2In ? 1 : 0, transform: phase2In ? "none" : "translateX(-30px)",
        transition: "all 0.5s ease",
      }}>
        <div style={{
          fontSize: 40, fontWeight: 900, letterSpacing: 3,
          color: won ? "#ffd700" : "#ff5252",
          textShadow: `0 0 28px ${won ? "#ffd700" : "#ff5252"}, 0 2px 0 #000`,
        }}>
          {won ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}
        </div>
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26, fontWeight: 900, color: trophyColor, textShadow: `0 0 14px ${trophyColor}` }}>
            🏆 {trophyLabel}
          </span>
          {totalTrophies > 0 && (
            <span style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
              {totalTrophies} всего
            </span>
          )}
        </div>
        {placeText && (
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginTop: 3 }}>{placeText}</div>
        )}
      </div>

      {/* ── Quests panel (bottom left) ──────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 18, left: 20, maxWidth: 280,
        opacity: phase2In ? 1 : 0, transform: phase2In ? "none" : "translateY(30px)",
        transition: "all 0.55s ease 0.15s",
      }}>
        {questDeltas.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
              КВЕСТЫ
            </div>
            {questDeltas.map((qd, i) => (
              <div key={i} style={{
                background: "rgba(255,255,255,0.07)", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                padding: "7px 12px", marginBottom: 5,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 14 }}>🎯</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.3 }}>
                    {qd.description}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: "#ffd700", fontWeight: 700 }}>
                      {qd.after}/{qd.target}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: "#4caf50",
                      background: "#4caf5022", borderRadius: 4, padding: "1px 5px",
                    }}>
                      +{qd.delta}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Stats panel (right) ─────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: "50%", right: 24,
        transform: phase2In ? "translateY(-50%)" : "translateY(-50%) translateX(60px)",
        opacity: phase2In ? 1 : 0, transition: "all 0.55s ease 0.1s",
        width: 210,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
          БОЙ
        </div>
        <StatChip icon="⚔️" label="Урон" value={formatNum(matchStats.damageDealt)} color="#ff7043" />
        <StatChip icon="💚" label="Лечение" value={formatNum(matchStats.healingDone)} color="#66bb6a" />
        <StatChip icon="💀" label="Убийства" value={String(matchStats.killCount)} color="#ef5350" />
        <StatChip icon="⚡" label="Суперспособность" value={String(matchStats.superUses)} color="#ffd700" />
        <StatChip icon="🪙" label="Монеты" value={`+${won ? 100 : 40}`} color="#ffd700" />
        {result && (
          <StatChip icon="⭐" label="Опыт" value={`+${result.xpGained}`} color="#ce93d8" />
        )}
      </div>

      {/* ── Bottom right – action buttons ───────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 24, right: 24,
        display: "flex", gap: 14,
        opacity: phase2In ? 1 : 0, transform: phase2In ? "none" : "translateY(20px)",
        transition: "all 0.5s ease 0.3s",
      }}>
        <button
          onClick={onExit}
          style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: 12, padding: "12px 28px", color: "#fff",
            fontWeight: 800, fontSize: 15, letterSpacing: 1.5, cursor: "pointer",
          }}
        >
          ВЫЙТИ
        </button>
        <button
          onClick={onPlayAgain}
          style={{
            background: "linear-gradient(135deg, #7b2fbe, #ce93d8)",
            border: "none", borderRadius: 12, padding: "12px 28px", color: "#fff",
            fontWeight: 800, fontSize: 15, letterSpacing: 1.5, cursor: "pointer",
            boxShadow: "0 6px 20px rgba(123,47,190,0.5)",
          }}
        >
          ЕЩЁ РАЗ ↺
        </button>
      </div>
    </div>
  );
}
