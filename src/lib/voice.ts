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

export function voiceStorageKey(token: string): string {
  return `${KEY}${token}`;
}

export function isVoiceDraftKey(key: string): boolean {
  return key.startsWith(KEY) && key.length > KEY.length;
}

export function voicePageUrl(token: string, origin = siteUrl()): string {
  return `${origin.replace(/\/$/, "")}/v/${token}`;
}

export function publishVoice(note: VoiceNote): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(voiceStorageKey(note.token), JSON.stringify(note));
}

export function readVoice(token: string): VoiceNote | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(voiceStorageKey(token));
  if (!raw) return null;
  try {
    const note = JSON.parse(raw) as VoiceNote;
    if (!note?.token || !note.audioId) return null;
    return note;
  } catch {
    return null;
  }
}

export function iosRecorder(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

export function recorderMime(supported?: (type: string) => boolean, userAgent = ""): string {
  const can = supported ?? ((type: string) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
  const agent = userAgent || (typeof navigator === "undefined" ? "" : navigator.userAgent);
  const order = iosRecorder(agent) ? ["audio/mp4", "audio/aac"] : ["audio/webm;codecs=opus", "audio/webm"];
  return order.find((type) => can(type)) ?? "";
}
