import { useState, type FormEvent } from 'react';
import { useNavigate, useNavigation } from 'react-router';
import { RECORD_TYPES, type RecordType } from 'app/components/display-grid/use-grid-url-state';
import { recordConfig } from 'app/pages/search/types';
import { searchUrl } from 'app/routes/legacy-search';

/**
 * The home page's one keyword search. It shows no results: submit hands the keyword and record
 * type to /search, which owns the result list and its filters.
 */
export function HomeSearch() {
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [keyword, setKeyword] = useState('');
  const [record, setRecord] = useState<RecordType>('projects');
  const [status, setStatus] = useState('');

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const typed = keyword.trim();
    setStatus(typed ? `Opening search for “${typed}” …` : 'Opening search …');
    void navigate(searchUrl(record, typed));
  }

  // /search has a loader, so the router holds this page up while it runs; the spinner lasts that long.
  const pending = status !== '' && navigation.state !== 'idle';

  return (
    <div className="home-search">
      <form className="home-search__form" role="search" onSubmit={submit}>
        <div className="home-search__field">
          <i className="material-icons home-search__icon" aria-hidden="true">
            search
          </i>
          <label className="home-search__label">
            <span className="visually-hidden">Search projects and documents by keyword</span>
            <input
              className="home-search__input"
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Project name, proponent, document title or text"
            />
          </label>
        </div>
        <label className="home-search__label">
          <span className="visually-hidden">What to search</span>
          <select
            className="home-search__select"
            value={record}
            onChange={(event) => setRecord(event.target.value as RecordType)}
          >
            {/* The /search type pills, same order and names. There is no "everything" search. */}
            {RECORD_TYPES.map((id) => (
              <option key={id} value={id}>
                {recordConfig(id).label}
              </option>
            ))}
          </select>
        </label>
        <button className="home-search__submit" type="submit">
          Search
        </button>
      </form>
      {/* Mounted and never hidden, so a screen reader is already listening when the text lands. */}
      <p className={`home-search__status${status ? ' home-search__status--on' : ''}`} role="status">
        {pending && (
          <span
            className="spinner-border spinner-border-sm home-search__spinner"
            aria-hidden="true"
          />
        )}
        {status}
      </p>
    </div>
  );
}
