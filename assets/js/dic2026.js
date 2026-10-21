/*
 * DIC 2026 page behaviour.
 *
 * Progressive enhancement: the page is complete without this script (both
 * languages, all four tracks, the full timeline as a list). This adds the
 * language switch, the Shanghai clock, the countdown, track tabs, the
 * interactive timeline, the file-dock highlight and scroll reveals.
 */
(function () {
  "use strict";

  var page = document.getElementById("d26");
  if (!page) return;

  var root = document.documentElement;
  var DAY = 86400000;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Dates in the content are China time. "2026-11-09" (+ optional "17:00")
     → that moment in Shanghai, as a timestamp. */
  function cst(date, time) {
    return Date.parse(date + "T" + (time || "00:00") + ":00+08:00");
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function stamp(ms) {
    var d = new Date(ms + 8 * 3600000);
    return d.getUTCFullYear() + "." + (d.getUTCMonth() + 1) + "." + d.getUTCDate();
  }
  /* Whole calendar days (Shanghai) from now until a moment. */
  function daysUntil(ms, now) {
    var day = function (t) { return Math.floor((t + 8 * 3600000) / DAY); };
    return day(ms) - day(now);
  }
  function each(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  /* ---------------------------------------------------------------- language */
  var langSwitch = page.querySelector(".d-langswitch");

  function setLang(lang, remember) {
    if (lang === "both") root.removeAttribute("data-dic-lang");
    else root.setAttribute("data-dic-lang", lang);
    each(langSwitch.querySelectorAll("button"), function (b) {
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

  /* -------------------------------------------------------------- milestones */
  /* One entry per timeline event, in page order. The list items carry the
     dates; undated events (e.g. "During Winter Holiday") have start = null. */
  var events = Array.prototype.map.call(page.querySelectorAll(".d-event"), function (el) {
    var s = el.getAttribute("data-start");
    var e = el.getAttribute("data-end");
    var start = s ? cst(s) : null;
    return {
      el: el,
      start: start,
      end: start === null ? null : (e ? cst(e) + DAY : start + DAY),
      target: s ? cst(s, el.getAttribute("data-time")) : null, // countdown moment
      range: !!e,
      state: ""
    };
  });

  var stateLabels = { done: "✓ DONE", now: "● NOW", next: "→ NEXT" };

  function computeStates(now) {
    var nextFound = false;
    events.forEach(function (ev) {
      ev.state = "";
      if (ev.start === null) return;
      if (now >= ev.end) ev.state = "done";
      else if (now >= ev.start) ev.state = "now";
      else if (!nextFound) { ev.state = "next"; nextFound = true; }
    });
  }

  function paintList() {
    events.forEach(function (ev) {
      ev.el.classList.remove("is-done", "is-now", "is-next");
      if (ev.state) ev.el.classList.add("is-" + ev.state);
      var label = ev.el.querySelector("[data-state]");
      if (label) label.textContent = ev.state ? stateLabels[ev.state] : "";
    });
  }

  function countdownText(ms) {
    return "T−" + Math.floor(ms / DAY) + "d " +
      pad(Math.floor(ms / 3600000) % 24) + ":" +
      pad(Math.floor(ms / 60000) % 60) + ":" +
      pad(Math.floor(ms / 1000) % 60);
  }

  /* --------------------------------------------------------------- countdown */
  var countdown = page.querySelector("[data-countdown]");
  var countValue = countdown && countdown.querySelector("[data-countdown-value]");
  var countLabel = countdown && countdown.querySelector("[data-countdown-label]");
  var countTarget = null;

  /* The next single-day milestone whose day is not over. Ranges are skipped. */
  function pickTarget(now) {
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.start !== null && !ev.range && now < ev.end) return ev;
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
      /* Reuse the event's own bilingual title so the language switch applies.
         The printed date is the day only: the start time stays private. */
      var title = ev.el.querySelector(".d-event__title").cloneNode(true);
      countLabel.textContent = "→ ";
      while (title.firstChild) countLabel.appendChild(title.firstChild);
      countLabel.appendChild(document.createTextNode(" · " + stamp(ev.start)));
    }

    var diff = ev.target - now;
    countValue.textContent = diff > 0 ? countdownText(diff) : "T−0 · TODAY";
  }

  /* ------------------------------------------------------------------ clock */
  var clock = page.querySelector("[data-clock]");

  function renderClock(now) {
    if (!clock) return;
    var sh = new Date(now + 8 * 3600000); // Shanghai has no daylight saving
    clock.textContent = pad(sh.getUTCHours()) + ":" + pad(sh.getUTCMinutes());
  }

  /* ----------------------------------------------------- interactive timeline */
  var tlx = page.querySelector("[data-tlx]");
  var tlxList = page.querySelector("[data-tlx-list]");
  var timeline = null;

  if (tlx && tlxList && events.length) {
    timeline = (function () {
      var nodes = Array.prototype.slice.call(tlx.querySelectorAll("[data-tlx-node]"));
      var panels = nodes.map(function (n) { return document.getElementById(n.getAttribute("aria-controls")); });
      var fill = tlx.querySelector("[data-tlx-fill]");
      var nowMark = tlx.querySelector("[data-tlx-now]");
      var today = tlx.querySelector("[data-tlx-today]");
      var scroller = tlx.querySelector("[data-tlx-scroller]");
      var playBtn = tlx.querySelector("[data-tlx-play]");
      var playLabel = tlx.querySelector("[data-tlx-play-label]");
      var n = nodes.length;
      var selected = -1;
      var userPicked = false;
      var playTimer = null;
      var STEP = 3200;

      /* Anchors for placing "today" on the rail: dated events whose start
         keeps moving forward in time (out-of-order ranges are skipped). */
      var anchors = [];
      events.forEach(function (ev, i) {
        if (ev.start === null) return;
        if (anchors.length && ev.start <= anchors[anchors.length - 1].t) return;
        anchors.push({ i: i, t: ev.start });
      });

      function railPosition(now) {
        /* Before the season: just ahead of the first node, not on top of it. */
        if (!anchors.length || now < anchors[0].t) return (anchors.length ? anchors[0].i : 0) - 0.4;
        for (var k = 1; k < anchors.length; k++) {
          var a = anchors[k - 1], b = anchors[k];
          if (now < b.t) return a.i + (now - a.t) / (b.t - a.t) * (b.i - a.i);
        }
        return anchors[anchors.length - 1].i;
      }

      function select(i, opts) {
        opts = opts || {};
        if (i === selected || i < 0 || i >= n) return;
        var from = selected;
        selected = i;
        nodes.forEach(function (node, k) {
          var on = k === i;
          node.setAttribute("aria-selected", String(on));
          node.tabIndex = on ? 0 : -1;
        });
        panels.forEach(function (panel, k) {
          panel.hidden = k !== i;
          panel.classList.remove("is-from-left", "is-from-right");
        });
        if (from >= 0 && !reduceMotion) {
          void panels[i].offsetWidth; // restart the entrance animation
          panels[i].classList.add(i > from ? "is-from-right" : "is-from-left");
        }
        if (opts.focus) nodes[i].focus();
        /* Keep the chosen node centred in the sideways-scrolling rail on phones. */
        if (scroller.scrollWidth > scroller.clientWidth) {
          var node = nodes[i];
          var left = node.offsetLeft + node.offsetWidth / 2 - scroller.clientWidth / 2;
          scroller.scrollTo({ left: left, behavior: reduceMotion || opts.instant ? "auto" : "smooth" });
        }
      }

      function paint(now) {
        events.forEach(function (ev, i) {
          var node = nodes[i];
          node.classList.remove("is-done", "is-now", "is-next");
          if (ev.state) node.classList.add("is-" + ev.state);

          var state = panels[i].querySelector("[data-tlx-state]");
          var eta = panels[i].querySelector("[data-tlx-eta]");
          state.textContent = ev.state ? stateLabels[ev.state] : "";
          if (ev.start === null) eta.textContent = "";
          else if (ev.state === "done") eta.textContent = "COMPLETE";
          else if (ev.state === "now") eta.textContent = ev.range ? "IN PROGRESS · " + daysUntil(ev.end, now) + " DAYS LEFT" : "TODAY";
          else eta.textContent = (ev.range ? "STARTS IN " : "IN ") + daysUntil(ev.start, now) + " DAYS";
        });

        var p = railPosition(now);
        var frac = n > 1 ? p / (n - 1) : 0;
        var fillFrac = Math.max(0, frac);
        fill.style.width = (fillFrac * 100).toFixed(3) + "%";
        nowMark.style.left = (frac * 100).toFixed(3) + "%";
        tlx.classList.toggle("has-progress", fillFrac > 0);

        var first = events[0];
        if (now < first.target) {
          today.innerHTML = "TODAY " + stamp(now) + " · <b>" + daysUntil(first.start, now) + " DAYS TO KICK-OFF</b>";
        } else {
          today.textContent = "TODAY " + stamp(now) + " · DAY " + (Math.floor((now - first.start) / DAY) + 1) + " OF THE SEASON";
        }
      }

      /* -- autoplay: step through the season, one milestone at a time */
      function stopPlay() {
        if (!playTimer) return;
        clearInterval(playTimer);
        playTimer = null;
        playBtn.setAttribute("aria-pressed", "false");
        playBtn.classList.remove("is-ticking");
        playLabel.textContent = "PLAY";
      }
      function tickAnim() {
        playBtn.classList.remove("is-ticking");
        void playBtn.offsetWidth;
        playBtn.classList.add("is-ticking");
      }
      function startPlay() {
        playBtn.setAttribute("aria-pressed", "true");
        playLabel.textContent = "PAUSE";
        playBtn.style.setProperty("--tick", STEP + "ms");
        if (selected >= n - 1) select(0);
        tickAnim();
        playTimer = setInterval(function () {
          if (selected >= n - 1) { stopPlay(); return; }
          select(selected + 1);
          tickAnim();
        }, STEP);
      }

      playBtn.addEventListener("click", function () {
        if (playTimer) stopPlay(); else startPlay();
      });

      /* -- rail / list views */
      function setView(view) {
        var list = view === "list";
        tlx.classList.toggle("is-list", list);
        tlxList.hidden = !list;
        playBtn.hidden = list;
        if (list) stopPlay();
        each(tlx.querySelectorAll("[data-tlx-view]"), function (b) {
          b.setAttribute("aria-pressed", String(b.getAttribute("data-tlx-view") === view));
        });
      }
      tlx.addEventListener("click", function (e) {
        var viewBtn = e.target.closest("[data-tlx-view]");
        if (viewBtn) setView(viewBtn.getAttribute("data-tlx-view"));
        var node = e.target.closest("[data-tlx-node]");
        if (node) {
          userPicked = true;
          stopPlay();
          select(+node.getAttribute("data-tlx-node"));
        }
      });

      tlx.querySelector("[role=tablist]").addEventListener("keydown", function (e) {
        var next = { ArrowRight: selected + 1, ArrowLeft: selected - 1, Home: 0, End: n - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        userPicked = true;
        stopPlay();
        select(Math.max(0, Math.min(n - 1, next)), { focus: true });
      });

      /* -- reveal: the list steps aside, the rail draws itself in on first view.
         The hidden "armed" state must never get stuck, so drawing is triggered
         by an IntersectionObserver (any entry in the batch) and, as a backup,
         by a plain scroll-position check. */
      tlx.hidden = false;
      tlxList.hidden = true;
      if (!reduceMotion) {
        var drawn = false;
        var inView = function () {
          var r = tlx.getBoundingClientRect();
          return r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15;
        };
        var draw = function () {
          if (drawn) return;
          drawn = true;
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
          if (tlx._drawObserver) tlx._drawObserver.disconnect();
          tlx.classList.add("is-drawn");
          tlx.classList.remove("is-armed");
        };
        var onScroll = function () { if (inView()) draw(); };

        tlx.classList.add("is-armed");
        if (inView()) {
          /* Already on screen: let the hidden state paint once, then draw. */
          requestAnimationFrame(function () { requestAnimationFrame(draw); });
        } else {
          window.addEventListener("scroll", onScroll, { passive: true });
          window.addEventListener("resize", onScroll);
          if ("IntersectionObserver" in window) {
            tlx._drawObserver = new IntersectionObserver(function (entries) {
              if (entries.some(function (e) { return e.isIntersecting; })) draw();
            }, { threshold: 0.2 });
            tlx._drawObserver.observe(tlx);
          }
        }
      }

      return {
        update: function (now) {
          paint(now);
          /* Open the next milestone (or today's) unless the reader chose one. */
          if (!userPicked) {
            var focusIdx = 0;
            for (var i = 0; i < events.length; i++) {
              if (events[i].state === "now" || events[i].state === "next") { focusIdx = i; break; }
              if (events[i].state === "done") focusIdx = Math.min(i + 1, n - 1);
            }
            select(focusIdx, { instant: true });
          }
        }
      };
    })();
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
      computeStates(now);
      paintList();
      if (timeline) timeline.update(now);
    }
  }
  tick();
  setInterval(tick, 1000);

  /* -------------------------------------------------------------- track tabs */
  var tablist = page.querySelector(".d-tabs");
  var trackset = page.querySelector(".d-trackset");

  if (tablist && trackset) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll("[role=tab]"));
    var trackPanels = Array.prototype.slice.call(trackset.querySelectorAll("[role=tabpanel]"));

    var selectTrack = function (id, focusTab) {
      tabs.forEach(function (tab) {
        var on = tab.getAttribute("data-tab") === id;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        if (on && focusTab) tab.focus();
      });
      trackPanels.forEach(function (panel) {
        panel.classList.toggle("is-active", panel.id === id);
      });
    };
    var isTrack = function (id) {
      return trackPanels.some(function (p) { return p.id === id; });
    };

    tablist.hidden = false;
    trackset.classList.add("is-tabbed");
    var initial = location.hash.slice(1);
    selectTrack(isTrack(initial) ? initial : trackPanels[0].id, false);

    tablist.addEventListener("click", function (e) {
      var tab = e.target.closest("[role=tab]");
      if (!tab) return;
      var id = tab.getAttribute("data-tab");
      selectTrack(id, false);
      if (history.replaceState) history.replaceState(null, "", "#" + id);
    });

    tablist.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      next = (next + tabs.length) % tabs.length;
      selectTrack(tabs[next].getAttribute("data-tab"), true);
    });

    /* Links elsewhere on the page (the hero circuit) open the right track. */
    window.addEventListener("hashchange", function () {
      var id = location.hash.slice(1);
      if (isTrack(id)) selectTrack(id, false);
    });
    each(page.querySelectorAll("[data-track-link]"), function (link) {
      link.addEventListener("click", function () {
        selectTrack(link.getAttribute("data-track-link"), false);
      });
    });
  }

  /* ---------------------------------------------------------- dock highlight */
  var dockLinks = page.querySelectorAll("[data-dock]");
  if ("IntersectionObserver" in window && dockLinks.length) {
    var byId = {};
    each(dockLinks, function (a) { byId[a.getAttribute("data-dock")] = a; });
    var dockObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        each(dockLinks, function (a) { a.classList.remove("is-active"); });
        var active = byId[entry.target.id];
        if (active) {
          active.classList.add("is-active");
          /* Keep the active item visible in the scrollable dock on phones. */
          var dock = active.parentNode;
          var left = active.offsetLeft - (dock.clientWidth - active.offsetWidth) / 2;
          if (dock.scrollTo) dock.scrollTo({ left: left, behavior: reduceMotion ? "auto" : "smooth" });
          else dock.scrollLeft = left;
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
    each(reveals, function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
      else revealObserver.observe(el);
    });
    page.classList.add("d-anim");
  }
})();
