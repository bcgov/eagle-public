import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectNotificationDocumentsTableDetails } from './project-notification-documents-table-details';

/** No `associatedProjectId`, so the card draws no link and needs no router around it. */
const NOTIFICATION = {
  _id: 'n1',
  name: 'Bear Creek Aggregate',
  description: 'Expansion of an existing sand and gravel operation.',
  proponent: 'Gravel Co',
};

describe('ProjectNotificationDocumentsTableDetails', () => {
  it('names the proponent the notification carries as words', () => {
    render(<ProjectNotificationDocumentsTableDetails rowData={NOTIFICATION} />);

    expect(screen.getByText('Gravel Co')).toBeInTheDocument();
  });

  it('names a populated proponent rather than printing the record it arrived as', () => {
    render(
      <ProjectNotificationDocumentsTableDetails
        rowData={{ ...NOTIFICATION, proponent: { _id: 'o1', name: 'Coast Aggregates' } }}
      />,
    );

    expect(screen.getByText('Coast Aggregates')).toBeInTheDocument();
  });

  it('dashes a proponent the record has no value for', () => {
    render(
      <ProjectNotificationDocumentsTableDetails
        rowData={{ ...NOTIFICATION, proponent: undefined }}
      />,
    );

    expect(screen.getByText('Proponent').nextElementSibling).toHaveTextContent('-');
  });
});
