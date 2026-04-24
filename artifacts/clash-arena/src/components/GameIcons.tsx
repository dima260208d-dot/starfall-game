/**
 * Shared AI-generated icon helpers used across all menu pages.
 * All images live in /public/images/ and are referenced via BASE_URL.
 */
const BASE = (import.meta as any).env?.BASE_URL ?? "/";

export const ICONS = {
  coins:   `${BASE}images/icon-coins.png`,
  gems:    `${BASE}images/icon-gems.png`,
  power:   `${BASE}images/icon-power.png`,
  box:     `${BASE}images/icon-box.png`,
  trophy:  `${BASE}images/icon-trophy.png`,
};

interface IconProps {
  size?: number;
  style?: React.CSSProperties;
  alt?: string;
}

function icon(src: string, defaultAlt: string) {
  return function IconComp({ size = 18, style, alt }: IconProps) {
    return (
      <img
        src={src}
        alt={alt ?? defaultAlt}
        style={{ width: size, height: size, objectFit: "contain", verticalAlign: "middle", display: "inline-block", ...style }}
      />
    );
  };
}

export const CoinIcon    = icon(ICONS.coins,  "монеты");
export const GemIcon     = icon(ICONS.gems,   "кристаллы");
export const PowerIcon   = icon(ICONS.power,  "очки силы");
export const BoxIcon     = icon(ICONS.box,    "сундук");
export const TrophyIcon  = icon(ICONS.trophy, "трофей");

/** Inline currency display: icon + space + count */
export function CoinBadge({ value, size = 16 }: { value: number | string; size?: number }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#FFD700" }}><CoinIcon size={size} /> {value}</span>;
}
export function GemBadge({ value, size = 16 }: { value: number | string; size?: number }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#40C4FF" }}><GemIcon size={size} /> {value}</span>;
}
export function PowerBadge({ value, size = 16 }: { value: number | string; size?: number }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#CE93D8" }}><PowerIcon size={size} /> {value}</span>;
}
