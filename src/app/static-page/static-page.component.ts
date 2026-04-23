import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { HeroBannerComponent, HeroBannerAction } from '../shared/hero-banner/hero-banner.component';
import { InfoCardComponent, InfoCardButton } from '../shared/info-card/info-card.component';
import { SafeHtmlPipe } from '../shared/pipes/safe-html-converter.pipe';

export interface StaticPageData {
  heroBannerTitle: string;
  heroBannerDescription: string;
  heroBannerActions?: HeroBannerAction[];
  bodyHtml?: string;
  infoCards?: {
    title: string;
    description: string;
    icon?: string;
    button?: InfoCardButton;
  }[];
}

@Component({
  selector: 'app-static-page',
  templateUrl: './static-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroBannerComponent, InfoCardComponent, SafeHtmlPipe],
  standalone: true
})
export class StaticPageComponent {
  private route = inject(ActivatedRoute);

  page = toSignal(
    this.route.data.pipe(map(data => data as StaticPageData)),
    { initialValue: {} as StaticPageData }
  );
}
