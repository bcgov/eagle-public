import { useId, useState } from 'react';
import type { Update } from 'app/api/updates';
import { EngagementLink } from 'app/components/engagement-link';
import { UpdateBody } from 'app/components/update-detail/update-detail';
import { ENGAGE_LABEL, updateMeta } from 'app/components/update-detail/update-meta';
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

/** One published update: its summary, opening in place to the full Update. */
export function UpdateCard({ update }: { update: Update }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const accent = ACCENTS[update.type ?? ''] ?? NEUTRAL_ACCENT;
  const label = update.category ?? update.type;
  const period = update.commentPeriod;
  const commentPeriod =
    period && update.projectId ? `/p/${update.projectId}/cp/${period.id}` : null;

  return (
    <li className="update-card">
      <div className="update-card__accent" style={{ background: `var(${accent})` }}></div>
      <article className="update-card__body">
        <p className="update-card__eyebrow">
          {longDate(update.date)}
          {label && ` · ${label}`}
        </p>
        <h3 className="update-card__headline">{open ? update.headline : update.shortHeadline}</h3>

        {open ? (
          <div id={panelId} className="update-card__full">
            <p className="update-card__meta">{updateMeta(update)}</p>
            <UpdateBody update={update} engagement={false} />
            {/* The card sits on its own project's tab, so only a subject needs naming. */}
            {!update.projectId && update.subject && (
              <p className="update-card__origin">About: {update.subject}</p>
            )}
          </div>
        ) : (
          update.summary && <p className="update-card__summary">{update.summary}</p>
        )}

        <div className="update-card__actions">
          <button
            type="button"
            className="update-card__toggle"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => setOpen((was) => !was)}
          >
            {open ? 'Show less' : 'Read full update'}
            <span className="visually-hidden">: {update.shortHeadline}</span>
          </button>
          {/* One engagement call to action: the Update's own ENGAGE link wins over its period. */}
          {update.engagementUrl ? (
            <EngagementLink isMet metURL={update.engagementUrl} label={ENGAGE_LABEL} />
          ) : (
            period && (
              <EngagementLink
                isMet={period.isMet}
                metURL={period.metURL}
                to={commentPeriod}
                label="View engagement"
              />
            )
          )}
        </div>
      </article>
    </li>
  );
}
