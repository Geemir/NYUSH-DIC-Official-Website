import type { Localized } from "@/lib/i18n";

export type Partner = {
  id: string;
  name: Localized;
  /** Path under /public. TODO: add SVG or transparent PNG for each. */
  logo?: string;
  url?: string;
  tier: "sponsor" | "track" | "academic";
};

/* DIC 2025 partners. The 2026 line-up has not been announced. */
export const partners: Partner[] = [
  { id: "tencent", name: { en: "Tencent", zh: "腾讯" }, tier: "sponsor" },
  { id: "henlius", name: { en: "Henlius", zh: "复宏汉霖" }, tier: "track" },
  { id: "chillprep", name: { en: "ChillPrep", zh: "躺着学" }, tier: "track" },
  { id: "kiwi", name: { en: "Kiwi", zh: "Kiwi" }, tier: "track" },
  { id: "shinytest", name: { en: "Shinytest", zh: "Shinytest" }, tier: "track" },
  { id: "dku", name: { en: "Duke Kunshan University", zh: "昆山杜克大学" }, tier: "academic" },
];

export type Judge = {
  id: string;
  name: Localized;
  title: Localized;
  org: Localized;
  photo?: string;
  bio?: Localized;
};

/* TODO: fill in from the last Innovation Day judging panel. */
export const judges: Judge[] = [];
