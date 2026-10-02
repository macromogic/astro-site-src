// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import pagefind from 'astro-pagefind';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import { remarkAttrs } from './src/lib/remark-attrs.mjs';
import { rehypeCjkSpacing } from './src/lib/cjk-spacing.mjs';
import { rehypeFigures } from './src/lib/rehype-figures.mjs';
import { rehypeMermaidTheme } from './src/lib/rehype-mermaid-theme.mjs';

/** Fontsource stylesheets list a WOFF fallback after every WOFF2; every browser we target speaks WOFF2. */
const dropWoffFallbacks = () => ({
  name: 'drop-woff-fallbacks',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('@fontsource') || !id.split('?')[0].endsWith('.css')) return null;
    return { code: code.replace(/,\s*url\([^)]*\.woff\)\s*format\(["']woff["']\)/g, ''), map: null };
  },
});

// https://astro.build/config
export default defineConfig({
  site: 'https://macromogic.xyz',
  // The site used to have a categories taxonomy; keep old links alive.
  redirects: {
    '/categories': '/tags/',
    '/categories/notes': '/tags/',
    '/categories/legacy': '/tags/',
  },
  vite: { plugins: [dropWoffFallbacks()] },
  // Pages carry their own <html lang>, so Pagefind would otherwise build one index per language and the
  // search box (pinned to "zh" in SearchModal) would never see English pages. Index everything together.
  integrations: [sitemap(), icon(), pagefind({ indexConfig: { forceLanguage: 'zh' } })],
  markdown: {
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
  },
});
