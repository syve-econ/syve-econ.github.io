---
title: Members
nav:
  order: 2
  tooltip: Our members
---

# {% include icon.html icon="fa-solid fa-users" %}Members

Our members are PhD students, postdocs, and early-career researchers at universities and institutions worldwide. We are united by a shared passion for economics and a desire to support one another's academic journeys.

{% include section.html %}

## Member Directory

{% assign members = site.members | sort: "order" %}

<table class="member-table">
<thead>
<tr>
<th>Name</th>
<th>Position</th>
<th>Affiliation</th>
<th>Research Interests</th>
<th>Site</th>
</tr>
</thead>
<tbody>
{%- for member in members %}
<tr>
<td>{% if member.email %}<a href="mailto:{{ member.email }}">{{ member.name }}</a>{% else %}{{ member.name }}{% endif %}</td>
<td>{{ member.position }}</td>
<td>{{ member.affiliation }}</td>
<td>{{ member.fields }}</td>
<td>{% if member.link %}<a href="{{ member.link }}">Link</a>{% endif %}</td>
</tr>
{%- endfor %}
</tbody>
</table>

{% include section.html %}

To join SYVE or to update your details in this directory, please [contact us](../contact).
