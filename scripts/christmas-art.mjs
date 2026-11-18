const THEMES = {
  "nieve-celeste": { fill: "#C5E4F5", edge: "#8ECAE6" },
  "acebo-clasico": { fill: "#8E1E2A", edge: "#F2D48A" },
  "estrellas-oro": { fill: "#F6E7C4", edge: "#C4922A" },
  "retablo-ayacucho": { fill: "#7A1E33", edge: "#F2C14E" },
  "aguayo-andino": { fill: "#1C1A17", edge: "#F4F1EA" },
  "noche-nevada": { fill: "#14243F", edge: "#E8D48B" },
  "pino-rustico": { fill: "#C4924A", edge: "#5C3A1E" },
};

export function geometry(frame) {
  const W = 1000;
  const border = frame.border;
  const H = Math.round((W * frame.outerHcm) / frame.outerWcm);
  const left = (border.left / frame.outerWcm) * W;
  const right = (border.right / frame.outerWcm) * W;
  const top = (border.top / frame.outerHcm) * H;
  const bottom = (border.bottom / frame.outerHcm) * H;
  return { W, H, left, right, top, bottom, ox: left, oy: top, ow: W - left - right, oh: H - top - bottom };
}

export function christmasSvg(frame) {
  const theme = THEMES[frame.id];
  if (!theme) throw new Error(`Sin arte navideño para ${frame.id}`);
  const g = geometry(frame);
  const deco = draw(frame.id, g);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${g.W}" height="${g.H}" viewBox="0 0 ${g.W} ${g.H}">
  <path fill="${theme.fill}" fill-rule="evenodd" d="M0 0 H${g.W} V${g.H} H0 Z M${g.ox} ${g.oy} H${g.ox + g.ow} V${g.oy + g.oh} H${g.ox} Z"/>
  ${deco}
  <rect x="3" y="3" width="${g.W - 6}" height="${g.H - 6}" fill="none" stroke="${theme.edge}" stroke-width="5"/>
  <rect x="${g.ox}" y="${g.oy}" width="${g.ow}" height="${g.oh}" fill="none" stroke="#1A120E" stroke-opacity="0.35" stroke-width="7"/>
</svg>`;
}

function draw(id, g) {
  if (id === "nieve-celeste") return nieve(g);
  if (id === "acebo-clasico") return acebo(g);
  if (id === "estrellas-oro") return oro(g);
  if (id === "retablo-ayacucho") return retablo(g);
  if (id === "aguayo-andino") return aguayo(g);
  if (id === "noche-nevada") return noche(g);
  return pino(g);
}

function circle(cx, cy, r, fill) {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}"/>`;
}

function n(value) {
  return Math.round(value * 10) / 10;
}

function flake(cx, cy, r, color) {
  let lines = "";
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * i) / 3;
    lines += `<line x1="${n(cx)}" y1="${n(cy)}" x2="${n(cx + Math.cos(a) * r)}" y2="${n(cy + Math.sin(a) * r)}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
  }
  return lines + circle(cx, cy, r * 0.16, color);
}

function star(cx, cy, r, fill) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${n(cx + Math.cos(a) * radius)},${n(cy + Math.sin(a) * radius)}`);
  }
  return `<polygon points="${points.join(" ")}" fill="${fill}"/>`;
}

function tree(cx, base, h) {
  const w = h * 0.72;
  const y1 = base - h;
  const y2 = base - h * 0.62;
  const y3 = base - h * 0.28;
  return [
    `<polygon points="${n(cx)},${n(y1)} ${n(cx - w * 0.42)},${n(y2)} ${n(cx + w * 0.42)},${n(y2)}" fill="#1F6B3A"/>`,
    `<polygon points="${n(cx)},${n(y2 - h * 0.08)} ${n(cx - w * 0.5)},${n(y3)} ${n(cx + w * 0.5)},${n(y3)}" fill="#2E8B4A"/>`,
    `<polygon points="${n(cx)},${n(y3 - h * 0.08)} ${n(cx - w * 0.56)},${n(base - h * 0.08)} ${n(cx + w * 0.56)},${n(base - h * 0.08)}" fill="#166534"/>`,
    `<rect x="${n(cx - w * 0.08)}" y="${n(base - h * 0.12)}" width="${n(w * 0.16)}" height="${n(h * 0.14)}" fill="#6B3A1F"/>`,
    circle(cx, y2, h * 0.05, "#F2D48A"),
    circle(cx - w * 0.16, y3, h * 0.045, "#C5363C"),
    circle(cx + w * 0.18, y3 + h * 0.02, h * 0.045, "#F4F1EA"),
  ].join("");
}

function snowman(cx, base, h) {
  const r1 = h * 0.22;
  const r2 = h * 0.16;
  const r3 = h * 0.11;
  const c1 = base - r1;
  const c2 = c1 - r1 - r2 + 2;
  const c3 = c2 - r2 - r3 + 2;
  return [
    circle(cx, c1, r1, "#F7FBFF"),
    circle(cx, c2, r2, "#F7FBFF"),
    circle(cx, c3, r3, "#F7FBFF"),
    circle(cx - r3 * 0.35, c3 - r3 * 0.1, r3 * 0.12, "#241714"),
    circle(cx + r3 * 0.35, c3 - r3 * 0.1, r3 * 0.12, "#241714"),
    `<path d="M${n(cx)} ${n(c3 + r3 * 0.15)} l${n(r3 * 0.7)} ${n(r3 * 0.15)} l${n(-r3 * 0.7)} ${n(r3 * 0.15)}" fill="#E07A3D"/>`,
    `<rect x="${n(cx - r3 * 0.7)}" y="${n(c3 - r3 * 1.15)}" width="${n(r3 * 1.4)}" height="${n(r3 * 0.38)}" fill="#241714"/>`,
    `<rect x="${n(cx - r3 * 0.35)}" y="${n(c3 - r3 * 1.7)}" width="${n(r3 * 0.7)}" height="${n(r3 * 0.6)}" fill="#241714"/>`,
    `<path d="M${n(cx - r2)} ${n(c2)} h${n(r2 * 2.1)}" stroke="#C5363C" stroke-width="${n(Math.max(4, h * 0.035))}" fill="none"/>`,
  ].join("");
}

function holly(cx, cy, s) {
  return [
    `<ellipse cx="${n(cx - s * 0.35)}" cy="${n(cy)}" rx="${n(s * 0.48)}" ry="${n(s * 0.22)}" fill="#1F6B3A" transform="rotate(-28 ${n(cx - s * 0.35)} ${n(cy)})"/>`,
    `<ellipse cx="${n(cx + s * 0.35)}" cy="${n(cy)}" rx="${n(s * 0.48)}" ry="${n(s * 0.22)}" fill="#2E8B4A" transform="rotate(28 ${n(cx + s * 0.35)} ${n(cy)})"/>`,
    circle(cx, cy + s * 0.08, s * 0.16, "#F2E6C9"),
    circle(cx + s * 0.2, cy - s * 0.12, s * 0.13, "#C5363C"),
    circle(cx - s * 0.16, cy + s * 0.18, s * 0.12, "#E24B4B"),
  ].join("");
}

function nieve(g) {
  const parts = [];
  for (let i = 0; i < 16; i += 1) {
    const x = 16 + ((g.W - 32) * i) / 15;
    const y = 8 + (i % 4) * (g.top / 5);
    if (y < g.top - 4) parts.push(circle(x, y, 2.5 + (i % 3), "#FFFFFF"));
  }
  parts.push(flake(g.left * 0.5, g.top * 0.42, 16, "#FFFFFF"));
  parts.push(flake(g.W - g.right * 0.5, g.top * 0.48, 13, "#FFFFFF"));
  const span = g.H - g.top - g.bottom;
  for (let i = 0; i < 7; i += 1) {
    const y = g.top + 16 + (span * i) / 6;
    parts.push(circle(g.left * 0.42, y, 3, "#FFFFFF"));
    parts.push(circle(g.W - g.right * 0.4, y, 2.6, "#FFFFFF"));
  }
  const base = g.H - 12;
  const h = g.bottom - 28;
  parts.push(tree(g.ox + g.ow * 0.3, base, h));
  parts.push(snowman(g.ox + g.ow * 0.68, base, h));
  parts.push(flake(g.ox + g.ow * 0.5, g.H - g.bottom + 18, 11, "#FFFFFF"));
  return parts.join("");
}

function acebo(g) {
  const s = Math.min(g.left, g.top) * 0.85;
  const parts = [
    holly(g.left * 0.55, g.top * 0.5, s),
    holly(g.W - g.right * 0.55, g.top * 0.5, s),
    holly(g.left * 0.55, g.H - g.bottom * 0.48, s),
    holly(g.W - g.right * 0.55, g.H - g.bottom * 0.48, s),
  ];
  const y = g.top * 0.55;
  for (let i = 0; i < 5; i += 1) {
    const x = g.left + 20 + ((g.ow - 40) * i) / 4;
    parts.push(circle(x, y, 8, i % 2 ? "#F2D48A" : "#F4F1EA"));
    parts.push(`<line x1="${n(x)}" y1="${n(y - 16)}" x2="${n(x)}" y2="${n(y)}" stroke="#F2D48A" stroke-width="2"/>`);
  }
  return parts.join("");
}

function oro(g) {
  const parts = [];
  const garland = (y, amp) => {
    const d = [`M${n(g.left + 8)} ${n(y)}`];
    for (let i = 1; i <= 8; i += 1) {
      const x = g.left + ((g.W - g.left - g.right) * i) / 8;
      d.push(`Q ${n(x - (g.ow / 16))} ${n(y + amp)} ${n(x)} ${n(y)}`);
    }
    return `<path d="${d.join(" ")}" fill="none" stroke="#2E8B4A" stroke-width="5"/>`;
  };
  parts.push(garland(g.top - 16, 10));
  parts.push(garland(g.H - g.bottom + 18, -10));
  parts.push(star(g.left * 0.5, g.top * 0.4, 16, "#C4922A"));
  parts.push(star(g.W - g.right * 0.48, g.top * 0.42, 14, "#E2B44A"));
  parts.push(star(g.W / 2, g.top * 0.55, 18, "#C4922A"));
  parts.push(star(g.left * 0.48, g.H - g.bottom * 0.45, 13, "#E2B44A"));
  parts.push(star(g.W - g.right * 0.5, g.H - g.bottom * 0.42, 15, "#C4922A"));
  return parts.join("");
}

function retablo(g) {
  const parts = [];
  parts.push(circle(g.W / 2, g.top * 0.42, 16, "#F2C14E"));
  parts.push(`<rect x="${n(g.ox)}" y="${n(g.top - 10)}" width="${n(g.ow)}" height="8" fill="#F2C14E"/>`);
  const ground = g.H - 10;
  const sceneTop = g.H - g.bottom + 8;
  parts.push(`<rect x="8" y="${n(sceneTop)}" width="${n(g.W - 16)}" height="${n(ground - sceneTop)}" fill="#F4D35E"/>`);
  parts.push(`<path d="M12 ${n(sceneTop + 28)} L${n(g.W * 0.22)} ${n(sceneTop + 4)} L${n(g.W * 0.4)} ${n(sceneTop + 28)} Z" fill="#2E6B8A"/>`);
  parts.push(`<path d="M${n(g.W * 0.55)} ${n(sceneTop + 30)} L${n(g.W * 0.75)} ${n(sceneTop + 2)} L${n(g.W * 0.95)} ${n(sceneTop + 30)} Z" fill="#3E8C78"/>`);
  const figure = (x) =>
    [
      `<polygon points="${n(x)},${n(ground - 8)} ${n(x - 14)},${n(ground - 36)} ${n(x + 14)},${n(ground - 36)}" fill="#C5363C"/>`,
      circle(x, ground - 44, 7, "#F2C9A0"),
    ].join("");
  parts.push(figure(g.W * 0.38));
  parts.push(figure(g.W * 0.5));
  parts.push(figure(g.W * 0.62));
  const span = g.H - g.top - g.bottom;
  for (let i = 0; i < 6; i += 1) {
    const y = g.top + 18 + (span * i) / 5;
    parts.push(circle(g.left * 0.5, y, 7, i % 2 ? "#2EC4B6" : "#F2C14E"));
    parts.push(circle(g.W - g.right * 0.5, y, 7, i % 2 ? "#E24B8A" : "#F4F1EA"));
  }
  return parts.join("");
}

function aguayo(g) {
  const colors = ["#C5363C", "#FFFFFF", "#C5363C", "#F2A03D", "#1F6B3A", "#F4E04D", "#E24B8A"];
  const parts = [];
  const topH = (g.top - 10) / colors.length;
  colors.forEach((color, index) => {
    parts.push(`<rect x="0" y="${n(4 + index * topH)}" width="${g.W}" height="${n(topH + 0.6)}" fill="${color}"/>`);
  });
  const botH = (g.bottom - 10) / colors.length;
  colors.forEach((color, index) => {
    parts.push(`<rect x="0" y="${n(g.H - g.bottom + 4 + index * botH)}" width="${g.W}" height="${n(botH + 0.6)}" fill="${color}"/>`);
  });
  const sideColors = ["#C5363C", "#FFFFFF", "#1F6B3A", "#F2A03D"];
  const sideW = (g.left - 8) / sideColors.length;
  sideColors.forEach((color, index) => {
    parts.push(`<rect x="${n(4 + index * sideW)}" y="${n(g.top)}" width="${n(sideW + 0.6)}" height="${n(g.oh)}" fill="${color}"/>`);
    parts.push(`<rect x="${n(g.W - g.right + 4 + index * sideW)}" y="${n(g.top)}" width="${n(sideW + 0.6)}" height="${n(g.oh)}" fill="${color}"/>`);
  });
  const base = g.H - g.bottom * 0.18;
  const lh = g.bottom * 0.62;
  const lx = g.W / 2;
  parts.push(
    `<path d="M${n(lx - lh * 0.7)} ${n(base)} q${n(lh * 0.15)} ${n(-lh * 0.55)} ${n(lh * 0.45)} ${n(-lh * 0.5)} q${n(lh * 0.35)} ${n(lh * 0.05)} ${n(lh * 0.7)} ${n(-lh * 0.15)} q${n(lh * 0.12)} ${n(lh * 0.25)} ${n(-lh * 0.05)} ${n(lh * 0.35)} q${n(lh * 0.2)} ${n(-lh * 0.05)} ${n(lh * 0.28)} ${n(lh * 0.12)} l${n(-lh * 0.1)} ${n(lh * 0.2)} q${n(-lh * 0.45)} ${n(lh * 0.05)} ${n(-lh * 0.7)} ${n(-lh * 0.02)} z" fill="#3A2416"/>`,
  );
  parts.push(circle(lx + lh * 0.42, base - lh * 0.62, 7, "#3A2416"));
  return parts.join("");
}

function noche(g) {
  const parts = [];
  const spots = [
    [g.left * 0.45, g.top * 0.4, 14],
    [g.W * 0.3, g.top * 0.7, 10],
    [g.W * 0.7, g.top * 0.55, 12],
    [g.W - g.right * 0.45, g.top * 0.38, 13],
    [g.left * 0.4, g.H * 0.4, 9],
    [g.W - g.right * 0.42, g.H * 0.55, 11],
    [g.W * 0.25, g.H - g.bottom * 0.55, 10],
    [g.W * 0.78, g.H - g.bottom * 0.4, 12],
  ];
  for (const [x, y, r] of spots) {
    if (y < g.top - 2 || y > g.H - g.bottom + 4 || x < g.left - 2 || x > g.W - g.right + 2) parts.push(flake(x, y, r, "#F4F7FF"));
  }
  const base = g.H - 16;
  const w = Math.min(g.ow * 0.46, 280);
  const h = g.bottom - 30;
  const x = g.W / 2;
  parts.push(`<path d="M${n(x - w / 2)} ${n(base - h * 0.35)} h${n(w)} l${n(-w * 0.08)} ${n(h * 0.28)} h${n(-w * 0.84)} z" fill="#C5363C"/>`);
  parts.push(`<path d="M${n(x - w * 0.42)} ${n(base - h * 0.35)} l${n(w * 0.16)} ${n(-h * 0.28)} h${n(w * 0.22)} l${n(w * 0.08)} ${n(h * 0.28)}" fill="#F2D48A"/>`);
  parts.push(`<path d="M${n(x - w * 0.48)} ${n(base)} q${n(w * 0.08)} ${n(-h * 0.18)} ${n(w * 0.2)} 0 q${n(w * 0.12)} ${n(h * 0.16)} ${n(w * 0.24)} 0 q${n(w * 0.12)} ${n(-h * 0.16)} ${n(w * 0.24)} 0 q${n(w * 0.12)} ${n(h * 0.16)} ${n(w * 0.22)} 0" fill="none" stroke="#E8D48B" stroke-width="4"/>`);
  parts.push(star(x + w * 0.28, base - h * 0.72, 10, "#F2D48A"));
  return parts.join("");
}

function pino(g) {
  const parts = [];
  const sprig = (cx, cy, s, flip) => {
    const dir = flip ? -1 : 1;
    return [
      `<polygon points="${n(cx)},${n(cy)} ${n(cx + dir * s)},${n(cy - s * 0.45)} ${n(cx + dir * s * 0.2)},${n(cy)}" fill="#1F6B3A"/>`,
      `<polygon points="${n(cx + dir * s * 0.15)},${n(cy)} ${n(cx + dir * s * 1.05)},${n(cy + s * 0.35)} ${n(cx + dir * s * 0.2)},${n(cy + s * 0.15)}" fill="#2E8B4A"/>`,
    ].join("");
  };
  parts.push(sprig(g.left * 0.2, g.top * 0.7, Math.min(g.left, g.top) * 0.7, false));
  parts.push(sprig(g.W - g.right * 0.2, g.top * 0.65, Math.min(g.right, g.top) * 0.7, true));
  parts.push(sprig(g.left * 0.25, g.H - g.bottom * 0.35, g.bottom * 0.28, false));
  parts.push(sprig(g.W - g.right * 0.25, g.H - g.bottom * 0.4, g.bottom * 0.28, true));
  const lights = ["#F2D48A", "#C5363C", "#F4F1EA", "#2E8B4A"];
  for (let i = 0; i < 8; i += 1) {
    const x = g.left + 16 + ((g.ow - 32) * i) / 7;
    parts.push(circle(x, g.top - 12, 6, lights[i % lights.length]));
    parts.push(circle(x, g.H - g.bottom + 14, 6, lights[(i + 1) % lights.length]));
  }
  return parts.join("");
}
