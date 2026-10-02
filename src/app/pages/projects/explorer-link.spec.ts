import { describe, it, expect } from 'vitest';
import { explorerLink } from './explorer-link';

describe('explorerLink()', () => {
  it('opens the explorer searched for the project and selecting it', () => {
    expect(explorerLink({ _id: 'p-7', name: 'Coastal Corridor' })).toBe(
      '/projects?applicant=Coastal+Corridor&selected=p-7',
    );
  });

  it.each([
    ['no record yet', null],
    ['a record with no id', { _id: '', name: 'Coastal Corridor' }],
  ])('opens the plain explorer for %s', (_case, project) => {
    expect(explorerLink(project)).toBe('/projects');
  });
});
