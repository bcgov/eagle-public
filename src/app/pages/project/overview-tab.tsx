import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { track } from 'app/analytics/analytics';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { SubscribePopover } from 'app/components/subscribe-popover';
import { useTable } from 'app/components/table/use-table';
import { getNotifyApi } from 'app/config/config';
import type { Project } from 'app/models/project';
import { newlines } from 'app/utils/newlines';
import { htmlToText, safeHtml } from 'app/utils/safe-html';
import { isSafeUrl, openExternal } from 'app/utils/safe-url';
import { legislationLink, longDate } from 'app/utils/utils';
import { FeaturedDocuments } from './featured-documents';
import { Pins } from './pins';
import { useProjectContext } from './project-context';
import './overview-tab.css';

const BC_ENERGY_REGULATOR_LINK = 'https://www.bc-er.ca/data-reports/data-centre/';
const OPERATIONS_EMAIL = 'EAO.operations@gov.bc.ca';
const COMPLIANCE_EMAIL = 'EAO.compliance@gov.bc.ca';
const COMPLIANCE_PHONE = '250-387-0131';

/** Angular's `date:'MMMM d'`, e.g. "August 27". */
function monthAndDay(value: Date | string): string {
  return new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <i className="material-icons overview-tab__external-icon" aria-hidden="true">
        open_in_new
      </i>
      <span className="visually-hidden">(opens in new tab)</span>
    </a>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overview-tab__fact">
      <dt>{label}</dt>
      <dd>{children || '-'}</dd>
    </div>
  );
}

/** The comment period the project record carries, whether it is hosted in EPIC or on ENGAGE. */
function EngagementCallout({ project, banner }: { project: Project; banner: any }) {
  const navigate = useNavigate();
  const external = !!(banner.isMet && isSafeUrl(banner.metURL));
  const cta = external
    ? banner.bannerCTA
    : banner.commentPeriodStatus === 'Open'
      ? 'Share your thoughts'
      : 'View comment period';

  function go(): void {
    track('Comment Period Banner Clicked', {
      project_id: project._id,
      project_name: project.name,
      status: banner.commentPeriodStatus,
      is_met: external,
      destination: external ? 'external_met' : 'comment_period_details',
    });
    if (external) {
      openExternal(banner.metURL);
    } else {
      navigate(`/p/${project._id}/cp/${banner._id}/details`);
    }
  }

  return (
    <section className="overview-tab__callout" aria-labelledby="callout-title">
      {external && isSafeUrl(banner.metBannerImageUrl) && (
        <img
          className="overview-tab__callout-image"
          src={banner.metBannerImageUrl}
          alt=""
          fetchPriority="high"
          loading="eager"
        />
      )}
      <div className="overview-tab__callout-body">
        <p className="overview-tab__eyebrow">{banner.bannerTimerPillText}</p>
        <h2 id="callout-title">Public comment period is {banner.commentPeriodStatus}</h2>
        {banner.dateStarted && banner.dateCompleted && (
          <p className="overview-tab__callout-dates">
            {monthAndDay(banner.dateStarted)} - {banner.endDateDisplay}
          </p>
        )}
        {banner.informationLabel ? (
          <p className="overview-tab__callout-text">{banner.informationLabel}</p>
        ) : (
          banner.instructions && (
            <div
              className="overview-tab__callout-text"
              dangerouslySetInnerHTML={safeHtml(banner.instructions)}
            ></div>
          )
        )}
        <div className="overview-tab__callout-actions">
          <button type="button" className="overview-tab__cta" onClick={go}>
            {cta}
            {external && (
              <i className="material-icons overview-tab__external-icon" aria-hidden="true">
                open_in_new
              </i>
            )}
          </button>
          <Link className="overview-tab__cta-secondary" to={`/p/${project._id}/documents`}>
            Read the documents
          </Link>
        </div>
      </div>
    </section>
  );
}

const UPDATES_SHOWN = 3;

/** Rows a list holds open while its first page is in flight. */
const SKELETON_ROWS = [1, 2, 3];

/** The three most recent updates. Same query as the Updates tab, so both read one cached page. */
function UpdatesCard({ projId }: { projId: string }) {
  const result = useTable('projectActivities', {
    dataset: 'RecentActivity',
    enabled: !!projId,
    keywords: '',
    currentPage: 1,
    pageSize: 10,
    sortBy: '-dateAdded',
    queryModifiers: { project: projId },
    populate: true,
  });

  const updatesHref = `/p/${projId}/updates`;

  return (
    <section className="overview-tab__panel" aria-labelledby="updates-title">
      <div className="overview-tab__panel-header">
        <h2 id="updates-title">Updates</h2>
        <Link to={updatesHref}>
          {result.totalListItems > 0
            ? `See all ${result.totalListItems.toLocaleString('en-CA')}`
            : 'See all'}
        </Link>
      </div>
      {result.loading && result.data.length === 0 ? (
        <ul className="overview-tab__panel-list" aria-busy="true">
          <li className="visually-hidden">Loading updates</li>
          {SKELETON_ROWS.map((row) => (
            <li key={row}>
              <Skeleton width="45%" />
              <Skeleton width="85%" />
            </li>
          ))}
        </ul>
      ) : result.data.length === 0 ? (
        <p className="overview-tab__empty overview-tab__panel-empty">No recent updates.</p>
      ) : (
        <ul className="overview-tab__panel-list">
          {result.data.slice(0, UPDATES_SHOWN).map((update: any) => (
            <li key={update._id}>
              <p className="overview-tab__panel-meta">
                {longDate(update.dateAdded)}
                {update.type && ` · ${update.type}`}
              </p>
              <Link to={updatesHref} className="overview-tab__panel-headline">
                {update.headline}
              </Link>
              {update.content && (
                <p className="overview-tab__panel-summary">{htmlToText(update.content)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {/* eagle-notify is optional per environment; without it the panel would offer nothing. */}
      {!!getNotifyApi() && (
        <div className="overview-tab__subscribe">
          <p className="overview-tab__subscribe-title">Get these by email</p>
          <p className="overview-tab__subscribe-text">
            One email each time this project publishes an update. Unsubscribe any time.
          </p>
          <SubscribePopover serviceName={`project:${projId}`} variant="project" surface="card" />
        </div>
      )}
    </section>
  );
}

function ContactCard({ project }: { project: Project | null }) {
  const leadEmail = project?.projectLeadEmail;

  return (
    <section aria-labelledby="contact-title">
      <h2 id="contact-title">Contact</h2>
      <div className="overview-tab__contact">
        <p className="overview-tab__list-title">
          {project?.projectLead || 'Project assessment team'}
        </p>
        <a href={`mailto:${leadEmail || OPERATIONS_EMAIL}`}>{leadEmail || OPERATIONS_EMAIL}</a>
      </div>
      <div className="overview-tab__contact">
        <p className="overview-tab__list-title">Compliance &amp; Enforcement</p>
        <a href={`mailto:${COMPLIANCE_EMAIL}`}>{COMPLIANCE_EMAIL}</a>
        <p className="overview-tab__contact-phone">{COMPLIANCE_PHONE}</p>
      </div>
    </section>
  );
}

export function OverviewTab() {
  const { project, projId, projectLoading } = useProjectContext();
  const banner = project?.commentPeriodForBanner;

  // The same one-row count the tab strip runs, so both read one cached answer.
  const documents = useTable('projectTabDocuments', {
    dataset: 'Document',
    enabled: !!projId,
    currentPage: 1,
    pageSize: 1,
    sortBy: '',
    queryModifiers: { project: projId },
  });

  return (
    <div className="overview-tab">
      <div className="overview-tab__main">
        {projectLoading ? (
          <div className="overview-tab__callout-loading" aria-busy="true">
            <span className="visually-hidden">Loading comment period</span>
            <Skeleton width="30%" />
            <Skeleton width="55%" />
            <Skeleton lines={2} />
          </div>
        ) : (
          project &&
          banner?.isBannerVisible && <EngagementCallout project={project} banner={banner} />
        )}

        {projectLoading ? (
          <section className="overview-tab__skeleton" aria-busy="true">
            <span className="visually-hidden">Loading project details</span>
            <Skeleton width="35%" />
            <Skeleton lines={3} />
          </section>
        ) : (
          <section aria-labelledby="about-title">
            <h2 id="about-title">About this project</h2>
            <p
              className="overview-tab__description"
              dangerouslySetInnerHTML={safeHtml(newlines(project?.description?.toString() || '-'))}
            ></p>
            <dl className="overview-tab__facts">
              <Fact label="Legislation">
                <ExternalLink href={legislationLink(project?.legislation)}>
                  {project?.legislation || '2018 Environmental Assessment Act'}
                </ExternalLink>
              </Fact>
              <Fact label="IAAC involvement">
                {project?.CEAAInvolvement?.name && isSafeUrl(project.CEAALink) ? (
                  <ExternalLink href={project.CEAALink}>
                    {project.CEAAInvolvement.name}
                  </ExternalLink>
                ) : (
                  project?.CEAAInvolvement?.name
                )}
              </Fact>
              <Fact label="Nature">{project?.nature}</Fact>
              <Fact label="Sub-type">{project?.sector}</Fact>
              <Fact label="Documents">
                {documents.totalListItems > 0 && (
                  <Link to={`/p/${projId}/documents`}>
                    {documents.totalListItems.toLocaleString('en-CA')} documents
                  </Link>
                )}
              </Fact>
              {project?.eacDecision?.name === 'Regulatory Transfer' && (
                <Fact label="Regulated by">
                  <ExternalLink
                    href={
                      isSafeUrl(project.applicableRegulation?.item)
                        ? project.applicableRegulation.item
                        : BC_ENERGY_REGULATOR_LINK
                    }
                  >
                    {project.applicableRegulation?.name || 'BC Energy Regulator'}
                  </ExternalLink>
                </Fact>
              )}
              <Fact label="EAO project lead">
                {project?.projectLeadEmail ? (
                  <a href={`mailto:${project.projectLeadEmail}`}>
                    {project.projectLead || project.projectLeadEmail}
                  </a>
                ) : (
                  project?.projectLead
                )}
              </Fact>
              <Fact label="Project ID">{project?.epicProjectID}</Fact>
              <Fact label="First posted">{longDate(project?.dateAdded)}</Fact>
              <Fact label="Last updated">{longDate(project?.dateUpdated)}</Fact>
            </dl>
          </section>
        )}

        <Pins />
        <FeaturedDocuments />
      </div>

      <aside className="overview-tab__aside">
        <UpdatesCard projId={projId} />
        <ContactCard project={project} />
      </aside>
    </div>
  );
}
