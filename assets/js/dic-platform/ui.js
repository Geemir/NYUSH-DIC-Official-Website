/*
 * DOM and language helpers for the DIC 2026 platform pages.
 *
 * Nothing a visitor types is ever parsed as HTML: h() and t() set text with
 * textContent, so names, cards and messages can't turn into markup.
 *
 * Languages: like the rest of DIC 2026, text in the page is a pair of spans
 * (.l-zh, .l-en) and the switch in the header shows one or both. Text that
 * can't hold spans (placeholders, menu options, screen-reader labels) is
 * bound with bind() and rewritten whenever the language changes.
 */

const root = document.documentElement;
export const page = () => document.getElementById("d26");
export const langMode = () => root.getAttribute("data-dic-lang") || "both";

/* ------------------------------------------------------------- languages */
/* A { en, zh } pair as the two spans the language switch shows or hides. */
export function t(en, zh) {
  if (en && typeof en === "object") ({ en, zh } = en);
  const frag = document.createDocumentFragment();
  frag.append(h("span.l-zh", { lang: "zh-Hans" }, zh ?? en), h("span.l-en", { lang: "en" }, en));
  return frag;
}

/* A pair as plain text in the current language ("中文 / English" for both). */
export function text(pair) {
  const { en, zh = en } = pair;
  const m = langMode();
  return m === "en" ? en : m === "zh" ? zh : zh === en ? en : `${zh} / ${en}`;
}

const bound = [];
function apply(el, attr, pair) {
  if (attr === "text") el.textContent = text(pair);
  else el.setAttribute(attr, text(pair));
}
/* Sets an attribute (or "text") from a pair, and keeps it in step with the switch. */
export function bind(el, attr, pair) {
  apply(el, attr, pair);
  bound.push([new WeakRef(el), attr, pair]);
  return el;
}
document.addEventListener("dic:lang", () => {
  for (let i = bound.length - 1; i >= 0; i--) {
    const el = bound[i][0].deref();
    if (el) apply(el, bound[i][1], bound[i][2]);
    else bound.splice(i, 1);
  }
});

/* -------------------------------------------------------------------- DOM */
/*
 * h("button.d-btn#go", { type: "button", on: { click }, "aria-label": { en, zh } }, ...children)
 * Attribute values that are { en, zh } pairs are bound to the language switch.
 */
export function h(tag, props, ...children) {
  const [name, ...parts] = tag.split(/(?=[.#])/);
  const el = document.createElement(name || "div");
  for (const p of parts) {
    if (p[0] === ".") el.classList.add(p.slice(1));
    else el.id = p.slice(1);
  }
  if (props === null || props === undefined || typeof props !== "object" || props instanceof Node || Array.isArray(props)) {
    children.unshift(props);
  } else {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "on") for (const [type, fn] of Object.entries(v)) el.addEventListener(type, fn);
      else if (k === "class") el.classList.add(...String(v).split(/\s+/).filter(Boolean));
      else if (k === "value") el.value = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (typeof v === "object" && "en" in v) bind(el, k, v);
      else el.setAttribute(k, v === true ? "" : v);
    }
  }
  return append(el, ...children);
}

export function append(el, ...children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === "") continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

/* A retro window, as on the DIC 2026 page. */
export function win(title, ...children) {
  return h("section.d-win",
    h("div.d-win__bar", h("span", title), h("span.d-win__ctl", { "aria-hidden": "true" }, h("i"), h("i"), h("i"))),
    h("div.d-win__body", ...children));
}

/* A definition list of [label pair, value] rows. */
export function facts(rows) {
  return h("dl.d-facts", rows.map(([label, value]) =>
    h("div.d-facts__row", h("dt", t(label)), h("dd", value === "" || value === null || value === undefined ? "—" : value))));
}

/* ------------------------------------------------------------- feedback */
export const errorPair = (err) => (err && err.pair) || { en: "Something went wrong. Please try again.", zh: "出错了，请重试。" };

/* A line for messages after an action: setStatus(el, pair, "error" | "ok"). */
export function setStatus(el, pair, kind = "error") {
  clear(el);
  el.className = `d-status d-status--${kind}`;
  if (pair) el.append(t(pair));
}

export function toast(pair, kind = "ok") {
  let box = document.querySelector(".d-toasts");
  if (!box) box = page().appendChild(h("div.d-toasts", { role: "status", "aria-live": "polite" }));
  const el = h(`div.d-toast.d-toast--${kind}`, t(pair));
  box.append(el);
  setTimeout(() => el.classList.add("is-leaving"), 3800);
  setTimeout(() => el.remove(), 4200);
}

/* Disables a button while an async action runs (and ignores repeat clicks). */
export async function busy(button, fn) {
  if (button.disabled) return undefined;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

/* ---------------------------------------------------------------- dialogs */
/* A modal window. body: node(s). Returns { el, close }. */
export function dialog({ title, body, wide = false, onClose }) {
  const close = () => el.close();
  const el = h(`dialog.d-dialog${wide ? ".d-dialog--wide" : ""}`, { "aria-label": title },
    h("div.d-win",
      h("div.d-win__bar", h("span", title),
        h("button.d-dialog__close", { type: "button", "aria-label": { en: "Close", zh: "关闭" }, on: { click: close } }, "×")),
      h("div.d-win__body", body)));
  el.addEventListener("close", () => {
    el.remove();
    if (onClose) onClose();
  });
  el.addEventListener("click", (e) => { if (e.target === el) close(); }); // the backdrop
  page().append(el);
  el.showModal();
  return { el, close };
}

/* Yes / no. Resolves true when confirmed. */
export function confirmBox({ title = "CONFIRM.EXE", message, yes, danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const ok = h(`button.d-btn${danger ? ".d-btn--danger" : ".d-btn--primary"}`, { type: "button" }, t(yes));
    const no = h("button.d-btn.d-btn--ghost", { type: "button" }, t({ en: "Cancel", zh: "取消" }));
    const d = dialog({
      title,
      body: [h("div.d-pair.d-dialog__text", t(message)), h("div.d-actions", no, ok)],
      onClose: () => resolve(answer),
    });
    ok.addEventListener("click", () => { answer = true; d.close(); });
    no.addEventListener("click", () => d.close());
    ok.focus();
  });
}

/* ------------------------------------------------------------------ forms */
const OPTIONAL = { en: "(optional)", zh: "（选填）" };

function labelFor(def, id, tag = "label") {
  return h(`${tag}.d-field__label`, tag === "label" ? { for: id } : { id },
    t(def.label),
    def.required ? h("span.d-field__req", { "aria-hidden": "true" }, " *") : h("span.d-field__opt", " ", t(OPTIONAL)));
}

function fieldShell(def, control, extra) {
  const id = `f-${def.key}`;
  const hint = def.hint ? h("p.d-field__hint", { id: `${id}-hint` }, t(def.hint)) : null;
  const error = h("p.d-field__error", { id: `${id}-error` });
  if (control.matches && control.matches("input, select, textarea")) {
    control.id = id;
    control.setAttribute("aria-describedby", [hint && `${id}-hint`, `${id}-error`].filter(Boolean).join(" "));
  }
  return h(`div.d-field${def.wide ? ".d-field--wide" : ""}`, { dataset: { field: def.key } },
    labelFor(def, id), control, extra, hint, error);
}

/*
 * One question. def: { key, type: text | tel | url | email | select | textarea,
 * label, hint, required, max, options, suggest, placeholder, wide }
 */
export function field(def, value = "") {
  let control;
  if (def.type === "select") {
    control = h("select.d-select", { name: def.key, required: def.required },
      bind(h("option", { value: "" }), "text", { en: "Choose…", zh: "请选择…" }),
      def.options.map((o) => bind(h("option", { value: o.value, selected: o.value === value }), "text", o)));
  } else if (def.type === "textarea") {
    control = h("textarea.d-input.d-textarea", { name: def.key, rows: def.rows || 3, maxlength: def.max, required: def.required, value, placeholder: def.placeholder });
  } else {
    control = h("input.d-input", {
      name: def.key, type: def.type || "text", maxlength: def.max, required: def.required, value,
      placeholder: def.placeholder, autocomplete: def.autocomplete || "off", inputmode: def.inputmode, spellcheck: def.type === "url" ? "false" : null,
    });
  }
  let extra = null;
  if (def.suggest) {
    extra = h("div.d-suggest", def.suggest.map((s) => h("button.d-chip.d-chip--small", {
      type: "button", on: { click: () => { control.value = s.value; control.focus(); } },
    }, t(s))));
  }
  if (def.max && def.type === "textarea") {
    const count = h("p.d-field__count", { "aria-hidden": "true" });
    const update = () => (count.textContent = `${control.value.length} / ${def.max}`);
    control.addEventListener("input", update);
    update();
    extra = count;
  }
  return fieldShell(def, control, extra);
}

/* Several choices from a list, as toggle chips (at most def.max). */
export function chipsField(def, values = []) {
  const picked = new Set(values);
  const labelId = `f-${def.key}-label`;
  const group = h("div.d-chips", { role: "group", "aria-labelledby": labelId });
  const sync = () => {
    for (const b of group.children) {
      const on = picked.has(b.dataset.value);
      b.setAttribute("aria-pressed", String(on));
      b.disabled = !on && def.max && picked.size >= def.max;
    }
  };
  for (const o of def.options) {
    group.append(h("button.d-chip", {
      type: "button", dataset: { value: o.value },
      on: { click: () => { picked.has(o.value) ? picked.delete(o.value) : picked.add(o.value); sync(); } },
    }, t(o)));
  }
  sync();
  const wrap = h("div.d-field.d-field--wide", { dataset: { field: def.key } },
    labelFor(def, labelId, "p"), group,
    def.hint ? h("p.d-field__hint", t(def.hint)) : null, h("p.d-field__error"));
  wrap.readValue = () => [...picked];
  return wrap;
}

/* One choice from a list, as a row of option cards (radio buttons). */
export function choiceField(def, value = "") {
  let current = value;
  const labelId = `f-${def.key}-label`;
  const group = h("div.d-choices", { role: "radiogroup", "aria-labelledby": labelId });
  const sync = () => {
    for (const b of group.children) {
      const on = b.dataset.value === current;
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on || (!current && b === group.firstChild) ? 0 : -1;
    }
  };
  def.options.forEach((o) => {
    group.append(h("button.d-choice", {
      type: "button", role: "radio", dataset: { value: o.value },
      on: { click: () => { current = o.value; sync(); if (def.onChange) def.onChange(current); } },
    }, o.kicker ? h("span.d-choice__kicker", o.kicker) : null, h("span.d-choice__name", t(o)), o.note ? h("span.d-choice__note", t(o.note)) : null));
  });
  group.addEventListener("keydown", (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const list = [...group.children];
    const i = Math.max(0, list.findIndex((b) => b.dataset.value === current));
    const next = list[(i + keys[e.key] + list.length) % list.length];
    next.click();
    next.focus();
  });
  sync();
  const wrap = h("div.d-field.d-field--wide", { dataset: { field: def.key } },
    labelFor(def, labelId, "p"), group,
    def.hint ? h("p.d-field__hint", t(def.hint)) : null, h("p.d-field__error"));
  wrap.readValue = () => current;
  return wrap;
}

/* { key: value } from every field in a form. */
export function readFields(container) {
  const out = {};
  for (const f of container.querySelectorAll("[data-field]")) {
    if (f.readValue) out[f.dataset.field] = f.readValue();
    else {
      const c = f.querySelector("input, select, textarea");
      if (c) out[f.dataset.field] = c.value.trim();
    }
  }
  return out;
}

/* Required answers that are missing, in the API's error shape. */
export function missing(defs, values) {
  return defs
    .filter((d) => d.required && (Array.isArray(values[d.key]) ? !values[d.key].length : !values[d.key]))
    .map((d) => ({ field: d.key, message: { en: "Please fill this in.", zh: "请填写此项。" } }));
}

function clearField(f) {
  f.classList.remove("is-invalid");
  clear(f.querySelector(".d-field__error"));
  const c = f.querySelector("[aria-invalid]");
  if (c) c.removeAttribute("aria-invalid");
}

export function clearErrors(container) {
  for (const f of container.querySelectorAll(".d-field.is-invalid")) clearField(f);
}

/* problems: [{ field, message: { en, zh } }] → marks the fields, focuses the
   first. A field's message goes away as soon as it's changed. */
export function showErrors(container, problems) {
  clearErrors(container);
  let first = null;
  for (const p of problems) {
    const f = container.querySelector(`[data-field="${p.field}"]`);
    if (!f) continue;
    f.classList.add("is-invalid");
    f.querySelector(".d-field__error").append(t(p.message));
    const c = f.querySelector("input, select, textarea, button");
    if (c) c.setAttribute("aria-invalid", "true");
    for (const type of ["input", "change", "click"]) f.addEventListener(type, () => clearField(f), { once: true });
    first ??= c;
  }
  if (first) first.focus();
  return problems.length > 0;
}

/* ---------------------------------------------------------------- formats */
const CST = 8 * 3600000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* "2026-10-22 14:03", Shanghai time. */
export function stamp(ms) {
  return ms ? new Date(ms + CST).toISOString().slice(0, 16).replace("T", " ") : "";
}

/* "Oct 22" / "10月22日" */
export function day(ms) {
  const d = new Date(ms + CST);
  return { en: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`, zh: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日` };
}

export function ago(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return { en: "just now", zh: "刚刚" };
  if (s < 3600) return { en: `${Math.floor(s / 60)} min ago`, zh: `${Math.floor(s / 60)} 分钟前` };
  if (s < 86400) return { en: `${Math.floor(s / 3600)} h ago`, zh: `${Math.floor(s / 3600)} 小时前` };
  return day(ms);
}

export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = h("textarea", { value, readonly: true, style: "position:fixed;top:0;left:0;opacity:0" });
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}
