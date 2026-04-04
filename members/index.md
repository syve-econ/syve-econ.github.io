---
title: Members
nav:
  order: 2
  tooltip: Our members
---

# {% include icon.html icon="fa-solid fa-users" %}Members

Our members are PhD students, postdocs, and early-career researchers at universities and institutions worldwide. We are united by a shared passion for economics and a desire to support one another's academic journeys.

{% include section.html %}

{% include list.html data="members" component="member-card" filter="role == 'pi'" %}
{% include list.html data="members" component="member-card" filter="role != 'pi'" %}
