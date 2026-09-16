import type { ReactElement } from 'react';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ListRow } from './list-row';

/** The headline link is a router link, so every row needs a router around it. */
function render(ui: ReactElement) {
  return rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
}

const longBody = `Sediment control works were inspected. ${'Findings follow. '.repeat(30)}`;

describe('ListRow', () => {
  it('renders the headline as plain text when the record has no page', () => {
    render(<ListRow meta={['2026-02-18']} title="Inspection Record" />);

    const heading = screen.getByRole('heading', { level: 3, name: 'Inspection Record' });
    expect(heading).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Inspection Record' })).not.toBeInTheDocument();
  });

  it('links the headline when the record has a page', () => {
    render(<ListRow meta={['2026-02-18']} title="Cedar LNG" href="/p/123" />);

    expect(screen.getByRole('link', { name: 'Cedar LNG' })).toHaveAttribute('href', '/p/123');
  });

  it('refuses a headline link the browser should not follow', () => {
    // Built from parts so no linter rewrites the literal the test is about.
    const unsafe = `${'java'}script:alert(1)`;
    render(<ListRow meta={['2026-02-18']} title="Cedar LNG" href={unsafe} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Cedar LNG');
  });

  it('separates the meta parts with a middot', () => {
    const { container } = render(
      <ListRow meta={['2026-02-18', 'Amendment', 'Cedar LNG']} title="Amendment issued" />,
    );

    expect(container).toHaveTextContent('2026-02-18 · Amendment · Cedar LNG');
  });

  it('takes a link as a meta part, so the project is reachable from the line', () => {
    render(
      <ListRow
        meta={[
          '2026-02-18',
          'Amendment',
          <a href="/p/123" key="project">
            Cedar LNG
          </a>,
        ]}
        title="Amendment issued"
      />,
    );

    expect(screen.getByRole('link', { name: 'Cedar LNG' })).toHaveAttribute('href', '/p/123');
  });

  it('offers Show more on a long body and reports its state', async () => {
    const user = userEvent.setup();
    render(<ListRow meta={['2026-02-18']} title="Inspection Record" body={longBody} />);

    const toggle = screen.getByRole('button', { name: 'Show more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    const collapse = screen.getByRole('button', { name: 'Show less' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
  });

  it('leaves a short body alone', () => {
    render(<ListRow meta={['2026-02-18']} title="Inspection Record" body="Short note." />);

    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    expect(screen.getByText('Short note.')).toBeInTheDocument();
  });

  it('hands expansion to the caller when it is controlled', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <ListRow
        meta={['2026-02-18']}
        title="Inspection Record"
        body={longBody}
        expanded
        onToggle={onToggle}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Show less' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('marks the search terms in the headline and the body', () => {
    const { container } = render(
      <ListRow
        meta={['2026-02-18']}
        title="Sediment inspection"
        body="Sediment control works were inspected."
        terms={['sediment']}
      />,
    );

    expect(container.querySelectorAll('mark').length).toBeGreaterThanOrEqual(2);
  });

  it('lists the attachments under a count', () => {
    render(
      <ListRow
        meta={['2026-02-18']}
        title="Amendment issued"
        attachments={[
          { name: 'Order.pdf', href: '/api/document/1/fetch', type: 'PDF', size: '1.2 MB' },
          { name: 'Schedule.pdf', href: '/api/document/2/fetch', type: 'PDF', size: '240 KB' },
        ]}
      />,
    );

    expect(screen.getByText('2 documents')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Order.pdf' })).toHaveAttribute(
      'href',
      '/api/document/1/fetch',
    );
    expect(screen.getByText('PDF · 240 KB')).toBeInTheDocument();
  });

  it('counts a single attachment in the singular', () => {
    render(
      <ListRow
        meta={['2026-02-18']}
        title="Amendment issued"
        attachments={[{ name: 'Order.pdf', href: '/api/document/1/fetch' }]}
      />,
    );

    expect(screen.getByText('1 document')).toBeInTheDocument();
  });

  it('falls back to label and value pairs for a record with no body', () => {
    render(
      <ListRow
        meta={['2026-02-18']}
        title="Cedar LNG"
        fields={[
          { label: 'Proponent', value: 'Cedar LNG Partners' },
          { label: 'Phase', value: 'Pre-Application' },
        ]}
      />,
    );

    expect(screen.getByText('Proponent')).toBeInTheDocument();
    expect(screen.getByText('Cedar LNG Partners')).toBeInTheDocument();
  });

  it('prefers the body over the field pairs when a record has both', () => {
    render(
      <ListRow
        meta={['2026-02-18']}
        title="Cedar LNG"
        body="A body wins."
        fields={[{ label: 'Proponent', value: 'Cedar LNG Partners' }]}
      />,
    );

    expect(screen.getByText('A body wins.')).toBeInTheDocument();
    expect(screen.queryByText('Proponent')).not.toBeInTheDocument();
  });
});
