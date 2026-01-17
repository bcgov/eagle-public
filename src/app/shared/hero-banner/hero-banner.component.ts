import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

import { RouterModule } from '@angular/router';

export interface HeroBannerAction {
  label: string;
  routerLink?: string;
  href?: string;
  icon?: string;
  target?: string;
  rel?: string;
  title?: string;
}

@Component({
  selector: 'app-hero-banner',
  templateUrl: './hero-banner.component.html',
  styleUrl: './hero-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule],
  standalone: true
})
export class HeroBannerComponent {
  title = input.required<string>();
  description = input.required<string>();
  actions = input<HeroBannerAction[]>([]);
  backgroundImage = input<string>();
  
  backgroundStyle = computed(() => {
    const bgImage = this.backgroundImage();
    return bgImage ? `url(${bgImage})` : '';
  });
  
  onExternalLinkClick(event: MouseEvent): void {
    // Remove focus from the link after clicking to prevent stuck hover state
    const target = event.currentTarget as HTMLElement;
    setTimeout(() => target.blur(), 0);
  }
}
