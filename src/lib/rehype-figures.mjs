/**
 * Wrap standalone images that carry a meaningful alt text in <figure> with a <figcaption>.
 * Alt texts that are just file names (e.g. "image-20200315231540841") are left as-is.
 *
 * Markdown flattens an image label to plain text, so `![see $x^2$](a.png)` reaches us with alt "see x^2". The alt
 * attribute should stay plain, but the visible caption is re-parsed from the original label in the source file so
 * formulas, emphasis, links and code render as they would in body text.
 */
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

const isJunkAlt = (alt) => !alt || /^(image|img|screenshot|截图)?[-_ ]?\d{6,}$/i.test(alt) || /\.(png|jpe?g|gif|webp|svg)$/i.test(alt);

const captionProcessor = unified().use(remarkParse).use(remarkMath).use(remarkRehype).use(rehypeKatex, { strict: false });

/** The text between `![` and its matching `]`, honouring backslash escapes and nested brackets. */
function imageLabel(raw) {
  if (!raw.startsWith('![')) return null;
  let depth = 0;
  for (let i = 2; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\') i++;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      if (depth === 0) return raw.slice(2, i);
      depth--;
    }
  }
  return null;
}

/** Caption as hast children parsed from the image's source label; falls back to the plain alt text. */
function captionChildren(img, source) {
  const plain = [{ type: 'text', value: String(img.properties.alt) }];
  const pos = img.position;
  if (typeof source !== 'string' || pos?.start?.offset == null || pos?.end?.offset == null) return plain;
  const label = imageLabel(source.slice(pos.start.offset, pos.end.offset));
  if (label == null) return plain;
  const tree = captionProcessor.runSync(captionProcessor.parse(label));
  const p = tree.children.find((c) => c.type === 'element' && c.tagName === 'p');
  return p?.children?.length ? p.children : plain;
}

export function rehypeFigures() {
  return (tree, file) => {
    const source = typeof file?.value === 'string' ? file.value : null;
    const walk = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === 'element' && child.tagName === 'p' && child.children?.length === 1) {
          const img = child.children[0];
          if (img.type === 'element' && img.tagName === 'img' && !isJunkAlt(img.properties?.alt)) {
            return {
              type: 'element', tagName: 'figure', properties: {},
              children: [img, { type: 'element', tagName: 'figcaption', properties: {}, children: captionChildren(img, source) }],
            };
          }
        }
        walk(child);
        return child;
      });
    };
    walk(tree);
  };
}
