import { useRef, useState, type DragEvent } from 'react';
import { track } from 'app/analytics/analytics';
import './file-upload.css';

export const DEFAULT_FILE_EXT =
  'jpg, jpeg, gif, png, bmp, doc, docx, xls, xlsx, ppt, pptx, pdf, txt, rtf';

interface FileUploadProps {
  fileExt?: string;
  maxFiles?: number;
  /** Per-file limit, in MB. */
  maxSize?: number;
  /** Files already attached. Counted against `maxFiles` and echoed back with every change. */
  files?: File[];
  showList?: boolean;
  onFilesChange: (files: File[]) => void;
}

export function FileUpload({
  fileExt = DEFAULT_FILE_EXT,
  maxFiles = 15,
  maxSize = 10,
  files = [],
  showList = true,
  onFilesChange,
}: FileUploadProps) {
  const [dragDropClass, setDragDropClass] = useState('dragarea');
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(fileList: File[]): string[] {
    const found: string[] = [];

    if (maxFiles > 0 && fileList.length + files.length > maxFiles) {
      found.push('Too many files');
    }

    if (fileExt.length > 0) {
      const extensions = fileExt.split(',').map((x) => x.toUpperCase().trim());
      for (const file of fileList) {
        const ext = file.name.toUpperCase().split('.').pop() || file.name;
        if (!extensions.includes(ext)) {
          found.push('Invalid extension: ' + file.name);
        }
      }
    }

    if (maxSize > 0) {
      for (const file of fileList) {
        // rounded to 2 decimal places, so a file a few bytes over the limit still passes
        const size = Math.round((file.size / 1024 / 1024) * 100) / 100;
        if (size > maxSize) {
          found.push('File too large: ' + file.name);
        }
      }
    }

    return found;
  }

  function addFiles(fileList: FileList, method: 'drag_drop' | 'browse') {
    const added = Array.from(fileList);
    const found = validate(added);
    setErrors(found);

    if (found.length > 0) {
      setTimeout(() => setErrors([]), 5000);
      track('File Upload Failed', {
        file_count: added.length,
        upload_method: method,
        error_count: found.length,
        errors: found,
      });
      return;
    }

    const totalSize = added.reduce((sum, file) => sum + file.size, 0);
    track('File Upload Attempted', {
      file_count: added.length,
      total_size_mb: Math.round((totalSize / 1024 / 1024) * 100) / 100,
      upload_method: method,
    });
    onFilesChange([...files, ...added]);
  }

  function removeFile(file: File) {
    setErrors([]);
    track('File Upload Removed', {
      file_name: file.name,
      file_size_mb: Math.round((file.size / 1024 / 1024) * 100) / 100,
    });
    onFilesChange(files.filter((item) => item !== file));
  }

  function setDrag(event: DragEvent, className: string) {
    event.preventDefault();
    setDragDropClass(className);
  }

  return (
    <>
      <div
        draggable="true"
        className={dragDropClass + ' dragDropStyling'}
        onDragOver={(event) => setDrag(event, 'droparea')}
        onDragEnter={(event) => setDrag(event, 'droparea')}
        onDragEnd={(event) => setDrag(event, 'dragarea')}
        onDragLeave={(event) => setDrag(event, 'dragarea')}
        onDrop={(event) => {
          setDrag(event, 'dragarea');
          event.stopPropagation();
          if (event.dataTransfer?.files) {
            addFiles(event.dataTransfer.files, 'drag_drop');
          }
        }}
      >
        <div className="row">
          <div className="col-md-12 text-center">
            <button
              type="button"
              className="btn btn-link"
              onClick={() => inputRef.current?.click()}
            >
              <i className="material-icons">file_upload</i>
              Drop files to attach, or browse.
            </button>
            <br />
            <span className="fileInfo">
              Accepted file types: {fileExt}
              <br />
              Individual file size limit: {maxSize}MB
            </span>
            <input
              type="file"
              ref={inputRef}
              multiple={maxFiles > 1}
              // Clearing on click lets the same file be picked twice in a row.
              onClick={(event) => {
                (event.target as HTMLInputElement).value = '';
              }}
              onChange={(event) => {
                if (event.target.files) {
                  addFiles(event.target.files, 'browse');
                }
              }}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {showList && files.length > 0 && (
        <div className="files-list">
          <ul>
            {files.map((f) => (
              <li key={f.name}>
                <span className="name">{f.name}</span>
                <span className="value">
                  <button
                    type="button"
                    className="btn btn-danger btn-xs"
                    onClick={() => removeFile(f)}
                    title="Remove this file"
                  >
                    <i className="material-icons">clear</i>
                    <span>Remove</span>
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div className="errors-list">
          <ul>
            {errors.map((err) => (
              <li key={err}>
                <i className="material-icons">error</i>&nbsp;{err}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
