import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { MatSnackBarModule } from '@angular/material';
import { ApiService } from 'app/services/api';
import { StorageService } from 'app/services/storage.service';
import { Utils } from 'app/shared/utils/utils';
import { paramsWithDates, SearchResultsStub } from 'app/shared/utils/mock-data';
import { TableTemplateUtils } from 'app/shared/utils/table-template-utils';
import { SearchComponent } from './search.component';
import { SearchService } from 'app/services/search.service';
import { TableParamsObject } from 'app/shared/components/table-template/table-params-object';

describe('DocSearchComponent', () => {
  let component: SearchComponent;
  let fixture: ComponentFixture<SearchComponent>;
  const mockApiService = jasmine.createSpyObj('ApiService', [
    'downloadDocument'
  ]);
  const utils = new Utils();

  const mockTableTemplateUtils = jasmine.createSpyObj('TableTemplateUtils', [
    'updateUrl',
    'updateTableParams',
    'getParamsFromUrl'
  ])

  const mockStorageService = jasmine.createSpyObj('StorageService', [
    'state'
  ]);

  const defaultParams = new TableParamsObject();

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        SearchComponent,
      ],
      imports: [
        MatSnackBarModule,
        RouterTestingModule.withRoutes(
          [{ path: 'search', component: SearchComponent }]
        ),
        FormsModule,
        ReactiveFormsModule,
        NgbModule,
      ],
      providers: [
        { provide: ApiService, useValue: mockApiService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: SearchService, useClass: SearchResultsStub },
        { provide: Utils, useValue: utils },
        { provide: TableTemplateUtils, useValue: mockTableTemplateUtils }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    })
      .compileComponents();
  }));
  beforeEach(() => {
    fixture = TestBed.createComponent(SearchComponent);
    fixture.debugElement.injector.get(SearchService);
    component = fixture.componentInstance;
    mockTableTemplateUtils.getParamsFromUrl.and.returnValue(defaultParams);
    fixture.detectChanges();
  });

  it ('Date params are converted to filters', () => {
    component.setFiltersFromParams(paramsWithDates);
    expect(component.filterForUI['datePostedStart']).toEqual({year: 2020, month: 2, day: 1})
    expect(component.filterForUI['datePostedEnd']).toEqual({year: 2020, month: 3, day: 12})
  });

  it('Date filters are converted to params format YYYY-MM-DD', () => {
    component.filterForUI['datePostedStart'] = { year: 2020, month: 2, day: 1 };
    component.filterForUI['datePostedEnd'] = { year: 2020, month: 3, day: 12 };
    let params = { dataset: 'Document', currentPage: 1, pageSize: 10, ms: 807 };
    component.dateFilterToParams(params, 'datePostedStart');
    component.dateFilterToParams(params, 'datePostedEnd');
    expect(params).toEqual(paramsWithDates);
  });

  it('page number change updates url', () => {
    defaultParams.currentPage = 2;
    mockTableTemplateUtils.updateTableParams.and.returnValue(defaultParams);
    component.getPaginated(2);
    expect(mockTableTemplateUtils.updateUrl).toHaveBeenCalledWith('-datePosted', 2, 10, {}, '')
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
