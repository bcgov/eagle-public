import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from 'app/services/api';
import * as _ from 'lodash';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})

export class HeaderComponent {
  public envName: string;
  public bannerColour: string;
  public showBanner = false;

  constructor(
    public router: Router,
    private apiService: ApiService,
  ) { }

  // tslint:disable-next-line:use-life-cycle-interface
  ngOnInit() {
    let isIEOrEdge = /msie\s|trident\/|edge\//i.test(window.navigator.userAgent);
    const browser_alert = document.getElementById('browser-alert');
    if (isIEOrEdge) {
      browser_alert.classList.add('showForIEorEdge');
      browser_alert.hidden = false;
    }

    this.envName = this.apiService.env;
    this.bannerColour = this.apiService.bannerColour;
    if (!_.isEmpty(this.envName) && !_.isEmpty(this.bannerColour)) {
      this.showBanner = true;
    }
    console.log(this.bannerColour);

  }
}
