import { Link } from 'react-router';
import { Constants } from 'app/utils/constants';
import { documentDownloadUrl, longDate, openDocumentDownload } from 'app/utils/utils';
import { safeHtml } from 'app/utils/safe-html';
import './content-result.css';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

/**
 * eagle-search escapes the document text before turning its highlight sentinels into `<mark>`, so
 * the snippet is already safe. Angular's sanitizer then kept `<mark>` and stripped anything else;
 * React's `dangerouslySetInnerHTML` strips nothing, so do that one job here rather than lose it.
 */
function markOnly(snippet: string): string {
  return String(snippet ?? '')
    .replace(/[&<>]/g, (character) => ESCAPES[character]!)
    .replace(/&lt;(\/?)mark&gt;/g, '<$1mark>');
}

/** Matches only. There is no trustworthy page count to pair it with. */
function matchSummary(result: any): string {
  const matches = result.matchCount || 0;
  return `${matches} match${matches === 1 ? '' : 'es'}`;
}

/** One content-search result: a DOCUMENT, with the passages that matched inside it. */
export function ContentResult({ result }: { result: any }) {
  const snippets: string[] = result.snippets ?? [];

  return (
    <article className="content-result">
      <h3 className="result-title">
        {/*
          Same href as the Download button below, so middle-click and copy-link work. Deliberately
          no `#page=N` fragment: a chunk's `pageNumber` is a passage SEQUENCE number, not a PDF
          page, so every link built from it pointed somewhere arbitrary.
        */}
        <a
          href={documentDownloadUrl({ _id: result._id, displayName: result.documentName })}
          target="_blank"
          rel="noopener"
        >
          {result.documentName || 'Untitled document'}
        </a>
      </h3>

      <p className="result-meta">
        {result.project?._id ? (
          <Link to={`/p/${result.project._id}/project-details`}>{result.project.name}</Link>
        ) : (
          result.project?.name && <span>{result.project.name}</span>
        )}
        {result.documentType && (
          <>
            <span className="sep">·</span>
            <span>{result.documentType}</span>
          </>
        )}
        {result.milestone && (
          <>
            <span className="sep">·</span>
            <span>{result.milestone}</span>
          </>
        )}
        {result.datePosted && result.datePosted !== Constants.NO_DATE && (
          <>
            <span className="sep">·</span>
            <span>{longDate(result.datePosted)}</span>
          </>
        )}
        <span className="sep">·</span>
        <span className="match-count">{matchSummary(result)}</span>
      </p>

      {snippets.map((snippet, index) => (
        <p
          className="result-snippet"
          key={index}
          dangerouslySetInnerHTML={safeHtml(markOnly(snippet))}
        />
      ))}
      {snippets.length === 0 && (
        // Azure returns no highlights for a fuzzy or wildcard match. An empty card reads as a bug.
        <p className="result-snippet no-snippet">Match found in the document text.</p>
      )}

      <div className="result-actions">
        <button
          type="button"
          className="result-download"
          onClick={() =>
            openDocumentDownload({ _id: result._id, displayName: result.documentName })
          }
          aria-label={`Download ${result.documentName}`}
        >
          <span className="material-icons" aria-hidden="true">
            cloud_download
          </span>{' '}
          Download
        </button>
      </div>
    </article>
  );
}
