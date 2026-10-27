import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineSearch } from './timeline-search';
import { CEDAR, TODAY } from './timeline.fixture';
import { buildTimelineModel } from './use-timeline-model';

const model = buildTimelineModel({ project: CEDAR, documents: [], lists: [], today: TODAY });
const idOf = (title: string) => model.items.find((item) => item.title === title)!.id;

function Harness({ onSelect }: { onSelect: (id: string) => void }) {
  const [query, setQuery] = useState('');
  return (
    <TimelineSearch model={model} query={query} onQueryChange={setQuery} onSelect={onSelect} />
  );
}

function renderSearch() {
  const onSelect = vi.fn();
  render(<Harness onSelect={onSelect} />);
  return { onSelect, input: screen.getByRole('searchbox', { name: 'Search the timeline' }) };
}

describe('TimelineSearch', () => {
  it('clears the query on Esc', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();
    await user.type(input, 'Amendment');

    await user.keyboard('{Escape}');

    expect(input).toHaveValue('');
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
  });

  it('selects the first hit and counts the matches', async () => {
    const user = userEvent.setup();
    const { input, onSelect } = renderSearch();

    await user.type(input, 'Amendment #');

    expect(screen.getByText('1 of 3 matches')).toBeInTheDocument();
    expect(onSelect).toHaveBeenLastCalledWith(idOf('Amendment #1'));
  });

  it('moves to the next hit on Enter and back on Shift+Enter', async () => {
    const user = userEvent.setup();
    const { input, onSelect } = renderSearch();
    await user.type(input, 'Amendment #');

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith(idOf('Amendment #2'));

    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onSelect).toHaveBeenLastCalledWith(idOf('Amendment #1'));
  });

  it('finds an item by its date', async () => {
    const user = userEvent.setup();
    const { input, onSelect } = renderSearch();

    await user.type(input, '22 Jan 2024');

    expect(onSelect).toHaveBeenLastCalledWith(idOf('Amendment #1'));
  });

  it('waits for two characters before searching', async () => {
    const user = userEvent.setup();
    const { input, onSelect } = renderSearch();

    await user.type(input, 'A');

    expect(screen.queryByText('No matches')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('wraps from the first hit back to the last', async () => {
    const user = userEvent.setup();
    const { input, onSelect } = renderSearch();
    await user.type(input, 'Amendment #');

    await user.click(screen.getByRole('button', { name: 'Previous match' }));

    expect(onSelect).toHaveBeenLastCalledWith(idOf('Amendment #3'));
    expect(screen.getByText('3 of 3 matches')).toBeInTheDocument();
  });

  it('steps to the next hit with the Next button', async () => {
    const user = userEvent.setup();
    const { input, onSelect } = renderSearch();
    await user.type(input, 'Amendment #');

    await user.click(screen.getByRole('button', { name: 'Next match' }));

    expect(onSelect).toHaveBeenLastCalledWith(idOf('Amendment #2'));
  });

  it('says No matches and turns off Previous and Next', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'zzz');

    expect(screen.getByText('No matches')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous match' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
  });

  it('empties the field with the Clear button and keeps focus in it', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();
    await user.type(input, 'Amendment');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
  });

  it('has the count region in place before anything is typed', () => {
    renderSearch();

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('lets Esc through to the page when the field is already empty', async () => {
    const user = userEvent.setup();
    const onPageKey = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    const { input } = renderSearch();
    document.addEventListener('keydown', onPageKey);
    try {
      await user.click(input);
      await user.keyboard('{Escape}');
    } finally {
      document.removeEventListener('keydown', onPageKey);
    }

    expect(onPageKey).toHaveLastReturnedWith(false);
  });

  describe('with a query set from outside', () => {
    function renderControlled(query: string) {
      const onSelect = vi.fn();
      const props = { onQueryChange: () => undefined, onSelect };
      const { rerender } = render(<TimelineSearch {...props} model={model} query="" />);
      rerender(<TimelineSearch {...props} model={model} query={query} />);
      return {
        onSelect,
        rerenderModel: () =>
          rerender(<TimelineSearch {...props} model={{ ...model }} query={query} />),
      };
    }

    it('counts the matches and goes to the first hit on Enter', async () => {
      const user = userEvent.setup();
      const { onSelect } = renderControlled('Amendment #');
      expect(screen.getByText('3 matches')).toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();

      await user.type(screen.getByRole('searchbox'), '{Enter}');

      expect(onSelect).toHaveBeenLastCalledWith(idOf('Amendment #1'));
    });

    it('goes to the last hit on Previous before any move', async () => {
      const user = userEvent.setup();
      const { onSelect } = renderControlled('Amendment #');

      await user.click(screen.getByRole('button', { name: 'Previous match' }));

      expect(onSelect).toHaveBeenLastCalledWith(idOf('Amendment #3'));
      expect(screen.getByText('3 of 3 matches')).toBeInTheDocument();
    });

    it('goes to the last hit on Shift+Enter before any move', async () => {
      const user = userEvent.setup();
      const { onSelect } = renderControlled('Amendment #');

      await user.type(screen.getByRole('searchbox'), '{Shift>}{Enter}{/Shift}');

      expect(onSelect).toHaveBeenLastCalledWith(idOf('Amendment #3'));
    });

    it('starts the count again when the model changes under the same query', async () => {
      const user = userEvent.setup();
      const { rerenderModel } = renderControlled('Amendment #');
      await user.click(screen.getByRole('button', { name: 'Next match' }));
      expect(screen.getByText('1 of 3 matches')).toBeInTheDocument();

      rerenderModel();

      expect(screen.getByText('3 matches')).toBeInTheDocument();
    });
  });
});
