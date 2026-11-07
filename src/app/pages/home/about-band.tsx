import { Link } from 'react-router';

const ABOUT_LINKS = [
  {
    title: 'Environmental Assessment Office',
    description: 'The EAO is a neutral regulator that oversees major project development in B.C.',
    to: '/about#eao',
  },
  {
    title: 'Legislation',
    description:
      'The legislation and regulations that apply to environmental assessments in British Columbia.',
    to: '/about#legislation',
  },
  {
    title: 'Compliance oversight',
    description:
      'Certified projects are monitored throughout their entire lifecycle to protect the environment and communities',
    to: '/about#compliance',
  },
];

/** Band at the foot of the home page: what the site is for, and links into the About page. */
export function AboutBand() {
  return (
    <section className="home-about" aria-labelledby="home-about-heading">
      <div className="home-about__inner page-container">
        <div className="home-about__intro">
          <h2 id="home-about-heading" className="home-band__heading">
            About
          </h2>
          <p className="home-band__body">
            The EAO project information centre (EPIC) provides open and transparent access to
            information and documentation about environmental assessments and regulatory oversight
            of major projects in B.C.
          </p>
          <Link className="home-about__more" to="/about">
            <span className="link-label">About environmental assessment</span>
            <i className="material-icons" aria-hidden="true">
              arrow_forward
            </i>
          </Link>
        </div>

        <ul className="home-about__list">
          {ABOUT_LINKS.map((item) => (
            <li key={item.to}>
              <Link className="home-about__row" to={item.to}>
                <span className="home-about__text">
                  {/* The space keeps the parts apart in the link's accessible name. */}
                  <span className="home-about__title">{item.title}</span>{' '}
                  <span className="home-about__desc">{item.description}</span>
                </span>
                <i className="material-icons" aria-hidden="true">
                  chevron_right
                </i>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
