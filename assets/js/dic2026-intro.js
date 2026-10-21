/*
 * DIC 2026 opening animation — first visit only.
 *
 * "Digital Innovation Challenge" types in over a circuit board that draws
 * itself; then every letter except D, I and C folds away, the initials slide
 * together into "DIC", "2026" stamps in beside them, and the screen lifts like
 * a curtain onto the page.
 *
 * The head script (_includes/head/custom.html) decides whether to play: first
 * visit, no #anchor in the link, motion allowed. It sets html.d-intro-pending,
 * which covers the page in navy until this runs, and removes it on its own
 * after a few seconds if anything goes wrong. Any click or key skips.
 * Requires anime.js 3 (window.anime).
 */
(function () {
  "use strict";

  var root = document.documentElement;
  if (!root.classList.contains("d-intro-pending")) return;

  var anime = window.anime;
  function release() { root.classList.remove("d-intro-pending"); }
  if (typeof anime !== "function") { release(); return; }

  try { localStorage.setItem("dic26-intro-seen", "1"); } catch (e) { /* private mode */ }

  /* ---------------------------------------------------------------- markup */
  var words = ["Digital", "Innovation", "Challenge"];
  var title = words.map(function (w, i) {
    var rest = w.slice(1).split("").map(function (c) { return "<i>" + c + "</i>"; }).join("");
    return (i ? '<span class="d-intro__gap"> </span>' : "") +
      '<span class="d-intro__word"><b><i>' + w.charAt(0) + '</i></b><span class="d-intro__rest">' + rest + "</span></span>";
  }).join("");

  /* Circuit traces from the edges towards the title, on a 1600x900 board.
     Each ends in a node square that lights up when its line arrives. */
  var traces = [
    [[0, 180], [260, 180], [340, 260], [560, 260]],
    [[0, 420], [180, 420], [240, 360], [470, 360]],
    [[0, 700], [300, 700], [380, 620], [600, 620]],
    [[1600, 140], [1340, 140], [1260, 220], [1040, 220]],
    [[1600, 470], [1420, 470], [1360, 410], [1130, 410]],
    [[1600, 760], [1290, 760], [1210, 680], [1000, 680]],
    [[420, 0], [420, 120], [480, 180], [480, 300]],
    [[1180, 0], [1180, 140], [1120, 200], [1120, 310]],
    [[520, 900], [520, 780], [580, 720], [580, 600]],
    [[1080, 900], [1080, 760], [1020, 700], [1020, 590]]
  ];
  var svg = '<svg class="d-intro__board" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
    traces.map(function (pts) {
      return '<path class="d-intro__trace" d="M' + pts.map(function (pt) { return pt.join(" "); }).join(" L") + '"/>';
    }).join("") +
    traces.map(function (pts) {
      var end = pts[pts.length - 1];
      return '<rect class="d-intro__node" x="' + (end[0] - 6) + '" y="' + (end[1] - 6) + '" width="12" height="12"/>';
    }).join("") +
    "</svg>";

  var box = document.createElement("div");
  box.className = "d-intro";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML =
    '<div class="d-intro__grid"></div>' + svg +
    '<div class="d-intro__scan"></div>' +
    '<div class="d-intro__stage">' +
    '  <p class="d-intro__kicker">NYU SHANGHAI</p>' +
    '  <div class="d-intro__title">' + title +
    '    <span class="d-intro__year"><i>2</i><i>0</i><i>2</i><i>6</i></span>' +
    "  </div>" +
    "</div>" +
    '<button type="button" class="d-intro__skip" tabindex="-1">Skip <span lang="zh-Hans">跳过</span></button>';
  document.body.appendChild(box);

  var q = function (sel) { return box.querySelectorAll(sel); };
  var rests = Array.prototype.slice.call(q(".d-intro__rest"));
  var gaps = Array.prototype.slice.call(q(".d-intro__gap"));
  var year = box.querySelector(".d-intro__year");

  /* Fix the widths that will collapse (and the year's, which will open). */
  rests.concat(gaps).forEach(function (el) { el.style.width = el.getBoundingClientRect().width + "px"; });
  var yearWidth = year.getBoundingClientRect().width;
  year.style.width = "0px";

  /* -------------------------------------------------------------- timeline */
  var finished = false;
  /* Hold on "DIC 2026" for a moment, then lift. (A target-less step would
     never fire its callbacks in anime.js 3, so the exit hangs off complete.) */
  var tl = anime.timeline({ easing: "easeOutQuart", complete: function () { setTimeout(lift, 500); } });

  tl.add({ targets: box.querySelector(".d-intro__grid"), opacity: [0, 1], scale: [1.08, 1], duration: 900 }, 0)
    .add({ targets: q(".d-intro__trace"), strokeDashoffset: [anime.setDashoffset, 0], duration: 1300, delay: anime.stagger(70), easing: "easeInOutSine" }, 0)
    .add({ targets: q(".d-intro__node"), opacity: [0, 1], scale: [0, 1], duration: 400, delay: anime.stagger(70), easing: "easeOutBack" }, 1100)
    .add({ targets: box.querySelector(".d-intro__scan"), translateY: ["-10vh", "110vh"], opacity: [{ value: 0.9, duration: 200 }, { value: 0, duration: 400, delay: 900 }], duration: 1500, easing: "linear" }, 100)
    .add({ targets: box.querySelector(".d-intro__kicker"), opacity: [0, 1], letterSpacing: ["0.6em", "0.32em"], duration: 900 }, 150)
    .add({ targets: q(".d-intro__title i"), opacity: [0, 1], translateY: ["0.35em", 0], duration: 520, delay: anime.stagger(22) }, 250)
    /* the rest of each word folds away; the initials slide together */
    .add({ targets: rests, width: 0, opacity: 0, duration: 750, easing: "easeInOutQuart" }, 1500)
    .add({ targets: gaps, width: 0, duration: 750, easing: "easeInOutQuart" }, 1500)
    .add({ targets: q(".d-intro__word b"), color: ["#f4f5ff", "#d8cbff"], duration: 500, begin: function () { box.classList.add("is-dic"); } }, 1850)
    /* 2026 stamps in */
    .add({ targets: year, width: yearWidth, duration: 520, easing: "easeOutCubic" }, 2250)
    .add({ targets: q(".d-intro__year i"), opacity: [0, 1], translateY: ["-0.6em", 0], scale: [1.4, 1], duration: 620, delay: anime.stagger(70), easing: "easeOutBack" }, 2300)
    .add({ targets: q(".d-intro__trace"), opacity: [1, 0.35], duration: 600 }, 2400);

  /* --------------------------------------------------------------- the end */
  function lift() {
    if (finished) return;
    finished = true;
    document.removeEventListener("keydown", skip, true);
    box.removeEventListener("click", skip);
    release();
    anime({
      targets: box,
      translateY: "-100%",
      duration: 760,
      easing: "easeInOutQuart",
      complete: function () { box.remove(); }
    });
    anime({ targets: box.querySelector(".d-intro__stage"), opacity: 0, translateY: -30, duration: 420, easing: "easeInQuad" });
  }

  function skip(e) {
    if (e && e.type === "keydown") e.preventDefault();
    tl.pause();
    lift();
  }
  document.addEventListener("keydown", skip, true);
  box.addEventListener("click", skip);
})();
