import { Component, ChangeDetectionStrategy } from '@angular/core';
import { HeroBannerComponent } from 'app/shared/hero-banner/hero-banner.component';

@Component({
  selector: 'app-search-help',
  templateUrl: './search-help.component.html',
  styleUrl: './search-help.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroBannerComponent],
  standalone: true
})
export class SearchHelpComponent {}
