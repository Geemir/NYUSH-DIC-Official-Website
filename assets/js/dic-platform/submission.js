import { api, session } from "./api.js";

const actions = document.querySelector("[data-submission-actions]");
if (actions) {
  const link = document.getElementById("d-submission").content.querySelector("a").cloneNode(true);
  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "d-btn d-btn--ghost";
  retry.innerHTML = '<span class="l-zh" lang="zh-Hans">无法确认提交资格，点击重试</span><span class="l-en" lang="en">Couldn’t check submission access. Retry</span>';
  let revision = 0;

  async function refresh() {
    const current = ++revision;
    retry.remove();
    link.remove();
    if (document.hidden || !session.resumeToken()) return;
    try {
      const { registration, team } = await api("GET", "/api/registration");
      if (current === revision && registration && registration.profileComplete && team) actions.append(link);
    } catch (err) {
      if (current === revision && err.status !== 401) actions.append(retry);
    }
  }

  retry.addEventListener("click", refresh);
  session.onChange(refresh);
  refresh();
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refresh();
  });
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("online", refresh);
  window.addEventListener("storage", (event) => {
    if (event.key === "dic-token" || event.key === "dic-preview-token" || event.key === null) refresh();
  });
}