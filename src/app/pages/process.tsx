import { HeroBanner, type HeroBannerAction } from 'app/components/hero-banner';

const HERO_TITLE = 'Process & Procedures';
const HERO_DESCRIPTION = 'Learn more about how the Environmental Assessment Office neutrally administers a process that is predictable, transparent, timely, procedurally fair, and holds all participants accountable.';
const HERO_ACTIONS: HeroBannerAction[] = [
  {
    label: '2002 Environmental Assessment Act',
    href: 'https://www2.gov.bc.ca/gov/content?id=AF29E35F5F9F4ACE91BF59F5FA25BF54',
    icon: 'open_in_new',
    target: '_blank',
    rel: 'noopener',
    title: 'View more information'
  },
  {
    label: '2018 Environmental Assessment Act',
    href: 'https://www2.gov.bc.ca/gov/content?id=E0DC041CBB194136A0C14B8A2F829A16',
    icon: 'open_in_new',
    target: '_blank',
    rel: 'noopener',
    title: 'View more information'
  }
];

export function Process() {
  return (
    <>
      <HeroBanner title={HERO_TITLE} description={HERO_DESCRIPTION} actions={HERO_ACTIONS} />

      <section>
        <div className="container" id="anchor-point">
          <div className="content-wrapper">
            <p>On December 16th, 2019, the new Environmental Assessment Act (2018) came in to force. Many projects with an environmental assessment already underway will continue under the old Act (2002) process, while any new projects after December 16th, 2019 will undergo an environmental assessment under the new Act (2018) process.</p>
          </div>
        </div>
      </section>
    </>
  );
}
