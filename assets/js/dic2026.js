/*
 * DIC 2026 page behaviour.
 *
 * Progressive enhancement: the page is complete without this script (both
 * languages, all four tracks, the full timeline as a list). This adds the
 * language switch (in the site header), the countdown clock, track tabs, the
 * interactive timeline, the left progress rail and scroll reveals.
 * anime.js (loaded before this file) animates the clock; everything still
 * works without it.
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
  var langSwitch = document.querySelector(".d-langswitch");

  function setLang(lang, remember) {
    if (lang === "both") root.removeAttribute("data-dic-lang");
    else root.setAttribute("data-dic-lang", lang);
    each(langSwitch.querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang));
    });
    if (remember) {
      try { localStorage.setItem("dic26-lang", lang); } catch (e) { /* private mode */ }
    }
    /* The platform pages relabel placeholders and menus on this. */
    document.dispatchEvent(new CustomEvent("dic:lang", { detail: lang }));
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

  /* -------------------------------------------------------- countdown clock */
  /* A Shanghai-time dial whose hands keep moving, beside digit reels that roll
     down to the next dated milestone. */
  var countdown = page.querySelector("[data-countdown]");
  var hasAnime = typeof window.anime === "function";
  var animate = hasAnime && !reduceMotion;
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* The next single-day milestone whose day is not over. Ranges are skipped. */
  function pickTarget(now) {
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.start !== null && !ev.range && now < ev.end) return ev;
    }
    return null;
  }

  /* Replace an element's content with a Chinese / English pair. */
  function setPair(el, zh, en) {
    el.textContent = "";
    var z = document.createElement("span");
    z.className = "l-zh"; z.lang = "zh-Hans"; z.textContent = zh;
    var e = document.createElement("span");
    e.className = "l-en"; e.lang = "en"; e.textContent = en;
    el.appendChild(z);
    el.appendChild(e);
  }

  var clockApi = null;
  if (countdown) {
    clockApi = (function () {
      var lead = countdown.querySelector("[data-countdown-lead]");
      var dateEl = countdown.querySelector("[data-countdown-date]");
      var srEl = countdown.querySelector("[data-countdown-sr]");
      var hands = {};
      ["h", "m", "s"].forEach(function (k) { hands[k] = countdown.querySelector("[data-hand=" + k + "]"); });
      var units = {};
      ["d", "h", "m", "s"].forEach(function (k) {
        units[k] = { box: countdown.querySelector("[data-unit=" + k + "] .d-unit__reels"), strips: [], digits: [] };
      });
      var target = null, wasToday = null, firstSec = null, firstAngle = 0, lastMinute = -1;

      /* Each digit is a reel: a strip of 0-9 that slides to the right number. */
      function build(u, count) {
        u.box.textContent = "";
        u.strips = []; u.digits = [];
        for (var i = 0; i < count; i++) {
          var reel = document.createElement("span");
          reel.className = "d-reel";
          var strip = document.createElement("span");
          strip.className = "d-reel__strip";
          for (var k = 0; k < 10; k++) {
            var digit = document.createElement("span");
            digit.textContent = k;
            strip.appendChild(digit);
          }
          reel.appendChild(strip);
          u.box.appendChild(reel);
          u.strips.push(strip);
          u.digits.push(null);
        }
      }

      function setUnit(key, value) {
        var u = units[key];
        var str = String(value);
        if (str.length < 2) str = "0" + str;
        if (u.strips.length !== str.length) build(u, str.length);
        for (var i = 0; i < str.length; i++) {
          var d = +str.charAt(i);
          if (u.digits[i] === d) continue;
          var first = u.digits[i] === null;
          u.digits[i] = d;
          var strip = u.strips[i];
          if (animate && !first) {
            window.anime.remove(strip);
            window.anime({ targets: strip, translateY: -d + "em", duration: 800, easing: "easeOutElastic(1, .75)" });
          } else {
            strip.style.transform = "translateY(" + -d + "em)";
          }
        }
      }

      /* Shanghai time on the dial. The second hand ticks; its angle only ever
         grows, so it never sweeps backwards at the top of the minute. */
      function renderDial(now) {
        var sec = Math.floor((now + 8 * 3600000) / 1000);
        var s = sec % 60, m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600) % 12;
        if (firstSec === null) { firstSec = sec; firstAngle = s * 6; }
        var angle = firstAngle + (sec - firstSec) * 6;
        hands.h.style.transform = "rotate(" + (h * 30 + m * 0.5) + "deg)";
        hands.m.style.transform = "rotate(" + (m * 6 + s * 0.1) + "deg)";
        if (animate && sec !== firstSec) {
          window.anime({ targets: hands.s, rotate: angle, duration: 500, easing: "easeOutElastic(1, .45)" });
        } else {
          hands.s.style.transform = "rotate(" + angle + "deg)";
        }
      }

      return {
        update: function (now) {
          var ev = pickTarget(now);
          if (!ev) { countdown.hidden = true; return; }
          countdown.hidden = false;
          renderDial(now);

          var diff = Math.max(0, ev.target - now);
          var today = diff === 0;
          if (ev !== target || today !== wasToday) {
            target = ev;
            wasToday = today;
            var tZh = ev.el.querySelector(".d-event__title .l-zh").textContent;
            var tEn = ev.el.querySelector(".d-event__title .l-en").textContent;
            if (today) setPair(lead, "今天：" + tZh, "Today: " + tEn);
            else setPair(lead, "距" + tZh + "还有", "Until " + tEn);
            /* The day only: the start time stays private. */
            var day = new Date(ev.start + 8 * 3600000);
            setPair(dateEl,
              day.getUTCFullYear() + "年" + (day.getUTCMonth() + 1) + "月" + day.getUTCDate() + "日",
              MONTHS[day.getUTCMonth()] + " " + day.getUTCDate() + ", " + day.getUTCFullYear());
          }

          var dd = Math.floor(diff / DAY), hh = Math.floor(diff / 3600000) % 24;
          var mm = Math.floor(diff / 60000) % 60, ss = Math.floor(diff / 1000) % 60;
          setUnit("d", dd); setUnit("h", hh); setUnit("m", mm); setUnit("s", ss);

          var minute = Math.floor(now / 60000);
          if (minute !== lastMinute) {
            lastMinute = minute;
            srEl.textContent = today
              ? lead.textContent
              : dd + " days, " + hh + " hours and " + mm + " minutes until " + ev.el.querySelector(".d-event__title .l-en").textContent;
          }
        }
      };
    })();
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
          else if (ev.state === "now") eta.textContent = ev.range ? "IN PROGRESS, " + daysUntil(ev.end, now) + " DAYS LEFT" : "TODAY";
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
          today.innerHTML = "<span>TODAY " + stamp(now) + "</span><b>" + daysUntil(first.start, now) + " DAYS TO KICK-OFF</b>";
        } else {
          today.innerHTML = "<span>TODAY " + stamp(now) + "</span><b>DAY " + (Math.floor((now - first.start) / DAY) + 1) + " OF THE SEASON</b>";
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
    var minute = Math.floor(now / 60000);
    if (minute !== lastMinute) {
      lastMinute = minute;
      computeStates(now);
      paintList();
      if (timeline) timeline.update(now);
    }
    if (clockApi) clockApi.update(now);
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
      /* A window that was hidden has its "Read more" measured now. */
      document.dispatchEvent(new CustomEvent("dic:layout"));
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

  /* ------------------------------------------------------------ progress rail */
  /* The rail on the left follows the reader: the file whose top has passed
     40% of the screen is active, earlier files are ticked off, and the fill
     grows smoothly through each file. */
  var rail = page.querySelector("[data-rail]");
  if (rail) {
    var railItems = Array.prototype.slice.call(rail.querySelectorAll("[data-rail-item]"));
    var railSections = railItems.map(function (li) { return document.getElementById(li.getAttribute("data-rail-item")); });
    var railFill = rail.querySelector("[data-rail-fill]");
    var railPct = rail.querySelector("[data-rail-pct]");
    var railQueued = false;

    var updateRail = function () {
      railQueued = false;
      var line = window.innerHeight * 0.4;
      var active = -1, frac = 0;
      railSections.forEach(function (sec, k) {
        if (!sec) return;
        var r = sec.getBoundingClientRect();
        if (r.top <= line) { active = k; frac = Math.min(1, Math.max(0, (line - r.top) / r.height)); }
      });
      var last = railItems.length - 1;
      var fill = active < 0 ? 0 : Math.min(1, (active + frac) / last);
      railFill.style.transform = "scaleY(" + fill.toFixed(4) + ")";
      railItems.forEach(function (li, k) {
        li.classList.toggle("is-active", k === active);
        li.classList.toggle("is-passed", k < active);
      });
      var max = document.documentElement.scrollHeight - window.innerHeight;
      railPct.textContent = String(Math.round(max > 0 ? Math.min(100, Math.max(0, window.scrollY / max * 100)) : 0));
      rail.classList.toggle("is-engaged", active >= 0);
    };
    var queueRail = function () {
      if (railQueued) return;
      railQueued = true;
      (window.requestAnimationFrame || setTimeout)(updateRail);
    };
    window.addEventListener("scroll", queueRail, { passive: true });
    window.addEventListener("resize", queueRail);
    updateRail();
    rail.classList.add("is-ready");
  }

  /* --------------------------------------------------------------- read more */
  /* Long passages marked data-more are cut to a few lines on phones, with a
     "Read more" button (the cut itself is CSS, in _dic2026-phone.scss, so
     wider screens never see it). Each passage is measured, and only gets the
     button when there is more to read; again whenever the language or the
     width changes. Without this script everything shows in full. */
  var mores = page.querySelectorAll("[data-more]");
  if (mores.length) {
    var moreLabel = function (open) {
      return open
        ? '<span class="l-zh" lang="zh-Hans">收起</span><span class="l-en" lang="en">Show less</span><span class="d-more__sign" aria-hidden="true">−</span>'
        : '<span class="l-zh" lang="zh-Hans">展开全文</span><span class="l-en" lang="en">Read more</span><span class="d-more__sign" aria-hidden="true">+</span>';
    };
    var measureMore = function (el) {
      if (el.classList.contains("is-open")) return;
      el.classList.add("is-cut");
      var cut = el.scrollHeight > el.clientHeight + 24;
      el.classList.toggle("is-cut", cut);
      el._moreButton.hidden = !cut;
    };
    each(mores, function (el, i) {
      if (!el.id) el.id = "d-more-" + i;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "d-more__toggle";
      button.setAttribute("aria-controls", el.id);
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = moreLabel(false);
      button.hidden = true;
      button.addEventListener("click", function () {
        var open = !el.classList.contains("is-open");
        el.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
        button.innerHTML = moreLabel(open);
        if (open) {
          el.classList.remove("is-cut");
        } else {
          measureMore(el);
          /* Folding up from far below: bring the passage back into view. */
          if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start" });
        }
      });
      el._moreButton = button;
      el.parentNode.insertBefore(button, el.nextSibling);
    });
    var measureAll = function () { each(mores, measureMore); };
    var moreTimer;
    measureAll();
    document.addEventListener("dic:lang", measureAll);
    document.addEventListener("dic:layout", measureAll);
    window.addEventListener("resize", function () {
      clearTimeout(moreTimer);
      moreTimer = setTimeout(measureAll, 150);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAll);
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
