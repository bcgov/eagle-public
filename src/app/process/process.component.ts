import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroBannerComponent, HeroBannerAction } from '../shared/hero-banner/hero-banner.component';

@Component({
  selector: 'app-process',
  templateUrl: './process.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, HeroBannerComponent],
  standalone: true
})
export class ProcessComponent {
  readonly heroBannerTitle = 'Process & Procedures';
  readonly heroBannerDescription = 'Learn more about how the Environmental Assessment Office neutrally administers a process that is predictable, transparent, timely, procedurally fair, and holds all participants accountable.';
  readonly heroBannerActions: HeroBannerAction[] = [
    {
      label: '2002 Environmental Assessment Act',
      href: 'https://www2.gov.bc.ca/gov/content?id=AF29E35F5F9F4ACE91BF59F5FA25BF54',
      icon: 'open_in_new',
      target: '_blank',
      rel: 'noopener',
      title: 'View more information'
    },
    {
      label: '2018 Environmental Assessment Act',
      href: 'https://www2.gov.bc.ca/gov/content?id=E0DC041CBB194136A0C14B8A2F829A16',
      icon: 'open_in_new',
      target: '_blank',
      rel: 'noopener',
      title: 'View more information'
    }
  ];
}
