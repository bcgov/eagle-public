import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderAt } from '../../../../test-utils';
import { ProjectPanel } from '../project-panel';
import { extendedPanelParts } from './extended-shell';
import type { ExtendedPage } from './types';

/** A page with made-up facts only: no label below comes from the panel's own code. */
const FACTS_ONLY = {
  version: 1,
  panel: {
    facts: [
      { label: 'Weather', value: 'Sunny', statusDot: true },
      {
        label: 'Keeper',
        value: [{ text: 'Lighthouse Board', href: 'https://board.example/' }],
        detail: ['Helped by the ', { text: 'Harbour Trust', href: 'https://trust.example/' }],
      },
      { label: 'Height', value: '42 m' },
    ],
  },
} as ExtendedPage;

const TIMELINE = {
  title: 'Lamp progress',
  note: 'Not to scale',
  steps: [
    { name: 'Built', dateLabel: '1901', detail: '' },
    { name: 'Lit', dateLabel: '1902', detail: '' },
  ],
  currentStep: 1,
  stateLabels: { complete: 'Done', current: 'Now', upcoming: 'Later' },
};

/** The project panel with the page's own parts in it, as the project shell draws it. */
function renderPanel(content: ExtendedPage) {
  return renderAt('/p/proj-1/overview', [
    {
      path: '/p/:projId/overview',
      element: <ProjectPanel project={null} lists={[]} parts={extendedPanelParts(content, null)} />,
    },
  ]);
}

function panel(): HTMLElement {
  return screen.getByRole('region', { name: 'Project summary' });
}

/** The value cell beside a fact's label. */
function valueOf(label: string): HTMLElement {
  const term = screen.getAllByRole('term').find((each) => each.textContent === label);
  return term?.nextElementSibling as HTMLElement;
}

describe('extended page panel parts', () => {
  it('draws exactly the facts the content lists, with their labels, values and details', () => {
    renderPanel(FACTS_ONLY);

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Weather',
      'Keeper',
      'Height',
    ]);
    expect(valueOf('Weather')).toHaveTextContent(/^Sunny$/);
    expect(valueOf('Keeper')).toHaveTextContent(/^Lighthouse Board.*Helped by the Harbour Trust/);
    expect(valueOf('Height')).toHaveTextContent(/^42 m$/);
    expect(screen.getByRole('link', { name: /^Lighthouse Board/ })).toHaveAttribute(
      'href',
      'https://board.example/',
    );
  });

  it('marks only the fact flagged statusDot with a dot', () => {
    const { container } = renderPanel(FACTS_ONLY);

    const dots = container.querySelectorAll('.extended-panel__status-dot');
    expect(dots).toHaveLength(1);
    expect(dots[0]?.closest('dd')?.previousElementSibling).toHaveTextContent('Weather');
  });

  it('keeps the standard rail and location map where the panel sets no timeline or map', () => {
    renderPanel({ ...FACTS_ONLY, timeline: TIMELINE } as ExtendedPage);

    expect(within(panel()).getByRole('heading', { name: 'Assessment progress' })).toBeVisible();
    expect(within(panel()).queryByRole('heading', { name: 'Lamp progress' })).toBeNull();
    expect(within(panel()).getByText('No map available')).toBeInTheDocument();
  });

  it('keeps the standard record facts where the panel sets none', () => {
    renderPanel({ version: 1, panel: { timeline: true }, timeline: TIMELINE } as ExtendedPage);

    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Status',
      'EA decision',
      'Type',
      'Location',
      'Proponent',
    ]);
  });

  it('draws the timeline with its own title and state labels when the panel asks for it', () => {
    renderPanel({
      ...FACTS_ONLY,
      panel: { ...FACTS_ONLY.panel, timeline: true },
      timeline: TIMELINE,
    } as ExtendedPage);

    expect(screen.getByRole('heading', { name: 'Lamp progress' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Assessment progress' })).toBeNull();
    const steps = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(steps.map((step) => step.textContent)).toEqual(['BuiltDone · 1901', 'LitNow · 1902']);
  });
});
