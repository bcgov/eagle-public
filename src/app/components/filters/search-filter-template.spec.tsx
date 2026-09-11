import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SearchFilterTemplate } from './search-filter-template';
import { DateFilterDefinition, FilterObject, FilterType } from './filter-object';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('app/analytics/analytics', () => ({ track }));

interface Options {
  advancedFilters?: boolean;
  showAdvancedFilters?: boolean;
  filters?: FilterObject[];
}

const dateFilter = new FilterObject(
  'datePosted',
  FilterType.DateRange,
  'Date Posted',
  new DateFilterDefinition('datePostedStart', 'Start Date', 'datePostedEnd', 'End Date'),
);

function renderTemplate(options: Options = {}) {
  const onSearch = vi.fn();
  const { container, unmount } = render(
    <MemoryRouter>
      <SearchFilterTemplate
        onSearch={onSearch}
        advancedFilters={options.advancedFilters}
        showAdvancedFilters={options.showAdvancedFilters}
        filters={options.filters}
      />
    </MemoryRouter>,
  );
  return { onSearch, container, unmount };
}

function typeKeyword(value: string) {
  fireEvent.change(screen.getByPlaceholderText('Type keyword to search'), { target: { value } });
}

describe('SearchFilterTemplate keyword search', () => {
  afterEach(() => vi.useRealTimers());

  it('offers no Search button: typing is the only way to run a search', () => {
    renderTemplate({ advancedFilters: true, filters: [dateFilter] });

    expect(screen.queryByRole('button', { name: /Search/ })).not.toBeInTheDocument();
  });

  it('searches 300ms after the last keystroke', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    typeKeyword('water');
    expect(onSearch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: 'water' }));
  });

  it('ignores a single character, and searches once it has two', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    typeKeyword('w');
    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).not.toHaveBeenCalled();

    typeKeyword('wa');
    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: 'wa' }));
  });

  it('backspacing below two characters searches for nothing, rather than leaving the last results', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    typeKeyword('pe');
    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: 'pe' }));

    typeKeyword('p');
    act(() => vi.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: '' }));
  });

  it('a single space is an empty keyword, not a one-character one', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    typeKeyword('water');
    act(() => vi.advanceTimersByTime(300));

    typeKeyword(' ');
    act(() => vi.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: '' }));
  });

  it('does not search when the box has never searched for anything', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    typeKeyword('w');
    typeKeyword('');
    act(() => vi.advanceTimersByTime(300));

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('coalesces two keystrokes inside the debounce window into one search', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    typeKeyword('wa');
    act(() => vi.advanceTimersByTime(200));
    typeKeyword('wat');
    act(() => vi.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: 'wat' }));
  });

  it('fires immediately on Enter, cancelling any pending debounce', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    const box = screen.getByPlaceholderText('Type keyword to search');
    fireEvent.change(box, { target: { value: 'water' } });
    fireEvent.keyUp(box, { key: 'Enter' });

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: 'water' }));

    // The debounce timer the onChange armed before Enter must not still be pending.
    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('searches on Enter for a keyword too short for the typeahead floor', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    const box = screen.getByPlaceholderText('Type keyword to search');
    fireEvent.change(box, { target: { value: 'w' } });
    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.keyUp(box, { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: 'w' }));
  });

  it('clearing the box to empty also searches', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    typeKeyword('water');
    act(() => vi.advanceTimersByTime(300));
    typeKeyword('');
    act(() => vi.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: '' }));
  });

  it('the clear button empties the box and searches at once', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    typeKeyword('water');
    act(() => vi.advanceTimersByTime(300));

    fireEvent.click(screen.getByTitle('Clear search'));

    expect(onSearch).toHaveBeenCalledTimes(2);
    expect(onSearch).toHaveBeenLastCalledWith(expect.objectContaining({ keywords: '' }));
  });

  it('tells a screen reader the results update as you type', () => {
    renderTemplate();

    const box = screen.getByPlaceholderText('Type keyword to search');
    const hint = screen.getByText('Results update as you type');

    expect(hint).toHaveClass('visually-hidden');
    expect(box).toHaveAttribute('aria-describedby', hint.id);
  });
});

describe('SearchFilterTemplate analytics', () => {
  beforeEach(() => track.mockClear());
  afterEach(() => vi.useRealTimers());

  function searchEvents() {
    return track.mock.calls.filter(([name]) => name === 'Search Executed');
  }

  it('records one event with the whole word, not one per typed prefix', () => {
    vi.useFakeTimers();
    renderTemplate();

    for (const prefix of ['c', 'ca', 'car', 'cari', 'carib', 'caribo', 'caribou']) {
      typeKeyword(prefix);
      act(() => vi.advanceTimersByTime(300));
    }
    act(() => vi.advanceTimersByTime(1500));

    expect(searchEvents()).toHaveLength(1);
    expect(searchEvents()[0][1]).toEqual(
      expect.objectContaining({ search_term: 'caribou', has_keywords: true }),
    );
  });

  it('records the event on Enter without waiting, and not again afterwards', () => {
    vi.useFakeTimers();
    renderTemplate();

    const box = screen.getByPlaceholderText('Type keyword to search');
    fireEvent.change(box, { target: { value: 'caribou' } });
    fireEvent.keyUp(box, { key: 'Enter' });

    expect(searchEvents()).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1500));
    expect(searchEvents()).toHaveLength(1);
  });

  it('records nothing for a keyword too short to search', () => {
    vi.useFakeTimers();
    renderTemplate();

    typeKeyword('c');
    act(() => vi.advanceTimersByTime(1500));

    expect(searchEvents()).toHaveLength(0);
  });

  it('records a search whose reader leaves before the pause is over', () => {
    vi.useFakeTimers();
    const { unmount } = renderTemplate();

    typeKeyword('caribou');
    act(() => vi.advanceTimersByTime(300));
    act(() => vi.advanceTimersByTime(100));
    act(() => unmount());

    expect(searchEvents()).toHaveLength(1);
    expect(searchEvents()[0][1]).toEqual(expect.objectContaining({ search_term: 'caribou' }));
  });

  it('records nothing when the reader leaves before the debounced search has gone out', () => {
    vi.useFakeTimers();
    const { onSearch, unmount } = renderTemplate();

    typeKeyword('caribou');
    act(() => vi.advanceTimersByTime(100));
    act(() => unmount());

    expect(onSearch).not.toHaveBeenCalled();
    expect(searchEvents()).toHaveLength(0);
  });

  it('records nothing extra for an edit reverted inside the debounce window', () => {
    vi.useFakeTimers();
    const { onSearch } = renderTemplate();

    typeKeyword('wa');
    act(() => vi.advanceTimersByTime(300));
    act(() => vi.advanceTimersByTime(1500));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(searchEvents()).toHaveLength(1);

    typeKeyword('wax');
    act(() => vi.advanceTimersByTime(100));
    typeKeyword('wa');
    act(() => vi.advanceTimersByTime(1500));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(searchEvents()).toHaveLength(1);
  });
});

describe('SearchFilterTemplate filter changes', () => {
  afterEach(() => vi.useRealTimers());

  it('a filter set inside the debounce window keeps the keyword and the filter', () => {
    vi.useFakeTimers();
    const { onSearch, container } = renderTemplate({
      advancedFilters: true,
      filters: [dateFilter],
    });

    typeKeyword('wa');
    act(() => vi.advanceTimersByTime(100));

    const startDate = container.querySelector('#datePostedStart') as HTMLInputElement;
    fireEvent.change(startDate, { target: { value: '2024-01-01' } });
    act(() => vi.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: 'wa',
        filters: { datePostedStart: new Date('2024-01-01').toISOString() },
      }),
    );
  });

  it('a search armed before the filters loaded still carries them', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const noFilters: FilterObject[] = [];
    const loadedFilters = [dateFilter];
    const view = (filters: FilterObject[]) => (
      <MemoryRouter initialEntries={['/?datePostedStart=2024-01-01']}>
        <SearchFilterTemplate onSearch={onSearch} advancedFilters filters={filters} />
      </MemoryRouter>
    );
    const { rerender } = render(view(noFilters));

    typeKeyword('wa');
    act(() => vi.advanceTimersByTime(100));
    // The host's filter list arrives from the API mid-debounce and seeds itself from the URL.
    act(() => rerender(view(loadedFilters)));
    act(() => vi.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: 'wa',
        filters: { datePostedStart: new Date('2024-01-01').toISOString() },
      }),
    );
  });

  it('enables Reset Filters once the keyword box holds a search', () => {
    vi.useFakeTimers();
    renderTemplate({ advancedFilters: true, showAdvancedFilters: true, filters: [dateFilter] });

    const reset = screen.getByRole('button', { name: 'Reset Filters' });
    expect(reset).toBeDisabled();

    typeKeyword('water');
    act(() => vi.advanceTimersByTime(300));

    expect(reset).toBeEnabled();
  });
});
