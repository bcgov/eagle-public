import { Constants } from './constants';

/**
 * A `List` row picked out by name: either under one legislation year, or by the kind of row
 * (`List.type`) across every legislation that carries the name.
 */
export type ListTerm = { name: string; legislation: number } | { name: string; kind: string };

/**
 * One segment of the Documents tab strip: how it is labelled and linked, and the `List` names that
 * decide which documents belong to it. Empty means the segment does not filter on that field.
 */
export interface DocumentTab {
  /** Shared with `Constants.optionalProjectDocTabs`, the key the tab probes use. */
  key: string;
  label: string;
  /** Last segment of `/p/:projId/documents/<path>`. */
  path: string;
  types: ListTerm[];
  milestones: ListTerm[];
  phases: ListTerm[];
}

/**
 * Declaration order is render order in the tab strip, and so the order that settles a document
 * matching more than one segment.
 */
export const DOCUMENT_TABS: DocumentTab[] = [
  {
    key: Constants.optionalProjectDocTabs.APPLICATION,
    label: 'Application',
    path: 'application',
    types: [
      { legislation: 2002, name: 'Application Materials' },
      { legislation: 2018, name: 'Application Materials' },
      { legislation: 2002, name: 'Scientific Memo' },
      { legislation: 2018, name: 'Independent Memo' },
    ],
    milestones: [
      { legislation: 2002, name: 'Application Review' },
      { legislation: 2018, name: 'EAC Application' },
      { legislation: 2018, name: 'Revised EAC Application' },
    ],
    // No phase filter: it pushes the query past the number of AND conditions it copes with.
    phases: [],
  },
  {
    key: Constants.optionalProjectDocTabs.CERTIFICATE,
    label: 'Certificate',
    path: 'certificates',
    types: [
      { legislation: 2002, name: 'Certificate Package' },
      { legislation: 2018, name: 'Certificate Package' },
      { legislation: 2002, name: 'Order' },
      { legislation: 2018, name: 'Order' },
      { legislation: 2002, name: 'Decision Materials' },
      { legislation: 2018, name: 'Decision Materials' },
    ],
    milestones: [
      { legislation: 2002, name: 'Certificate' },
      { legislation: 2018, name: 'Certificate Decision' },
      { legislation: 2002, name: 'Decision' },
      { legislation: 2002, name: 'Certificate Extension' },
      { legislation: 2018, name: 'Certificate Extension' },
      { legislation: 2018, name: 'Transfer of Certificate/Order' },
    ],
    phases: [],
  },
  {
    key: Constants.optionalProjectDocTabs.AMENDMENT,
    label: 'Amendment(s)',
    path: 'amendments',
    types: [
      { legislation: 2002, name: 'Amendment Package' },
      { legislation: 2018, name: 'Amendment Package' },
      { legislation: 2002, name: 'Request' },
      { legislation: 2002, name: 'Decision Materials' },
      { legislation: 2018, name: 'Decision Materials' },
      { legislation: 2002, name: 'Tracking Table' },
      { legislation: 2018, name: 'Tracking Table' },
    ],
    milestones: [
      { legislation: 2002, name: 'Amendment' },
      { legislation: 2018, name: 'Amendment' },
    ],
    phases: [
      { legislation: 2002, name: 'Post Decision - Amendment' },
      { legislation: 2018, name: 'Post Decision - Amendment' },
    ],
  },
  {
    key: Constants.optionalProjectDocTabs.COMPLIANCE,
    label: 'Compliance',
    path: 'compliance',
    // Compliance & Enforcement documents carry the milestone but no dedicated document type,
    // so this segment filters on milestone alone.
    types: [],
    milestones: [
      { legislation: 2002, name: 'Compliance & Enforcement' },
      { legislation: 2018, name: 'Compliance & Enforcement' },
    ],
    phases: [],
  },
  {
    key: Constants.optionalProjectDocTabs.MANAGEMENT_PLAN,
    label: 'Management Plan',
    path: 'management-plans',
    // Management plans carry a document type but no milestone of their own, and only some
    // legislations list the type, so the term matches by kind rather than by legislation year.
    // The match is exact: 2002 also lists a separate "Plan" type.
    types: [{ name: 'Management Plan', kind: 'doctype' }],
    milestones: [],
    phases: [],
  },
];

export function documentTabByKey(key: string): DocumentTab | undefined {
  return DOCUMENT_TABS.find((tab) => tab.key === key);
}

/** The `List` ids the named terms resolve to, in term order. */
export function idsForTerms(terms: ListTerm[], list: any[]): string[] {
  const rows = list ?? [];
  return terms.flatMap((term) => {
    if ('kind' in term) {
      // Kind keeps a same-named row of another kind - a "Management Plan" milestone - from being
      // taken for the document type.
      return rows
        .filter((item) => item.name === term.name && item.type === term.kind && item._id)
        .map((item) => item._id as string);
    }
    // A term with no `List` entry yields no id. Angular read `_id` off the undefined match, which
    // threw whenever the lists had not loaded yet and took the whole tab down with it.
    const listItem = rows.find(
      (item) => item.name === term.name && item.legislation === term.legislation,
    );
    return listItem?._id ? [listItem._id as string] : [];
  });
}
