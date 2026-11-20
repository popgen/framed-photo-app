import { suitDarkness, zonePaint } from "../../lib/game/palette";
import { PX_PER_METER, SANTA_H, SANTA_W, SANTA_X, type Actor, type RunState } from "../../lib/game/simulate";

const SKY: Record<number, { top: string; bottom: string; ground: string; hill: string; accent: string; snow: string }> = {
  1: { top: "#8EC8EE", bottom: "#F4FBFF", ground: "#F7FCFF", hill: "#D5E6C4", accent: "#1C4D3A", snow: "#FFFFFF" },
  2: { top: "#3A2A66", bottom: "#E7A06A", ground: "#E7D7C8", hill: "#6A4E78", accent: "#F2C14E", snow: "#F6E4F2" },
  3: { top: "#14182E", bottom: "#3C4A78", ground: "#D5DCEC", hill: "#2A3358", accent: "#E7C56A", snow: "#E4E9F6" },
  4: { top: "#070608", bottom: "#1A0C10", ground: "#120C0E", hill: "#1A1012", accent: "#C5363C", snow: "#2A181C" },
};

const FLAKES = Array.from({ length: 22 }, (_, index) => ({
  x: (index * 137) % 1000,
  y: (index * 89) % 700,
  r: 1.2 + (index % 3),
  v: 0.35 + (index % 4) * 0.12,
}));

function mix(a: string, b: string, t: number): string {
  const parse = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const left = parse(a);
  const right = parse(b);
  const channels = left.map((value, index) => Math.round(value + ((right[index] ?? value) - value) * t));
  return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
}

function tone(meters: number) {
  const paint = zonePaint(meters);
  const from = SKY[paint.from] ?? SKY[1];
  const to = SKY[paint.to] ?? from;
  return {
    top: mix(from.top, to.top, paint.t),
    bottom: mix(from.bottom, to.bottom, paint.t),
    ground: mix(from.ground, to.ground, paint.t),
    hill: mix(from.hill, to.hill, paint.t),
    accent: mix(from.accent, to.accent, paint.t),
    snow: mix(from.snow, to.snow, paint.t),
    zone: paint.to === paint.from ? paint.from : paint.t > 0.5 ? paint.to : paint.from,
  };
}

function darkenRed(amount: number): string {
  const red = Math.round(197 - amount * 150);
  const green = Math.round(54 - amount * 40);
  const blue = Math.round(60 - amount * 40);
  return `rgb(${red}, ${Math.max(8, green)}, ${Math.max(12, blue)})`;
}

export function drawFrame(ctx: CanvasRenderingContext2D, state: RunState, width: number, height: number): void {
  const meters = state.camera / PX_PER_METER;
  const colors = tone(meters);
  const ground = Math.max(86, Math.min(height * 0.78, height - 28));
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, colors.top);
  sky.addColorStop(1, colors.bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  if (colors.zone >= 3) moon(ctx, width, ground, colors.zone === 4);
  hills(ctx, width, ground, state.camera * 0.18, colors.hill, 26);
  backdrop(ctx, width, ground, state.camera * 0.42, colors);
  hills(ctx, width, ground, state.camera * 0.55, colors.ground, 14);
  groundBand(ctx, width, height, ground, state.camera, colors);
  flakes(ctx, width, ground, colors.snow, colors.zone);

  for (const actor of state.actors) {
    const x = actor.x - state.camera;
    if (x > width + 40 || x + actor.w < -40) continue;
    if (actor.photo) photo(ctx, actor, x, ground);
    else obstacle(ctx, actor, x, ground, state.frame);
  }

  if (!(state.invuln > 0 && state.frame % 8 < 4)) santa(ctx, ground, state.jumper.y, suitDarkness(meters));
}

function moon(ctx: CanvasRenderingContext2D, width: number, ground: number, nightmare: boolean): void {
  const x = width * 0.78;
  const y = Math.max(36, ground * 0.22);
  const radius = nightmare ? 22 : 18;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(nightmare ? -0.45 : -0.18);
  ctx.fillStyle = nightmare ? "#F2E2A8" : "#F7F1C8";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.arc(radius * 0.45, -radius * 0.2, radius * 0.72, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  ctx.restore();
}

function hills(ctx: CanvasRenderingContext2D, width: number, ground: number, shift: number, color: string, amp: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, ground);
  const offset = shift % 220;
  for (let x = -20; x <= width + 20; x += 16) {
    ctx.lineTo(x, ground - 18 - amp * (0.5 + 0.5 * Math.sin((x + offset) * 0.02)));
  }
  ctx.lineTo(width, ground + 2);
  ctx.closePath();
  ctx.fill();
}

function backdrop(ctx: CanvasRenderingContext2D, width: number, ground: number, shift: number, colors: { accent: string; zone: number }): void {
  const step = 120;
  const start = -((shift % step) + step);
  for (let x = start; x < width + step; x += step) {
    if (colors.zone <= 2) pine(ctx, x + 20, ground - 8, 34, colors.accent);
    else houseFar(ctx, x + 10, ground - 6, colors.accent);
  }
}

function pine(ctx: CanvasRenderingContext2D, x: number, foot: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, foot - h);
  ctx.lineTo(x + 16, foot);
  ctx.lineTo(x - 16, foot);
  ctx.fill();
  ctx.fillRect(x - 3, foot, 6, 8);
}

function houseFar(ctx: CanvasRenderingContext2D, x: number, foot: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, foot - 22, 28, 22);
  ctx.beginPath();
  ctx.moveTo(x - 4, foot - 20);
  ctx.lineTo(x + 14, foot - 34);
  ctx.lineTo(x + 32, foot - 18);
  ctx.fill();
}

function groundBand(ctx: CanvasRenderingContext2D, width: number, height: number, ground: number, camera: number, colors: { ground: string; snow: string; accent: string; zone: number }): void {
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, ground, width, height - ground);
  ctx.strokeStyle = colors.zone === 4 ? "#C5363C" : colors.accent;
  ctx.lineWidth = colors.zone === 4 ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(0, ground + 0.5);
  ctx.lineTo(width, ground + 0.5);
  ctx.stroke();
  if (colors.zone === 4) {
    ctx.strokeStyle = "#1C4D3A";
    ctx.beginPath();
    ctx.moveTo(0, ground + 6);
    ctx.lineTo(width, ground + 6);
    ctx.stroke();
  }
  ctx.fillStyle = colors.snow;
  const drift = camera % 48;
  for (let x = -drift; x < width; x += 48) ctx.fillRect(x, ground + 10, 18, 3);
}

function flakes(ctx: CanvasRenderingContext2D, width: number, ground: number, color: string, zone: number): void {
  ctx.fillStyle = color;
  for (const flake of FLAKES) {
    flake.y += flake.v * (zone === 4 ? 0.4 : 1);
    if (flake.y > ground) flake.y = 0;
    const x = (flake.x + width) % width;
    ctx.beginPath();
    ctx.arc(x, flake.y, flake.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function obstacle(ctx: CanvasRenderingContext2D, actor: Actor, x: number, ground: number, frame: number): void {
  const foot = ground - actor.y - actor.h;
  if (actor.kind === "sleigh") sleigh(ctx, x, ground - actor.h, actor.w, actor.h);
  else if (actor.kind === "stump") stump(ctx, x, ground - actor.h, actor.w, actor.h);
  else if (actor.kind === "pine") pine(ctx, x + actor.w / 2, ground, actor.h, "#1C4D3A");
  else if (actor.kind === "snowman") snowman(ctx, x, ground, actor.w, actor.h);
  else if (actor.kind === "reindeer") reindeer(ctx, x, ground - actor.h, actor.w, actor.h);
  else if (actor.kind === "house") gingerbread(ctx, x, ground - actor.h, actor.w, actor.h);
  else if (actor.kind === "hand-snow") glove(ctx, x, ground - actor.h, actor.w, actor.h, false);
  else if (actor.kind === "hand-sky") glove(ctx, x, foot, actor.w, Math.min(actor.h, ground - foot), true);
  else if (actor.kind === "toy") toy(ctx, x, ground - actor.h, actor.w, actor.h);
  else knife(ctx, x, ground - actor.h, actor.w, actor.h, frame);
}

function sleigh(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "#C5363C";
  ctx.beginPath();
  ctx.moveTo(x + 8, y + h);
  ctx.lineTo(x + w - 6, y + h);
  ctx.quadraticCurveTo(x + w, y + h * 0.2, x + w * 0.7, y + 4);
  ctx.lineTo(x + 10, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#6E3B12";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h + 2);
  ctx.quadraticCurveTo(x + w * 0.5, y + h + 8, x + w, y + h + 2);
  ctx.stroke();
}

function stump(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "#6E3B12";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#C4A574";
  ctx.fillRect(x - 2, y, w + 4, 6);
}

function snowman(ctx: CanvasRenderingContext2D, x: number, ground: number, w: number, h: number): void {
  const cx = x + w / 2;
  ctx.fillStyle = "#F7FBFF";
  ctx.beginPath();
  ctx.arc(cx - 2, ground - h * 0.22, w * 0.42, 0, Math.PI * 2);
  ctx.arc(cx + 4, ground - h * 0.62, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#E07020";
  ctx.beginPath();
  ctx.moveTo(cx + 6, ground - h * 0.62);
  ctx.lineTo(cx + 22, ground - h * 0.58);
  ctx.lineTo(cx + 6, ground - h * 0.54);
  ctx.fill();
  ctx.fillStyle = "#241714";
  ctx.fillRect(cx - 2, ground - h * 0.7, 3, 3);
  ctx.fillRect(cx + 8, ground - h * 0.68, 3, 3);
}

function reindeer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "#8A5A32";
  ctx.fillRect(x + 8, y + h * 0.35, w * 0.7, h * 0.4);
  ctx.beginPath();
  ctx.arc(x + w * 0.78, y + h * 0.28, h * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5C3A1E";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.7, y + h * 0.12);
  ctx.lineTo(x + w * 0.62, y);
  ctx.moveTo(x + w * 0.82, y + h * 0.1);
  ctx.lineTo(x + w * 0.92, y);
  ctx.stroke();
  ctx.fillStyle = "#F2C14E";
  ctx.beginPath();
  ctx.arc(x + w * 0.86, y + h * 0.26, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8A5A32";
  ctx.beginPath();
  ctx.moveTo(x + 16, y + h * 0.75);
  ctx.lineTo(x + 12, y + h);
  ctx.moveTo(x + w * 0.55, y + h * 0.75);
  ctx.lineTo(x + w * 0.6, y + h);
  ctx.stroke();
}

function gingerbread(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "#A5683C";
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + 2, y + h * 0.45);
  ctx.lineTo(x + w * 0.45, y + 2);
  ctx.lineTo(x + w - 2, y + h * 0.35);
  ctx.lineTo(x + w, y + h);
  ctx.fill();
  ctx.fillStyle = "#F4F7FB";
  ctx.fillRect(x + w * 0.38, y + h * 0.48, w * 0.22, h * 0.28);
  ctx.fillStyle = "#C5363C";
  ctx.fillRect(x + w * 0.2, y + h * 0.62, 6, 6);
}

function glove(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fromAbove: boolean): void {
  ctx.fillStyle = "#F4E2C0";
  const palm = fromAbove ? y : y + h * 0.35;
  ctx.fillRect(x, palm, w, Math.max(12, h * 0.55));
  for (let finger = 0; finger < 4; finger += 1) {
    const fx = x + 3 + finger * (w / 4.4);
    if (fromAbove) ctx.fillRect(fx, y + h * 0.42, w / 6, h * 0.5);
    else ctx.fillRect(fx, y, w / 6, h * 0.5);
  }
  ctx.fillStyle = "#C5363C";
  ctx.fillRect(x, fromAbove ? y + h * 0.7 : palm, w, 5);
}

function toy(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = "#2E6B4F";
  ctx.fillRect(x, y + 4, w, h - 4);
  ctx.fillStyle = "#C5363C";
  ctx.fillRect(x + w * 0.42, y + 4, w * 0.16, h - 4);
  ctx.fillRect(x, y + h * 0.45, w, h * 0.16);
  ctx.strokeStyle = "#241714";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h);
  ctx.lineTo(x + w - 2, y + 6);
  ctx.stroke();
}

function knife(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: number): void {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(frame * 0.18);
  ctx.fillStyle = "#D9DEE8";
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.48);
  ctx.lineTo(w * 0.28, h * 0.05);
  ctx.lineTo(0, h * 0.46);
  ctx.lineTo(-w * 0.28, h * 0.05);
  ctx.fill();
  ctx.fillStyle = "#1C4D3A";
  ctx.fillRect(-3, -4, 6, 10);
  ctx.restore();
}

function photo(ctx: CanvasRenderingContext2D, actor: Actor, x: number, ground: number): void {
  const y = ground - actor.y - actor.h;
  const golden = actor.photo === "dorado";
  ctx.fillStyle = golden ? "#E2B043" : "#FFFCF8";
  ctx.fillRect(x - 2, y - 2, actor.w + 4, actor.h + 4);
  ctx.fillStyle = "#F6EFE6";
  ctx.fillRect(x, y, actor.w, actor.h);
  if (golden) {
    ctx.strokeStyle = "#F2C14E";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y - 4, actor.w + 8, actor.h + 8);
  }
  scene(ctx, actor.photo ?? "familia", x + 3, y + 3, actor.w - 6, actor.h - 6);
}

function scene(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, w: number, h: number): void {
  if (kind === "perro" || kind === "dorado") {
    ctx.fillStyle = kind === "dorado" ? "#C5363C" : "#8A5A32";
    ctx.beginPath();
    ctx.ellipse(x + w * 0.55, y + h * 0.6, w * 0.32, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w * 0.78, y + h * 0.42, h * 0.16, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (kind === "atardecer") {
    ctx.fillStyle = "#E7A06A";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#F2C14E";
    ctx.beginPath();
    ctx.arc(x + w * 0.7, y + h * 0.4, h * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3A2A66";
    ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
    return;
  }
  const people = kind === "abuelos" || kind === "familia" ? 3 : 1;
  const baby = kind === "bebe";
  for (let index = 0; index < people; index += 1) {
    const px = x + w * (baby ? 0.5 : 0.25 + index * 0.25);
    ctx.fillStyle = index === 1 ? "#C5363C" : "#1C4D3A";
    ctx.beginPath();
    ctx.arc(px, y + h * (baby ? 0.4 : 0.32), baby ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px - 2, y + h * 0.48, 4, baby ? 6 : 8);
  }
}

function santa(ctx: CanvasRenderingContext2D, ground: number, jumpY: number, darkness: number): void {
  const x = SANTA_X;
  const feet = ground - jumpY;
  const top = feet - SANTA_H;
  ctx.fillStyle = darkenRed(darkness);
  ctx.fillRect(x + 6, top + 18, SANTA_W - 12, 22);
  ctx.fillStyle = "#241714";
  ctx.fillRect(x + 6, top + 28, SANTA_W - 12, 4);
  ctx.fillStyle = mix("#F3C7A5", "#3A2420", Math.min(1, darkness));
  ctx.beginPath();
  ctx.arc(x + SANTA_W / 2, top + 14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = mix("#FFFFFF", "#B7B7B7", darkness);
  ctx.beginPath();
  ctx.arc(x + SANTA_W / 2, top + 18, 6, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = darkenRed(darkness);
  ctx.beginPath();
  ctx.moveTo(x + 4, top + 10);
  ctx.lineTo(x + SANTA_W / 2, top - 10);
  ctx.lineTo(x + SANTA_W - 2, top + 10);
  ctx.fill();
  ctx.fillStyle = mix("#FFFFFF", "#C8C8C8", darkness);
  ctx.fillRect(x + 2, top + 8, SANTA_W - 2, 4);
  ctx.beginPath();
  ctx.arc(x + SANTA_W / 2 + 4, top - 8, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#241714";
  ctx.fillRect(x + 6, feet - 6, 8, 6);
  ctx.fillRect(x + 16, feet - 6, 8, 6);
}
