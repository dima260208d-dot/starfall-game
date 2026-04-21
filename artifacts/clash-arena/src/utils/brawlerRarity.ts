import type { ChestRarity } from "./chests";
import { CHEST_RARITY_ORDER } from "./chests";

export const BRAWLER_RARITY: Record<string, ChestRarity> = {
  kibo:  "common",
  taro:  "common",
  rin:   "rare",
  kenji: "rare",
  yuki:  "epic",
  hana:  "epic",
  goro:  "mega",
  sora:  "mega",
  ronin: "legendary",
  miya:  "mythic",
};

export const BRAWLER_GEM_COST: Record<ChestRarity, number> = {
  common:    30,
  rare:      80,
  epic:      160,
  mega:      350,
  legendary: 750,
  mythic:    1500,
};

export const RARITY_LABEL: Record<ChestRarity, string> = {
  common:    "ОБЫЧНЫЙ",
  rare:      "РЕДКИЙ",
  epic:      "ЭПИЧЕСКИЙ",
  mega:      "МЕГА",
  legendary: "ЛЕГЕНДАРНЫЙ",
  mythic:    "МИФИЧЕСКИЙ",
};

export const RARITY_COLOR: Record<ChestRarity, string> = {
  common:    "#9E9E9E",
  rare:      "#4FC3F7",
  epic:      "#BA68C8",
  mega:      "#FFB300",
  legendary: "#FF6E40",
  mythic:    "#FF1744",
};

export function rarityRank(r: ChestRarity): number {
  return CHEST_RARITY_ORDER.indexOf(r);
}

export function getBrawlerRarity(id: string): ChestRarity {
  return BRAWLER_RARITY[id] || "common";
}

// Probability that a single chest opening drops a brawler.
// Higher tier chests = higher chance.
export const CHEST_BRAWLER_DROP_CHANCE: Record<ChestRarity, number> = {
  common:    0.08,
  rare:      0.14,
  epic:      0.22,
  mega:      0.34,
  legendary: 0.55,
  mythic:    0.85,
};

/**
 * Pick a random locked brawler whose rarity is the same or LOWER than the chest.
 * Returns null if the player has unlocked everything in that range.
 */
export function rollBrawlerFromChest(
  chestRarity: ChestRarity,
  unlocked: string[],
  allBrawlerIds: string[],
): string | null {
  if (Math.random() >= CHEST_BRAWLER_DROP_CHANCE[chestRarity]) return null;
  const cap = rarityRank(chestRarity);
  const owned = new Set(unlocked);
  const candidates = allBrawlerIds.filter(id => {
    if (owned.has(id)) return false;
    const r = getBrawlerRarity(id);
    return rarityRank(r) <= cap;
  });
  if (candidates.length === 0) return null;
  // Weight: rarer brawlers are less likely even when in the pool.
  const weights = candidates.map(id => {
    const rIdx = rarityRank(getBrawlerRarity(id));
    return Math.max(1, 6 - rIdx);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// Conversion rates for the gem-fallback upgrade
export const GEM_PER_COINS = 50;       // 1 gem = 50 coins
export const GEM_PER_POWER_POINTS = 2; // 1 gem = 2 power points

export function gemsToCoverShortfall(
  needCoins: number, haveCoins: number,
  needPP: number, havePP: number,
): number {
  const missingCoins = Math.max(0, needCoins - haveCoins);
  const missingPP = Math.max(0, needPP - havePP);
  return Math.ceil(missingCoins / GEM_PER_COINS) + Math.ceil(missingPP / GEM_PER_POWER_POINTS);
}
