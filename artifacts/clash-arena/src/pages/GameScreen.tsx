import { useEffect, useRef, useState } from "react";
import { ClashShowdown } from "../modes/ClashShowdown";
import { ClashCrystals } from "../modes/ClashCrystals";
import { ClashHeist } from "../modes/ClashHeist";
import { ClashGemGrab } from "../modes/ClashGemGrab";
import { ClashSiege } from "../modes/ClashSiege";
import { ClashTraining } from "../modes/ClashTraining";
import { getCurrentProfile, getControlMode } from "../utils/localStorageAPI";
import { loadSpriteSheet, loadBrawlerImages } from "../game/sprites";
import { preloadCharRenderers } from "../game/miyaTopDownRenderer";
import { BRAWLERS } from "../entities/BrawlerData";
import MobileControls from "../components/MobileControls";
import type { GameMode } from "../App";

interface GameScreenProps {
  mode: GameMode;
  brawlerId: string;
  onExit: () => void;
}

type AnyGame = ClashShowdown | ClashCrystals | ClashHeist | ClashGemGrab | ClashSiege | ClashTraining;

export default function GameScreen({ mode, brawlerId, onExit }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AnyGame | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const [result, setResult] = useState<{ place: number; trophyDelta: number; xpGained: number } | null>(null);
  const [controlMode] = useState(getControlMode());
  const brawlerStats = BRAWLERS.find(b => b.id === brawlerId) || BRAWLERS[0];

  useEffect(() => {
    let mounted = true;
    const base = (import.meta as any).env?.BASE_URL ?? "/";
    Promise.all([
      loadSpriteSheet(`${base}characters.webp`),
      loadBrawlerImages(BRAWLERS.map(b => b.id), base),
      // Await all 3D character models — downloads started in App.tsx during the
      // loading screen, so they are usually already done or nearly done by now.
      preloadCharRenderers(base),
    ]).then(() => {
      if (mounted) setSpriteLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const profile = getCurrentProfile();
    const level = profile?.brawlerLevels[brawlerId] || 1;

    let game: AnyGame;
    const handleAttack = () => gameRef.current?.handleAttack();
    const handleSuper = () => gameRef.current?.handleSuper();

    if (mode === "showdown") {
      game = new ClashShowdown(canvas, brawlerId, level, handleAttack, handleSuper, spriteLoaded);
    } else if (mode === "crystals") {
      game = new ClashCrystals(canvas, brawlerId, level, handleAttack, handleSuper, spriteLoaded);
    } else if (mode === "heist") {
      game = new ClashHeist(canvas, brawlerId, level, handleAttack, handleSuper, spriteLoaded);
    } else if (mode === "gemgrab") {
      game = new ClashGemGrab(canvas, brawlerId, level, handleAttack, handleSuper, spriteLoaded);
    } else if (mode === "training") {
      game = new ClashTraining(canvas, brawlerId, level, handleAttack, handleSuper, spriteLoaded);
    } else {
      game = new ClashSiege(canvas, brawlerId, level, handleAttack, handleSuper, spriteLoaded);
    }

    gameRef.current = game;
    const ctx = canvas.getContext("2d")!;

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const rawDt = (timestamp - lastTimeRef.current) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastTimeRef.current = timestamp;

      game.update(dt);
      game.render(ctx);

      if (game.over) {
        setGameOver(true);
        setWon(game.won);
        // Pull result snapshot saved by the mode via recordGameResult.
        const p = getCurrentProfile();
        if (p?.lastResult) {
          setResult({ place: p.lastResult.place, trophyDelta: p.lastResult.trophyDelta, xpGained: p.lastResult.xpGained });
        }
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      game.destroy?.();
      gameRef.current = null;
      lastTimeRef.current = 0;
    };
  }, [mode, brawlerId, spriteLoaded]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        width={1200}
        height={800}
        style={{
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          display: "block",
          touchAction: "none",
        }}
      />

      {controlMode === "mobile" && !gameOver && (
        <MobileControls
          getInput={() => gameRef.current?.input ?? null}
          getPlayerInfo={() => ({
            attackRange: brawlerStats.attackRange,
            canvas: canvasRef.current,
            brawlerId: gameRef.current?.player?.stats.id ?? brawlerStats.id,
            playerX: gameRef.current?.player?.x,
            playerY: gameRef.current?.player?.y,
          })}
        />
      )}

      {mode === "training" && !gameOver && (
        <button
          onClick={onExit}
          style={{
            position: "absolute",
            top: 14, right: 14, zIndex: 11,
            background: "linear-gradient(135deg, #C62828, #FF5252)",
            border: "none",
            borderRadius: 12,
            padding: "10px 18px",
            color: "white",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 1.5,
            cursor: "pointer",
            boxShadow: "0 4px 18px rgba(255,82,82,0.5)",
          }}
        >
          ✕ ВЫЙТИ
        </button>
      )}

      {gameOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: won ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(10px)",
            zIndex: 10,
            overflow: "hidden",
          }}
        >
          {won && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
              {Array.from({ length: 80 }).map((_, i) => {
                const colors = ["#FFD700", "#FFEB3B", "#FFAB40", "#00E5FF", "#FFFFFF", "#FFC1E3"];
                const color = colors[i % colors.length];
                const left = Math.random() * 100;
                const delay = Math.random() * 2;
                const duration = 2.5 + Math.random() * 2.5;
                const size = 14 + Math.random() * 18;
                return (
                  <span
                    key={i}
                    style={{
                      position: "absolute",
                      top: -20,
                      left: `${left}%`,
                      fontSize: size,
                      color,
                      textShadow: `0 0 10px ${color}`,
                      animation: `starFall ${duration}s linear ${delay}s infinite`,
                      lineHeight: 1,
                    }}
                  >
                    ★
                  </span>
                );
              })}
            </div>
          )}

          <div
            style={{
              fontSize: 120,
              lineHeight: 1,
              marginBottom: 8,
              filter: `drop-shadow(0 0 30px ${won ? "#FFD700" : "#FF5252"})`,
              animation: won ? "trophyBounce 1.4s ease-in-out infinite" : "shake 0.6s ease-in-out 3",
            }}
          >
            {won ? "🏆" : "💀"}
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: won ? "#FFD700" : "#FF5252",
              textShadow: `0 0 40px ${won ? "#FFD700" : "#FF5252"}`,
              marginBottom: 10,
              animation: "pulse 1s ease-in-out infinite",
              letterSpacing: 4,
            }}
          >
            {won ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}
          </div>
          {result && (
            <div
              style={{
                fontSize: 22,
                color: "#FFFFFF",
                marginBottom: 14,
                fontWeight: 700,
                letterSpacing: 1,
                textShadow: "0 2px 8px rgba(0,0,0,0.6)",
              }}
            >
              {mode === "showdown" ? `${result.place} место из 8` : (won ? "1 место" : "2 место")}
            </div>
          )}
          <div style={{ display: "flex", gap: 18, marginBottom: 30, flexWrap: "wrap", justifyContent: "center" }}>
            <ResultChip
              icon="🏆"
              label="Кубки"
              value={result ? (result.trophyDelta >= 0 ? `+${result.trophyDelta}` : `${result.trophyDelta}`) : "—"}
              color={result && result.trophyDelta >= 0 ? "#FFD700" : "#FF7043"}
            />
            <ResultChip
              icon="🪙"
              label="Монеты"
              value={`+${won ? 100 : 40}`}
              color="#FFD700"
            />
            <ResultChip
              icon="⭐"
              label="Опыт"
              value={result ? `+${result.xpGained}` : "—"}
              color="#7C4DFF"
            />
          </div>
          <button
            onClick={onExit}
            style={{
              background: "linear-gradient(135deg, #7B2FBE, #CE93D8)",
              border: "none",
              borderRadius: 14,
              padding: "16px 50px",
              color: "white",
              fontWeight: 800,
              fontSize: 18,
              cursor: "pointer",
              letterSpacing: 2,
              boxShadow: "0 6px 30px rgba(123,47,190,0.5)",
              zIndex: 2,
            }}
          >
            ВЫЙТИ
          </button>
          <style>{`
            @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes trophyBounce { 0%,100% { transform: translateY(0) rotate(-5deg);} 50% { transform: translateY(-15px) rotate(5deg);} }
            @keyframes shake { 0%,100% { transform: translateX(0);} 25% { transform: translateX(-10px);} 75% { transform: translateX(10px);} }
            @keyframes starFall {
              0%   { transform: translateY(-10vh) rotate(0deg) scale(0.6);   opacity: 0; }
              10%  { opacity: 1; }
              50%  { transform: translateY(50vh)  rotate(360deg) scale(1.1); opacity: 1; }
              100% { transform: translateY(110vh) rotate(720deg) scale(0.7); opacity: 0; }
            }
          `}</style>
        </div>
      )}

      <button
        onClick={onExit}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          background: "rgba(255,0,0,0.2)",
          border: "1px solid rgba(255,0,0,0.3)",
          borderRadius: 8,
          padding: "5px 12px",
          color: "#FF5252",
          fontSize: 12,
          cursor: "pointer",
          zIndex: 5,
        }}
      >
        ВЫХОД
      </button>
    </div>
  );
}

function ResultChip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        border: `1px solid ${color}55`,
        borderRadius: 14,
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 130,
        boxShadow: `0 0 20px ${color}33`,
      }}
    >
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, letterSpacing: 1 }}>{label}</span>
        <span style={{ color, fontSize: 20, fontWeight: 800 }}>{value}</span>
      </div>
    </div>
  );
}
