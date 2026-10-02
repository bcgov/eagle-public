import { RichTextView } from './rich-text';
import type { MapLine } from './types';
import './route-lines.css';

/** One tile per map line: its swatch, label, length and detail. Doubles as the map's legend. */
export function RouteLineOptions({ lines }: { lines: MapLine[] }) {
  return (
    <dl className="extended-route__options">
      {lines.map((line) => (
        <div key={line.id} className="extended-tile">
          <dt>
            <span
              className={`extended-route__swatch extended-route__swatch--${line.colour}`}
              aria-hidden="true"
            />
            {line.label}
            {line.lengthKm !== undefined && ` · ${line.lengthKm.toLocaleString('en-CA')} km`}
          </dt>
          {line.detail && (
            <dd>
              <RichTextView text={line.detail} />
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
