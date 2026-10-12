# alamhanz.xyz

Personal site built with Astro 7 (static output) and Tailwind CSS v4. Home, About (data-driven), a Markdown blog with RSS and sitemap, plus redirect pages for `/cv` and `/mycalendar`.

## Commands

Node >= 22.12.

```
npm ci
npm run dev            # dev server on http://localhost:4321
npm run build          # static site -> dist/
npm run preview        # serve dist/ locally
npm run check:routes   # stage dist/ like the deploy does and verify every internal link
```

## Structure

- `src/pages`: `index`, `about`, `blog/index`, `blog/[...slug]`, `cv`, `mycalendar`, `404`, `rss.xml.ts`
- `src/data/site.ts`: site title, description, CV/calendar/Medium URLs, social links
- `src/data/profile.ts`: all About facts (summary, experience, skills, certificates)
- `src/content/blog/*.md`: blog posts
- `src/styles/global.css`: Tailwind v4 theme tokens (body #F5F5F5, theme #30475E, selected-text #F05454, button #121212) and component classes
- `src/components/Icon.astro`: Tabler outline icons inlined as SVG at build time
- Fonts are self-hosted: Poppins (headings, UI), Inter (body). No third-party requests.
- `legacy/`: the old v1 HTML site, kept for reference, not built or deployed
- `scripts/`: `stage-dist.sh` (renames pages to extensionless objects), `check-routes.mjs`

## Add a post

Create `src/content/blog/<slug>.md`:

```
---
title: 'My post'
description: 'One line summary'
pubDate: 2026-10-10
tags: ['data']
draft: false   # draft posts are hidden in production builds
---
```

It appears at `/blog/<slug>`, on the blog index, on the home page (latest 3), in the RSS feed and the sitemap.

## Deploy

Pushing to `xyz` runs `.github/workflows/deploy_web.yml`: build, stage (`dist/*.html` -> extensionless objects, except `index.html` and `404.html`), `gcloud storage rsync` to `gs://alamhanz.xyz` with deletion of removed files, then content-type and cache headers. The bucket-only objects `images/hello.jpg`, `images/hello2.jpg`, `images/hello3.jpg` (og:image) and `about.txt` are excluded from the sync, so they are never deleted. `.github/workflows/ci.yml` builds and checks routes on `v2` and on PRs into `v2` and `xyz`.

Secrets: `GCP_CRED` (required). `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` are optional; the Cloudflare cache purge is skipped when they are absent.

The v2 site goes live only when `v2` is merged into `xyz`.
