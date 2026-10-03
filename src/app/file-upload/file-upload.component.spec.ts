import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileUploadComponent } from './file-upload.component';

describe('FileUploadComponent', () => {
  let component: FileUploadComponent;
  let fixture: ComponentFixture<FileUploadComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FileUploadComponent]
    });

    fixture = TestBed.createComponent(FileUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default dragarea class', () => {
    expect(component.dragDropClass()).toBe('dragarea');
  });

  it('should change class to droparea on dragover', () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
    component.onDragOver(event);
    expect(component.dragDropClass()).toBe('droparea');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should change class to droparea on dragenter', () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
    component.onDragEnter(event);
    expect(component.dragDropClass()).toBe('droparea');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should reset class to dragarea on dragleave', () => {
    component.dragDropClass.set('droparea');
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
    component.onDragLeave(event);
    expect(component.dragDropClass()).toBe('dragarea');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should reset class to dragarea on dragend', () => {
    component.dragDropClass.set('droparea');
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
    component.onDragEnd(event);
    expect(component.dragDropClass()).toBe('dragarea');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('should handle file removal', () => {
    const file1 = new File(['content1'], 'test1.pdf', { type: 'application/pdf' });
    const file2 = new File(['content2'], 'test2.pdf', { type: 'application/pdf' });
    
    fixture.componentRef.setInput('files', [file1, file2]);
    fixture.detectChanges();
    
    let emittedFiles: File[] | undefined;
    component.filesChange.subscribe((files) => {
      emittedFiles = files;
    });
    
    component.removeFile(file1);
    
    expect(emittedFiles).toBeDefined();
    expect(emittedFiles?.length).toBe(1);
    expect(emittedFiles?.[0]).toBe(file2);
  });

  it('should clear errors when removing file', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    fixture.componentRef.setInput('files', [file]);
    component.errors.set(['Some error']);
    
    component.removeFile(file);
    
    expect(component.errors()).toEqual([]);
  });

  it('should have default input values', () => {
    expect(component.fileExt()).toBe('jpg, jpeg, gif, png, bmp, doc, docx, xls, xlsx, ppt, pptx, pdf, txt, rtf');
    expect(component.maxFiles()).toBe(15);
    expect(component.maxSize()).toBe(10);
    expect(component.files()).toEqual([]);
    expect(component.showInfo()).toBe(true);
    expect(component.showList()).toBe(true);
  });
});
