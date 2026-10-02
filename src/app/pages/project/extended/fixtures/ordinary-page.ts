import type { ExtendedPage } from '../types';

/**
 * Made-up content for an ordinary EAO project: no masthead, panel or timeline of its own, so those
 * stay standard. It appends blocks to the standard Overview and adds one tab, and leaves the
 * Decisions and Compliance tabs out of its strip.
 */
export const ORDINARY_PAGE: ExtendedPage = {
  version: 1,
  tabs: [
    {
      segment: 'overview',
      banner: [
        {
          type: 'band',
          id: 'fund-band',
          heading: 'Larch Creek community fund',
          paragraphs: ['The proponent pays into a fund the town council runs.'],
          steps: [
            { name: 'Apply', short: 'Each spring' },
            { name: 'Decide', short: 'Town council' },
          ],
          primary: { label: 'How the fund works', tab: 'community' },
        },
      ],
      main: [
        {
          type: 'prose',
          id: 'water',
          heading: 'Water monitoring',
          text: 'Three stations sample Larch Creek each month.',
        },
      ],
      aside: [
        {
          type: 'links',
          id: 'town',
          heading: 'Town pages',
          style: 'list',
          items: [{ label: 'Larch Creek council', href: 'https://larch-creek.example/council' }],
        },
      ],
    },
    { segment: 'updates' },
    {
      segment: 'community',
      label: 'Community fund',
      title: 'How the community fund works',
      main: [
        {
          type: 'list',
          id: 'rules',
          heading: 'Fund rules',
          style: 'numbered',
          items: ['One grant per group each year.', 'Grants pay for work inside the town.'],
        },
      ],
    },
    { segment: 'engagement' },
    { segment: 'documents' },
  ],
};
