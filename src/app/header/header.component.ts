import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from 'app/services/api';

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
    // no-banner-colour-set is the default if no banner colour is defined in the openshift environment variables.
    if ( this.envName && this.bannerColour && this.bannerColour !== 'no-banner-colour-set') {
      this.showBanner = true;
    }
  }
}
