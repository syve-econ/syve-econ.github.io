---
title: Blog
nav:
  order: 6
  tooltip: News and updates
---

# {% include icon.html icon="fa-solid fa-feather-pointed" %}Blog

News, updates, and insights from the SYVE community.

{% include section.html %}

{% include search-box.html %}

{% include tags.html tags=site.tags %}

{% include search-info.html %}

{% include list.html data="posts" component="post-excerpt" %}
