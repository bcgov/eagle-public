import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toUpdate } from 'app/api/updates';
import { renderAt } from '../../../test-utils';
import { UpdateCard } from './update-card';

type Row = Parameters<typeof toUpdate>[0];

function renderCard(row: Row) {
  return renderAt('/p/proj-1/updates', [
    {
      path: '/p/:projId/updates',
      Component: () => (
        <ol>
          <UpdateCard update={toUpdate(row)} />
        </ol>
      ),
    },
  ]);
}

/** A row written before the Updates fields existed. */
const OLD_ROW: Row = {
  _id: 'act-1',
  headline: 'Certificate amendment granted',
  content: '<p>The amendment changes condition 12.</p><p>It applies from March.</p>',
  dateAdded: '2026-02-18T00:00:00.000Z',
  type: 'News',
};

const FULL_ROW: Row = {
  ...OLD_ROW,
  headline: 'Certificate amendment granted for the Cedar LNG facility',
  shortHeadline: 'Amendment granted',
  summary: 'Condition 12 changes.',
  category: 'Project News',
  publishDate: '2026-02-20T00:00:00.000Z',
  location: 'Kitimat',
  featuredImage: { document: 'img-1', alt: 'The Cedar LNG site from the water' },
  attachments: [{ _id: 'doc-1', displayName: 'Amendment order.pdf' }, 'doc-2'],
  engagementUrl: 'https://engage.eao.gov.bc.ca/cedar',
  project: { _id: 'proj-1', name: 'Cedar LNG' },
};

const readMore = () => screen.getByRole('button', { name: /^Read full update/ });

describe('update card', () => {
  it('shows the short headline and summary, dated by publish date and labelled by category', () => {
    renderCard(FULL_ROW);

    expect(screen.getByText('February 20, 2026 · Project News')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Amendment granted' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Condition 12 changes.')).toBeInTheDocument();
    expect(screen.queryByText('The amendment changes condition 12.')).not.toBeInTheDocument();
  });

  it('falls back to the headline and first paragraph on a row without the new fields', () => {
    renderCard(OLD_ROW);

    expect(screen.getByText('February 18, 2026 · News')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Certificate amendment granted' }),
    ).toBeInTheDocument();
    expect(screen.getByText('The amendment changes condition 12.')).toBeInTheDocument();
    expect(screen.queryByText(/It applies from March/)).not.toBeInTheDocument();
  });

  it('expands to the full update: headline, meta, image and body', async () => {
    renderCard(FULL_ROW);

    expect(readMore()).toHaveAttribute('aria-expanded', 'false');
    // No reference to a panel that is not in the page yet.
    expect(readMore()).not.toHaveAttribute('aria-controls');
    await userEvent.setup().click(readMore());

    const showLess = screen.getByRole('button', { name: /^Show less/ });
    expect(showLess).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(showLess.getAttribute('aria-controls') ?? '')).not.toBeNull();
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: 'Certificate amendment granted for the Cedar LNG facility',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Cedar LNG · Kitimat · February 20, 2026')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'The Cedar LNG site from the water' })).toHaveAttribute(
      'src',
      expect.stringMatching(/\/documents\/img-1\/download\?redirect=1$/),
    );
    expect(screen.getByText('It applies from March.')).toBeInTheDocument();
    // The card is on its own project's tab, so it links nowhere back to that project.
    expect(screen.queryByRole('link', { name: /overview/i })).not.toBeInTheDocument();
  });

  it('offers one engagement call to action, the ENGAGE link over the comment period', async () => {
    renderCard({ ...FULL_ROW, pcp: { _id: 'cp-9' } });

    const engage = screen.getByRole('link', { name: /Take part in the engagement/ });
    expect(engage).toHaveAttribute('href', 'https://engage.eao.gov.bc.ca/cedar');
    expect(engage).toHaveAttribute('target', '_blank');
    expect(screen.queryByRole('link', { name: /View engagement/ })).not.toBeInTheDocument();

    await userEvent.setup().click(readMore());
    expect(screen.getAllByRole('link', { name: /Take part in the engagement/ })).toHaveLength(1);
  });

  it('lists attachments as document links, named when the row carries a name', async () => {
    renderCard(FULL_ROW);
    const user = userEvent.setup();
    await user.click(readMore());
    await user.click(screen.getByRole('button', { name: 'Documents (2)' }));

    const docs = document.querySelector('.update-detail__docs') as HTMLElement;
    expect(
      within(docs).getByRole('link', { name: /^Amendment order\.pdf\s*\(opens in new tab\)$/ }),
    ).toHaveAttribute('href', expect.stringMatching(/\/documents\/doc-1\/download\?redirect=1$/));
    expect(
      within(docs).getByRole('link', { name: /^Document 2\s*\(opens in new tab\)$/ }),
    ).toHaveAttribute('href', expect.stringMatching(/\/documents\/doc-2\/download\?redirect=1$/));
  });

  it('names the subject instead of a project on a corporate update', async () => {
    renderCard({ ...FULL_ROW, project: null, category: 'Corporate', subject: 'Fees' });
    await userEvent.setup().click(readMore());

    expect(screen.getByText('About: Fees')).toBeInTheDocument();
  });

  it('drops an ENGAGE link that is not http or https', async () => {
    renderCard({ ...FULL_ROW, engagementUrl: 'mailto:someone@example.com' });
    await userEvent.setup().click(readMore());

    expect(screen.getByText('It applies from March.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Take part/ })).not.toBeInTheDocument();
  });

  it('links the comment period the update belongs to', () => {
    renderCard({ ...OLD_ROW, project: { _id: 'proj-1' }, pcp: { _id: 'cp-9' } });

    expect(screen.getByRole('link', { name: /View engagement/ })).toHaveAttribute(
      'href',
      '/p/proj-1/cp/cp-9',
    );
  });

  it('heads its photo series h4, under the card headline', async () => {
    renderCard({ ...FULL_ROW, images: [{ document: 'img-2', alt: 'The outfall' }] });

    expect(screen.queryByRole('heading', { name: 'Photos' })).not.toBeInTheDocument();
    await userEvent.setup().click(readMore());

    expect(screen.getByRole('heading', { level: 4, name: 'Photos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'The outfall' })).toBeInTheDocument();
  });

  it('drops a document link whose URL is not a scheme we allow', async () => {
    renderCard({ ...OLD_ROW, documentUrl: 'javascript:alert(1)' });
    await userEvent.setup().click(readMore());

    expect(screen.getByText('It applies from March.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Documents/ })).toBeNull();
  });
});
