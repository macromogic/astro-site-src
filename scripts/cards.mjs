#!/usr/bin/env node
/**
 * Export a post as a stack of images for Rednote (小红书) or Instagram.
 *
 *   npm run cards -- oa-interval-permutation            # src/content/posts/oa-interval-permutation.md
 *   npm run cards -- oa-interval-permutation.en         # a translation
 *   npm run cards -- drafts/part-1.md --size instagram  # any markdown file with frontmatter
 *
 * Options:
 *   --size   rednote (1080x1440, default) | instagram (1080x1350) | square (1080x1080) | <width>x<height>
 *   --scale  device pixel ratio of the PNGs (default 2: a 1080-wide card is written at 2160px)
 *   --font   base font size in CSS px at 1080 card width (default 34); scaled with the width
 *   --out    output root (default out/cards); images go to <out>/<name>/01.png, 02.png, ...
 *   --keep-html  also write the rendered page as <out>/<name>/index.html for inspection
 *
 * The body is rendered with the site's own markdown pipeline (src/lib/markdown.mjs), styled with
 * global.css plus scripts/cards.css, and laid out in CSS columns one card wide. Chromium decides
 * where to break (never inside a line, a figure or a table row), and each column is screenshot.
 */
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { createRenderer } from '../src/lib/markdown.mjs';
import { autoSpace } from '../src/lib/cjk-spacing.mjs';
import { formatDate } from '../src/lib/format.ts';
import { site } from '../src/site.config.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SIZES = { rednote: [1080, 1440], instagram: [1080, 1350], square: [1080, 1080] };
/** Images per post each platform accepts; exceeding it only prints a warning. */
const LIMITS = { rednote: 18, instagram: 20 };

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    size: { type: 'string', default: 'rednote' },
    scale: { type: 'string', default: '2' },
    font: { type: 'string' },
    out: { type: 'string', default: 'out/cards' },
    'keep-html': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (opts.help || positionals.length !== 1) {
  console.error('usage: npm run cards -- <slug | file.md> [--size rednote|instagram|square|WxH] [--scale 2] [--font 34] [--out out/cards] [--keep-html]');
  process.exit(opts.help ? 0 : 1);
}

/* ---------- Input ---------- */

const arg = positionals[0];
const file = arg.endsWith('.md') ? resolve(arg) : join(root, 'src/content/posts', `${arg}.md`);
if (!existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}
const name = basename(file, '.md');
const { frontmatter, content } = parseFrontmatter(await readFile(file, 'utf8'));
// Same convention as src/lib/posts.ts: "<slug>.<lang>.md" is a translation.
const lang = name.match(/\.([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/)?.[1] ?? frontmatter.lang ?? site.lang;

const sizeMatch = opts.size.match(/^(\d+)x(\d+)$/);
const [W, H] = sizeMatch ? [Number(sizeMatch[1]), Number(sizeMatch[2])] : SIZES[opts.size] ?? [];
if (!W) {
  console.error(`Unknown --size "${opts.size}"; use ${Object.keys(SIZES).join(', ')} or <width>x<height>.`);
  process.exit(1);
}
const scale = Number(opts.scale);
const font = opts.font ? Number(opts.font) : Math.round((34 * W) / 1080);

/* ---------- Render ---------- */

const renderer = await createRenderer();
const { code } = await renderer.render(content, { fileURL: pathToFileURL(file) });
// Tooltips cannot be hovered in a picture: show the span as plain text.
const body = code.replace(/<span([^>]*?) data-tip="[^"]*" tabindex="0"/g, '<span$1');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const date = frontmatter.date ? formatDate(new Date(frontmatter.date)) : '';
const tags = (frontmatter.tags ?? []).map((t) => `<span class="tag">#${esc(t)}</span>`).join('');
const host = new URL(site.url).host;

const fonts = [
  'libertinus-serif/400', 'libertinus-serif/400-italic', 'libertinus-serif/700', 'libertinus-serif/700-italic',
  'noto-serif-sc/400', 'noto-serif-sc/700', 'ibm-plex-mono/400', 'ibm-plex-mono/400-italic', 'ibm-plex-mono/700',
].map((f) => `<link rel="stylesheet" href="/node_modules/@fontsource/${f}.css">`).join('\n');

const html = `<!doctype html>
<html lang="${esc(lang)}" data-theme="light">
<head>
<meta charset="utf-8">
<title>${esc(frontmatter.title ?? name)}</title>
${fonts}
<link rel="stylesheet" href="/node_modules/katex/dist/katex.min.css">
<link rel="stylesheet" href="/src/styles/global.css">
<link rel="stylesheet" href="/scripts/cards.css">
<style>:root { --card-w: ${W}px; --card-h: ${H}px; --card-font: ${font}px; }</style>
</head>
<body>
<div class="card-page">
  <div class="card-flow">
    <article class="content">
      <header class="card-head">
        <h1 class="card-title">${esc(autoSpace(frontmatter.title ?? name))}</h1>
        ${frontmatter.description ? `<p class="card-desc">${esc(autoSpace(frontmatter.description))}</p>` : ''}
        <p class="card-meta">${date ? `<time>${esc(date)}</time>` : ''}${tags}</p>
      </header>
      ${body}
    </article>
  </div>
  <footer class="card-foot"><span class="card-site">${esc(site.title)} · ${esc(host)}</span><span class="card-num"></span></footer>
</div>
</body>
</html>
`;

/* ---------- Serve ---------- */

// A tiny static server: the page at /, the repo's node_modules, src and scripts, and everything else from public/
// (so /images/x.png in a post resolves as it does on the site). Fonts load from http:// without file:// quirks.
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
};
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (path === '/') return res.writeHead(200, { 'content-type': MIME['.html'] }).end(html);
  const rel = path.replace(/^\/+/, '');
  const local = /^(node_modules|src|scripts)\//.test(rel) ? join(root, rel) : join(root, 'public', rel);
  if (!local.startsWith(root + '/')) return res.writeHead(403).end();
  try {
    if (!(await stat(local)).isFile()) throw new Error('not a file');
    res.writeHead(200, { 'content-type': MIME[extname(local)] ?? 'application/octet-stream' }).end(await readFile(local));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;

/* ---------- Screenshot ---------- */

const outDir = join(resolve(opts.out), name);
await mkdir(outDir, { recursive: true });
// Replace an earlier export of the same post (it may have had more cards).
for (const f of await readdir(outDir)) if (/^\d+\.png$/.test(f) || f === 'index.html') await rm(join(outDir, f));
if (opts['keep-html']) await writeFile(join(outDir, 'index.html'), html);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  page.on('requestfailed', (r) => console.warn(`failed to load ${r.url()}`));
  await page.goto(origin, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.complete || new Promise((ok) => { img.onload = img.onerror = ok; })));
  });
  // Layout touches more glyphs (and thus font subsets) once images and fonts are in; settle again.
  await page.evaluate(() => document.fonts.ready);

  const count = await page.evaluate((W) => {
    // A display equation wider than the column cannot wrap: shrink it to fit instead of clipping.
    for (const el of document.querySelectorAll('.katex-display')) {
      const inner = el.firstElementChild;
      if (inner && inner.scrollWidth > el.clientWidth) el.style.fontSize = `${(100 * el.clientWidth) / inner.scrollWidth}%`;
    }
    // Columns the content overflowed into sit at x = i * W; the right-most fragment tells how many there are.
    const flow = document.querySelector('.card-flow');
    const left = flow.getBoundingClientRect().left;
    let right = left;
    for (const el of flow.querySelectorAll('*')) for (const r of el.getClientRects()) right = Math.max(right, r.right);
    return Math.max(1, Math.floor((right - left - 1) / W) + 1);
  }, W);

  for (let i = 0; i < count; i++) {
    await page.evaluate(([i, count, W]) => {
      document.querySelector('.card-flow').style.transform = `translateX(${-i * W}px)`;
      document.querySelector('.card-num').textContent = `${i + 1} / ${count}`;
    }, [i, count, W]);
    await page.screenshot({ path: join(outDir, `${String(i + 1).padStart(2, '0')}.png`) });
  }

  console.log(`${count} card(s) of ${W}x${H} at ${scale}x -> ${outDir}`);
  const limit = LIMITS[opts.size];
  if (limit && count > limit) console.warn(`Note: ${opts.size} accepts at most ${limit} images per post; split the markdown and export each part.`);
} finally {
  await browser.close();
  server.close();
}
