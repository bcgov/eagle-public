import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FileUpload, DEFAULT_FILE_EXT } from './file-upload';

function pdf(name: string, size = 10): File {
  const file = new File(['x'.repeat(size)], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function dropArea(): HTMLElement {
  return document.querySelector('.dragDropStyling') as HTMLElement;
}

function browse(files: File[]): void {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
}

describe('FileUpload', () => {
  afterEach(() => vi.useRealTimers());

  it('renders the accepted types and size limit', () => {
    render(<FileUpload onFilesChange={vi.fn()} />);

    expect(screen.getByText(/Drop files to attach, or browse\./)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(DEFAULT_FILE_EXT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
    ).toBeInTheDocument();
    expect(screen.getByText(/Individual file size limit: 10MB/)).toBeInTheDocument();
  });

  it('starts in the dragarea class and switches to droparea while dragging', () => {
    render(<FileUpload onFilesChange={vi.fn()} />);

    expect(dropArea()).toHaveClass('dragarea');

    fireEvent.dragOver(dropArea());
    expect(dropArea()).toHaveClass('droparea');

    fireEvent.dragLeave(dropArea());
    expect(dropArea()).toHaveClass('dragarea');

    fireEvent.dragEnter(dropArea());
    expect(dropArea()).toHaveClass('droparea');

    fireEvent.dragEnd(dropArea());
    expect(dropArea()).toHaveClass('dragarea');
  });

  it('emits the dropped files appended to the existing ones', () => {
    const existing = pdf('already.pdf');
    const onFilesChange = vi.fn();
    render(<FileUpload files={[existing]} onFilesChange={onFilesChange} />);

    const dropped = pdf('dropped.pdf');
    fireEvent.drop(dropArea(), { dataTransfer: { files: [dropped] } });

    expect(onFilesChange).toHaveBeenCalledWith([existing, dropped]);
    expect(dropArea()).toHaveClass('dragarea');
  });

  it('emits browsed files', () => {
    const onFilesChange = vi.fn();
    render(<FileUpload onFilesChange={onFilesChange} />);

    const file = pdf('browsed.pdf');
    browse([file]);

    expect(onFilesChange).toHaveBeenCalledWith([file]);
  });

  it('rejects an unaccepted extension and emits nothing', () => {
    const onFilesChange = vi.fn();
    render(<FileUpload onFilesChange={onFilesChange} />);

    browse([new File(['x'], 'virus.exe')]);

    expect(screen.getByText(/Invalid extension: virus\.exe/)).toBeInTheDocument();
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it('rejects a file over the size limit', () => {
    const onFilesChange = vi.fn();
    render(<FileUpload maxSize={10} onFilesChange={onFilesChange} />);

    browse([pdf('huge.pdf', 11 * 1024 * 1024)]);

    expect(screen.getByText(/File too large: huge\.pdf/)).toBeInTheDocument();
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it('counts files already attached against maxFiles', () => {
    const onFilesChange = vi.fn();
    render(
      <FileUpload
        maxFiles={2}
        files={[pdf('a.pdf'), pdf('b.pdf')]}
        onFilesChange={onFilesChange}
      />,
    );

    browse([pdf('c.pdf')]);

    expect(screen.getByText(/Too many files/)).toBeInTheDocument();
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it('clears the error list after five seconds', () => {
    vi.useFakeTimers();
    render(<FileUpload onFilesChange={vi.fn()} />);

    browse([new File(['x'], 'virus.exe')]);
    expect(screen.getByText(/Invalid extension: virus\.exe/)).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText(/Invalid extension: virus\.exe/)).not.toBeInTheDocument();
  });

  it('removes a listed file and clears errors', () => {
    const keep = pdf('keep.pdf');
    const drop = pdf('drop.pdf');
    const onFilesChange = vi.fn();
    render(<FileUpload files={[drop, keep]} onFilesChange={onFilesChange} />);

    browse([new File(['x'], 'virus.exe')]);
    expect(screen.getByText(/Invalid extension: virus\.exe/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle('Remove this file')[0]);

    expect(onFilesChange).toHaveBeenCalledWith([keep]);
    expect(screen.queryByText(/Invalid extension: virus\.exe/)).not.toBeInTheDocument();
  });

  it('hides the file list when showList is false', () => {
    render(<FileUpload showList={false} files={[pdf('hidden.pdf')]} onFilesChange={vi.fn()} />);

    expect(screen.queryByText('hidden.pdf')).not.toBeInTheDocument();
  });
});
