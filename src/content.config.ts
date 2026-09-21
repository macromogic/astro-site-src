import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    draft: z.boolean().default(false),
    /** Old post kept for the record; shown with a "Legacy" badge. */
    legacy: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    /** BCP 47 tag for the article, e.g. "zh-Hans", "zh-Hant", "ja", "en". */
    lang: z.string().optional(),
    toc: z.boolean().default(true),
  }),
});

const withIndexIds = (text: string) =>
  (JSON.parse(text) as Record<string, unknown>[]).map((row, i) => ({ id: String(i), ...row }));

const pubs = defineCollection({
  loader: file('./src/data/pubs.json', { parser: withIndexIds }),
  schema: z.object({
    title: z.string(),
    /** Short badge label, e.g. "CCS '26", "arXiv". */
    venue: z.string().optional(),
    authors: z.array(z.string()),
    /** Full venue name, shown under the title. */
    book: z.string().optional(),
    date: z.coerce.date(),
    comment: z.string().optional(),
    url: z.string().url().optional(),
    website: z.string().url().optional(),
    code: z.string().url().optional(),
  }),
});

const friends = defineCollection({
  loader: file('./src/data/friends.json', { parser: withIndexIds }),
  schema: z.object({
    name: z.string(),
    link: z.string().url(),
    /** One-line description shown under the name; defaults to the site's host. */
    note: z.string().optional(),
  }),
});

export const collections = { posts, pubs, friends };
