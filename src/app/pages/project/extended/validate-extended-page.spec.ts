import { describe, it, expect } from 'vitest';
import { routes } from 'app/routes';
import { EXTENDED_CONTENT, isStandardSegment } from './extended-page';
import { ORDINARY_PAGE } from './fixtures/ordinary-page';
import type { Block, ExtendedMap, ExtendedPage, TabEntry } from './types';
import { validateExtendedPage } from './validate-extended-page';

function prose(id: string): Block {
  return { type: 'prose', id, text: 'Text.' };
}

/** A sound page with the given tabs (after a bare overview, unless they hold one), plus any
 * page-level fields. */
function page(tabs: TabEntry[], extra: Partial<ExtendedPage> = {}): ExtendedPage {
  const hasOverview = tabs.some((entry) => entry.segment === 'overview');
  return {
    version: 1,
    tabs: hasOverview ? tabs : [{ segment: 'overview' }, ...tabs],
    ...extra,
  };
}

const UNSAFE_HREFS = [
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  'data:text/html,hi',
  'vbscript:msgbox',
  'file:///etc/passwd',
  'http://example.com/',
  '//example.com/',
  '/\\example.com/',
  '/\t/example.com/',
  '/\n/example.com/',
  '/\r/example.com/',
  'relative/path',
  '',
];

const MAP: ExtendedMap = {
  geojsonUrl: '/assets/lines.geojson',
  label: 'Lines',
  attribution: 'Map data',
  places: [],
  lines: [
    { id: 'north', label: 'North', colour: 'line-1', width: 4 },
    { id: 'south', label: 'South', colour: 'line-2', width: 3 },
  ],
};

/** Static segments the project route holds besides the standard tabs, read off the route table. */
function routedSegments(): string[] {
  const top = routes[0].children ?? [];
  const project = top.find((route) => route.path === 'p/:projId');
  const children = (project?.children ?? [])
    .map((child) => child.path)
    .filter((path): path is string => !!path && !path.startsWith(':'));
  // Comment periods hang off the project path as siblings of the project route.
  const siblings = top
    .map((route) => /^p\/:projId\/([^/:]+)\//.exec(route.path ?? '')?.[1])
    .filter((segment): segment is string => !!segment);
  return [...new Set([...children, ...siblings])].filter((path) => !isStandardSegment(path));
}

describe('validateExtendedPage on real content', () => {
  it.each(Object.entries(EXTENDED_CONTENT))('finds no problem in %s', (_key, content) => {
    expect(validateExtendedPage(content)).toEqual([]);
  });

  it.each(Object.entries(EXTENDED_CONTENT))(
    '%s survives a JSON round trip unchanged',
    (_key, content) => {
      expect(JSON.parse(JSON.stringify(content))).toStrictEqual(content);
    },
  );

  it('finds no problem in the ordinary project fixture', () => {
    expect(validateExtendedPage(ORDINARY_PAGE)).toEqual([]);
  });

  it('accepts the same block id in two different tabs', () => {
    const sound = page([
      { segment: 'overview', main: [prose('intro')] },
      { segment: 'extra', main: [prose('intro')] },
    ]);
    expect(validateExtendedPage(sound)).toEqual([]);
  });

  it('accepts a 31-character custom segment', () => {
    expect(validateExtendedPage(page([{ segment: `a${'b'.repeat(30)}`, main: [] }]))).toEqual([]);
  });
});

describe('validateExtendedPage on broken pages', () => {
  it('refuses any version but 1', () => {
    const broken = { ...page([]), version: 2 } as unknown as ExtendedPage;
    expect(validateExtendedPage(broken)).toEqual(['version is 2, not 1']);
  });

  it('refuses a value a JSON round trip would drop', () => {
    const broken = page([], { displayName: undefined });
    expect(validateExtendedPage(broken)).toEqual(['page.displayName is not JSON (undefined)']);
  });

  it('refuses a value a JSON round trip would change', () => {
    const broken = page([], {
      updates: [
        {
          date: new Date(2026, 0, 1) as unknown as string,
          source: 'Town',
          headline: 'News',
          href: 'https://town.example/news',
          summary: 'Summary.',
        },
      ],
    });
    expect(validateExtendedPage(broken)).toEqual(['page.updates[0].date is not a plain object']);
  });

  it('refuses a block id used twice in one tab, across its regions', () => {
    const broken = page([
      {
        segment: 'extra',
        banner: [prose('intro')],
        main: [prose('body')],
        aside: [prose('intro')],
      },
    ]);
    expect(validateExtendedPage(broken)).toEqual([
      'tab "extra": block id "intro" is used more than once',
    ]);
  });

  it.each(['Act', '1act', 'act_two', `a${'b'.repeat(31)}`, ''])(
    'refuses the custom segment "%s"',
    (segment) => {
      expect(validateExtendedPage(page([{ segment, main: [] }]))).toEqual([
        `tab "${segment}": a custom segment must match ^[a-z][a-z0-9-]{0,30}$`,
      ]);
    },
  );

  it.each(routedSegments())('refuses "%s", a path the project route already holds', (segment) => {
    expect(validateExtendedPage(page([{ segment, main: [] }]))).toEqual([
      `tab "${segment}": the segment is already a project route`,
    ]);
  });

  it('reads the reserved paths off the route table', () => {
    expect(routedSegments()).toEqual(
      expect.arrayContaining(['application', 'project-details', 'commenting', 'cp']),
    );
  });

  it('refuses blocks without replace on a standard tab other than overview', () => {
    const broken = page([{ segment: 'updates', main: [prose('list')] }]);
    expect(validateExtendedPage(broken)).toEqual([
      'tab "updates": only overview appends blocks; set replace to draw this tab instead',
    ]);
  });

  it('refuses a custom entry with no blocks', () => {
    const broken = page([{ segment: 'extra' } as unknown as TabEntry]);
    expect(validateExtendedPage(broken)).toEqual(['tab "extra": a custom tab needs main blocks']);
  });

  it('refuses a segment listed twice', () => {
    const broken = page([{ segment: 'documents' }, { segment: 'documents' }]);
    expect(validateExtendedPage(broken)).toEqual(['tab "documents" is listed more than once']);
  });

  it("refuses count 'updates' on a page with no updates", () => {
    const broken = page([{ segment: 'news', count: 'updates', main: [prose('list')] }]);
    expect(validateExtendedPage(broken)).toEqual([
      'tab "news": count "updates" needs the page\'s updates',
    ]);
  });

  it('refuses panel.timeline on a page with no timeline', () => {
    expect(validateExtendedPage(page([], { panel: { timeline: true } }))).toEqual([
      'panel.timeline is set, but the page has no timeline',
    ]);
  });

  it('refuses panel.map on a page with no map', () => {
    expect(
      validateExtendedPage(page([], { panel: { map: { label: 'Map', caption: 'Caption' } } })),
    ).toEqual(['panel.map is set, but the page has no map']);
  });

  it('refuses a routeMap block on a page with no map', () => {
    const broken = page([{ segment: 'overview', main: [{ type: 'routeMap', id: 'route' }] }]);
    expect(validateExtendedPage(broken)).toEqual([
      'tab "overview": routeMap block "route" needs the page\'s map',
    ]);
    expect(validateExtendedPage({ ...broken, map: MAP })).toEqual([]);
  });

  it.each(UNSAFE_HREFS)('refuses the href "%s" wherever content sets one', (href) => {
    const broken = page(
      [
        {
          segment: 'overview',
          main: [{ type: 'links', id: 'links', style: 'list', items: [{ label: 'Out', href }] }],
        },
      ],
      { autoLinks: [{ text: 'Act', href: 'https://ok.example/', cited: { match: 's', href } }] },
    );
    expect(validateExtendedPage(broken)).toEqual([
      `page.tabs[0].main[0].items[0].href "${href}" is not https:, mailto:, tel: or a site path`,
      `page.autoLinks[0].cited.href "${href}" is not https:, mailto:, tel: or a site path`,
    ]);
  });

  it.each(['https://example.com/', 'mailto:a@example.com', 'tel:+12505550100', '/p/abc/act'])(
    'accepts the href "%s"',
    (href) => {
      const sound = page([], { masthead: { actions: [{ label: 'Out', href }] } });
      expect(validateExtendedPage(sound)).toEqual([]);
    },
  );

  it.each(['https://example.com/lines.geojson', '//example.com/lines.geojson', 'lines.geojson'])(
    'refuses map data at "%s", which is not a path on this site',
    (geojsonUrl) => {
      expect(validateExtendedPage(page([], { map: { ...MAP, geojsonUrl } }))).toEqual([
        `map.geojsonUrl "${geojsonUrl}" is not a path on this site`,
      ]);
    },
  );

  it('refuses tabs with no overview entry', () => {
    const broken: ExtendedPage = { version: 1, tabs: [{ segment: 'documents' }] };
    expect(validateExtendedPage(broken)).toEqual(['tabs has no overview entry']);
  });

  it('refuses in-page links to a tab the page does not have', () => {
    const broken = page([
      {
        segment: 'overview',
        main: [{ type: 'updates', id: 'news', shown: 2, tab: 'news' }],
        banner: [
          {
            type: 'band',
            id: 'band',
            paragraphs: [],
            steps: [],
            primary: { label: 'More', tab: 'compliance' },
          },
        ],
      },
      { segment: 'documents' },
    ]);
    expect(validateExtendedPage(broken)).toEqual([
      'tab "overview": block "band" links to tab "compliance", which the page does not have',
      'tab "overview": block "news" links to tab "news", which the page does not have',
    ]);
  });

  it('accepts an in-page link to a content tab the page lists, custom or replacing', () => {
    const sound = page([
      {
        segment: 'overview',
        main: [{ type: 'updates', id: 'news', shown: 2, tab: 'updates' }],
        banner: [
          {
            type: 'band',
            id: 'band',
            paragraphs: [],
            steps: [],
            primary: { label: 'More', tab: 'act' },
          },
        ],
      },
      { segment: 'updates', replace: true, main: [prose('list')] },
      { segment: 'act', main: [prose('act')] },
    ]);
    expect(validateExtendedPage(sound)).toEqual([]);
  });

  it('refuses an in-page link to a standard tab, which does not take focus from it', () => {
    const broken = page([
      { segment: 'overview', main: [{ type: 'updates', id: 'news', shown: 2, tab: 'updates' }] },
      { segment: 'updates' },
    ]);
    expect(validateExtendedPage(broken)).toEqual([
      'tab "overview": block "news" links to tab "updates", a standard tab, which does not take focus from the link',
    ]);
  });

  it('refuses fields an Overview append entry ignores', () => {
    const broken = page(
      [
        {
          segment: 'overview',
          label: 'Home',
          title: 'Home',
          intro: 'Text.',
          count: 'updates',
          layout: 'wide',
          main: [prose('intro')],
        },
      ],
      { updates: [] },
    );
    expect(validateExtendedPage(broken)).toEqual(
      ['label', 'title', 'intro', 'count', 'layout'].map(
        (field) =>
          `tab "overview": ${field} is ignored when blocks are appended; set replace to use it`,
      ),
    );
  });

  it('accepts those fields on an Overview entry that replaces the tab', () => {
    const sound = page([
      { segment: 'overview', replace: true, title: 'Home', layout: 'wide', main: [prose('intro')] },
    ]);
    expect(validateExtendedPage(sound)).toEqual([]);
  });

  it.each([-1, 1.5, 4])('refuses timeline.currentStep %s outside 0 to the step count', (step) => {
    const timeline = {
      title: 'Progress',
      note: '',
      steps: [
        { name: 'One', dateLabel: '2026', detail: '' },
        { name: 'Two', dateLabel: '2027', detail: '' },
      ],
      currentStep: step,
      stateLabels: { complete: 'Done', current: 'Now', upcoming: 'Next' },
    };
    expect(validateExtendedPage(page([], { timeline }))).toEqual([
      `timeline.currentStep ${step} is not a step index from 0 to 2`,
    ]);
  });

  it('refuses more map lines than there are line colours', () => {
    const lines = [
      ...MAP.lines,
      { id: 'third', label: 'Third', colour: 'line-1' as const, width: 2 },
    ];
    expect(validateExtendedPage(page([], { map: { ...MAP, lines } }))).toEqual([
      'map has 3 lines, but only 2 colours',
    ]);
  });

  it('refuses list keys used twice: fact labels, update link and date, contact labels', () => {
    const update = {
      date: '1 Oct 2026',
      source: 'Town',
      headline: 'News',
      href: 'https://town.example/news',
      summary: '',
    };
    const contact = { label: 'Office', link: { label: 'Mail', href: 'mailto:a@example.com' } };
    const broken = page(
      [{ segment: 'overview', main: [{ type: 'contacts', id: 'c', items: [contact, contact] }] }],
      {
        panel: {
          facts: [
            { label: 'Status', value: 'A' },
            { label: 'Status', value: 'B' },
          ],
        },
        updates: [update, { ...update, headline: 'Again' }],
      },
    );
    expect(validateExtendedPage(broken)).toEqual([
      'panel fact label "Status" is used more than once',
      'update link and date "https://town.example/news1 Oct 2026" is used more than once',
      'tab "overview" block "c" contact label "Office" is used more than once',
    ]);
  });

  it('refuses every other list key used twice, in page fields and in blocks', () => {
    const link = { label: 'Read', href: 'https://example.com/' };
    const doc = { title: 'Report', format: 'PDF', pages: 2, href: 'https://example.com/r.pdf' };
    const step = { name: 'Start', detail: '' };
    const broken = page(
      [
        {
          segment: 'overview',
          replace: true,
          main: [
            { type: 'links', id: 'cards', style: 'cards', items: [link, { ...link, href: '/a' }] },
            { type: 'links', id: 'list', style: 'list', items: [link, link] },
            {
              type: 'definitions',
              id: 'defs',
              items: [
                { term: 'Act', detail: '' },
                { term: 'Act', detail: 'x' },
              ],
            },
            {
              type: 'table',
              id: 'table',
              rows: [
                { name: 'Cost', value: '1' },
                { name: 'Cost', value: '2' },
              ],
            },
            {
              type: 'columns',
              id: 'cols',
              columns: [
                { heading: 'Pro', items: [] },
                { heading: 'Pro', items: [] },
              ],
            },
            { type: 'steps', id: 'steps', steps: [step, step] },
            {
              type: 'band',
              id: 'band',
              paragraphs: [],
              steps: [
                { name: 'Go', short: '' },
                { name: 'Go', short: '' },
              ],
            },
            {
              type: 'summary',
              id: 'sum',
              stats: [
                { label: 'Length', value: '1' },
                { label: 'Length', value: '2' },
              ],
              items: ['One', 'One'],
            },
            {
              type: 'projects',
              id: 'proj',
              items: [
                { id: 'p1', name: 'A', note: '' },
                { id: 'p1', name: 'B', note: '' },
              ],
            },
          ],
        },
      ],
      {
        masthead: { actions: [link, { ...link, label: 'Again' }] },
        timeline: {
          title: 'Progress',
          note: '',
          steps: [
            { name: 'One', dateLabel: '2026', detail: '' },
            { name: 'One', dateLabel: '2027', detail: '' },
          ],
          currentStep: 0,
          stateLabels: { complete: 'Done', current: 'Now', upcoming: 'Next' },
        },
        documents: {
          external: {
            heading: 'Other documents',
            intro: '',
            groups: [
              { publisher: 'Canada', items: [doc, doc] },
              { publisher: 'Canada', items: [] },
            ],
          },
        },
        autoLinks: [
          { text: 'Library Act', href: 'https://example.org/a' },
          { text: 'library act', href: 'https://example.org/b' },
        ],
      },
    );
    expect(validateExtendedPage(broken)).toEqual([
      'masthead action link "https://example.com/" is used more than once',
      'timeline step name "One" is used more than once',
      'external document publisher "Canada" is used more than once',
      'external document link from "Canada" "https://example.com/r.pdf" is used more than once',
      'autoLinks text "library act" is used more than once',
      'tab "overview" block "cards" link label "Read" is used more than once',
      'tab "overview" block "list" link address and label "https://example.com/Read" is used more than once',
      'tab "overview" block "defs" definition term "Act" is used more than once',
      'tab "overview" block "table" table row name "Cost" is used more than once',
      'tab "overview" block "cols" column heading "Pro" is used more than once',
      'tab "overview" block "steps" step name "Start" is used more than once',
      'tab "overview" block "band" step name "Go" is used more than once',
      'tab "overview" block "sum" stat label "Length" is used more than once',
      'tab "overview" block "sum" summary item "One" is used more than once',
      'tab "overview" block "proj" project id "p1" is used more than once',
    ]);
  });

  it('refuses a map line id used twice', () => {
    const lines = [MAP.lines[0]!, { ...MAP.lines[1]!, id: 'north' }];
    expect(validateExtendedPage(page([], { map: { ...MAP, lines } }))).toEqual([
      'map line id "north" is used more than once',
    ]);
  });
});
