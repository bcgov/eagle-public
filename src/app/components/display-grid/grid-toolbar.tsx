import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ADVANCED_FILTERS_ID } from './advanced-filters';
import type { GridColumn } from './types';

/** Long enough to read the confirmation, short enough that the button is itself again. */
const COPIED_MS = 2000;

interface GridToolbarProps<Row> {
  /** What the rows are, for the count: "1–25 of 340 documents". */
  noun: string;
  page: number;
  pageSize: number;
  total: number;
  /** Record-type or document-scope switch, owned by the page. */
  scope?: ReactNode;
  columns?: GridColumn<Row>[];
  hiddenColumns?: string[];
  onToggleColumn?: (key: string) => void;
  /** How many advanced filters are applied; drives the badge on More filters. */
  filterCount?: number;
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  selectedCount?: number;
  onClearSelection?: () => void;
  /** Selection is documents-only, and what a download means belongs to the page, not the grid. */
  onDownload?: () => void;
  downloadDisabled?: boolean;
  downloadTitle?: string;
}

export function GridToolbar<Row>({
  noun,
  page,
  pageSize,
  total,
  scope,
  columns,
  hiddenColumns = [],
  onToggleColumn,
  filterCount = 0,
  panelOpen = false,
  onTogglePanel,
  selectedCount = 0,
  onClearSelection,
  onDownload,
  downloadDisabled = false,
  downloadTitle,
}: GridToolbarProps<Row>) {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const selectionActive = selectedCount > 0;
  const lastShown = Math.min(page * pageSize, total);
  // A page past the end of the result set would otherwise read "51-5 of 5".
  const firstShown = total === 0 ? 0 : Math.min((page - 1) * pageSize + 1, lastShown);
  const countText = selectionActive
    ? `${selectedCount.toLocaleString('en-CA')} selected`
    : total === 0
      ? `No ${noun}`
      : `${firstShown.toLocaleString('en-CA')}–${lastShown.toLocaleString('en-CA')} of ${total.toLocaleString('en-CA')} ${noun}`;

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  useEffect(() => {
    if (!columnsOpen) return;
    function onPointerDown(event: PointerEvent): void {
      if (columnsRef.current?.contains(event.target as Node)) return;
      setColumnsOpen(false);
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setColumnsOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [columnsOpen]);

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // A blocked clipboard leaves the button as it was: claiming a copy that did not happen is worse.
      return;
    }
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <div className={`display-grid__bar${selectionActive ? ' display-grid__bar--selected' : ''}`}>
      <div className="display-grid__bar-group">
        {/* The one live region: the count is what every control in this bar changes. */}
        <p className="display-grid__count" role="status">
          {countText}
        </p>
        {scope}
        {selectionActive && (
          <button
            type="button"
            className="display-grid__clear"
            onClick={() => onClearSelection?.()}
          >
            <i className="material-icons" aria-hidden="true">
              close
            </i>
            Clear
          </button>
        )}
      </div>

      <div className="display-grid__bar-group display-grid__bar-group--tools">
        {selectionActive ? (
          <button
            type="button"
            className="display-grid__download"
            disabled={downloadDisabled}
            title={downloadTitle}
            onClick={() => onDownload?.()}
          >
            {/* The bundled Material Icons build has no `download`; this is the app's glyph. */}
            <i className="material-icons" aria-hidden="true">
              cloud_download
            </i>
            {`Download ${selectedCount.toLocaleString('en-CA')}`}
          </button>
        ) : (
          <>
            {onTogglePanel && (
              <button
                type="button"
                className={`display-grid__tool${filterCount ? ' display-grid__tool--on' : ''}${
                  panelOpen ? ' display-grid__tool--open' : ''
                }`}
                data-tour="more"
                aria-expanded={panelOpen}
                aria-controls={ADVANCED_FILTERS_ID}
                onClick={onTogglePanel}
              >
                <i className="material-icons" aria-hidden="true">
                  filter_list
                </i>
                More filters
                {filterCount > 0 && <span className="display-grid__badge">{filterCount}</span>}
              </button>
            )}

            {columns && columns.length > 0 && (
              <div className="display-grid__menu-anchor" ref={columnsRef}>
                <button
                  type="button"
                  className={`display-grid__tool${columnsOpen ? ' display-grid__tool--open' : ''}`}
                  data-tour="columns"
                  aria-expanded={columnsOpen}
                  onClick={() => setColumnsOpen((open) => !open)}
                >
                  <i className="material-icons" aria-hidden="true">
                    view_column
                  </i>
                  Columns
                </button>
                {columnsOpen && (
                  <div className="display-grid__menu" role="group" aria-label="Columns shown">
                    <p className="display-grid__menu-title">Columns shown</p>
                    {columns.map((column) => (
                      <label key={column.key} className="display-grid__option">
                        <input
                          type="checkbox"
                          // The link column cannot be hidden: without it a row has nothing to open.
                          checked={column.locked || !hiddenColumns.includes(column.key)}
                          disabled={column.locked}
                          onChange={() => onToggleColumn?.(column.key)}
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className={`display-grid__tool${copied ? ' display-grid__tool--copied' : ''}`}
              data-tour="copy"
              onClick={() => void copyLink()}
            >
              <i className="material-icons" aria-hidden="true">
                {copied ? 'check' : 'link'}
              </i>
              {copied ? 'Link copied' : 'Copy link to this view'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
