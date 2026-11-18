import type { Zone } from "./cutoff";

const LIMA_METRO = [
  "Ancón",
  "Ate",
  "Barranco",
  "Breña",
  "Carabayllo",
  "Chaclacayo",
  "Chorrillos",
  "Cieneguilla",
  "Comas",
  "El Agustino",
  "Independencia",
  "Jesús María",
  "La Molina",
  "La Victoria",
  "Lima",
  "Lince",
  "Los Olivos",
  "Lurigancho",
  "Lurín",
  "Magdalena del Mar",
  "Miraflores",
  "Pachacámac",
  "Pucusana",
  "Pueblo Libre",
  "Puente Piedra",
  "Punta Hermosa",
  "Punta Negra",
  "Rímac",
  "San Bartolo",
  "San Borja",
  "San Isidro",
  "San Juan de Lurigancho",
  "San Juan de Miraflores",
  "San Luis",
  "San Martín de Porres",
  "San Miguel",
  "Santa Anita",
  "Santa María del Mar",
  "Santa Rosa",
  "Santiago de Surco",
  "Surquillo",
  "Villa El Salvador",
  "Villa María del Triunfo",
];

const CALLAO = ["Callao", "Bellavista", "La Perla", "La Punta", "Carmen de la Legua-Reynoso", "Ventanilla", "Mi Perú"];

export const DEPARTMENTS = [
  "Amazonas",
  "Áncash",
  "Apurímac",
  "Arequipa",
  "Ayacucho",
  "Cajamarca",
  "Callao",
  "Cusco",
  "Huancavelica",
  "Huánuco",
  "Ica",
  "Junín",
  "La Libertad",
  "Lambayeque",
  "Lima",
  "Loreto",
  "Madre de Dios",
  "Moquegua",
  "Pasco",
  "Piura",
  "Puno",
  "San Martín",
  "Tacna",
  "Tumbes",
  "Ucayali",
];

const ALIASES: Record<string, string> = {
  surco: "santiago de surco",
  magdalena: "magdalena del mar",
  "cercado de lima": "lima",
  "san juan lurigancho": "san juan de lurigancho",
};

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

const METRO = new Set(LIMA_METRO.map(fold));

export function districtsFor(department: string): string[] {
  const dep = fold(department);
  if (dep === "lima") return LIMA_METRO;
  if (dep === "callao") return CALLAO;
  return [];
}

export function shippingZone(department: string, district: string): Zone {
  const dep = fold(department);
  const raw = fold(district);
  const dist = ALIASES[raw] ?? raw;
  if (dep === "callao") return "lima";
  if (dep === "lima" && METRO.has(dist)) return "lima";
  return "provinces";
}
