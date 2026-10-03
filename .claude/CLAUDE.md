# alamhanz.github.io: personal website (alamhanz.xyz)

Static personal site: home, about (bio, experience, skills from the CV), lyceum (kept online but not linked), plus redirect pages for blog (Medium), cv (Google Drive PDF) and mycalendar.

## Stack
- Plain HTML pages: index, about, lyceum (full pages); blog, cv, mycalendar (meta-refresh redirects, noindex)
- Nav and footer are inlined in each full page (no includes): a menu change must be made in index.html, about.html and lyceum.html
- Tailwind CSS v3 (devDependency): source index.css -> built tailwind.css (committed); config tailwind.config.js (content: ./*.html, ./*.js)
- navi-pilot.js: mobile nav toggle (#toggle, #nav; toggles -right-full/right-0/invisible, aria-expanded, Escape closes)
- Font Awesome for social/skill icons; images in images/

## Git
- GitHub: alamhanz/alamhanz.github.io, remote over HTTPS (gh credentials)
- `xyz` = production branch; pushing or merging into it deploys. `main` is the GitHub default but not used for deploys
- `xyz` is protected: 1 approval + signed commits + resolved conversations. As the only maintainer, merge PRs on GitHub by ticking "Merge without waiting for requirements (bypass rules)"
- Work on a feature branch, open a PR into `xyz`

## Commands
- Install: `npm install`
- Build CSS: `npx tailwindcss -i ./index.css -o ./tailwind.css` (`npm run build` = watch mode)
- Preview locally: `npx serve -l 8000` (serves extensionless URLs like /about; `python -m http.server` does not)
- Tests: none

## Deploy
- GitHub Actions `.github/workflows/deploy_web.yml` on push to `xyz`
- Copies the repo (non-dotfiles) to GCS bucket `gs://alamhanz.xyz/`, renames about/blog/cv/lyceum/mycalendar `.html` to extensionless and sets content-type text/html
- A new top-level page needs its own rename + content-type lines in the workflow; internal links use extensionless paths
- Verify: `gh run list --branch xyz`, then curl https://alamhanz.xyz/<page>

## Cloud
- GCP, bucket `alamhanz.xyz`, location ASIA (multi-region); og:image hello3.jpg lives only in the bucket, not in the repo
- Local gcloud: account alamhanz@gmail.com, project `hanz-hub`, default region asia-northeast1 (bucket's owning project not confirmed; check before cloud changes)

## Credentials
- `GCP_CRED` (GitHub Actions secret: service account JSON). No local env vars.

## Conventions
- Theme colors: body #F5F5F5, theme #30475E, selected-text #F05454, button #121212; font Poppins
- Rebuild tailwind.css after changing classes and commit it
- About page facts come only from the owner's CV; no phone/email/city on the public site
- Unused files kept on purpose: old-lyceum.txt, source.txt, some images
