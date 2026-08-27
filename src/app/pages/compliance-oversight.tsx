import { HeroBanner, type HeroBannerAction } from 'app/components/hero-banner';

const HERO_TITLE = 'Compliance Oversight';
const HERO_DESCRIPTION = 'Learn about how we collaborate with other government agencies to coordinate oversight of projects that have successfully completed an environmental assessment.';
const HERO_ACTIONS: HeroBannerAction[] = [
  {
    label: 'View Compliance & Enforcement Policies and Procedures',
    href: 'https://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/environmental-assessments/compliance-and-enforcement',
    icon: 'open_in_new',
    target: '_blank',
    rel: 'noopener',
    title: 'View compliance and enforcement policies and procedures'
  }
];

export function ComplianceOversight() {
  return (
    <>
      <HeroBanner title={HERO_TITLE} description={HERO_DESCRIPTION} actions={HERO_ACTIONS} />

      <section>
        <div className="container" id="anchor-point">
          <div className="content-wrapper">
            <p>The Environmental Assessment Office&apos;s work doesn&apos;t end when a project receives an Environmental Assessment Certificate.</p>
            <p>Compliance and enforcement is an important part of the Environmental Assessment process, and helps ensure certificate holders are following the conditions designed to minimize the potential for adverse effects from a project on environmental, cultural, health, social, and economic values.</p>
            <p>The Environmental Assessment Office works with the other provincial government agencies to oversee projects that have successfully completed an environmental assessment.</p>
          </div>
        </div>
      </section>
    </>
  );
}
