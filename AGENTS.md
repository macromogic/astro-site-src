## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Mermaid diagrams are rendered at build time by `rehype-mermaid`, which drives headless Chromium through Playwright.
On a fresh clone run `npx playwright install chromium` once after `npm install`, or any post with a ```mermaid fence
fails to build. The deploy workflow does this itself.

## Social media cards

`npm run cards -- <slug | file.md>` exports a post as a stack of PNGs (Rednote 3:4 by default; `--size instagram`,
`square` or `WxH`) into `out/cards/<name>/`. It renders the markdown with the shared pipeline in
`src/lib/markdown.mjs` and lays it out in CSS columns styled by `scripts/cards.css`; tooltips are flattened to their
text. Needs Node 24 (`nvm use`) and the Playwright Chromium above. Pass a path to any markdown file to export a
manually split part of a long post.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
