/**
 * Pandoc-style presentation syntax, so posts can control layout without raw HTML.
 * Mirrors pandoc's `header_attributes`, `link_attributes`, `fenced_divs` and `bracketed_spans`:
 *
 *   ## Heading {#custom-id}                    (also the syntax Zola used; keeps old links alive)
 *   ![alt](/images/x.png){width=40%}           (instead of <img ... style="width: 40%">)
 *   [text](/url){target=_blank .button}
 *   [inline text]{.hl}                         -> <span class="hl">
 *
 *   ::: {.note title="提示"}                   -> <div class="callout note"><p class="callout-title">提示</p>...
 *   Any block content, nested divs allowed.
 *   :::
 *
 *   > [!tip] Optional title                    (GitHub / Obsidian alert: same output as the div above)
 *   > Body. `[!tip]-` renders folded (<details>), `[!tip]+` expanded.
 *
 *   ::: columns                                (a bare word is a class name, as in pandoc)
 *   :::: {.column width=40%}
 *   ...
 *   ::::
 *   :::: column
 *   ...
 *   ::::
 *   :::
 *
 * Attribute grammar: `#id`, `.class`, `key=value`, `key="quoted value"`, space separated.
 * `width`/`height` with a CSS unit (`40%`, `12rem`) become inline `style`; bare numbers stay
 * HTML attributes. Everything else is emitted as-is, so new CSS hooks need no plugin changes.
 * The block after an image/link/code span must be glued to it (no space).
 * Fences should be separated from neighbouring blocks by blank lines, as in pandoc: CommonMark's
 * lazy continuation otherwise folds a `:::` line into a preceding list item or quote. A single
 * closing fence in that position is still recovered; an opening fence is not.
 */
// Quoted values accept straight or curly quotes: remark-smartypants runs before this plugin.
const TOKEN = /#([\w-]+)|\.([\w-]+)|([\w-]+)=(?:"([^"]*)"|'([^']*)'|“([^”]*)”|‘([^’]*)’|([^\s"'“‘]+))|([\w-]+)/g;
const ATTR_BLOCK = /^\{([^{}\n]*)\}/;
/** `::: {.a}` / `::: name` / `:::` on a line of its own. */
const FENCE = /^:{3,}[ \t]*(?:\{([^{}\n]*)\}|([\w-]+))?[ \t]*$/;

function parseAttrs(src) {
  const props = {};
  const classes = [];
  const styles = [];
  for (const m of src.matchAll(TOKEN)) {
    const [, id, cls, key, dq, sq, cdq, csq, bare, flag] = m;
    if (id) props.id = id;
    else if (cls) classes.push(cls);
    else if (key) {
      const value = dq ?? sq ?? cdq ?? csq ?? bare;
      if ((key === 'width' || key === 'height') && /^\d*\.?\d+(%|[a-z]+)$/i.test(value)) styles.push(`${key}: ${value}`);
      else if (key === 'style') styles.push(value.replace(/;\s*$/, ''));
      else props[key] = value;
    } else if (flag) props[flag] = true;
  }
  if (classes.length) props.className = classes;
  if (styles.length) props.style = styles.join('; ');
  return props;
}

function apply(node, props) {
  node.data ??= {};
  const prev = node.data.hProperties ?? {};
  const merged = { ...prev, ...props };
  if (prev.className && props.className) merged.className = [...prev.className, ...props.className];
  if (prev.style && props.style) merged.style = `${prev.style}; ${props.style}`;
  node.data.hProperties = merged;
}

const text = (value) => ({ type: 'text', value });
const plainText = (node) => node.value ?? (node.children ?? []).map(plainText).join('');

/* ---------- Fenced divs ---------- */

/**
 * Split a paragraph at fence lines. A fence must occupy a whole line: it starts at the paragraph
 * start or after a newline, and ends at a newline or the paragraph end. Returns null if none found.
 */
function splitFences(para) {
  const kids = para.children;
  const out = [];
  let current = [], buf = '', fresh = true, found = false;
  const pushBuf = () => { if (buf) current.push(text(buf)); buf = ''; };
  const flush = () => {
    pushBuf();
    if (current.length) out.push({ ...para, children: current });
    current = []; fresh = true;
  };
  kids.forEach((child, i) => {
    if (child.type !== 'text') { pushBuf(); current.push(child); fresh = false; return; }
    const lines = child.value.split('\n');
    lines.forEach((line, j) => {
      const wholeLine = (j > 0 || i === 0) && (j < lines.length - 1 || i === kids.length - 1);
      if (wholeLine && FENCE.test(line)) { flush(); out.push({ type: 'fence', line }); found = true; return; }
      if (j > 0 && !fresh) buf += '\n';
      buf += line; fresh = false;
    });
  });
  flush();
  return found ? out : null;
}

function buildDivs(children) {
  const stack = [{ node: null, kids: [] }];
  const top = () => stack[stack.length - 1];
  for (const child of children) {
    const parts = child.type === 'paragraph' ? splitFences(child) : child.type === 'fenceClose' ? [{ type: 'fence', line: ':::' }] : null;
    for (const part of parts ?? [child]) {
      if (part.type !== 'fence') { top().kids.push(part); continue; }
      const [, attrs, name] = part.line.match(FENCE);
      if (attrs === undefined && name === undefined) {
        // Closing fence. With nothing open here, leave a marker for the enclosing block
        // (a `:::` right after a list item is parsed as part of that item by CommonMark).
        if (stack.length > 1) { const { node, kids } = stack.pop(); node.children = kids; top().kids.push(node); }
        else top().kids.push({ type: 'fenceClose' });
        continue;
      }
      const props = attrs !== undefined ? parseAttrs(attrs) : { className: [name] };
      stack.push({ node: { type: 'div', data: { hName: 'div', hProperties: props }, children: [] }, kids: [] });
    }
  }
  while (stack.length > 1) { const { node, kids } = stack.pop(); node.children = kids; top().kids.push(node); } // unclosed: close at end
  return stack[0].kids;
}

/* ---------- Bracketed spans ---------- */

const SPAN_TOKEN = /(\[|\]\{[^{}\n]*\})/;

function buildSpans(children) {
  // Tokenise: text is split around `[` and `]{...}`; every other node is opaque.
  const parts = [];
  for (const child of children) {
    if (child.type !== 'text') { parts.push(child); continue; }
    for (const piece of child.value.split(SPAN_TOKEN)) {
      if (!piece) continue;
      if (piece === '[') parts.push({ type: 'open' });
      else if (piece.startsWith(']{')) parts.push({ type: 'close', attrs: piece.slice(2, -1) });
      else parts.push(text(piece));
    }
  }
  if (!parts.some((p) => p.type === 'close')) return null;
  const stack = [[]];
  for (const part of parts) {
    if (part.type === 'open') { stack.push([]); continue; }
    if (part.type === 'close') {
      if (stack.length === 1) { stack[0].push(text(`]{${part.attrs}}`)); continue; }
      const inner = stack.pop();
      stack[stack.length - 1].push({ type: 'span', data: { hName: 'span', hProperties: parseAttrs(part.attrs) }, children: inner });
      continue;
    }
    stack[stack.length - 1].push(part);
  }
  while (stack.length > 1) { const inner = stack.pop(); stack[stack.length - 1].push(text('['), ...inner); } // unmatched `[`
  // Merge adjacent text nodes again.
  return stack[0].reduce((acc, n) => {
    const prev = acc[acc.length - 1];
    if (n.type === 'text' && prev?.type === 'text') prev.value += n.value; else acc.push(n);
    return acc;
  }, []);
}

/* ---------- Callouts (fenced div with a callout class, or `> [!type] Title` alerts) ---------- */

/** Obsidian aliases -> the class that carries the colour in global.css. */
const CALLOUT_ALIASES = {
  note: 'note', info: 'info', abstract: 'abstract', summary: 'abstract', tldr: 'abstract', todo: 'todo',
  tip: 'tip', hint: 'tip', important: 'important', success: 'success', check: 'success', done: 'success',
  question: 'question', help: 'question', faq: 'question', warning: 'warning', attention: 'warning',
  caution: 'caution', danger: 'danger', error: 'danger', failure: 'failure', fail: 'failure', missing: 'failure',
  bug: 'bug', example: 'example', quote: 'quote', cite: 'quote',
};
const ALERT = /^\[!([\w-]+)\]([+-])?[ \t]*/;

const titleNode = (children, tag = 'p') => ({ type: 'calloutTitle', data: { hName: tag, hProperties: { className: ['callout-title'] } }, children });

/** Wrap body blocks in a callout, optionally foldable (`fold`: '-' closed, '+' open). */
function callout(type, fold, title, body) {
  const cls = CALLOUT_ALIASES[type.toLowerCase()] ?? type.toLowerCase();
  const props = { className: ['callout', cls] };
  if (fold) {
    if (fold === '+') props.open = true;
    return { type: 'div', data: { hName: 'details', hProperties: props }, children: [titleNode(title, 'summary'), ...body] };
  }
  return { type: 'div', data: { hName: 'div', hProperties: props }, children: [titleNode(title), ...body] };
}

/** `> [!note] Title` blockquotes. The title is the rest of the marker's line, inline markup allowed. */
function alertFromBlockquote(node) {
  const para = node.children[0];
  if (para?.type !== 'paragraph' || para.children[0]?.type !== 'text') return null;
  const m = para.children[0].value.match(ALERT);
  if (!m) return null;
  const [, type, fold] = m;
  const title = [], rest = [];
  let inTitle = true;
  para.children.forEach((child, i) => {
    if (!inTitle) { rest.push(child); return; }
    if (child.type !== 'text') { title.push(child); return; }
    let value = i === 0 ? child.value.slice(m[0].length) : child.value;
    const nl = value.indexOf('\n');
    if (nl < 0) { if (value) title.push(text(value)); return; }
    if (nl > 0) title.push(text(value.slice(0, nl)));
    inTitle = false;
    value = value.slice(nl + 1);
    if (value) rest.push(text(value));
  });
  const body = rest.length ? [{ ...para, children: rest }, ...node.children.slice(1)] : node.children.slice(1);
  const label = title.length ? title : [text(type[0].toUpperCase() + type.slice(1).toLowerCase())];
  return callout(type, fold, label, body);
}

/** A fenced div whose class is a callout type: add `.callout` and turn `title=` into a title element. */
function calloutFromDiv(node) {
  const props = node.data.hProperties;
  const type = props.className?.find((c) => c in CALLOUT_ALIASES);
  if (!type) return node;
  const title = props.title !== undefined ? [text(String(props.title))] : null;
  delete props.title;
  const out = callout(type, null, title ?? [], node.children);
  out.data.hProperties = { ...props, className: [...new Set(['callout', ...props.className.map((c) => CALLOUT_ALIASES[c] ?? c)])] };
  if (!title) out.children.shift(); // no title requested
  return out;
}

/** Turn alert blockquotes and callout-classed divs into callouts, recursing into fresh divs. */
function transformBlocks(children) {
  return children.map((c) => {
    if (c.type === 'blockquote') return alertFromBlockquote(c) ?? c;
    if (c.type === 'div' && c.data?.hName === 'div') { c.children = transformBlocks(c.children); return calloutFromDiv(c); }
    return c;
  });
}

/* ---------- Plugin ---------- */

const BLOCK_PARENTS = new Set(['root', 'blockquote', 'listItem', 'footnoteDefinition']);
const INLINE_PARENTS = new Set(['paragraph', 'heading', 'emphasis', 'strong', 'delete', 'link', 'linkReference', 'tableCell', 'span', 'calloutTitle']);

/**
 * A closer with nothing open only makes sense at the tail of a nested block (it then closes a div in
 * the enclosing block); anywhere else, and anywhere at the root, it is dropped as pandoc would.
 */
function dropStrayClosers(kids, all) {
  let end = kids.length;
  if (!all) while (end > 0 && kids[end - 1].type === 'fenceClose') end--;
  return [...kids.slice(0, end).filter((c) => c.type !== 'fenceClose'), ...kids.slice(end)];
}

/** Pull `fenceClose` markers off the tail of a subtree so the parent block can act on them. */
function hoistClosers(children) {
  const out = [];
  for (const child of children) {
    out.push(child);
    let node = child;
    while (node?.children?.length) {
      const last = node.children[node.children.length - 1];
      if (last.type === 'fenceClose') { node.children.pop(); out.push(last); }
      else node = last;
    }
  }
  return out;
}

export function remarkAttrs() {
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      // Bottom-up, so fence markers from nested blocks have bubbled up before this level is built.
      for (const child of node.children) walk(child);
      node.children = hoistClosers(node.children);
      if (BLOCK_PARENTS.has(node.type)) node.children = transformBlocks(dropStrayClosers(buildDivs(node.children), node.type === 'root'));
      if (INLINE_PARENTS.has(node.type)) node.children = buildSpans(node.children) ?? node.children;
      const kids = node.children;
      if (node.type === 'heading' && kids.length) {
        const last = kids[kids.length - 1];
        const m = last.type === 'text' && last.value.match(/\s*\{([^{}\n]*)\}\s*$/);
        if (m) {
          last.value = last.value.slice(0, m.index).trimEnd();
          if (!last.value) kids.pop();
          apply(node, parseAttrs(m[1]));
        }
      }
      for (let i = 0; i < kids.length; i++) {
        const child = kids[i], next = kids[i + 1];
        if ((child.type === 'image' || child.type === 'link' || child.type === 'inlineCode' || child.type === 'span') && next?.type === 'text') {
          const m = next.value.match(ATTR_BLOCK);
          if (m) {
            apply(child, parseAttrs(m[1]));
            next.value = next.value.slice(m[0].length);
            if (!next.value) kids.splice(i + 1, 1);
          }
        }
        if (child.type === 'span') walk(child); // spans are created here, after the recursive pass
      }
    };
    walk(tree);
  };
}
