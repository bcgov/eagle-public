import { MastheadLink, PageMasthead } from 'app/layout/page-masthead';
import { InfoCard, type InfoCardButton } from 'app/components/info-card';

const HERO_TITLE = 'Connect With Us';
const HERO_DESCRIPTION =
  'This website aims to improve transparency of the provincial environmental assessment process, and to provide citizens and stakeholders with access to project data and information. If you are interested in providing us with feedback about your experience using this website, please feel free to send us your feedback.';
const FEEDBACK_EMAIL = 'EAO.EPICsystem@gov.bc.ca';

const INFO_CARDS: { title: string; description: string; icon: string; button: InfoCardButton }[] = [
  {
    title: 'B.C. Environmental Assessment Office',
    description:
      'Please use the <a href="https://dir.gov.bc.ca/gtds.cgi?show=Branch&organizationCode=ENV&organizationalUnitCode=ENVIRON5" target="_blank" rel="noopener">B.C. EAO Government Directory</a> listing to find contact information for specific Environmental Assessment Office staff.',
    icon: 'phone',
    button: {
      text: 'Visit EAO B.C. Government Directory',
      href: 'https://dir.gov.bc.ca/gtds.cgi?show=Branch&organizationCode=ENV&organizationalUnitCode=ENVIRON5',
      target: '_blank',
      rel: 'noopener',
      title: 'Go to the EAO B.C. Government Directory',
    },
  },
  {
    title: 'Compliance Oversight',
    description:
      'For questions about compliance, or if you have information about possible non-compliance with an environmental assessment certificate, please email <a href="mailto:eao.compliance@gov.bc.ca">eao.compliance@gov.bc.ca</a>.',
    icon: 'email',
    button: {
      text: 'Email EAO Compliance',
      href: 'mailto:eao.compliance@gov.bc.ca',
      title: 'Email us your questions about compliance oversight',
    },
  },
  {
    title: 'Report Natural Resource Violations',
    description:
      'If you have seen misconduct involving wildlife, ecosystems, heritage sites or natural resources, you can report it at this <a href="https://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/natural-resource-law-enforcement/natural-resource-officers/identifying-reporting-violations" target="_blank" rel="noopener">link here</a>.',
    icon: 'report_problem',
    button: {
      text: 'Report a Natural Resource Violation',
      href: 'https://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/natural-resource-law-enforcement/natural-resource-officers/identifying-reporting-violations',
      target: '_blank',
      rel: 'noopener',
      title: 'Report a Natural Resource Violation',
    },
  },
];

export function Contact() {
  return (
    <>
      <PageMasthead
        title={HERO_TITLE}
        lede={HERO_DESCRIPTION}
        actions={
          <MastheadLink
            label="Submit your Feedback"
            href={`mailto:${FEEDBACK_EMAIL}`}
            icon="email"
          />
        }
      />

      <div className="bg-faded">
        <section className="page-container page-body">
          <div className="feature-cards-container">
            {INFO_CARDS.map((card) => (
              <div className="feature-card" key={card.title}>
                <InfoCard
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  button={card.button}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
