# Copilot Instructions for SYVE Website

This is a Jekyll-based website for the Society of Young Vietnamese Economists (SYVE). The site is built from the [Lab Website Template](https://github.com/greenelab/lab-website-template) by Greene Lab.

## Build & Development

**Local setup:**
```bash
bundle install
bundle exec jekyll serve
```
The site runs at `http://localhost:4000`.

**Build for production:**
```bash
JEKYLL_ENV=production bundle exec jekyll build
```
Output goes to `_site/`.

**Preview pull request build:**
```bash
bundle exec jekyll build --baseurl "/preview/pr-{PR_NUMBER}"
```

## Site Structure & Architecture

### Content Organization
- **Pages:** Markdown files in root (e.g., `index.md`, `contact/`) become site pages
- **Members:** Collection in `_members/` - YAML front matter defines role, affiliation, and links; no individual pages generated
- **Posts:** Collection in `_posts/` - Blog articles (typically blog entries, news updates)
- **Projects:** Listed from `_data/projects.yaml` (not individual files)
- **Static assets:** Images in `images/`, referenced in layouts as `/images/filename.jpg`

### Layout System
- **`_layouts/default.html`:** Main template - wraps content with header, footer, and includes
- **`_layouts/member.html`:** Used by member pages (from front matter defaults)
- **`_layouts/post.html`:** Used for blog posts
- All layouts compose from includes in `_includes/` (e.g., `header.html`, `footer.html`, `content.html`)

### Key Data Files
- **`_data/projects.yaml`:** Project listings for research groups
- **`_data/citations.yaml`:** Bibliography or citation data (processed by `citation.html` include)
- **`_data/types.yaml`:** Publication/content type definitions
- **`_data/sources.yaml`:** Citation source configuration

## Content Conventions

### Front Matter
All markdown files use YAML front matter:
```yaml
---
title: Page Title
nav:
  order: 1
  tooltip: Navigation label
---
```

### Member Profile Format
Members in `_members/` use this structure:
```yaml
---
date: YYYY-MM-DD
name: Full Name
description: Role and affiliation
role: [pi, postdoc, student, etc.]
affiliation: Organization Name
image: images/photo.jpg
links:
  email: user@example.com
  orcid: 0000-0000-0000-0000
  home-page: https://example.com
---
```

### Jekyll Includes
Custom includes handle common patterns:
- **`{% include section.html %}`** — Section divider with spacing
- **`{% include member-card.html %}`** — Member profile card
- **`{% include alert.html type="info" %}`** — Alert boxes
- **`{% include feature.html %}`** — Feature blocks
- **`{% include card.html %}`** — Generic card containers

### Markdown Extensions
The site uses `jekyll-spaceship` plugin, which adds advanced markdown syntax for tables, diagrams, and enhanced formatting. Prefer this over HTML when possible.

## Content Management Workflows

### Adding a Member
1. Create file `_members/name-in-kebab-case.md`
2. Add YAML front matter with name, affiliation, role, image path
3. Add portrait image to `images/` directory
4. Member appears automatically on team page; no need to update indexes

### Adding a Blog Post
1. Create file in `_posts/YYYY-MM-DD-title-slug.md` (Jekyll requirement)
2. Add front matter with title, authors, date
3. Post appears in feed and on blog page automatically

### Adding a Project
1. Edit `_data/projects.yaml` (YAML list format)
2. Include project title, description, status, and links
3. Projects render on research page through `projects.html` include

### Adding a Publication
1. Edit `_data/publications.yaml`
2. Add entry with: `title`, `year`, and optionally `authors`, `journal`, `url`, `doi`
3. Publications automatically sorted by year (newest first) on Research page

**Publication format example:**
```yaml
- title: "Paper Title"
  authors: "Author One, Author Two"
  journal: "Journal Name"
  year: 2025
  url: "https://example.com/paper"
  doi: "10.1234/journal.2025.001"
```

## Build Pipeline

GitHub Actions workflows handle automation:
- **`build-site.yaml`** — Builds production site; runs on push to main
- **`build-preview.yaml`** — Builds preview for pull requests to `/preview/pr-{NUMBER}/`
- **`update-citations.yaml`** — Syncs citations from remote sources
- **`on-pages.yaml`** — Triggered when Pages deployment completes
- Site is deployed to GitHub Pages using `github-pages-deploy-action`

## Configuration

- **`_config.yaml`:** Main Jekyll config - site title, subtitle, URLs, plugin settings, collection defaults
- **`_config.yaml` social links section:** Defines GitHub, Twitter, email, YouTube handles
- **Sass:** Compiled from `_styles/` directory (configured in `_config.yaml`)
- **Syntax highlighting:** Uses Rouge highlighter

## Common Editing Tasks

**Update site metadata:** Edit `title`, `description`, and `links` in `_config.yaml`

**Add new page section:** Create markdown file in root or subdirectory, include YAML front matter with nav order

**Modify header/footer:** Edit `_includes/header.html` and `_includes/footer.html` (used by all pages)

**Add styles:** Add SCSS to `_styles/` (imported via includes)

**Exclude files from build:** Add to `exclude` list in `_config.yaml`
