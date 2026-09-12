import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADVANCED_FILTERS_ID } from './advanced-filters';
import { GridToolbar } from './grid-toolbar';
import type { GridColumn } from './types';

const columns: GridColumn[] = [
  { key: 'name', label: 'Name', link: true, locked: true },
  { key: 'type', label: 'Type' },
];

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('GridToolbar', () => {
  it('states the range, the total and what the rows are', () => {
    render(<GridToolbar noun="documents" page={2} pageSize={25} total={340} />);

    expect(screen.getByRole('status')).toHaveTextContent('26–50 of 340 documents');
  });

  it('says there are none rather than showing a range of nothing', () => {
    render(<GridToolbar noun="documents" page={1} pageSize={25} total={0} />);

    expect(screen.getByRole('status')).toHaveTextContent('No documents');
  });

  it('counts the applied filters on the More filters button', () => {
    render(
      <GridToolbar
        noun="documents"
        page={1}
        pageSize={25}
        total={10}
        filterCount={3}
        onTogglePanel={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: /more filters/i });
    expect(button).toHaveTextContent('3');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('names the panel it opens, and carries the hooks the parity gate drives', () => {
    render(
      <GridToolbar
        noun="documents"
        page={1}
        pageSize={25}
        total={10}
        columns={columns}
        onTogglePanel={vi.fn()}
      />,
    );

    const more = screen.getByRole('button', { name: /More filters/ });
    expect(more).toHaveAttribute('aria-controls', ADVANCED_FILTERS_ID);
    expect(more).toHaveAttribute('data-tour', 'more');
    expect(screen.getByRole('button', { name: 'Columns' })).toHaveAttribute('data-tour', 'columns');
    expect(screen.getByRole('button', { name: /Copy link/ })).toHaveAttribute('data-tour', 'copy');
  });

  it('marks More filters expanded while the panel is open', () => {
    render(
      <GridToolbar
        noun="documents"
        page={1}
        pageSize={25}
        total={10}
        panelOpen
        onTogglePanel={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /more filters/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('locks the column a row is opened from', async () => {
    const user = userEvent.setup();
    render(
      <GridToolbar
        noun="documents"
        page={1}
        pageSize={25}
        total={10}
        columns={columns}
        onToggleColumn={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /columns/i }));

    const locked = screen.getByRole('checkbox', { name: 'Name' });
    expect(locked).toBeDisabled();
    expect(locked).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Type' })).toBeEnabled();
  });

  it('confirms a copied link in place and goes back to itself', async () => {
    vi.useFakeTimers();
    const writeText = stubClipboard();
    render(<GridToolbar noun="documents" page={1} pageSize={25} total={10} />);

    // fireEvent, not userEvent: its key-by-key timing fights the fake clock this test owns.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy link to this view/i }));
    });

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByRole('button', { name: /link copied/i })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: /copy link to this view/i })).toBeInTheDocument();
  });

  it('leaves the button alone when the clipboard refuses', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
      configurable: true,
    });
    render(<GridToolbar noun="documents" page={1} pageSize={25} total={10} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy link to this view/i }));
    });

    expect(screen.queryByRole('button', { name: /link copied/i })).not.toBeInTheDocument();
  });

  it('swaps to the selection state without changing the bar height', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const onClearSelection = vi.fn();
    const { rerender, container } = render(
      <GridToolbar noun="documents" page={1} pageSize={25} total={10} />,
    );
    const idle = container.querySelector('.display-grid__bar');

    rerender(
      <GridToolbar
        noun="documents"
        page={1}
        pageSize={25}
        total={10}
        selectedCount={3}
        onDownload={onDownload}
        onClearSelection={onClearSelection}
      />,
    );

    // Same bar class in both states, so the height rule that holds the rows still applies.
    expect(container.querySelector('.display-grid__bar')).toBe(idle);
    expect(idle).toHaveClass('display-grid__bar--selected');
    expect(screen.getByRole('status')).toHaveTextContent('3 selected');
    expect(
      screen.queryByRole('button', { name: /copy link to this view/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Download 3' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onDownload).toHaveBeenCalled();
    expect(onClearSelection).toHaveBeenCalled();
  });
});
