// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import pagefind from 'astro-pagefind';
import { markdown } from './src/lib/markdown.mjs';

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
  markdown,
});
