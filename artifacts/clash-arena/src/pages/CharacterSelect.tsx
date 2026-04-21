import { useState, useEffect, useRef } from "react";
import { BRAWLERS, BrawlerStats, getScaledStats } from "../entities/BrawlerData";
import { getCurrentProfile } from "../utils/localStorageAPI";

interface CharacterSelectProps {
  mode: "showdown" | "crystals";
  onStart: (brawlerId: string) => void;
  onBack: () => void;
}

const SPRITE_COLS = 5;
const SPRITE_ROWS = 2;

export default function CharacterSelect({ mode, onStart, onBack }: CharacterSelectProps) {
  const [selected, setSelected] = useState(0);
  const [profile, setProfile] = useState(getCurrentProfile());
  const [animFrame, setAnimFrame] = useState(0);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const bigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => setProfile(getCurrentProfile()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      spriteRef.current = img;
      setSpriteLoaded(true);
    };
    img.src = "/characters.webp";
  }, []);

  useEffect(() => {
    let raf: number;
    const animate = () => {
      frameRef.current++;
      setAnimFrame(frameRef.current);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!spriteLoaded || !spriteRef.current) return;
    const img = spriteRef.current;
    const sw = img.naturalWidth / SPRITE_COLS;
    const sh = img.naturalHeight / SPRITE_ROWS;

    BRAWLERS.forEach((b, i) => {
      const canvas = canvasRefs.current[i];
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, b.spriteCol * sw, b.spriteRow * sh, sw, sh, 0, 0, canvas.width, canvas.height);
    });
  }, [spriteLoaded, animFrame]);

  useEffect(() => {
    if (!spriteLoaded || !spriteRef.current || !bigCanvasRef.current) return;
    const img = spriteRef.current;
    const sw = img.naturalWidth / SPRITE_COLS;
    const sh = img.naturalHeight / SPRITE_ROWS;
    const brawler = BRAWLERS[selected];
    const canvas = bigCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bounce = Math.sin(frameRef.current * 0.05) * 6;
    const squish = 1 + Math.sin(frameRef.current * 0.07) * 0.03;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + bounce);
    ctx.scale(squish, 1 / squish);

    const glowGrad = ctx.createRadialGradient(0, 40, 0, 0, 40, 100);
    glowGrad.addColorStop(0, `${brawler.color}40`);
    glowGrad.addColorStop(1, "transparent");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(-100, -50, 200, 200);

    ctx.drawImage(
      img,
      brawler.spriteCol * sw,
      brawler.spriteRow * sh,
      sw,
      sh,
      -100,
      -120,
      200,
      200
    );
    ctx.restore();

    const auraPhase = (frameRef.current * 0.04) % (Math.PI * 2);
    ctx.save();
    ctx.globalAlpha = 0.15 + Math.sin(auraPhase) * 0.05;
    ctx.strokeStyle = brawler.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2 + 80, 80 + Math.sin(auraPhase) * 5, 20, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [selected, animFrame, spriteLoaded]);

  const brawler = BRAWLERS[selected];
  const level = profile?.brawlerLevels[brawler.id] || 1;
  const scaled = getScaledStats(brawler, level);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #050020 0%, #0a0040 100%)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        color: "white",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 10px currentColor; } 50% { box-shadow: 0 0 25px currentColor; } }
        ::-webkit-scrollbar { height: 4px; background: rgba(255,255,255,0.05); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={onBack}
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "7px 16px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          ← Back
        </button>
        <h2
          style={{
            flex: 1,
            textAlign: "center",
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            background: "linear-gradient(135deg, #CE93D8, #FFD700)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Choose Your Fighter — {mode === "showdown" ? "Clash Showdown" : "Clash Crystals"}
        </h2>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 30,
          }}
        >
          <canvas
            ref={bigCanvasRef}
            width={300}
            height={280}
            style={{
              borderRadius: 20,
              background: `radial-gradient(circle at center, ${brawler.color}15 0%, transparent 70%)`,
              filter: "drop-shadow(0 0 30px " + brawler.color + "40)",
            }}
          />

          <div style={{ textAlign: "center", marginTop: 10 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: brawler.color, textShadow: `0 0 20px ${brawler.color}` }}>
              {brawler.name}
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", letterSpacing: 2, fontWeight: 600 }}>
              {brawler.role.toUpperCase()} • LVL {level}
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 16,
              padding: "16px 24px",
              width: "100%",
              maxWidth: 340,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px 20px",
            }}
          >
            <Stat label="HP" value={`${scaled.hp}`} max={6200} current={scaled.hp} color="#4CAF50" />
            <Stat label="SPD" value={`${brawler.speed.toFixed(1)}`} max={5.5} current={brawler.speed} color="#40C4FF" />
            <Stat label="DMG" value={`${scaled.attackDamage}`} max={600} current={scaled.attackDamage} color="#FF5252" />
            <Stat label="REGEN" value={`${brawler.regenRate}/s`} max={80} current={brawler.regenRate} color="#CE93D8" />
          </div>

          <div style={{ marginTop: 16, width: "100%", maxWidth: 340 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#40C4FF", fontWeight: 700, letterSpacing: 1 }}>ATTACK: {brawler.attackName}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{brawler.attackDesc}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#FFD700", fontWeight: 700, letterSpacing: 1 }}>SUPER: {brawler.superName}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{brawler.superDesc}</div>
            </div>
          </div>

          <button
            onClick={() => onStart(brawler.id)}
            style={{
              marginTop: 24,
              background: `linear-gradient(135deg, ${brawler.color}, ${brawler.secondaryColor})`,
              border: "none",
              borderRadius: 14,
              padding: "16px 60px",
              color: "white",
              fontWeight: 900,
              fontSize: 18,
              cursor: "pointer",
              letterSpacing: 2,
              boxShadow: `0 6px 30px ${brawler.color}50`,
              transition: "transform 0.15s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-3px) scale(1.03)"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = ""; }}
          >
            INTO BATTLE!
          </button>
        </div>

        <div
          style={{
            width: 420,
            overflowY: "auto",
            padding: "20px 16px",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 2, marginBottom: 12 }}>
            SELECT FIGHTER
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {BRAWLERS.map((b, i) => {
              const lv = profile?.brawlerLevels[b.id] || 1;
              const isSelected = i === selected;
              return (
                <div
                  key={b.id}
                  onClick={() => setSelected(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 14,
                    cursor: "pointer",
                    background: isSelected ? `${b.color}20` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSelected ? b.color + "60" : "rgba(255,255,255,0.06)"}`,
                    transition: "all 0.2s",
                    transform: isSelected ? "translateX(-4px)" : "none",
                  }}
                >
                  <canvas
                    ref={el => { canvasRefs.current[i] = el; }}
                    width={56}
                    height={56}
                    style={{
                      borderRadius: 10,
                      background: `${b.color}15`,
                      flexShrink: 0,
                      imageRendering: "auto",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: isSelected ? b.color : "white" }}>{b.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{b.role}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                      <MiniBar value={getScaledStats(b, lv).hp / 6200} color="#4CAF50" />
                      <MiniBar value={b.speed / 5.5} color="#40C4FF" />
                    </div>
                  </div>
                  <div
                    style={{
                      background: isSelected ? b.color : "rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "3px 9px",
                      fontSize: 11,
                      fontWeight: 800,
                      color: isSelected ? "white" : "rgba(255,255,255,0.4)",
                      flexShrink: 0,
                    }}
                  >
                    LV{lv}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, max, current, color }: { label: string; value: string; max: number; current: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: 1 }}>{label}</span>
        <span style={{ fontSize: 12, color: "white", fontWeight: 700 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
        <div style={{ height: "100%", borderRadius: 2, background: color, width: `${Math.min(100, (current / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
      <div style={{ height: "100%", borderRadius: 2, background: color, width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}
