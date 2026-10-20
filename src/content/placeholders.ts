import type { Locale, Localized } from "@/lib/i18n";

type Stub = {
  /** Mono system label shown above the title. */
  label: string;
  title: Localized;
  intro: Localized;
  planned: Record<Locale, string[]>;
};

/** Copy for routes that are scaffolded but not yet built out. */
export const stubs: Record<string, Stub> = {
  events: {
    label: "Events",
    title: { en: "Events", zh: "活动" },
    intro: {
      en: "Workshops, guest talks and company visits — open to the whole community, not just competitors.",
      zh: "工作坊、嘉宾讲座与企业参访——面向整个社群开放，不限于参赛者。",
    },
    planned: {
      en: [
        "Upcoming events with dates, locations and sign-up links",
        "Past events with photos and recaps",
        "Filter by format: workshop, talk, company visit",
      ],
      zh: [
        "近期活动的时间、地点与报名入口",
        "往期活动的照片与回顾",
        "按形式筛选：工作坊、讲座、企业参访",
      ],
    },
  },
  archive: {
    label: "Archive",
    title: { en: "Archive", zh: "往届回顾" },
    intro: {
      en: "Five editions of the Digital Innovation Challenge, and the projects that came out of them.",
      zh: "数字创新大赛已举办五届，以及从中诞生的作品。",
    },
    planned: {
      en: [
        "One page per edition, newest first",
        "DIC 2025: the education, healthcare and finance tracks, the Stage 2 teams and the awards",
        "DIC 2024 and earlier editions",
        "Innovation Day photo galleries",
        "Judges and partners for each year",
      ],
      zh: [
        "每届单独成页，最新在前",
        "DIC 2025：教育、医疗、金融赛道，第二阶段队伍与获奖名单",
        "DIC 2024 及更早的往届",
        "「创新日」现场照片集",
        "每一届的评审与合作伙伴",
      ],
    },
  },
  partners: {
    label: "Partners",
    title: { en: "Partners & judges", zh: "合作伙伴与评审" },
    intro: {
      en: "The companies, mentors and academics who make the Challenge real — and how to join them.",
      zh: "让大赛成为可能的企业、导师与学者——以及如何加入他们。",
    },
    planned: {
      en: [
        "Partner logos by tier, with a line on what each contributed",
        "Judge and mentor profiles",
        "What sponsorship gets you, with a downloadable one-pager",
        "Direct contact for partnership enquiries",
      ],
      zh: [
        "按合作层级展示伙伴标识，附各自的支持内容",
        "评审与导师介绍",
        "赞助权益说明，附可下载的合作方案",
        "合作洽谈的直接联系方式",
      ],
    },
  },
  about: {
    label: "About DIC",
    title: { en: "About DIC", zh: "关于 DIC" },
    intro: {
      en: "A student-founded community at NYU Shanghai, built on the belief that diversity makes innovation stronger.",
      zh: "一个由上海纽约大学学生自发创办的社群，我们相信：多元让创新更有力量。",
    },
    planned: {
      en: [
        "How DIC started and where it is heading",
        "The multidisciplinary story, told properly",
        "Faculty support and the Dean's endorsement",
        "The 2026 core team",
      ],
      zh: [
        "DIC 的起源与未来方向",
        "完整讲述跨学科的故事",
        "教师支持与学部主任的评价",
        "2026 核心团队",
      ],
    },
  },
  join: {
    label: "Join us",
    title: { en: "Join the core team", zh: "加入核心团队" },
    intro: {
      en: "2026 core team recruitment. Plan the events, build the network, run the Challenge.",
      zh: "2026 核心团队招新。策划活动、建立网络、运营大赛。",
    },
    planned: {
      en: [
        "Open roles and what each one actually does",
        "What you get: access, network, skills, and a steep growth curve",
        "Recruitment timeline and interview process",
        "Application form",
      ],
      zh: [
        "开放岗位及其真实职责",
        "你将获得：资源、人脉、技能，以及陡峭的成长曲线",
        "招新时间线与面试流程",
        "申请表单",
      ],
    },
  },
};
