import type { Localized } from "@/lib/i18n";

/**
 * Single source of truth for site-wide facts that change every year.
 * Editing this file is the main thing a new core team needs to do.
 */
export const site = {
  name: "NYU Shanghai Digital Innovation Community",
  shortName: "DIC",
  tagline: "Learning by doing, Changing by creating",

  email: "shanghai.dic@nyu.edu",
  socials: {
    wechat: "NYUSHDIC", // official account; QR lives at public/brand/wechat-qr.png
    instagram: "https://www.instagram.com/nyushdic/",
    linkedin: "https://www.linkedin.com/company/nyushdic",
    xiaohongshu:
      "https://www.xiaohongshu.com/user/profile/64a1341900000000100358af",
  },
} as const;

/** The edition currently being promoted. */
export const currentEdition = {
  year: 2026,
  ordinal: { en: "6th edition", zh: "第六届" } satisfies Localized,

  theme: {
    short: "OPC",
    full: "OPC: Redefining the Individual Business",
  },

  /* Drives the hero countdown. ISO 8601, China Standard Time.
     Date is from the kick-off poster; the start time is not announced yet,
     so this counts to the start of the day. */
  kickoff: "2026-11-09T00:00:00+08:00",

  /* Where the calls-to-action point. Leave blank until the real links exist:
     the buttons then lead to the on-site registration panel, which says
     plainly that registration opens at kick-off. */
  registerUrl: "",
  recruitUrl: "",
} as const;

/** Headline numbers from the most recently completed edition. */
export const headlineStats = {
  year: 2025,
  items: [
    { value: 75, prefix: "", label: { en: "teams competed", zh: "支参赛队伍" } },
    { value: 6, prefix: "", label: { en: "countries", zh: "个国家" } },
    { value: 9, prefix: "", label: { en: "finalist teams", zh: "支决赛队伍" } },
    { value: 5, prefix: "~", label: { en: "months, end to end", zh: "个月赛程" } },
  ],
} as const satisfies {
  year: number;
  items: ReadonlyArray<{ value: number; prefix: string; label: Localized }>;
};

export const navLinks = [
  { path: "/challenge", label: { en: "Challenge", zh: "大赛" } },
  { path: "/events", label: { en: "Events", zh: "活动" } },
  { path: "/archive", label: { en: "Archive", zh: "往届" } },
  { path: "/partners", label: { en: "Partners", zh: "合作伙伴" } },
  { path: "/about", label: { en: "About", zh: "关于我们" } },
] as const;
