import { describe, it, expect, beforeEach, afterEach, onTestFinished, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt } from '../../test-utils';
import { About } from './about';

/** Section tops, in px from the viewport top, as a desktop reader sees them at scrollY 0. */
type Layout = Record<string, number>;
const PAGE_TOP: Layout = { process: 400, legislation: 900, compliance: 1500, contact: 2200 };

// jsdom has no layout: every rect is zero, which would put every section past the spy threshold.
let layout: Layout;
let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  layout = { ...PAGE_TOP };
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const top = layout[this.id] ?? 0;
    return { top, bottom: top + 400, left: 0, right: 800, width: 800, height: 400 } as DOMRect;
  });
  scrollTo = vi.fn();
  vi.stubGlobal('scrollTo', scrollTo);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function renderAbout() {
  return renderAt('/about', [{ path: '/about', element: <About /> }]);
}

const railLink = (name: string) =>
  within(screen.getByRole('navigation', { name: 'On this page' })).getByRole('link', { name });

const section = (name: string) => screen.getByRole('region', { name });

const current = () =>
  within(screen.getByRole('navigation', { name: 'On this page' }))
    .getAllByRole('link')
    .find((link) => link.getAttribute('aria-current') === 'true')?.textContent;

/** A 1400px viewport over a 2400px page: scrollY 1000 is the bottom. */
const VIEWPORT = 1400;
const PAGE_HEIGHT = 2400;
/** At the bottom Compliance sits near the top, but Contact never reaches the spy threshold. */
const AT_BOTTOM = {
  scrollY: 1000,
  tops: { process: -800, legislation: -300, compliance: 40, contact: 500 },
};
/** Scrolled back up: Legislation has passed the threshold, Compliance has not. */
const MID_PAGE = {
  scrollY: 600,
  tops: { process: -400, legislation: 20, compliance: 300, contact: 900 },
};

function scrollPage({ scrollY, tops }: { scrollY: number; tops: Layout }, height = PAGE_HEIGHT) {
  layout = tops;
  vi.stubGlobal('scrollY', scrollY);
  vi.stubGlobal('innerHeight', VIEWPORT);
  vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(height);
}

/** Resolves after the spy's queued frame, which was registered first. */
const nextFrame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

/** Older Safari: no `scrollend` event, so a jump must unpin on a timer. */
function withoutScrollend() {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'onscrollend');
  Reflect.deleteProperty(window, 'onscrollend');
  onTestFinished(() => {
    if (descriptor) Object.defineProperty(window, 'onscrollend', descriptor);
  });
}

describe('about page', () => {
  it('opens with the page title as its h1', () => {
    renderAbout();

    expect(
      screen.getByRole('heading', { level: 1, name: 'About environmental assessment' }),
    ).toBeInTheDocument();
  });

  it('lays out the four sections in reading order', () => {
    renderAbout();

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'The assessment process',
      'Legislation',
      'Compliance oversight',
      'Contact us',
    ]);
    expect(section('Contact us')).toHaveAttribute('id', 'contact');
  });

  it('points each rail link at its section and marks the first current', () => {
    renderAbout();

    const links = within(screen.getByRole('navigation', { name: 'On this page' })).getAllByRole(
      'link',
    );
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#process',
      '#legislation',
      '#compliance',
      '#contact',
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([
      'true',
      null,
      null,
      null,
    ]);
  });

  it('moves the current mark as the reader scrolls a section past the top', async () => {
    renderAbout();

    layout = { process: -600, legislation: 100, compliance: 700, contact: 1400 };
    fireEvent.scroll(window);

    await waitFor(() => expect(railLink('Legislation')).toHaveAttribute('aria-current', 'true'));
    expect(railLink('The assessment process')).not.toHaveAttribute('aria-current');
  });

  describe('at the bottom of the page', () => {
    it('keeps a section named in the address, through later resize and scroll', async () => {
      window.history.replaceState(null, '', '/about#compliance');
      scrollPage(AT_BOTTOM);
      renderAbout();

      await waitFor(() => expect(current()).toBe('Compliance oversight'));

      fireEvent(window, new Event('resize'));
      fireEvent.scroll(window);
      await nextFrame();
      expect(current()).toBe('Compliance oversight');
    });

    it('keeps a clicked section once the scroll ends, and on the next scroll', async () => {
      const user = userEvent.setup();
      renderAbout();

      await user.click(railLink('Compliance oversight'));
      scrollPage(AT_BOTTOM);
      fireEvent(window, new Event('scrollend'));
      expect(current()).toBe('Compliance oversight');

      fireEvent.scroll(window);
      await nextFrame();
      expect(current()).toBe('Compliance oversight');
    });

    it('lets go of a clicked section once the reader scrolls away', async () => {
      const user = userEvent.setup();
      renderAbout();
      await user.click(railLink('Compliance oversight'));
      scrollPage(AT_BOTTOM);
      fireEvent(window, new Event('scrollend'));

      scrollPage(MID_PAGE);
      fireEvent.scroll(window);
      await waitFor(() => expect(current()).toBe('Legislation'));

      // Back at the bottom with nothing chosen, the bottom rule applies again.
      scrollPage(AT_BOTTOM);
      fireEvent.scroll(window);
      await waitFor(() => expect(current()).toBe('Contact us'));
    });

    it('marks Contact when the reader scrolls there with nothing chosen', async () => {
      renderAbout();

      scrollPage(AT_BOTTOM);
      fireEvent.scroll(window);

      await waitFor(() => expect(current()).toBe('Contact us'));
    });

    it('marks the first section when the whole page fits the viewport', async () => {
      scrollPage(
        { scrollY: 0, tops: { process: 400, legislation: 600, compliance: 800, contact: 1000 } },
        VIEWPORT,
      );
      renderAbout();

      fireEvent(window, new Event('resize'));
      await nextFrame();

      expect(current()).toBe('The assessment process');
    });
  });

  describe('releasing the rail after a jump', () => {
    it('waits for scrollend where the browser has it, with no timer', () => {
      vi.useFakeTimers();
      renderAbout();

      fireEvent.click(railLink('Compliance oversight'));
      // The reader cut the smooth scroll short, so the settled spot is Legislation.
      scrollPage(MID_PAGE);
      act(() => vi.advanceTimersByTime(5000));
      expect(current()).toBe('Compliance oversight');

      fireEvent(window, new Event('scrollend'));
      expect(current()).toBe('Legislation');
    });

    it('falls back to a 1s timer where the browser has no scrollend', () => {
      withoutScrollend();
      vi.useFakeTimers();
      renderAbout();

      fireEvent.click(railLink('Compliance oversight'));
      scrollPage(MID_PAGE);
      act(() => vi.advanceTimersByTime(999));
      expect(current()).toBe('Compliance oversight');

      act(() => vi.advanceTimersByTime(1));
      expect(current()).toBe('Legislation');
    });
  });

  describe('a plain click on a rail link', () => {
    it('scrolls to the section, marks it current and puts focus on its heading', async () => {
      const user = userEvent.setup();
      renderAbout();

      await user.click(railLink('Legislation'));

      expect(scrollTo).toHaveBeenCalledWith({ top: 900, behavior: 'smooth' });
      expect(railLink('Legislation')).toHaveAttribute('aria-current', 'true');
      expect(railLink('The assessment process')).not.toHaveAttribute('aria-current');
      expect(screen.getByRole('heading', { level: 2, name: 'Legislation' })).toHaveFocus();
      expect(window.location.hash).toBe('#legislation');
    });

    it('stops short of the section by its scroll-margin-top', async () => {
      const user = userEvent.setup();
      renderAbout();
      section('Compliance oversight').style.setProperty('scroll-margin-top', '24px');

      await user.click(railLink('Compliance oversight'));

      expect(scrollTo).toHaveBeenCalledWith({ top: 1476, behavior: 'smooth' });
    });

    it('scrolls to the section top when the browser reports no scroll-margin-top', async () => {
      renderAbout();
      const link = railLink('Compliance oversight');
      // A browser without the property answers '' where jsdom answers '0px'. Stubbed after the
      // queries, which read computed styles of their own.
      vi.spyOn(window, 'getComputedStyle').mockReturnValue({
        scrollMarginTop: '',
      } as CSSStyleDeclaration);

      fireEvent.click(link);

      expect(scrollTo).toHaveBeenCalledWith({ top: 1500, behavior: 'smooth' });
    });
  });

  it('leaves a ctrl-click to the browser, for a new tab', () => {
    renderAbout();

    const notCancelled = fireEvent.click(railLink('Contact us'), { ctrlKey: true });

    expect(notCancelled).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(railLink('The assessment process')).toHaveAttribute('aria-current', 'true');
  });

  it('flags which Act applies in a note', () => {
    renderAbout();

    expect(within(section('The assessment process')).getByRole('note')).toHaveTextContent(
      'Which Act applies',
    );
  });

  describe('legislation', () => {
    it('lists the 2002 Act before the 2018 one', () => {
      renderAbout();

      expect(
        within(section('Legislation'))
          .getAllByRole('heading', { level: 3 })
          .map((h) => h.textContent),
      ).toEqual(['2002 Environmental Assessment Act', '2018 Environmental Assessment Act']);
    });

    it('names each Act link by its year and opens it in a new tab', () => {
      renderAbout();

      const links = within(section('Legislation')).getAllByRole('link');
      expect(links.map((link) => [link.getAttribute('target'), link.getAttribute('rel')])).toEqual(
        Array(4).fill(['_blank', 'noopener noreferrer']),
      );
      // jsdom's name computation drops the space before each hidden span; browsers keep it.
      expect(links[0]).toHaveAccessibleName(
        /^The Act and regulations\s*\(2002 Act\)\s*\(opens in new tab\)$/,
      );
      expect(links[1]).toHaveAccessibleName(
        /^Process & procedures\s*\(2002 Act\)\s*\(opens in new tab\)$/,
      );
      expect(links[2]).toHaveAccessibleName(
        /^The Act and regulations\s*\(2018 Act\)\s*\(opens in new tab\)$/,
      );
      expect(links[3]).toHaveAccessibleName(
        /^Process & procedures\s*\(2018 Act\)\s*\(opens in new tab\)$/,
      );
    });

    it('points each card at its own Act', () => {
      renderAbout();

      const links = within(section('Legislation')).getAllByRole('link');
      expect(links[0]).toHaveAttribute(
        'href',
        'https://www2.gov.bc.ca/gov/content?id=1D2FF7DF6672482A84705D2519574C27',
      );
      expect(links[2]).toHaveAttribute(
        'href',
        'https://www2.gov.bc.ca/gov/content?id=B5737A3A620146219ABED73B5066DEC6',
      );
    });
  });

  it('links compliance policies in a new tab', () => {
    renderAbout();

    const link = within(section('Compliance oversight')).getByRole('link', {
      name: /^View Compliance & Enforcement Policies and Procedures\s*\(opens in new tab\)$/,
    });
    expect(link).toHaveAttribute(
      'href',
      'https://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/environmental-assessments/compliance-and-enforcement',
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  describe('contact', () => {
    it('sends feedback and compliance email in the same tab', () => {
      renderAbout();
      const contact = within(section('Contact us'));

      const feedback = contact.getByRole('link', { name: 'Submit your Feedback' });
      expect(feedback).toHaveAttribute('href', 'mailto:EAO.EPICsystem@gov.bc.ca');
      expect(feedback).not.toHaveAttribute('target');

      const compliance = contact.getByRole('link', { name: 'Email EAO Compliance' });
      expect(compliance).toHaveAttribute('href', 'mailto:EAO.compliance@gov.bc.ca');
      expect(compliance).not.toHaveAttribute('target');
    });

    it('opens the directory and violation report in a new tab', () => {
      renderAbout();
      const contact = within(section('Contact us'));

      const directory = contact.getByRole('link', {
        name: /^Visit EAO B\.C\. Government Directory\s*\(opens in new tab\)$/,
      });
      const violation = contact.getByRole('link', {
        name: /^Report a Natural Resource Violation\s*\(opens in new tab\)$/,
      });
      expect(directory).toHaveAttribute('target', '_blank');
      expect(violation).toHaveAttribute('target', '_blank');
      expect(violation).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
