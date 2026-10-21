/*
 * Site-wide improvements, loaded on every page (see _includes/footer/custom.html).
 *  - marks the current page in the top menu
 *  - opens posters, logos, QR codes and photos full size on tap
 *  - runs the DIC 2026 countdown on the home page
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
})();
