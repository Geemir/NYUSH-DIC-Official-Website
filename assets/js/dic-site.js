/*
 * Site-wide improvements, loaded on every page (see _includes/footer/custom.html).
 *  - marks the current page in the top menu
 *  - opens posters, logos, QR codes and photos full size on tap
 *  - runs the DIC 2026 countdown on the home page
 *  - draws a stream of letters and digits behind the mouse on the home page
 */
(function () {
  "use strict";

  /* ------------------------------------------------------- current page */
  var here = decodeURI(location.pathname).replace(/\/?$/, "/");
  document.querySelectorAll(".greedy-nav .visible-links a").forEach(function (a) {
    if (a.hash) return; // in-page links (e.g. Registration → #signup) are not pages
    var path = decodeURI(new URL(a.href, location.href).pathname).replace(/\/?$/, "/");
    if (path === here) a.setAttribute("aria-current", "page");
  });

  /* --------------------------------------------------------- tap to zoom */
  var opener = null;
  var box = null;

  function close() {
    if (!box) return;
    box.remove();
    box = null;
    document.body.style.overflow = "";
    if (opener) opener.focus();
  }

  function open(src, alt, from) {
    close();
    opener = from;
    box = document.createElement("div");
    box.className = "dic-lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", alt || "Image");

    var img = document.createElement("img");
    img.src = src;
    img.alt = alt || "";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Close");
    btn.textContent = "×";

    box.appendChild(img);
    box.appendChild(btn);
    box.addEventListener("click", close);
    document.body.appendChild(box);
    document.body.style.overflow = "hidden";
    btn.focus();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  /* Images inside page content that are not already links, plus anything
     marked data-zoom / data-zoom-link. Skips tiny icons and card photos. */
  var candidates = document.querySelectorAll(".page__content img, img[data-zoom]");
  candidates.forEach(function (img) {
    if (img.closest("a") || img.closest(".archive__item-teaser")) return;
    var w = parseInt(img.getAttribute("width"), 10);
    if (w && w < 64) return;
    img.classList.add("dic-zoomable");
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    var go = function () { open(img.currentSrc || img.src, img.alt, img); };
    img.addEventListener("click", go);
    img.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    });
  });

  document.querySelectorAll("a[data-zoom-link]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return; // let new-tab clicks through
      e.preventDefault();
      var img = a.querySelector("img");
      open(a.href, img ? img.alt : "", a);
    });
  });

  /* ----------------------------------------------- home-page countdown */
  var DAY = 86400000;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var counters = document.querySelectorAll("[data-teaser-countdown]");

  function tick() {
    var now = Date.now();
    counters.forEach(function (el) {
      var diff = Date.parse(el.getAttribute("data-teaser-countdown")) - now;
      if (diff <= 0) { el.hidden = true; return; }
      el.hidden = false;
      el.textContent = "T−" + Math.floor(diff / DAY) + "d " +
        pad(Math.floor(diff / 3600000) % 24) + ":" +
        pad(Math.floor(diff / 60000) % 60) + ":" +
        pad(Math.floor(diff / 1000) % 60);
    });
  }
  if (counters.length) {
    tick();
    setInterval(tick, 1000);
  }

  /* --------------------------------------------- home: a stream of glyphs */
  /* On the home page, moving the mouse leaves a trail of random letters and
     digits that drift down, flicker and fade, like data falling off the
     cursor. Mouse only (not touch), off under reduced motion, and the canvas
     goes quiet as soon as nothing is moving. */
  (function () {
    var home = document.querySelector(".dic-home");
    if (!home || !window.matchMedia) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var COLORS = ["#386272", "#3119dc", "#ca7ddd", "#4fa8bd"]; // site teal, logo indigo, orchid, cyan (darkened for white)
    var MAX = 260;
    var SPACING = 14; // px of mouse travel per glyph

    var canvas = document.createElement("canvas");
    canvas.className = "dic-trail";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var dpr = 1, w = 0, h = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    var glyphs = [];
    var last = null;
    var running = false;
    var pick = function (s) { return s.charAt(Math.floor(Math.random() * s.length)); };

    function spawn(x, y) {
      if (glyphs.length >= MAX) glyphs.shift();
      glyphs.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 6,
        vy: 0.5 + Math.random() * 1.4,          // drift down
        vx: (Math.random() - 0.5) * 0.3,
        size: 11 + Math.floor(Math.random() * 7),
        ch: pick(GLYPHS),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 0,
        ttl: 50 + Math.random() * 40            // frames
      });
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (var i = glyphs.length - 1; i >= 0; i--) {
        var g = glyphs[i];
        g.life++;
        if (g.life >= g.ttl) { glyphs.splice(i, 1); continue; }
        g.x += g.vx; g.y += g.vy;
        if (Math.random() < 0.08) g.ch = pick(GLYPHS);   // flicker to a new glyph
        var t = g.life / g.ttl;
        ctx.globalAlpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
        ctx.fillStyle = g.color;
        ctx.font = "700 " + g.size + 'px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';
        ctx.fillText(g.ch, g.x, g.y);
      }
      ctx.globalAlpha = 1;
      if (glyphs.length) requestAnimationFrame(frame);
      else running = false;
    }

    document.addEventListener("mousemove", function (e) {
      var x = e.clientX, y = e.clientY;
      if (!last) { last = { x: x, y: y }; return; }
      var dx = x - last.x, dy = y - last.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < SPACING) return;
      var steps = Math.min(6, Math.floor(dist / SPACING));
      for (var s = 1; s <= steps; s++) spawn(last.x + dx * s / steps, last.y + dy * s / steps);
      last = { x: x, y: y };
      if (!running) { running = true; requestAnimationFrame(frame); }
    }, { passive: true });
    document.addEventListener("mouseleave", function () { last = null; });
  })();
})();
