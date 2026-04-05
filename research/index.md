---
title: Research
nav:
  order: 5
  tooltip: Research groups and publications
---

# {% include icon.html icon="fa-solid fa-flask" %}Research

{% include section.html %}

## Research Groups

We are in the process of establishing collaborative research groups across key areas of economics. These groups will bring together members with shared research interests to work on joint projects, co-author papers, and support each other's research agendas.

If you are interested in forming or joining a research group, please [get in touch](../contact).

{% include section.html %}

## Publications

Below are publications by SYVE members, organized by year.

{% assign publications_by_year = site.data.publications | group_by: "year" | sort: "name" | reverse %}

{% for year_group in publications_by_year %}
### {{ year_group.name }}

{% for pub in year_group.items %}
- **{{ pub.title }}** {% if pub.authors %}<span style="color: #666;">by {{ pub.authors }}</span>{% endif %}
  {% if pub.journal %}<em>{{ pub.journal }}</em>{% endif %}
  {% if pub.url %}[Link]({{ pub.url }}){% endif %}

{% endfor %}
{% endfor %}
