// =========================================================================
// DAILY QUESTS — refresh every 24h, give XP / chests / coins / gems
// =========================================================================

import type { ChestRarity } from "./chests";

export type QuestKind =
  | "play_games"        // Сыграйте N матчей
  | "win_games"         // Победите в N матчах
  | "play_showdown"     // Сыграйте N матчей в "Битве в одиночку"
  | "play_team"         // Сыграйте N матчей в командном режиме
  | "earn_trophies"     // Заработайте N трофеев
  | "open_chests"       // Откройте N сундуков
  | "upgrade_brawler"   // Прокачайте бойца N раз
  | "deal_damage"       // Нанесите N урона (упрощённо)
  | "kill_enemies"      // Убейте N противников
  | "place_top3";       // Попадите в топ-3 в "Битве в одиночку" N раз

export type QuestRewardType = "coins" | "gems" | "powerPoints" | "xp" | "chest";

export interface QuestReward {
  type: QuestRewardType;
  amount: number;
  chestRarity?: ChestRarity;
  label: string;
}

export interface QuestDef {
  id: string;
  kind: QuestKind;
  target: number;
  description: string;        // "Победите в 3 матчах"
  reward: QuestReward;
  difficulty: 1 | 2 | 3;      // easy / medium / hard
}

export interface QuestState {
  id: string;          // unique id within today's set
  kind: QuestKind;
  target: number;
  progress: number;
  description: string;
  reward: QuestReward;
  claimed: boolean;
}

export interface DailyQuestsState {
  generatedAt: number; // unix ms — when this set was generated
  quests: QuestState[];
}

// Pool of quest templates that can be picked from
const QUEST_POOL: Omit<QuestDef, "id">[] = [
  // EASY
  { kind: "play_games",     target: 1, description: "Сыграйте 1 матч",
    reward: { type: "coins", amount: 100, label: "100 монет" }, difficulty: 1 },
  { kind: "play_games",     target: 3, description: "Сыграйте 3 матча",
    reward: { type: "xp", amount: 80, label: "80 опыта Clash Pass" }, difficulty: 1 },
  { kind: "play_showdown",  target: 2, description: "Сыграйте 2 матча в «Битве в одиночку»",
    reward: { type: "powerPoints", amount: 6, label: "6 очков прокачки" }, difficulty: 1 },

  // MEDIUM
  { kind: "win_games",      target: 2, description: "Победите в 2 матчах",
    reward: { type: "chest", amount: 1, chestRarity: "rare", label: "Редкий сундук" }, difficulty: 2 },
  { kind: "win_games",      target: 3, description: "Победите в 3 матчах",
    reward: { type: "xp", amount: 200, label: "200 опыта Clash Pass" }, difficulty: 2 },
  { kind: "earn_trophies",  target: 30, description: "Заработайте 30 трофеев",
    reward: { type: "gems", amount: 12, label: "12 кристаллов" }, difficulty: 2 },
  { kind: "open_chests",    target: 1, description: "Откройте 1 сундук",
    reward: { type: "coins", amount: 250, label: "250 монет" }, difficulty: 2 },
  { kind: "upgrade_brawler", target: 1, description: "Прокачайте любого бойца",
    reward: { type: "powerPoints", amount: 10, label: "10 очков прокачки" }, difficulty: 2 },
  { kind: "play_team",      target: 4, description: "Сыграйте 4 командных матча",
    reward: { type: "xp", amount: 150, label: "150 опыта Clash Pass" }, difficulty: 2 },
  { kind: "play_showdown",  target: 4, description: "Сыграйте 4 матча «Битва в одиночку»",
    reward: { type: "coins", amount: 200, label: "200 монет" }, difficulty: 2 },

  // HARD
  { kind: "place_top3",     target: 2, description: "Попадите в топ-3 «Битвы в одиночку» 2 раза",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" }, difficulty: 3 },
  { kind: "win_games",      target: 5, description: "Победите в 5 матчах",
    reward: { type: "chest", amount: 1, chestRarity: "mega", label: "Мега-сундук" }, difficulty: 3 },
  { kind: "earn_trophies",  target: 80, description: "Заработайте 80 трофеев",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" }, difficulty: 3 },
  { kind: "play_games",     target: 10, description: "Сыграйте 10 матчей в любом режиме",
    reward: { type: "gems", amount: 25, label: "25 кристаллов" }, difficulty: 3 },
];

// Pick 1 easy + 1 medium + 1 hard
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateDailyQuests(): DailyQuestsState {
  const easy   = shuffle(QUEST_POOL.filter(q => q.difficulty === 1));
  const medium = shuffle(QUEST_POOL.filter(q => q.difficulty === 2));
  const hard   = shuffle(QUEST_POOL.filter(q => q.difficulty === 3));

  const picks = [easy[0], medium[0], hard[0]];

  const quests: QuestState[] = picks.map((q, i) => ({
    id: `q${i}_${q.kind}`,
    kind: q.kind,
    target: q.target,
    progress: 0,
    description: q.description,
    reward: q.reward,
    claimed: false,
  }));

  return { generatedAt: Date.now(), quests };
}

export function isQuestsExpired(state: DailyQuestsState | undefined | null): boolean {
  if (!state) return true;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  return Date.now() - state.generatedAt >= ONE_DAY;
}

export function timeUntilQuestRefresh(state: DailyQuestsState | undefined | null): number {
  if (!state) return 0;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const elapsed = Date.now() - state.generatedAt;
  return Math.max(0, ONE_DAY - elapsed);
}

export function formatHmsShort(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}
