import type { CollectionEntry } from 'astro:content';

export type Pub = CollectionEntry<'pubs'>;

/** Comments that only explain the "*" marker are rendered inline on the author names instead. */
export const isEqualContributionNote = (comment?: string) => !!comment && /equal contribution/i.test(comment);

/** Dated after the build: accepted or scheduled but not yet out. */
export const isForthcoming = (date: Date, now = new Date()) => date.getTime() > now.getTime();

const bibFiles = import.meta.glob<string>('../data/bib/*.bib', { query: '?raw', import: 'default', eager: true });

/** Raw BibTeX entry for a publication's `bib` key, from src/data/bib/<key>.bib. */
export function getBibtex(key: string): string {
  const text = bibFiles[`../data/bib/${key}.bib`];
  if (text === undefined) throw new Error(`pubs.json names bib "${key}", but src/data/bib/${key}.bib does not exist`);
  return text.trim();
}

export const sortByDateDesc = (pubs: Pub[]) => [...pubs].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

/** Group publications by year, newest year first. */
export function groupByYear(pubs: Pub[]): { year: number; pubs: Pub[] }[] {
  const groups = new Map<number, Pub[]>();
  for (const pub of sortByDateDesc(pubs)) {
    const year = pub.data.date.getUTCFullYear();
    groups.set(year, [...(groups.get(year) ?? []), pub]);
  }
  return [...groups].map(([year, pubs]) => ({ year, pubs }));
}
