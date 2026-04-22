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
  mapName: string;
}

export const MODES: ModeInfo[] = [
  {
    id: "showdown",
    name: "Шоудаун",
    subtitle: "Королевская битва",
    desc: "Последний выживший побеждает. 1 против 9 ботов. Газ постепенно сжимает арену, выталкивая всех в центр. Из ящиков и павших противников выпадают кубки усиления — каждый даёт +10% к урону и здоровью.",
    players: "1 на 9 ботов",
    icon: "⚔️",
    color: "#FF5252",
    gradient: "linear-gradient(135deg, #B71C1C, #FF5252)",
    mapName: "Заброшенный храм",
  },
  {
    id: "crystals",
    name: "Захват кристаллов",
    subtitle: "3 на 3 командный бой",
    desc: "Собирайте кристаллы, что появляются в центре карты, и удерживайте их. Команда, набравшая 10 кристаллов и удержавшая их, побеждает.",
    players: "3 на 3",
    icon: "💎",
    color: "#40C4FF",
    gradient: "linear-gradient(135deg, #0D47A1, #40C4FF)",
    mapName: "Кристальная шахта",
  },
  {
    id: "siege",
    name: "Осада",
    subtitle: "Защита базы",
    desc: "Защитите свою базу от трёх волн врагов. Чем дольше держитесь — тем выше награда.",
    players: "4 против волн",
    icon: "🏰",
    color: "#69F0AE",
    gradient: "linear-gradient(135deg, #1B5E20, #69F0AE)",
    mapName: "Кристальная шахта",
  },
  {
    id: "heist",
    name: "Ограбление",
    subtitle: "Атака сейфа",
    desc: "У каждой команды есть сейф. Уничтожьте сейф врага раньше, чем они уничтожат ваш.",
    players: "3 на 3",
    icon: "🔐",
    color: "#FFD700",
    gradient: "linear-gradient(135deg, #F57F17, #FFD700)",
    mapName: "Кристальная шахта",
  },
  {
    id: "gemgrab",
    name: "Выноси кристаллы",
    subtitle: "Удержи 15 секунд",
    desc: "Подбирайте камни, что выпадают из центрального источника. Команда, удержавшая 10 камней одновременно в течение 15 секунд, побеждает. Если носителя убивают — он роняет все камни.",
    players: "3 на 3",
    icon: "💠",
    color: "#CE93D8",
    gradient: "linear-gradient(135deg, #4A148C, #CE93D8)",
    mapName: "Кристальная шахта",
  },
];

export function getModeInfo(id: string): ModeInfo {
  return MODES.find(m => m.id === id) || MODES[0];
}
