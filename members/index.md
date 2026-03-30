---
title: Members
nav:
  order: 2
  tooltip: Our members
---

# {% include icon.html icon="fa-solid fa-users" %}Members

We are a growing community of young Vietnamese economists -- PhD students, postdocs, and early-career researchers -- based at universities and institutions around the world.

{% include section.html %}

{% include list.html data="members" component="portrait" filter="role == 'pi'" %}
{% include list.html data="members" component="portrait" filter="role != 'pi'" %}
