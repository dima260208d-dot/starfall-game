import { useEffect, useRef, useState } from "react";
import { ClashShowdown } from "../modes/ClashShowdown";
import { ClashCrystals } from "../modes/ClashCrystals";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { loadSpriteSheet } from "../game/sprites";

interface GameScreenProps {
  mode: "showdown" | "crystals";
  brawlerId: string;
  onExit: () => void;
}

export default function GameScreen({ mode, brawlerId, onExit }: GameScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ClashShowdown | ClashCrystals | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [spriteLoaded, setSpriteLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    loadSpriteSheet("/characters.webp").then(() => {
      if (mounted) setSpriteLoaded(true);
    });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const profile = getCurrentProfile();
    const level = profile?.brawlerLevels[brawlerId] || 1;

    let game: ClashShowdown | ClashCrystals;

    const handleAttack = () => gameRef.current?.handleAttack();
    const handleSuper = () => gameRef.current?.handleSuper();

    if (mode === "showdown") {
      game = new ClashShowdown(canvas, brawlerId, level, handleAttack, handleSuper, spriteLoaded);
    } else {
      game = new ClashCrystals(canvas, brawlerId, level, handleAttack, handleSuper, spriteLoaded);
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
          maxWidth: "100vw",
          maxHeight: "100vh",
          objectFit: "contain",
          display: "block",
        }}
      />

      {gameOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(10px)",
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: won ? "#FFD700" : "#FF5252",
              textShadow: `0 0 40px ${won ? "#FFD700" : "#FF5252"}`,
              marginBottom: 10,
              animation: "pulse 1s ease-in-out infinite",
            }}
          >
            {won ? "VICTORY!" : "DEFEAT"}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.6)",
              marginBottom: 40,
            }}
          >
            {won ? "You earned 100 coins!" : "You earned 40 coins."}
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
            }}
          >
            BACK TO LOBBY
          </button>
          <style>{`
            @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
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
        EXIT
      </button>
    </div>
  );
}
