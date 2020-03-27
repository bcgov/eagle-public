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

       // Set the environment
       switch (this.apiService.env) {
        case 'local':
          this.envName = 'Local';
          break;
        case 'dev':
          this.envName = 'Development';
          break;
        case 'test':
          this.envName = 'Testing';
          break;
        case 'demo':
          this.envName = 'Demo';
          break;
        default:
          this.envName = null;
      }
  }
}
