import { Link } from 'react-router';

/** The first two descriptions shorten the About page copy; the third is verbatim. */
const ABOUT_LINKS = [
  {
    title: 'Which Act applies',
    description:
      'Projects started before December 16th, 2019 may continue under the 2002 Act. New projects follow the 2018 Act.',
    to: '/about#process',
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
      'The Environmental Assessment Office’s work doesn’t end when a project receives an Environmental Assessment Certificate.',
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
            This website aims to improve transparency of the provincial environmental assessment
            process, and to provide citizens and stakeholders with access to project data and
            information.
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
