import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { PageScrollService } from 'ngx-page-scroll-core';
import { CookieService } from 'ngx-cookie-service';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/takeUntil';

import { ApiService } from 'app/services/api';
import { ConfigService } from 'app/services/config.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit, OnDestroy {
  isSafari: boolean;
  loggedIn: string;
  hostname: string;
  showIntroModal: string;
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();

  constructor(
    public router: Router,
    private cookieService: CookieService,
    private api: ApiService,
    private configService: ConfigService,
    private modalService: NgbModal,
    private pageScrollService: PageScrollService
  ) {
    // ref: https://stackoverflow.com/questions/5899783/detect-safari-using-jquery
    this.isSafari = (/^((?!chrome|android).)*safari/i.test(navigator.userAgent));

    // used for sharing links
    this.hostname = api.apiPath; // TODO: Wrong
  }

  ngOnInit() {
    this.loggedIn = this.cookieService.get('loggedIn');

    this.router.events
      .takeUntil(this.ngUnsubscribe)
      .subscribe(() => {
        this.pageScrollService.scroll({
          document: document,
          scrollTarget: '.theTop',
        });
      });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
