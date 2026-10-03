/**
 * An extended project page, shown in place of parts of the EAO page (today Pacific Link). Page
 * content for now, kept in content/; plain JSON so it can move into the project record later. The
 * record itself still supplies the id, centroid and documents, and a fallback description.
 */

/** A labelled link that leaves EPIC. */
export interface LinkItem {
  label: string;
  href: string;
}

/** A link inside running copy. */
export interface InlineLink {
  text: string;
  href: string;
}

/**
 * Running copy. Strings link the first mention of each `autoLinks` term (see RichTextView);
 * explicit links cover anything else. A plain string is the common case.
 */
export type RichText = string | (string | InlineLink)[];

export type ExtendedStepState = 'complete' | 'current' | 'upcoming';

/** One step of the page's timeline, as the rail and the Review process timeline show it. */
interface ExtendedStep {
  name: string;
  /** Free text: a date, a span or a target, e.g. "Jul – Sep 2026", "Target 1 Sep 2027". */
  dateLabel: string;
  detail: RichText;
}

/** A step with its state worked out from `currentStep`. */
export interface ExtendedStepWithState extends ExtendedStep {
  state: ExtendedStepState;
}

/** A linear timeline: drawn in the panel when `panel.timeline` is set, and on the Review process tab. */
export interface ExtendedTimeline {
  title: string;
  /** Beside the title, e.g. which process this is and is not. */
  note: RichText;
  steps: ExtendedStep[];
  /** Index into `steps` of the step in progress; `steps.length` means every step is complete. */
  currentStep: number;
  stateLabels: Record<ExtendedStepState, string>;
}

/** One `dt`/`dd` pair of the panel's facts. */
export interface Fact {
  label: string;
  value: RichText;
  detail?: RichText;
  /** A coloured dot before the value, as on a status. */
  statusDot?: boolean;
}

/** The line colours route-map.tsx and the option swatches know, set in route-lines.css. */
export const LINE_COLOURS = ['line-1', 'line-2'] as const;

export type LineColour = (typeof LINE_COLOURS)[number];

/** One line on the page's map, and its option tile under the map. */
export interface MapLine {
  /** Matches the `line` property on the GeoJSON LineStrings it draws. */
  id: string;
  label: string;
  colour: LineColour;
  /** Width in pixels on the full map; the thumbnail draws it one pixel thinner. */
  width: number;
  /** Terminal markers take this line's colour. */
  markers?: boolean;
  lengthKm?: number;
  detail?: RichText;
}

/** A town labelled on the route map for orientation. */
export interface MapPlace {
  name: string;
  /** `[lon, lat]`, as GeoJSON orders it. */
  coordinates: [number, number];
}

/** The page's map: the Overview route map, and the panel thumbnail when `panel.map` is set. */
export interface ExtendedMap {
  /** Static asset with the LineStrings (`line`) and terminal Points (`kind: 'terminal'`). */
  geojsonUrl: string;
  /** Accessible name of the full map, and its caption. */
  label: string;
  attribution: RichText;
  /** Highest priority first: when labels collide, later places drop out. */
  places: MapPlace[];
  /** Drawn in order, so a later line sits on top. */
  lines: MapLine[];
}

/** A term linked to `href` wherever running copy first mentions it. */
export interface AutoLink {
  text: string;
  href: string;
  /** Copy that also mentions `match` (any case) links the term to this `href` instead. */
  cited?: { match: string; href: string };
}

/** An update from another government, linked to its source rather than fetched. */
export interface ExtendedUpdate {
  /** Display date, newest first in the list. */
  date: string;
  source: string;
  headline: string;
  href: string;
  summary: RichText;
}

/** The tabs every project page knows, each with its own route, component and show rule. */
export type StandardSegment =
  'overview' | 'updates' | 'engagement' | 'documents' | 'decisions' | 'compliance';

/** A tab drawn from content: a title and intro, then blocks in up to three regions. */
export interface ContentTabEntry {
  /** URL segment under `/p/:projId`: a standard one, or a custom one. */
  segment: string;
  /** Strip label. Default: `title`, then the standard tab's label. */
  label?: string;
  /** On a standard segment: draw this tab instead of the standard one. */
  replace?: boolean;
  /** The tab's own heading. Present: block headings sit one level under it. */
  title?: string;
  intro?: RichText;
  /** Full width, between the tab strip and the tab. */
  banner?: Block[];
  main: Block[];
  aside?: Block[];
  /** A wider main column and a narrower aside. */
  layout?: 'wide';
  /** `updates`: count the page's updates in the strip, and hide the tab when there are none. */
  count?: 'updates';
}

/** One tab of the strip: a standard tab as it is, or a tab drawn from content. */
export type TabEntry = { segment: StandardSegment } | ContentTabEntry;

/** What every block has. The heading's id is `extended-<segment>-<id>`. */
interface BlockBase<T extends string> {
  type: T;
  /** Unique within its tab. */
  id: string;
  heading?: string;
  /** Draw the block as a card. */
  framed?: boolean;
}

export interface Stat {
  label: string;
  value: string;
}

/** About: a description, headline figures and a numbered list. */
export interface SummaryBlock extends BlockBase<'summary'> {
  /** Shown in place of the record's description; the record's is the fallback when this is empty. */
  description?: string;
  stats?: Stat[];
  itemsHeading?: string;
  items?: string[];
}

/** The page's `map`, a tile per line under it, and facts. */
export interface RouteMapBlock extends BlockBase<'routeMap'> {
  optionsHeading?: string;
  facts?: RichText[];
}

interface TableRow {
  name: string;
  note?: string;
  value: string;
}

/** Named rows, each with a value on the right. */
export interface TableBlock extends BlockBase<'table'> {
  intro?: RichText;
  rows: TableRow[];
  footnote?: RichText;
}

interface StatCard {
  value: string;
  text: RichText;
  source?: LinkItem;
}

/** Big figures in grey tiles, each with its source. */
export interface StatCardsBlock extends BlockBase<'statCards'> {
  cards: StatCard[];
  note?: RichText;
}

/** The page's `updates`: the newest `shown` in a side card, or every one as the tab's list. */
export interface UpdatesBlock extends BlockBase<'updates'> {
  /** Present: a side card of this many, with "See all" opening `tab`. */
  shown?: number;
  tab?: string;
  /** Under the heading of the full list. */
  intro?: RichText;
}

interface Definition {
  term: string;
  detail: RichText;
}

export interface DefinitionsBlock extends BlockBase<'definitions'> {
  items: Definition[];
}

/** Another project on EPIC, linked by its record id. */
interface RelatedEpicProject {
  /** EPIC project id; links to `/p/<id>`. */
  id: string;
  name: string;
  /** One neutral line on what the project is. */
  note: string;
}

export interface ProjectsBlock extends BlockBase<'projects'> {
  items: RelatedEpicProject[];
}

interface LinkCard extends LinkItem {
  detail?: string;
}

/** External links: `cards` with a line of detail each, a `list`, or a tighter `compact` list. */
export interface LinksBlock extends BlockBase<'links'> {
  style: 'cards' | 'list' | 'compact';
  items: LinkCard[];
}

export interface Contact {
  label: string;
  link: LinkItem;
}

export interface ContactsBlock extends BlockBase<'contacts'> {
  items: Contact[];
}

export interface ListBlock extends BlockBase<'list'> {
  style: 'numbered' | 'bulleted';
  intro?: RichText;
  items: RichText[];
}

export interface Step {
  name: string;
  detail: RichText;
  /** A line under the detail, e.g. this project's dates for the step. */
  note?: string;
}

/** Numbered steps joined by a line. */
export interface StepsBlock extends BlockBase<'steps'> {
  /** Before each note, then a colon, e.g. the project's name ahead of its dates for the step. */
  noteLabel?: string;
  steps: Step[];
}

interface Column {
  heading: string;
  items: RichText[];
}

/** Bullet lists side by side, stacked when narrow. */
export interface ColumnsBlock extends BlockBase<'columns'> {
  columns: Column[];
}

export interface ProseBlock extends BlockBase<'prose'> {
  text: RichText;
}

/** The page's `timeline`, one stop per step. */
export type TimelineBlock = BlockBase<'timeline'>;

/** A full-width band: an intro with links, and step tiles beside it. Goes in a tab's `banner`. */
export interface BandBlock extends BlockBase<'band'> {
  eyebrow?: string;
  paragraphs: RichText[];
  steps: { name: string; short: string }[];
  /** Opens another tab of the page. */
  primary?: { label: string; tab: string };
  secondary?: LinkItem;
}

/** Every block a content tab can hold. */
export type Block =
  | SummaryBlock
  | RouteMapBlock
  | TableBlock
  | StatCardsBlock
  | UpdatesBlock
  | DefinitionsBlock
  | ProjectsBlock
  | LinksBlock
  | ContactsBlock
  | ListBlock
  | StepsBlock
  | ColumnsBlock
  | ProseBlock
  | TimelineBlock
  | BandBlock;

/** Documents other governments published, linked where they host them. Never mixed into the EPIC
 * documents table, which holds only what the EAO publishes. */
interface ExternalDocuments {
  heading: string;
  intro: string;
  /** Empty: the section is left out. */
  groups: ExternalDocumentGroup[];
}

/**
 * An extended project page. Plain JSON: no functions, dates or class instances, so it can move
 * into the project record unchanged. Every page-level part is optional; an absent one is not drawn.
 */
export interface ExtendedPage {
  version: 1;
  /** Replaces the record's name in the masthead, breadcrumb and tab strip. */
  displayName?: string;
  masthead?: {
    /** Gold pill above the title. */
    badge?: string;
    /** Joined with " · " under the title. */
    subLine?: string[];
    /** Replace the Short link action: external pages, shown in this order after Subscribe. */
    actions?: LinkItem[];
  };
  panel?: {
    /** Draw `timeline` in the progress slot. */
    timeline?: boolean;
    facts?: Fact[];
    /** Draw a thumbnail of `map`, with this accessible name and caption. */
    map?: { label: string; caption: string };
  };
  timeline?: ExtendedTimeline;
  map?: ExtendedMap;
  /** Read by the `updates` block and by a tab's `count: 'updates'`. */
  updates?: ExtendedUpdate[];
  /** The tab strip, in order. Absent: the standard tabs. */
  tabs?: TabEntry[];
  documents?: {
    /** Shown in place of an empty EPIC documents table. */
    empty?: { title: string; text: RichText };
    external?: ExternalDocuments;
  };
  /** Terms linked on first mention in each piece of running copy. None: copy is not linked. */
  autoLinks?: AutoLink[];
}

/** Documents from one publisher, in the order the publisher lists them. */
export interface ExternalDocumentGroup {
  publisher: string;
  items: ExternalDocument[];
}

/** A document another government publishes and hosts. Links to the file itself. */
export interface ExternalDocument {
  /** The document's own title, as published. */
  title: string;
  /** Display date, e.g. "2 Jul 2026". Left out when the publisher gives none. */
  date?: string;
  /** File format, e.g. "PDF". */
  format: string;
  pages: number;
  /** Only when the document is not in English. */
  language?: {
    /** Shown in the details, e.g. "French". */
    label: string;
    /** BCP 47 tag for the title, e.g. "fr". */
    code: string;
  };
  href: string;
}
