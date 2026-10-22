/*
 * What the registration asks, and the lists it chooses from.
 *
 * The site builds the "About you" step from GET /api/form, so a question
 * changed here changes everywhere at once: the form, the checks, the admin
 * table and the Excel export. Answers are stored as JSON, so adding or
 * removing a question needs no database change.
 *
 * Track ids and names match _data/dic2026.yml (the page content).
 */

export const TRACKS = [
  { id: "track-01", en: "AI-Native Business", zh: "AI 原生商业" },
  { id: "track-02", en: "AI Safety & Alignment", zh: "AI 安全与对齐" },
  { id: "track-03", en: "Embodied AI", zh: "具身智能" },
  { id: "track-04", en: "AI × Healthcare", zh: "AI × 医疗健康" },
];

export const SKILLS = [
  { value: "coding", en: "Coding", zh: "编程开发" },
  { value: "ai", en: "AI & data", zh: "AI 与数据" },
  { value: "design", en: "Design", zh: "设计" },
  { value: "product", en: "Product", zh: "产品" },
  { value: "business", en: "Business", zh: "商业" },
  { value: "hardware", en: "Hardware", zh: "硬件" },
  { value: "research", en: "Research", zh: "研究" },
  { value: "health", en: "Healthcare", zh: "医疗健康" },
  { value: "media", en: "Writing & media", zh: "写作与传播" },
];

/*
 * "About you". Types: text, tel, select (one of `options`), tags (several of
 * `options`, at most `max`). `suggest` offers quick answers for a text field.
 */
export const PROFILE_FIELDS = [
  {
    key: "name", type: "text", required: true, max: 60,
    label: { en: "Full name", zh: "姓名" },
  },
  {
    key: "school", type: "text", required: true, max: 100,
    label: { en: "School / university", zh: "学校" },
    suggest: [{ value: "NYU Shanghai", en: "NYU Shanghai", zh: "上海纽约大学" }],
  },
  {
    key: "program", type: "text", required: true, max: 100,
    label: { en: "Major / program", zh: "专业" },
  },
  {
    key: "year", type: "select", required: true,
    label: { en: "Year of study", zh: "年级" },
    options: [
      { value: "y1", en: "Year 1", zh: "大一" },
      { value: "y2", en: "Year 2", zh: "大二" },
      { value: "y3", en: "Year 3", zh: "大三" },
      { value: "y4", en: "Year 4", zh: "大四" },
      { value: "master", en: "Master's", zh: "硕士" },
      { value: "phd", en: "PhD", zh: "博士" },
      { value: "graduated", en: "Graduated", zh: "已毕业" },
      { value: "other", en: "Other", zh: "其他" },
    ],
  },
  {
    key: "wechat", type: "text", required: true, max: 40,
    label: { en: "WeChat ID", zh: "微信号" },
    hint: { en: "So we can add you to the participants' WeChat group.", zh: "用于邀请你加入参赛者微信群。" },
  },
  {
    key: "phone", type: "tel", required: false, max: 30,
    label: { en: "Phone", zh: "手机号" },
  },
  {
    key: "skills", type: "tags", required: false, max: 4, options: SKILLS,
    label: { en: "What you're good at", zh: "擅长领域" },
    hint: { en: "Up to 4. Shown to teammates, and on Team-up if you post there.", zh: "最多 4 项。会显示给队友；如果你在组队广场发帖，也会显示在帖子里。" },
  },
  {
    key: "source", type: "select", required: false,
    label: { en: "How did you hear about DIC?", zh: "你是从哪里了解到 DIC 的？" },
    options: [
      { value: "wechat", en: "WeChat article", zh: "微信公众号" },
      { value: "xiaohongshu", en: "Xiaohongshu", zh: "小红书" },
      { value: "friend", en: "A friend", zh: "朋友或同学" },
      { value: "class", en: "A class or professor", zh: "课堂或老师" },
      { value: "poster", en: "A poster", zh: "海报" },
      { value: "other", en: "Somewhere else", zh: "其他" },
    ],
  },
];

/* Team and project details (step 2 and 3 of the form). */
export const TEAM_FIELDS = {
  name: { max: 40, label: { en: "Team name", zh: "队名" } },
  track: { label: { en: "Track", zh: "赛道" } },
  repo_url: { max: 300, label: { en: "Repository link", zh: "代码仓库链接" } },
  project_title: { max: 80, label: { en: "Project name", zh: "项目名称" } },
  project_summary: { max: 300, label: { en: "One-line idea", zh: "一句话介绍" } },
};

/* Discussion channels on the Team-up page: one lobby, one per track. */
export const CHANNELS = [
  { id: "lobby", en: "Lobby", zh: "大厅" },
  ...TRACKS.map((t) => ({ id: t.id, en: t.en, zh: t.zh })),
];
