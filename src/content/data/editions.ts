import type { Localized } from "@/lib/i18n";

export type Project = {
  team: string;
  title: Localized;
  track: string;
  award?: Localized;
  summary: Localized;
  image?: string;
};

export type Edition = {
  year: number;
  ordinal: Localized;
  theme?: Localized;
  stats: { teams?: number; countries?: number; finalists?: number };
  tracks: Localized[];
  hero?: string;
  gallery: string[];
  projects: Project[];
};

/* Newest first. Only 2025 is partly populated — the earlier four editions
   need team names, winners and photos from the club archive. */
export const editions: Edition[] = [
  {
    year: 2025,
    ordinal: { en: "5th Edition", zh: "第五届" },
    stats: { teams: 75, countries: 6, finalists: 9 },
    tracks: [
      { en: "Education", zh: "教育" },
      { en: "Healthcare", zh: "医疗" },
      { en: "Finance", zh: "金融" },
    ],
    gallery: [],
    projects: [], // TODO: nine finalists + award winners
  },
];
