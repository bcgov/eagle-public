/**
 * The checkbox column's cell. Copied from `data-table/data-table.tsx` rather than imported: the
 * grid takes its selection from props instead of the bulk-download store, so the old component can
 * be deleted with the old table.
 */
export function SelectCell({
  label,
  checked,
  onChange,
}: {
  /** What the checkbox selects, read out in full: "Select <row name>". */
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <td className="display-grid__cell display-grid__cell--select">
      <input
        type="checkbox"
        className="display-grid__checkbox"
        aria-label={label}
        checked={checked}
        onChange={onChange}
      />
    </td>
  );
}
