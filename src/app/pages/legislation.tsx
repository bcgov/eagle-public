import { HeroBanner, type HeroBannerAction } from 'app/components/hero-banner';

const HERO_TITLE = 'Legislation';
const HERO_DESCRIPTION =
  'Learn about the legislation and regulations that apply to environmental assessments in the province of British Columbia.';
const HERO_ACTIONS: HeroBannerAction[] = [
  {
    label: '2002 Environmental Assessment Act',
    href: 'https://www2.gov.bc.ca/gov/content?id=1D2FF7DF6672482A84705D2519574C27',
    icon: 'open_in_new',
    target: '_blank',
    rel: 'noopener',
    title: 'View more information',
  },
  {
    label: '2018 Environmental Assessment Act',
    href: 'https://www2.gov.bc.ca/gov/content?id=B5737A3A620146219ABED73B5066DEC6',
    icon: 'open_in_new',
    target: '_blank',
    rel: 'noopener',
    title: 'View more information',
  },
];

export function Legislation() {
  return (
    <>
      <HeroBanner title={HERO_TITLE} description={HERO_DESCRIPTION} actions={HERO_ACTIONS} />

      <section>
        <div className="container" id="anchor-point">
          <div className="content-wrapper">
            <p>
              The Environmental Assessment Act and associated regulations set a clear path for
              environmental assessment in British Columbia, a process that is undertaken by the
              Environmental Assessment Office.
            </p>
            <p>
              On December 16th, 2019, the new Environmental Assessment Act (2018) came into force.
              Many projects with an environmental assessment already underway will continue under
              the old Act (2002) process, while any new projects after December 16th, 2019 will
              undergo an environmental assessment under the new Act (2018) process. Each process has
              its own unique regulation and agreements.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
