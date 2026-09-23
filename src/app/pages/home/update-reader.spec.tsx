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

function renderAtPath(path: Parameters<typeof renderAt>[0], answers: Answers = {}) {
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
    { queryClient: makeQueryClient() },
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

  it('opens from a feed card with the row in hand while the full update loads', async () => {
    const { router } = renderAtPath('/', { byId: PENDING });

    await userEvent
      .setup()
      .click(await screen.findByRole('link', { name: /Application accepted/ }));

    const dialog = await reader();
    expect(
      within(dialog).getByRole('heading', { name: 'Application accepted for review' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/updates/u1');
  });

  it('renders the full update: category, location, image, attachments and ENGAGE link', async () => {
    renderAtPath('/updates/u1', {
      byId: envelope([
        {
          ...ACTIVITY_ROW,
          category: 'Engagement',
          location: 'Terrace',
          publishDate: '2026-09-18T12:00:00.000Z',
          status: 'published',
          featuredImage: { document: 'img-1', alt: 'Open house at the hall' },
          attachments: [{ _id: 'doc-1', displayName: 'Notice.pdf' }],
          engagementUrl: 'https://engage.eao.gov.bc.ca/cedar',
        },
      ]),
    });
    const dialog = await reader();

    expect(await within(dialog).findByText('Engagement')).toBeInTheDocument();
    expect(
      await within(dialog).findByText('Cedar LNG · Terrace · September 18, 2026'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Open house at the hall' })).toBeInTheDocument();
    expect(
      within(dialog).getByRole('link', {
        name: /Take part in the engagement \(opens in new tab\)/,
      }),
    ).toHaveAttribute('href', 'https://engage.eao.gov.bc.ca/cedar');

    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Documents (2)' }));
    expect(
      within(dialog).getByRole('link', { name: /^Notice\.pdf\s*\(opens in new tab\)$/ }),
    ).toBeInTheDocument();
  });

  it('names the subject in place of a project', async () => {
    renderAtPath('/updates/u1', {
      byId: envelope([{ ...ACTIVITY_ROW, project: null, category: 'Corporate', subject: 'Fees' }]),
    });
    const dialog = await reader();

    expect(await within(dialog).findByText('About: Fees')).toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: 'View Project' })).not.toBeInTheDocument();
  });

  it('says a hidden update is no longer available, linking the project the feed named', async () => {
    renderAtPath('/', { byId: envelope([]) });
    await userEvent
      .setup()
      .click(await screen.findByRole('link', { name: /Application accepted/ }));
    const dialog = await reader();

    expect(
      await within(dialog).findByText('This update is no longer available.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Go to the project' })).toHaveAttribute(
      'href',
      '/p/eagle-1/overview',
    );
    expect(within(dialog).queryByText('The application is complete.')).not.toBeInTheDocument();
  });

  it('links the project a link handed over in route state', async () => {
    renderAtPath([{ pathname: '/updates/gone', state: { projectId: 'eagle-7' } }], {
      byId: envelope([]),
    });
    const dialog = await reader();

    expect(await within(dialog).findByRole('link', { name: 'Go to the project' })).toHaveAttribute(
      'href',
      '/p/eagle-7/overview',
    );
  });

  it('keeps showing the feed row when the full read fails', async () => {
    renderAtPath('/', { byId: json(null, 500) });
    await userEvent
      .setup()
      .click(await screen.findByRole('link', { name: /Application accepted/ }));
    const dialog = await reader();

    // The failed read settles before this passes: the error note would replace the body.
    await waitFor(() =>
      expect(within(dialog).queryByText(/unavailable right now/)).not.toBeInTheDocument(),
    );
    expect(await within(dialog).findByText('The application is complete.')).toBeInTheDocument();
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
    expect(within(dialog).queryByRole('link', { name: /acceptance-letter\.pdf/ })).toBeNull();

    await userEvent.setup().click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // The file opens in a new tab, and the link says so.
    expect(
      within(dialog).getByRole('link', { name: /^acceptance-letter\.pdf\s*\(opens in new tab\)$/ }),
    ).toHaveAttribute('href', 'https://example.com/files/acceptance-letter.pdf');
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

  it('says an unknown update is no longer available, and points at recent updates', async () => {
    renderAtPath('/updates/gone', { byId: envelope([]) });
    const dialog = await reader();

    expect(
      await within(dialog).findByText('This update is no longer available.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: 'Go to the project' })).toBeNull();
    expect(within(dialog).getByRole('link', { name: 'See recent updates' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('says the update is unavailable when the read fails', async () => {
    renderAtPath('/updates/u9', { byId: json(null, 500) });

    expect(
      await within(await reader()).findByText('This update is unavailable right now.'),
    ).toBeInTheDocument();
  });
});
