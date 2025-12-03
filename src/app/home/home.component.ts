import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { SearchService } from 'app/services/search.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { News } from 'app/models/news';
import { ApiService } from 'app/services/api';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})

export class HomeComponent implements OnInit, OnDestroy {
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  results: News[];

  public showNotificationProjects = false;
  public surveyUrl: string;
  public showSurveyBanner: boolean;

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private searchService: SearchService,
    private apiService: ApiService
  ) { }

  ngOnInit() {
    this.searchService.getTopNewsItems()
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe((res: News[]) => {
        this.results = res;
        this._changeDetectionRef.detectChanges();
      });

    // Remove this when we want notification projects
    if (this.apiService.env === 'demo') {
      this.showNotificationProjects = true;
    }
    this.surveyUrl = this.apiService.surveyUrl;
    this.showSurveyBanner = this.apiService.showSurveyBanner;
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
