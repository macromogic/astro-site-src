/**
 * rehype-mermaid (with its `dark` option) emits one <picture> per diagram: a <source> for the dark render keyed on
 * `prefers-color-scheme`, and an <img> for the light render. This site toggles theme with `html[data-theme]`, not the
 * OS setting, so rewrite each into two <img>s inside a <figure class="mermaid"> and let global.css pick one.
 */
const isDarkSource = (node) =>
  node.type === 'element' && node.tagName === 'source' && /prefers-color-scheme:\s*dark/.test(String(node.properties?.media ?? ''));

export function rehypeMermaidTheme() {
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === 'element' && child.tagName === 'picture') {
          const source = child.children.find(isDarkSource);
          const img = child.children.find((c) => c.type === 'element' && c.tagName === 'img');
          if (source && img) {
            // Both renders carry the same Mermaid-assigned id; nothing targets it, so drop it rather than duplicate it.
            const { srcset, media, id: _sourceId, ...rest } = source.properties;
            const { id: _imgId, ...imgProps } = img.properties;
            const light = { ...img, properties: { ...imgProps, className: ['mermaid-light'] } };
            // A srcset data URI is a valid src: it only differs in having spaces percent-encoded.
            const dark = { type: 'element', tagName: 'img', properties: { ...rest, alt: img.properties.alt ?? '', src: srcset, className: ['mermaid-dark'] }, children: [] };
            return { type: 'element', tagName: 'figure', properties: { className: ['mermaid'] }, children: [light, dark] };
          }
        }
        walk(child);
        return child;
      });
    };
    walk(tree);
  };
}
