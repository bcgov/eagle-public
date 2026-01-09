import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroBannerComponent, HeroBannerAction } from '../shared/hero-banner/hero-banner.component';
import { InfoCardComponent, InfoCardButton } from '../shared/info-card/info-card.component';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, HeroBannerComponent, InfoCardComponent],
  standalone: true
})
export class ContactComponent {
  readonly heroBannerTitle = 'Connect With Us';
  readonly heroBannerDescription = "This website aims to improve transparency of the provincial environmental assessment process, and to provide citizens and stakeholders with access to project data and information. If you are interested in providing us with feedback about your experience using this website, please feel free to send us your feedback.";
  readonly heroBannerActions: HeroBannerAction[] = [
    {
      label: 'Submit your Feedback',
      href: 'mailto:EAO.EPICsystem@gov.bc.ca',
      icon: 'email',
      title: 'Submit your feedback to the Environmental Assessment Office'
    }
  ];

  readonly infoCards = [
    {
      title: 'B.C. Environmental Assessment Office',
      description: 'Please use the <a href="https://dir.gov.bc.ca/gtds.cgi?show=Branch&organizationCode=ENV&organizationalUnitCode=ENVIRON5" target="_blank" rel="noopener">B.C. EAO Government Directory</a> listing to find contact information for specific Environmental Assessment Office staff.',
      icon: 'phone',
      button: {
        text: 'Visit EAO B.C. Government Directory',
        href: 'https://dir.gov.bc.ca/gtds.cgi?show=Branch&organizationCode=ENV&organizationalUnitCode=ENVIRON5',
        target: '_blank',
        rel: 'noopener',
        title: 'Go to the EAO B.C. Government Directory'
      } as InfoCardButton
    },
    {
      title: 'Compliance Oversight',
      description: 'For questions about compliance, or if you have information about possible non-compliance with an environmental assessment certificate, please email <a href="mailto:eao.compliance@gov.bc.ca">eao.compliance@gov.bc.ca</a>.',
      icon: 'email',
      button: {
        text: 'Email EAO Compliance',
        href: 'mailto:eao.compliance@gov.bc.ca',
        title: 'Email us your questions about compliance oversight'
      } as InfoCardButton
    },
    {
      title: 'Report Natural Resource Violations',
      description: 'If you have seen misconduct involving wildlife, ecosystems, heritage sites or natural resources, you can report it at this <a href="http://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/natural-resource-law-enforcement/report-natural-resource-violations" target="_blank" rel="noopener">link here</a>.',
      icon: 'report_problem',
      button: {
        text: 'Report a Natural Resource Violation',
        href: 'http://www2.gov.bc.ca/gov/content/environment/natural-resource-stewardship/natural-resource-law-enforcement/report-natural-resource-violations',
        target: '_blank',
        rel: 'noopener',
        title: 'Report a Natural Resource Violation'
      } as InfoCardButton
    }
  ];
}
