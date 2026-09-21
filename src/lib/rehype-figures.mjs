/**
 * Wrap standalone images that carry a meaningful alt text in <figure> with a <figcaption>.
 * Alt texts that are just file names (e.g. "image-20200315231540841") are left as-is.
 */
const isJunkAlt = (alt) => !alt || /^(image|img|screenshot|截图)?[-_ ]?\d{6,}$/i.test(alt) || /\.(png|jpe?g|gif|webp|svg)$/i.test(alt);

export function rehypeFigures() {
  return (tree) => {
    const walk = (node, parent) => {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === 'element' && child.tagName === 'p' && child.children?.length === 1) {
          const img = child.children[0];
          if (img.type === 'element' && img.tagName === 'img' && !isJunkAlt(img.properties?.alt)) {
            return {
              type: 'element', tagName: 'figure', properties: {},
              children: [img, { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: String(img.properties.alt) }] }],
            };
          }
        }
        walk(child, node);
        return child;
      });
    };
    walk(tree, null);
  };
}
