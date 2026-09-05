import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderAt } from '../../../test-utils';
import { Project } from 'app/models/project';
import { ProjDetailPopup } from './proj-detail-popup';

vi.mock('app/api/commentperiod', () => ({ getAllByProjectId: vi.fn().mockResolvedValue([]) }));

const BASE = {
  _id: 'proj-1',
  name: 'Cedar Quarry',
  region: 'Cariboo',
  eacDecision: { name: 'Approved' },
  location: 'Near Quesnel',
};

function renderPopup(project: Project) {
  return renderAt('/', [{ path: '/', element: <ProjDetailPopup project={project} /> }]);
}

describe('ProjDetailPopup EA Certificate', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows the EA Certificate row when the project carries one', () => {
    renderPopup(new Project({ ...BASE, eaCertificate: 'E23-01' }));

    expect(screen.getByText('EA Certificate')).toBeInTheDocument();
    expect(screen.getByText('E23-01')).toBeInTheDocument();
  });

  it('hides the EA Certificate row when the field is absent, as on dev (eagle-api)', () => {
    renderPopup(new Project(BASE));

    expect(screen.queryByText('EA Certificate')).not.toBeInTheDocument();
  });

  it('hides the EA Certificate row when the field is an empty string', () => {
    renderPopup(new Project({ ...BASE, eaCertificate: '' }));

    expect(screen.queryByText('EA Certificate')).not.toBeInTheDocument();
  });
});
