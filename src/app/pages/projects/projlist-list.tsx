import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from 'app/models/project';
import { LIST_PAGE_SIZE, sheetState, snapSheet, type SheetState } from 'app/state/map-ui';
import { useStore } from 'app/state/store';
import { ProjDetailPopup } from './proj-detail-popup';
import './projlist-list.css';

interface ProjlistListProps {
  /** null while the projects are still loading, so "No projects found" waits for real data. */
  projects: Project[] | null;
  loading: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (project: Project) => void;
  onHover: (id: string | null) => void;
  mobile: boolean;
}

const NEXT_SHEET_STATE = { peek: 'half', half: 'full', full: 'peek' } as const;
const RAISE_SHEET_STATE = { peek: 'half', half: 'full', full: 'full' } as const;
const LOWER_SHEET_STATE = { peek: 'peek', half: 'peek', full: 'half' } as const;

const SKELETON_CARDS = 6;

export function ProjlistList({
  projects,
  loading,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  mobile
}: ProjlistListProps) {
  const [numToLoad, setNumToLoad] = useState(LIST_PAGE_SIZE);
  // The body that just lost the selection stays mounted until its row has shrunk, so closing animates too.
  const [closingId, setClosingId] = useState<string | null>(null);
  const [prevSelectedId, setPrevSelectedId] = useState(selectedId);
  if (prevSelectedId !== selectedId) {
    setPrevSelectedId(selectedId);
    setClosingId(prevSelectedId);
  }
  const sheet = useStore(sheetState);
  const listRef = useRef<HTMLUListElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y0: number; from: SheetState; moved: boolean } | null>(null);
  /** A drag ends in a click as well; this swallows that one click. */
  const draggedRef = useRef(false);
  /** A card tap keeps focus where the finger put it; a pin tap sends focus to the card. */
  const fromCardRef = useRef(false);
  // Live drag offset, applied as a CSS variable so the transform stays in the stylesheet.
  const [dragY, setDragY] = useState(0);

  // A pin can select a project the list has not paged to yet, so its page is revealed too.
  const revealed = useMemo(() => {
    const index = (projects ?? []).findIndex(project => project._id === selectedId);
    return index < 0 ? numToLoad : Math.max(numToLoad, Math.ceil((index + 1) / LIST_PAGE_SIZE) * LIST_PAGE_SIZE);
  }, [projects, selectedId, numToLoad]);

  const loadedApps = useMemo(() => (projects ?? []).slice(0, revealed), [projects, revealed]);
  const pending = projects === null;
  const numResults = useMemo(
    () => (projects ?? []).filter(project => project.centroid?.length === 2).length,
    [projects]
  );

  useEffect(() => {
    const fromCard = fromCardRef.current;
    fromCardRef.current = false;
    if (!selectedId) return;
    const card = listRef.current?.querySelector<HTMLElement>(`[data-project-id="${selectedId}"]`);
    // On mobile the card is the top of an accordion, so it goes to the top of the list.
    // jsdom has no scrollIntoView.
    card?.scrollIntoView?.({ block: mobile ? 'start' : 'nearest' });
    if (mobile && !fromCard) card?.focus();
  }, [selectedId, revealed, mobile]);

  function endDrag(clientY: number): void {
    const drag = dragRef.current;
    const element = sheetRef.current;
    dragRef.current = null;
    draggedRef.current = !!drag?.moved;
    setDragY(0);
    if (!drag?.moved || !element) return;
    // `--sheet-peek` is registered as a <length>, so it resolves to px here.
    const peek = parseFloat(getComputedStyle(element).getPropertyValue('--sheet-peek'));
    sheetState.set(snapSheet(drag.from, clientY - drag.y0, element.offsetHeight, peek));
  }

  return (
    <div
      className="app-list"
      id="applist-list"
      ref={sheetRef}
      data-state={mobile ? sheet : undefined}
      data-dragging={dragY !== 0 || undefined}
      style={dragY ? ({ '--sheet-drag': `${dragY}px` } as React.CSSProperties) : undefined}
      aria-label="List of EAO Projects, limited by filters and bound by map view"
    >
      {mobile && (
        <button
          type="button"
          className="sheet-handle"
          onClick={() => {
            if (draggedRef.current) {
              draggedRef.current = false;
              return;
            }
            sheetState.set(NEXT_SHEET_STATE[sheet]);
          }}
          onKeyDown={event => {
            const next =
              event.key === 'ArrowUp'
                ? RAISE_SHEET_STATE[sheet]
                : event.key === 'ArrowDown'
                  ? LOWER_SHEET_STATE[sheet]
                  : null;
            if (!next) return;
            event.preventDefault();
            sheetState.set(next);
          }}
          onPointerDown={event => {
            if (event.button !== 0) return;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            dragRef.current = { y0: event.clientY, from: sheet, moved: false };
          }}
          onPointerMove={event => {
            const drag = dragRef.current;
            if (!drag) return;
            const dy = event.clientY - drag.y0;
            if (!drag.moved && Math.abs(dy) < 3) return;
            drag.moved = true;
            setDragY(dy);
          }}
          onPointerUp={event => endDrag(event.clientY)}
          onPointerCancel={event => endDrag(event.clientY)}
          aria-expanded={sheet !== 'peek'}
          aria-controls="applist-list"
        >
          <span className="visually-hidden">Resize the project list</span>
        </button>
      )}

      <p className="app-list__count" data-testid="results-count" aria-live="polite" aria-atomic="true">
        {numResults > 0
          ? `${numResults} ${numResults === 1 ? 'project' : 'projects'} in view`
          : loading
            ? ''
            : 'No projects in view'}
      </p>

      <div className="app-list__scroll-container">
        {pending && <span className="visually-hidden">Loading projects</span>}

        {!loading && projects !== null && loadedApps.length === 0 && (
          <div className="no-results">
            <strong>No projects found</strong>
          </div>
        )}

        <ul className="app-list__list" ref={listRef} aria-busy={pending || undefined}>
          {pending &&
            Array.from({ length: SKELETON_CARDS }, (_, index) => (
              <li
                key={`skeleton-${index}`}
                className="app-card app-card--skeleton placeholder-wave"
                data-testid="project-card-skeleton"
                aria-hidden="true"
              >
                <span className="app-card__name">
                  <span className="placeholder col-9"></span>
                </span>
                <span className="app-card__proponent">
                  <span className="placeholder col-5"></span>
                </span>
                <span className="app-card__meta">
                  <span className="placeholder col-7"></span>
                </span>
                <span className="app-card__meta">
                  <span className="placeholder col-4"></span>
                </span>
                <span className="app-card__phase">
                  <span className="placeholder"></span>
                </span>
              </li>
            ))}
          {loadedApps.map(item => {
            const open = selectedId === item._id;
            return (
              <li key={item._id}>
                <button
                  type="button"
                  className={`app-card${hoveredId === item._id ? ' is-hovered' : ''}`}
                  data-testid="project-card"
                  data-project-id={item._id}
                  aria-current={open ? 'true' : undefined}
                  aria-expanded={mobile ? open : undefined}
                  aria-controls={mobile ? `project-body-${item._id}` : undefined}
                  onClick={() => {
                    fromCardRef.current = true;
                    onSelect(item);
                  }}
                  onMouseEnter={() => onHover(item._id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={mobile ? undefined : () => onHover(item._id)}
                  onBlur={mobile ? undefined : () => onHover(null)}
                >
                  <span className="app-card__name">{item.name}</span>
                  <span className="app-card__proponent">{item.proponent?.name || 'Unknown Client'}</span>
                  <span className="app-card__meta">
                    {item.type || item.sector ? `${item.type} / ${item.sector}` : 'Not Available'}
                  </span>
                  <span className="app-card__meta">{item.region || 'Not Available'}</span>
                  <span className="app-card__phase">{item.currentPhaseName?.name || 'Unknown'}</span>
                </button>
                {/* Always rendered so `aria-controls` resolves and the open row animates from 0fr. */}
                {mobile && (
                  <div
                    className="app-card__body"
                    id={`project-body-${item._id}`}
                    data-open={open || undefined}
                    inert={!open || undefined}
                    onTransitionEnd={event => {
                      if (event.target === event.currentTarget && closingId === item._id) setClosingId(null);
                    }}
                  >
                    <div>{(open || closingId === item._id) && <ProjDetailPopup project={item} variant="inline" />}</div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {loadedApps.length > 0 && loadedApps.length < (projects?.length ?? 0) && (
          <div className="load-more">
            <button
              className="btn btn-primary"
              type="button"
              title="Load more projects"
              onClick={() => setNumToLoad(revealed + LIST_PAGE_SIZE)}
              disabled={loading}
            >
              {loading && <i className="spinner rotating"></i>}
              <span>{loading ? 'Loading...' : 'Load More'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
