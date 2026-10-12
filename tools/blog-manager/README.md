# Blog manager (local only)

`npm run blog` starts `astro dev` (http://127.0.0.1:4321) and a manager UI (http://127.0.0.1:4322). Ctrl+C stops both. It is a dev tool: it lives outside `src/` and `public/`, is never imported by Astro and never reaches `dist/` or the deploy. It refuses to start when `CI` or `NODE_ENV=production` is set.

## What it does
- **Your stories** (`#/`): Drafts / Published tabs with counts, cards (title, description, date, tags, cover), a filter box and a "..." menu per card (Edit, View on preview site, Unpublish, Delete with typed slug).
- **Editor** (`#/edit/<slug>`): a centered writing column with a cover slot, big title, description subtitle and the body in the site's fonts. Markdown is rendered inline (live preview); the markers (`#`, `**`, backticks, `[]()`, `>`) show only on the line or selection you are editing. A side panel has Details (tags, date, cover alt text, slug) and Preview (the astro dev page in an iframe).
- **Selection toolbar**: select text for Bold, Italic, Link, H2, H3, Quote, Code. Shortcuts: Ctrl/Cmd+B, I, E (code), K (link), Alt+2 / Alt+3 (headings), Shift+9 (quote).
- **"+" button** on an empty line (or Ctrl/Cmd+Alt+Enter): Image, Divider, Code block.
- **Images**: upload, drag or paste into the text; they go to `src/assets/blog/<slug>/` and render inline. The text stays `![alt](../../assets/blog/<slug>/file.png)`; edit alt text in the widget; "Add caption" inserts an italic line under the image. Pick a cover (`cover.<ext>`, cropped to 1200x630 for og:image).
- **Markdown source** toggle shows the raw text with no decorations. The editor holds the exact Markdown body, so opening and saving leaves a post unchanged (front matter is normalized by `posts.mjs`, and saving an already published post stamps `updatedDate`).
- **Autosave** (1 s after typing, on blur and route change) with a status in the top bar; Ctrl/Cmd+S saves now.
- **Publish** dialog: cover and alt text, description, tags, date, then the PR flow below.
- The slug is chosen in New post (it follows the title until you type in it). Drafts can be renamed from Details (moves the file and the images folder, rewrites image paths); published posts cannot. The "Preview server is not reachable" banner is a plain TCP check on `BLOG_ASTRO_PORT`, so a slow first compile does not trigger it.

## UI bundle
The UI source is `ui/src` (ES modules + CodeMirror 6 from devDependencies). The server bundles it with esbuild on the first request to `/app.js` and caches it for the process; there is no build step to run. `BLOG_UI_DEV=1` rebuilds on every request with inline source maps (restart not needed, just reload). Fonts (Poppins, Inter) are served from `node_modules` at `/fonts/*` (allowlisted `.woff2` names only). Nothing is fetched from a CDN, and the CSP allows only `'self'`.

## Publish
Publish builds a `draft: false` copy of the post in a temporary git worktree on a private temp branch off `origin/xyz` (or off `origin/post/<slug>` if that branch exists), commits only that post's files as `blog: publish <slug>` (honors your git signing config), pushes it to `post/<slug>` over HTTPS, and opens (or reuses) a PR into `xyz` with `gh`. The UI shows the PR URL. Your working tree, current branch and any local `post/<slug>` branch are never touched, and a failed publish leaves your local file unchanged; the local file is marked published only after the PR exists. Before pulling the merged PR, remove the local copy (new post: delete `src/content/blog/<slug>.md` and `src/assets/blog/<slug>/`, which the Delete button does; edit of an already-merged post: `git restore -- <those paths>`), otherwise `git pull` clashes.

Needs `git` and the GitHub CLI (`gh auth login`).

## Environment
| var | default | meaning |
|---|---|---|
| `BLOG_PORT` | 4322 | manager port |
| `BLOG_ASTRO_PORT` | 4321 | astro dev port (strict) |
| `BLOG_ROOT` | repo root | content root override (tests) |
| `BLOG_UI_DEV` | unset | `1` rebuilds the UI bundle on every request |

## Security
Binds 127.0.0.1 only; requests must carry a `127.0.0.1:<port>` or `localhost:<port>` Host, and mutating requests with a foreign Origin are rejected. Mutating requests with no Origin and no Sec-Fetch-Site (e.g. curl from another local process) are accepted: this is intentional for a loopback-only tool. Slugs match `^[a-z0-9]+(-[a-z0-9]+)*$`, every path is confined to `src/content/blog` or `src/assets/blog/<slug>`, uploads are allowlisted (png, jpg, jpeg, webp, gif, avif, svg) and capped at 10 MB. If the manager process is killed hard (not Ctrl+C), an orphaned astro process may remain; stop it from Task Manager or `Get-Process node`.

## Tests
- `npm run blog:smoke` (`-- --unit` or `-- --server`): unit checks (slugs, paths, front matter, plus `editor-unit.mjs`: Markdown commands and live-preview decorations on a Node `EditorState`, no DOM) and API tests on a temp root, including `fixtures/roundtrip-*.md` loaded and saved unchanged. Publish runs via dry-run and a stubbed command runner (no network).
- `npm run blog:ui-test`: drives the real UI in your installed Microsoft Edge (or Chrome) with `playwright-core`, so no browser is downloaded. Creates, edits, formats, pastes an image, sets a cover, publishes (git/gh stubbed) and deletes a post in a temp copy, and fails on any console error or CSP violation. Local only: it is not run in CI. Screenshots go to a temp folder printed at the end.

## Manual checklist: one real publish
1. `npm run blog`, create a throwaway post, add a cover and an inline image, check the preview.
2. Click Publish; open the PR URL and check it changes only `src/content/blog/<slug>.md` and `src/assets/blog/<slug>/`.
3. Click Publish again (should reuse the PR or say no changes).
4. Close the PR and delete branch `post/<slug>` on GitHub; delete the post in the UI.
