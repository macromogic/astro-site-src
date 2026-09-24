/**
 * Insert a regular space between CJK characters and adjacent Latin letters or digits
 * ("学习FFT算法" -> "学习 FFT 算法"), the convention popularised by pangu.js.
 * Exported both as a string helper (titles, TOC) and as a rehype plugin (markdown body).
 */
const CJK = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Hangul}\\u3005-\\u3007\\u30fc';
const LATIN = 'A-Za-z0-9\\u00c0-\\u024f\\u0370-\\u03ff'; // Latin (incl. accented), Greek, digits
const cjkThenLatin = new RegExp(`([${CJK}])([${LATIN}])`, 'gu');
const latinThenCjk = new RegExp(`([${LATIN}])([${CJK}])`, 'gu');
const isCjk = new RegExp(`[${CJK}]`, 'u');
const isLatin = new RegExp(`[${LATIN}]`, 'u');

export function autoSpace(text) {
  return text.replace(cjkThenLatin, '$1 $2').replace(latinThenCjk, '$1 $2');
}

/** Elements whose text must never be touched. */
const SKIP = new Set(['code', 'pre', 'kbd', 'samp', 'script', 'style', 'math', 'annotation', 'textarea', 'sup', 'sub']);
const isSkipped = (node) =>
  node.type === 'element' &&
  (SKIP.has(node.tagName) || (Array.isArray(node.properties?.className) && node.properties.className.some((c) => String(c).startsWith('katex'))));

const isInlineMath = (node) =>
  node.type === 'element' && Array.isArray(node.properties?.className) && node.properties.className.includes('katex') && !node.properties.className.includes('katex-display');

/** Collect text nodes (and inline formulas, as opaque tokens) in document order, skipping code. */
function collectText(node, out) {
  if (node.type === 'text') out.push(node);
  else if (isInlineMath(node)) out.push({ type: 'math' });
  else if (node.children && !isSkipped(node)) for (const c of node.children) collectText(c, out);
}

export function rehypeCjkSpacing() {
  return (tree) => {
    const visit = (node) => {
      if (node.type !== 'element' && node.type !== 'root') return;
      if (isSkipped(node)) return;
      const items = [];
      collectText(node, items);
      // Space within each text node, then across node boundaries (e.g. "中文<strong>Latin</strong>",
      // or a formula next to CJK text: "一个$n$次" -> "一个 n 次").
      for (const t of items) if (t.type === 'text') t.value = autoSpace(t.value);
      for (let i = 1; i < items.length; i++) {
        const prev = items[i - 1], next = items[i];
        if (prev.type === 'text' && next.type === 'text') {
          if (!prev.value || !next.value) continue;
          const a = prev.value[prev.value.length - 1], b = next.value[0];
          if ((isCjk.test(a) && isLatin.test(b)) || (isLatin.test(a) && isCjk.test(b))) next.value = ' ' + next.value;
        } else if (prev.type === 'text' && next.type === 'math') {
          if (prev.value && isCjk.test(prev.value[prev.value.length - 1])) prev.value += ' ';
        } else if (prev.type === 'math' && next.type === 'text') {
          if (next.value && isCjk.test(next.value[0])) next.value = ' ' + next.value;
        }
      }
    };
    // Apply per block so boundaries never cross paragraphs.
    const walk = (node) => {
      if (node.type === 'element' && /^(p|li|h[1-6]|td|th|dd|dt|figcaption|caption|summary)$/.test(node.tagName)) { visit(node); return; }
      if (node.children) for (const c of node.children) walk(c);
    };
    walk(tree);
  };
}
