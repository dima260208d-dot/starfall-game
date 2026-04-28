import { useEffect, useRef, useState } from "react";
import { ClashShowdown } from "../modes/ClashShowdown";
import { ClashCrystals } from "../modes/ClashCrystals";
import { ClashHeist } from "../modes/ClashHeist";
import { ClashGemGrab } from "../modes/ClashGemGrab";
import { ClashSiege } from "../modes/ClashSiege";
import { ClashTraining } from "../modes/ClashTraining";
import { getCurrentProfile, getControlMode, getQuestPool } from "../utils/localStorageAPI";
import { getMatchStats } from "../utils/matchStats";
import { loadSpriteSheet, loadBrawlerImages } from "../game/sprites";
import { preloadCharRenderers } from "../game/miyaTopDownRenderer";
import { BRAWLERS } from "../entities/BrawlerData";
import MobileControls from "../components/MobileControls";
import MiniMap from "../components/MiniMap";
import ResultScreen from "../components/ResultScreen";
import type { GameParticipant } from "../types/gameResult";
import type { GameMode } from "../App";

interface GameScreenProps {
  mode: GameMode;
  brawlerId: string;
  onExit: () => void;
  onPlayAgain?: () => void;
}

type AnyGame = ClashShowdown | ClashCrystals | ClashHeist | ClashGemGrab | ClashSiege | ClashTraining;

export default function GameScreen({ mode, brawlerId, onExit, onPlayAgain }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AnyGame | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const [result, setResult] = useState<{ place: number; trophyDelta: number; xpGained: number } | null>(null);
  const [participants, setParticipants] = useState<GameParticipant[]>([]);
  const [matchStatsData, setMatchStatsData] = useState({ damageDealt: 0, healingDone: 0, superUses: 0, killCount: 0, powerCubesCollected: 0 });
  const [controlMode] = useState(getControlMode());
  const brawlerStats = BRAWLERS.find(b => b.id === brawlerId) || BRAWLERS[0];

  // Snapshot quests before the game starts so we can show deltas in the result screen
  const preQuestSnapshot = useRef<Array<{ id: string; progress: number }>>([]);
  useEffect(() => {
    const pool = getQuestPool();
    if (pool) {
      preQuestSnapshot.current = pool.activeQuests
        .filter(q => !q.claimed)
        .map(q => ({ id: q.id, progress: q.progress }));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const base = (import.meta as any).env?.BASE_URL ?? "/";
    Promise.all([
      loadSpriteSheet(`${base}characters.webp`),
      loadBrawlerImages(BRAWLERS.map(b => b.id), base),
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
        // Capture match stats immediately when game ends (before 3s delay)
        const ms = getMatchStats();
        const currentGame = gameRef.current;

        setTimeout(() => {
          setGameOver(true);
          setWon(game.won);
          setMatchStatsData({
            damageDealt: ms.damageDealt ?? 0,
            healingDone: ms.healingDone ?? 0,
            superUses: ms.superUses ?? 0,
            killCount: ms.killCount ?? 0,
            powerCubesCollected: ms.powerCubesCollected ?? 0,
          });
          const p = getCurrentProfile();
          if (p?.lastResult) {
            setResult({ place: p.lastResult.place, trophyDelta: p.lastResult.trophyDelta, xpGained: p.lastResult.xpGained });
          }
          // Capture participants from the game instance
          if (currentGame && typeof (currentGame as any).getParticipants === "function") {
            setParticipants((currentGame as any).getParticipants());
          } else {
            // Fallback: just player
            const prof = getCurrentProfile();
            setParticipants([{
              brawlerId,
              displayName: prof?.username || "Игрок",
              team: "blue",
              isPlayer: true,
              level: level,
              trophies: prof?.trophies ?? 0,
            }]);
          }
        }, 3000);
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

  const handlePlayAgain = () => {
    if (onPlayAgain) {
      onPlayAgain();
    } else {
      onExit();
    }
  };

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

      {!gameOver && (
        <MiniMap gameRef={gameRef as any} mode={mode} />
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
        <ResultScreen
          won={won}
          mode={mode}
          participants={participants}
          result={result}
          matchStats={matchStatsData}
          preQuestSnapshot={preQuestSnapshot.current}
          onExit={onExit}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  );
}
