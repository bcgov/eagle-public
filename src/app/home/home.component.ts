import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { SearchService } from 'app/services/search.service';
import { Subject } from 'rxjs';
import { News } from 'app/models/news';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})

export class HomeComponent implements OnInit, OnDestroy {
  private ngUnsubscribe: Subject<boolean> = new Subject<boolean>();
  results: News[];

  constructor(
    private _changeDetectionRef: ChangeDetectorRef,
    private searchService: SearchService
  ) { }

  ngOnInit() {
    this.searchService.getTopNewsItems()
      .takeUntil(this.ngUnsubscribe)
      .subscribe((res: News[]) => {
        this.results = res;
        this._changeDetectionRef.detectChanges();
      });
  }

  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
