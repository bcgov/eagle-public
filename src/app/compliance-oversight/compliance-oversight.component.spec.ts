import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComplianceOversightComponent } from './compliance-oversight.component';

describe('ComplianceOversightComponent', () => {
  let component: ComplianceOversightComponent;
  let fixture: ComponentFixture<ComplianceOversightComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ComplianceOversightComponent]
    });

    fixture = TestBed.createComponent(ComplianceOversightComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
