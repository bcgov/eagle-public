import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { DecisionsTabComponent } from './decisions-tab.component';
import { NewlinesPipe } from 'app/shared/pipes/newlines.pipe';
import { VarDirective } from 'app/shared/utils/ng-var.directive';
import { RouterTestingModule } from '@angular/router/testing';
import { ApiService } from 'app/services/api';
import { ProjectService } from 'app/services/project.service';
import 'rxjs/add/observable/of';
import { Project } from 'app/models/project';
import { ActivatedRoute, Router } from '@angular/router';
import { ActivatedRouteStub } from 'app/spec/helpers';

describe('DecisionsTabComponent', () => {
  let component: DecisionsTabComponent;
  let fixture: ComponentFixture<DecisionsTabComponent>;

  const existingProject = new Project();
  const validRouteData = {project: existingProject};

  const activatedRouteStub = new ActivatedRouteStub(validRouteData);
  const routerSpy = {
    navigate: jasmine.createSpy('navigate')
  };

  const apiServiceStub = {
    getDocumentUrl() {
      return 'http://prc-api/documents/1/download';
    }
  };

  const projectServiceStub = {
    getStatusCode() {
      return 'AC';
    },
    isDecision() {
      return true;
    }
  };

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        DecisionsTabComponent,
        NewlinesPipe,
        VarDirective
      ],
      imports: [RouterTestingModule],
      providers: [
        { provide: ApiService, useValue: apiServiceStub },
        { provide: ProjectService, useValue: projectServiceStub },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: Router, useValue: routerSpy },
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DecisionsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('when the project is retrievable from the route', () => {
    beforeEach(() => {
      activatedRouteStub.setParentData(validRouteData);
    });

    it('sets the component project to the one from the route', () => {
      component.ngOnInit();
      expect(component.project).toEqual(existingProject);
    });
  });

  describe('when the project is not available from the route', () => {
    beforeEach(() => {
      activatedRouteStub.setParentData({something: 'went wrong'});
    });

    it('redirects to /projects', () => {
      component.ngOnInit();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/projects']);
    });
  });
});
