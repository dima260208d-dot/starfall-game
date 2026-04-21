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
  createdAt: number;
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

export function getCurrentProfile(): UserProfile | null {
  const username = getCurrentUsername();
  if (!username) return null;
  const profiles = getAllProfiles();
  return profiles[username] || null;
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
  const newProfile: UserProfile = {
    username,
    passwordHash: simpleHash(password),
    coins: 500,
    gems: 50,
    powerPoints: 10,
    brawlerLevels: {
      miya: 1, kibo: 1, ronin: 1, yuki: 1, kenji: 1,
      hana: 1, goro: 1, sora: 1, rin: 1, taro: 1
    },
    brawlerSkins: {},
    lastDailyBonus: 0,
    totalGamesPlayed: 0,
    totalWins: 0,
    createdAt: Date.now(),
  };
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
  profiles[guestName] = {
    username: guestName,
    passwordHash: "",
    coins: 200,
    gems: 10,
    powerPoints: 5,
    brawlerLevels: {
      miya: 1, kibo: 1, ronin: 1, yuki: 1, kenji: 1,
      hana: 1, goro: 1, sora: 1, rin: 1, taro: 1
    },
    brawlerSkins: {},
    lastDailyBonus: 0,
    totalGamesPlayed: 0,
    totalWins: 0,
    createdAt: Date.now(),
  };
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

export function recordGameResult(won: boolean, mode: string): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  const coinsEarned = won ? 100 : 40;
  const ppBonus = (won && mode === "crystals") ? 1 : 0;
  updateProfile({
    totalGamesPlayed: profile.totalGamesPlayed + 1,
    totalWins: won ? profile.totalWins + 1 : profile.totalWins,
    coins: profile.coins + coinsEarned,
    powerPoints: profile.powerPoints + ppBonus,
  });
}
