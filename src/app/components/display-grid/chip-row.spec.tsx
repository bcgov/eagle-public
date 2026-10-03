import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChipRow, type GridChip } from './chip-row';

const chips: GridChip[] = [
  { id: 'keywords', label: 'Search', value: 'sediment' },
  { id: 'type', label: 'Type', value: 'Amendment' },
  { id: 'type', label: 'Type', value: 'Inspection Record' },
];

describe('ChipRow', () => {
  it('renders nothing when there is nothing to clear', () => {
    const { container } = render(
      <ChipRow chips={[]} onRemove={() => undefined} onClearAll={() => undefined} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('gives every value of a multi-value filter its own chip', () => {
    render(<ChipRow chips={chips} onRemove={() => undefined} onClearAll={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Remove Type Amendment' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove Type Inspection Record' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Search sediment' })).toBeInTheDocument();
  });

  it('removes one value of a filter without touching the other', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<ChipRow chips={chips} onRemove={onRemove} onClearAll={() => undefined} />);

    await user.click(screen.getByRole('button', { name: 'Remove Type Amendment' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('type', 'Amendment');
  });

  it('clears everything from the one link', async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    render(<ChipRow chips={chips} onRemove={() => undefined} onClearAll={onClearAll} />);

    await user.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('names a chip that stands for the whole filter without a value', () => {
    render(
      <ChipRow
        chips={[{ id: 'featured', label: 'Featured documents' }]}
        onRemove={() => undefined}
        onClearAll={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove Featured documents' })).toBeInTheDocument();
  });
});
