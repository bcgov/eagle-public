import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageCountDisplayComponent } from './page-count-display.component';

describe('PageCountDisplayComponent', () => {
  let component: PageCountDisplayComponent;
  let fixture: ComponentFixture<PageCountDisplayComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PageCountDisplayComponent]
    });

    fixture = TestBed.createComponent(PageCountDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display empty message when totalItems is 0', () => {
    fixture.componentRef.setInput('totalItems', 0);
    fixture.detectChanges();
    expect(component.message()).toBe('');
  });

  it('should calculate correct message for valid page', () => {
    fixture.componentRef.setInput('totalItems', 100);
    fixture.componentRef.setInput('currentPageNum', 1);
    fixture.componentRef.setInput('currentPageSize', 25);
    fixture.detectChanges();
    
    const message = component.message();
    expect(message).toBe('Showing 25 of 100 results');
  });

  it('should handle last page correctly', () => {
    fixture.componentRef.setInput('totalItems', 90);
    fixture.componentRef.setInput('currentPageNum', 4);
    fixture.componentRef.setInput('currentPageSize', 25);
    fixture.detectChanges();
    
    const message = component.message();
    expect(message).toBe('Showing 90 of 90 results');
  });

  it('should handle page beyond total pages', () => {
    fixture.componentRef.setInput('totalItems', 50);
    fixture.componentRef.setInput('currentPageNum', 10);
    fixture.componentRef.setInput('currentPageSize', 25);
    fixture.detectChanges();
    
    expect(component.message()).toBe('Unable to display results, please clear and re-try');
  });
});
