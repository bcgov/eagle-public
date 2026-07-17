import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { DatePipe, LowerCasePipe } from '@angular/common';
import { CommentPeriod } from '../../models/commentperiod';

@Component({
  selector: 'app-engage-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LowerCasePipe],
  templateUrl: './engage-banner.component.html',
  styleUrl: './engage-banner.component.css',
  host: {
    'class': 'engage-banner',
    '[class.engage-banner--has-image]': 'data().metBannerImageUrl',
  },
})
export class EngageBannerComponent {
  data = input.required<CommentPeriod>();

  statusClass = computed(() => {
    const status = this.data().bannerState;
    return status ? `engage-banner__status-chip--${status.toLowerCase()}` : '';
  });
}
