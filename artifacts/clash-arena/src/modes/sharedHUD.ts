import { Brawler } from "../entities/Brawler";

export function renderPlayerHUD(ctx: CanvasRenderingContext2D, player: Brawler): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(10, 10, 200, 70);

  ctx.fillStyle = "white";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "left";
  ctx.fillText(player.stats.name, 20, 30);

  const hpRatio = player.hp / player.maxHp;
  const r = Math.floor(255 * (1 - hpRatio));
  const g = Math.floor(255 * hpRatio);
  ctx.fillStyle = `rgb(${r},${g},0)`;
  ctx.fillRect(20, 38, 180 * hpRatio, 10);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 38, 180, 10);

  ctx.fillStyle = player.superReady ? "#FFD700" : "#7986CB";
  ctx.fillRect(20, 52, 180 * (player.superCharge / player.maxSuperCharge), 8);
  ctx.strokeRect(20, 52, 180, 8);

  ctx.fillStyle = player.superReady ? "#FFD700" : "rgba(255,255,255,0.5)";
  ctx.font = "bold 11px Arial";
  ctx.fillText(player.superReady ? "СУПЕР ГОТОВ! [E]" : "Заряжаем супер...", 20, 73);

  const charges = player.attackCharges;
  const maxCharges = player.maxAttackCharges;
  const chargeX = 600 - (maxCharges * 25) / 2;
  for (let i = 0; i < maxCharges; i++) {
    ctx.fillStyle = i < charges ? player.stats.accentColor : "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.arc(chargeX + i * 30, 775, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "11px Arial";
  ctx.textAlign = "center";
  ctx.fillText("WASD: движение | ЛКМ: атака | ПКМ/E: супер", 600, 760);
  ctx.restore();
}
