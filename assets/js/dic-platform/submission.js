import { api, session } from "./api.js";

const actions = document.querySelector("[data-submission-actions]");
if (actions) {
  const link = document.getElementById("d-submission").content.firstElementChild.cloneNode(true);
  let revision = 0;

  async function refresh(user) {
    const current = ++revision;
    link.remove();
    if (!user) return;
    try {
      const { registration, team } = await api("GET", "/api/registration");
      if (current === revision && registration?.profileComplete && team) actions.append(link);
    } catch {
      // Leave the button hidden when membership cannot be verified.
    }
  }

  session.onChange(refresh);
  function restore() {
    session.restore().catch(() => refresh(null));
  }
  restore();
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) restore();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) refresh(null);
    else restore();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === "dic-token" || event.key === "dic-preview-token" || event.key === null) location.reload();
  });
}
