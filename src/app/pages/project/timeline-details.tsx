import { useId, type ReactNode } from 'react';
import { Link } from 'react-router';
import { DocumentLink } from 'app/components/table/document-link';
import { Constants } from 'app/utils/constants';
import { documentTabByKey } from 'app/utils/document-tabs';
import { isSafeUrl } from 'app/utils/safe-url';
import { POST_DECISION_ROW } from './assessment-stages';
import { Milestones } from './milestones';
import { WORK_STATUS_LABELS, todayOf } from './timeline-axis';
import { TimelineChip, chipOf, dayDate, phaseRange, span, titleOf, whenOf } from './timeline-list';
import { TimelineStages } from './timeline-stages';
import type {
  CertificateItem,
  PhaseItem,
  ProponentItem,
  RowDocuments,
  SubstantialStartItem,
  TimelineItem,
  TimelineModel,
} from './use-timeline-model';
import { WhoseTime } from './whose-time';
import './timeline-details.css';

export interface TimelineDetailsProps {
  model: TimelineModel;
  /** Falls back to Today when null or not in the model. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Where an item's link goes; no link is drawn without one. */
  hrefFor?: (item: TimelineItem) => string | undefined;
  /** Links under this path go through the router; any other (a file, another site) is a plain link. */
  routeBase?: string;
}

interface Field {
  term: string;
  value: string;
  /** "Not dated", "Not recorded": a missing value, set in bold. */
  missing?: boolean;
}

/** Rows a details panel lists before "View all". */
const DOCUMENT_CAP = 50;

const PHASE_STATUS: Record<PhaseItem['status'], string> = {
  done: 'Done',
  current: 'In progress',
  planned: 'Planned',
  undated: 'Not dated',
};

function actFull(year: number | null): string {
  return year ? `Environmental Assessment Act (${year})` : 'Not recorded';
}

/** The current Act is the last Eagle lists, so an Act after it came only from Track or documents. */
function actOnProject(year: number, model: TimelineModel): string {
  const current = model.acts.find((act) => act.current)?.year;
  if (current == null) return 'Not listed in Eagle';
  if (year === current) return 'Current Act';
  return year < current ? 'Earlier Act' : 'Later Act, not listed in Eagle';
}

function kindOf(item: TimelineItem): string {
  switch (item.kind) {
    case 'band':
      return 'Act';
    case 'history':
      return 'Earlier Act';
    case 'phase':
      return `${item.actYear} Act phase`;
    case 'proponent':
      return 'Proponent time';
    case 'milestone':
      return 'Milestone';
    case 'transition':
      return 'Act transition';
    case 'document':
      return 'Amendment document';
    case 'certificate':
      return item.branch ? 'Decision · second assessment' : 'Decision';
    case 'branchStart':
      return 'Second assessment';
    case 'work':
      return `${item.workType} · ${item.milestones.length} ${item.milestones.length === 1 ? 'milestone' : 'milestones'}`;
    case 'substantialStart':
      return 'Other work · after the certificate';
    case 'group':
      return 'Same-day works';
    case 'today':
      return 'Today';
  }
}

function substantialStartLine(start: SubstantialStartItem): string {
  const decided = start.decided ? `decided ${dayDate(start.decided)}: ${start.outcome}` : '';
  if (!start.deadline) return decided || start.outcome;
  return `Deadline ${dayDate(start.deadline)} · ${decided || 'not yet decided'}`;
}

/** What the details panel shows for one item: fields, a note, sections and a link label. */
function describe(item: TimelineItem, model: TimelineModel) {
  const fields: Field[] = [];
  const field = (term: string, value: string, missing = false) =>
    fields.push({ term, value, missing });
  let note = '';
  let link = '';
  /** Where the link goes when the tab's `hrefFor` does not know the row. */
  let ownHref: string | undefined;
  let related: { label: string; items: TimelineItem[] } | null = null;
  let stages: { label: string; rows: TimelineModel['acts'][number]['rows'] } | null = null;
  let whoseTime = false;
  const byId = (id: string) => model.items.find((one) => one.id === id);
  const today = todayOf(model);

  switch (item.kind) {
    case 'band': {
      const act = model.acts.find((one) => one.year === item.actYear);
      field('Act', actFull(item.actYear));
      if (act?.inForce) field('In force from', dayDate(act.inForce));
      field('On this project', actOnProject(item.actYear, model));
      field('Phases used', String(item.phasesUsed));
      // The certificate row and the post-certificate line stand for Post Decision.
      const rows = (act?.rows ?? []).map((one) =>
        one.row.name === POST_DECISION_ROW ? { ...one, onProject: true } : one,
      );
      stages = { label: `Phases and steps under the ${item.actName}`, rows };
      break;
    }
    case 'history': {
      field('Act', actFull(item.actYear));
      field('Phase dates', 'Not dated', true);
      field('Milestones', `${item.datedMilestones} with dates`);
      if (item.knownRange?.from && item.knownRange.to) {
        field(
          'Known range',
          `Between ${dayDate(item.knownRange.from)} and ${dayDate(item.knownRange.to)}`,
        );
      }
      const rows = item.childIds
        .map(byId)
        .flatMap((child) =>
          child?.kind === 'phase' && child.row ? [{ row: child.row, onProject: true }] : [],
        );
      stages = { label: 'Phases on this project, in order', rows };
      related = {
        label: 'Dated milestones',
        items: model.items.filter(
          (one) => one.kind === 'milestone' && !one.commentPeriod && one.actYear === item.actYear,
        ),
      };
      break;
    }
    case 'phase':
    case 'proponent':
      field('Act', actFull(item.actYear));
      if (item.branch) field('Assessment', 'Second assessment');
      if (item.kind === 'phase' && item.status === 'undated') {
        field('Dates', 'Not dated', true);
        field('Source', 'Eagle phase history, which holds no dates');
        if (item.row) field('Steps', item.row.steps.join('; '));
        const range = item.knownRange;
        if (range?.from && range.to) {
          field('Known range', `Between ${dayDate(range.from)} and ${dayDate(range.to)}`);
        }
        break;
      }
      field('Status', PHASE_STATUS[item.status]);
      if (item.status === 'current') {
        field('Dates', phaseRange(item));
        field('So far', span(item.start, today));
        if (item.end) field('Planned end', dayDate(item.end));
      } else if (item.status === 'planned') {
        field('Dates', `${phaseRange(item)} (Planned)`);
      } else {
        field('Dates', phaseRange(item));
        const took = span(item.start, item.end);
        if (took) field('Took', took);
      }
      if (item.kind === 'proponent') {
        if (item.start && item.end) field('Days with the proponent', String(item.days));
        if (item.beforePhase) field('Leads into', item.beforePhase);
      }
      if (item.kind === 'phase' && item.documentCount) {
        const count = item.documentCount;
        field('Source', `Dated from ${count} ${count === 1 ? 'document' : 'documents'}`);
      } else {
        field('Source', 'Track');
      }
      if (item.kind === 'phase' && item.row) field('Steps', item.row.steps.join('; '));
      whoseTime = true;
      if (item.kind === 'phase') link = 'Documents for this phase';
      break;
    case 'milestone':
      field('Act', actFull(item.actYear));
      if (item.commentPeriod?.label) field('Name', item.commentPeriod.label);
      if (item.end) {
        field('Dates', `${dayDate(item.start)} – ${dayDate(item.end)}`);
        const ran = span(item.start, item.end);
        if (ran) field('Ran for', ran);
      } else {
        field('Date', dayDate(item.start));
      }
      field(
        'Source',
        item.commentPeriod ? 'Comment period record' : `${item.actYear} Act data block`,
      );
      if (item.commentPeriod?.href) {
        link = 'Comment period details';
        ownHref = item.commentPeriod.href;
      }
      break;
    case 'document':
      field('Act', actFull(item.actYear));
      field('Document', item.displayName);
      field('Document type', item.title);
      field('Posted', dayDate(item.start));
      note =
        'Before Track, Eagle holds amendment documents only. This row is dated by when the document was posted.';
      link = 'Open document';
      break;
    case 'transition': {
      const { fromYear, toYear, date, between } = item.transition;
      field('From', actFull(fromYear));
      field('To', actFull(toYear));
      if (date) {
        field('Date', dayDate(date));
        break;
      }
      field('Date', 'Not recorded', true);
      if (between?.from && between.to) {
        field(
          'Happened between',
          `${dayDate(between.from)} (last ${fromYear} Act date) and ${dayDate(between.to)} (first ${toYear} Act date)`,
        );
      }
      note =
        'Eagle doesn’t store when a project transitions. The dashed box on the lanes covers the period it must have happened in.';
      break;
    }
    case 'branchStart': {
      field('Act', actFull(item.actYear));
      field('Began', item.start ? dayDate(item.start) : 'Not dated', !item.start);
      const first = model.items.find(
        (one): one is CertificateItem => one.kind === 'certificate' && !one.branch,
      );
      if (first) field('First assessment', `${first.title}, ${dayDate(first.start)}`);
      note =
        'A second assessment is drawn as a branch off the main line. It has its own phases and its own outcome.';
      break;
    }
    case 'certificate': {
      field('Act', actFull(item.actYear));
      field(item.outcome === 'issued' ? 'Issued' : 'Decided', dayDate(item.start));
      field('Source', item.source === 'track' ? 'Track' : 'Eagle');
      if (item.certificateNumber) field('Certificate number', item.certificateNumber);
      const active = [...model.items]
        .reverse()
        .find((one) => one.kind === 'certificate' && one.outcome === 'issued');
      const start = model.items.find((one) => one.kind === 'substantialStart');
      if (active === item && start) field('Substantial start', substantialStartLine(start));
      const dated = assessmentTime(model, item.branch);
      if (dated.length && item.whoseTime) {
        whoseTime = true;
        if (model.acts.length > 1 && !item.branch) {
          field('Note', `Time split covers the ${dated[0].actYear} Act phases only`);
        }
      } else {
        note = `Phase dates under the ${item.actYear} Act weren’t recorded, so assessment time can’t be split between EAO and the proponent.`;
      }
      link = item.outcome === 'issued' ? 'Read the certificate' : 'Read the decision';
      break;
    }
    case 'substantialStart':
      field('Deadline', item.deadline ? dayDate(item.deadline) : 'Not recorded', !item.deadline);
      field('Decision', item.decided ? dayDate(item.decided) : 'Not yet decided', !item.decided);
      if (item.decided) field('Outcome', item.outcome);
      note =
        'The certificate holder must substantially start the project by the deadline. EAO decides whether it did.';
      break;
    case 'group':
      field('Received', dayDate(item.start));
      field('Works', String(item.childIds.length));
      note =
        'These works were received on the same day. Eagle doesn’t record whether they were filed together.';
      related = {
        label: 'Received this day',
        items: item.childIds.map(byId).filter((one): one is TimelineItem => !!one),
      };
      break;
    case 'work':
      field('Type', item.workType);
      field('Act', `${actFull(item.actYear)} (Track)`);
      field('Track work', `#${item.trackWorkId}`);
      field('Received', dayDate(item.start));
      field('Status', WORK_STATUS_LABELS[item.status]);
      field('Decision', workDecision(item), !item.decision && !item.endedWithoutDecision);
      if (item.end) {
        const took = span(item.start, item.end);
        field('Ended', took ? `${dayDate(item.end)} · took ${took}` : dayDate(item.end));
      } else {
        field('So far', span(item.start, today));
        if (item.plannedDecision) {
          field('Planned decision', `${dayDate(item.plannedDecision)} (Planned)`);
        }
      }
      link = 'Amendment documents for this project';
      break;
    case 'today':
      field(
        'Current stage',
        item.currentStage ? `${item.currentStage} (not dated)` : 'Not recorded',
        !item.currentStage,
      );
      field('Acts on this project', model.acts.map((act) => act.name).join(' → '));
      field('Works in progress', String(item.openWorks));
      if (model.commentPeriodsFailed) field('Comment periods', 'Could not be read', true);
      if (model.amendmentsFailed) field('Amendment documents', 'Could not be read', true);
      related = {
        label: 'In progress',
        items: model.items.filter((one) => one.kind === 'work' && one.open),
      };
      break;
  }
  const documents = model.documents[item.id];
  if (model.documentsFailed && documents) {
    field('Documents', 'Could not be read', true);
  } else if (documents && !documents.documents.length) {
    field('Documents', model.documentsComplete ? 'None' : 'None among the documents read', true);
  }
  return { fields, note, link, ownHref, related, stages, whoseTime, documents };
}

function workDecision(work: Extract<TimelineItem, { kind: 'work' }>): string {
  if (work.decision) return work.decision === 'approved' ? 'Approved' : 'Refused';
  if (work.endedWithoutDecision) return 'Ended without a decision';
  return work.open ? 'Not yet decided' : 'Not recorded';
}

/** The Documents page filtered to the phase tags of a phase's documents, or undefined for none. */
function phaseDocumentsHref(rows: RowDocuments, routeBase: string | undefined) {
  const ids = [...new Set(rows.documents.flatMap((document) => document.phase ?? []))];
  if (!routeBase || rows.from !== 'phase' || !ids.length) return undefined;
  return `${routeBase}/documents?${new URLSearchParams({ projectPhase: ids.join(',') })}`;
}

/** True when a document this phase row does not list carries one of its tags, so the page those
 * tags filter to holds more than this row. Rows listing the same documents count as one. */
function sharesPhaseTag(model: TimelineModel, rows: RowDocuments): boolean {
  if (rows.from !== 'phase') return false;
  const ids = new Set(rows.documents.flatMap((document) => document.phase ?? []));
  if ([...ids].some((id) => model.droppedPhaseTags.has(id))) return true;
  const own = documentIds(rows);
  return Object.values(model.documents).some(
    (other) =>
      other.from === 'phase' &&
      other.documents.some((document) => !!document.phase && ids.has(document.phase)) &&
      documentIds(other) !== own,
  );
}

function documentIds(rows: RowDocuments): string {
  return rows.documents
    .map((document) => document._id)
    .sort()
    .join();
}

/** The page holding every document a row lists; undefined when no page narrows to just those. */
function allDocumentsHref(
  rows: RowDocuments,
  item: TimelineItem,
  routeBase: string | undefined,
): string | undefined {
  switch (rows.from) {
    case 'phase':
      return phaseDocumentsHref(rows, routeBase);
    case 'certificate': {
      const tab = documentTabByKey(Constants.optionalProjectDocTabs.CERTIFICATE);
      return routeBase && tab ? `${routeBase}/documents/${tab.path}` : undefined;
    }
    case 'commentPeriod':
      return (item.kind === 'milestone' && item.commentPeriod?.href) || undefined;
  }
}

/** A link out of the panel: through the router under `routeBase`, else a plain link. */
function GoLink({
  href,
  routeBase,
  children,
}: {
  href: string | undefined;
  routeBase: string | undefined;
  children: ReactNode;
}) {
  if (!href || !isSafeUrl(href)) return null;
  const className = 'timeline-details__link timeline-details__go';
  return routeBase && href.startsWith(`${routeBase}/`) ? (
    <Link className={className} to={href}>
      {children}
    </Link>
  ) : (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

/** The newest documents of a row, each linked as the documents tables link them. */
function DocumentList({
  rows,
  context,
  allHref,
  counted,
  routeBase,
}: {
  rows: RowDocuments;
  /** The row's title and date, read after the link text by a screen reader. */
  context: string;
  /** Set when the list is capped. */
  allHref: string | undefined;
  /** False when the count is a floor, or the page behind `allHref` holds more than this row. */
  counted: boolean;
  routeBase: string | undefined;
}) {
  const headingId = useId();
  const { documents } = rows;
  return (
    <section
      className="timeline-details__section timeline-details__section--documents"
      aria-labelledby={headingId}
    >
      <h4 id={headingId} className="timeline-details__label">
        Documents
      </h4>
      <ul className="timeline-details__related timeline-details__documents">
        {documents.slice(0, DOCUMENT_CAP).map((document) => (
          <li key={document._id}>
            <DocumentLink document={document}>
              {document.displayName || 'Untitled document'}
            </DocumentLink>
            <span className="timeline-details__aside">{dayDate(document.datePosted)}</span>
          </li>
        ))}
      </ul>
      {allHref && (
        <GoLink href={allHref} routeBase={routeBase}>
          {counted ? `View all ${documents.length} documents` : 'View all documents'}
          <span className="visually-hidden">: {context}</span>
          <i className="material-icons" aria-hidden="true">
            arrow_forward
          </i>
        </GoLink>
      )}
    </section>
  );
}

/** The started phases and proponent time of the main line or the second assessment. */
function assessmentTime(model: TimelineModel, branch: boolean): (PhaseItem | ProponentItem)[] {
  return model.items.filter(
    (one): one is PhaseItem | ProponentItem =>
      (one.kind === 'proponent' || one.kind === 'phase') &&
      one.status !== 'undated' &&
      one.status !== 'planned' &&
      one.branch === branch &&
      !!one.start,
  );
}

function whoseTimeSpan(
  model: TimelineModel,
  items: (PhaseItem | ProponentItem)[],
  branch: boolean,
) {
  const first = items[0];
  const last = items[items.length - 1];
  const prefix = branch
    ? 'second assessment · '
    : model.acts.length > 1
      ? `${first.actYear} Act part · `
      : '';
  const end = last.status === 'current' || !last.end ? 'now' : dayDate(last.end);
  return `${prefix}${dayDate(first.start)} – ${end}`;
}

/** The selected item's details: what it is, its dates, and the sections that explain it. */
export function TimelineDetails({
  model,
  selectedId,
  onSelect,
  hrefFor,
  routeBase,
}: TimelineDetailsProps) {
  const relatedId = useId();
  const item =
    model.items.find((one) => one.id === selectedId) ??
    model.items.find((one) => one.kind === 'today');
  if (!item) return null;

  const { fields, note, link, ownHref, related, stages, whoseTime, documents } = describe(
    item,
    model,
  );
  const chip = chipOf(item, true);
  const allHref =
    documents && documents.documents.length > DOCUMENT_CAP
      ? allDocumentsHref(documents, item, routeBase)
      : undefined;
  // Pre-Track phase names are stage rows, not the List rows Eagle tags, so the tags lead.
  const phaseHref =
    item.kind === 'phase' && documents ? phaseDocumentsHref(documents, routeBase) : undefined;
  const linkHref = link ? (ownHref ?? phaseHref ?? hrefFor?.(item)) : undefined;
  // "View all" already goes there.
  const href = linkHref === allHref ? undefined : linkHref;
  const context = [titleOf(item), whenOf(item)].filter(Boolean).join(', ');
  const split = whoseTime && 'whoseTime' in item && item.whoseTime ? item.whoseTime : null;
  const timeItems = split ? assessmentTime(model, item.branch) : [];
  const linkText = (
    <>
      {link}
      <span className="visually-hidden">: {context}</span>
      <i className="material-icons" aria-hidden="true">
        arrow_forward
      </i>
    </>
  );

  return (
    <aside className="timeline-details" aria-label="Selected item">
      <div>
        <p className="timeline-details__kind">{kindOf(item)}</p>
        <div className="timeline-details__heading">
          <h3 className="timeline-details__title">{titleOf(item)}</h3>
          {chip && <TimelineChip chip={chip} />}
        </div>
      </div>
      <dl className="timeline-details__fields">
        {fields.map((one) => (
          <div key={one.term} className="timeline-details__field">
            <dt>{one.term}</dt>
            <dd className={one.missing ? 'timeline-details__missing' : undefined}>{one.value}</dd>
          </div>
        ))}
      </dl>
      {note && (
        <p className="timeline-details__note">
          <i className="material-icons" aria-hidden="true">
            info
          </i>
          {note}
        </p>
      )}
      {split && timeItems.length > 0 && (
        <WhoseTime
          time={split}
          items={timeItems}
          span={whoseTimeSpan(model, timeItems, item.branch)}
          today={todayOf(model)}
          selectedId={item.id}
          onSelect={onSelect}
        />
      )}
      {item.kind === 'work' && <Milestones milestones={item.milestones} />}
      {stages && <TimelineStages label={stages.label} rows={stages.rows} />}
      {related && related.items.length > 0 && (
        <section className="timeline-details__section" aria-labelledby={relatedId}>
          <h4 id={relatedId} className="timeline-details__label">
            {related.label}
          </h4>
          <ul className="timeline-details__related">
            {related.items.map((one) => (
              <li key={one.id}>
                <button
                  type="button"
                  className="timeline-details__link"
                  onClick={() => onSelect(one.id)}
                >
                  {titleOf(one)}
                </button>
                <span className="timeline-details__aside">{chipOf(one)?.label ?? whenOf(one)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {documents && documents.documents.length > 0 && (
        <DocumentList
          rows={documents}
          context={context}
          allHref={allHref}
          counted={
            model.documentsComplete &&
            documents.from !== 'certificate' &&
            !sharesPhaseTag(model, documents)
          }
          routeBase={routeBase}
        />
      )}
      {item.kind === 'document' ? (
        <DocumentLink
          className="timeline-details__link timeline-details__go"
          document={{
            _id: item.documentId,
            displayName: item.displayName,
            documentFileName: item.documentFileName,
            internalOriginalName: item.internalOriginalName,
            internalMime: item.internalMime,
          }}
        >
          {linkText}
        </DocumentLink>
      ) : (
        <GoLink href={href} routeBase={routeBase}>
          {linkText}
        </GoLink>
      )}
    </aside>
  );
}
