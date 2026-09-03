import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { getTopNewsItems } from 'app/api/search';
import { surveyUrl, showSurveyBanner } from 'app/api/api';
import type { News } from 'app/models/news';
import { HeroBanner, type HeroBannerAction } from 'app/components/hero-banner';
import { InfoCard, type InfoCardButton } from 'app/components/info-card';
import { ActivityCard } from 'app/components/activity-card';
import './home.css';

const HERO_TITLE = 'Environmental Assessments';
const HERO_DESCRIPTION =
  "British Columbia's environmental assessment process provides opportunities for Indigenous Nations, government agencies and the public to influence the outcome of environmental assessments in British Columbia.";
const HERO_ACTIONS: HeroBannerAction[] = [
  { label: 'Find Environmental Assessment Projects', routerLink: '/projects', icon: 'list' },
  { label: 'List of Projects', routerLink: '/projects-list', icon: 'list' },
  { label: 'Project Notifications', routerLink: '/project-notifications', icon: 'list' },
];

const ABOUT_CARDS: { title: string; description: string; button: InfoCardButton }[] = [
  {
    title: 'Legislation',
    description:
      'Learn about the legislation and regulations that apply to environmental assessments in the province of British Columbia.',
    button: { text: 'Learn More', link: '/legislation', title: 'Learn more about legislation' },
  },
  {
    title: 'Process & Procedures',
    description:
      'Learn more about how the Environmental Assessment Office neutrally administers a process that holds all participants accountable.',
    button: {
      text: 'Learn More',
      link: '/process',
      title: 'Learn more about process and procedures',
    },
  },
  {
    title: 'Compliance Oversight',
    description:
      'Learn about how we collaborate with other agencies to coordinate oversight of environmental assessment projects.',
    button: {
      text: 'Learn More',
      link: '/compliance-oversight',
      title: 'Learn more about compliance oversight',
    },
  },
];

export function Home() {
  const { data: results = [], isPending } = useQuery<News[]>({
    queryKey: ['topNewsItems'],
    queryFn: getTopNewsItems,
  });

  const survey = surveyUrl();
  const showSurvey = showSurveyBanner();

  return (
    <>
      <HeroBanner title={HERO_TITLE} description={HERO_DESCRIPTION} actions={HERO_ACTIONS} />

      <div>
        {showSurvey && survey && (
          <div className="survey-banner">
            <div className="container">
              <div className="d-flex flex-column flex-md-row gap-3">
                <div className="flex-grow-1">
                  <h5 className="mb-3">
                    Can you take a few minutes to help us improve your experience on EPIC?
                  </h5>
                  <p className="mb-0">
                    We are working on some improvements to this website and would like to hear about
                    your experience. Please fill out a short 5-10 minute survey to help us design a
                    better EAO Project Information Centre. Thank you!
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <a
                    className="btn btn-primary survey-link"
                    href={survey}
                    rel="noopener"
                    target="_blank"
                  >
                    Share your thoughts
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <main className="home-main">
        <div id="anchor-point">
          <section className="container">
            <div className="home-news-feed">
              <h2 tabIndex={0}>Recent Activities &amp; Updates</h2>
              {isPending ? (
                <div className="d-flex justify-content-center align-items-center py-5">
                  <div
                    className="spinner-border text-primary"
                    style={{ width: '3rem', height: '3rem' }}
                    role="status"
                  >
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : results.length > 0 ? (
                <table className="table" id="tableTop">
                  {results
                    .filter((item) => item.active)
                    .map((item) => (
                      <tbody key={item._id}>
                        <ActivityCard rowData={item} />
                      </tbody>
                    ))}
                </table>
              ) : null}
              <div className="mt-4 text-center">
                <Link
                  className="btn slide-r-btn btn-outline-primary d-inline-flex align-items-center gap-2"
                  to="/news"
                >
                  <span>View All Activities &amp; Updates</span>
                  <i className="material-icons">&#xE5C8;</i>
                </Link>
              </div>
            </div>
          </section>

          <div className="bg-faded mt-5">
            <section className="container">
              <h2 tabIndex={0}>About the B.C. Environmental Assessment Process</h2>
              <p tabIndex={0}>
                Learn more about how the Environmental Assessment Office neutrally administers a
                process that is predictable, transparent, timely, procedurally fair, and holds all
                participants accountable.
              </p>
              <div className="feature-cards-container">
                {ABOUT_CARDS.map((card) => (
                  <div className="feature-card" key={card.title}>
                    <InfoCard
                      title={card.title}
                      description={card.description}
                      button={card.button}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
