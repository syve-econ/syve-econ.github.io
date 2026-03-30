---
title: Home
nav:
  order: 1
  tooltip: Home
---

We are a community of young Vietnamese economists dedicated to fostering academic exchange, collaborative research, and intellectual growth across all fields of economics.

{%
  include button.html
  type="email"
  text="Get in touch"
  link="syve.econ@gmail.com"
%}
{%
  include button.html
  type="github"
  text="GitHub"
  link="syve-econ"
%}

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
  image="images/background.jpg"
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
  image="images/background.jpg"
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
  image="images/background.jpg"
  link="research-groups"
  title="Research Groups"
  text=text
%}
