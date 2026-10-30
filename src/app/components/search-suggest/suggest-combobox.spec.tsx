import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { RecordType } from 'app/components/display-grid/use-grid-url-state';
import { TYPEAHEAD_DEBOUNCE_MS } from 'app/components/filters/typeahead';
import { loadConfig } from 'app/config/config';
import { json } from 'app/pages/home/home-fetch.spec-helper';
import { makeQueryClient, renderAt } from '../../../test-utils';
import { SuggestCombobox } from './suggest-combobox';

type FetchInit = RequestInit | undefined;

let fetchMock: ReturnType<
  typeof vi.fn<(input: RequestInfo | URL, init?: FetchInit) => Promise<Response>>
>;

function answer(items: unknown[]): void {
  fetchMock.mockImplementation(async () => json({ items }));
}

function hang(): void {
  fetchMock.mockImplementation(() => new Promise(() => undefined));
}

/** Holds the next answers until the returned function lands them. */
function holdAnswer(items: unknown[]): () => Promise<void> {
  let land: () => void = () => undefined;
  const landed = new Promise<void>((resolve) => (land = resolve));
  fetchMock.mockImplementation(async () => {
    await landed;
    return json({ items });
  });
  return async () => {
    land();
    await act(() => vi.advanceTimersByTimeAsync(0));
  };
}

function Harness({ record, onSubmit }: { record: RecordType; onSubmit: () => void }) {
  const [value, setValue] = useState('');
  const [current, setCurrent] = useState(record);
  return (
    <>
      <SuggestCombobox
        record={current}
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        inputProps={{ 'aria-label': 'Search by keyword' }}
      />
      <button type="button" onClick={() => setCurrent('notifications')}>
        Switch to notifications
      </button>
    </>
  );
}

function renderBox(
  record: RecordType = 'projects',
  { queryClient }: { queryClient?: QueryClient } = {},
) {
  const onSubmit = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const view = renderAt(
    '/',
    [
      { path: '/', element: <Harness record={record} onSubmit={onSubmit} /> },
      { path: '*', element: <p>elsewhere</p> },
    ],
    { queryClient },
  );
  return {
    ...view,
    user,
    onSubmit,
    box: screen.getByRole('combobox', { name: 'Search by keyword' }),
  };
}

/** Lets the typing pause run out and the answer land. */
async function pause(ms = TYPEAHEAD_DEBOUNCE_MS): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
  await act(() => vi.advanceTimersByTimeAsync(0));
}

function suggestUrls(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), 'https://site.invalid'))
    .filter((url) => url.pathname.endsWith('/suggest'));
}

const CEDAR = { id: 'p1', eagleId: 'cedar-lng', name: 'Cedar LNG' };
const DOCUMENTS_NOTE =
  'Suggestions match document names. Press Enter to also search inside documents.';

beforeEach(() => {
  vi.useFakeTimers();
  // Testing Library drains its event wrapper on a setTimeout it only advances when `jest` exists.
  vi.stubGlobal('jest', { advanceTimersByTime: vi.advanceTimersByTime });
  fetchMock = vi.fn(async () => json({ items: [] }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  window.__env = {};
  await loadConfig();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SuggestCombobox', () => {
  it('asks nothing for a single character', async () => {
    const { user, box } = renderBox();

    await user.type(box, 'c');
    await pause();

    expect(suggestUrls()).toHaveLength(0);
  });

  it('asks once typing has paused for 300 ms, not before', async () => {
    const { user, box } = renderBox();

    await user.type(box, 'ce');
    await act(() => vi.advanceTimersByTimeAsync(TYPEAHEAD_DEBOUNCE_MS - 1));
    expect(suggestUrls()).toHaveLength(0);

    await pause(1);
    expect(suggestUrls().map((url) => url.searchParams.get('q'))).toEqual(['ce']);
  });

  it('sends the keyword lower-cased', async () => {
    const { user, box } = renderBox();

    await user.type(box, 'CeDar');
    await pause();

    expect(suggestUrls().map((url) => url.searchParams.get('q'))).toEqual(['cedar']);
  });

  it('opens the project page on ArrowDown then Enter', async () => {
    answer([CEDAR]);
    const { user, box, router } = renderBox();

    await user.type(box, 'ce');
    await pause();
    await user.keyboard('{ArrowDown}{Enter}');

    expect(router.state.location.pathname).toBe('/p/cedar-lng');
  });

  it('runs the form search on Enter with no suggestion picked', async () => {
    answer([CEDAR]);
    const { user, box, router, onSubmit } = renderBox();

    await user.type(box, 'ce');
    await pause();
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/');
  });

  it('runs the form search on Enter with the list closed', async () => {
    answer([CEDAR]);
    const { user, box, onSubmit } = renderBox();

    await user.type(box, 'ce');
    await pause();
    await user.keyboard('{Escape}{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('leaves an Enter that confirms an input method composition alone', async () => {
    answer([CEDAR]);
    const { user, box, onSubmit } = renderBox();

    await user.type(box, 'ce');
    await pause();
    fireEvent.keyDown(box, { key: 'Enter', isComposing: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('leaves an Enter flagged only by the input method key code alone', async () => {
    answer([CEDAR]);
    const { user, box, onSubmit } = renderBox();

    await user.type(box, 'ce');
    await pause();
    fireEvent.keyDown(box, { key: 'Enter', keyCode: 229 });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes the list on Escape and keeps the typed text', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();

    await user.type(box, 'ce');
    await pause();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(box).toHaveValue('ce');
  });

  it('closes on blur and opens again on focus while the text is long enough', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();

    await user.type(box, 'ce');
    await pause();
    await user.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await user.click(box);
    expect(screen.getByRole('option', { name: 'Cedar LNG' })).toBeVisible();
  });

  it('keeps focus in the box while a row is pressed, then opens the row on release', async () => {
    answer([CEDAR]);
    const { user, box, router } = renderBox();

    await user.type(box, 'ce');
    await pause();
    const option = screen.getByRole('option', { name: 'Cedar LNG' });
    await user.pointer({ keys: '[MouseLeft>]', target: option });
    expect(box).toHaveFocus();
    expect(option).toBeVisible();

    await user.pointer({ keys: '[/MouseLeft]', target: option });
    expect(router.state.location.pathname).toBe('/p/cedar-lng');
  });

  it('wraps the arrow keys through the footer row', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();
    await user.type(box, 'ce');
    await pause();
    const footer = 'Search all projects for “ce”';
    const selected = () => screen.getByRole('option', { selected: true });

    await user.keyboard('{ArrowDown}');
    expect(selected()).toHaveAccessibleName('Cedar LNG');
    await user.keyboard('{ArrowDown}');
    expect(selected()).toHaveAccessibleName(footer);
    await user.keyboard('{ArrowDown}');
    expect(selected()).toHaveAccessibleName('Cedar LNG');
    await user.keyboard('{ArrowUp}');
    expect(selected()).toHaveAccessibleName(footer);
  });

  it('points aria-activedescendant at the highlighted option', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();

    await user.type(box, 'ce');
    await pause();
    await user.keyboard('{ArrowDown}');
    const option = screen.getByRole('option', { name: 'Cedar LNG' });

    expect(option).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', option.id);
  });

  it('drops the highlight once the next keyword settles', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();
    await user.type(box, 'ce');
    await pause();

    hang();
    await user.type(box, 'd');
    await user.keyboard('{ArrowDown}');
    expect(box).toHaveAttribute('aria-activedescendant');
    await pause();

    expect(box).not.toHaveAttribute('aria-activedescendant');
  });

  it('drops a highlight set on the last rows once the answer for the new keyword lands', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();
    await user.type(box, 'ce');
    await pause();

    const land = holdAnswer([{ id: 'p3', eagleId: 'cedarvale', name: 'Cedarvale Mine' }]);
    await user.type(box, 'd');
    await pause();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Cedar LNG' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await land();

    expect(screen.getByRole('option', { name: 'Cedarvale Mine' })).toBeVisible();
    expect(screen.queryByRole('option', { selected: true })).not.toBeInTheDocument();
    expect(box).not.toHaveAttribute('aria-activedescendant');
  });

  it('drops the highlight when the list closes', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();
    await user.type(box, 'ce');
    await pause();

    await user.keyboard('{ArrowDown}{Escape}{ArrowDown}');

    expect(screen.getByRole('listbox')).toBeVisible();
    expect(box).not.toHaveAttribute('aria-activedescendant');
  });

  it('announces how many suggestions arrived', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();

    await user.type(box, 'ce');
    await pause();

    expect(screen.getByText('1 suggestion')).toBeInTheDocument();
  });

  it('announces no count while the last rows stand in for the new keyword', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();
    await user.type(box, 'ce');
    await pause();

    const land = holdAnswer([CEDAR, { id: 'p3', eagleId: 'cedarvale', name: 'Cedarvale Mine' }]);
    await user.type(box, 'd');
    await pause();
    expect(screen.queryByText(/suggestions?$/)).not.toBeInTheDocument();

    await land();
    expect(screen.getByText('2 suggestions')).toBeInTheDocument();
  });

  it('runs the form search from the footer row', async () => {
    const { user, box, router, onSubmit } = renderBox('documents');

    await user.type(box, 'coal');
    await pause();
    await user.click(screen.getByRole('option', { name: 'Search all documents for “coal”' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('suggests comment periods by label and opens the period page', async () => {
    answer([
      {
        id: 'cp1',
        informationLabel: 'Cedar LNG draft decision',
        projectEagleId: 'cedar-lng',
        projectName: 'Cedar LNG',
      },
    ]);
    const { user, box, router } = renderBox('commentPeriods');

    await user.type(box, 'cedar');
    await pause();

    expect(suggestUrls()[0].searchParams.get('kind')).toBe('comment-periods');
    expect(box).not.toHaveAttribute('aria-describedby');
    await user.click(screen.getByRole('option', { name: 'Cedar LNG draft decision, Cedar LNG' }));
    expect(router.state.location.pathname).toBe('/p/cedar-lng/cp/cp1/details');
  });

  it('names a comment period with a missing or blank label by its project', async () => {
    answer([
      { id: 'cp2', projectEagleId: 'cedar-lng', projectName: 'Cedar LNG' },
      { id: 'cp3', informationLabel: '', projectEagleId: 'centerm', projectName: 'Centerm' },
    ]);
    const { user, box } = renderBox('commentPeriods');

    await user.type(box, 'ce');
    await pause();

    expect(screen.getByRole('option', { name: 'Cedar LNG' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Centerm' })).toBeInTheDocument();
  });

  it('describes the box by the note only while the note shows', async () => {
    const { user, box } = renderBox('documents');

    await user.type(box, 'coal');
    await pause();
    expect(box).toHaveAccessibleDescription(DOCUMENTS_NOTE);

    await user.keyboard('{Escape}');
    expect(box).not.toHaveAttribute('aria-describedby');
  });

  it('gives a kind with no note no description', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();

    await user.type(box, 'ce');
    await pause();

    expect(box).not.toHaveAttribute('aria-describedby');
  });

  it('drops the request a newer keyword supersedes', async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal as AbortSignal;
          signals.push(signal);
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const { user, box } = renderBox();

    await user.type(box, 'ce');
    await pause();
    await user.type(box, 'd');
    await pause();

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('leaves the typed start regular and bolds the rest of the name', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();

    await user.type(box, 'ce');
    await pause();
    const option = screen.getByRole('option', { name: 'Cedar LNG' });

    expect(within(option).getByText('dar LNG', { selector: 'b' })).toBeInTheDocument();
    expect(within(option).getByText('Ce', { selector: 'span' })).toBeInTheDocument();
  });

  it('bolds nothing when the name does not start with the typed text', async () => {
    answer([{ id: 'p2', eagleId: 'kitimat', name: 'Kitimat LNG' }]);
    const { user, box } = renderBox();

    await user.type(box, 'ce');
    await pause();
    const option = screen.getByRole('option', { name: 'Kitimat LNG' });

    expect(within(option).queryByText(/./, { selector: 'b' })).not.toBeInTheDocument();
  });

  it('shows the name in its own case and the footer in the typed case', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();

    await user.type(box, 'CeDar');
    await pause();
    const option = screen.getByRole('option', { name: 'Cedar LNG' });

    expect(within(option).getByText('Cedar', { selector: 'span' })).toBeInTheDocument();
    expect(within(option).getByText('LNG', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Search all projects for “CeDar”' })).toBeVisible();
  });

  it('opens a document with no project page as its file in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    answer([{ id: 'd1', displayName: 'Coal report' }]);
    const { user, box, router } = renderBox('documents');

    await user.type(box, 'coal');
    await pause();
    await user.click(screen.getByRole('option', { name: 'Coal report' }));

    expect(open).toHaveBeenCalledWith(
      '/demi-search/documents/d1/download?redirect=1',
      '_blank',
      'noopener',
    );
    expect(router.state.location.pathname).toBe('/');
  });

  it('searches for a document instead when its file address is not safe to open', async () => {
    window.__env = { logLevel: 4, SEARCH_API_PATH: 'javascript:alert(1)//' };
    await loadConfig();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    answer([{ id: 'd1', displayName: 'Coal report' }]);
    const { user, box, router } = renderBox('documents');

    await user.type(box, 'coal');
    await pause();
    await user.click(screen.getByRole('option', { name: 'Coal report' }));

    expect(open).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe('/search');
    expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toEqual({
      record: 'documents',
      keywords: 'Coal report',
    });
  });

  it('opens a document on a project page at that project documents tab, narrowed by the text', async () => {
    answer([
      { id: 'd2', displayName: 'Coal plan', projectEagleId: 'coal-mine', projectName: 'Coal Mine' },
    ]);
    const { user, box, router } = renderBox('documents');

    await user.type(box, 'coal');
    await pause();
    await user.click(screen.getByRole('option', { name: 'Coal plan, Coal Mine' }));

    expect(router.state.location.pathname).toBe('/p/coal-mine/documents');
    expect(router.state.location.search).toBe('?keywords=coal');
  });

  it('opens an update at the project it belongs to', async () => {
    answer([
      {
        id: 'u1',
        headline: 'Cedar site visit',
        projectEagleId: 'cedar-lng',
        projectName: 'Cedar LNG',
      },
    ]);
    const { user, box, router } = renderBox('activities');

    await user.type(box, 'cedar');
    await pause();
    await user.click(screen.getByRole('option', { name: 'Cedar site visit, Cedar LNG' }));

    expect(router.state.location.pathname).toBe('/p/cedar-lng');
  });

  it('opens a notification at its own page when it has no project', async () => {
    answer([{ id: 'n1', name: 'Coal notice' }]);
    const { user, box, router } = renderBox('notifications');

    await user.type(box, 'coal');
    await pause();
    await user.click(screen.getByRole('option', { name: 'Coal notice' }));

    expect(router.state.location.pathname).toBe('/pn/n1');
  });

  it('drops the documents note at once when suggestions fail, even where retries are on', async () => {
    fetchMock.mockImplementation(async () => json(null, 500));
    const queryClient = makeQueryClient({ retry: 3, retryDelay: 1000 });
    const { user, box } = renderBox('documents', { queryClient });

    await user.type(box, 'coal');
    await pause();

    expect(screen.queryByText(DOCUMENTS_NOTE)).not.toBeInTheDocument();
  });

  it('keeps the last rows up while the next keyword of the same kind loads', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();
    await user.type(box, 'ce');
    await pause();

    hang();
    await user.type(box, 'd');
    await pause();

    expect(screen.getByRole('option', { name: 'Cedar LNG' })).toBeVisible();
  });

  it('shows no rows from the previous keyword after the box is cleared', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();
    await user.type(box, 'ce');
    await pause();
    expect(screen.getByRole('option', { name: 'Cedar LNG' })).toBeVisible();

    await user.clear(box);
    await pause();
    await user.type(box, 'ka');

    expect(screen.getByRole('option', { name: 'Search all projects for “ka”' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Cedar LNG' })).not.toBeInTheDocument();
  });

  it('never shows one record type rows under another while the new ones load', async () => {
    answer([CEDAR]);
    const { user, box } = renderBox();
    await user.type(box, 'ce');
    await pause();
    expect(screen.getByRole('option', { name: 'Cedar LNG' })).toBeInTheDocument();

    hang();
    await user.click(screen.getByRole('button', { name: 'Switch to notifications' }));
    await user.click(box);
    await user.keyboard('{ArrowDown}');

    expect(screen.queryByRole('option', { name: /Cedar LNG/ })).not.toBeInTheDocument();
  });
});
