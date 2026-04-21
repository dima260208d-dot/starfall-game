// =========================================================================
// CHESTS — 6 rarity tiers, each with unique visuals, drop tables, and prices
// =========================================================================

export type ChestRarity = "common" | "rare" | "epic" | "mega" | "legendary" | "mythic";

export interface ChestDef {
  rarity: ChestRarity;
  name: string;
  shortName: string;       // single word for tight UI
  tier: number;            // 1..6
  color: string;           // primary glow / accents
  secondaryColor: string;  // gradient secondary
  borderColor: string;
  description: string;
  priceCoins: number;
  priceGems: number;       // optional alternate price (gems)
  drops: ChestDropDef;
  emoji: string;           // fallback / hero emoji
}

export interface ChestDropDef {
  // Number of "items" that pop out when opened (visual + actual rolls)
  rolls: number;
  // Possible reward types and ranges per roll
  coinsRange: [number, number];
  gemsChance: number;        // 0..1 chance per roll
  gemsRange: [number, number];
  powerPointsChance: number;
  powerPointsRange: [number, number];
  // Bonus guaranteed rewards
  bonusGems?: number;
  bonusPowerPoints?: number;
  bonusCoins?: number;
}

export const CHESTS: Record<ChestRarity, ChestDef> = {
  common: {
    rarity: "common",
    name: "Обычный сундук",
    shortName: "Обычный",
    tier: 1,
    color: "#9E9E9E",
    secondaryColor: "#616161",
    borderColor: "#BDBDBD",
    description: "Немного монет и пара очков прокачки.",
    priceCoins: 100,
    priceGems: 5,
    emoji: "📦",
    drops: {
      rolls: 2,
      coinsRange: [40, 100],
      gemsChance: 0.05,
      gemsRange: [1, 2],
      powerPointsChance: 0.4,
      powerPointsRange: [1, 3],
    },
  },
  rare: {
    rarity: "rare",
    name: "Редкий сундук",
    shortName: "Редкий",
    tier: 2,
    color: "#4FC3F7",
    secondaryColor: "#0288D1",
    borderColor: "#81D4FA",
    description: "Гарантированы очки прокачки и шанс на кристаллы.",
    priceCoins: 250,
    priceGems: 12,
    emoji: "🎁",
    drops: {
      rolls: 3,
      coinsRange: [80, 180],
      gemsChance: 0.18,
      gemsRange: [2, 5],
      powerPointsChance: 0.7,
      powerPointsRange: [2, 6],
      bonusPowerPoints: 2,
    },
  },
  epic: {
    rarity: "epic",
    name: "Эпический сундук",
    shortName: "Эпический",
    tier: 3,
    color: "#BA68C8",
    secondaryColor: "#7B1FA2",
    borderColor: "#CE93D8",
    description: "Хороший куш монет, очков прокачки и кристаллов.",
    priceCoins: 600,
    priceGems: 25,
    emoji: "💎",
    drops: {
      rolls: 4,
      coinsRange: [150, 320],
      gemsChance: 0.4,
      gemsRange: [3, 8],
      powerPointsChance: 0.85,
      powerPointsRange: [3, 8],
      bonusGems: 3,
      bonusPowerPoints: 4,
    },
  },
  mega: {
    rarity: "mega",
    name: "Мега-сундук",
    shortName: "Мега",
    tier: 4,
    color: "#FFB300",
    secondaryColor: "#E65100",
    borderColor: "#FFD54F",
    description: "Мощный набор: куча монет, очков и кристаллов.",
    priceCoins: 1500,
    priceGems: 50,
    emoji: "🏆",
    drops: {
      rolls: 5,
      coinsRange: [250, 500],
      gemsChance: 0.7,
      gemsRange: [5, 12],
      powerPointsChance: 1,
      powerPointsRange: [5, 12],
      bonusGems: 8,
      bonusPowerPoints: 8,
      bonusCoins: 200,
    },
  },
  legendary: {
    rarity: "legendary",
    name: "Легендарный сундук",
    shortName: "Легендарный",
    tier: 5,
    color: "#FF6E40",
    secondaryColor: "#BF360C",
    borderColor: "#FF9E80",
    description: "Гарантированный мега-куш кристаллов.",
    priceCoins: 4000,
    priceGems: 110,
    emoji: "👑",
    drops: {
      rolls: 6,
      coinsRange: [400, 800],
      gemsChance: 1,
      gemsRange: [8, 18],
      powerPointsChance: 1,
      powerPointsRange: [8, 18],
      bonusGems: 20,
      bonusPowerPoints: 15,
      bonusCoins: 500,
    },
  },
  mythic: {
    rarity: "mythic",
    name: "Мифический сундук",
    shortName: "Мифический",
    tier: 6,
    color: "#FF1744",
    secondaryColor: "#7B2FBE",
    borderColor: "#FF80AB",
    description: "Высшая редкость. Невероятный куш всего!",
    priceCoins: 10000,
    priceGems: 250,
    emoji: "🌌",
    drops: {
      rolls: 8,
      coinsRange: [800, 1500],
      gemsChance: 1,
      gemsRange: [15, 30],
      powerPointsChance: 1,
      powerPointsRange: [12, 25],
      bonusGems: 50,
      bonusPowerPoints: 30,
      bonusCoins: 1500,
    },
  },
};

export const CHEST_RARITY_ORDER: ChestRarity[] = [
  "common", "rare", "epic", "mega", "legendary", "mythic",
];

export interface ChestRoll {
  type: "coins" | "gems" | "powerPoints" | "brawler";
  amount: number;
  brawlerId?: string;       // when type === "brawler"
}

function randInt(a: number, b: number): number {
  return Math.floor(a + Math.random() * (b - a + 1));
}

export function rollChestRewards(rarity: ChestRarity): ChestRoll[] {
  const def = CHESTS[rarity];
  const drops = def.drops;
  const out: ChestRoll[] = [];

  for (let i = 0; i < drops.rolls; i++) {
    // Each roll: roll one type
    const rollType = Math.random();
    if (rollType < drops.gemsChance) {
      out.push({ type: "gems", amount: randInt(drops.gemsRange[0], drops.gemsRange[1]) });
    } else if (rollType < drops.gemsChance + drops.powerPointsChance) {
      out.push({ type: "powerPoints", amount: randInt(drops.powerPointsRange[0], drops.powerPointsRange[1]) });
    } else {
      out.push({ type: "coins", amount: randInt(drops.coinsRange[0], drops.coinsRange[1]) });
    }
  }

  if (drops.bonusCoins)        out.push({ type: "coins",        amount: drops.bonusCoins });
  if (drops.bonusGems)         out.push({ type: "gems",         amount: drops.bonusGems });
  if (drops.bonusPowerPoints)  out.push({ type: "powerPoints",  amount: drops.bonusPowerPoints });

  return out;
}

export function summarizeRolls(rolls: ChestRoll[]): { coins: number; gems: number; powerPoints: number } {
  const sum = { coins: 0, gems: 0, powerPoints: 0 };
  for (const r of rolls) {
    if (r.type === "coins" || r.type === "gems" || r.type === "powerPoints") {
      sum[r.type] += r.amount;
    }
  }
  return sum;
}
