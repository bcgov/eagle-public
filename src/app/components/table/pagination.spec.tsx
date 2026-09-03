import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './pagination';

/** 50 items at 10 a page: five pages, so both edges are reachable. */
function renderPager(currentPage: number) {
  const onPageChange = vi.fn();
  render(
    <Pagination
      currentPage={currentPage}
      pageSize={10}
      totalItems={50}
      onPageChange={onPageChange}
    />,
  );
  return onPageChange;
}

describe('Pagination', () => {
  it('renders every control as a button rather than a link', () => {
    renderPager(2);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to page 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
  });

  it('disables Previous on the first page', () => {
    renderPager(1);

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
  });

  it('disables Next on the last page', () => {
    renderPager(5);

    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
  });

  /** A `<a role="button">` greyed out by CSS still takes focus; a disabled button does not. */
  it('keeps the disabled edge control out of the tab order', async () => {
    renderPager(1);

    await userEvent.tab();

    expect(screen.getByRole('button', { name: 'Go to page 1' })).toHaveFocus();
  });

  it.each(['{Enter}', ' '])('pages on %s with no key handler of its own', async (key) => {
    const onPageChange = renderPager(1);
    screen.getByRole('button', { name: 'Go to page 2' }).focus();

    await userEvent.keyboard(key);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('does not re-request the page already shown', async () => {
    const onPageChange = renderPager(2);

    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));

    expect(onPageChange).not.toHaveBeenCalled();
  });
});
