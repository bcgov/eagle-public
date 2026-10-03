import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderBlocks } from '../fixtures/blocks';
import type { ProjectsBlock } from '../types';

function projects(items: ProjectsBlock['items']): ProjectsBlock {
  return { type: 'projects', id: 'nearby', heading: 'Nearby projects on EPIC', items };
}

describe('projects block', () => {
  it('links each related EPIC project to its project page, in the same tab', async () => {
    renderBlocks([
      projects([
        { id: 'aaa111', name: 'Harbour Pier', note: 'A pier next to the library.' },
        { id: 'bbb222', name: 'Harbour Park', note: 'A park across the road.' },
      ]),
    ]);

    const section = await screen.findByRole('region', { name: 'Nearby projects on EPIC' });
    const links = within(section).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Harbour Pier', '/p/aaa111'],
      ['Harbour Park', '/p/bbb222'],
    ]);
    expect(links.filter((link) => link.hasAttribute('target'))).toEqual([]);
    expect(within(section).getByText('A park across the road.')).toBeInTheDocument();
  });

  it('keeps an id with path characters inside the project segment', async () => {
    renderBlocks([projects([{ id: '../act?x=1#y', name: 'Odd id', note: 'Note.' }])]);

    const link = await screen.findByRole('link', { name: 'Odd id' });
    expect(link).toHaveAttribute('href', '/p/..%2Fact%3Fx%3D1%23y');
  });

  it('leaves the section out when the content names no related projects', async () => {
    renderBlocks([
      projects([]),
      { type: 'prose', id: 'note', heading: 'Note', text: 'Nothing nearby.' },
    ]);

    await screen.findByRole('heading', { level: 2, name: 'Note' });
    expect(
      screen.queryByRole('heading', { name: 'Nearby projects on EPIC' }),
    ).not.toBeInTheDocument();
  });
});
