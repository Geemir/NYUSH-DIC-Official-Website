/*
 * DIC 2026 page behaviour.
 *
 * Progressive enhancement: the page is complete without this script (both
 * languages, all four tracks, the full timeline). This adds the language
 * switch, the Shanghai clock, the countdown, track tabs, timeline status,
 * the file dock highlight and scroll reveals.
 */
(function () {
  "use strict";

  var page = document.getElementById("d26");
  if (!page) return;

  var root = document.documentElement;
  var DAY = 86400000;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Dates in the content are China time. "2026-11-09" → that midnight in Shanghai. */
  function cst(date) {
    return Date.parse(date + "T00:00:00+08:00");
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  /* ---------------------------------------------------------------- language */
  var langSwitch = page.querySelector(".d-langswitch");

  function setLang(lang, remember) {
    if (lang === "both") root.removeAttribute("data-dic-lang");
    else root.setAttribute("data-dic-lang", lang);
    langSwitch.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang));
    });
    if (remember) {
      try { localStorage.setItem("dic26-lang", lang); } catch (e) { /* private mode */ }
    }
  }

  if (langSwitch) {
    langSwitch.hidden = false;
    setLang(root.getAttribute("data-dic-lang") || "both", false);
    langSwitch.addEventListener("click", function (e) {
      var button = e.target.closest("button[data-lang]");
      if (button) setLang(button.getAttribute("data-lang"), true);
    });
  }

  /* --------------------------------------------------------------- milestones */
  /* Every dated event becomes { el, start, end }. Single-day events end at the
     next midnight; ranges end the day after their `data-end`. */
  var events = Array.prototype.map.call(page.querySelectorAll(".d-event[data-start]"), function (el) {
    var start = cst(el.getAttribute("data-start"));
    var endAttr = el.getAttribute("data-end");
    return { el: el, start: start, end: endAttr ? cst(endAttr) + DAY : start + DAY, range: !!endAttr };
  });

  var stateLabels = { done: "✓ DONE", now: "● NOW", next: "→ NEXT" };

  function markTimeline(now) {
    var nextFound = false;
    events.forEach(function (ev) {
      var state = "";
      if (now >= ev.end) state = "done";
      else if (now >= ev.start) state = "now";
      else if (!nextFound) { state = "next"; nextFound = true; }
      ev.el.classList.remove("is-done", "is-now", "is-next");
      if (state) ev.el.classList.add("is-" + state);
      var label = ev.el.querySelector("[data-state]");
      if (label) label.textContent = state ? stateLabels[state] : "";
    });
  }

  /* --------------------------------------------------------------- countdown */
  var countdown = page.querySelector("[data-countdown]");
  var countValue = countdown && countdown.querySelector("[data-countdown-value]");
  var countLabel = countdown && countdown.querySelector("[data-countdown-label]");
  var countTarget = null;

  /* The next single-day milestone that has not started, or today's. */
  function pickTarget(now) {
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (!ev.range && now < ev.end) return ev;
    }
    return null;
  }

  function renderCountdown(now) {
    if (!countdown) return;
    var ev = pickTarget(now);
    if (!ev) { countdown.hidden = true; return; }
    countdown.hidden = false;

    if (ev !== countTarget) {
      countTarget = ev;
      /* Reuse the event's own bilingual title so the language switch applies. */
      var title = ev.el.querySelector(".d-event__title").cloneNode(true);
      var when = ev.el.querySelector(".d-event__when").firstChild.textContent.trim();
      countLabel.textContent = "→ ";
      while (title.firstChild) countLabel.appendChild(title.firstChild);
      countLabel.appendChild(document.createTextNode(" · " + when));
    }

    var diff = ev.start - now;
    if (diff <= 0) {
      countValue.textContent = "T−0 · TODAY";
      return;
    }
    countValue.textContent =
      "T−" + Math.floor(diff / DAY) + "d " +
      pad(Math.floor(diff / 3600000) % 24) + ":" +
      pad(Math.floor(diff / 60000) % 60) + ":" +
      pad(Math.floor(diff / 1000) % 60);
  }

  /* ------------------------------------------------------------ season bar */
  var season = page.querySelector("[data-season]");

  function renderSeason(now) {
    if (!season) return;
    season.hidden = false;
    var from = cst(season.getAttribute("data-from"));
    var to = cst(season.getAttribute("data-to")) + DAY;
    var pct = Math.max(0, Math.min(1, (now - from) / (to - from)));
    season.querySelector("[data-season-fill]").style.width = (pct * 100).toFixed(2) + "%";
    season.querySelector("[data-season-marker]").style.left = (pct * 100).toFixed(2) + "%";

    var caption = season.querySelector("[data-season-caption]");
    var total = Math.round((to - from) / DAY);
    if (now < from) caption.textContent = "TODAY · T−" + Math.ceil((from - now) / DAY) + "d TO KICK-OFF";
    else if (now >= to) caption.textContent = "SEASON COMPLETE";
    else caption.textContent = "TODAY · DAY " + (Math.floor((now - from) / DAY) + 1) + " / " + total;
  }

  /* ------------------------------------------------------------------ clock */
  var clock = page.querySelector("[data-clock]");

  function renderClock(now) {
    if (!clock) return;
    var sh = new Date(now + 8 * 3600000); // Shanghai has no daylight saving
    clock.textContent = pad(sh.getUTCHours()) + ":" + pad(sh.getUTCMinutes());
  }

  /* ------------------------------------------------------------------- tick */
  var lastMinute = -1;
  function tick() {
    var now = Date.now();
    renderCountdown(now);
    var minute = Math.floor(now / 60000);
    if (minute !== lastMinute) {
      lastMinute = minute;
      renderClock(now);
      markTimeline(now);
      renderSeason(now);
    }
  }
  tick();
  setInterval(tick, 1000);

  /* -------------------------------------------------------------- track tabs */
  var tablist = page.querySelector(".d-tabs");
  var trackset = page.querySelector(".d-trackset");

  if (tablist && trackset) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll("[role=tab]"));
    var panels = Array.prototype.slice.call(trackset.querySelectorAll("[role=tabpanel]"));

    var select = function (id, focusTab) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("data-tab") === id;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        if (on && focusTab) tab.focus();
      });
      panels.forEach(function (panel) {
        panel.classList.toggle("is-active", panel.id === id);
      });
    };

    tablist.hidden = false;
    trackset.classList.add("is-tabbed");
    var initial = location.hash.slice(1);
    select(panels.some(function (p) { return p.id === initial; }) ? initial : panels[0].id, false);

    tablist.addEventListener("click", function (e) {
      var tab = e.target.closest("[role=tab]");
      if (!tab) return;
      var id = tab.getAttribute("data-tab");
      select(id, false);
      if (history.replaceState) history.replaceState(null, "", "#" + id);
    });

    tablist.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      next = (next + tabs.length) % tabs.length;
      select(tabs[next].getAttribute("data-tab"), true);
    });

    /* Links elsewhere on the page (the hero circuit) open the right track. */
    var openFromHash = function () {
      var id = location.hash.slice(1);
      if (panels.some(function (p) { return p.id === id; })) select(id, false);
    };
    window.addEventListener("hashchange", openFromHash);
    page.querySelectorAll("[data-track-link]").forEach(function (link) {
      link.addEventListener("click", function () {
        select(link.getAttribute("data-track-link"), false);
      });
    });
  }

  /* ---------------------------------------------------------- dock highlight */
  var dockLinks = page.querySelectorAll("[data-dock]");
  if ("IntersectionObserver" in window && dockLinks.length) {
    var byId = {};
    dockLinks.forEach(function (a) { byId[a.getAttribute("data-dock")] = a; });
    var dockObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        dockLinks.forEach(function (a) { a.classList.remove("is-active"); });
        var active = byId[entry.target.id];
        if (active) {
          active.classList.add("is-active");
          /* Keep the active item visible in the scrollable dock on phones. */
          var dock = active.parentNode;
          var left = active.offsetLeft - (dock.clientWidth - active.offsetWidth) / 2;
          dock.scrollTo ? dock.scrollTo({ left: left, behavior: reduceMotion ? "auto" : "smooth" }) : (dock.scrollLeft = left);
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) dockObserver.observe(section);
    });
  }

  /* ------------------------------------------------------------ scroll reveal */
  /* Content is only hidden once this has run, and never under reduced motion.
     Anything already on screen is marked visible first, so nothing flickers. */
  if (!reduceMotion && "IntersectionObserver" in window) {
    var reveals = page.querySelectorAll(".d-reveal");
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
      else revealObserver.observe(el);
    });
    page.classList.add("d-anim");
  }
})();
