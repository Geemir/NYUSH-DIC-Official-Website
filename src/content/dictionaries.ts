import type { Localized } from "@/lib/i18n";

/**
 * All UI copy, English and Chinese side by side so a missing translation is
 * obvious at a glance. Edition content (theme, tracks, timeline) lives in
 * src/content/data/edition2026.ts instead.
 *
 * Mono labels (the small uppercase "02 / TRACKS" lines) stay in English in
 * both languages on purpose — they are the site's system-UI voice.
 */
const d = <T extends Record<string, Localized>>(v: T) => v;

export const dict = d({
  /* ---- chrome ---- */
  skipToContent: { en: "Skip to content", zh: "跳到主要内容" },
  menu: { en: "Menu", zh: "菜单" },
  close: { en: "Close", zh: "关闭" },
  home: { en: "DIC home", zh: "返回首页" },
  shanghaiTime: { en: "Shanghai time", zh: "上海时间" },
  tbdTitle: { en: "To be confirmed", zh: "待确认" },

  /* ---- hero ---- */
  heroKicker: {
    en: "NYU Shanghai · Digital Innovation Challenge",
    zh: "上海纽约大学 · 数字创新挑战赛",
  },
  heroTitle: { en: "Digital Innovation Challenge", zh: "数字创新挑战赛" },
  heroThemeLabel: { en: "This year's theme", zh: "今年的主题" },
  heroThemeLine: {
    en: "Redefining the Individual Business",
    zh: "重新定义个人商业",
  },
  heroBody: {
    en: "When AI gives one person the power of an entire team, what can you build? Four tracks, two stages, open to students from NYU Shanghai and other universities.",
    zh: "当 AI 让一个人拥有整支团队的能力，你能创造什么？四条赛道、两个阶段，面向上海纽约大学及其他高校的学生开放。",
  },
  ctaRegister: { en: "Enter the Challenge", zh: "报名参赛" },
  ctaTracks: { en: "See the four tracks", zh: "查看四条赛道" },
  ctaJoinTeam: { en: "Join the core team", zh: "加入核心团队" },
  ctaChallenge: { en: "Full challenge details", zh: "查看完整赛制" },

  /* ---- countdown ---- */
  countdownTo: { en: "until Kick-off · Nov 9", zh: "距开幕式 · 11 月 9 日" },
  countdownToday: { en: "Kick-off is today", zh: "今天开幕" },
  countdownPast: { en: "Stage 1 is underway", zh: "第一阶段进行中" },

  /* ---- circuit ---- */
  circuitTitle: { en: "you → a whole team", zh: "一个人 → 一整支团队" },

  /* ---- theme ---- */
  themeHeading: { en: "One person. A whole team's reach.", zh: "一个人，一整支团队的能力。" },

  /* ---- tracks ---- */
  tracksHeading: { en: "Four tracks, one question", zh: "四条赛道，一个问题" },
  trackLabel: { en: "Track", zh: "赛道" },
  exampleLabel: { en: "Example direction", zh: "思考案例" },
  readTrack: { en: "Read the brief", zh: "阅读赛道说明" },

  /* ---- how it works ---- */
  howHeading: { en: "How it works", zh: "赛制" },
  timelineHeading: { en: "Timeline", zh: "时间线" },
  timelineNote: {
    en: "The timeline is subject to change. Dates marked TBD will be confirmed here first.",
    zh: "时间线可能会发生变动。标注「待定」的日期确认后会第一时间在此更新。",
  },
  nowLabel: { en: "Next up", zh: "即将开始" },

  /* ---- readout ---- */
  readoutHeading: { en: "Last edition, by the numbers", zh: "上届大赛数据" },

  /* ---- about ---- */
  aboutHeading: { en: "Diversity makes innovation stronger", zh: "多元让创新更有力量" },
  aboutBodyA: {
    en: "DIC is a student-founded community of builders from computer science, interactive media arts, business and finance, mathematics and data science — asking one question together: what can AI actually solve in the real world? Different academic backgrounds make our format and judging criteria more complete; different regions and cultures make every edition a genuine collision of ideas.",
    zh: "DIC 是一个由学生自发创办的创造者社群，成员来自计算机科学、交互媒体艺术、商科与金融、数学与数据科学等专业，共同追问同一个问题：人工智能能为现实世界解决什么？不同的专业背景，让我们的赛制设计与评审标准更全面；不同的地域与文化背景，则让每一次比赛都成为真正的思想碰撞。",
  },
  aboutBodyB: {
    en: "We have never confined ourselves to one school or one city. Last year competitors from six countries and dozens of universities built alongside us. We want DIC to be a cross-regional stage for innovation — starting at NYU Shanghai, reaching across the Yangtze River Delta, and open to further still.",
    zh: "我们从不把自己局限在一所学校、一座城市。去年，来自六个国家、数十所高校的选手与我们并肩创作。我们想把 DIC 建成一个跨区域的创新舞台：以上海纽约大学为起点，辐射整个长三角，也向更远的地方敞开。",
  },
  deanQuote: {
    en: "This competition has grown beyond our campus into a platform with real international reach — bringing together young innovators from different disciplines and cultures to test ideas in real settings and refine them through teamwork.",
    zh: "这一赛事已经从校内走向校外，正成为更具国际影响力的创新平台——持续汇聚拥有不同学科与文化背景的创新青年，在现实情境中检验创意，在团队合作中完善方案。",
  },
  deanTitle: {
    en: "Dean of Computer Science, Data Science & Engineering, NYU Shanghai",
    zh: "上海纽约大学 计算机科学、数据科学与工程学部 主任",
  },

  /* ---- events ---- */
  eventsHeading: { en: "More than a competition", zh: "不只是一场比赛" },
  eventsBody: {
    en: "Company visits, guest talks and hands-on workshops run all year, and every team gets a mentor to guide their project forward.",
    zh: "企业参访、嘉宾讲座与实践工作坊贯穿全年，每支队伍都配有导师，在项目推进中提供专业指导。",
  },
  viewAllEvents: { en: "All events", zh: "全部活动" },
  upcoming: { en: "Upcoming", zh: "即将举行" },
  undated: { en: "Past", zh: "往期" },

  /* ---- partners ---- */
  partnersHeading: { en: "Partners & judges", zh: "合作伙伴与评审" },
  partnersBody: {
    en: "Last year's judging panel brought together experts from business, art, education and technology, assessing every proposal on originality, practical value and execution — real-world standards, applied to student work. The 2026 line-up will be announced soon.",
    zh: "上届评审团汇聚商业、艺术、教育与科技等领域的专家学者，从创新性、实用价值与整体表现等维度综合评估——让学生的方案接受真实世界标准的检验。2026 年合作伙伴即将公布。",
  },
  partnersLastYear: { en: "DIC 2025 partners", zh: "DIC 2025 合作伙伴" },
  becomePartner: { en: "Partner with us", zh: "成为合作伙伴" },

  /* ---- registration ---- */
  registerHeading: { en: "Register", zh: "报名" },
  registerBody: {
    en: "Registration opens at Kick-off on Nov 9. The sign-up link will appear here and in our WeChat article — follow the official account to be first to know.",
    zh: "报名将于 11 月 9 日开幕式当天开放。报名链接届时会在此处及公众号文章中发布——关注公众号第一时间获取。",
  },
  registerPending: { en: "Sign-up link", zh: "报名链接" },
  registerOpen: { en: "Open the registration form", zh: "打开报名表" },

  /* ---- recruitment ---- */
  joinHeading: { en: "2026 core team recruitment", zh: "2026 DIC 核心团队招新" },
  joinBody: {
    en: "Get inside a team that works fast and keeps it light. Plan campus-wide and cross-university events, build a network across companies, industry veterans and faculty, and pick up multi-platform operations and design along the way.",
    zh: "加入 DIC Team，感受活泼轻快又效率高超的工作氛围。深度参与策划校内与跨校的大型活动，与知名企业、业内前辈、校内教授建立联络，并掌握多平台运营与多媒体设计技能。",
  },

  /* ---- footer ---- */
  footerContact: { en: "Contact", zh: "联系我们" },
  footerFollow: { en: "Follow", zh: "关注我们" },
  footerExplore: { en: "Explore", zh: "站点" },
  footerOrg: {
    en: "A student organization at NYU Shanghai.",
    zh: "上海纽约大学学生组织。",
  },
});

export type DictKey = keyof typeof dict;
