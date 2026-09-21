import type { APIRoute } from 'astro';
import { getPosts, renderMarkdown } from '../lib/posts';
import { site } from '../site.config';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const updated = (posts[0]?.data.date ?? new Date()).toISOString();
  const entries = await Promise.all(
    posts.map(async (post) => {
      const url = `${site.url}/posts/${post.id}/`;
      const html = await renderMarkdown(post.body ?? '');
      return `  <entry xml:lang="${post.data.lang ?? site.lang}">
    <title>${esc(post.data.title)}</title>
    <published>${post.data.date.toISOString()}</published>
    <updated>${post.data.date.toISOString()}</updated>
    <author><name>${esc(site.author.name)}</name></author>
    <link rel="alternate" href="${url}" type="text/html"/>
    <id>${url}</id>
    <content type="html">${esc(html)}</content>
  </entry>`;
    }),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${site.lang}">
  <title>${esc(site.title)}</title>
  <subtitle>${esc(site.description)}</subtitle>
  <link rel="self" type="application/atom+xml" href="${site.url}/atom.xml"/>
  <link rel="alternate" type="text/html" href="${site.url}/"/>
  <generator uri="https://astro.build/">Astro</generator>
  <updated>${updated}</updated>
  <id>${site.url}/atom.xml</id>
${entries.join('\n')}
</feed>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
};
