# alamhanz.github.io: personal website (alamhanz.xyz)

Astro 7 static site (v2), live at alamhanz.xyz since the v2 -> xyz cutover (PR #8, 2026-10-12). Pages: home, about (data-driven), blog (Markdown, RSS, sitemap), redirects for cv (Google Drive PDF) and mycalendar. No lyceum page in v2.

## Stack
- Astro 7 (Node >= 22.12), `build.format: 'file'`, `trailingSlash: 'never'`, output in `dist/`
- Tailwind CSS v4 via `@tailwindcss/vite`; tokens in `@theme` in `src/styles/global.css`; typography plugin for posts
- Data: `src/data/site.ts` (URLs, socials), `src/data/profile.ts` (About facts); blog in `src/content/blog/*.md` (schema in `src/content.config.ts`, `draft: true` hidden in prod)
- Icons: Tabler outline SVGs inlined by `src/components/Icon.astro` (add new icons to its import map; `@tabler/icons` is a devDependency). Fonts self-hosted: Poppins (headings/UI), Inter (body). No third-party JS or CDN.
- Mobile nav toggle is a small script in `src/components/Header.astro`
- `legacy/` holds the v1 files (not built or deployed)

## Git
- GitHub: alamhanz/alamhanz.github.io, remote over HTTPS (gh credentials)
- `xyz` = production branch; pushing or merging into it deploys. `main` is the GitHub default but not used for deploys
- `xyz` is protected: PR required (0 approvals) + signed commits + resolved conversations. Agent and local commits are unsigned, so merge PRs on GitHub by ticking "Merge without waiting for requirements (bypass rules)"
- Work: feature branches off `xyz`, PRs into `xyz`

## Commands
- Install: `npm ci` (or `npm install`)
- Dev: `npm run dev`; build: `npm run build`; preview: `npm run preview`
- Route check: `npm run check:routes` (stages dist like the deploy, verifies internal links)
- Tests: none for the site; `npm run blog:smoke` for the blog manager

## Blog manager (local only)
- `npm run blog` starts astro dev (127.0.0.1:4321) plus the manager UI (127.0.0.1:4322); Ctrl+C stops both. Code in `tools/blog-manager/` (not built, not deployed); README there
- Publish = PR to `xyz` from branch `post/<slug>` via temp worktree (needs `gh auth login`); images in `src/assets/blog/<slug>/`, optional `cover` + `coverAlt` in front matter (og:image cropped 1200x630)
- Tests: `npm run blog:smoke`; `npm run blog:ui-test` (playwright-core on local Edge/Chrome, local only)

## Deploy
- `.github/workflows/deploy_web.yml` on push to `xyz`: build, `scripts/stage-dist.sh` (every `dist/**/*.html` except index/404 becomes an extensionless object; `blog.html` stays `.html` locally because `blog/` is a directory and is uploaded to object `blog` by the workflow), `gcloud storage rsync --delete-unmatched-destination-objects` to `gs://alamhanz.xyz`, then content-type and cache headers
- The sync excludes (never uploads or deletes) bucket-only `images/hello.jpg`, `images/hello2.jpg`, `images/hello3.jpg`, `about.txt`, and the v1 lyceum page set: `lyceum`, `tailwind.css`, `navi-pilot.js`, `images/lyceum-logo.jpg` (the lyceum page also uses `public/images/` svgs/ico: docker, google-cloud, jupyter, Pandas_mark, python, tableau, prod_man, so keep them there or add them to EXCLUDE)
- `.github/workflows/ci.yml`: build + stage + route check on PRs into `xyz`
- New top-level pages need no workflow change; internal links are absolute and extensionless (`/about`)
- Optional Cloudflare purge runs only if `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` secrets exist
- Verify: `gh run list --branch xyz`, then curl https://alamhanz.xyz/<page>

## Cloud
- GCP, bucket `alamhanz.xyz`, location ASIA (multi-region); og:image hello3.jpg is in `public/images/` (also in the bucket, excluded from the sync)
- Local gcloud: account alamhanz@gmail.com, project `hanz-hub`, default region asia-northeast1 (bucket's owning project not confirmed; check before cloud changes)

## Credentials
- `GCP_CRED` (GitHub Actions secret: service account JSON). Optional: `CLOUDFLARE_API_TOKEN` (Zone.Cache Purge), `CLOUDFLARE_ZONE_ID`. No local env vars.

## Conventions
- Theme colors: body #F5F5F5, theme #30475E, selected-text #F05454, button #121212; Poppins for headings/UI, Inter for body
- About page facts come only from the owner's CV (plus owner-approved location: Tokyo, Japan, and country per employer); no phone/email on the public site
- Unused v1 files kept on purpose in `legacy/` (old-lyceum.txt, source.txt, unused images)
