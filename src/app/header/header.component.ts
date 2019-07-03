import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})

export class HeaderComponent {
  constructor(
    public router: Router
  ) { }
  // tslint:disable-next-line:use-life-cycle-interface
  ngOnInit() {
  let isIEOrEdge = /msie\s|trident\/|edge\//i.test(window.navigator.userAgent);
  const browser_alert = document.getElementById('browser-alert');
  if ( isIEOrEdge) {
    browser_alert.classList.add('showForIEorEdge');
  }
  }
}
