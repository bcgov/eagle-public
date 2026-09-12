import { render, screen } from '@testing-library/react';
import { Highlight, excerptAround, toTerms } from './highlight';

describe('toTerms', () => {
  it('splits on whitespace, strips quotes and drops one-character words', () => {
    expect(toTerms('"cedar lng" a sediment')).toEqual(['cedar', 'lng', 'sediment']);
  });

  it('has no terms for an empty keyword', () => {
    expect(toTerms('')).toEqual([]);
    expect(toTerms(undefined)).toEqual([]);
  });
});

describe('Highlight', () => {
  it('marks every case-insensitive match of every term', () => {
    render(<Highlight text="Sediment and sediment control" terms={['sediment']} />);

    const marks = screen.getAllByText(/sediment/i, { selector: 'mark' });
    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveTextContent('Sediment');
  });

  it('leaves the text alone when there are no terms', () => {
    const { container } = render(<Highlight text="Sediment control" terms={[]} />);

    expect(container).toHaveTextContent('Sediment control');
    expect(container.querySelectorAll('mark')).toHaveLength(0);
  });

  it('never turns a hostile term into an element', () => {
    const hostile = '<img src=x onerror="alert(1)">';
    const { container } = render(<Highlight text={`before ${hostile} after`} terms={[hostile]} />);

    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent(`before ${hostile} after`);
    expect(screen.getByText(hostile, { selector: 'mark' })).toBeInTheDocument();
  });

  it('adds no whitespace around a mid-word match', () => {
    const { container } = render(<Highlight text="sedimentation" terms={['diment']} />);

    expect(container.textContent).toBe('sedimentation');
  });

  it('does not nest one mark inside another when terms overlap', () => {
    const { container } = render(
      <Highlight text="sedimentation basin" terms={['sediment', 'mentation']} />,
    );

    expect(container.textContent).toBe('sedimentation basin');
    expect(container.querySelectorAll('mark')).toHaveLength(1);
    expect(container.querySelector('mark')).toHaveTextContent('sedimentation');
  });
});

describe('excerptAround', () => {
  const lead = 'a'.repeat(120);
  const far = 'b'.repeat(400);

  it('leaves the excerpt at the top when the hit is inside the first 140 characters', () => {
    const text = `${lead} sediment ${far}`;

    const excerpt = excerptAround(text, ['sediment'], { length: 260 });

    expect(excerpt.startsWith(lead.slice(0, 20))).toBe(true);
    expect(excerpt.startsWith('…')).toBe(false);
  });

  it('starts 80 characters before a later hit, with a leading ellipsis', () => {
    const text = `${far} sediment tail`;

    const excerpt = excerptAround(text, ['sediment'], { length: 260 });

    expect(excerpt.startsWith('…')).toBe(true);
    expect(excerpt).toContain('sediment');
    // 80 characters of run-up sit between the ellipsis and the hit.
    expect(excerpt.indexOf('sediment')).toBe(81);
  });

  it('falls back to the top of the text when nothing matches', () => {
    const text = `${far} tail`;

    expect(excerptAround(text, ['nothing'], { length: 50 })).toBe(`${'b'.repeat(50)}…`);
  });

  it('returns the whole text when it is shorter than the excerpt length', () => {
    expect(excerptAround('short body', ['body'], { length: 260 })).toBe('short body');
  });
});
