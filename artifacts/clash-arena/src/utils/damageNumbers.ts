export interface DamageNumber {
  x: number;
  y: number;
  value: number;
  timer: number;
  maxTimer: number;
  type: "damage" | "heal" | "player";
  color: string;
}

const damageNumbers: DamageNumber[] = [];

export function spawnDamageNumber(
  x: number, y: number, value: number,
  type: "damage" | "heal" | "player" = "damage"
): void {
  damageNumbers.push({
    x,
    y,
    value,
    timer: 1.2,
    maxTimer: 1.2,
    type,
    color: type === "damage" ? "#FF4444" : type === "heal" ? "#FFD700" : "#FFFFFF",
  });
}

export function updateDamageNumbers(dt: number): void {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    damageNumbers[i].timer -= dt;
    damageNumbers[i].y -= 25 * dt;
    if (damageNumbers[i].timer <= 0) {
      damageNumbers.splice(i, 1);
    }
  }
}

export function renderDamageNumbers(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
  for (const dn of damageNumbers) {
    const alpha = Math.min(1, dn.timer / (dn.maxTimer * 0.5));
    const scale = 1 + (1 - dn.timer / dn.maxTimer) * 0.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${Math.floor(16 * scale)}px Arial`;
    ctx.fillStyle = dn.color;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 3;
    const screenX = dn.x - camX;
    const screenY = dn.y - camY;
    const text = dn.type === "heal" ? `+${dn.value}` : `${dn.value}`;
    ctx.strokeText(text, screenX, screenY);
    ctx.fillText(text, screenX, screenY);
    ctx.restore();
  }
}

export function clearDamageNumbers(): void {
  damageNumbers.length = 0;
}
