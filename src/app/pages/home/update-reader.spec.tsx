import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeQueryClient, renderAt } from '../../../test-utils';
import {
  ACTIVITY_ROW,
  envelope,
  HOME_FEED,
  json,
  PENDING,
  stubFetch,
} from './home-fetch.spec-helper';
import { Home } from './home';

interface Answers {
  feed?: Response | typeof PENDING;
  byId?: Response | typeof PENDING;
  project?: Response | typeof PENDING;
}

function renderAtPath(path: string, answers: Answers = {}, staleTime = 0) {
  const requests = stubFetch((url) => {
    if (url.includes('dataset=RecentActivity') && url.includes('and[_id]=')) {
      return answers.byId ?? envelope([ACTIVITY_ROW]);
    }
    if (url.includes('dataset=HomeFeed')) return answers.feed ?? envelope(HOME_FEED);
    if (url.startsWith('/demi-projects/')) {
      return answers.project ?? json({ name: 'Cedar LNG', address: 'Kitimat' });
    }
    return undefined;
  });
  const view = renderAt(
    path,
    [
      { path: '/', Component: Home },
      { path: '/updates/:id', Component: Home },
      { path: '/p/:projId/*', Component: () => <p>project page</p> },
    ],
    { queryClient: makeQueryClient({ staleTime }) },
  );
  return { ...view, requests };
}

const reader = () => screen.findByRole('dialog');

describe('home update reader', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads a shared /updates/:id link cold, reading that one update', async () => {
    const { requests } = renderAtPath('/updates/u1');

    const dialog = await reader();
    expect(
      await within(dialog).findByRole('heading', { name: 'Application accepted for review' }),
    ).toBeInTheDocument();
    expect(
      requests.some(
        (url) => url.includes('dataset=RecentActivity&') && url.includes('and[_id]=u1'),
      ),
    ).toBe(true);
    expect(within(dialog).getByText('The application is complete.')).toBeInTheDocument();
    expect(within(dialog).getByText('Update')).toBeInTheDocument();
  });

  it('reads project, location and date, with the location added once the project lands', async () => {
    renderAtPath('/updates/u1');

    const dialog = await reader();
    expect(
      await within(dialog).findByText('Cedar LNG · Kitimat · September 15, 2026'),
    ).toBeInTheDocument();
  });

  it('shows project and date alone while the project read is pending', async () => {
    renderAtPath('/updates/u1', { project: PENDING });

    const dialog = await reader();
    expect(await within(dialog).findByText('Cedar LNG · September 15, 2026')).toBeInTheDocument();
  });

  it('opens from a feed card with the row already in hand', async () => {
    // The app's own five-minute staleTime, so the feed's copy of the row counts as fresh.
    const { requests, router } = renderAtPath('/', {}, 5 * 60 * 1000);

    await userEvent
      .setup()
      .click(await screen.findByRole('link', { name: /Application accepted/ }));

    const dialog = await reader();
    expect(
      within(dialog).getByRole('heading', { name: 'Application accepted for review' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/updates/u1');
    expect(requests.filter((url) => url.includes('and[_id]='))).toEqual([]);
  });

  it('closes to the home page from its close button', async () => {
    const { router } = renderAtPath('/updates/u1');

    await userEvent.setup().click(within(await reader()).getByRole('button', { name: 'Close' }));

    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on browser Back after opening from the feed', async () => {
    const { router } = renderAtPath('/');
    await userEvent
      .setup()
      .click(await screen.findByRole('link', { name: /Application accepted/ }));
    await reader();

    await router.navigate(-1);

    expect(router.state.location.pathname).toBe('/');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the Documents accordion collapsed until asked, then names the file', async () => {
    renderAtPath('/updates/u1');
    const dialog = await reader();
    const toggle = await within(dialog).findByRole('button', { name: 'Documents (1)' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      within(dialog).queryByRole('link', { name: 'acceptance-letter.pdf' }),
    ).not.toBeInTheDocument();

    await userEvent.setup().click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('link', { name: 'acceptance-letter.pdf' })).toHaveAttribute(
      'href',
      'https://example.com/files/acceptance-letter.pdf',
    );
  });

  it('drops a document URL with an unsafe scheme', async () => {
    renderAtPath('/updates/u1', {
      byId: envelope([{ ...ACTIVITY_ROW, documentUrl: 'javascript:alert(1)' }]),
    });
    const dialog = await reader();

    await within(dialog).findByText('The application is complete.');
    expect(within(dialog).queryByRole('button', { name: /^Documents/ })).not.toBeInTheDocument();
  });

  it('points its footer at the project and its documents', async () => {
    renderAtPath('/updates/u1');
    const dialog = await reader();

    expect(await within(dialog).findByRole('link', { name: 'View Project' })).toHaveAttribute(
      'href',
      '/p/eagle-1/overview',
    );
    expect(within(dialog).getByRole('link', { name: 'All project documents' })).toHaveAttribute(
      'href',
      '/p/eagle-1/documents?sortBy=-datePosted',
    );
  });

  it('leaves for the project page from its footer', async () => {
    const { router } = renderAtPath('/updates/u1');

    await userEvent
      .setup()
      .click(await within(await reader()).findByRole('link', { name: 'View Project' }));

    expect(await screen.findByText('project page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/p/eagle-1/overview');
  });

  it('holds a loading title while a cold read is in flight', async () => {
    // An id the feed does not hold, so only the cold read can answer it.
    renderAtPath('/updates/u9', { byId: PENDING });

    expect(
      within(await reader()).getByRole('heading', { name: 'Loading update' }),
    ).toBeInTheDocument();
  });

  it('says an unknown update is not available', async () => {
    renderAtPath('/updates/gone', { byId: envelope([]) });

    expect(
      await within(await reader()).findByText(/This update is not available\./),
    ).toBeInTheDocument();
  });

  it('says the update is unavailable when the read fails', async () => {
    renderAtPath('/updates/u9', { byId: json(null, 500) });

    expect(
      await within(await reader()).findByText('This update is unavailable right now.'),
    ).toBeInTheDocument();
  });
});
