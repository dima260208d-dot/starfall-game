import { CHESTS, type ChestRarity } from "../utils/chests";

interface Props {
  rarity: ChestRarity;
  size?: number;
  animated?: boolean;     // idle bobbing/glow
  shake?: boolean;        // opening shake
  exploding?: boolean;    // opened — burst out
  onClick?: () => void;
}

/**
 * Each chest tier has its own unique stylised visual built with layered divs.
 * The look scales with the size prop. All animations are CSS-driven.
 */
export default function ChestVisual({
  rarity, size = 120, animated = true, shake = false, exploding = false, onClick,
}: Props) {
  const def = CHESTS[rarity];
  const animName =
    exploding ? "chestExplode 0.7s ease-out forwards" :
    shake     ? "chestShake 0.25s ease-in-out 5"      :
    animated  ? `chestFloat ${3 + def.tier * 0.3}s ease-in-out infinite, chestGlow ${2.5 + def.tier * 0.2}s ease-in-out infinite alternate` :
                undefined;

  const w = size;
  const h = size * 0.95;

  return (
    <div
      onClick={onClick}
      style={{
        width: w, height: h,
        position: "relative",
        cursor: onClick ? "pointer" : "default",
        animation: animName,
        filter: `drop-shadow(0 ${size * 0.05}px ${size * 0.15}px ${def.color}88)`,
      }}
    >
      <ChestStyles />

      {/* Outer aura ring */}
      <div style={{
        position: "absolute", inset: -size * 0.1,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${def.color}55 0%, transparent 70%)`,
        opacity: animated ? 0.85 : 0.5,
        animation: animated ? `chestPulse ${2 + def.tier * 0.2}s ease-in-out infinite` : undefined,
      }} />

      {/* Top lid */}
      <div style={{
        position: "absolute",
        left: w * 0.05, top: h * 0.05,
        width: w * 0.9, height: h * 0.45,
        background: `linear-gradient(180deg, ${def.color}, ${def.secondaryColor})`,
        border: `${Math.max(2, size * 0.025)}px solid ${def.borderColor}`,
        borderRadius: `${w * 0.45}px ${w * 0.45}px ${w * 0.05}px ${w * 0.05}px`,
        boxShadow: `inset 0 ${size * 0.02}px ${size * 0.06}px rgba(255,255,255,0.4), inset 0 -${size * 0.02}px ${size * 0.04}px rgba(0,0,0,0.4)`,
      }}>
        {/* Lid strap */}
        <div style={{
          position: "absolute",
          top: 0, bottom: 0, left: "50%",
          width: size * 0.12, transform: "translateX(-50%)",
          background: `linear-gradient(180deg, ${def.borderColor}, ${def.secondaryColor})`,
          opacity: 0.85,
        }} />
        {/* Tier-specific lid ornament */}
        <LidOrnament tier={def.tier} size={size} color={def.color} />
      </div>

      {/* Body */}
      <div style={{
        position: "absolute",
        left: w * 0.05, top: h * 0.45,
        width: w * 0.9, height: h * 0.55,
        background: `linear-gradient(180deg, ${def.secondaryColor}, ${def.color}cc)`,
        border: `${Math.max(2, size * 0.025)}px solid ${def.borderColor}`,
        borderRadius: `${w * 0.05}px ${w * 0.05}px ${w * 0.08}px ${w * 0.08}px`,
        boxShadow: `inset 0 ${size * 0.04}px ${size * 0.06}px rgba(0,0,0,0.5), inset 0 -${size * 0.04}px ${size * 0.06}px rgba(255,255,255,0.18)`,
      }}>
        {/* Lock */}
        <div style={{
          position: "absolute",
          top: -size * 0.045,
          left: "50%", transform: "translateX(-50%)",
          width: size * 0.18, height: size * 0.22,
          borderRadius: size * 0.04,
          background: `linear-gradient(180deg, #FFD54F, #F57F17)`,
          border: `${Math.max(1, size * 0.015)}px solid #B71C1C`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.12, color: "#fff",
          boxShadow: `0 ${size * 0.012}px ${size * 0.02}px rgba(0,0,0,0.4)`,
        }}>
          🔒
        </div>

        {/* Body horizontal bands */}
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0,
          height: size * 0.04, background: def.borderColor, opacity: 0.65,
        }} />

        {/* Tier-specific body badge */}
        <BodyBadge tier={def.tier} size={size} color={def.color} />
      </div>

      {/* Sparkle particles for high tiers */}
      {def.tier >= 4 && animated && (
        <>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              position: "absolute",
              left: `${15 + (i * 15)}%`,
              top: `${10 + ((i * 23) % 70)}%`,
              width: size * 0.05, height: size * 0.05,
              borderRadius: "50%",
              background: i % 2 === 0 ? "#FFFFFF" : def.color,
              boxShadow: `0 0 ${size * 0.04}px ${def.color}`,
              animation: `chestSparkle ${1.5 + i * 0.2}s ease-in-out infinite`,
              animationDelay: `${i * 0.25}s`,
              opacity: 0,
            }} />
          ))}
        </>
      )}

      {/* Legendary / Ultra-legendary crown of light */}
      {def.tier >= 6 && animated && (
        <div style={{
          position: "absolute", left: "50%", top: -size * 0.18,
          transform: "translateX(-50%)",
          width: size * (def.tier === 7 ? 0.95 : 0.7),
          height: size * 0.18,
          background: `radial-gradient(ellipse, ${def.color}AA 0%, transparent 70%)`,
          animation: `chestPulse ${def.tier === 7 ? 1.0 : 1.5}s ease-in-out infinite`,
        }} />
      )}
      {/* Ultra-legendary: extra orbiting rune ring */}
      {def.tier === 7 && animated && (
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          width: size * 1.15, height: size * 1.15,
          borderRadius: "50%",
          border: `${Math.max(1, size * 0.015)}px solid ${def.borderColor}88`,
          boxShadow: `0 0 ${size * 0.08}px ${def.borderColor}, inset 0 0 ${size * 0.08}px ${def.color}55`,
          animation: `chestPulse 1.2s ease-in-out infinite`,
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}

function LidOrnament({ tier, size, color }: { tier: number; size: number; color: string }) {
  // Different gem/mark on each tier's lid
  const ornament = ["•", "◆", "✦", "★", "♛", "✪", "⧖"][tier - 1] ?? "⧖";
  return (
    <div style={{
      position: "absolute", top: "55%", left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: size * 0.18,
      color: "#fff",
      textShadow: `0 0 ${size * 0.05}px ${color}, 0 ${size * 0.01}px ${size * 0.02}px rgba(0,0,0,0.5)`,
      fontWeight: 900,
    }}>
      {ornament}
    </div>
  );
}

function BodyBadge({ tier, size, color }: { tier: number; size: number; color: string }) {
  return (
    <div style={{
      position: "absolute", bottom: size * 0.08, left: "50%",
      transform: "translateX(-50%)",
      padding: `${size * 0.02}px ${size * 0.06}px`,
      borderRadius: size * 0.03,
      background: "rgba(0,0,0,0.45)",
      border: `1px solid ${color}`,
      color: "#FFD700",
      fontSize: size * 0.085,
      fontWeight: 900,
      letterSpacing: 1,
      whiteSpace: "nowrap",
    }}>
      {"★".repeat(tier)}
    </div>
  );
}

export function ChestStyles() {
  return (
    <style>{`
      @keyframes chestFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6%); }
      }
      @keyframes chestPulse {
        0%, 100% { transform: scale(1); opacity: 0.6; }
        50% { transform: scale(1.18); opacity: 1; }
      }
      @keyframes chestGlow {
        from { filter: brightness(1); }
        to { filter: brightness(1.18); }
      }
      @keyframes chestSparkle {
        0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
        50% { opacity: 1; transform: scale(1.1) rotate(180deg); }
      }
      @keyframes chestShake {
        0%, 100% { transform: translateX(0) rotate(0); }
        20% { transform: translateX(-6%) rotate(-4deg); }
        40% { transform: translateX(5%) rotate(4deg); }
        60% { transform: translateX(-4%) rotate(-3deg); }
        80% { transform: translateX(4%) rotate(3deg); }
      }
      @keyframes chestExplode {
        0%   { transform: scale(1); opacity: 1; }
        50%  { transform: scale(1.4); opacity: 1; filter: brightness(2.5); }
        100% { transform: scale(1.2); opacity: 0; filter: brightness(3); }
      }
    `}</style>
  );
}
