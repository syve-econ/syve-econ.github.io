---
title: Home
nav:
  order: 1
  tooltip: Home
---

The Society of Young Vietnamese Economists (SYVE) is a community of Vietnamese economists at early stages of their academic careers -- PhD students, postdocs, and junior researchers -- based at universities and institutions around the world. We foster intellectual exchange, collaborative research, and mutual support across all fields of economics.

{% include section.html %}

## What We Do

{% capture text %}

We organize weekly reading groups to present and discuss classic and seminal papers across various topics in economics. Our seminars bring together early-career economists to share ideas and deepen their understanding of the field.

{%
  include button.html
  link="seminars"
  text="View our seminars"
  icon="fa-solid fa-arrow-right"
  flip=true
  style="bare"
%}

{% endcapture %}

{%
  include feature.html
  image="images/reading_group.jpg"
  link="seminars"
  title="Seminars & Reading Groups"
  text=text
%}

{% capture text %}

Our members are PhD students, postdocs, and early-career researchers at universities and institutions worldwide. We are united by a shared passion for economics and a desire to support one another's academic journeys.

{%
  include button.html
  link="members"
  text="Meet our members"
  icon="fa-solid fa-arrow-right"
  flip=true
  style="bare"
%}

{% endcapture %}

{%
  include feature.html
  image="images/seminars.jpeg"
  link="members"
  title="Our Members"
  flip=true
  style="bare"
  text=text
%}

{% capture text %}

We are building collaborative research groups across key areas of economics. Stay tuned for upcoming projects and opportunities to get involved.

{%
  include button.html
  link="research-groups"
  text="Learn more"
  icon="fa-solid fa-arrow-right"
  flip=true
  style="bare"
%}

{% endcapture %}

{%
  include feature.html
  image="images/research_groups.jpg"
  link="research-groups"
  title="Research Groups"
  text=text
%}
