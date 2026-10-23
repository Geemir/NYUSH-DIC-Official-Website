/*
 * Shared by the platform pages: signing in with an emailed code, the
 * display name for Team-up and chat, the "signed in as" line, and the
 * banners for preview mode and for "opening soon".
 */
import { api, session, mode, base, leavePreview } from "./api.js";
import { h, t, append, clear, win, dialog, setStatus, errorPair, busy, toast } from "./ui.js";

/* ------------------------------------------------------------------ sign in */
/*
 * Email → 6-digit code → signed in. onDone(user) runs after signing in.
 * In preview (and on a development server) the code is shown on the page,
 * because no email is sent.
 */
export function signInForm({ onDone, focus = true }) {
  const box = h("div.d-signin");
  let address = "";

  function askEmail() {
    const input = h("input.d-input#signin-email", {
      type: "email", name: "email", autocomplete: "email", inputmode: "email", required: true,
      value: address, placeholder: "name@school.edu", "aria-describedby": "signin-email-hint",
    });
    const status = h("p.d-status", { role: "alert" });
    const send = h("button.d-btn.d-btn--primary", { type: "submit" }, t({ en: "Email me a code", zh: "发送验证码" }), " →");
    const form = h("form.d-form", { novalidate: true },
      h("div.d-field",
        h("label.d-field__label", { for: "signin-email" }, t({ en: "Your email", zh: "你的邮箱" })),
        input,
        h("p.d-field__hint#signin-email-hint", t({
          en: "We'll email you a 6-digit code: no password needed. Use an address you check often; it's where we'll reach you about DIC.",
          zh: "我们会向你的邮箱发送 6 位验证码，无需设置密码。请使用常用邮箱，之后的比赛通知也会发到这里。",
        }))),
      status,
      h("div.d-actions", send));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      busy(send, async () => {
        setStatus(status, null);
        try {
          const r = await session.sendCode(input.value);
          address = r.email;
          askCode(r.devCode);
        } catch (err) {
          setStatus(status, errorPair(err));
          input.focus();
        }
      });
    });
    clear(box).append(form);
    if (focus) input.focus();
  }

  function askCode(devCode) {
    const input = h("input.d-input.d-input--code#signin-code", {
      name: "code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: 6, required: true,
      placeholder: "000000", "aria-describedby": "signin-code-hint",
    });
    const status = h("p.d-status", { role: "alert" });
    const verify = h("button.d-btn.d-btn--primary", { type: "submit" }, t({ en: "Sign in", zh: "登录" }), " →");
    const resend = h("button.d-link", { type: "button" });
    let wait = 60;
    const tick = () => {
      clear(resend).append(wait > 0
        ? t({ en: `Send a new code (${wait}s)`, zh: `重新发送（${wait} 秒）` })
        : t({ en: "Send a new code", zh: "重新发送验证码" }));
      resend.disabled = wait > 0;
    };
    tick();
    const timer = setInterval(() => {
      wait -= 1;
      tick();
      if (wait <= 0 || !resend.isConnected) clearInterval(timer);
    }, 1000);

    const form = h("form.d-form", { novalidate: true },
      h("div.d-field",
        h("label.d-field__label", { for: "signin-code" }, t({ en: "6-digit code", zh: "6 位验证码" })),
        input,
        h("p.d-field__hint#signin-code-hint", t({
          en: `We sent it to ${address}. It works for 10 minutes. Nothing there? Check your spam folder.`,
          zh: `验证码已发送至 ${address}，10 分钟内有效。没有收到？请查看垃圾邮件。`,
        }))),
      devCode ? h("p.d-devcode", t(mode === "preview"
        ? { en: `Preview: no email is sent. Your code is ${devCode}.`, zh: `预览模式不发送邮件，你的验证码是 ${devCode}。` }
        : { en: `Development server: your code is ${devCode}.`, zh: `开发环境：你的验证码是 ${devCode}。` })) : null,
      status,
      h("div.d-actions",
        h("button.d-link", { type: "button", on: { click: () => { clearInterval(timer); askEmail(); } } }, t({ en: "Use another email", zh: "换一个邮箱" })),
        resend,
        verify));

    const submit = () => busy(verify, async () => {
      setStatus(status, null);
      try {
        const user = await session.verify(address, input.value);
        clearInterval(timer);
        if (onDone) await onDone(user);
      } catch (err) {
        setStatus(status, errorPair(err));
        input.select();
      }
    });
    form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 6);
      if (input.value.length === 6) submit();
    });
    resend.addEventListener("click", () => busy(resend, async () => {
      try {
        const r = await session.sendCode(address);
        clearInterval(timer);
        askCode(r.devCode);
        toast({ en: "A new code is on its way.", zh: "新的验证码已发送。" });
      } catch (err) {
        setStatus(status, errorPair(err));
      }
    }));
    clear(box).append(form);
    input.focus();
  }

  askEmail();
  return box;
}

/* The sign-in form in a window. Resolves with the user, or null if closed. */
export function signInDialog() {
  return new Promise((resolve) => {
    let user = null;
    const d = dialog({
      title: "SIGN_IN.EXE",
      body: [
        h("p.d-dialog__text", t({ en: "Sign in to post, reply and chat.", zh: "登录后即可发帖、回复和聊天。" })),
        signInForm({ onDone: (u) => { user = u; d.close(); } }),
      ],
      onClose: () => resolve(user),
    });
  });
}

export async function requireSignIn() {
  return session.user || signInDialog();
}

/* -------------------------------------------------------------- the name */
/* Team-up and chat show a display name; asks for one if it's missing. */
export async function requireName() {
  const user = await requireSignIn();
  if (!user || user.displayName) return user;
  return nameDialog();
}

export function nameDialog() {
  return new Promise((resolve) => {
    let result = null;
    const current = session.user && session.user.displayName;
    const input = h("input.d-input#display-name", { name: "displayName", maxlength: 24, required: true, value: current || "", autocomplete: "nickname" });
    const status = h("p.d-status", { role: "alert" });
    const save = h("button.d-btn.d-btn--primary", { type: "submit" }, t({ en: "Save", zh: "保存" }));
    const form = h("form.d-form", { novalidate: true },
      h("div.d-field",
        h("label.d-field__label", { for: "display-name" }, t({ en: "Display name", zh: "显示名称" })),
        input,
        h("p.d-field__hint", t({ en: "Shown on your cards and messages. 2–24 characters; a nickname is fine.", zh: "会显示在你的卡片和消息旁，2–24 个字符，可以用昵称。" }))),
      status,
      h("div.d-actions", save));
    const d = dialog({ title: "DISPLAY_NAME.EXE", body: form, onClose: () => resolve(result) });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      busy(save, async () => {
        try {
          const r = await api("PATCH", "/api/me", { displayName: input.value });
          session.update(r.user);
          result = r.user;
          d.close();
        } catch (err) {
          setStatus(status, errorPair(err));
        }
      });
    });
    input.focus();
  });
}

/* ------------------------------------------------------------ the account */
/* "Signed in as …", sign out, and the organisers' link for admins. */
export function accountBar() {
  const bar = h("div.d-account");
  const draw = (user) => {
    clear(bar);
    bar.hidden = !user;
    if (!user) return;
    append(bar,
      h("span.d-account__who", t({ en: "Signed in as", zh: "已登录：" }), " ", h("b", user.email)),
      user.admin && !/\/admin\/?$/.test(location.pathname)
        ? h("a.d-link", { href: `${base}DIC2026/admin/` }, t({ en: "Organiser dashboard", zh: "组委会后台" }), " →")
        : null,
      h("button.d-link", { type: "button", on: { click: () => session.signOut() } }, t({ en: "Sign out", zh: "退出登录" })));
  };
  session.onChange(draw);
  draw(session.user);
  return bar;
}

/* ------------------------------------------------------------- banners */
export function previewBanner() {
  if (mode !== "preview") return null;
  const reset = async () => {
    (await import("./preview.js")).resetPreview();
    location.reload();
  };
  return h("div.d-preview", { role: "note" },
    h("p", h("b.d-preview__tag", "PREVIEW"), " ", t({
      en: "The real system isn't live yet. Everything here runs inside your browser and stays there: sign-in codes appear on screen, sample cards fill Team-up, and you're an organiser too, so you can try the admin page.",
      zh: "正式系统尚未上线。此页面的一切都在你的浏览器内运行，数据不会发送到任何地方：验证码会直接显示在屏幕上，组队广场里是示例卡片；你也拥有组委会权限，可以试用后台页面。",
    })),
    h("p.d-preview__actions",
      h("a.d-link", { href: `${base}DIC2026/admin/` }, t({ en: "Admin page", zh: "后台页面" })),
      h("button.d-link", { type: "button", on: { click: reset } }, t({ en: "Reset sample data", zh: "重置示例数据" })),
      h("button.d-link", { type: "button", on: { click: leavePreview } }, t({ en: "Leave preview", zh: "退出预览" }))));
}

/* "Opening soon", with the page's own wording (a <template> in the page). */
export function soonPanel(templateId, title) {
  const tpl = document.getElementById(templateId);
  return win(title,
    h("p.d-soon__tag.d-mono", h("i", { "aria-hidden": "true" }), "COMING SOON"),
    h("div.d-pair.d-soon__text", tpl ? tpl.content.cloneNode(true) : ""),
    h("p.d-soon__more", h("a.d-btn.d-btn--ghost", { href: `${base}DIC2026/` }, t({ en: "Back to DIC 2026", zh: "返回 DIC 2026" }))));
}
