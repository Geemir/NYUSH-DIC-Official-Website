---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

layout: home
---

{%- comment -%}
  Home. Styles live in _sass/dic/_site.scss (.dic-home, .dic-teaser);
  the countdown runs from assets/js/dic-site.js. The teaser text comes
  from _data/dic2026.yml so it always matches the DIC 2026 page.
{%- endcomment -%}
{%- assign d26 = site.data.dic2026 -%}

<section class="dic-home">
  <img class="dic-home__mark" src="/assets/images/dic-mark-192.png" width="131" height="192" alt="">
  <p class="dic-home__l1">NYU SHANGHAI</p>
  <h1 class="dic-home__l2">DIGITAL INNOVATION CHALLENGE</h1>
  <p class="dic-home__l3">"Learning by Doing, Changing by Creating."</p>

  <div class="dic-home__actions">
    <a class="btn btn--primary btn--large" href="/DIC2026/">DIC 2026 &rarr;</a>
    <a class="btn btn--inverse btn--large" href="/PastEvents/">Past Events</a>
  </div>

  <a class="dic-teaser" href="/DIC2026/">
    <span class="dic-teaser__bar"><span>NYUSHDIC_{{ d26.year }}</span><span>&#9679; {{ d26.status }}</span></span>
    <span class="dic-teaser__body">
      <span class="dic-teaser__opc">{{ d26.theme_file.theme.short }}_</span>
      <span class="dic-teaser__line">{{ d26.theme_file.theme.line_1 }} {{ d26.theme_file.theme.line_2 }}</span>
      <span class="dic-teaser__meta">
        <span>Kick-off Day &middot; 2026.11.9</span>
        <span class="dic-teaser__count" data-teaser-countdown="2026-11-09T00:00:00+08:00" hidden></span>
      </span>
    </span>
  </a>
</section>
