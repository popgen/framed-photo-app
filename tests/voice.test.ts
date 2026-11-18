import { describe, expect, it } from "vitest";
import { quote } from "../src/lib/pricing";
import { VOICE_ADDON_CENTS, iosRecorder, newVoiceToken, recorderMime, voicePageUrl } from "../src/lib/voice";
import { voiceQrDataUrl, voiceQrSvg } from "../src/lib/voice-qr";

describe("voice qr", () => {
  it("prices the add-on apart from the frame discount and builds an unguessable url", async () => {
    expect(VOICE_ADDON_CENTS).toBe(500);
    const result = quote({
      items: [
        { unitPriceCents: 5900, kind: "frame" },
        { unitPriceCents: VOICE_ADDON_CENTS, kind: "plain" },
      ],
    });
    expect(result.frameDiscountCents).toBe(0);
    expect(result.totalCents).toBe(6400);
    const token = newVoiceToken();
    expect(token.length).toBeGreaterThan(8);
    expect(voicePageUrl(token, "https://mifotito.com")).toBe(`https://mifotito.com/v/${token}`);
    const png = await voiceQrDataUrl(token, "https://mifotito.com");
    expect(png.startsWith("data:image/png")).toBe(true);
    const svg = await voiceQrSvg(token, "https://mifotito.com");
    expect(svg).toContain("<svg");
  });

  it("picks mp4 on iPhone and webm elsewhere", () => {
    const supported = (type: string) => ["audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm"].includes(type);
    expect(iosRecorder("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(recorderMime(supported, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("audio/mp4");
    expect(recorderMime((type) => type === "audio/aac", "iPhone")).toBe("audio/aac");
    expect(recorderMime(supported, "Mozilla/5.0 (Linux; Android 14)")).toBe("audio/webm;codecs=opus");
    expect(recorderMime(() => false, "iPhone")).toBe("");
  });
});
