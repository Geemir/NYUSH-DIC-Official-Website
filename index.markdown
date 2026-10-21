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
        <span>Kick-off Day <b>2026.11.9</b></span>
        <span class="dic-teaser__count" data-teaser-countdown="2026-11-09T17:00:00+08:00" hidden></span>
      </span>
    </span>
  </a>
</section>

<figure class="dic-quote">
  <blockquote>
    <p>&ldquo;This competition has grown beyond our campus into a platform with real international reach &mdash; bringing together young innovators from different disciplines and cultures to test ideas in real settings and refine them through teamwork.&rdquo;</p>
    <p class="dic-quote__zh" lang="zh-Hans">「这一赛事已经从校内走向校外，正成为更具国际影响力的创新平台——持续汇聚拥有不同学科与文化背景的创新青年，在现实情境中检验创意，在团队合作中完善方案。」</p>
  </blockquote>
  <figcaption>
    <strong>Nasir Memon</strong>
    <span>Former Dean of Computer Science, Data Science and Engineering, NYU Shanghai</span>
    <span lang="zh-Hans">上海纽约大学 计算机科学、数据科学与工程学部 前主任</span>
  </figcaption>
</figure>
