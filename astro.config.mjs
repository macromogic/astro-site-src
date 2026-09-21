// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import pagefind from 'astro-pagefind';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { remarkHeadingId } from './src/lib/remark-heading-id.mjs';
import { rehypeCjkSpacing } from './src/lib/cjk-spacing.mjs';
import { rehypeFigures } from './src/lib/rehype-figures.mjs';

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
  integrations: [sitemap(), icon(), pagefind()],
  markdown: {
    // remark/rehype pipeline so posts get build-time KaTeX.
    processor: unified({
      remarkPlugins: [remarkMath, remarkHeadingId],
      rehypePlugins: [[rehypeKatex, { strict: false }], rehypeCjkSpacing, rehypeFigures],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      langAlias: { C: 'c' },
    },
  },
});
