import type { ChestRarity } from "../utils/chests";

export interface BrawlerStats {
  id: string;
  name: string;
  role: string;
  rarity: ChestRarity;
  hp: number;
  speed: number;
  regenRate: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  attackCharges: number;
  superCooldown: number;
  // Percent of the super bar gained per successful hit on an enemy (0-100).
  // Super now charges *only* from landing hits — no passive/auto-charge.
  superChargePerHit: number;
  color: string;
  secondaryColor: string;
  accentColor: string;
  description: string;
  attackName: string;
  superName: string;
  attackDesc: string;
  superDesc: string;
  spriteRow: number;
  spriteCol: number;
}

// Russian labels for the chest-style rarity tiers when used on a brawler.
export const BRAWLER_RARITY_LABEL: Record<ChestRarity, string> = {
  common:    "Обычный",
  rare:      "Редкий",
  epic:      "Эпический",
  mega:      "Мега",
  legendary: "Легендарный",
  mythic:    "Мифический",
};

// Gem cost to unlock a brawler in the shop, scaled by rarity.
export const BRAWLER_GEM_COST: Record<ChestRarity, number> = {
  common:    20,
  rare:      60,
  epic:      150,
  mega:      300,
  legendary: 600,
  mythic:    1200,
};

// Per-chest chance to drop a brawler (instead of a normal reward roll).
// Higher rarity chests have a higher chance to drop brawlers.
export const CHEST_BRAWLER_DROP_CHANCE: Record<ChestRarity, number> = {
  common:    0.05,   //  5%
  rare:      0.08,   //  8%
  epic:      0.12,   // 12%
  mega:      0.20,   // 20%
  legendary: 0.35,   // 35%
  mythic:    0.50,   // 50%
};

// Backstory/lore for each brawler, shown on the character detail page.
export const BRAWLER_LORE: Record<string, string> = {
  miya:  "Мия выросла в скрытой деревне теневых клинков. После того как враждебный клан уничтожил её дом, она поклялась вершить правосудие в одиночку. Её сюрикены не знают промаха, а тренировки в искусстве телепортации сделали её самым быстрым убийцей в Арене.",
  ronin: "Когда-то Ронин был генералом императорской армии. Преданный собственными лордами, он надел старые доспехи и стал вольным самураем. Его катана разрубает камень, а щит выдерживает залпы из десятка винтовок.",
  yuki:  "Юки родилась в горном храме, где училась искусству целительной магии льда. Она пришла в Арену, чтобы найти брата, пропавшего в одном из турниров. До тех пор она лечит союзников и замораживает любого, кто встанет на пути.",
  kenji: "Кендзи — гениальный изобретатель, выгнанный из университета за «слишком опасные эксперименты». Его электрошокеры собраны из деталей старых автоматов, а молнии прыгают между врагами как живые. Он выходит на арену, чтобы доказать, что был прав.",
  hana:  "Хана — фронтовой медик из Розового госпиталя. Её пистолет одинаково хорошо лечит союзников и продырявливает броню врагов. Она верит, что добро и сила могут идти рука об руку, и ни разу не сдалась перед безнадёжным пациентом.",
  goro:  "Горо — горный варвар, сошедший с северных вершин. Он не помнит своего детства, но помнит вкус победы. Двойные топоры он выковал собственными руками, и ни один щит не выдерживал двух его ударов подряд.",
  sora:  "Сора — придворный маг, изгнанный за то, что осмелился изучать запретные звёздные руны. Его летающая книга шепчет ему древние формулы, а метеоритный дождь оставляет шрамы на самой арене.",
  rin:   "Рин выросла в зелёных джунглях среди ядовитых растений. Каждый её кинжал смазан личным составом яда, формулу которого не знает никто. Она появляется бесшумно, отравляет цель и исчезает в зарослях прежде, чем кто-то успеет среагировать.",
  taro:  "Таро — пожилой инженер, который собрал свой первый шагоход в шесть лет. Гаечный ключ в его руках — оружие пострашнее меча, а турели, что он расставляет на поле боя, держат позиции часами. Не недооценивайте старика.",
};

export const BRAWLERS: BrawlerStats[] = [
  {
    id: "miya",
    name: "Мия",
    role: "Ассасин",
    rarity: "legendary",
    hp: 3600,
    speed: 5.2,
    regenRate: 60,
    attackDamage: 400,
    attackRange: 220,
    attackCooldown: 1.2,
    attackCharges: 3,
    superCooldown: 20,
    superChargePerHit: 8,
    color: "#7B2FBE",
    secondaryColor: "#4A0080",
    accentColor: "#FF1744",
    description: "Девушка-ниндзя с фиолетовыми волосами и двумя короткими мечами",
    attackName: "Теневые клинки",
    superName: "Разрыв реальности",
    attackDesc: "Бросает 2 сюрикена по дуге, каждый наносит 400 урона (всего до 800).",
    superDesc: "Мгновенно телепортируется за спину ближайшему врагу и накладывает замедление -40% на 2 сек. Урона не наносит — даёт идеальную позицию для серии атак.",
    spriteRow: 0,
    spriteCol: 0,
  },
  {
    id: "ronin",
    name: "Ronin",
    role: "Танк",
    rarity: "epic",
    hp: 5500,
    speed: 3.2,
    regenRate: 40,
    attackDamage: 300,
    attackRange: 160,
    attackCooldown: 1.4,
    attackCharges: 2,
    superCooldown: 22,
    superChargePerHit: 18,
    color: "#B71C1C",
    secondaryColor: "#FFD700",
    accentColor: "#FF6F00",
    description: "Огромный самурай в красных доспехах с катаной",
    attackName: "Столб земли",
    superName: "Несокрушимая стена",
    attackDesc: "Размашистый удар катаной в конусе 60°, наносит 300 урона всем врагам в зоне.",
    superDesc: "Поднимает щит на 5 сек: -50% входящего урона и 30% отражается атакующему. Урона не наносит — превращает Ронина в неубиваемую стену.",
    spriteRow: 0,
    spriteCol: 2,
  },
  {
    id: "yuki",
    name: "Yuki",
    role: "Поддержка",
    rarity: "mega",
    hp: 3200,
    speed: 4.2,
    regenRate: 70,
    attackDamage: 200,
    attackRange: 350,
    attackCooldown: 1.0,
    attackCharges: 3,
    superCooldown: 18,
    superChargePerHit: 14,
    color: "#0288D1",
    secondaryColor: "#E1F5FE",
    accentColor: "#B2EBF2",
    description: "Девушка в синем кимоно с посохом и снежинкой",
    attackName: "Снежный шар",
    superName: "Исцеляющий снег",
    attackDesc: "Снаряд льда: 200 урона при попадании + замедление врага -35% на 2 сек.",
    superDesc: "Создаёт исцеляющее облако радиусом 140 на 6 сек: восстанавливает союзникам 300 ХП/сек и замедляет врагов в зоне на 25%.",
    spriteRow: 0,
    spriteCol: 3,
  },
  {
    id: "kenji",
    name: "Kenji",
    role: "Контроллер",
    rarity: "epic",
    hp: 4000,
    speed: 3.8,
    regenRate: 55,
    attackDamage: 250,
    attackRange: 200,
    attackCooldown: 1.3,
    attackCharges: 2,
    superCooldown: 20,
    superChargePerHit: 16,
    color: "#F9A825",
    secondaryColor: "#212121",
    accentColor: "#40C4FF",
    description: "Парень в жёлтом костюме с электрошокерами на руках",
    attackName: "Электрическая цепь",
    superName: "Клетка молний",
    attackDesc: "Молния прыгает до 3 врагов: 250 урона первой цели, 175 второй, 120 третьей.",
    superDesc: "Создаёт электрическую клетку радиусом 110 на 5 сек: 200 урона/сек врагам внутри + замедление -50%.",
    spriteRow: 0,
    spriteCol: 4,
  },
  {
    id: "hana",
    name: "Hana",
    role: "Хилер",
    rarity: "rare",
    hp: 3000,
    speed: 4.5,
    regenRate: 80,
    attackDamage: 150,
    attackRange: 400,
    attackCooldown: 0.9,
    attackCharges: 4,
    superCooldown: 16,
    superChargePerHit: 12,
    color: "#E91E8C",
    secondaryColor: "#FCE4EC",
    accentColor: "#FF80AB",
    description: "Девушка в розовом медицинском халате с лечебным пистолетом",
    attackName: "Лечебная пуля",
    superName: "Цветущий сад",
    attackDesc: "Розовая пуля: лечит союзника на 150 ХП либо наносит 150 урона врагу (по цели прицела).",
    superDesc: "Цветущий сад радиусом 160 на 5 сек: лечит союзников на 200 ХП/сек и накладывает на них +20% к скорости.",
    spriteRow: 1,
    spriteCol: 0,
  },
  {
    id: "goro",
    name: "Goro",
    role: "Берсерк",
    rarity: "mythic",
    hp: 6200,
    speed: 2.9,
    regenRate: 35,
    attackDamage: 450,
    attackRange: 90,
    attackCooldown: 1.5,
    attackCharges: 2,
    superCooldown: 22,
    superChargePerHit: 20,
    color: "#8D4E2B",
    secondaryColor: "#FF3D00",
    accentColor: "#BF360C",
    description: "Огромный бородатый мужчина с двумя боевыми топорами",
    attackName: "Двойной топор",
    superName: "Ярость берсерка",
    attackDesc: "Размашистое вращение топорами 360°, наносит 450 урона всем врагам в радиусе 90.",
    superDesc: "Берсерк на 5 сек: +40% скорость передвижения и +50% урон атаки. Урона напрямую не наносит — резко увеличивает DPS.",
    spriteRow: 1,
    spriteCol: 1,
  },
  {
    id: "sora",
    name: "Sora",
    role: "Маг",
    rarity: "mega",
    hp: 3400,
    speed: 4.0,
    regenRate: 45,
    attackDamage: 300,
    attackRange: 400,
    attackCooldown: 1.1,
    attackCharges: 3,
    superCooldown: 24,
    superChargePerHit: 14,
    color: "#1A237E",
    secondaryColor: "#FFD700",
    accentColor: "#FF6F00",
    description: "Парень в синей мантии с летающей книгой заклинаний",
    attackName: "Огненный шар",
    superName: "Метеоритный дождь",
    attackDesc: "Огненный шар: 300 урона при прямом попадании + 150 урона взрывом по соседям.",
    superDesc: "Призывает 5 метеоров в указанную зону за 3 сек, каждый наносит 250 урона (всего до 1250 урона по одной цели).",
    spriteRow: 1,
    spriteCol: 2,
  },
  {
    id: "rin",
    name: "Rin",
    role: "Отравитель",
    rarity: "legendary",
    hp: 3300,
    speed: 5.0,
    regenRate: 50,
    attackDamage: 350,
    attackRange: 300,
    attackCooldown: 1.0,
    attackCharges: 3,
    superCooldown: 19,
    superChargePerHit: 13,
    color: "#2E7D32",
    secondaryColor: "#8BC34A",
    accentColor: "#CE93D8",
    description: "Девушка с зелёными волосами и ядовитыми кинжалами",
    attackName: "Отравленный кинжал",
    superName: "Облако яда",
    attackDesc: "Бросает кинжал на 350 урона + накладывает яд: 100 урона/сек в течение 3 сек (300 ДоТ).",
    superDesc: "Бросает ядовитую гранату — облако радиусом 100 на 4 сек: 150 урона/сек врагам внутри (до 600 урона за полный тик).",
    spriteRow: 1,
    spriteCol: 3,
  },
  {
    id: "taro",
    name: "Taro",
    role: "Инженер",
    rarity: "rare",
    hp: 3700,
    speed: 3.5,
    regenRate: 40,
    attackDamage: 400,
    attackRange: 80,
    attackCooldown: 0.8,
    attackCharges: 3,
    superCooldown: 25,
    superChargePerHit: 16,
    color: "#5D4037",
    secondaryColor: "#CD9B39",
    accentColor: "#78909C",
    description: "Старик с гаечным ключом и механическим рюкзаком",
    attackName: "Гаечный ключ",
    superName: "Турель",
    attackDesc: "Размашистый удар ключом в ближнем бою (80), наносит 400 урона цели + 80 урона по соседям.",
    superDesc: "Ставит автономную турель (200 ХП, дальность 250): стреляет каждые 0.6 сек по 150 урона, живёт 12 сек или пока её не уничтожат.",
    spriteRow: 1,
    spriteCol: 4,
  },
];

export function pickBotStats(playerBrawlerId: string, count: number): BrawlerStats[] {
  const pool = BRAWLERS.filter(b => b.id !== playerBrawlerId);
  // Fisher-Yates shuffle
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const result: BrawlerStats[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}

export function getBrawlerById(id: string): BrawlerStats | undefined {
  return BRAWLERS.find((b) => b.id === id);
}

export function getScaledStats(brawler: BrawlerStats, level: number) {
  const lvl = Math.max(1, Math.min(10, level));
  return {
    hp: Math.floor(brawler.hp * (1 + 0.05 * (lvl - 1))),
    attackDamage: Math.floor(brawler.attackDamage * (1 + 0.03 * (lvl - 1))),
    speed: brawler.speed,
    regenRate: brawler.regenRate,
    attackCooldown: brawler.attackCooldown,
    attackCharges: brawler.attackCharges,
    attackRange: brawler.attackRange,
  };
}
