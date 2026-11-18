import QRCode from "qrcode";
import { voicePageUrl } from "./voice";

export async function voiceQrDataUrl(token: string, origin?: string): Promise<string> {
  return QRCode.toDataURL(voicePageUrl(token, origin), {
    width: 512,
    margin: 1,
    color: { dark: "#241714", light: "#FFFCF9" },
  });
}

export async function voiceQrSvg(token: string, origin?: string): Promise<string> {
  return QRCode.toString(voicePageUrl(token, origin), { type: "svg", margin: 1 });
}
