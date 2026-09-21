import { MastheadLink, PageMasthead } from 'app/layout/page-masthead';

const HERO_TITLE = 'Compliance Oversight';
const HERO_DESCRIPTION =
  'Learn about how we collaborate with other government agencies to coordinate oversight of projects that have successfully completed an environmental assessment.';
const HERO_ACTIONS: { label: string; href: string }[] = [
  {
    label: 'View Compliance & Enforcement Policies and Procedures',
    href: 'https://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/environmental-assessments/compliance-and-enforcement',
  },
];

export function ComplianceOversight() {
  return (
    <>
      <PageMasthead
        title={HERO_TITLE}
        lede={HERO_DESCRIPTION}
        actions={HERO_ACTIONS.map((action) => (
          <MastheadLink key={action.label} label={action.label} href={action.href} newTab />
        ))}
      />

      <section className="page-body">
        <div className="page-container" id="anchor-point">
          <div className="content-wrapper">
            <p>
              The Environmental Assessment Office&apos;s work doesn&apos;t end when a project
              receives an Environmental Assessment Certificate.
            </p>
            <p>
              Compliance and enforcement is an important part of the Environmental Assessment
              process, and helps ensure certificate holders are following the conditions designed to
              minimize the potential for adverse effects from a project on environmental, cultural,
              health, social, and economic values.
            </p>
            <p>
              The Environmental Assessment Office works with the other provincial government
              agencies to oversee projects that have successfully completed an environmental
              assessment.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
