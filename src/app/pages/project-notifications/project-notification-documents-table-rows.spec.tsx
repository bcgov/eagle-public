import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadConfig } from 'app/config/config';
import { tableObject } from 'app/components/table/table-object';
import { ProjectNotificationDocumentsTableRow } from './project-notification-documents-table-rows';

const DOCUMENT = {
  _id: 'doc-1',
  displayName: 'Notification Package',
  documentFileName: 'notification.pdf',
  datePosted: '2026-05-04T00:00:00.000Z',
};

const DOWNLOAD_URL = '/api/public/document/doc-1/download/notification.pdf';

/** This table is never selectable, so the Name link is the row's only control. */
describe('ProjectNotificationDocumentsTableRow', () => {
  const originalEnv = window.__env;
  let openSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    window.__env = { logLevel: 4, API_PATH: '/api', SEARCH_API_PATH: '' };
    await loadConfig();
    openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    render(
      <table>
        <tbody>
          <ProjectNotificationDocumentsTableRow
            rowData={DOCUMENT}
            tableData={tableObject({ tableId: 'test' })}
            columns={[]}
            onMessage={() => undefined}
          />
        </tbody>
      </table>,
    );
  });

  afterEach(() => {
    window.__env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('starts the download from the name link rather than following the href', async () => {
    const link = screen.getByRole('link', { name: 'Notification Package' });
    expect(link).toHaveAttribute('href', DOWNLOAD_URL);

    await userEvent.click(link);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(DOWNLOAD_URL, '_blank');
  });

  it('is no tab stop of its own, and answers no keys', async () => {
    const row = screen.getByRole('row');

    expect(row).not.toHaveAttribute('tabindex');

    row.focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Enter}');

    expect(openSpy).not.toHaveBeenCalled();
  });

  it('downloads nothing when a metadata cell is clicked', async () => {
    await userEvent.click(screen.getByText('May 4, 2026'));

    expect(openSpy).not.toHaveBeenCalled();
  });
});
