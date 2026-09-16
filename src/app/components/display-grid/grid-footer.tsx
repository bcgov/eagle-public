import { pageNumbers } from 'app/components/table/table-object';

/**
 * The grid's own paging row.
 *
 * The shared table's pager and page-size picker carry the look their pages already have, and
 * they drop out of sight when there is a single page. The design keeps both visible at every
 * count - a reader who has narrowed to nothing can still see the page size they are on, and the
 * row does not change height as results come and go - so the grid states them here rather than
 * bending the shared pair under every other table.
 */

interface GridPageSizesProps {
  sizes: readonly number[];
  current: number;
  onChoose: (size: number) => void;
}

/** "Per page", then one chip per size. The chosen size is pressed, not merely tinted. */
export function GridPageSizes({ sizes, current, onChoose }: GridPageSizesProps) {
  return (
    <div className="display-grid__footer-group" role="group" aria-label="Rows per page">
      <span className="display-grid__footer-label">Per page</span>
      {sizes.map((size) => (
        <button
          key={size}
          type="button"
          className={`display-grid__page-chip${
            size === current ? ' display-grid__page-chip--current' : ''
          }`}
          aria-pressed={size === current}
          title={`Show ${size} records per page`}
          onClick={() => onChoose(size)}
        >
          {size}
        </button>
      ))}
    </div>
  );
}

interface GridPagerProps {
  page: number;
  pageSize: number;
  total: number;
  ariaLabel?: string;
  onPageChange: (page: number) => void;
}

/**
 * Previous, the page numbers, next. One page is still a page: the row is drawn at every total,
 * with both arrows disabled, so nothing under the grid moves when the last result goes.
 */
export function GridPager({
  page,
  pageSize,
  total,
  ariaLabel = 'Result pages',
  onPageChange,
}: GridPagerProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), totalPages);

  function change(next: number): void {
    if (next === current || next < 1 || next > totalPages) return;
    onPageChange(next);
  }

  return (
    <nav aria-label={ariaLabel}>
      <ul className="display-grid__pager">
        <li>
          <button
            type="button"
            className="display-grid__page-chip"
            disabled={current === 1}
            aria-label="Previous page"
            onClick={() => change(current - 1)}
          >
            <span aria-hidden="true">&#8249;</span>
          </button>
        </li>
        {pageNumbers(totalPages, current).map((entry, index) =>
          entry === 'ellipsis' ? (
            <li key={`ellipsis-${index}`}>
              <span className="display-grid__page-gap" aria-hidden="true">
                …
              </span>
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                className={`display-grid__page-chip${
                  entry === current ? ' display-grid__page-chip--current' : ''
                }`}
                aria-label={`Go to page ${entry}`}
                aria-current={entry === current ? 'page' : undefined}
                onClick={() => change(entry)}
              >
                {entry}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className="display-grid__page-chip"
            disabled={current >= totalPages}
            aria-label="Next page"
            onClick={() => change(current + 1)}
          >
            <span aria-hidden="true">&#8250;</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
