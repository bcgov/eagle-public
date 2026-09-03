import { useLayoutEffect, useRef, useState } from 'react';
import type { TableRowProps } from 'app/components/table/table-object';
import { openDocument } from 'app/api/api';
import { longDate } from 'app/utils/utils';

export function CommentsTableRow({ rowData }: TableRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const truncatedRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const truncated = truncatedRef.current;
    if (!truncated) return;

    // Line clamping hides the overflow, so measure the unclamped height to decide whether a
    // "Read More" button is warranted at all.
    truncated.style.webkitLineClamp = 'unset';
    const fullHeight = truncated.scrollHeight;
    truncated.style.webkitLineClamp = '';

    setHasOverflow(fullHeight > truncated.clientHeight);
  }, []);

  return (
    <tr className="border" style={{ cursor: 'default' }}>
      <td className="p-3">
        <div className="mb-2">
          {rowData.author && rowData.Anonymous !== true && (
            <b>
              {rowData.author}
              {rowData.location && <span>, {rowData.location}</span>}
            </b>
          )}
          {/* eagle-api drops the author field entirely on anonymous comments. */}
          {(!rowData.author || rowData.Anonymous) && <b>Anonymous</b>}
        </div>

        <div className="text-muted mb-3">{longDate(rowData.dateAdded) || '-'}</div>

        {rowData.comment && (
          <div>
            {expanded && <p>{rowData.comment}</p>}
            {!expanded && (
              <p className="comment-truncated" ref={truncatedRef}>
                {rowData.comment}
              </p>
            )}
            {!expanded && hasOverflow && (
              <button
                className="btn btn-link clickable p-0"
                onClick={(event) => {
                  setExpanded(true);
                  event.stopPropagation();
                }}
              >
                Read More
              </button>
            )}
            {expanded && (
              <button
                className="btn btn-link clickable p-0"
                onClick={(event) => {
                  setExpanded(false);
                  event.stopPropagation();
                }}
              >
                Read Less
              </button>
            )}
          </div>
        )}

        {rowData.documents && rowData.documents.length > 0 && (
          <div className="mt-2">
            {rowData.documents.map((file: any) => (
              <div
                key={file._id}
                className="attachment clickable"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  openDocument(file);
                  event.stopPropagation();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    openDocument(file);
                    event.stopPropagation();
                  }
                }}
              >
                <i className="material-icons">attach_file</i>
                {file.internalOriginalName}
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
