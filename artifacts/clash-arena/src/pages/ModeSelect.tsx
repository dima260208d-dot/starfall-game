import { useState } from "react";

interface ModeSelectProps {
  onSelect: (mode: "showdown" | "crystals") => void;
  onBack: () => void;
}

const modes = [
  {
    id: "showdown" as const,
    name: "Clash Showdown",
    subtitle: "Battle Royale",
    desc: "Last player standing wins. 1 vs 7 bots. Gas zone shrinks over time.",
    players: "1v7 Bots",
    icon: "⚔️",
    color: "#FF5252",
    gradient: "linear-gradient(135deg, #B71C1C, #FF5252)",
    available: true,
  },
  {
    id: "crystals" as const,
    name: "Clash Crystals",
    subtitle: "3v3 Team Battle",
    desc: "Collect crystals and bring them to your base. First to 10 wins!",
    players: "3v3",
    icon: "💎",
    color: "#40C4FF",
    gradient: "linear-gradient(135deg, #0D47A1, #40C4FF)",
    available: true,
  },
  {
    id: null,
    name: "Clash Siege",
    subtitle: "Coming Soon",
    desc: "Protect your IKE robot while destroying the enemy's!",
    players: "3v3",
    icon: "🏰",
    color: "#69F0AE",
    gradient: "linear-gradient(135deg, #1B5E20, #69F0AE)",
    available: false,
  },
  {
    id: null,
    name: "Heist",
    subtitle: "Coming Soon",
    desc: "Break into the enemy safe before they crack yours!",
    players: "3v3",
    icon: "🔐",
    color: "#FFD700",
    gradient: "linear-gradient(135deg, #F57F17, #FFD700)",
    available: false,
  },
  {
    id: null,
    name: "Gem Grab",
    subtitle: "Coming Soon",
    desc: "Hold 10 gems without dying to claim victory!",
    players: "3v3",
    icon: "💠",
    color: "#CE93D8",
    gradient: "linear-gradient(135deg, #4A148C, #CE93D8)",
    available: false,
  },
];

export default function ModeSelect({ onSelect, onBack }: ModeSelectProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #050020 0%, #0a0040 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 20px",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      <button
        onClick={onBack}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 10,
          padding: "8px 18px",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        ← Back
      </button>

      <div style={{ textAlign: "center", marginBottom: 50 }}>
        <h1
          style={{
            fontSize: 42,
            fontWeight: 900,
            background: "linear-gradient(135deg, #CE93D8, #FFD700)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundSize: "200% auto",
            animation: "shimmer 3s linear infinite",
            margin: 0,
          }}
        >
          Choose Mode
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", marginTop: 8, fontSize: 14 }}>
          Select a battle mode to begin
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
          maxWidth: 1000,
          width: "100%",
        }}
      >
        {modes.map((mode, i) => (
          <div
            key={i}
            onMouseOver={() => setHovered(i)}
            onMouseOut={() => setHovered(null)}
            style={{
              background: hovered === i ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${hovered === i ? mode.color + "60" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 20,
              padding: 28,
              cursor: mode.available ? "pointer" : "not-allowed",
              transform: hovered === i ? "translateY(-4px)" : "none",
              transition: "all 0.25s",
              opacity: mode.available ? 1 : 0.5,
              boxShadow: hovered === i ? `0 10px 40px ${mode.color}20` : "none",
              position: "relative",
              overflow: "hidden",
            }}
            onClick={() => {
              if (mode.available && mode.id) onSelect(mode.id);
              else if (!mode.available) {
                setComingSoon(mode.name);
                setTimeout(() => setComingSoon(null), 2500);
              }
            }}
          >
            {!mode.available && (
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  right: 14,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  padding: "2px 10px",
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                SOON
              </div>
            )}

            <div style={{ fontSize: 48, marginBottom: 12 }}>{mode.icon}</div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: mode.color,
                marginBottom: 4,
              }}
            >
              {mode.name}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
              {mode.subtitle} • {mode.players}
            </div>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, margin: 0, lineHeight: 1.5 }}>
              {mode.desc}
            </p>

            {mode.available && (
              <button
                style={{
                  marginTop: 20,
                  background: mode.gradient,
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 24px",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                  letterSpacing: 1,
                }}
              >
                START
              </button>
            )}
          </div>
        ))}
      </div>

      {comingSoon && (
        <div
          style={{
            position: "fixed",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.85)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 12,
            padding: "14px 28px",
            color: "white",
            fontWeight: 600,
            fontSize: 15,
            backdropFilter: "blur(10px)",
            zIndex: 999,
          }}
        >
          {comingSoon} — Coming Soon!
        </div>
      )}
    </div>
  );
}
