import commerce from "../../data/commerce.json";
import { siteUrl } from "./env";
import { uid } from "./ids";

export const VOICE_ADDON_CENTS = (commerce as { voiceAddonCents?: number }).voiceAddonCents ?? 500;
export const VOICE_MAX_SECONDS = 60;
export const VOICE_MAX_BYTES = 8 * 1024 * 1024;
export const VOICE_ACCEPT = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/x-m4a", "audio/mp3"];

export type VoiceNote = {
  token: string;
  audioId: string;
  seconds: number;
  mime: string;
  addonCents: number;
  selfieId?: string | null;
  selfiePath?: string | null;
  senderName?: string | null;
};

const KEY = "recuerdo-voice-";

export function newVoiceToken(): string {
  return uid("v_").replace(/[^a-z0-9]/gi, "").slice(0, 20);
}

export function voicePageUrl(token: string, origin = siteUrl()): string {
  return `${origin.replace(/\/$/, "")}/v/${token}`;
}

export function publishVoice(note: VoiceNote): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`${KEY}${note.token}`, JSON.stringify(note));
}

export function readVoice(token: string): VoiceNote | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(`${KEY}${token}`);
  if (!raw) return null;
  try {
    const note = JSON.parse(raw) as VoiceNote;
    if (!note?.token || !note.audioId) return null;
    return note;
  } catch {
    return null;
  }
}

export function recorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) return "audio/webm;codecs=opus";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "";
}
