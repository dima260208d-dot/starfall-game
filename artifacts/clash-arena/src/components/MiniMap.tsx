import { useEffect, useRef } from "react";
import type { GameMode } from "../App";

interface Brawler { x: number; y: number; alive: boolean; stats?: { id?: string }; hp?: number; maxHp?: number; }
interface GameInstance {
  player: Brawler;
  bots?: Brawler[];
  allies?: Brawler[];
  enemies?: Brawler[];
  map: { width: number; height: number };
  over: boolean;
  gas?: { radius?: number; cx?: number; cy?: number };
}

interface Props {
  gameRef: React.RefObject<GameInstance | null>;
  mode: GameMode;
}

const MAP_SIZE = 150;

export default function MiniMap({ gameRef, mode }: Props) {
  const cvs = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const game = gameRef.current;
      const canvas = cvs.current;
      if (!game || !canvas || game.over) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width: mw, height: mh } = game.map;
      const scale = MAP_SIZE / Math.max(mw, mh);

      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

      // Background
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

      // Map area
      ctx.fillStyle = "rgba(40,60,30,0.9)";
      ctx.fillRect(0, 0, mw * scale, mh * scale);

      // Gas zone (Showdown)
      if (game.gas && game.gas.radius !== undefined) {
        const g = game.gas;
        const cx = ((g.cx ?? mw / 2) * scale);
        const cy = ((g.cy ?? mh / 2) * scale);
        const r = (g.radius ?? 0) * scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,200,0,0.06)";
        ctx.fill();
        ctx.strokeStyle = "rgba(100,255,50,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Collect all enemies
      const enemies: Brawler[] = [
        ...(game.bots ?? []),
        ...(game.enemies ?? []),
      ].filter(b => b.alive);

      const allies: Brawler[] = (game.allies ?? []).filter(b => b.alive);

      // Draw enemies as red dots
      for (const b of enemies) {
        const ex = b.x * scale;
        const ey = b.y * scale;
        ctx.beginPath();
        ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#FF4444";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Draw allies as blue dots
      for (const b of allies) {
        const ax = b.x * scale;
        const ay = b.y * scale;
        ctx.beginPath();
        ctx.arc(ax, ay, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#40C4FF";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Draw player as white/yellow dot (larger)
      if (game.player) {
        const px = game.player.x * scale;
        const py = game.player.y * scale;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#FFD700";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Pulse ring
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,215,0,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, MAP_SIZE - 1, MAP_SIZE - 1);

    }, 66); // ~15fps

    return () => clearInterval(id);
  }, [gameRef]);

  const aliveEnemies = (() => {
    const g = gameRef.current;
    if (!g) return 0;
    return [...(g.bots ?? []), ...(g.enemies ?? [])].filter(b => b.alive).length;
  })();

  return (
    <div style={{
      position: "absolute",
      top: 12,
      right: 12,
      zIndex: 8,
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 0 20px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.15)",
      userSelect: "none",
    }}>
      <canvas
        ref={cvs}
        width={MAP_SIZE}
        height={MAP_SIZE}
        style={{ display: "block" }}
      />
      <EnemyCounter gameRef={gameRef} />
    </div>
  );
}

function EnemyCounter({ gameRef }: { gameRef: React.RefObject<GameInstance | null> }) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const id = setInterval(() => {
      const g = gameRef.current;
      if (!g || !spanRef.current) return;
      const total = [...(g.bots ?? []), ...(g.enemies ?? [])].length;
      const alive = [...(g.bots ?? []), ...(g.enemies ?? [])].filter(b => b.alive).length;
      spanRef.current.textContent = `⚔ Враги: ${alive} / ${total}`;
    }, 250);
    return () => clearInterval(id);
  }, [gameRef]);

  return (
    <div style={{
      background: "rgba(0,0,0,0.75)",
      color: "#FF7777",
      fontSize: 10,
      fontWeight: 800,
      textAlign: "center",
      padding: "3px 8px",
      letterSpacing: 0.5,
      borderTop: "1px solid rgba(255,255,255,0.1)",
    }}>
      <span ref={spanRef}>⚔ Враги: —</span>
    </div>
  );
}
