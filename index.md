---
title: Home
nav:
  order: 1
  tooltip: Home
---

## About

The Society of Young Vietnamese Economists (SYVE) is a community of Vietnamese economists at early stages of their academic careers -- PhD students, postdocs, and junior researchers -- based at universities and institutions around the world. We foster intellectual exchange, collaborative research, and mutual support across all fields of economics.

{% include section.html %}

## What We Do

{% capture text %}

We organize weekly reading groups to present and discuss classic and seminal papers across various topics in economics, from microeconomics and game theory to development economics and econometrics.

{%
  include button.html
  link="reading-groups"
  text="Join our reading groups"
  icon="fa-solid fa-arrow-right"
  flip=true
  style="bare"
%}

{% endcapture %}

{%
  include feature.html
  image="images/reading_group.jpg"
  link="reading-groups"
  title="Reading Groups"
  text=text
%}

{% capture text %}

Our seminars bring together early-career economists to present their research, exchange ideas, and receive feedback from peers across different fields of economics.

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
  image="images/seminars.jpeg"
  link="seminars"
  title="Seminars"
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
