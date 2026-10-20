import type { Localized } from "@/lib/i18n";

export type ClubEvent = {
  id: string;
  kind: "workshop" | "talk" | "visit" | "competition";
  title: Localized;
  summary: Localized;
  /** ISO date, China Standard Time. Omit for undated past highlights. */
  date?: string;
  location?: Localized;
  image?: string;
};

export const eventKinds: Record<ClubEvent["kind"], Localized> = {
  workshop: { en: "Workshop", zh: "工作坊" },
  talk: { en: "Talk", zh: "讲座" },
  visit: { en: "Visit", zh: "参访" },
  competition: { en: "Challenge", zh: "大赛" },
};

/* Newest first. */
export const events: ClubEvent[] = [
  {
    id: "dic-2026-kickoff",
    kind: "competition",
    date: "2026-11-09T00:00:00+08:00",
    title: { en: "DIC 2026 Kick-off Day", zh: "DIC 2026 开幕式" },
    summary: {
      en: "Theme and tracks briefing, industry talks, a workshop, and the start of Stage 1.",
      zh: "赛道与项目说明、行业分享、工作坊，第一阶段正式开始。",
    },
    location: { en: "NYU Shanghai", zh: "上海纽约大学" },
    image: "/campaign/kickoff-poster.webp",
  },
  {
    id: "sancus-ventures-talk",
    kind: "talk",
    title: {
      en: "Serial entrepreneurship & investing with Lei Du",
      zh: "与杜磊对话：连续创业与投资",
    },
    summary: {
      en: "A partner at Sancus Ventures sat down with twenty-plus students for an afternoon on building and backing companies.",
      zh: "Sancus Ventures 合伙人杜磊与二十多位同学面对面，聊连续创业与投资。",
    },
    location: { en: "NYU Shanghai", zh: "上海纽约大学" },
  },
  {
    id: "idea-to-app-base44",
    kind: "workshop",
    title: { en: "Idea-to-App with base44", zh: "Idea-to-App with base44" },
    summary: {
      en: "An original hands-on workshop: walk in with an idea, walk out with a running app prototype.",
      zh: "原创实践工作坊——带着一个念头进来，带着一个能跑起来的应用原型离开。",
    },
    location: { en: "NYU Shanghai", zh: "上海纽约大学" },
  },
  {
    id: "vibe-coding-workshop",
    kind: "workshop",
    title: { en: "Vibe Coding workshop", zh: "Vibe Coding 工作坊" },
    summary: {
      en: "Building software by describing it — a practical session on AI-assisted development.",
      zh: "用描述来构建软件——一场关于 AI 辅助开发的实践课。",
    },
    location: { en: "NYU Shanghai", zh: "上海纽约大学" },
  },
];
