import type { GridColumn } from 'app/components/display-grid/types';
import { Constants } from 'app/utils/constants';
import {
  documentDownloadUrl,
  idToListName,
  longDate,
  openDocumentDownload,
  type DownloadableDocument,
} from 'app/utils/utils';
import './document-columns.css';

/** A project document as the tab's grid reads one. The keys are the index's own field names. */
export interface DocumentRow extends DownloadableDocument {
  datePosted?: string;
  type?: string;
  milestone?: string;
  projectPhase?: string;
  isFeatured?: boolean;
  internalSize?: string;
}

/** Phase name fragment to the stage colour it is tinted with. First match wins. */
const PHASE_TINTS: [string, string][] = [
  ['amendment', '--eao-amendment-light'],
  ['early engagement', '--eao-early-engagement-light'],
  ['readiness', '--eao-readiness-decision-light'],
  ['process planning', '--eao-process-planning-light'],
  ['application development', '--eao-application-development-light'],
  ['pre-ea', '--eao-pre-eac-light'],
  ['pre-application', '--eao-pre-eac-light'],
  ['evaluation', '--eao-pre-eac-light'],
  ['application review', '--eao-pre-eac-light'],
  ['assessment', '--eao-effects-assessment-light'],
  ['referral', '--eao-decision-light'],
  ['decision', '--eao-decision-light'],
];

/** The tint token for a phase, or null for a phase the palette has no colour for. */
function phaseTint(phase: string): string | null {
  const name = phase.toLowerCase();
  return PHASE_TINTS.find(([fragment]) => name.includes(fragment))?.[1] ?? null;
}

/**
 * The five columns every project document tab shows. The values are ids the `List` collection
 * names, so the lists have to be loaded before a cell says anything but a dash.
 */
export function documentColumns(lists: any[], showFeatured: boolean): GridColumn<DocumentRow>[] {
  return [
    {
      key: 'displayName',
      label: 'Name',
      sortable: true,
      link: true,
      href: (row) => documentDownloadUrl(row),
      // The file leaves the app, but the click asks demi-api to presign it rather than following
      // the redirect, which is also what reports the download.
      hrefExternal: true,
      onLinkClick: (row) => openDocumentDownload(row),
      badge: showFeatured
        ? (row) =>
            row.isFeatured === true ? (
              <i className="material-icons document-grid__star" role="img" aria-label="Featured">
                star
              </i>
            ) : null
        : undefined,
      width: '34%',
    },
    {
      key: 'datePosted',
      label: 'Date',
      sortable: true,
      date: true,
      primaryDate: true,
      render: (row) => (row.datePosted === Constants.NO_DATE ? '' : longDate(row.datePosted)),
      width: '14%',
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (row) => idToListName(row.type ?? '', lists),
      width: '17%',
    },
    {
      key: 'milestone',
      label: 'Milestone',
      sortable: true,
      render: (row) => idToListName(row.milestone ?? '', lists),
      width: '17%',
    },
    {
      key: 'projectPhase',
      label: 'Phase',
      sortable: true,
      render: (row) => phasePill(row, lists),
      width: '18%',
    },
  ];
}

/** The phase as a tinted pill. `idToListName` answers '-' for an unnamed phase: that is no phase. */
function phasePill(row: DocumentRow, lists: any[]) {
  const named = idToListName(row.projectPhase ?? '', lists);
  const phase = named && named !== '-' ? named : '';
  if (!phase) return '';
  const tint = phaseTint(phase);
  return (
    <span
      className={`document-grid__phase${tint ? '' : ' document-grid__phase--plain'}`}
      style={tint ? { background: `var(${tint})` } : undefined}
    >
      {phase}
    </span>
  );
}
