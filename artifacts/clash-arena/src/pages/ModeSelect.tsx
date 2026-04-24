import { useState } from "react";
import type { GameMode } from "../App";

interface ModeSelectProps {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}

const BASE = (import.meta as any).env?.BASE_URL ?? "/";

const modes: Array<{
  id: GameMode;
  name: string;
  subtitle: string;
  desc: string;
  players: string;
  iconImg: string;
  color: string;
  gradient: string;
}> = [
  {
    id: "showdown",
    name: "Шоудаун",
    subtitle: "Королевская битва",
    desc: "Последний выживший побеждает. 1 против 7 ботов. Газ сжимается со временем.",
    players: "1 на 7 ботов",
    iconImg: `${BASE}images/mode-showdown.png`,
    color: "#FF5252",
    gradient: "linear-gradient(135deg, #B71C1C, #FF5252)",
  },
  {
    id: "crystals",
    name: "Захват кристаллов",
    subtitle: "3 на 3 командный бой",
    desc: "Несите кристаллы на свою базу. Кто первый соберёт 10 — побеждает!",
    players: "3 на 3",
    iconImg: `${BASE}images/mode-crystals.png`,
    color: "#40C4FF",
    gradient: "linear-gradient(135deg, #0D47A1, #40C4FF)",
  },
  {
    id: "siege",
    name: "Осада",
    subtitle: "Защита базы",
    desc: "Защитите свою базу от 3 волн врагов!",
    players: "4 против волн",
    iconImg: `${BASE}images/mode-siege.png`,
    color: "#69F0AE",
    gradient: "linear-gradient(135deg, #1B5E20, #69F0AE)",
  },
  {
    id: "heist",
    name: "Ограбление",
    subtitle: "Атака сейфа",
    desc: "Уничтожьте сейф врага раньше, чем они уничтожат ваш!",
    players: "3 на 3",
    iconImg: `${BASE}images/mode-heist.png`,
    color: "#FFD700",
    gradient: "linear-gradient(135deg, #F57F17, #FFD700)",
  },
  {
    id: "gemgrab",
    name: "Выноси кристаллы",
    subtitle: "Удержи 10 секунд",
    desc: "Соберите 10 камней и удержите их 15 секунд для победы!",
    players: "3 на 3",
    iconImg: `${BASE}images/mode-gemgrab.png`,
    color: "#CE93D8",
    gradient: "linear-gradient(135deg, #4A148C, #CE93D8)",
  },
];

export default function ModeSelect({ onSelect, onBack }: ModeSelectProps) {
  const [hovered, setHovered] = useState<number | null>(null);

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
        ← Назад
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
          Выбор режима
        </h1>
        <p style={{ color: "rgba(255,255,255,0.4)", marginTop: 8, fontSize: 14 }}>
          Выберите режим боя, чтобы начать
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
              cursor: "pointer",
              transform: hovered === i ? "translateY(-4px)" : "none",
              transition: "all 0.25s",
              boxShadow: hovered === i ? `0 10px 40px ${mode.color}20` : "none",
              position: "relative",
              overflow: "hidden",
            }}
            onClick={() => onSelect(mode.id)}
          >
            <div style={{ width: 80, height: 80, marginBottom: 12 }}>
              <img src={mode.iconImg} alt={mode.name} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 16, filter: `drop-shadow(0 0 12px ${mode.color}88)` }} />
            </div>
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
              СТАРТ
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
