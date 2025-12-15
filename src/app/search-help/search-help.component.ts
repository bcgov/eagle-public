import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-search-help',
  templateUrl: './search-help.component.html',
  styleUrl: './search-help.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class SearchHelpComponent {}
