import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router';
import { PageMasthead } from 'app/layout/page-masthead';
import { ExternalLink } from 'app/components/external-link';
import { Constants } from 'app/utils/constants';
import './about.css';

const SECTIONS = [
  { id: 'process', label: 'The assessment process' },
  { id: 'legislation', label: 'Legislation' },
  { id: 'compliance', label: 'Compliance oversight' },
  { id: 'contact', label: 'Contact us' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

/** A section is current once its top is this close to the top of the viewport. */
const SPY_THRESHOLD = 160;
/** A smooth scroll that never reports `scrollend` (older Safari) unpins the rail after this. */
const PIN_FALLBACK_MS = 1000;

const GOV = 'https://www2.gov.bc.ca/gov/content';
const DIRECTORY =
  'https://dir.gov.bc.ca/gtds.cgi?show=Branch&organizationCode=ENV&organizationalUnitCode=ENVIRON5';
const VIOLATIONS = `${GOV}/environment/natural-resource-stewardship/natural-resource-law-enforcement/natural-resource-officers/identifying-reporting-violations`;
const COMPLIANCE_POLICIES = `${GOV}/environment/natural-resource-stewardship/environmental-assessments/compliance-and-enforcement`;

/** 2002 first: the order people meet them in, oldest assessments to newest. */
const ACTS = [
  {
    year: 2002,
    title: '2002 Environmental Assessment Act',
    scope: 'Assessments already underway before December 16, 2019',
    links: [
      { label: 'The Act and regulations', href: `${GOV}?id=1D2FF7DF6672482A84705D2519574C27` },
      { label: 'Process & procedures', href: `${GOV}?id=AF29E35F5F9F4ACE91BF59F5FA25BF54` },
    ],
  },
  {
    year: 2018,
    title: '2018 Environmental Assessment Act',
    scope: 'Projects entering assessment on or after December 16, 2019',
    links: [
      { label: 'The Act and regulations', href: `${GOV}?id=B5737A3A620146219ABED73B5066DEC6` },
      { label: 'Process & procedures', href: `${GOV}?id=E0DC041CBB194136A0C14B8A2F829A16` },
    ],
  },
];

const CONTACTS = [
  {
    icon: 'phone',
    title: 'B.C. Environmental Assessment Office',
    body: 'Please use the B.C. EAO Government Directory listing to find contact information for specific Environmental Assessment Office staff.',
    cta: 'Visit EAO B.C. Government Directory',
    href: DIRECTORY,
  },
  {
    icon: 'email',
    title: 'Compliance Oversight',
    body: `For questions about compliance, or if you have information about possible non-compliance with an environmental assessment certificate, please email ${Constants.COMPLIANCE_EMAIL}.`,
    cta: 'Email EAO Compliance',
    href: `mailto:${Constants.COMPLIANCE_EMAIL}`,
  },
  {
    icon: 'report_problem',
    title: 'Report Natural Resource Violations',
    body: 'If you have seen misconduct involving wildlife, ecosystems, heritage sites or natural resources, you can report it to the Natural Resource Officers.',
    cta: 'Report a Natural Resource Violation',
    href: VIOLATIONS,
  },
];

const LAST_SECTION = SECTIONS[SECTIONS.length - 1].id;

/** True once the page can't scroll any further down. */
function isAtBottom(): boolean {
  const doc = document.documentElement;
  return window.innerHeight + window.scrollY >= doc.scrollHeight - 4;
}

/** The last section whose top has passed the threshold; the last one outright at the bottom. */
function sectionInView(): SectionId {
  let current: SectionId = SECTIONS[0].id;
  for (const { id } of SECTIONS) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top < SPY_THRESHOLD) current = id;
  }
  // Contact is too short to reach the threshold, so the bottom of the page hands it the rail. Not
  // at scrollY 0: a viewport tall enough to show the whole page would otherwise start on Contact.
  if (window.scrollY > 0 && isAtBottom()) current = LAST_SECTION;
  return current;
}

/** Scrolls to the section and returns where the page will stop, clamped to its scroll range. */
function scrollToSection(id: SectionId): number {
  const el = document.getElementById(id);
  if (!el) return window.scrollY;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The offset lives in about.css as `scroll-margin-top`, which a hash arrival also honours.
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const top = el.getBoundingClientRect().top + window.scrollY - margin;
  // `window.scrollTo`, not `scrollIntoView`: the latter also scrolls any scrollable ancestor.
  window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(Math.max(top, 0), max);
}

/** Subpixel scroll positions round differently across browsers. */
const sameSpot = (a: number, b: number) => Math.abs(a - b) <= 1;

function isSectionId(value: string): value is SectionId {
  return SECTIONS.some((section) => section.id === value);
}

/**
 * The section the rail marks current. A jump pins its target until the scroll settles, so the
 * rail does not step through every section the smooth scroll passes on the way.
 */
function useActiveSection() {
  const [active, setActive] = useState<SectionId>(SECTIONS[0].id);
  const pinned = useRef(false);
  // The section the reader chose (rail click or hash arrival) and the scroll spot it put them
  // at. A short page can bottom out with it still in view; it keeps the rail until they move.
  const held = useRef<{ id: SectionId; y: number } | null>(null);
  const pinTimer = useRef(0);
  const pinRelease = useRef<(() => void) | null>(null);

  const clearPin = useCallback(() => {
    window.clearTimeout(pinTimer.current);
    if (pinRelease.current) window.removeEventListener('scrollend', pinRelease.current);
    pinRelease.current = null;
  }, []);

  const spy = useCallback(() => {
    // A frame queued before a jump must not overwrite its pin.
    if (pinned.current) return;
    const hold = held.current;
    const el = hold ? document.getElementById(hold.id) : null;
    if (hold && el && el.getBoundingClientRect().top >= 0 && sameSpot(window.scrollY, hold.y)) {
      setActive(hold.id);
      return;
    }
    held.current = null;
    setActive(sectionInView());
  }, []);

  const { hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // ScrollRestoration scrolls a hash arrival (the old section routes redirect here) into view,
    // but back, forward and reload restore the reader's last spot instead.
    const hashId = hash.slice(1);
    if (isSectionId(hashId)) {
      if (navigationType !== 'POP') held.current = { id: hashId, y: window.scrollY };
      // As on a rail click, the next Tab continues inside the section.
      document.getElementById(headingId(hashId))?.focus({ preventScroll: true });
    }
    let frame = 0;
    const onScroll = () => {
      if (pinned.current || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        spy();
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
      clearPin();
      pinned.current = false;
    };
  }, [hash, navigationType, clearPin, spy]);

  const jumpTo = useCallback(
    (id: SectionId) => {
      // A second jump before the first settles replaces its pin rather than racing it.
      clearPin();
      setActive(id);
      const from = window.scrollY;
      const target = scrollToSection(id);
      // The spy keeps the hold only if the page settles where the jump aimed.
      held.current = { id, y: target };
      // A scroll that goes nowhere fires no `scrollend`, so there is nothing to wait for.
      pinned.current = !sameSpot(from, target);
      if (!pinned.current) return;
      const release = () => {
        clearPin();
        pinned.current = false;
        spy();
      };
      pinRelease.current = release;
      window.addEventListener('scrollend', release);
      // lib.dom says every window has `onscrollend`, which would narrow `window` to never here.
      if (!('onscrollend' in (window as object))) {
        pinTimer.current = window.setTimeout(release, PIN_FALLBACK_MS);
      }
    },
    [clearPin, spy],
  );

  return { active, jumpTo };
}

const headingId = (id: SectionId) => `about-${id}-heading`;

function AboutSection({ id, children }: { id: SectionId; children: ReactNode }) {
  const label = SECTIONS.find((section) => section.id === id)?.label;
  return (
    <section className="about-section" id={id} aria-labelledby={headingId(id)}>
      <h2 className="about-section__title" id={headingId(id)} tabIndex={-1}>
        {label}
      </h2>
      {children}
    </section>
  );
}

export function About() {
  const { active, jumpTo } = useActiveSection();

  function onRailClick(event: MouseEvent<HTMLAnchorElement>, id: SectionId) {
    // Leave a modified click to the browser: new tab, new window, download.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    jumpTo(id);
    // Keep the address shareable without a navigation. The router's state rides along: its
    // entry key drives scroll restoration on back and forward.
    window.history.replaceState(window.history.state, '', `#${id}`);
    // The default was cancelled, so move focus by hand: the next Tab continues inside the
    // section instead of on the rail.
    document.getElementById(headingId(id))?.focus({ preventScroll: true });
  }

  return (
    <div className="about">
      <PageMasthead
        title="About environmental assessment"
        lede="Learn more about how the Environmental Assessment Office neutrally administers a process that is predictable, transparent, timely, procedurally fair, and holds all participants accountable."
      />

      <div className="about__body page-container page-body">
        <nav className="about-rail" aria-labelledby="about-rail-label">
          <p className="about-rail__label" id="about-rail-label">
            On this page
          </p>
          <ul className="about-rail__list">
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <a
                  className="about-rail__link"
                  href={`#${id}`}
                  aria-current={id === active ? 'true' : undefined}
                  onClick={(event) => onRailClick(event, id)}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="about__content">
          <AboutSection id="process">
            <div className="about-note" role="note">
              <i className="material-icons about-note__icon" aria-hidden="true">
                info
              </i>
              <div className="about-note__text">
                <p className="about-note__title">Which Act applies</p>
                <p className="about-section__text">
                  On December 16th, 2019, the new Environmental Assessment Act (2018) came into
                  force. Many projects with an environmental assessment already underway will
                  continue under the old Act (2002) process, while any new projects after December
                  16th, 2019 will undergo an environmental assessment under the new Act (2018)
                  process. Each process has its own unique regulation and agreements.
                </p>
              </div>
            </div>
          </AboutSection>

          <AboutSection id="legislation">
            <p className="about-section__text">
              Learn about the legislation and regulations that apply to environmental assessments in
              the province of British Columbia.
            </p>
            <p className="about-section__text">
              The Environmental Assessment Act and associated regulations set a clear path for
              environmental assessment in British Columbia, a process that is undertaken by the
              Environmental Assessment Office.
            </p>
            {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
            <ul className="about-acts" role="list">
              {ACTS.map((act) => (
                <li className="about-act" key={act.title}>
                  <div className="about-act__head">
                    <h3 className="about-act__title">{act.title}</h3>
                    <p className="about-act__scope">{act.scope}</p>
                  </div>
                  {act.links.map((link) => (
                    <ExternalLink className="about-act__link" key={link.href} href={link.href}>
                      {link.label}
                      {/* Both cards carry the same two labels; the year tells them apart. */}
                      <span className="visually-hidden">{` (${act.year} Act)`}</span>
                    </ExternalLink>
                  ))}
                </li>
              ))}
            </ul>
          </AboutSection>

          <AboutSection id="compliance">
            <p className="about-section__text">
              The Environmental Assessment Office&apos;s work doesn&apos;t end when a project
              receives an Environmental Assessment Certificate.
            </p>
            <p className="about-section__text">
              Compliance and enforcement is an important part of the Environmental Assessment
              process, and helps ensure certificate holders are following the conditions designed to
              minimize the potential for adverse effects from a project on environmental, cultural,
              health, social, and economic values.
            </p>
            <p className="about-section__text">
              The Environmental Assessment Office works with the other provincial government
              agencies to oversee projects that have successfully completed an environmental
              assessment.
            </p>
            <p className="about-section__text">
              <ExternalLink className="about-link" href={COMPLIANCE_POLICIES}>
                View Compliance &amp; Enforcement Policies and Procedures
              </ExternalLink>
            </p>
          </AboutSection>

          <AboutSection id="contact">
            <p className="about-section__text">
              This website aims to improve transparency of the provincial environmental assessment
              process, and to provide citizens and stakeholders with access to project data and
              information. If you are interested in providing us with feedback about your experience
              using this website, please feel free to send us your feedback.
            </p>
            <p className="about-section__text">
              <a className="about-link" href={`mailto:${Constants.FEEDBACK_EMAIL}`}>
                <i className="material-icons about-link__icon" aria-hidden="true">
                  email
                </i>
                <span className="link-label">Submit your Feedback</span>
              </a>
            </p>
            {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a list with `list-style: none` */}
            <ul className="about-contacts" role="list">
              {CONTACTS.map((contact) => (
                <li className="about-contact" key={contact.title}>
                  <i className="material-icons about-contact__icon" aria-hidden="true">
                    {contact.icon}
                  </i>
                  <h3 className="about-contact__title">{contact.title}</h3>
                  <p className="about-contact__body">{contact.body}</p>
                  {contact.href.startsWith('mailto:') ? (
                    <a className="about-contact__cta" href={contact.href}>
                      {contact.cta}
                    </a>
                  ) : (
                    <ExternalLink className="about-contact__cta" href={contact.href}>
                      {contact.cta}
                    </ExternalLink>
                  )}
                </li>
              ))}
            </ul>
          </AboutSection>
        </div>
      </div>
    </div>
  );
}
