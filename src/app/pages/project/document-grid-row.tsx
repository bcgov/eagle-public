import type { TableRowProps } from 'app/components/table/table-object';
import { useDocumentRow } from 'app/components/table/document-row';
import { DocumentLink } from 'app/components/table/document-link';
import { SelectCell } from 'app/components/data-table/data-table';
import { Constants } from 'app/utils/constants';
import { idToListName, longDate } from 'app/utils/utils';
import './document-grid-row.css';

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

export function DocumentGridRow({ rowData, tableData }: TableRowProps) {
  const lists: any[] = tableData.data?.lists ?? [];
  const showFeatured = !!tableData.data?.showFeatured;
  const { selectable, selected, rowProps } = useDocumentRow(rowData, tableData);
  const phase = idToListName(rowData.projectPhase, lists);
  const tint = phase ? phaseTint(phase) : null;

  return (
    <tr {...rowProps} className={`data-table__row${selected ? ' data-table__row--selected' : ''}`}>
      {selectable && <SelectCell rowData={rowData} tableId={tableData.tableId} />}

      <td data-label="Name" className="data-table__cell document-grid__name">
        {showFeatured && rowData.isFeatured === true && (
          <i className="material-icons document-grid__star" role="img" aria-label="Featured">
            star
          </i>
        )}
        <DocumentLink document={rowData}>{rowData.displayName}</DocumentLink>
      </td>

      <td data-label="Date" className="data-table__cell data-table__cell--date">
        {rowData.datePosted !== Constants.NO_DATE && longDate(rowData.datePosted)}
      </td>

      <td data-label="Type" className="data-table__cell">
        {idToListName(rowData.type, lists)}
      </td>

      <td data-label="Milestone" className="data-table__cell">
        {idToListName(rowData.milestone, lists)}
      </td>

      <td data-label="Phase" className="data-table__cell">
        {phase && (
          <span
            className={`document-grid__phase${tint ? '' : ' document-grid__phase--plain'}`}
            style={tint ? { background: `var(${tint})` } : undefined}
          >
            {phase}
          </span>
        )}
      </td>
    </tr>
  );
}
