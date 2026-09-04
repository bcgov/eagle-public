import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { track } from 'app/analytics/analytics';
import { useTable } from 'app/components/table/use-table';
import type { Project } from 'app/models/project';
import { newlines } from 'app/utils/newlines';
import { safeHtml } from 'app/utils/safe-html';
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
        <button type="button" className="overview-tab__cta" onClick={go}>
          {cta}
          {external && (
            <i className="material-icons overview-tab__external-icon" aria-hidden="true">
              open_in_new
            </i>
          )}
        </button>
      </div>
    </section>
  );
}

const UPDATES_SHOWN = 3;

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

  return (
    <section aria-labelledby="updates-title">
      <div className="overview-tab__card-header">
        <h2 id="updates-title">Updates</h2>
        <Link to={`/p/${projId}/updates`}>All updates</Link>
      </div>
      {result.data.length === 0 ? (
        <p className="overview-tab__empty">{result.loading ? 'Loading' : 'No recent updates.'}</p>
      ) : (
        <ul className="overview-tab__list">
          {result.data.slice(0, UPDATES_SHOWN).map((update: any) => (
            <li key={update._id}>
              <p className="overview-tab__eyebrow">{longDate(update.dateAdded)}</p>
              <p className="overview-tab__list-title">{update.headline}</p>
            </li>
          ))}
        </ul>
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

  return (
    <div className="overview-tab">
      <div className="overview-tab__main">
        {project && banner?.isBannerVisible && (
          <EngagementCallout project={project} banner={banner} />
        )}

        {projectLoading ? (
          <section className="overview-tab__skeleton" aria-busy="true">
            <span className="visually-hidden">Loading project details</span>
            <div className="placeholder-wave" aria-hidden="true">
              <span className="placeholder col-4"></span>
              <span className="placeholder w-100"></span>
              <span className="placeholder w-100"></span>
              <span className="placeholder col-7"></span>
            </div>
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
