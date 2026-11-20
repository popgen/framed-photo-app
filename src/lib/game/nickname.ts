const FOLDED = [
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "shit",
  "bullshit",
  "bitch",
  "bastard",
  "asshole",
  "dickhead",
  "cunt",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "porn",
  "puta",
  "puto",
  "putos",
  "putas",
  "mierda",
  "joder",
  "cojones",
  "cabron",
  "cabrona",
  "gilipollas",
  "pendejo",
  "pendeja",
  "chingar",
  "chingada",
  "verga",
  "culero",
  "culera",
  "maricon",
  "marica",
  "zorra",
  "hijodeputa",
  "hijaputa",
  "conchuda",
  "conchetumare",
  "ctm",
  "ptm",
  "weon",
  "huevon",
  "huevona",
  "pelotudo",
  "pelotuda",
  "boludo",
  "forro",
  "pajero",
  "malparido",
  "gonorrea",
  "imbecil",
];

const NICK_PATTERN = /^[\p{L}\p{N} ]{2,20}$/u;

export function normalizeNickname(raw: string): string {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function foldNickname(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[5$]/g, "s")
    .replace(/7/g, "t")
    .replace(/[^a-z]/g, "");
}

export function nicknameProblem(raw: string): string | null {
  const name = normalizeNickname(raw);
  if (!NICK_PATTERN.test(name)) return "El apodo necesita entre 2 y 20 letras o números.";
  const folded = foldNickname(name);
  if (FOLDED.some((word) => folded.includes(word))) return "Ese apodo no se puede mostrar. Elige otro.";
  return null;
}
