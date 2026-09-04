import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderAt } from '../../../test-utils';
import { UpdateCard, type UpdateRecord } from './update-card';

function renderCard(update: UpdateRecord) {
  return renderAt('/p/proj-1/updates', [
    {
      path: '/p/:projId/updates',
      Component: () => (
        <ol>
          <UpdateCard update={update} />
        </ol>
      ),
    },
  ]);
}

const BASE: UpdateRecord = {
  _id: 'act-1',
  headline: 'Certificate amendment granted',
  content: '<p>The amendment changes condition 12.</p>',
  dateAdded: '2026-02-18T00:00:00.000Z',
  type: 'News',
};

describe('update card', () => {
  it('leads with the date and category, then the headline and the body', () => {
    renderCard(BASE);

    expect(screen.getByText('February 18, 2026 · News')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Certificate amendment granted' }),
    ).toBeInTheDocument();
    expect(screen.getByText('The amendment changes condition 12.')).toBeInTheDocument();
  });

  it('colours the accent by category, and falls back to the neutral token', () => {
    const { unmount } = renderCard({ ...BASE, type: 'Public Comment Period' });
    expect(document.querySelector('.update-card__accent')).toHaveStyle({
      background: 'var(--eao-early-engagement-dark)',
    });
    unmount();

    renderCard({ ...BASE, type: 'Something new' });
    expect(document.querySelector('.update-card__accent')).toHaveStyle({
      background: 'var(--eao-proponent-dark)',
    });
  });

  it('names the referenced file, and links the comment period it belongs to', () => {
    renderCard({
      ...BASE,
      documentUrl: 'https://example.test/api/public/document/1/download/Warning%20Letter.pdf',
      project: { _id: 'proj-1' },
      pcp: { _id: 'cp-9' },
    });

    expect(screen.getByRole('link', { name: /Warning Letter\.pdf/ })).toHaveAttribute(
      'href',
      'https://example.test/api/public/document/1/download/Warning%20Letter.pdf',
    );
    expect(screen.getByRole('link', { name: /View engagement/ })).toHaveAttribute(
      'href',
      '/p/proj-1/cp/cp-9',
    );
  });

  it('drops a document link whose URL is not a scheme we allow', () => {
    renderCard({ ...BASE, documentUrl: 'javascript:alert(1)' });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Referenced by this update')).toBeNull();
  });
});
