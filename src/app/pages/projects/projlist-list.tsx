import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Project } from 'app/models/project';
import { isClosed, isNotOpen, isNotStarted, isOpen } from 'app/api/commentperiod';
import { LIST_PAGE_SIZE } from 'app/state/map-ui';
import './projlist-list.css';

interface ProjlistListProps {
  /** null while the projects are still loading, so "No projects found" waits for real data. */
  projects: Project[] | null;
  loading: boolean;
  currentAppId: string | null;
  onToggleCurrentApp: (project: Project) => void;
}

/** Angular's `titlecase` pipe: first letter of each word up, the rest down. */
function titleCase(value: string | undefined): string {
  return (value ?? '').replace(/\w\S*/g, word => word[0].toUpperCase() + word.slice(1).toLowerCase());
}

/** Angular's `date:'MMM d'`, e.g. "Aug 27". */
function shortDate(value: string | Date | undefined | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Angular's `date:'mediumDate'`, e.g. "Aug 27, 2026". */
function mediumDate(value: string | Date | undefined | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function badgeClass(period: any): string {
  if (isOpen(period)) return 'badge-success';
  if (isClosed(period)) return 'badge-danger';
  if (isNotStarted(period)) return 'badge-primary';
  if (isNotOpen(period)) return 'badge-secondary';
  return '';
}

export function ProjlistList({ projects, loading, currentAppId, onToggleCurrentApp }: ProjlistListProps) {
  const [numToLoad, setNumToLoad] = useState(LIST_PAGE_SIZE);

  const loadedApps = useMemo(() => (projects ?? []).slice(0, numToLoad), [projects, numToLoad]);
  const numResults = useMemo(
    () => (projects ?? []).filter(project => project.centroid?.length === 2).length,
    [projects]
  );

  return (
    <div
      className="app-list app-list__container"
      id="applist-list"
      aria-label="List of EAO Projects, limited by filters and bound by map view"
    >
      <div className="app-list__body">
        {loading && loadedApps.length === 0 && (
          <div className="spinner-container">
            <div className="spinner spinner-sm rotating"></div>
            <span className="spinner__msg">Loading projects...</span>
          </div>
        )}

        {!loading && projects !== null && loadedApps.length === 0 && (
          <div className="no-results">
            <strong>No projects found</strong>
          </div>
        )}

        <div className="app-list__scroll-container">
          <ul className="app-list__list">
            {loadedApps.map(item => (
              <li
                key={item._id}
                className={`app-card list-group-item${currentAppId === item._id ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={event => {
                  onToggleCurrentApp(item);
                  event.stopPropagation();
                }}
                onKeyDown={event => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  onToggleCurrentApp(item);
                  event.stopPropagation();
                }}
              >
                <ul className="app-card__details">
                  <li>
                    <span className="key">Applicant</span>
                    <span className="value client-name">{item.client || 'Unknown Client'}</span>
                  </li>
                  <li>
                    <span className="key">Purpose / Subpurpose</span>
                    <span className="value">
                      {(item.purpose || item.subpurpose) && (
                        <span>
                          {titleCase(item.purpose)} / {titleCase(item.subpurpose)}
                        </span>
                      )}
                      {(!item.purpose || !item.subpurpose) && <span>Not Available</span>}
                    </span>
                  </li>
                  <li>
                    <span className="key">Disposition Transaction</span>
                    <span className="value">{item.tantalisID}</span>
                  </li>
                  <li>
                    <span className="key">EAO Project #</span>
                    <span className="value">{item.clFile || 'Not Available'}</span>
                  </li>
                  <li>
                    <span className="key">Status</span>
                    <span className="value">{item.currentPhaseName?.name || 'Unknown'}</span>
                  </li>
                </ul>

                <div className="app-card__actions d-flex justify-content-between">
                  <div className="badges">
                    <div className={`comment-status-badge badge ${badgeClass(item.currentPeriod)}`}>
                      <span>{item.cpStatus}</span>
                      {isNotStarted(item.currentPeriod) && (
                        <span className="date">:&nbsp;{mediumDate(item.currentPeriod?.startDate)}</span>
                      )}
                      {isClosed(item.currentPeriod) && (
                        <span className="date">:&nbsp;{mediumDate(item.currentPeriod?.endDate)}</span>
                      )}
                      {isOpen(item.currentPeriod) && (
                        <span className="date">
                          :&nbsp;{shortDate(item.currentPeriod?.startDate)} - {shortDate(item.currentPeriod?.endDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    className="app-details-link btn"
                    onClick={event => event.stopPropagation()}
                    to={`/p/${item._id}`}
                    title="Go to project details"
                  >
                    <i className="material-icons md-24">arrow_forward</i>
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {loadedApps.length > 0 && loadedApps.length < (projects?.length ?? 0) && (
            <div className="load-more">
              <button
                className="btn btn-primary"
                type="button"
                title="Load more projects"
                onClick={event => {
                  setNumToLoad(current => current + LIST_PAGE_SIZE);
                  event.stopPropagation();
                }}
                disabled={loading}
              >
                {loading && <i className="spinner rotating"></i>}
                <span>{loading ? 'Loading...' : 'Load More'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="app-list__options">
        <div className="text-end mb-1">{numResults > 0 ? `${numResults} results on map` : 'No results'}</div>
      </div>
    </div>
  );
}
