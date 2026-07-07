import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BecomeAMemberComponent } from './become-a-member.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project';
import { ComponentRef } from '@angular/core';

describe('BecomeAMemberComponent', () => {
  let component: BecomeAMemberComponent;
  let fixture: ComponentFixture<BecomeAMemberComponent>;
  let mockActiveModal: any;
  let mockProjectService: any;
  let mockProject: Project;

  beforeEach(() => {
    mockActiveModal = {
      close: vi.fn(),
      dismiss: vi.fn()
    };

    mockProjectService = {
      cacSignUp: vi.fn()
    };

    mockProject = new Project({ _id: '123', name: 'Test Project' });

    TestBed.configureTestingModule({
      imports: [BecomeAMemberComponent],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ProjectService, useValue: mockProjectService }
      ]
    });

    fixture = TestBed.createComponent(BecomeAMemberComponent);
    component = fixture.componentInstance;
    
    // Set the required input using componentRef
    const componentRef = fixture.componentRef as ComponentRef<BecomeAMemberComponent>;
    componentRef.setInput('project', mockProject);
    
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

  it('should navigate to page 2 when p1_next is called', () => {
    component.p1_next();
    expect(component.currentPage()).toBe(2);
  });
});
