import { pageNumbers } from './table-object';

interface PaginationProps {
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  ariaLabel?: string;
  onPageChange: (page: number) => void;
}

export function Pagination({
  currentPage = 1,
  pageSize = 10,
  totalItems = 0,
  ariaLabel = 'Pagination navigation',
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) {
    return null;
  }

  function change(pageNum: number): void {
    if (pageNum === currentPage || pageNum < 1 || pageNum > totalPages) {
      return;
    }
    onPageChange(pageNum);
  }

  return (
    <nav aria-label={ariaLabel}>
      <ul className="pagination justify-content-center justify-content-md-end mb-0">
        <li className={`page-item${currentPage === 1 ? ' disabled' : ''}`}>
          <button
            type="button"
            className="page-link"
            disabled={currentPage === 1}
            onClick={() => change(currentPage - 1)}
            aria-label="Previous page"
          >
            &laquo;
          </button>
        </li>

        {pageNumbers(totalPages, currentPage).map((page, index) =>
          page === 'ellipsis' ? (
            <li className="page-item disabled" key={`ellipsis-${index}`}>
              <span className="page-link">…</span>
            </li>
          ) : (
            <li className={`page-item${page === currentPage ? ' active' : ''}`} key={page}>
              <button
                type="button"
                className="page-link"
                onClick={() => change(page)}
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            </li>
          ),
        )}

        <li className={`page-item${currentPage >= totalPages ? ' disabled' : ''}`}>
          <button
            type="button"
            className="page-link"
            disabled={currentPage >= totalPages}
            onClick={() => change(currentPage + 1)}
            aria-label="Next page"
          >
            &raquo;
          </button>
        </li>
      </ul>
    </nav>
  );
}
