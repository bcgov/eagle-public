import type { ReactElement } from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { PassageList, type PassageHit, type PassageRow } from './passage-list';

/** The file name is a record link, so every row needs a router around it. */
function render(ui: ReactElement) {
  return rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
}

const FILE = '/api/document/doc-1/fetch';

function hits(count: number, pageNumbered = false): PassageHit[] {
  return Array.from({ length: count }, (_, index) => ({
    locator: index + 1,
    text: `Sediment control passage ${index + 1}.`,
    pageNumbered,
  }));
}

function makeRow(overrides: Partial<PassageRow> = {}): PassageRow {
  return {
    id: 'doc-1',
    name: 'Amendment #3 Application — Volume 1',
    href: FILE,
    date: '2026-02-18',
    type: 'Amendment Application',
    author: 'Proponent',
    passages: hits(2),
    total: 2,
    ...overrides,
  };
}

describe('PassageList', () => {
  it('renders passage markup as text rather than injecting it', () => {
    const hostile = '<script>alert(1)</script> sediment plan';
    const { container } = render(
      <PassageList
        rows={[makeRow({ passages: [{ locator: 1, text: hostile }], total: 1 })]}
        terms={['sediment']}
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
  });

  it('renders a hostile file name as text rather than injecting it', () => {
    const { container } = render(
      <PassageList rows={[makeRow({ name: '<img src=x onerror=alert(1)>' })]} terms={[]} />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });

  it('shows the first two passages and counts the rest on the control', () => {
    render(<PassageList rows={[makeRow({ passages: hits(5), total: 5 })]} terms={[]} />);

    expect(screen.getByText('Sediment control passage 2.')).toBeInTheDocument();
    expect(screen.queryByText('Sediment control passage 3.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3 more passages' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('says one more passage when a single one is held back', () => {
    render(<PassageList rows={[makeRow({ passages: hits(3), total: 3 })]} terms={[]} />);

    expect(screen.getByRole('button', { name: '1 more passage' })).toBeInTheDocument();
  });

  it('reveals every passage and offers to collapse again', async () => {
    const user = userEvent.setup();
    render(<PassageList rows={[makeRow({ passages: hits(5), total: 5 })]} terms={[]} />);

    await user.click(screen.getByRole('button', { name: '3 more passages' }));

    expect(screen.getByText('Sediment control passage 5.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show fewer passages' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('collapses back to two passages', async () => {
    const user = userEvent.setup();
    render(<PassageList rows={[makeRow({ passages: hits(5), total: 5 })]} terms={[]} />);

    await user.click(screen.getByRole('button', { name: '3 more passages' }));
    await user.click(screen.getByRole('button', { name: 'Show fewer passages' }));

    expect(screen.queryByText('Sediment control passage 3.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3 more passages' })).toBeInTheDocument();
  });

  it('points the control at the list it expands', () => {
    render(<PassageList rows={[makeRow({ passages: hits(5), total: 5 })]} terms={[]} />);

    const control = screen.getByRole('button', { name: '3 more passages' });
    const passages = screen.getByRole('list', { name: '5 matching passages' });

    expect(control).toHaveAttribute('aria-controls', passages.id);
  });

  it('offers no control when every passage is already shown', () => {
    render(<PassageList rows={[makeRow({ passages: hits(2), total: 2 })]} terms={[]} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('labels a passage without a page number by its place in the document', () => {
    render(<PassageList rows={[makeRow({ passages: hits(1), total: 1 })]} terms={[]} />);

    expect(screen.getByText('Passage 1')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Passage 1' })).not.toBeInTheDocument();
  });

  it('links a page-numbered passage into the file at that page', () => {
    render(<PassageList rows={[makeRow({ passages: hits(1, true), total: 1 })]} terms={[]} />);

    expect(screen.getByRole('link', { name: /^Page 1\s*\(opens in new tab\)$/ })).toHaveAttribute(
      'href',
      `${FILE}#page=1`,
    );
  });

  it('links the file name at the document itself', () => {
    render(<PassageList rows={[makeRow()]} terms={[]} />);

    expect(
      screen.getByRole('link', {
        name: /^Amendment #3 Application — Volume 1\s*\(opens in new tab\)$/,
      }),
    ).toHaveAttribute('href', FILE);
  });

  it('separates the meta parts with a middot', () => {
    const { container } = render(<PassageList rows={[makeRow()]} terms={[]} />);

    expect(container).toHaveTextContent('2026-02-18 · Amendment Application · Proponent');
  });

  it('leaves out the meta parts the record does not state', () => {
    render(<PassageList rows={[makeRow({ date: null, author: null })]} terms={[]} />);

    expect(screen.getByText('Amendment Application')).not.toHaveTextContent('·');
  });

  it('counts one matching passage in the singular', () => {
    render(<PassageList rows={[makeRow({ passages: hits(1), total: 1 })]} terms={[]} />);

    expect(screen.getByText('1 matching passage')).toBeInTheDocument();
  });

  it('counts the matches the document holds, not the passages the search returned', () => {
    render(<PassageList rows={[makeRow({ passages: hits(2), total: 8 })]} terms={[]} />);

    expect(screen.getByText('8 matching passages')).toBeInTheDocument();
  });

  it('marks the search terms in the file name and the passages', () => {
    const { container } = render(
      <PassageList rows={[makeRow({ name: 'Sediment plan' })]} terms={['sediment']} />,
    );

    expect(container.querySelectorAll('mark')).toHaveLength(3);
  });

  it('expands one row without expanding the next', async () => {
    const user = userEvent.setup();
    render(
      <PassageList
        rows={[
          makeRow({ id: 'a', name: 'First file', passages: hits(5), total: 5 }),
          makeRow({ id: 'b', name: 'Second file', passages: hits(5), total: 5 }),
        ]}
        terms={[]}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: '3 more passages' })[0]);

    expect(screen.getByRole('button', { name: 'Show fewer passages' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '3 more passages' })).toHaveLength(1);
  });

  it('offers no checkbox where the page does not select', () => {
    render(<PassageList rows={[makeRow()]} terms={[]} />);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('ticks a row by the document its passages sit in, named after the file', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <PassageList rows={[makeRow()]} terms={[]} selectable selectedIds={[]} onToggle={onToggle} />,
    );

    const box = screen.getByRole('checkbox', {
      name: 'Select Amendment #3 Application — Volume 1',
    });
    expect(box).not.toBeChecked();

    await user.click(box);

    expect(onToggle).toHaveBeenCalledWith('doc-1');
  });

  it('shows a row already in the basket as ticked', () => {
    render(
      <PassageList
        rows={[makeRow()]}
        terms={[]}
        selectable
        selectedIds={['doc-1']}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('says the list is busy while the next page loads', () => {
    const { container } = render(<PassageList rows={[makeRow()]} terms={[]} loading />);

    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');
  });

  it('says nothing about busy when the rows are current', () => {
    const { container } = render(<PassageList rows={[makeRow()]} terms={[]} />);

    expect(container.firstElementChild).not.toHaveAttribute('aria-busy');
  });
});
