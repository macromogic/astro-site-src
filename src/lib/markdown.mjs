/**
 * The markdown pipeline, shared by astro.config.mjs (site pages) and scripts/cards.mjs (image cards for
 * social media). It lives outside the Astro config so plain Node can import it without pulling in the
 * integrations, which the cards script does not need.
 */
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import { remarkAttrs } from './remark-attrs.mjs';
import { rehypeCjkSpacing } from './cjk-spacing.mjs';
import { rehypeFigures } from './rehype-figures.mjs';
import { rehypeMermaidTheme } from './rehype-mermaid-theme.mjs';

/** Astro's `markdown` config. */
export const markdown = {
  // remark/rehype pipeline so posts get build-time KaTeX and Mermaid.
  processor: unified({
    remarkPlugins: [remarkMath, remarkAttrs],
    rehypePlugins: [
      // ```mermaid fences become SVG <img>s rendered in headless Chromium (Playwright). Light and dark renders
      // are emitted as one <picture>; rehypeMermaidTheme turns that into two <img>s toggled by [data-theme].
      [rehypeMermaid, {
        strategy: 'img-svg',
        mermaidConfig: { theme: 'neutral' },
        // Edge labels default to a light backdrop in the dark theme; match --bg-card (dark) from global.css instead.
        dark: { theme: 'dark', themeVariables: { edgeLabelBackground: '#202024' } },
      }],
      rehypeMermaidTheme,
      [rehypeKatex, { strict: false }],
      // Figures before CJK spacing: captions are re-parsed from the source and need spacing too.
      rehypeFigures,
      rehypeCjkSpacing,
    ],
    // GFM footnotes: plain ids (#fn-1), no visible "Footnotes" heading (authors write their own).
    remarkRehype: { clobberPrefix: '', footnoteLabelProperties: { className: ['sr-only'] } },
  }),
  // Leave ```mermaid fences alone so rehype-mermaid still sees them (Shiki runs before custom rehype plugins).
  syntaxHighlight: { type: 'shiki', excludeLangs: ['math', 'mermaid'] },
  shikiConfig: {
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
    langAlias: { C: 'c' },
  },
};

/**
 * A renderer for markdown bodies outside of Astro (same plugins, same Shiki setup):
 * `(await createRenderer()).render(body, { fileURL })` -> `{ code, metadata: { headings } }`.
 */
export const createRenderer = () =>
  markdown.processor.createRenderer({ syntaxHighlight: markdown.syntaxHighlight, shikiConfig: markdown.shikiConfig });
