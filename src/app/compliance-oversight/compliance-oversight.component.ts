import { Component, ChangeDetectionStrategy } from '@angular/core';

import { HeroBannerComponent, HeroBannerAction } from '../shared/hero-banner/hero-banner.component';

@Component({
  selector: 'app-compliance-oversight',
  templateUrl: './compliance-oversight.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroBannerComponent],
  standalone: true
})
export class ComplianceOversightComponent {
  readonly heroBannerTitle = 'Compliance Oversight';
  readonly heroBannerDescription = 'Learn about how we collaborate with other government agencies to coordinate oversight of projects that have successfully completed an environmental assessment.';
  readonly heroBannerActions: HeroBannerAction[] = [
    {
      label: 'View Compliance & Enforcement Policies and Procedures',
      href: 'https://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/environmental-assessments/compliance-and-enforcement',
      icon: 'open_in_new',
      target: '_blank',
      rel: 'noopener',
      title: 'View compliance and enforcement policies and procedures'
    }
  ];
}
