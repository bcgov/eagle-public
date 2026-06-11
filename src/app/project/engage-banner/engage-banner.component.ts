import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { DatePipe, LowerCasePipe } from '@angular/common';

@Component({
  selector: 'app-engage-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LowerCasePipe],
  templateUrl: './engage-banner.component.html',
  styleUrl: './engage-banner.component.css',
})
export class EngageBannerComponent {
  engagementUrl = input.required<string>();
  dateStarted = input<string | Date | null>(null);
  dateCompleted = input<string | Date | null>(null);
  cpStatus = input<string | null>(null);
}
