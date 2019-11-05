import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationProjectsListComponent } from './notification-projects.component';

describe('NotificationProjectsListComponent', () => {
  let component: NotificationProjectsListComponent;
  let fixture: ComponentFixture<NotificationProjectsListComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NotificationProjectsListComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NotificationProjectsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
