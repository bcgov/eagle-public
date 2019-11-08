import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { SearchService } from 'app/services/search.service';
import { Subject } from 'rxjs';
import { ApiService } from 'app/services/api';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})

export class HomeComponent implements OnInit, OnDestroy {
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  results: any;

  public showNotificationProjects = true;

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private searchService: SearchService,
    private apiService: ApiService
  ) { }

  ngOnInit() {
    this.searchService.getTopNewsItems()
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: any) => {
        this.results = res;
        this._changeDetectionRef.detectChanges();
      });

    // Remove this when we want notification projects
    if (this.apiService.env === 'prod') {
      this.showNotificationProjects = false;
    }
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
