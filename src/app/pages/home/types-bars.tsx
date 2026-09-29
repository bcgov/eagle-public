import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { layoutBars, subKey, typeKey, type BarRow, type BarSegment } from './types-layout';
import { projectsLabel, type TypeNode } from './types-tree';
import './types-bars.css';

export interface TypesBarsProps {
  tree: readonly TypeNode[];
  /** Zoomed type, or null for the top level. */
  type: string | null;
  /** Hover key shared with the treemap: `f:<type>` or `t:<type>:<sub>`. */
  hover: string | null;
  onHover: (key: string | null) => void;
  /** Link target for a level, from useTypeLevel. */
  hrefFor: (type: string, subType: string | null) => string;
}

const rowKey = (row: BarRow) =>
  row.subType === null ? typeKey(row.type) : subKey(row.type, row.subType);

const rowLabel = (row: BarRow) => `${row.name}, ${projectsLabel(row.count)}. Show ${row.opens}`;

const delayVar = (ms: number) => ({ '--delay': `${ms}ms` }) as CSSProperties;

/** Name + count rows over a proportional bar per type, or per sub-type once a type is chosen. */
export function TypesBars({ tree, type, hover, onHover, hrefFor }: TypesBarsProps) {
  const rows = layoutBars(tree, type);
  const segmentLit = (s: BarSegment) =>
    hover === typeKey(s.type) || hover === subKey(s.type, s.subType);

  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none`
    <ul role="list" className="home-types__bars">
      {rows.map((row) => {
        const key = rowKey(row);
        const classes = [
          'home-types__bar-row',
          `home-types__bar-row--${row.kind}`,
          hover === key ? 'home-types__bar-row--hover' : '',
        ];
        return (
          <li
            key={row.key}
            className={classes.filter(Boolean).join(' ')}
            style={delayVar(row.delay)}
          >
            <Link
              to={hrefFor(row.type, row.subType)}
              preventScrollReset
              className="home-types__bar-link"
              aria-label={rowLabel(row)}
              onMouseEnter={() => onHover(key)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(key)}
              onBlur={() => onHover(null)}
            >
              <span className="home-types__bar-label">
                <span
                  className="home-types__bar-swatch"
                  style={{ background: row.fill }}
                  aria-hidden="true"
                />
                <span className="home-types__bar-name">{row.name}</span>
              </span>
              <span
                className="home-types__bar-lane"
                style={
                  {
                    '--fill': `${Math.max(0, ...row.segments.map((s) => s.left + s.width))}%`,
                  } as CSSProperties
                }
                aria-hidden="true"
              >
                {row.segments.map((s) => (
                  <span
                    key={s.key}
                    className={`home-types__bar-seg${segmentLit(s) ? ' home-types__bar-seg--hover' : ''}`}
                    style={{ left: `${s.left}%`, width: `${s.width}%`, background: s.fill }}
                  />
                ))}
              </span>
              <span className="home-types__bar-count">{row.count}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
