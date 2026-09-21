/** Supports `## Heading {#custom-id}` (the syntax Zola used) by setting the heading's id. */
export function remarkHeadingId() {
  return (tree) => {
    for (const node of tree.children) {
      if (node.type !== 'heading' || node.children.length === 0) continue;
      const last = node.children[node.children.length - 1];
      if (last.type !== 'text') continue;
      const m = last.value.match(/\s*\{#([\w-]+)\}\s*$/);
      if (!m) continue;
      last.value = last.value.slice(0, m.index).trimEnd();
      if (!last.value) node.children.pop();
      node.data ??= {};
      node.data.hProperties = { ...(node.data.hProperties ?? {}), id: m[1] };
    }
  };
}
