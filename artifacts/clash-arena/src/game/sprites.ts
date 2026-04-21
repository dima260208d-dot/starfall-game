export interface SpriteSheet {
  image: HTMLImageElement;
  loaded: boolean;
}

const sheet: SpriteSheet = {
  image: new Image(),
  loaded: false,
};

export function loadSpriteSheet(src: string): Promise<void> {
  return new Promise((resolve) => {
    sheet.image.onload = () => {
      sheet.loaded = true;
      resolve();
    };
    sheet.image.onerror = () => {
      sheet.loaded = false;
      resolve();
    };
    sheet.image.src = src;
  });
}

export function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  row: number,
  col: number,
  x: number,
  y: number,
  size: number,
  flipX = false,
  alpha = 1,
  glowColor?: string
): void {
  if (!sheet.loaded) return;

  const imgW = sheet.image.naturalWidth;
  const imgH = sheet.image.naturalHeight;

  const cols = 5;
  const rows = 2;
  const sw = imgW / cols;
  const sh = imgH / rows;

  const sx = col * sw;
  const sy = row * sh;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
  }

  if (flipX) {
    ctx.scale(-1, 1);
    ctx.drawImage(sheet.image, sx, sy, sw, sh, -size / 2, -size / 2, size, size);
  } else {
    ctx.drawImage(sheet.image, sx, sy, sw, sh, -size / 2, -size / 2, size, size);
  }
  ctx.restore();
}

export function drawFallbackCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  secondaryColor: string,
  accentColor: string,
  animFrame: number
): void {
  ctx.save();
  ctx.translate(x, y);

  const bounce = Math.sin(animFrame * 0.1) * 2;

  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, bounce, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = secondaryColor;
  ctx.beginPath();
  ctx.arc(-radius * 0.3, bounce - radius * 0.15, radius * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(radius * 0.3, bounce - radius * 0.15, radius * 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-radius * 0.15, bounce + radius * 0.15, radius * 0.2, 0, Math.PI);
  ctx.stroke();

  ctx.restore();
}
