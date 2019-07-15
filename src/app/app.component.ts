import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { PageScrollConfig } from 'ngx-page-scroll';
import { CookieService } from 'ngx-cookie-service';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/operator/takeUntil';

import { ApiService } from 'app/services/api';
import { ConfigService } from 'app/services/config.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SplashModalComponent } from './splash-modal/splash-modal.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit, OnDestroy, AfterViewInit {
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
  ) {
    // ref: https://stackoverflow.com/questions/5899783/detect-safari-using-jquery
    this.isSafari = (/^((?!chrome|android).)*safari/i.test(navigator.userAgent));

    // used for sharing links
    this.hostname = api.apiPath; // TODO: Wrong

    PageScrollConfig.defaultScrollOffset = 50;
    PageScrollConfig.defaultEasingLogic = {
      ease: (t: number, b: number, c: number, d: number): number => {
        // easeInOutExpo easing
        if (t === 0) {
          return b;
        }
        if (t === d) {
          return b + c;
        }
        if ((t /= d / 2) < 1) {
          return c / 2 * Math.pow(2, 8 * (t - 1)) + b;
        }
        return c / 2 * (-Math.pow(2, -8 * --t) + 2) + b;
      }
    };

    // watch for URL param changes
    // NB: this must be in constructor to get initial filters

    // this.configService.init();
  }

  ngOnInit() {
    this.loggedIn = this.cookieService.get('loggedIn');

    this.showIntroModal = '';

    if (!this.cookieService.check('showIntroModal')) {
      this.cookieService.set('showIntroModal', 'true');
    }
    this.showIntroModal = this.cookieService.get('showIntroModal');

    this.router.events
      .takeUntil(this.ngUnsubscribe)
      .subscribe(() => {
        document.body.scrollTop = 0;

        document.documentElement.scrollTop = 0;
      });
  }

  ngAfterViewInit() {
    // show splash modal (unless a sub-component has already turned off this flag)
    // do this in another event so it's not in current change detection cycle
    if (this.showIntroModal === 'true') {
      setTimeout(() => {
        // this.splashModal =
        this.modalService.open(SplashModalComponent, {
          backdrop: 'static',
          windowClass: 'splash-modal'
        });
        this.cookieService.set('showIntroModal', 'false');
      });
    }
    return;
  }

  ngOnDestroy() {
    this.configService.destroy();

    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
