import { describe, it, expect } from 'vitest';
import { projectPlace } from './project-place';

describe('projectPlace', () => {
  it.each([
    ['town and region', { location: 'Kitimat', region: 'Skeena' }, 'Kitimat, Skeena region'],
    ['region alone', { region: 'Skeena' }, 'Skeena region'],
    ['town alone', { location: 'Kitimat' }, 'Kitimat'],
    ['neither', {}, ''],
    ['whitespace-only values', { location: '  ', region: ' ' }, ''],
    ['padded values', { location: ' Kitimat ', region: ' Skeena ' }, 'Kitimat, Skeena region'],
    [
      'a town ending in a full stop',
      { location: 'Near the Abbotsford Airport. ', region: 'Lower Mainland' },
      'Near the Abbotsford Airport, Lower Mainland region',
    ],
    ['a town that is only punctuation', { location: ' . ', region: 'Skeena' }, 'Skeena region'],
    ['a region already named "Region"', { region: 'Skeena Region' }, 'Skeena Region'],
    [
      'a region already named "region"',
      { location: 'Kitimat', region: 'Skeena region' },
      'Kitimat, Skeena region',
    ],
  ])('gives %s', (_case, place, expected) => {
    expect(projectPlace(place)).toBe(expected);
  });
});
