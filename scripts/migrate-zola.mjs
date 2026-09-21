// One-off migration: Zola posts (TOML front matter, browser-side KaTeX) ->
// Astro content collection (YAML front matter, build-time KaTeX).
// Usage: node scripts/migrate-zola.mjs <zola-content-dir> <out-dir>
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const [,, srcDir = `${process.env.HOME}/Documents/zola-src/content/posts`, outDir = 'src/content/posts'] = process.argv;
mkdirSync(outDir, { recursive: true });

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '');

function parseToml(block) {
  const fm = { categories: [], tags: [] };
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('[')) continue;
    const m = line.match(/^(\w+)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, key, val] = m;
    if (val.startsWith('[')) fm[key] = JSON.parse(val.replace(/'/g, '"'));
    else if (val.startsWith('"')) fm[key] = JSON.parse(val);
    else if (val === 'true' || val === 'false') fm[key] = val === 'true';
    else fm[key] = val;
  }
  return fm;
}

// CommonMark backslash escapes only apply to ASCII punctuation. Zola ran markdown
// before KaTeX saw the formula, so replicate that inside math segments.
const unescapeMath = (s) => s.replace(/\\([!-/:-@[-`{-~])/g, '$1');

function convertBody(body) {
  // Split out fenced code blocks so nothing inside them is touched.
  const parts = body.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // Code fence: normalise the info string ("``` C++" -> "```cpp") and drop stray
      // markdown escapes that leaked into code (`get\_rev` was a typo in the Zola source).
      return part
        .replace(/^(\s*```)\s*([\w+#-]+)\s*$/m, (_, fence, lang) => fence + normalizeLang(lang))
        .replace(/\\_/g, '_');
    }
    // Put every display-math fence on its own line so remark-math sees a flow block
    // ("$$a=b$$" and "...\\right)$$" were tolerated by browser-side KaTeX only).
    part = part.split('\n').flatMap((line) => {
      const m = line.match(/^(\s*)\$\$(.*?)\$\$\s*$/);
      if (m && m[2].trim()) return [`${m[1]}$$`, `${m[1]}${m[2].trim()}`, `${m[1]}$$`];
      const open = line.match(/^(\s*)\$\$(\S.*)$/);
      if (open) return [`${open[1]}$$`, `${open[1]}${open[2]}`];
      const close = line.match(/^(\s*)(.*\S)\$\$\s*$/);
      if (close) return [`${close[1]}${close[2].trimEnd()}`, `${close[1]}$$`];
      return [line];
    }).join('\n');
    // Zola heading ids "## Title { #id }" -> "## Title {#id}" (handled by remark-heading-id).
    part = part.replace(/^(#{1,6} .*?)\s*\{\s*#([\w-]+)\s*\}\s*$/gm, '$1 {#$2}');
    // A `$$` in the middle of a text line ("...$$...") is an inline closer glued to an inline
    // opener, not display math. Real display blocks have `$$` at the start or end of a line.
    part = part.split('\n').map((line) =>
      /^\s*\$\$|\$\$\s*$/.test(line) ? line : line.replace(/\$\$/g, '$ $')
    ).join('\n');
    // Display math first, then inline math.
    part = part.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => `$$${unescapeMath(m)}$$`);
    part = part.replace(/(^|[^$\\])\$([^$\n]+?)\$/g, (_, pre, m) => `${pre}$${unescapeMath(m)}$`);
    // Zola internal links: @/posts/foo.md -> /posts/foo/
    part = part.replace(/\]\(@\/posts\/([^)]+?)\.md\)/g, (_, f) => `](/posts/${slugify(f)}/)`);
    // Escaped underscores in image paths
    part = part.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (_, alt, url) => `![${alt}](${url.replace(/\\_/g, '_')})`);
    // Non-standard `zoom` style on raw <img> -> width
    part = part.replace(/style="zoom:\s*(\d+)%;?"/g, 'style="width: $1%"');
    // Row breaks in the Zola source that were written with too few backslashes.
    part = part.replace(/a_0 \\ a_1/g, 'a_0 \\\\ a_1').replace(/\\vdots \\ A\[N-1\]/g, '\\vdots \\\\ A[N-1]');
    return part;
  }).join('');
}

const normalizeLang = (lang) => ({ 'c++': 'cpp', 'c#': 'csharp', 'matlab': 'matlab' }[lang.toLowerCase()] ?? lang.toLowerCase());

const yamlStr = (s) => JSON.stringify(s);

for (const file of readdirSync(srcDir)) {
  if (!file.endsWith('.md') || file.startsWith('_')) continue;
  const raw = readFileSync(join(srcDir, file), 'utf8');
  const m = raw.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+\n?([\s\S]*)$/);
  if (!m) { console.error('no front matter:', file); continue; }
  const fm = parseToml(m[1]);
  const body = convertBody(m[2]).replace(/^\n+/, '');
  const lines = [
    '---',
    `title: ${yamlStr(fm.title)}`,
    `date: ${fm.date}`,
    ...(fm.description ? [`description: ${yamlStr(fm.description)}`] : []),
    ...(fm.draft ? ['draft: true'] : []),
    // Zola had categories ("Notes", "Legacy"); the site keeps tags only and turns "Legacy" into a flag.
    ...(fm.categories.includes('Legacy') ? ['legacy: true'] : []),
    `tags: [${fm.tags.map(yamlStr).join(', ')}]`,
    '---',
    '',
  ];
  const slug = slugify(basename(file, '.md'));
  writeFileSync(join(outDir, `${slug}.md`), lines.join('\n') + body);
  console.log(`${file} -> ${slug}.md`);
}
