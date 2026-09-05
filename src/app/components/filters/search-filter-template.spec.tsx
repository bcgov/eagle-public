import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SearchFilterTemplate } from './search-filter-template';

function renderTemplate(searchAsYouType?: boolean) {
  const onSearch = vi.fn();
  render(
    <MemoryRouter>
      <SearchFilterTemplate onSearch={onSearch} searchAsYouType={searchAsYouType} />
    </MemoryRouter>,
  );
  return onSearch;
}

describe('SearchFilterTemplate keyword search', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps the Search button and click-to-search without the prop (Documents tab)', () => {
    vi.useFakeTimers();
    const onSearch = renderTemplate(false);

    expect(screen.getByRole('button', { name: /Search/ })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Type keyword to search'), {
      target: { value: 'water' },
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Search/ }));
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: 'water' }));
  });

  it('hides the Search button and searches 300ms after the last keystroke (Updates tab)', () => {
    vi.useFakeTimers();
    const onSearch = renderTemplate(true);

    expect(screen.queryByRole('button', { name: /Search/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Type keyword to search'), {
      target: { value: 'water' },
    });
    expect(onSearch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: 'water' }));
  });

  it('still fires immediately on Enter, cancelling any pending debounce', () => {
    vi.useFakeTimers();
    const onSearch = renderTemplate(true);

    const box = screen.getByPlaceholderText('Type keyword to search');
    fireEvent.change(box, { target: { value: 'water' } });
    fireEvent.keyUp(box, { key: 'Enter' });

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: 'water' }));

    // The debounce timer the onChange armed before Enter must not still be pending.
    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('clearing the box to empty also searches', () => {
    vi.useFakeTimers();
    const onSearch = renderTemplate(true);

    const box = screen.getByPlaceholderText('Type keyword to search');
    fireEvent.change(box, { target: { value: 'water' } });
    fireEvent.change(box, { target: { value: '' } });
    act(() => vi.advanceTimersByTime(300));

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ keywords: '' }));
  });
});
