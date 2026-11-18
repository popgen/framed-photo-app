import { frames } from "./catalog";

export const RETABLO_ID = "retablo-verdad";

export const retabloOffer = {
  id: RETABLO_ID,
  purchasable: false as const,
  title: "¿Quieres un retablo de verdad?",
  card: "Pregúntanos por nuestro retablo de verdad",
  body: "Un retablo de madera de tres hojas, hecho a mano al estilo de Ayacucho. Lucas lo arma para ti, con tus fotos o la escena que imagines. No se compra en el carrito.",
  question: "¿De qué tamaño lo imaginas?",
  suggestions: ["Chico, de mesa", "Mediano, para la sala", "Grande, a la medida"],
};

export type RetabloInquiry = {
  id: string;
  size: string;
  status: "new" | "contacted" | "closed";
  createdAt: string;
};

export function canPurchaseFrame(id: string): boolean {
  return id !== RETABLO_ID && frames.some((frame) => frame.id === id);
}

export function inquiryFromSize(size: string, now = new Date().toISOString(), id = ""): RetabloInquiry {
  const trimmed = size.trim();
  if (trimmed.length < 2 || trimmed.length > 280) throw new Error("Cuéntanos el tamaño en una frase.");
  return { id, size: trimmed, status: "new", createdAt: now };
}

export const RETABLO_EMAIL = "pedidos@mifotito.com";

export function retabloMessage(size: string): string {
  return `Hola Mi Fotito, quiero un retablo de verdad. Lo imagino de este tamaño: ${size.trim()}`;
}

export function retabloMailUrl(size: string): string {
  const subject = "Pedido de retablo";
  return `mailto:${RETABLO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(retabloMessage(size))}`;
}
