import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { timelineHits } from './timeline-axis';
import type { TimelineModel } from './use-timeline-model';
import './timeline-lanes.css';

export interface TimelineSearchProps {
  model: TimelineModel;
  query: string;
  onQueryChange: (query: string) => void;
  /** Called with each hit the search moves to. */
  onSelect: (id: string) => void;
}

export function TimelineSearch({ model, query, onQueryChange, onSelect }: TimelineSearchProps) {
  const hits = useMemo(() => timelineHits(model, query), [model, query]);
  const inputRef = useRef<HTMLInputElement>(null);
  // -1 = no hit selected yet, so the first Enter lands on hit 1.
  const [hitIndex, setHitIndex] = useState(-1);
  // A query typed here selects its first hit; one set from outside (a shared link, back and
  // forward) or a new model only counts until the user moves.
  const [counted, setCounted] = useState({ model, query });
  if (counted.model !== model || counted.query !== query) {
    setCounted({ model, query });
    setHitIndex(-1);
  }

  const jump = (index: number, list = hits) => {
    if (!list.length) return;
    const next = ((index % list.length) + list.length) % list.length;
    setHitIndex(next);
    onSelect(list[next]);
  };
  // Before any move, forward lands on the first hit and back on the last; jump wraps -1 to it.
  const step = (back: boolean) => jump(hitIndex < 0 ? (back ? -1 : 0) : hitIndex + (back ? -1 : 1));
  const change = (value: string) => {
    onQueryChange(value);
    setCounted({ model, query: value });
    jump(0, timelineHits(model, value));
  };
  const clear = () => {
    change('');
    inputRef.current?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      step(event.shiftKey);
    } else if (event.key === 'Escape' && query) {
      event.preventDefault();
      clear();
    }
  };
  const count = !hits.length
    ? 'No matches'
    : hitIndex < 0
      ? `${hits.length} ${hits.length === 1 ? 'match' : 'matches'}`
      : `${hitIndex + 1} of ${hits.length} matches`;
  const active = query.trim().length >= 2;

  return (
    <div role="search" className="timeline-search">
      <label className="timeline-search__field">
        <span className="timeline-lanes__hidden">Search the timeline</span>
        <i className="material-icons timeline-search__icon" aria-hidden="true">
          search
        </i>
        <input
          ref={inputRef}
          type="search"
          className="timeline-search__input"
          placeholder="Search work, acts, phases, documents or dates"
          value={query}
          onChange={(event) => change(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      {/* Mounted before any text so screen readers announce the first count. */}
      <p className="timeline-search__count" role="status">
        {active && count}
      </p>
      {active && (
        <div className="timeline-search__buttons">
          <button
            type="button"
            className="timeline-search__button"
            aria-label="Previous match"
            disabled={!hits.length}
            onClick={() => step(true)}
          >
            <i className="material-icons" aria-hidden="true">
              keyboard_arrow_up
            </i>
          </button>
          <button
            type="button"
            className="timeline-search__button"
            aria-label="Next match"
            disabled={!hits.length}
            onClick={() => step(false)}
          >
            <i className="material-icons" aria-hidden="true">
              keyboard_arrow_down
            </i>
          </button>
          <button
            type="button"
            className="timeline-search__button"
            aria-label="Clear search"
            onClick={clear}
          >
            <i className="material-icons" aria-hidden="true">
              close
            </i>
          </button>
        </div>
      )}
    </div>
  );
}
