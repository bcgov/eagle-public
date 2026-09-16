import './chip-row.css';

export interface GridChip {
  /** Filter id, or `keywords` for the search chip. Handed back to `onRemove`. */
  id: string;
  /** The one value this chip stands for. Absent for single-value filters. */
  value?: string;
  /** What the reader calls the filter: a column name, or `Search`. */
  label: string;
}

export interface ChipRowProps {
  chips: GridChip[];
  onRemove: (id: string, value?: string) => void;
  onClearAll: () => void;
}

/** Accessible name. Two values of one multi-select filter need different names to be told apart. */
function removeLabel(chip: GridChip): string {
  return chip.value ? `Remove ${chip.label} ${chip.value}` : `Remove ${chip.label}`;
}

/**
 * What the result set has been narrowed by, one chip per value. A multi-select column contributes
 * a chip per picked value so each can be dropped on its own, and the keyword gets a chip too —
 * otherwise "Clear all" quietly throws away something the row never showed.
 */
export function ChipRow({ chips, onRemove, onClearAll }: ChipRowProps) {
  if (chips.length === 0) return null;

  return (
    <div className="display-grid__chips">
      <span className="display-grid__chips-label">Narrowed by</span>
      {chips.map((chip) => (
        <button
          key={`${chip.id}:${chip.value ?? ''}`}
          type="button"
          className="display-grid__chip"
          aria-label={removeLabel(chip)}
          onClick={() => onRemove(chip.id, chip.value)}
        >
          <span aria-hidden="true">
            {chip.value ? (
              <>
                <span className="display-grid__chip-name">{chip.label}:</span> {chip.value}
              </>
            ) : (
              chip.label
            )}
          </span>
          <span aria-hidden="true" className="display-grid__chip-x">
            ✕
          </span>
        </button>
      ))}
      <button type="button" className="display-grid__chips-clear" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
