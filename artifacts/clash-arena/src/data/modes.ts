import type { GameMode } from "../App";

export interface ModeInfo {
  id: GameMode;
  name: string;
  subtitle: string;
  desc: string;
  players: string;
  icon: string;
  color: string;
  gradient: string;
}

export const MODES: ModeInfo[] = [
  {
    id: "showdown",
    name: "Шоудаун",
    subtitle: "Королевская битва",
    desc: "Последний выживший побеждает. 1 против 7 ботов. Газ сжимается со временем.",
    players: "1 на 7 ботов",
    icon: "⚔️",
    color: "#FF5252",
    gradient: "linear-gradient(135deg, #B71C1C, #FF5252)",
  },
  {
    id: "crystals",
    name: "Захват кристаллов",
    subtitle: "3 на 3 командный бой",
    desc: "Несите кристаллы на свою базу. Кто первый соберёт 10 — побеждает!",
    players: "3 на 3",
    icon: "💎",
    color: "#40C4FF",
    gradient: "linear-gradient(135deg, #0D47A1, #40C4FF)",
  },
  {
    id: "siege",
    name: "Осада",
    subtitle: "Защита базы",
    desc: "Защитите свою базу от 3 волн врагов!",
    players: "1 против волн",
    icon: "🏰",
    color: "#69F0AE",
    gradient: "linear-gradient(135deg, #1B5E20, #69F0AE)",
  },
  {
    id: "heist",
    name: "Ограбление",
    subtitle: "Атака сейфа",
    desc: "Уничтожьте сейф врага раньше, чем они уничтожат ваш!",
    players: "3 на 3",
    icon: "🔐",
    color: "#FFD700",
    gradient: "linear-gradient(135deg, #F57F17, #FFD700)",
  },
  {
    id: "gemgrab",
    name: "Выноси кристаллы",
    subtitle: "Удержи 10 секунд",
    desc: "Соберите 10 камней и удержите их 15 секунд для победы!",
    players: "3 на 3",
    icon: "💠",
    color: "#CE93D8",
    gradient: "linear-gradient(135deg, #4A148C, #CE93D8)",
  },
];

export function getModeInfo(id: string): ModeInfo {
  return MODES.find(m => m.id === id) || MODES[0];
}
