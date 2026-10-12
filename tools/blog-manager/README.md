# Blog manager (local only)

`npm run blog` starts `astro dev` (http://127.0.0.1:4321) and a manager UI (http://127.0.0.1:4322). Ctrl+C stops both. It is a dev tool: it lives outside `src/` and `public/`, is never imported by Astro and never reaches `dist/` or the deploy. It refuses to start when `CI` or `NODE_ENV=production` is set.

## What it does
- List posts (draft/published), create a draft, edit metadata and Markdown with live preview (autosave, Astro HMR reloads the iframe).
- Upload images (button, drag/drop, paste) into `src/assets/blog/<slug>/`; pick a cover (`cover.<ext>`, cropped to 1200x630 for og:image).
- Unpublish (`draft: true`), delete (type the slug), publish.

## Publish
Publish sets `draft: false`, then in a temporary git worktree creates (or updates) branch `post/<slug>` off `origin/xyz`, commits only that post's files as `blog: publish <slug>` (honors your git signing config), pushes over HTTPS, and opens (or reuses) a PR into `xyz` with `gh`. The UI shows the PR URL. Your working tree and current branch are never touched; the local copy of the post stays, so run `git pull` after the PR is merged.

Needs `git` and the GitHub CLI (`gh auth login`).

## Environment
| var | default | meaning |
|---|---|---|
| `BLOG_PORT` | 4322 | manager port |
| `BLOG_ASTRO_PORT` | 4321 | astro dev port (strict) |
| `BLOG_ROOT` | repo root | content root override (tests) |

## Security
Binds 127.0.0.1 only; requests must carry a `127.0.0.1:<port>` or `localhost:<port>` Host, and mutating requests with a foreign Origin are rejected. Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$`, every path is confined to `src/content/blog` or `src/assets/blog/<slug>`, uploads are allowlisted (png, jpg, jpeg, webp, gif, avif, svg) and capped at 10 MB. If the manager process is killed hard (not Ctrl+C), an orphaned astro process may remain; stop it from Task Manager or `Get-Process node`.

## Tests
`npm run blog:smoke` (`-- --unit` or `-- --server`): unit checks plus API CRUD on a temp root, with publish exercised via dry-run and a stubbed command runner (no network).

## Manual checklist: one real publish
1. `npm run blog`, create a throwaway post, add a cover and an inline image, check the preview.
2. Click Publish; open the PR URL and check it changes only `src/content/blog/<slug>.md` and `src/assets/blog/<slug>/`.
3. Click Publish again (should reuse the PR or say no changes).
4. Close the PR and delete branch `post/<slug>` on GitHub; delete the post in the UI.
