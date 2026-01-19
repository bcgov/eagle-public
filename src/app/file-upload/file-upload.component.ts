import { Component, input, output, signal } from '@angular/core';


@Component({
  selector: 'app-file-upload',
  imports: [],
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.css'],
  host: {
    '(dragover)': 'onDragOver($event)',
    '(dragenter)': 'onDragEnter($event)',
    '(dragend)': 'onDragEnd($event)',
    '(dragleave)': 'onDragLeave($event)',
    '(drop)': 'onDrop($event)'
  },
  standalone: true
})
export class FileUploadComponent {
  dragDropClass = signal('dragarea');
  
  fileExt = input<string>('jpg, jpeg, gif, png, bmp, doc, docx, xls, xlsx, ppt, pptx, pdf, txt, rtf');
  maxFiles = input<number>(15);
  maxSize = input<number>(10); // in MB
  files = input<File[]>([]);
  showInfo = input<boolean>(true);
  showList = input<boolean>(true);
  
  filesChange = output<File[]>();
  
  errors = signal<string[]>([]);

  private currentFiles: File[] = [];

  onDragOver(event: DragEvent) {
    this.dragDropClass.set('droparea');
    event.preventDefault();
  }

  onDragEnter(event: DragEvent) {
    this.dragDropClass.set('droparea');
    event.preventDefault();
  }

  onDragEnd(event: DragEvent) {
    this.dragDropClass.set('dragarea');
    event.preventDefault();
  }

  onDragLeave(event: DragEvent) {
    this.dragDropClass.set('dragarea');
    event.preventDefault();
  }

  onDrop(event: DragEvent) {
    this.dragDropClass.set('dragarea');
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files) {
      this.addFiles(event.dataTransfer.files);
    }
  }

  onFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      this.addFiles(target.files);
    }
  }

  addFiles(fileList: FileList) {
    this.errors.set([]); // clear previous errors
    this.currentFiles = [...this.files()];

    if (this.isValidFiles(fileList)) {
      for (const file of Array.from(fileList)) {
        this.currentFiles.push(file);
      }
      this.filesChange.emit(this.currentFiles);
    }
  }

  removeFile(file: File) {
    this.errors.set([]); // clear previous errors
    this.currentFiles = [...this.files()];

    const index = this.currentFiles.indexOf(file);
    if (index !== -1) {
      this.currentFiles.splice(index, 1);
    }
    this.filesChange.emit(this.currentFiles);
  }

  private isValidFiles(fileList: FileList): boolean {
    if (this.maxFiles() > 0) { this.validateMaxFiles(fileList); }
    if (this.fileExt().length > 0) { this.validateFileExtensions(fileList); }
    if (this.maxSize() > 0) { this.validateFileSizes(fileList); }
    return (this.errors().length === 0);
  }

  private validateMaxFiles(fileList: FileList): boolean {
    if ((fileList.length + this.files().length) > this.maxFiles()) {
      const currentErrors = [...this.errors()];
      currentErrors.push('Too many files');
      this.errors.set(currentErrors);
      setTimeout(() => this.errors.set([]), 5000);
      return false;
    }
    return true;
  }

  private validateFileExtensions(fileList: FileList): boolean {
    let ret = true;
    const extensions = this.fileExt().split(',').map(x => x.toUpperCase().trim());
    for (const file of Array.from(fileList)) {
      const ext = file.name.toUpperCase().split('.').pop() || file.name;
      if (!extensions.includes(ext)) {
        const currentErrors = [...this.errors()];
        currentErrors.push('Invalid extension: ' + file.name);
        this.errors.set(currentErrors);
        setTimeout(() => this.errors.set([]), 5000);
        ret = false;
      }
    }
    return ret;
  }

  private validateFileSizes(fileList: FileList): boolean {
    let ret = true;
    for (const file of Array.from(fileList)) {
      const fileSizeinMB = file.size / 1024 / 1024; // in MB
      const size = Math.round(fileSizeinMB * 100) / 100; // convert up to 2 decimal places
      if (size > this.maxSize()) {
        const currentErrors = [...this.errors()];
        currentErrors.push('File too large: ' + file.name);
        this.errors.set(currentErrors);
        setTimeout(() => this.errors.set([]), 5000);
        ret = false;
      }
    }
    return ret;
  }
}
