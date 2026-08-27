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
  id
}: PageCountDisplayProps) {
  if (isHidden) {
    return null;
  }

  return (
    <div className="lib-page-count-display text-muted" id={id}>
      <small>{pageCountMessage(totalItems, currentPageNum, currentPageSize)}</small>
    </div>
  );
}
