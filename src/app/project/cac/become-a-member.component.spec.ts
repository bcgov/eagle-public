import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BecomeAMemberComponent } from './become-a-member.component';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project';

describe('BecomeAMemberComponent', () => {
  let component: BecomeAMemberComponent;
  let fixture: ComponentFixture<BecomeAMemberComponent>;
  let mockDialogRef: any;
  let mockProjectService: any;
  let mockProject: Project;

  beforeEach(() => {
    mockDialogRef = {
      close: vi.fn()
    };

    mockProjectService = {
      addMember: vi.fn()
    };

    mockProject = new Project({ _id: '123', name: 'Test Project' });

    TestBed.configureTestingModule({
      imports: [BecomeAMemberComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { project: mockProject } },
        { provide: ProjectService, useValue: mockProjectService }
      ]
    });

    fixture = TestBed.createComponent(BecomeAMemberComponent);
    component = fixture.componentInstance;
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default values', () => {
    expect(component.submitting()).toBe(false);
    expect(component.currentPage()).toBe(1);
    expect(component.acknowledged()).toBe(false);
    expect(component.nameInput()).toBe('');
    expect(component.emailInput()).toBe('');
  });

  it('should have access to activeModal', () => {
    expect(component.activeModal).toBeDefined();
  });
});
