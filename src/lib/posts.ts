import { getCollection, type CollectionEntry } from 'astro:content';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { rehypeCjkSpacing } from './cjk-spacing.mjs';
import { remarkAttrs } from './remark-attrs.mjs';
import { slugifyTerm } from './format';

export type Post = CollectionEntry<'posts'>;

const MORE = '<!-- more -->';

const byDateDesc = (a: Post, b: Post) => b.data.date.getTime() - a.data.date.getTime();

/** Published posts, newest first. Pass `true` to include drafts (dev only). */
export async function getPosts(includeDrafts = false): Promise<Post[]> {
  const posts = await getCollection('posts', (p) => includeDrafts || !p.data.draft);
  return posts.sort(byDateDesc);
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkAttrs)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeKatex, { strict: false })
  .use(rehypeCjkSpacing)
  .use(rehypeStringify, { allowDangerousHtml: true });

/** Render markdown (with KaTeX) to an HTML string, outside of Astro's page pipeline. */
export async function renderMarkdown(md: string): Promise<string> {
  return String(await processor.process(md));
}

/** Visual length: a CJK character counts 1, anything else 0.5. */
const visualLength = (text: string) => {
  let n = 0;
  for (const ch of text) n += /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(ch) ? 1 : 0.5;
  return n;
};

type MdNode = { type: string; value?: string; children?: MdNode[] };

/**
 * Reduce a markdown tree to a preview: paragraphs only (no headings, images, code or raw HTML),
 * links flattened to their text, cut at roughly `limit` visual characters with an ellipsis.
 * Inline formulas are kept whole or dropped, never split.
 */
function excerptTree(tree: MdNode, limit: number): MdNode {
  const flatten = (node: MdNode): MdNode[] => {
    if (node.type === 'link' || node.type === 'linkReference') {
      const kids = (node.children ?? []).flatMap(flatten);
      const label = kids.map((k) => k.value ?? '').join('');
      return /^(https?:\/\/|www\.)/i.test(label) ? [] : kids; // keep link text, drop bare URLs
    }
    if (['image', 'imageReference', 'html', 'break', 'footnoteReference'].includes(node.type)) return [];
    if (node.children) return [{ ...node, children: node.children.flatMap(flatten) }];
    return [node];
  };
  let budget = limit;
  let truncated = false;
  const take = (nodes: MdNode[]): MdNode[] => {
    const out: MdNode[] = [];
    for (const node of nodes) {
      if (budget <= 0) { truncated = true; break; }
      if (node.type === 'text' && node.value !== undefined) {
        if (visualLength(node.value) <= budget) { budget -= visualLength(node.value); out.push(node); }
        else {
          let cut = '';
          for (const ch of node.value) { const w = visualLength(ch); if (w > budget) break; budget -= w; cut += ch; }
          out.push({ type: 'text', value: cut.replace(/[\s,，、;；:：]+$/, '') });
          truncated = true;
          break;
        }
      } else if (node.type === 'inlineMath') {
        const w = Math.max(1, visualLength(node.value ?? '') / 2);
        if (w > budget) { truncated = true; break; }
        budget -= w; out.push(node);
      } else if (node.children) {
        const children = take(node.children);
        if (children.length) out.push({ ...node, children });
        if (truncated) break;
      } else out.push(node);
    }
    return out;
  };
  const plainText = (n: MdNode): string => n.value ?? (n.children ?? []).map(plainText).join('');
  const paragraphs = (tree.children ?? [])
    .filter((n) => n.type === 'paragraph')
    .flatMap(flatten)
    // Skip stubs left behind by dropped URLs ("参考文章：") and other near-empty lines.
    .filter((n) => { const t = plainText(n).trim(); return visualLength(t) >= 4 && !/[:：]$/.test(t); });
  const kept = take(paragraphs);
  if (truncated && kept.length) {
    const last = kept[kept.length - 1]!;
    last.children = [...(last.children ?? []), { type: 'text', value: '…' }];
  }
  return { type: 'root', children: kept };
}

const EXCERPT_LIMIT = 200;

/**
 * Card preview: the markdown before `<!-- more -->` (or the whole body), reduced to plain
 * paragraphs and capped in length, rendered to HTML.
 */
export async function renderExcerpt(post: Post): Promise<string> {
  const body = post.body ?? '';
  const idx = body.indexOf(MORE);
  const md = idx >= 0 ? body.slice(0, idx) : body;
  const tree = excerptTree(processor.parse(md) as MdNode, EXCERPT_LIMIT);
  const transformed = await processor.run(tree as never);
  return processor.stringify(transformed as never);
}

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/g;

/** Word count and reading time that treat each CJK character as a word. */
export function readingStats(body: string | undefined) {
  const text = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_>`|[\]()!-]/g, ' ');
  const cjk = (text.match(CJK) || []).length;
  const latin = (text.replace(CJK, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || []).length;
  const words = cjk + latin;
  const minutes = Math.max(1, Math.round(latin / 200 + cjk / 350));
  return { words, minutes };
}

export type TermIndex = Map<string, { name: string; slug: string; posts: Post[] }>;

export function indexTags(posts: Post[]): TermIndex {
  const index: TermIndex = new Map();
  for (const post of posts) {
    for (const name of post.data.tags) {
      const slug = slugifyTerm(name);
      const entry = index.get(slug) ?? { name, slug, posts: [] };
      entry.posts.push(post);
      index.set(slug, entry);
    }
  }
  return new Map([...index].sort(([a], [b]) => a.localeCompare(b)));
}
