# alamhanz.github.io State

## Overview
Personal static website (alamhanz.xyz) with plain HTML, Tailwind CSS v3, and GitHub Actions deployment to GCS. Navigation and footer inlined per page (no includes). Deploy branch is `xyz` (protected). Main branch not used for deploys.

## Current Status
- **Last deploy**: 2026-10-04, workflow run 37134407427 succeeded
- **Last merge**: fee3d1f (2026-10-04) PR #3 cleanup/site-structure into xyz
- **Live check**: /, /about, /cv, /blog, /mycalendar, /lyceum all return 200; About shows new CV-based content; /cv redirects to Google Drive PDF; lyceum unlinked from nav but still deployed
- **Deployed by**: owner (admin bypass of 1-approval + signed-commits protection)

## Deployed Versions
- xyz (production): fee3d1f
- main (GitHub default, not used): 51ade94

## Recent Changes (Log)
- 2026-10-04: Site restructure + review fixes: lyceum nav unlinked, nav/footer inlined per page, about rewritten from CV, new CV redirect link, skills updated (dropped TensorFlow, added GitHub/AWS/QuickSight), og:url per page, non-focusable closed mobile nav. (fee3d1f, ebde531, 1b51993)

## Decisions
- **Lyceum**: unlinked from nav but lyceum.html kept, deployed, and indexable
- **Nav/footer**: inlined into index.html, about.html, lyceum.html; header.html, footer.html deleted; jQuery removed
- **About content**: sourced only from CV PDF (local scratch copy: .claude/pipeline/cv-facts.md, not committed)
- **Public info**: no phone/email/city; calendar + social links only
- **Skills**: keep pandas, Jupyter, Docker, Google Cloud, Tableau, Data Studio; drop TensorFlow (certificate stays); add GitHub, AWS, QuickSight
- **Experience wording**: 10+ years (owner's answer)
- **Unused files**: kept on purpose (old-lyceum.txt, source.txt, some images)

## Open Issues
- (resolved) GCP project/region recorded in CLAUDE.md
- (resolved) workflow actions bumped to checkout@v4, auth@v2, setup-gcloud@v2
- xyz protection may be too strict for solo PRs (1 approval + signed commits); consider relaxing to 0 approvals
- Stale remote branches: base, dev, self-dev; main diverged from xyz (4 commits behind)
- (resolved) merged branch cleanup/site-structure deleted

## Next Up
- Optional: delete remote branch cleanup/site-structure
- Optional: tighten up GCP settings in CLAUDE.md if needed
- Consider refreshing workflow action versions if needed
- Browser testing at phone/desktop widths not yet done (owner previewed; approved)
