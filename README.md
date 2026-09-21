# macromogic.xyz

Personal website of Weijie Huang, built with [Astro](https://astro.build). Migrated from a Zola site
(`~/Documents/zola-src`, DeepThought theme) in September 2026; the layout follows DeepThought, the
typography is Libertinus Serif + Noto Serif SC, code is IBM Plex Mono, math is KaTeX rendered at build time.

## Develop

```sh
nvm use            # Node 24 (see .nvmrc); Astro 7 needs >= 22.12
npm install
npm run dev        # http://localhost:4321 (search index only exists after a build)
npm run build      # -> dist/, also builds the Pagefind search index
npx astro build --force   # after editing a remark/rehype plugin in src/lib: clears the cached markdown renders
npm run preview
```

## Layout

| Path | Purpose |
|---|---|
| `src/content/posts/*.md` | Blog posts. Front matter: `title`, `date`, `tags`, optional `description`, `draft`, `legacy` (shows a Legacy badge), `lang`, `toc`. Put `<!-- more -->` after the summary. Headings may carry `{#custom-id}`. |
| `src/content/home.md` | Bio shown on the home page. |
| `src/assets/photo.jpg`, `site.contact` in `src/site.config.ts` | Portrait and contact details for the profile card on the home page. The photo is resized to WebP at build time. |
| `src/data/pubs.json`, `src/data/friends.json` | Publications and friend links. |
| `src/site.config.ts` | Title, nav items, social handles, posts per page. |
| `src/styles/global.css` | Design tokens (light/dark), fonts, all component styles. |
| `src/layouts/BaseLayout.astro` | Head, fonts, navbar, search modal, footer, theme bootstrap. |
| `public/` | Static files: icons, images, `cv.pdf`, `CNAME`, `robots.txt`. |
| `src/lib/*.mjs` | Build-time markdown plugins: CJK/Latin auto-spacing, `{#id}` heading ids, figure captions from alt text. Rebuild with `--force` after editing them. |
| `src/components/MathEnhance.astro`, `CodeEnhance.astro` | Client-side extras: copy TeX / copy code buttons, scroll fades on wide equations. |
| `scripts/migrate-zola.mjs` | One-off converter from the Zola posts (TOML front matter, browser KaTeX escapes). |

Routes: `/`, `/posts/` (+ `/posts/page/N/`), `/posts/<slug>/`, `/tags/`, `/tags/<tag>/`, `/pubs/`, `/friends/`,
`/atom.xml`, `/sitemap-index.xml`, `/404`.

## Behaviour worth knowing

- Drafts (`draft: true`) are hidden from the build. In `astro dev` they appear in place in the lists, greyed
  with a dashed border and a Draft badge, and their pages render for preview.
- `legacy: true` shows a Legacy badge on cards and post headers.
- Old `/categories/...` URLs redirect to `/tags/` (see `redirects` in `astro.config.mjs`).
- The Fontsource WOFF fallbacks are stripped at build time (`dropWoffFallbacks` in `astro.config.mjs`); only
  WOFF2 ships. KaTeX's own fonts are untouched.
- Every page carries Open Graph / Twitter meta and JSON-LD (Person on ordinary pages, BlogPosting on posts),
  using the portrait as the preview image.
- `site.repo` in `src/site.config.ts`, when set, adds a Source link to the footer.

## Button component

`src/components/Button.astro` renders an `<a>` when given `href`, otherwise a `<button>`. Styles are the
`.button*` rules in `global.css` and follow the theme tokens in both light and dark mode.

```astro
import Button from '../components/Button.astro';

<Button href="/cv.pdf" icon="fa6-solid:file-pdf">CV</Button>
<Button href="/posts/" variant="filled" color="primary" iconRight="fa6-solid:arrow-right">All posts</Button>
<Button variant="text" size="small" color="accent">Dismiss</Button>
<Button rounded fullwidth href="https://github.com/macromogic" icon="fa6-brands:github">GitHub</Button>
```

| Prop | Values | Default |
|---|---|---|
| `variant` | `outlined`, `filled`, `text` | `outlined` |
| `color` | `default` (ink), `primary` (link blue), `accent` (red) | `default` |
| `size` | `small`, `normal`, `large` | `normal` |
| `rounded`, `fullwidth`, `disabled` | boolean | off |
| `icon`, `iconRight` | any Iconify name from the installed sets (`fa6-solid`, `fa6-regular`, `fa6-brands`, `academicons`) | none |
| `external` | open in new tab | auto for `http(s)://` links |

Group several with `<p class="buttons">` (add `is-centered` to center). `src/pages/_styleguide.astro` shows every
variant; rename it to `styleguide.astro` to preview at `/styleguide/`.

## Writing in other CJK variants

Everything CJK renders with Noto Serif SC. For a whole post in Traditional Chinese or Japanese set
`lang: zh-Hant` / `lang: ja` in the front matter; to get region-correct glyph shapes as well, add
`@fontsource/noto-serif-tc` or `@fontsource/noto-serif-jp` and a `:lang()` rule in `global.css`.

## Deploy

`.github/workflows/deploy.yml` builds on every push to `main` and pushes `dist/` to the `master`
branch of `macromogic/macromogic.github.io` with the `DEPLOY_KEY` repository secret (same key the
Zola workflow used; it must be added to this repository's secrets).
