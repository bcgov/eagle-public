import { MastheadLink, PageMasthead } from 'app/layout/page-masthead';

const HERO_TITLE = 'Process & Procedures';
const HERO_DESCRIPTION =
  'Learn more about how the Environmental Assessment Office neutrally administers a process that is predictable, transparent, timely, procedurally fair, and holds all participants accountable.';
const HERO_ACTIONS: { label: string; href: string }[] = [
  {
    label: '2002 Environmental Assessment Act',
    href: 'https://www2.gov.bc.ca/gov/content?id=AF29E35F5F9F4ACE91BF59F5FA25BF54',
  },
  {
    label: '2018 Environmental Assessment Act',
    href: 'https://www2.gov.bc.ca/gov/content?id=E0DC041CBB194136A0C14B8A2F829A16',
  },
];

export function Process() {
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
              On December 16th, 2019, the new Environmental Assessment Act (2018) came in to force.
              Many projects with an environmental assessment already underway will continue under
              the old Act (2002) process, while any new projects after December 16th, 2019 will
              undergo an environmental assessment under the new Act (2018) process.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
