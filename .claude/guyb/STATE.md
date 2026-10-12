<!-- guyb:state -->
# alamhanz.github.io State

**Last updated**: 2026-10-12

## Overview
Personal website (alamhanz.xyz): Astro 7 static site (v2) with Tailwind CSS v4, deployed by GitHub Actions to GCS bucket `alamhanz.xyz`. Deploy branch is `xyz` (protected). `main` is the GitHub default but not used for deploys. v1 plain-HTML files live in `legacy/`.

## Current Status
- **v2 Astro site is LIVE** at alamhanz.xyz: the cutover PR #8 (v2 -> xyz) and the follow-up hero fix PR #9 (fix/home-hero -> xyz) are merged, and both deploy runs on xyz succeeded (verified with gh, 2026-10-12).
- **In progress**: branch `feat/blog-manager` (6 commits ahead of origin/xyz: blog manager backend, UI, smoke tests, review fixes) is about to be reviewed and opened as a PR into xyz.
- **Deployed by**: owner (admin bypass of 1-approval + signed-commits protection)

## Deployed Versions
- xyz (production): v2 Astro site, includes merged PRs #8 and #9 (exact SHA: `gh run list --branch xyz`)
- main (GitHub default, not used): 51ade94 (stale, diverged from xyz)

## Recent Changes (Log)
- 2026-10-12: PR #9 fix/home-hero -> xyz merged; deploy succeeded (run alamhanz.github.io-32, git-ops)
- 2026-10-12: PR #8 v2 -> xyz (cutover) merged; v2 Astro site live. Earlier PRs also merged: #4 chore/session-docs -> xyz, #5 chore/guyb-state-move -> xyz, #6 feat/v2-astro -> v2, #7 feat/v2-concept-d -> v2
- 2026-10-12: feat/blog-manager branch built (local blog manager backend, UI, smoke tests, review fixes; 871cfb0 is tip); not yet merged
- 2026-10-10: guyb files moved to .claude/guyb/ (STATE.md, pipeline/); OG image decision: keep face.jpg/hello3.jpg
- 2026-10-04: Project notes (.claude/CLAUDE.md) and session state added; deploy workflow actions bumped to checkout@v4, auth@v2, setup-gcloud@v2. (PR #4, 222f051, c6fbc7a)
- 2026-10-04: v1 site restructure + review fixes: lyceum nav unlinked, nav/footer inlined per page, about rewritten from CV, new CV redirect link, skills updated, og:url per page. (fee3d1f, ebde531, 1b51993)

## Decisions
- **Stack**: v1 plain HTML replaced by Astro 7 + Tailwind v4 (v2); lyceum page not in v2, but the v1 lyceum object stays in the bucket (excluded from the sync)
- **About content**: sourced only from the owner's CV; no phone/email/city on the public site
- **Skills**: keep pandas, Jupyter, Docker, Google Cloud, Tableau, Data Studio; drop TensorFlow (certificate stays); add GitHub, AWS, QuickSight
- **Experience wording**: 10+ years (owner's answer)
- **OG image**: keep face.jpg / hello3.jpg
- **Unused v1 files**: kept on purpose in `legacy/` (old-lyceum.txt, source.txt, unused images)
- **Blog manager**: local-only tool (`tools/blog-manager/`, not built or deployed); publish = PR to xyz from `post/<slug>`

## Open Issues
- Drifted doc: `.claude/CLAUDE.md` still says v2 is unmerged ("live `xyz` is still the v1 plain-HTML site until `v2` is merged into `xyz`"); needs the owner/orchestrator to edit
- xyz protection may be too strict for solo PRs (1 approval + signed commits); relaxing is in progress (see Next Up)
- Stale remote branches: base, dev, self-dev, feat/v2-astro, feat/v2-concept-d, fix/home-hero, v2 (all merged or obsolete); `main` diverged from xyz, decision pending
- (resolved) GCP project/region recorded in CLAUDE.md
- (resolved) workflow actions bumped to checkout@v4, auth@v2, setup-gcloud@v2
- (resolved) merged branch cleanup/site-structure deleted
- (resolved) remote chore/session-docs branch is already gone
- (resolved) v2 cutover: PRs #4-#9 all merged, v2 live
- (resolved) "browser testing at phone/desktop widths not done" was for v1; superseded by the v2 responsive check below

## Next Up
- In progress: review `feat/blog-manager` and open it as a PR into xyz
- In progress: stale-branch cleanup (base, dev, self-dev, feat/v2-astro, feat/v2-concept-d, fix/home-hero, v2) plus a decision on `main`
- In progress: relax xyz protection for solo PRs (e.g. 0 approvals)
- In progress: responsive check of the live site at phone and desktop widths (run alamhanz.github.io-35)
- After cutover: update `.claude/CLAUDE.md` to describe v2 as live (and fix the `v2` branch workflow lines once `v2` is deleted)
