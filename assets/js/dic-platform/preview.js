/*
 * Preview mode: the real API (server/src) running inside this browser, so
 * the team can try Registration, Team-up and the admin page before the API
 * is deployed. The database is SQLite compiled to WebAssembly (sql.js, in
 * assets/js/lib/sql-wasm/), saved in this browser's storage after every
 * change. Nothing is sent anywhere.
 *
 * Differences from the real thing: sign-in codes are shown on the page
 * instead of emailed, everyone is an organiser, the assistant is a stand-in
 * that repeats the question, and Team-up starts with sample cards from
 * made-up people (all marked "example").
 */
const KEY = "dic-preview-db";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(s);
  });
}

function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function startPreview(base) {
  const lib = `${base}assets/js/lib/sql-wasm/`;
  if (!window.initSqlJs) await loadScript(`${lib}sql-wasm-browser.js`);
  const SQL = await window.initSqlJs({ locateFile: (file) => lib + file });

  let saved = null;
  try {
    const b64 = localStorage.getItem(KEY);
    if (b64) saved = fromBase64(b64);
  } catch { /* storage blocked: a fresh database each visit */ }
  const db = new SQL.Database(saved || undefined);
  db.exec(await (await fetch(`${base}server/schema.sql`)).text());
  if (!saved) seed(db);

  /* Saved a moment after the last change, and straight away when the page
     is left, so a click to another page never loses the last change. */
  let timer = null;
  const write = () => {
    timer = null;
    try { localStorage.setItem(KEY, toBase64(db.export())); } catch { /* full or blocked */ }
  };
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(write, 250);
  };
  const flush = () => { if (timer) { clearTimeout(timer); write(); } };
  addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  save();

  const [{ createApp }, { configFromEnv }, { fromSqlJs }] = await Promise.all([
    import(`${base}server/src/app.js`), import(`${base}server/src/config.js`), import(`${base}server/src/db.js`),
  ]);
  const config = configFromEnv({ DIC_ENV: "development", DEV_RETURN_CODE: "1", EMAIL_PROVIDER: "none", BOT_PROVIDER: "echo" });
  config.everyoneAdmin = true;
  const app = createApp({ config, db: fromSqlJs(db, save) });
  return (path, init) => app.fetch(new Request(`https://preview.invalid${path}`, init), { ip: "preview" });
}

export function resetPreview() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem("dic-preview-token");
  } catch { /* nothing stored */ }
}

/* ------------------------------------------------------------ sample data */
function seed(db) {
  const now = Date.now();
  const H = 3600000;
  const run = (sql, ...params) => db.run(sql, params);

  const people = [
    ["u_example1", "alex@example.invalid", "Alex (example)", { name: "Alex Wang (example)", school: "NYU Shanghai", program: "Computer Science", year: "y3", wechat: "lumen-example", skills: ["coding", "ai"], source: "wechat" }, "t_example1", "submitted"],
    ["u_example5", "jia@example.invalid", "Jia (example)", { name: "Jia Li (example)", school: "NYU Shanghai", program: "Data Science", year: "y2", wechat: "jiali-example", skills: ["ai", "research"], source: "friend" }, "t_example1", "submitted"],
    ["u_example2", "mia@example.invalid", "Mia (example)", { name: "Mia Chen (example)", school: "NYU Shanghai", program: "Global China Studies", year: "y2", wechat: "mia-example", skills: ["research", "media"], source: "xiaohongshu" }, null, "submitted"],
    ["u_example3", "chen@example.invalid", "陈同学（示例）", { name: "陈思远（示例）", school: "上海交通大学", program: "电子信息工程", year: "y3", wechat: "robot-example", skills: ["hardware", "coding"], source: "poster" }, "t_example2", "submitted"],
    ["u_example4", "leo@example.invalid", "Leo (example)", { name: "Leo Zhang (example)", school: "NYU Shanghai", program: "Business and Computer Science", year: "y4", wechat: "leo-example", skills: ["product", "business"], source: "class" }, null, "draft"],
  ];
  people.forEach(([id, email, display, profile, team, status], i) => {
    const t = now - (80 - i * 6) * H;
    run("INSERT INTO users (id, email, display_name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)", id, email, display, t, t);
    run(`INSERT INTO participants (user_id, profile, team_choice, team_id, track_pref, status, consent_at, submitted_at, joined_team_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, JSON.stringify(profile), team ? "team" : id === "u_example2" ? "none" : "", team, id === "u_example2" ? "track-02" : "",
      status, status === "submitted" ? t : null, status === "submitted" ? t + H : null, team ? t : null, t, t);
  });
  run(`INSERT INTO teams (id, code, name, track, captain_id, repo_url, project_title, project_summary, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, "t_example1", "LUMEN2", "Lumen (example)", "track-04", "u_example1",
    "https://github.com/example/lumen", "Lumen: a medication companion", "An AI companion that keeps a family's care plan on track.", now - 80 * H, now - 70 * H);
  run(`INSERT INTO teams (id, code, name, track, captain_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    "t_example2", "DESKBT", "Desk Buddy（示例）", "track-03", "u_example3", now - 62 * H, now - 62 * H);

  const posts = [
    ["p_example1", "u_example1", "team", "track-04", "Health team looking for a designer",
      "We're two CS students building an AI companion that helps families keep track of an older parent's medication and check-ups. We'd love a teammate who enjoys interface design and talking to users.",
      ["design", "research"], "WeChat: lumen-example", 3],
    ["p_example2", "u_example2", "solo", "track-02", "Social science student, curious about honest AI",
      "I study Global China Studies and want to test whether AI assistants admit when they're unsure. I can do research, interviews and writing, and I'm looking for teammates who code.",
      ["research", "media"], "WeChat: mia-example", 26],
    ["p_example3", "u_example3", "team", "track-03", "找一位会硬件的队友 / Hardware teammate wanted",
      "我们想用 ESP32 和大模型做一个桌面陪伴机器人，现在缺一位会焊接、懂传感器的同学。\nWe're building a desk companion robot with an ESP32 and a large model, and need someone at home with soldering and sensors.",
      ["hardware", "coding"], "微信：robot-example", 50],
    ["p_example4", "u_example4", "solo", "any", "Product person, open to any track",
      "Business and CS double major. I like turning messy ideas into a plan and a pitch. Happy to join a team that has builders but needs someone for product and the final presentation.",
      ["product", "business"], "", 96],
  ];
  for (const [id, user, kind, track, title, body, skills, contact, hoursAgo] of posts) {
    const t = now - hoursAgo * H;
    run(`INSERT INTO posts (id, user_id, kind, track, title, body, skills, contact, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, user, kind, track, title, body, JSON.stringify(skills), contact, t, t);
  }
  run("INSERT INTO replies (id, post_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)", "r_example1", "p_example1", "u_example4",
    "Hi! I'm not a designer, but I've run user interviews before. Happy to chat.", now - 2 * H);

  const messages = [
    ["lobby", "u_example2", "Hi everyone! Anyone else interested in the AI Safety track?", 5],
    ["lobby", "u_example3", "大家好，我们队在做具身智能方向，欢迎来聊！", 4],
    ["lobby", "u_example1", "Welcome! See you all at Kick-off Day.", 3],
    ["track-02", "u_example2", "Has anyone read the Agentic Misalignment study mentioned on the track page?", 20],
  ];
  for (const [channel, user, body, hoursAgo] of messages) {
    run("INSERT INTO messages (channel, user_id, body, created_at) VALUES (?, ?, ?, ?)", channel, user, body, now - hoursAgo * H);
  }
}
