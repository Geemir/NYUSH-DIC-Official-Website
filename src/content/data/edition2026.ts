import type { Localized } from "@/lib/i18n";

/**
 * DIC 2026 — source: the 2026 WeChat article copy.
 *
 * Anything wrapped in [[double brackets]] is not confirmed yet. It renders as
 * an amber dashed "TBD" chip. When a value is confirmed, delete the brackets
 * and it becomes ordinary text.
 */

export const theme = {
  intro: {
    en: "The NYU Shanghai Digital Innovation Challenge (NYUSHDIC) is a tech-driven innovation competition hosted by the student organization NYUSH Digital Innovation Community. It is open to students from NYU Shanghai and other universities, and encourages cross-disciplinary teams to use cutting-edge digital technology to tackle real-world challenges.",
    zh: "上海纽约大学数字创新挑战赛（NYUSHDIC）由学生组织 NYUSH Digital Innovation Community 主办，是一项以技术驱动为核心的创新竞赛。比赛面向上海纽约大学及其他高校的学生开放，鼓励跨学科团队携手合作，运用前沿数字技术，提出应对现实世界挑战的创新方案。",
  },
  question: {
    en: "In this revolutionary era, the amplified capability of AI brings new questions. When AI becomes a person's only teammate, can we trust it? And when intelligence leaves the screen and enters the physical world, how will it change the way we live, work, and stay well?",
    zh: "在这个变革的时代，AI 能力被放大的同时，新的问题也随之出现。当 AI 成为一个人唯一的队友，我们能否信任它？当智能走出屏幕、进入真实世界，它又将如何改变我们的生活、工作与健康？",
  },
  invitation: {
    en: "We invite participants to explore, across four tracks, how AI can give individuals team-level capabilities while keeping that power trustworthy, accountable, and human-centered.",
    zh: "我们邀请参赛者围绕四大赛道，探索 AI 如何让个人具备团队级的能力，同时确保这种能力是可信、负责且以人为本的。",
  },
  tracksLead: {
    en: "This year's four tracks explore one question: when AI gives one person the power of an entire team, what can we create? Each team selects one track, identifies key problems or room for improvement, and designs an innovative solution using AI tools.",
    zh: "今年的四条赛道围绕同一个问题展开：当 AI 让一个人拥有整支团队的能力，我们能创造什么？每个团队需选择一条赛道，分析其中的问题或改进空间，并运用 AI 工具设计创新方案。",
  },
} satisfies Record<string, Localized>;

export type TrackIcon = "business" | "shield" | "robot" | "heart";

export type Track2026 = {
  id: string;
  num: string;
  icon: TrackIcon;
  name: Localized;
  /** Short English slug for window title bars. */
  slug: string;
  mission: Localized;
  body: Localized;
  example: { title: string; body: Localized };
};

export const tracks2026: Track2026[] = [
  {
    id: "ai-native-business",
    num: "01",
    icon: "business",
    slug: "ai-native-business",
    name: { en: "AI-Native Business", zh: "AI 原生商业" },
    mission: {
      en: "Empower one person with AI to achieve the systematic capabilities of an entire team.",
      zh: "用 AI 赋能个人，使其具备整支团队的系统化能力。",
    },
    body: {
      en: "Market research, product design, marketing, customer service, finance: work that once took a team of different roles is being taken on, piece by piece, by AI agents. This track explores the one-person company: how can an AI workflow let a single person run a business efficiently and systematically?",
      zh: "市场调研、产品设计、营销推广、客户服务、财务管理……这些曾经需要不同岗位协作完成的工作，正在被 AI 智能体逐一接手。本赛道关注“一人公司”的可能性：如何设计一套 AI 工作流，让一个人也能高效、系统地运营一项业务？",
    },
    example: {
      title: "Base44",
      body: {
        en: "Bootstrapped solo by Maor Shlomo as a side project, AI app builder Base44 was acquired by Wix for $80 million just six months after its founding.",
        zh: "2025 年，独立创始人 Maor Shlomo 未融一分钱、单枪匹马打造的 AI 应用开发平台 Base44，在成立约半年后被 Wix 以 8000 万美元收购。",
      },
    },
  },
  {
    id: "ai-safety-alignment",
    num: "02",
    icon: "shield",
    slug: "ai-safety-alignment",
    name: { en: "AI Safety & Alignment", zh: "AI 安全与对齐" },
    mission: {
      en: "When AI becomes a person's only teammate, build an AI partner that tells the truth and can be held accountable — or develop methods to verify its trustworthiness.",
      zh: "当 AI 成为一个人唯一的队友，打造一个说真话、可问责的 AI 伙伴，或开发验证其可信度的方法。",
    },
    body: {
      en: "Teammates can check each other's work and catch each other's mistakes. When AI is your only teammate, no one double-checks its answers. AI can hallucinate, tell users what they want to hear, or give untraceable advice on critical decisions. This track asks: how do we make AI honest, transparent, and accountable, and how do we prove it deserves our trust?",
      zh: "团队中的同事可以互相核查、彼此提醒；但当 AI 成为唯一的队友，没有人替你检查它的答案。AI 可能出现幻觉、迎合用户，或在关键决策中给出无法追溯的建议。本赛道邀请参赛者思考：如何让 AI 诚实、透明、可问责，又如何证明它值得信任？",
    },
    example: {
      title: "Agentic Misalignment",
      body: {
        en: "Anthropic's tests of 16 leading models found that, when threatened with replacement or facing goal conflicts, many chose harmful actions like blackmail and corporate espionage — though only in controlled simulations.",
        zh: "Anthropic 在模拟公司环境中测试 16 个主流大模型时发现，当面临被替换的威胁或目标冲突时，许多模型会主动选择勒索、商业间谍等有害行为。",
      },
    },
  },
  {
    id: "embodied-ai",
    num: "03",
    icon: "robot",
    slug: "embodied-ai",
    name: { en: "Embodied AI", zh: "具身智能" },
    mission: {
      en: "Enable one person to create AI-powered physical products that once required an entire hardware team, bringing intelligent interaction into the real world.",
      zh: "让一个人就能创造过去需要整支硬件团队才能完成的 AI 实体产品，把智能交互带入现实世界。",
    },
    body: {
      en: "Building a smart device used to require mechanical, electrical, embedded, and interaction design teams working together. Today, with AI-assisted design, open-source hardware, and large models, one person can take a product from prototype to reality. This track invites participants to bring AI off the screen and into physical interaction with people and spaces.",
      zh: "过去，做一件智能硬件需要机械、电子、嵌入式、交互设计等多个团队的协作。如今，借助 AI 辅助设计、开源硬件与大模型，一个人也可以完成从原型到产品的全过程。本赛道鼓励参赛者让 AI 走出屏幕，以实体形式与人和环境互动。",
    },
    example: {
      title: "Apple Vision Pro & Meta Quest 3",
      body: {
        en: "These mixed-reality headsets use SLAM and AI hand tracking to understand physical space in real time — the same perception technology robots rely on to navigate.",
        zh: "这两款混合现实设备借助 SLAM（同步定位与建图）和 AI 手部追踪实时理解物理空间，所用的感知技术与机器人导航一脉相承。",
      },
    },
  },
  {
    id: "ai-healthcare",
    num: "04",
    icon: "heart",
    slug: "ai-x-healthcare",
    name: { en: "AI × Healthcare", zh: "AI × 医疗健康" },
    mission: {
      en: "Empower individuals with AI-driven healthcare support that once required an entire care team, making healthcare more accessible, precise, and compassionate.",
      zh: "用 AI 为个人提供过去需要整个照护团队才能提供的医疗健康支持，让医疗更可及、更精准、更有温度。",
    },
    body: {
      en: "Complete care often involves doctors, nurses, pharmacists, dietitians, and therapists working together, but not everyone has access to that support. This track explores how AI can fill that gap for individuals and families: health support that is always available and personalized, while respecting privacy, safety, and human care.",
      zh: "一次完整的照护往往需要医生、护士、药师、营养师与康复师的共同参与，但并非每个人都能获得这样的支持。本赛道关注 AI 如何为个人和家庭补上这块空缺：让健康支持随时可得、因人而异，同时保持对隐私、安全与人文关怀的重视。",
    },
    example: {
      title: "Ant Afu · 蚂蚁阿福",
      body: {
        en: "Ant Group's AI health app Ant Afu has over 15 million monthly users and answers more than 5 million health questions a day, acting like a family doctor for users and their families.",
        zh: "蚂蚁集团的 AI 健康应用“蚂蚁阿福”月活超 1500 万、每天回答 500 多万个健康问题，像“家庭医生”一样帮助用户管理自己和家人的健康。",
      },
    },
  },
];

export type Phase = {
  num: string;
  name: Localized;
  body: Localized;
  /** Deliverables. [[...]] marks unconfirmed values. */
  items?: Localized[];
};

export const phases: Phase[] = [
  {
    num: "01",
    name: { en: "Stage 1 · Proposal", zh: "第一阶段 · 提案" },
    body: {
      en: "Form a team of up to [[3]] members, choose a track, and develop a proposal. Submissions are due [[one month]] after kick-off and include:",
      zh: "参赛者自由组队，每队最多 [[3]] 名成员，选择一条赛道并发展提案。提交截止日期为开幕式后 [[一个月]]，提交内容包括：",
    },
    items: [
      { en: "A presentation video ([[3–5]] minutes)", zh: "演示视频（[[3–5]] 分钟）" },
      {
        en: "A well-designed proposal showing your understanding of the track's core problem, your unique solution, and its feasibility",
        zh: "一份精心设计的提案，展示团队对赛道问题的理解、独特的解决方案及可行性",
      },
      { en: "Resumes of all team members", zh: "团队成员简历" },
      { en: "[[Other requirements to be announced]]", zh: "[[其他要求待公布]]" },
    ],
  },
  {
    num: "02",
    name: { en: "Stage 2 · Build", zh: "第二阶段 · 打磨" },
    body: {
      en: "Top-ranked teams in each track advance. They may expand their teams, work on real problems from partner companies, and talk directly with their track mentors. Over winter break and the spring semester they refine their solutions into well-structured products, then present at the closing ceremony, where expert judges select the overall champion.",
      zh: "每条赛道排名靠前的队伍将晋级，可以拓展队伍，并有机会深度接入企业赛题、与 Track Mentor 直接交流。晋级团队将在寒假及春季学期继续完善方案，开发结构完整的产品，最终在闭幕式上展示，由专家评审选出总冠军。",
    },
  },
];

export type Milestone = {
  id: string;
  /** ISO date when confirmed. Used to work out which step is current. */
  date?: string;
  /** What to print as the date. [[...]] marks the unconfirmed part. */
  when: Localized;
  title: Localized;
  items?: Localized[];
};

export const milestones: Milestone[] = [
  {
    id: "kickoff",
    date: "2026-11-09T00:00:00+08:00",
    when: { en: "Nov 9 · Mon", zh: "11 月 9 日 · 周一" },
    title: { en: "Kick-off Day", zh: "开幕式" },
    items: [
      { en: "Stage 1 begins", zh: "第一阶段开始" },
      { en: "Track and project briefing", zh: "赛道与项目说明" },
      { en: "Industry talks and workshop", zh: "行业分享与工作坊" },
      { en: "Networking tea break", zh: "交流茶歇" },
    ],
  },
  {
    id: "stage1-deadline",
    when: { en: "Dec [[TBD]]", zh: "12 月 [[待定]]" },
    title: { en: "Stage 1 submission deadline", zh: "第一阶段截止提交" },
  },
  {
    id: "advancing",
    when: { en: "Dec [[TBD]]", zh: "12 月 [[待定]]" },
    title: { en: "Advancing teams announced", zh: "晋级公告发布" },
    items: [
      { en: "Stage 2 begins", zh: "第二阶段开始" },
      { en: "Mentorship from track mentors and experts", zh: "晋级团队获得 Track Mentor 及相关专家的指导" },
    ],
  },
  {
    id: "final",
    when: { en: "2027 · [[TBD]]", zh: "2027 · [[待定]]" },
    title: { en: "Closing ceremony & final", zh: "闭幕式与总决赛" },
  },
];
