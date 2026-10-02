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
import { site } from '../site.config';

export type Post = CollectionEntry<'posts'>;

const MORE = '<!-- more -->';

const byDateDesc = (a: Post, b: Post) => b.data.date.getTime() - a.data.date.getTime();

/* ---------- Translations ----------
 * A post is translated by placing a sibling file with a BCP 47 suffix next to it:
 *   my-post.md        -> the original, in the site's default language, at /posts/my-post/
 *   my-post.en.md     -> its English version, at /en/posts/my-post/
 *   my-post.zh-Hant.md -> at /zh-Hant/posts/my-post/
 * The original owns the listing card, the feed entry and the adjacent-post chain; translations
 * are reached from language chips on the card and the switcher on the post page. Legacy posts
 * are not translatable (they are kept as a record, not maintained).
 */

const TRANSLATION_ID = /^(?<slug>.+)\.(?<lang>[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)$/;

/** The URL slug shared by a post and its translations ("my-post" for "my-post.en"). */
export const postSlug = (post: Post) => post.id.match(TRANSLATION_ID)?.groups?.slug ?? post.id;

/** Language suffix of a translation file, or undefined for an original. */
const suffixLang = (post: Post) => post.id.match(TRANSLATION_ID)?.groups?.lang;

export const isTranslation = (post: Post) => suffixLang(post) !== undefined;

/** Effective BCP 47 language: the filename suffix for a translation, else frontmatter, else the site default. */
export const postLang = (post: Post) => suffixLang(post) ?? post.data.lang ?? site.lang;

/** Path of a post's page: originals keep the historical /posts/<slug>/, translations get a language prefix. */
export const postPath = (post: Post) =>
  isTranslation(post) ? `/${postLang(post)}/posts/${postSlug(post)}/` : `/posts/${postSlug(post)}/`;

/** Every version of a post, original first, then translations by language code. */
export type Alternate = { lang: string; href: string; post: Post };

/**
 * Split the collection into originals and, per slug, their translations, validating the pairing.
 * Not cached: the collection is small and already in memory, and a cache would go stale in dev
 * when a translation file is added.
 */
async function load(includeDrafts: boolean) {
  const all = await getCollection('posts');
  const originals = all.filter((p) => !isTranslation(p));
  const bySlug = new Map(originals.map((p) => [p.id, p]));
  const translations = new Map<string, Post[]>();
  for (const t of all.filter(isTranslation)) {
    const slug = postSlug(t);
    const base = bySlug.get(slug);
    const file = `src/content/posts/${t.id}.md`;
    if (!base) throw new Error(`${file} translates "${slug}", but src/content/posts/${slug}.md does not exist.`);
    if (base.data.legacy) throw new Error(`${file}: legacy posts are kept as a record and cannot be translated.`);
    if (t.data.lang && t.data.lang !== postLang(t)) throw new Error(`${file}: frontmatter lang "${t.data.lang}" contradicts the filename suffix.`);
    if (postLang(t) === postLang(base)) throw new Error(`${file} has the same language as the original (${postLang(base)}).`);
    translations.set(slug, [...(translations.get(slug) ?? []), t]);
  }
  for (const list of translations.values()) list.sort((a, b) => postLang(a).localeCompare(postLang(b)));
  // A translation is visible only when it and its original are; drafts are previewable in dev.
  const visible = (p: Post) => includeDrafts || !p.data.draft;
  const keptOriginals = originals.filter(visible).sort(byDateDesc);
  const keptTranslations = new Map<string, Post[]>();
  for (const o of keptOriginals) {
    const list = (translations.get(o.id) ?? []).filter(visible);
    if (list.length) keptTranslations.set(o.id, list);
  }
  return { originals: keptOriginals, translations: keptTranslations };
}

/** Published original-language posts, newest first. Pass `true` to include drafts (dev only). */
export async function getPosts(includeDrafts = false): Promise<Post[]> {
  return (await load(includeDrafts)).originals;
}

/** Published translations of visible originals, in no particular order. A translation is hidden when it or its original is a draft. */
export async function getTranslations(includeDrafts = false): Promise<Post[]> {
  return [...(await load(includeDrafts)).translations.values()].flat();
}

/** All language versions of the post `post` belongs to, original first. */
export async function getAlternates(post: Post, includeDrafts = false): Promise<Alternate[]> {
  const { originals, translations } = await load(includeDrafts);
  const slug = postSlug(post);
  const original = originals.find((p) => p.id === slug);
  const versions = [...(original ? [original] : []), ...(translations.get(slug) ?? [])];
  return versions.map((p) => ({ lang: postLang(p), href: postPath(p), post: p }));
}

/** The version of `post` in language `lang`, if one exists; used to keep readers in their language when navigating. */
export async function sameLanguageVersion(post: Post, lang: string, includeDrafts = false): Promise<Post> {
  const alternates = await getAlternates(post, includeDrafts);
  return alternates.find((a) => a.lang === lang)?.post ?? post;
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
