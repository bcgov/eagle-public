import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toUpdate } from 'app/api/updates';
import { UpdateBody } from './update-detail';

type Row = Parameters<typeof toUpdate>[0];

function renderBody(row: Row) {
  return render(<UpdateBody update={toUpdate({ _id: 'u1', headline: 'Headline', ...row })} />);
}

describe('UpdateBody featured image', () => {
  it('frames a captioned, credited image as a figure with its caption', () => {
    renderBody({
      featuredImage: {
        document: 'img-1',
        alt: 'The intake',
        caption: 'Intake works, June',
        credit: 'EAO staff',
      },
    });

    const figure = screen.getByRole('figure');
    expect(figure).toContainElement(screen.getByRole('img', { name: 'The intake' }));
    expect(figure).toHaveTextContent('Intake works, JunePhoto: EAO staff');
  });

  it('frames an image with only a credit, too', () => {
    renderBody({ featuredImage: { document: 'img-1', alt: 'The intake', credit: 'EAO staff' } });

    expect(screen.getByRole('figure')).toHaveTextContent(/^Photo: EAO staff$/);
  });

  it('renders a bare image, with no figure around it, when there is nothing to caption', () => {
    renderBody({ featuredImage: { document: 'img-1', alt: 'The intake', caption: '  ' } });

    expect(screen.getByRole('img', { name: 'The intake' }).closest('figure')).toBeNull();
    expect(screen.queryByRole('figure')).toBeNull();
  });
});

describe('UpdateBody documents', () => {
  it('lists a file attached twice once', async () => {
    renderBody({ attachments: ['doc-1', { _id: 'doc-1', displayName: 'Notice.pdf' }] });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Documents (1)' }));
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
