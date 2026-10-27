import { useId, type CSSProperties } from 'react';
import { time as timeOf } from './timeline-axis';
import { dayDate, duration } from './timeline-list';
import type { PhaseItem, ProponentItem, WhoseTime as Time } from './use-timeline-model';

export interface WhoseTimeProps {
  time: Time;
  /** The dated phases and proponent time of one assessment, in order. */
  items: (PhaseItem | ProponentItem)[];
  /** The span after the heading, e.g. "2018 Act part · 4 Aug 2020 – 14 Mar 2023". */
  span: string;
  /** Today, in ms: where an open phase's bar stops. */
  today: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** EAO and proponent time on one assessment, each phase a bar that selects its row. */
export function WhoseTime({ time, items, span, today, selectedId, onSelect }: WhoseTimeProps) {
  const headingId = useId();
  const ranges = items.map((item) => {
    const start = timeOf(item.start) ?? today;
    return { item, start, end: Math.max(start, Math.min(timeOf(item.end) ?? today, today)) };
  });
  const from = Math.min(...ranges.map((range) => range.start));
  const to = Math.max(...ranges.map((range) => range.end));
  const width = Math.max(to - from, 1);
  const rows = [
    { name: 'EAO', days: time.eaoDays, kind: 'phase' },
    { name: 'Proponent', days: time.proponentDays, kind: 'proponent' },
  ];

  return (
    <section className="timeline-details__section" aria-labelledby={headingId}>
      <h4 id={headingId} className="timeline-details__label">
        Whose time · {span}
      </h4>
      <div className="whose-time">
        {rows.map((row) => (
          <div key={row.name} className="whose-time__row">
            <span className="whose-time__name">{row.name}</span>
            <span className="whose-time__track">
              {ranges
                .filter(({ item }) => item.kind === row.kind)
                .map(({ item, start, end }) => (
                  <button
                    key={item.id}
                    type="button"
                    className="whose-time__bar"
                    aria-label={`${item.title}, ${dayDate(item.start)} – ${item.status === 'current' || !item.end ? 'now' : dayDate(item.end)}`}
                    aria-pressed={item.id === selectedId}
                    onClick={() => onSelect(item.id)}
                    style={
                      {
                        left: `${(((start - from) / width) * 100).toFixed(2)}%`,
                        width: `max(4px, ${(((end - start) / width) * 100).toFixed(2)}%)`,
                        '--bar-fill':
                          item.kind === 'phase' && item.row
                            ? `var(${item.row.token}, ${item.row.hex})`
                            : 'var(--eao-proponent-dark, #6d7274)',
                      } as CSSProperties
                    }
                  />
                ))}
            </span>
            <span className="whose-time__total">{duration(row.days)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
