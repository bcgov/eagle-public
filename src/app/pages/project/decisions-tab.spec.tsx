import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderAt } from '../../../test-utils';
import { DecisionsTab } from './decisions-tab';

vi.mock('./project-context', async (importOriginal) => {
  const original = await importOriginal<typeof import('./project-context')>();
  return {
    ...original,
    useProjectContext: () => ({
      project: { eacDecision: { name: 'Certificate Issued' } },
      projId: 'proj-1',
      lists: [],
    }),
  };
});

describe('DecisionsTab', () => {
  it('names the decision and links to the certificate documents', () => {
    renderAt('/p/proj-1/decisions', [{ path: '/p/:projId/decisions', element: <DecisionsTab /> }]);

    expect(screen.getByRole('heading', { name: 'Decisions' })).toBeInTheDocument();
    expect(screen.getByText('EA decision: Certificate Issued')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Certificate documents' })).toHaveAttribute(
      'href',
      '/p/proj-1/documents/certificates',
    );
  });
});
