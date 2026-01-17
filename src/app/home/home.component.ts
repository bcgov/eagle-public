import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SearchService } from 'app/services/search.service';
import { ApiService } from 'app/services/api';
import { LoggingService } from 'app/services/logging.service';
import { LoadingStateService } from 'app/services/loading-state.service';
import { News } from 'app/models/news';
import { HeroBannerComponent, HeroBannerAction } from '../shared/hero-banner/hero-banner.component';
import { InfoCardComponent, InfoCardButton } from '../shared/info-card/info-card.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, HeroBannerComponent, InfoCardComponent],
  standalone: true
})
export class HomeComponent implements OnInit, OnDestroy {
  private searchService = inject(SearchService);
  private apiService = inject(ApiService);
  private logger = inject(LoggingService);
  private loadingState = inject(LoadingStateService);
  private destroy$ = new Subject<boolean>();

  results = signal<News[]>([]);
  surveyUrl = signal<string>('');
  showSurveyBanner = signal<boolean>(false);
  loading = this.loadingState.getOperationState('home');

  readonly heroBannerTitle = 'Environmental Assessments';
  readonly heroBannerDescription = "British Columbia's environmental assessment process provides opportunities for Indigenous Nations, government agencies and the public to influence the outcome of environmental assessments in British Columbia.";
  readonly heroBannerActions: HeroBannerAction[] = [
    {
      label: 'Find Environmental Assessment Projects',
      routerLink: '/projects',
      icon: 'list'
    },
    {
      label: 'List of Projects',
      routerLink: '/projects-list',
      icon: 'list'
    },
    {
      label: 'Project Notifications',
      routerLink: '/project-notifications',
      icon: 'list'
    }
  ];

  readonly aboutCards = [
    {
      title: 'Legislation',
      description: 'Learn about the legislation and regulations that apply to environmental assessments in the province of British Columbia.',
      button: {
        text: 'Learn More',
        link: '/legislation',
        title: 'Learn more about legislation'
      } as InfoCardButton
    },
    {
      title: 'Process & Procedures',
      description: 'Learn more about how the Environmental Assessment Office neutrally administers a process that holds all participants accountable.',
      button: {
        text: 'Learn More',
        link: '/process',
        title: 'Learn more about process and procedures'
      } as InfoCardButton
    },
    {
      title: 'Compliance Oversight',
      description: 'Learn about how we collaborate with other agencies to coordinate oversight of environmental assessment projects.',
      button: {
        text: 'Learn More',
        link: '/compliance-oversight',
        title: 'Learn more about compliance oversight'
      } as InfoCardButton
    }
  ];

  ngOnInit(): void {
    this.searchService.getTopNewsItems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: News[]) => {
          this.results.set(res || []);
        },
        error: (err) => {
          this.logger.error('Error loading recent activities', 'HomeComponent', err);
          this.results.set([]);
        }
      });

    this.surveyUrl.set(this.apiService.surveyUrl || '');
    this.showSurveyBanner.set(this.apiService.showSurveyBanner);
  }

  ngOnDestroy(): void {
    this.destroy$.next(true);
    this.destroy$.complete();
  }
}
