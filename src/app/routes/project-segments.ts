/** Document-type tabs that used to sit at the top level of a project, now under Documents. */
export const LEGACY_DOCUMENT_TABS: readonly string[] = [
  'application',
  'certificates',
  'amendments',
];

/** Project tabs the redesign renamed: each old segment redirects to its new one. */
export const RENAMED_PROJECT_TABS: readonly { from: string; to: string }[] = [
  { from: 'project-details', to: 'overview' },
  { from: 'commenting', to: 'engagement' },
];

/** The segment under `/p/:projId` that holds comment periods (`cp/:commentPeriodId`). */
export const COMMENT_PERIOD_SEGMENT = 'cp';
