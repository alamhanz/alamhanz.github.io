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
npm run blog           # local blog manager (see below)
npm run blog:smoke     # blog manager tests
npm run blog:ui-test   # blog manager browser test (needs Edge or Chrome)
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

Optional front matter: `cover: '../../assets/blog/<slug>/cover.jpg'` and `coverAlt: '...'` (cover image, also used as the og:image, cropped to 1200x630).

## Blog manager (local only)

A local UI for writing and publishing posts, so you don't have to edit Markdown and open PRs by hand. Code and details: [`tools/blog-manager/README.md`](tools/blog-manager/README.md). It is never built or deployed.

```
git checkout xyz; git pull
npm ci                 # first time, or when dependencies changed
npm run blog
```

- Manager UI: http://127.0.0.1:4322; site preview (astro dev): http://127.0.0.1:4321. Ctrl+C stops both.
- Write: create a draft and write in a Medium-style editor (formatting shows inline, select text for the toolbar, "+" on an empty line; autosaves). Upload, drag or paste images into `src/assets/blog/<slug>/`; pick one as the cover.
- Publish: opens a PR into `xyz` from branch `post/<slug>` (via a temporary worktree; your checkout is untouched) and shows the PR link. Needs `gh auth login`. The post goes live when that PR is merged; commits are unsigned, so merge with bypass: `gh pr merge <n> --merge --admin`.
- After the post PR is merged: delete the local copy (Delete button in the UI) before `git pull`, otherwise the pull clashes with the same files.
- If the terminal was closed instead of Ctrl+C, an astro process may still hold port 4321: `Get-Process node | Stop-Process`.
- First time: do one throwaway publish (checklist at the end of the tool README), check the PR only touches that post's files, then close it and delete the post.

## Deploy

Pushing to `xyz` runs `.github/workflows/deploy_web.yml`: build, stage (`dist/*.html` -> extensionless objects, except `index.html` and `404.html`), `gcloud storage rsync` to `gs://alamhanz.xyz` with deletion of removed files, then content-type and cache headers. The bucket-only objects `images/hello.jpg`, `images/hello2.jpg`, `images/hello3.jpg` (og:image) and `about.txt` are excluded from the sync, so they are never deleted. `.github/workflows/ci.yml` builds and checks routes on PRs into `xyz`. Work happens on feature branches off `xyz`, merged by PR.

Secrets: `GCP_CRED` (required). `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` are optional; the Cloudflare cache purge is skipped when they are absent.
