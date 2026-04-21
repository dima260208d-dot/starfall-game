export interface UserProfile {
  username: string;
  passwordHash: string;
  coins: number;
  gems: number;
  powerPoints: number;
  brawlerLevels: Record<string, number>;
  brawlerSkins: Record<string, string[]>;
  lastDailyBonus: number;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  trophies: number;
  xp: number;
  clashPassLevel: number;
  clashPassClaimed: number[];
  trophyRoadClaimed: number[];
  modeStats: Record<string, { games: number; wins: number; losses: number }>;
  favoriteBrawlerId: string;
  selectedBrawlerId: string;
  selectedMode: string;
  lastResult?: { place: number; trophyDelta: number; xpGained: number; mode: string; won: boolean };
  createdAt: number;
}

export const MAX_TROPHIES = 10000;
export const MAX_CLASHPASS_LEVEL = 50;
export const RENAME_GEM_COST = 50;

export function clashPassXpForLevel(level: number): number {
  if (level <= 1) return 150;
  if (level >= MAX_CLASHPASS_LEVEL) return 1000;
  // Linear from 150 (lvl 1->2) up to 1000 (lvl 49->50)
  return Math.round(150 + ((level - 1) / (MAX_CLASHPASS_LEVEL - 2)) * (1000 - 150));
}

export interface TrophyRoadReward {
  trophies: number;
  type: "coins" | "gems" | "powerPoints" | "brawler";
  amount: number;
  label: string;
}

export const TROPHY_ROAD: TrophyRoadReward[] = [
  { trophies: 10,   type: "coins",       amount: 50,  label: "50 монет" },
  { trophies: 25,   type: "powerPoints", amount: 5,   label: "5 очков" },
  { trophies: 50,   type: "gems",        amount: 5,   label: "5 кристаллов" },
  { trophies: 100,  type: "coins",       amount: 150, label: "150 монет" },
  { trophies: 200,  type: "powerPoints", amount: 10,  label: "10 очков" },
  { trophies: 350,  type: "gems",        amount: 15,  label: "15 кристаллов" },
  { trophies: 500,  type: "coins",       amount: 400, label: "400 монет" },
  { trophies: 750,  type: "powerPoints", amount: 20,  label: "20 очков" },
  { trophies: 1000, type: "gems",        amount: 30,  label: "30 кристаллов" },
  { trophies: 1500, type: "coins",       amount: 800, label: "800 монет" },
  { trophies: 2000, type: "gems",        amount: 50,  label: "50 кристаллов" },
  { trophies: 3000, type: "coins",       amount: 1500, label: "1500 монет" },
  { trophies: 4500, type: "gems",        amount: 80,  label: "80 кристаллов" },
  { trophies: 6000, type: "coins",       amount: 3000, label: "3000 монет" },
  { trophies: 8000, type: "gems",        amount: 150, label: "150 кристаллов" },
  { trophies: 10000, type: "gems",       amount: 500, label: "500 кристаллов" },
];

export interface ClashPassReward {
  type: "coins" | "gems" | "powerPoints";
  amount: number;
  label: string;
}

export function clashPassRewardForLevel(level: number): ClashPassReward {
  // Pattern of rewards: alternate coins, powerPoints, gems with scaling amounts
  const tier = Math.floor((level - 1) / 5); // 0..9
  const pos = (level - 1) % 5;
  if (pos === 4) {
    // Big reward every 5th level — gems
    return { type: "gems", amount: 10 + tier * 10, label: `${10 + tier * 10} кристаллов` };
  }
  if (pos === 2) {
    return { type: "powerPoints", amount: 5 + tier * 3, label: `${5 + tier * 3} очков прокачки` };
  }
  const coins = 50 + tier * 50 + pos * 25;
  return { type: "coins", amount: coins, label: `${coins} монет` };
}

const PROFILES_KEY = "clashArena_profiles";
const CURRENT_USER_KEY = "clashArena_currentUser";

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}

export function getAllProfiles(): Record<string, UserProfile> {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveProfiles(profiles: Record<string, UserProfile>): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function getCurrentUsername(): string | null {
  return localStorage.getItem(CURRENT_USER_KEY);
}

export function setCurrentUsername(username: string | null): void {
  if (username === null) {
    localStorage.removeItem(CURRENT_USER_KEY);
  } else {
    localStorage.setItem(CURRENT_USER_KEY, username);
  }
}

function normalizeProfile(p: UserProfile): UserProfile {
  const defaultLevels = { miya: 1, kibo: 1, ronin: 1, yuki: 1, kenji: 1, hana: 1, goro: 1, sora: 1, rin: 1, taro: 1 };
  return {
    username: p.username,
    passwordHash: p.passwordHash || "",
    coins: p.coins ?? 500,
    gems: p.gems ?? 50,
    powerPoints: p.powerPoints ?? 10,
    brawlerLevels: { ...defaultLevels, ...(p.brawlerLevels || {}) },
    brawlerSkins: p.brawlerSkins || {},
    lastDailyBonus: p.lastDailyBonus ?? 0,
    totalGamesPlayed: p.totalGamesPlayed ?? 0,
    totalWins: p.totalWins ?? 0,
    totalLosses: p.totalLosses ?? 0,
    trophies: p.trophies ?? 0,
    xp: p.xp ?? 0,
    clashPassLevel: p.clashPassLevel ?? 1,
    clashPassClaimed: p.clashPassClaimed || [],
    trophyRoadClaimed: p.trophyRoadClaimed || [],
    modeStats: p.modeStats || {},
    favoriteBrawlerId: p.favoriteBrawlerId || "miya",
    selectedBrawlerId: p.selectedBrawlerId || "miya",
    selectedMode: p.selectedMode || "showdown",
    lastResult: p.lastResult,
    createdAt: p.createdAt || Date.now(),
  };
}

export function getCurrentProfile(): UserProfile | null {
  const username = getCurrentUsername();
  if (!username) return null;
  const profiles = getAllProfiles();
  const raw = profiles[username];
  if (!raw) return null;
  return normalizeProfile(raw);
}

export function createProfile(username: string, password: string): { success: boolean; error?: string } {
  if (!username.trim() || username.length < 2) {
    return { success: false, error: "Username must be at least 2 characters" };
  }
  if (!password || password.length < 3) {
    return { success: false, error: "Password must be at least 3 characters" };
  }
  const profiles = getAllProfiles();
  if (profiles[username]) {
    return { success: false, error: "Username already taken" };
  }
  const newProfile: UserProfile = normalizeProfile({
    username,
    passwordHash: simpleHash(password),
    createdAt: Date.now(),
  } as UserProfile);
  profiles[username] = newProfile;
  saveProfiles(profiles);
  setCurrentUsername(username);
  return { success: true };
}

export function loginProfile(username: string, password: string): { success: boolean; error?: string } {
  const profiles = getAllProfiles();
  const profile = profiles[username];
  if (!profile) {
    return { success: false, error: "User not found" };
  }
  if (profile.passwordHash !== simpleHash(password)) {
    return { success: false, error: "Wrong password" };
  }
  setCurrentUsername(username);
  return { success: true };
}

export function createGuestProfile(): void {
  const guestName = `Guest_${Math.floor(Math.random() * 9999)}`;
  const profiles = getAllProfiles();
  profiles[guestName] = normalizeProfile({
    username: guestName,
    passwordHash: "",
    coins: 200,
    gems: 10,
    powerPoints: 5,
    createdAt: Date.now(),
  } as UserProfile);
  saveProfiles(profiles);
  setCurrentUsername(guestName);
}

export function updateProfile(updates: Partial<UserProfile>): void {
  const username = getCurrentUsername();
  if (!username) return;
  const profiles = getAllProfiles();
  if (!profiles[username]) return;
  profiles[username] = { ...profiles[username], ...updates };
  saveProfiles(profiles);
}

export function logout(): void {
  setCurrentUsername(null);
}

export function claimDailyBonus(): { success: boolean; coins?: number } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false };
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (now - profile.lastDailyBonus < oneDayMs) {
    return { success: false };
  }
  updateProfile({ coins: profile.coins + 50, lastDailyBonus: now });
  return { success: true, coins: 50 };
}

export function openBox(): { type: string; amount: number } {
  const profile = getCurrentProfile();
  if (!profile || profile.coins < 100) return { type: "error", amount: 0 };
  const roll = Math.random();
  let reward: { type: string; amount: number };
  if (roll < 0.70) {
    const coins = Math.floor(Math.random() * 151) + 50;
    reward = { type: "coins", amount: coins };
    updateProfile({ coins: profile.coins - 100 + coins });
  } else if (roll < 0.95) {
    const pp = Math.floor(Math.random() * 5) + 1;
    reward = { type: "powerPoints", amount: pp };
    updateProfile({ coins: profile.coins - 100, powerPoints: profile.powerPoints + pp });
  } else {
    const gems = Math.floor(Math.random() * 3) + 1;
    reward = { type: "gems", amount: gems };
    updateProfile({ coins: profile.coins - 100, gems: profile.gems + gems });
  }
  return reward;
}

export function upgradeBrawler(id: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  const level = profile.brawlerLevels[id] || 1;
  if (level >= 10) return { success: false, error: "Max level reached" };
  const costCoins = 100 * level;
  const costPP = 5 * level;
  if (profile.coins < costCoins) return { success: false, error: `Need ${costCoins} coins` };
  if (profile.powerPoints < costPP) return { success: false, error: `Need ${costPP} power points` };
  const newLevels = { ...profile.brawlerLevels, [id]: level + 1 };
  updateProfile({
    coins: profile.coins - costCoins,
    powerPoints: profile.powerPoints - costPP,
    brawlerLevels: newLevels,
  });
  return { success: true };
}

export function addCoins(amount: number): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  updateProfile({ coins: profile.coins + amount });
}

export function addGems(amount: number): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  updateProfile({ gems: profile.gems + amount });
}

// Trophy delta by Showdown placement (8 brawlers total)
const SHOWDOWN_TROPHIES = [12, 8, 5, 2, -2, -4, -6, -8];

export function recordGameResult(opts: {
  won: boolean;
  mode: string;
  place?: number; // 1..8 for showdown, 1 or 2 for team modes
  totalPlayers?: number;
}): { trophyDelta: number; xpGained: number; coinsEarned: number; place: number; clashPassUp: boolean } {
  const profile = getCurrentProfile();
  if (!profile) {
    return { trophyDelta: 0, xpGained: 0, coinsEarned: 0, place: 0, clashPassUp: false };
  }
  const { won, mode } = opts;
  const place = opts.place ?? (won ? 1 : 2);
  const totalPlayers = opts.totalPlayers ?? (mode === "showdown" ? 8 : 2);

  // Trophies
  let trophyDelta: number;
  if (mode === "showdown") {
    const idx = Math.max(0, Math.min(SHOWDOWN_TROPHIES.length - 1, place - 1));
    trophyDelta = SHOWDOWN_TROPHIES[idx];
  } else {
    trophyDelta = won ? 8 : -5;
  }
  const newTrophies = Math.max(0, Math.min(MAX_TROPHIES, profile.trophies + trophyDelta));
  const actualDelta = newTrophies - profile.trophies;

  // XP
  let xpGained: number;
  if (mode === "showdown") {
    xpGained = Math.max(8, 50 - (place - 1) * 6);
  } else {
    xpGained = won ? 40 : 12;
  }
  let newXp = profile.xp + xpGained;
  let newLevel = profile.clashPassLevel;
  let clashPassUp = false;
  while (newLevel < MAX_CLASHPASS_LEVEL && newXp >= clashPassXpForLevel(newLevel)) {
    newXp -= clashPassXpForLevel(newLevel);
    newLevel++;
    clashPassUp = true;
  }
  if (newLevel >= MAX_CLASHPASS_LEVEL) newXp = 0;

  // Coins
  const coinsEarned = won ? 100 : 40;
  const ppBonus = (won && mode === "crystals") ? 1 : 0;

  // Mode stats
  const ms = profile.modeStats[mode] || { games: 0, wins: 0, losses: 0 };
  const newModeStats = {
    ...profile.modeStats,
    [mode]: {
      games: ms.games + 1,
      wins: won ? ms.wins + 1 : ms.wins,
      losses: !won ? ms.losses + 1 : ms.losses,
    },
  };

  updateProfile({
    totalGamesPlayed: profile.totalGamesPlayed + 1,
    totalWins: won ? profile.totalWins + 1 : profile.totalWins,
    totalLosses: !won ? profile.totalLosses + 1 : profile.totalLosses,
    coins: profile.coins + coinsEarned,
    powerPoints: profile.powerPoints + ppBonus,
    trophies: newTrophies,
    xp: newXp,
    clashPassLevel: newLevel,
    modeStats: newModeStats,
    lastResult: { place, trophyDelta: actualDelta, xpGained, mode, won },
  });
  return { trophyDelta: actualDelta, xpGained, coinsEarned, place, clashPassUp };
  void totalPlayers;
}

export function setSelectedBrawler(id: string): void {
  updateProfile({ selectedBrawlerId: id });
}

export function setSelectedMode(mode: string): void {
  updateProfile({ selectedMode: mode });
}

export function setFavoriteBrawler(id: string): void {
  updateProfile({ favoriteBrawlerId: id });
}

export function renamePlayer(newName: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  const trimmed = newName.trim();
  if (trimmed.length < 2 || trimmed.length > 16) {
    return { success: false, error: "Имя должно быть 2-16 символов" };
  }
  if (trimmed === profile.username) {
    return { success: false, error: "Это уже ваше имя" };
  }
  if (profile.gems < RENAME_GEM_COST) {
    return { success: false, error: `Нужно ${RENAME_GEM_COST} кристаллов` };
  }
  const profiles = getAllProfiles();
  if (profiles[trimmed]) return { success: false, error: "Имя занято" };
  // Move profile under new key
  delete profiles[profile.username];
  profiles[trimmed] = { ...profile, username: trimmed, gems: profile.gems - RENAME_GEM_COST };
  saveProfiles(profiles);
  setCurrentUsername(trimmed);
  return { success: true };
}

export function claimTrophyRoadReward(idx: number): { success: boolean; reward?: TrophyRoadReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (idx < 0 || idx >= TROPHY_ROAD.length) return { success: false, error: "Неверная награда" };
  const reward = TROPHY_ROAD[idx];
  if (profile.trophies < reward.trophies) return { success: false, error: "Недостаточно кубков" };
  if (profile.trophyRoadClaimed.includes(idx)) return { success: false, error: "Уже получено" };
  const updates: Partial<UserProfile> = {
    trophyRoadClaimed: [...profile.trophyRoadClaimed, idx],
  };
  if (reward.type === "coins") updates.coins = profile.coins + reward.amount;
  else if (reward.type === "gems") updates.gems = profile.gems + reward.amount;
  else if (reward.type === "powerPoints") updates.powerPoints = profile.powerPoints + reward.amount;
  updateProfile(updates);
  return { success: true, reward };
}

export function claimClashPassReward(level: number): { success: boolean; reward?: ClashPassReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (level < 1 || level > MAX_CLASHPASS_LEVEL) return { success: false, error: "Неверный уровень" };
  if (profile.clashPassLevel < level) return { success: false, error: "Уровень не достигнут" };
  if (profile.clashPassClaimed.includes(level)) return { success: false, error: "Уже получено" };
  const reward = clashPassRewardForLevel(level);
  const updates: Partial<UserProfile> = {
    clashPassClaimed: [...profile.clashPassClaimed, level],
  };
  if (reward.type === "coins") updates.coins = profile.coins + reward.amount;
  else if (reward.type === "gems") updates.gems = profile.gems + reward.amount;
  else if (reward.type === "powerPoints") updates.powerPoints = profile.powerPoints + reward.amount;
  updateProfile(updates);
  return { success: true, reward };
}

export function buyXp(xpAmount: number, gemCost: number): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (profile.gems < gemCost) return { success: false, error: "Недостаточно кристаллов" };
  let newXp = profile.xp + xpAmount;
  let newLevel = profile.clashPassLevel;
  while (newLevel < MAX_CLASHPASS_LEVEL && newXp >= clashPassXpForLevel(newLevel)) {
    newXp -= clashPassXpForLevel(newLevel);
    newLevel++;
  }
  if (newLevel >= MAX_CLASHPASS_LEVEL) newXp = 0;
  updateProfile({ gems: profile.gems - gemCost, xp: newXp, clashPassLevel: newLevel });
  return { success: true };
}
