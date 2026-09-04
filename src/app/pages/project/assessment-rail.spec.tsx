import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentRail } from './assessment-rail';
import { LISTS, makeProject } from './assessment-stages.fixture';

const flags = vi.hoisted(() => ({ stripes: true }));

// A getter keeps the flag readable per render, so one spec can turn the stripes off.
vi.mock('./assessment-stages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./assessment-stages')>()),
  get SHOW_RATIFICATION_STRIPES() {
    return flags.stripes;
  },
}));

function renderRail(phase: string | null, act = '2018') {
  return render(<AssessmentRail project={makeProject(phase, act)} lists={LISTS} />);
}

async function showDetailed() {
  await userEvent.click(screen.getByRole('button', { name: 'Detailed' }));
}

function keyRows(container: HTMLElement) {
  return within(container.querySelector('.assessment-rail__key') as HTMLElement).getAllByRole(
    'listitem',
  );
}

afterEach(() => {
  flags.stripes = true;
});

describe('simplified rail', () => {
  it('lists the seven phases and marks the current one', () => {
    renderRail('Process Planning');

    expect(screen.getByRole('heading', { name: 'Assessment progress' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(7);
    expect(items[6]).toHaveTextContent('Post decision');
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items.filter((item) => item.hasAttribute('aria-current'))).toHaveLength(1);
  });

  it('leaves out the date line while no phase dates exist', () => {
    const { container } = renderRail('Process Planning');

    expect(container.querySelectorAll('.assessment-rail__phase-dates')).toHaveLength(0);
  });

  it('offers no detailed view on a 2002 project', () => {
    renderRail('Application Review', '2002');

    expect(screen.queryByRole('group', { name: 'Progress detail' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Detailed' })).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });
});

describe('detailed rail', () => {
  it('draws ten segments and a numbered key', async () => {
    const { container } = renderRail('Process Planning');

    await showDetailed();

    expect(screen.getByRole('button', { name: 'Detailed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Simplified' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(container.querySelectorAll('.assessment-rail__seg')).toHaveLength(10);
    expect(container.querySelectorAll('.assessment-rail__seg--striped')).toHaveLength(3);

    const rows = keyRows(container);
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.querySelector('.assessment-rail__chip')?.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    expect(rows[0]).toHaveTextContent('Early Engagement');
    expect(rows[4]).toHaveTextContent('3 years proponent time');
    expect(rows[9]).toHaveTextContent('30 days EAO limit');
  });

  it('states the EAO share of the timeline', async () => {
    renderRail('Process Planning');

    await showDetailed();

    expect(
      screen.getByText(
        /maximum timeline of 6\.7 years\. Of that, 630 days \(26%\).+remaining 1,825 days are proponent time/,
      ),
    ).toBeInTheDocument();
  });

  it('links a key row to its segment and pin on hover', async () => {
    const { container } = renderRail('Process Planning');

    await showDetailed();
    await userEvent.hover(keyRows(container)[4]);

    expect(container.querySelector('.assessment-rail__seg[data-stage="5"]')).toHaveAttribute(
      'data-hover',
    );
    expect(container.querySelector('.assessment-rail__pin[data-stage="5"]')).toHaveAttribute(
      'data-hover',
    );
    expect(container.querySelector('.assessment-rail__seg[data-stage="1"]')).not.toHaveAttribute(
      'data-hover',
    );

    await userEvent.unhover(keyRows(container)[4]);

    expect(container.querySelector('.assessment-rail__seg[data-stage="5"]')).not.toHaveAttribute(
      'data-hover',
    );
  });

  it('keeps the amendment column off the rail before the decision', async () => {
    const { container } = renderRail('Process Planning');

    await showDetailed();

    expect(container.querySelector('.assessment-rail__amendment')).toBeNull();
  });

  it('adds the off-scale amendment column after the decision', async () => {
    renderRail('Post Decision - Amendment');

    await showDetailed();

    expect(screen.getByText('In progress · no legislated duration')).toBeInTheDocument();
  });

  it('renders no striped segment when ratification stripes are off', async () => {
    flags.stripes = false;
    const { container } = renderRail('Process Planning');

    await showDetailed();

    expect(container.querySelectorAll('.assessment-rail__seg')).toHaveLength(10);
    expect(container.querySelectorAll('.assessment-rail__seg--striped')).toHaveLength(0);
    expect(screen.queryByText(/pending Comms ratification/)).toBeNull();
  });
});
