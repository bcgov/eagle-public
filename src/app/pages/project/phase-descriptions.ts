import { POST_DECISION_ROW, railStageNameOf, stageRowFor } from './assessment-stages';

// Copied from EPIC.engage met-web engagementPhases.tsx `learnMoreText`; keep in sync by hand.
// Keyed by our 2018 row names: ENGAGE calls the last two "Decision" and "Post-Certificate".
const DESCRIPTIONS: Record<string, string> = {
  'Early Engagement':
    'Engage with Indigenous nations, stakeholders, technical experts and the public to identify potential key issues early in the process, and ways they could be addressed.',
  'Readiness Decision':
    'Review detailed project description, and input from early engagement and technical advisors, to determine whether to proceed to environmental assessment. Consensus with Indigenous nations sought.',
  'Process Planning':
    'Engage with Indigenous nations, stakeholders, technical experts to establish how the environmental assessment will be conducted, including scope, procedures and methods, and how provincial and Indigenous processes and decision-making will align. Consensus with Indigenous nations sought.',
  'Application Development and Review':
    'Proponent consults and does technical studies, then develops the initial application. EAO then seeks feedback on it from Indigenous nations, stakeholders, technical experts and the public. Proponent revises application, and submits to EAO for review. Consensus with Indigenous nations sought. Decision point: accept revised application or require further revisions.',
  'Effects Assessment and Recommendation':
    'Assess potential effects of the project. Develop assessment report and draft conditions to address potential adverse effects, in consultation with technical experts and Indigenous nations. Seek and incorporate feedback from Indigenous nations, stakeholders, technical experts and the public. Consensus with Indigenous nations sought. Decision point: recommend to ministers whether or not to issue an Environmental Assessment Certificate.',
  'Referral and Decision':
    'Decision point: Ministers determine whether or not project will receive an Environmental Assessment Certificate, and if so, what conditions will be required to address potential adverse effects.',
  [POST_DECISION_ROW]:
    'Monitor project to make sure requirements are being followed. Projects not in compliance are subject to enforcement measures, including fines. Proponents may also seek amendments to the Certificate as permitting and construction proceeds and operations get underway.',
};

/** ENGAGE's text for the 2018 Act phase a stored Eagle or Track phase name belongs to, or null. */
export function phaseDescriptionFor(name: string): string | null {
  // A Track phase, proponent time included, reads as the stage it dates.
  const row = stageRowFor(2018, railStageNameOf(name) ?? name);
  return (row && DESCRIPTIONS[row.name]) ?? null;
}
