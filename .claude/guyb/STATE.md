<!-- guyb:state -->
# alamhanz.github.io State

**Last updated**: 2026-10-12

## Overview
Personal website (alamhanz.xyz): Astro 7 static site (v2) with Tailwind CSS v4, deployed by GitHub Actions to GCS bucket `alamhanz.xyz`. Deploy branch is `xyz` (protected). `main` is the GitHub default but not used for deploys. v1 plain-HTML files live in `legacy/`.

## Current Status
- **v2 Astro site is LIVE** at alamhanz.xyz: the cutover PR #8 (v2 -> xyz) and the follow-up hero fix PR #9 (fix/home-hero -> xyz) are merged, and both deploy runs on xyz succeeded (verified with gh, 2026-10-12).
- **Blog manager merged** (PR #10): local-only tool in `tools/blog-manager/`; `npm run blog:smoke` passes 19/19. No real post written with it yet.
- **Blog manager v2 UI merged** (PR #17, closes #15): CodeMirror 6 editor, stories view, side panel, autosave, draft rename; `blog:smoke` 39 ok, `blog:ui-test` 20 steps. Real publish not yet exercised (stubs only).
- **UI fixes merged** (PR #11): no backticks on inline code in posts; 44px mobile tap targets on 6 text links. Live and verified.
- **404 page**: GCS bucket error page is now 404.html; a missing path returns 404 with the "Not found | Alamsyah Hanza" page.
- **Live responsive check passed**: no overflow, nav works, no console errors at 375-1440 px.
- **Deployed by**: owner (admin bypass of signed-commits protection; agent commits are unsigned)

## Deployed Versions
- xyz (production): 5ac634c (v2 Astro site + blog manager + UI fixes; deploy run 38226981186 succeeded)
- main (GitHub default, not used): 51ade94 (stale, diverged from xyz)

## Recent Changes (Log)
- 2026-10-12: PR #17 feat/blog-manager-medium -> xyz merged (9c590d9): Medium-like blog manager UI, issue #15 closed. Runs -43 (plan), -44/-48/-46 (build), -47/-50 (reviews: 2 critical + 6 should-fix fixed in -49/-51), -52 (PR). Old easymde removed; playwright-core devDependency
- 2026-10-12: PR #11 fix/ui-nits -> xyz merged; live and verified (run alamhanz.github.io-40)
- 2026-10-12: 404 fix: bucket error page index.html -> 404.html (run -39). Rollback: `gcloud storage buckets update gs://alamhanz.xyz --web-main-page-suffix=index.html --web-error-page=index.html` (this gcloud uses --web-error-page, not --web-not-found-page)
- 2026-10-12: PR #10 feat/blog-manager -> xyz merged (5ac634c); review run -33 approved with fixes, run -38 applied them (cover validation, pre-publish meta validation, global publish lock, list survives malformed front matter); deploy 38226981186 succeeded
- 2026-10-12: CLAUDE.md and ci.yml updated post-cutover: work branches off xyz, CI runs on PRs into xyz
- 2026-10-12: branch cleanup (run -37): deleted remote feat/v2-astro, feat/v2-concept-d, fix/home-hero, v2, feat/blog-manager. Remaining: main, base, dev, self-dev, xyz
- 2026-10-12: xyz protection (run -37): required approvals 1 -> 0; signed commits and conversation resolution kept
- 2026-10-12: live responsive check at 375-1440 px passed (run -35)
- 2026-10-12: PR #9 fix/home-hero -> xyz merged; deploy succeeded (run alamhanz.github.io-32, git-ops)
- 2026-10-12: PR #8 v2 -> xyz (cutover) merged; v2 Astro site live. Earlier PRs also merged: #4 chore/session-docs -> xyz, #5 chore/guyb-state-move -> xyz, #6 feat/v2-astro -> v2, #7 feat/v2-concept-d -> v2
- 2026-10-12: feat/blog-manager branch built (local blog manager backend, UI, smoke tests, review fixes; 871cfb0 is tip); merged as PR #10
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
- **Branches**: owner chose to leave `main` alone and keep base/dev/self-dev
- **xyz protection**: 0 approvals, signed commits kept; owner merges with bypass because agent commits are unsigned

## Open Issues
- (resolved) issue #15 blog manager UI: merged as #17
- (resolved) blog manager PR: merged as #10
- (resolved) stale branch cleanup: done (run -37); main/base/dev/self-dev intentionally kept
- (resolved) xyz protection relaxed to 0 approvals
- (resolved) responsive check of live site passed (run -35)
- (resolved) `.claude/CLAUDE.md` drift: updated for the live v2 and xyz-based workflow
- (resolved) bucket 404 served index.html; now 404.html
- (resolved) GCP project/region recorded in CLAUDE.md
- (resolved) workflow actions bumped to checkout@v4, auth@v2, setup-gcloud@v2
- (resolved) merged branch cleanup/site-structure deleted
- (resolved) remote chore/session-docs branch is already gone
- (resolved) v2 cutover: PRs #4-#9 all merged, v2 live
- (resolved) "browser testing at phone/desktop widths not done" was for v1; superseded by the v2 responsive check below

## Next Up
- Write the first real blog post with the blog manager (first real test of publish from the new UI)
- Optional: blog manager publish prunes unreferenced files in the post's asset folder (old covers / removed images are committed today)
- Optional: delete remote branch feat/blog-manager-medium (merged)
- Optional: set up commit signing so the protection bypass isn't needed
- Optional, later: revisit base/dev/self-dev/main (currently kept on purpose)
