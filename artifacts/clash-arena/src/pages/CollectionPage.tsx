import { useState, useMemo } from "react";
import { BRAWLERS, BRAWLER_RARITY_LABEL, getScaledStats } from "../entities/BrawlerData";
import { CHESTS } from "../utils/chests";
import {
  getCurrentProfile, upgradeBrawler,
  getBrawlerTrophies, getBrawlerRank,
  getUnclaimedBrawlerRankCount,
  BRAWLER_RANK_TABLE, MAX_BRAWLER_RANK,
} from "../utils/localStorageAPI";
import BrawlerViewer3D from "../components/BrawlerViewer3D";
import BrawlerRankRewardsModal from "../components/BrawlerRankRewardsModal";
import { sortBrawlers, type BrawlerSortKey } from "./CharacterSelect";
import { CoinIcon, PowerIcon } from "../components/GameIcons";

interface CollectionPageProps {
  onBack: () => void;
}

const COLLECTION_SORT_OPTIONS: { key: BrawlerSortKey; label: string }[] = [
  { key: "rarity", label: "По редкости" },
  { key: "level",  label: "По уровню" },
  { key: "name",   label: "По имени" },
  { key: "hp",     label: "По здоровью" },
  { key: "damage", label: "По урону" },
  { key: "speed",  label: "По скорости" },
  { key: "range",  label: "По дальности" },
];

export default function CollectionPage({ onBack }: CollectionPageProps) {
  const [profile, setProfile] = useState(getCurrentProfile());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<BrawlerSortKey>("rarity");
  const [msg, setMsg] = useState("");
  const [rankModalBrawlerId, setRankModalBrawlerId] = useState<string | null>(null);

  const ownedSorted = useMemo(() => {
    if (!profile) return [];
    const owned = BRAWLERS.filter(b => profile.unlockedBrawlers.includes(b.id));
    return sortBrawlers(owned, sortKey, profile.brawlerLevels);
  }, [profile, sortKey]);

  // Default selection: first in sorted list, or keep current if still owned.
  const activeId = selectedId && ownedSorted.some(b => b.id === selectedId)
    ? selectedId
    : (ownedSorted[0]?.id ?? null);

  if (!profile || ownedSorted.length === 0 || !activeId) {
    return (
      <div style={{
        minHeight: "100%",
        background: "linear-gradient(135deg, #050020 0%, #0a0040 100%)",
        color: "white", display: "flex", flexDirection: "column",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "7px 16px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← Назад</button>
          <h2 style={{ flex: 1, textAlign: "center", margin: 0, fontSize: 22, fontWeight: 800, color: "#CE93D8" }}>Коллекция</h2>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 72 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>В коллекции пока никого нет</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", maxWidth: 420 }}>
            Открывайте сундуки и покупайте бойцов в магазине, чтобы пополнить коллекцию.
          </div>
        </div>
      </div>
    );
  }

  const brawler = BRAWLERS.find(b => b.id === activeId)!;

  const handleUpgrade = () => {
    const result = upgradeBrawler(brawler.id);
    if (result.success) {
      setProfile(getCurrentProfile());
      setMsg("Уровень повышен!");
    } else {
      setMsg(result.error || "Невозможно улучшить");
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const level = profile.brawlerLevels[brawler.id] || 1;
  const scaled = getScaledStats(brawler, level);
  const nextScaled = level < 10 ? getScaledStats(brawler, level + 1) : null;
  const upgradeCost = { coins: 100 * level, pp: 5 * level };
  const canUpgrade = level < 10 && profile.coins >= upgradeCost.coins && profile.powerPoints >= upgradeCost.pp;

  const trophies = getBrawlerTrophies(profile, brawler.id);
  const rank = getBrawlerRank(trophies);
  const unclaimed = getUnclaimedBrawlerRankCount(profile, brawler.id);
  const nextReward = rank < MAX_BRAWLER_RANK ? BRAWLER_RANK_TABLE[rank] : null;
  const trophiesIntoNext = nextReward
    ? Math.max(0, trophies - (rank > 0 ? BRAWLER_RANK_TABLE[rank - 1].trophies : 0))
    : 0;
  const trophiesNeededForNext = nextReward
    ? nextReward.trophies - (rank > 0 ? BRAWLER_RANK_TABLE[rank - 1].trophies : 0)
    : 0;

  return (
    <div
      style={{
        height: "100%",
        background: "linear-gradient(135deg, #050020 0%, #0a0040 100%)",
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
        <div style={{ display: "flex", gap: 14, fontSize: 14, alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#FFD700" }}><CoinIcon size={18} /> {profile?.coins || 0}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#CE93D8" }}><PowerIcon size={18} /> {profile?.powerPoints || 0}</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <div style={{ width: 280, display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.06)", minHeight: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <label style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 700, letterSpacing: 2, display: "block", marginBottom: 5 }}>
              СОРТИРОВКА ({ownedSorted.length})
            </label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as BrawlerSortKey)}
              style={{
                width: "100%", background: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 8, padding: "7px 10px",
                color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              {COLLECTION_SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key} style={{ background: "#0a0040" }}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14, minHeight: 0 }}>
            {ownedSorted.map((b) => {
              const lv = profile.brawlerLevels[b.id] || 1;
              const isSelected = b.id === activeId;
              const rarityColor = CHESTS[b.rarity].borderColor;
              const bTrophies = getBrawlerTrophies(profile, b.id);
              const bRank = getBrawlerRank(bTrophies);
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
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
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0, width: 48, height: 48 }}>
                    <img
                      src={`${import.meta.env.BASE_URL}brawlers/${b.id}_front.png`}
                      alt={b.name}
                      width={48}
                      height={48}
                      style={{
                        borderRadius: 8,
                        background: `radial-gradient(circle at 50% 60%, ${b.color}40, ${b.color}10 70%, transparent)`,
                        objectFit: "contain",
                        objectPosition: "center bottom",
                        filter: `drop-shadow(0 2px 4px ${b.color}80)`,
                      }}
                    />
                    <div
                      onClick={(e) => { e.stopPropagation(); setRankModalBrawlerId(b.id); }}
                      title="Награды за ранги"
                      style={{
                        position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
                        background: "linear-gradient(135deg, #F9A825, #FFD700)",
                        color: "#000",
                        fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                        borderRadius: 6, padding: "1px 6px",
                        border: "1px solid rgba(0,0,0,0.4)",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                        minWidth: 16, textAlign: "center", whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                    >Р{bRank}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? b.color : "white" }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>УР {lv} • 🏆 {bTrophies}</div>
                  </div>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 1,
                    background: rarityColor, color: "white",
                    borderRadius: 6, padding: "2px 6px",
                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  }}>{BRAWLER_RARITY_LABEL[b.rarity]}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "stretch", padding: "24px 30px", overflowY: "auto", minHeight: 0, gap: 24 }}>
          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <BrawlerViewer3D brawlerId={brawler.id} color={brawler.color} size={320} />
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <div style={{ fontSize: 32, fontWeight: 900, color: brawler.color }}>{brawler.name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: 2 }}>{brawler.role.toUpperCase()} • УРОВЕНЬ {level} / 10</div>
              <button
                onClick={() => setRankModalBrawlerId(brawler.id)}
                style={{
                  marginTop: 12,
                  position: "relative",
                  background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(206,147,216,0.18))",
                  border: "1px solid rgba(255,215,0,0.5)",
                  borderRadius: 12,
                  padding: "10px 18px",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span style={{ color: "#FFD700", fontSize: 18 }}>🏆</span>
                <span>{trophies} кубков</span>
                <span style={{
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 6,
                  padding: "2px 8px",
                  fontSize: 11,
                  letterSpacing: 1,
                }}>РАНГ {rank} / {MAX_BRAWLER_RANK}</span>
                {unclaimed > 0 && (
                  <span style={{
                    position: "absolute",
                    top: -8, right: -8,
                    minWidth: 22, height: 22,
                    borderRadius: 11,
                    background: "#FF3D00",
                    color: "white",
                    fontSize: 12,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 6px",
                    boxShadow: "0 0 0 2px rgba(255,61,0,0.35), 0 0 14px 2px rgba(255,61,0,0.85)",
                    animation: "rankBadgePulse 1.4s ease-in-out infinite",
                  }}>{unclaimed}</span>
                )}
              </button>
              {nextReward && (
                <div style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                  До ранга {rank + 1}: {Math.min(trophiesIntoNext, trophiesNeededForNext)} / {trophiesNeededForNext}
                </div>
              )}
            </div>
          </div>
          <style>{`
            @keyframes rankBadgePulse {
              0%, 100% { transform: scale(1); box-shadow: 0 0 0 2px rgba(255,61,0,0.35), 0 0 14px 2px rgba(255,61,0,0.85); }
              50% { transform: scale(1.12); box-shadow: 0 0 0 3px rgba(255,61,0,0.45), 0 0 22px 4px rgba(255,61,0,1); }
            }
          `}</style>

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

            {level < 10 ? (
              <div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "wrap" }}>
                  Улучшить до ур. {level + 1}: <CoinIcon size={14} /> {upgradeCost.coins} + <PowerIcon size={14} /> {upgradeCost.pp}
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
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  {canUpgrade ? <>УЛУЧШИТЬ</> : <><CoinIcon size={14} /> {upgradeCost.coins} + <PowerIcon size={14} /> {upgradeCost.pp}</>}
                </button>
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

      {rankModalBrawlerId && (
        <BrawlerRankRewardsModal
          brawlerId={rankModalBrawlerId}
          onClose={() => { setRankModalBrawlerId(null); setProfile(getCurrentProfile()); }}
        />
      )}
    </div>
  );
}
