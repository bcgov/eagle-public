import { TestBed, async } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AppComponent } from './app.component';

import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { NgxPageScrollModule } from 'ngx-page-scroll';
import { CookieService } from 'ngx-cookie-service';
import { ApiService } from 'app/services/api';
import { ConfigService } from 'app/services/config.service';

describe('AppComponent', () => {
  const apiServiceStub = {
    apiPath: 'https://great-api.gov.bc.ca/api/public'
  };

  const configServiceStub = {
    init() {},
  };

  const cookieServiceStub = {
    get() { return true; }
  };

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        AppComponent,
        HeaderComponent,
        FooterComponent
      ],
      imports: [
        RouterTestingModule,
        NgxPageScrollModule,
      ],
      providers: [
        { provide: ApiService, useValue: apiServiceStub },
        { provide: CookieService, useValue: cookieServiceStub },
        { provide: ConfigService, useValue: configServiceStub }
      ]
    }).compileComponents();
  }));

  it('should create the app', async(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  }));

  it('should render the header in a span tag', async(() => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector('span.navbar-brand__title').textContent).toContain('EPIC');
  }));

  it('sets the hostname to the apiPath', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;

    expect(app.hostname).toEqual('https://great-api.gov.bc.ca/api/public');
  });
});
