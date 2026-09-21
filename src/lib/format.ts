const UTC = { timeZone: 'UTC' } as const;

/** "August 22, 2019" */
export const formatDate = (d: Date) =>
  d.toLocaleDateString('en-US', { ...UTC, year: 'numeric', month: 'long', day: 'numeric' });

/** "October, 2021" */
export const formatMonth = (d: Date) => {
  const month = d.toLocaleDateString('en-US', { ...UTC, month: 'long' });
  return `${month}, ${d.getUTCFullYear()}`;
};

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Matches Zola's taxonomy slugs: lowercase, spaces and punctuation collapsed to "-". */
export const slugifyTerm = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
