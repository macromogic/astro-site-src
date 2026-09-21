export const site = {
  title: 'Macromogic',
  url: 'https://macromogic.xyz',
  description: 'Code. Study. Live.',
  /** Default language of the site; individual posts may override with `lang`. */
  lang: 'zh-Hans',
  author: { name: 'Weijie Huang' },
  /** Public source repository, linked from the footer. Leave undefined to hide the link. */
  repo: 'https://github.com/macromogic/astro-site-src' as string | undefined,
  postsPerPage: 5,
  nav: [
    { href: '/', label: 'Home' },
    { href: '/posts/', label: 'Posts' },
    { href: '/tags/', label: 'Tags' },
    { href: '/pubs/', label: 'Publications' },
    { href: '/cv.pdf', label: 'CV' },
    { href: '/friends/', label: 'Friends' },
  ],
  /** Shown in the contact card on the home page. Any line may be removed. */
  contact: {
    role: 'Ph.D. Student in Computer Science',
    affiliation: [
      'Luddy School of Informatics, Computing, and Engineering',
      'Indiana University Bloomington',
    ],
    address: ['Luddy Hall, 700 N. Woodlawn Ave.', 'Bloomington, IN 47408, USA'],
    email: 'wh25@iu.edu',
    cvUrl: '/cv.pdf',
  },
  social: {
    bilibili: '51291249',
    linkedin: 'weijie-huang-94aa11235',
    github: 'macromogic',
    gitlab: 'macromogic',
    email: 'wh25@iu.edu',
    discord: 'macromogic',
    googleScholar: 'L8T5nBEAAAAJ',
    orcid: '0009-0003-6017-0474',
  },
};
