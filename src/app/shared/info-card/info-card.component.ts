import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface InfoCardButton {
  text: string;
  link?: string;
  href?: string;
  icon?: string;
  target?: string;
  rel?: string;
  title?: string;
}

@Component({
  selector: 'app-info-card',
  templateUrl: './info-card.component.html',
  styleUrls: ['./info-card.component.css'],
  imports: [RouterLink],
  standalone: true
})
export class InfoCardComponent {
  title = input.required<string>();
  description = input.required<string>();
  icon = input<string>();
  button = input<InfoCardButton>();
}
