import { pageCountMessage } from './table-object';

interface PageCountDisplayProps {
  isHidden?: boolean;
  currentPageNum?: number;
  currentPageSize?: number;
  totalItems?: number;
  id?: string;
}

export function PageCountDisplay({
  isHidden = false,
  currentPageNum = 1,
  currentPageSize = 25,
  totalItems = 0,
  id,
}: PageCountDisplayProps) {
  if (isHidden) {
    return null;
  }

  return (
    // Search-as-you-type changes this count without moving focus; a reader hears the new total.
    <div className="lib-page-count-display text-muted" id={id} aria-live="polite">
      <small>{pageCountMessage(totalItems, currentPageNum, currentPageSize)}</small>
    </div>
  );
}
