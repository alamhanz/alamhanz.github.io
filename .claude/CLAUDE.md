# alamhanz.github.io: personal website (alamhanz.xyz)

Astro 7 static site (v2, branch `v2` / `feat/v2-astro`; live `xyz` is still the v1 plain-HTML site until `v2` is merged into `xyz`). Pages: home, about (data-driven), blog (Markdown, RSS, sitemap), redirects for cv (Google Drive PDF) and mycalendar. No lyceum page in v2.

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
- `xyz` is protected: 1 approval + signed commits + resolved conversations. As the only maintainer, merge PRs on GitHub by ticking "Merge without waiting for requirements (bypass rules)"
- v2 work: feature branches off `v2`, PRs into `v2`; cutover = PR `v2` -> `xyz` (owner-triggered)

## Commands
- Install: `npm ci` (or `npm install`)
- Dev: `npm run dev`; build: `npm run build`; preview: `npm run preview`
- Route check: `npm run check:routes` (stages dist like the deploy, verifies internal links)
- Tests: none

## Deploy
- `.github/workflows/deploy_web.yml` on push to `xyz`: build, `scripts/stage-dist.sh` (every `dist/**/*.html` except index/404 becomes an extensionless object; `blog.html` stays `.html` locally because `blog/` is a directory and is uploaded to object `blog` by the workflow), `gcloud storage rsync --delete-unmatched-destination-objects` to `gs://alamhanz.xyz`, then content-type and cache headers
- The sync excludes (never uploads or deletes) bucket-only `images/hello.jpg`, `images/hello2.jpg`, `images/hello3.jpg`, `about.txt`
- `.github/workflows/ci.yml`: build + stage + route check on push to `v2` and PRs into `v2`/`xyz`
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
- About page facts come only from the owner's CV; no phone/email/city on the public site
- Unused v1 files kept on purpose in `legacy/` (old-lyceum.txt, source.txt, unused images)
