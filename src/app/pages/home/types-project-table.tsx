import { useId, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { projectsLabel, type ProjectRow, type SubNode } from './types-tree';

export interface TypesProjectTableProps {
  sub: SubNode;
  /** The sub-type's colour, for the swatch beside each name. */
  fill: string;
}

/** Rows whose name, region or phase holds the typed text, ignoring case. */
function matching(projects: readonly ProjectRow[], text: string): readonly ProjectRow[] {
  const needle = text.trim().toLocaleLowerCase();
  if (!needle) return projects;
  return projects.filter((p) =>
    [p.name, p.region, p.phase].some((field) => field.toLocaleLowerCase().includes(needle)),
  );
}

/** One sub-type's projects, with a quick filter; each row opens its project page. */
export function TypesProjectTable({ sub, fill }: TypesProjectTableProps) {
  const filterId = useId();
  const [text, setText] = useState('');
  // Rows enter with a stagger once; after the first keystroke, rows a filter brings back must not replay it.
  const [typed, setTyped] = useState(false);
  const rows = matching(sub.projects, text);
  const filtered = text.trim() !== '';

  return (
    <div className="home-types__projects">
      <div className="home-types__filter-row">
        <div className="home-types__filter">
          <label htmlFor={filterId}>Filter projects</label>
          <input
            id={filterId}
            type="search"
            className="form-control"
            value={text}
            placeholder="Filter by name, region or phase"
            onChange={(event) => {
              setText(event.target.value);
              setTyped(true);
            }}
          />
        </div>
        <p className="home-types__shown" aria-live="polite">
          {filtered && `${rows.length} of ${projectsLabel(sub.count)} shown`}
        </p>
      </div>

      <table className={`home-types__table${typed ? ' home-types__table--settled' : ''}`}>
        <caption className="visually-hidden">{sub.name} projects</caption>
        <colgroup>
          <col className="home-types__col-name" />
          <col className="home-types__col-region" />
          <col className="home-types__col-phase" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Region</th>
            <th scope="col">Phase</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="home-types__empty" colSpan={3}>
                No projects match.
              </td>
            </tr>
          ) : (
            rows.map((p, i) => (
              <tr key={p.id} style={{ '--row-index': Math.min(i, 12) } as CSSProperties}>
                <td>
                  <span
                    className="home-types__swatch"
                    style={{ background: fill }}
                    aria-hidden="true"
                  />
                  <Link className="home-types__project" to={`/p/${encodeURIComponent(p.id)}`}>
                    {p.name}
                  </Link>
                </td>
                <td>{p.region}</td>
                <td>{p.phase}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
