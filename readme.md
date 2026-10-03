# alamhanz.xyz

Static personal site: plain HTML + Tailwind CSS v3. No JavaScript framework, no build step for HTML.

## Build CSS

```
npm install
npm run build                                          # watch mode
npx tailwindcss -i ./index.css -o ./tailwind.css       # one-off
```

`tailwind.css` is committed. Rebuild it before every commit that adds or changes classes.

## Preview

Serve the folder over HTTP, for example `python -m http.server`, and open `http://localhost:8000/`.
Pages are linked without `.html` (`about`, `blog`, `cv`, `mycalendar`) because the deploy renames them, so use `npx serve .` for clean URLs or open the `.html` files directly.

## Pages

- `index.html`, `about.html`, `lyceum.html`: full pages. Each one repeats the same head, nav and footer (copy `about.html` as a template).
- `cv.html`, `blog.html`, `mycalendar.html`: redirect-only pages (meta refresh). Update the CV link in `cv.html` only.
- `navi-pilot.js`: mobile menu toggle.

To add a page: copy a full page, update title/description and the `aria-current` link, add the link to the nav in every page, and add the file to the rename and upload steps in `.github/workflows/deploy_web.yml`.

## Deploy

Pushing to `xyz` deploys to production (GCS bucket). Work on a feature branch and merge after review.
The workflow uploads the whole repository, so do not add private files here.
