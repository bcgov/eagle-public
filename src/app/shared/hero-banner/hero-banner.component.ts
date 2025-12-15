import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule, RouterModule],
  standalone: true
})
export class HeroBannerComponent {
  title = input.required<string>();
  description = input.required<string>();
  actions = input<HeroBannerAction[]>([]);
}
