import navidad from "../../data/campaign.json";
import sanValentin from "../../data/campaign-san-valentin.json";

export type Campaign = {
  id: string;
  name: string;
  seasonalMotion: boolean;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  cta: string;
  occasionName: string;
  timezone: string;
  countdownStartsAt?: string;
  cutoffs: { lima: string; provinces: string };
  nextOccasion: { name: string; dateLabel: string; dateISO: string };
  giftWrapFeatured: boolean;
  giftWrapTitle: string;
  giftWrapBody: string;
  guaranteeYes: string;
  guaranteeNo: string;
  successTitle: string;
  successBody: string;
};

export const defaultCampaign = navidad as Campaign;
export const campaignPresets: Record<string, Campaign> = {
  "navidad-2026": navidad as Campaign,
  "san-valentin-2027": sanValentin as Campaign,
};

export function countdownVisible(
  now: Date,
  campaign: { countdownStartsAt?: string | null },
  flag: string | undefined = process.env.EXPO_PUBLIC_COUNTDOWN,
): boolean {
  const value = flag?.trim().toLowerCase();
  if (value === "0" || value === "false" || value === "off") return false;
  if (value === "1" || value === "true" || value === "on") return true;
  if (!campaign.countdownStartsAt) return false;
  return now.getTime() >= new Date(campaign.countdownStartsAt).getTime();
}

export function motionEnabled(campaign: { seasonalMotion: boolean }): boolean {
  const flag = process.env.EXPO_PUBLIC_SEASONAL_MOTION;
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  return campaign.seasonalMotion;
}

export function ornamentKind(campaign: { id: string }): "navidad" | "hearts" | "none" {
  if (campaign.id.startsWith("navidad")) return "navidad";
  if (campaign.id.startsWith("san-valentin")) return "hearts";
  return "none";
}
