import { Link } from 'react-router';
import { safeHtml } from 'app/utils/safe-html';
import { isSafeUrl } from 'app/utils/safe-url';
import { sanitizeWordHtml } from 'app/utils/word-html-sanitizer';
import { longDate } from 'app/utils/utils';
import './update-card.css';

/** Activity type to the stage colour its accent takes. Anything else gets the neutral token. */
const ACCENTS: Record<string, string> = {
  'Public Comment Period': '--eao-early-engagement-dark',
  'Project Notification Public Comment Period': '--eao-early-engagement-dark',
  News: '--eao-process-planning-dark',
  'Project Notification News': '--eao-process-planning-dark',
};

const NEUTRAL_ACCENT = '--eao-proponent-dark';

/** The file name a document URL ends in, or null when the URL points at a folder or a page. */
function fileName(url: string): string | null {
  const path = url.split(/[?#]/)[0];
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (!/\.[a-z0-9]{2,5}$/i.test(last)) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

export interface UpdateRecord {
  _id?: string;
  headline?: string;
  content?: string;
  dateAdded?: string;
  type?: string;
  documentUrl?: string;
  pcp?: { _id?: string; isMet?: boolean; metURL?: string };
  project?: { _id?: string };
}

/** One published update: a colour-coded card of what changed, and the files it points at. */
export function UpdateCard({ update }: { update: UpdateRecord }) {
  const accent = ACCENTS[update.type ?? ''] ?? NEUTRAL_ACCENT;
  const document = update.documentUrl && isSafeUrl(update.documentUrl) ? update.documentUrl : null;
  const commentPeriod =
    update.pcp?._id && update.project?._id ? `/p/${update.project._id}/cp/${update.pcp._id}` : null;
  const externalPeriod = update.pcp?.isMet && isSafeUrl(update.pcp.metURL ?? '');

  return (
    <li className="update-card">
      <div className="update-card__accent" style={{ background: `var(${accent})` }}></div>
      <div className="update-card__body">
        <p className="update-card__eyebrow">
          {longDate(update.dateAdded)}
          {update.type && ` · ${update.type}`}
        </p>
        <h3 className="update-card__headline">{update.headline}</h3>
        {update.content && (
          <div
            className="update-card__content"
            dangerouslySetInnerHTML={safeHtml(sanitizeWordHtml(update.content))}
          ></div>
        )}

        {(document || commentPeriod || externalPeriod) && (
          <div className="update-card__files">
            <p className="update-card__files-label">Referenced by this update</p>
            <ul className="update-card__file-list">
              {document && (
                <li>
                  <a href={document} target="_blank" rel="noopener noreferrer">
                    <i className="material-icons" aria-hidden="true">
                      insert_drive_file
                    </i>
                    {fileName(document) ?? 'Project documents'}
                  </a>
                </li>
              )}
              {externalPeriod ? (
                <li>
                  <a href={update.pcp!.metURL} target="_blank" rel="noopener noreferrer">
                    View engagement
                  </a>
                </li>
              ) : (
                commentPeriod && (
                  <li>
                    <Link to={commentPeriod}>View engagement</Link>
                  </li>
                )
              )}
            </ul>
          </div>
        )}
      </div>
    </li>
  );
}
