import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchHelpComponent } from './search-help.component';

describe('SearchHelpComponent', () => {
  let component: SearchHelpComponent;
  let fixture: ComponentFixture<SearchHelpComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SearchHelpComponent]
    });

    fixture = TestBed.createComponent(SearchHelpComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
