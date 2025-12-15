import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroBannerComponent, HeroBannerAction } from '../shared/hero-banner/hero-banner.component';

@Component({
  selector: 'app-legislation',
  templateUrl: './legislation.component.html',
  styleUrl: './legislation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, HeroBannerComponent],
  standalone: true
})
export class LegislationComponent {
  readonly heroBannerTitle = 'Legislation';
  readonly heroBannerDescription = 'Learn about the legislation and regulations that apply to environmental assessments in the province of British Columbia.';
  readonly heroBannerActions: HeroBannerAction[] = [
    {
      label: '2002 Environmental Assessment Act',
      href: 'https://www2.gov.bc.ca/gov/content?id=1D2FF7DF6672482A84705D2519574C27',
      icon: 'open_in_new',
      target: '_blank',
      rel: 'noopener',
      title: 'View more information'
    },
    {
      label: '2018 Environmental Assessment Act',
      href: 'https://www2.gov.bc.ca/gov/content?id=B5737A3A620146219ABED73B5066DEC6',
      icon: 'open_in_new',
      target: '_blank',
      rel: 'noopener',
      title: 'View more information'
    }
  ];
}
