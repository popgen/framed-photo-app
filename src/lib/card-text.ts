export const CARD_TEXT_MIN_PT = 9;
export const CARD_TEXT_MIN_PX = 11;

export type TextMeasure = (text: string, size: number) => number;

export function layoutCardText(
  text: string,
  boxW: number,
  boxH: number,
  measure: TextMeasure,
  preferred: number,
  minSize: number,
): { size: number; lines: string[]; leading: number } {
  const maxWidth = boxW * 0.84;
  const maxHeight = boxH * 0.86;
  let size = Math.max(minSize, Math.min(preferred, boxH * 0.2));
  let lines = wrapMeasured(text, measure, size, maxWidth);
  while (lines.length * size * 1.2 > maxHeight && size > minSize) {
    const next = Math.max(minSize, Math.round(size * 0.92 * 10) / 10);
    if (next === size) break;
    size = next;
    lines = wrapMeasured(text, measure, size, maxWidth);
  }
  return { size, lines, leading: size * 1.2 };
}

export function wrapMeasured(text: string, measure: TextMeasure, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      for (const piece of breakWord(word, measure, size, maxWidth)) {
        if (line && /^[,.;:!?¡¿)\]»]+$/.test(piece)) {
          line = `${line}${piece}`;
          continue;
        }
        const next = line ? `${line} ${piece}` : piece;
        if (line && measure(next, size) > maxWidth) {
          lines.push(line);
          line = piece;
        } else line = next;
      }
    }
    lines.push(line);
  }
  return gluePunctuation(lines.length ? lines : [""]);
}

function gluePunctuation(lines: string[]): string[] {
  const glued: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const mark = line.match(/^[,.;:!?¡¿)\]»]+/)?.[0] ?? "";
    if (glued.length && mark) {
      glued[glued.length - 1] = `${glued[glued.length - 1]}${mark}`;
      const rest = line.slice(mark.length).trim();
      if (rest) glued.push(rest);
      continue;
    }
    glued.push(line);
  }
  return glued.length ? glued : [""];
}

function breakWord(word: string, measure: TextMeasure, size: number, maxWidth: number): string[] {
  if (measure(word, size) <= maxWidth) return [word];
  const parts: string[] = [];
  let current = "";
  for (const char of word) {
    const next = current + char;
    if (current && measure(next, size) > maxWidth) {
      parts.push(current);
      current = char;
    } else current = next;
  }
  if (current) parts.push(current);
  return parts.length ? parts : [word];
}
