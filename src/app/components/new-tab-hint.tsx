import './new-tab-hint.css';

/** The wording every link that leaves the tab announces. */
export const NEW_TAB_SUFFIX = ' (opens in new tab)';

/** The mark every link that leaves the tab carries. Decorative: the name says it in words. */
export function NewTabIcon() {
  return (
    <i className="material-icons new-tab-hint__icon" aria-hidden="true">
      open_in_new
    </i>
  );
}

/** The icon plus screen-reader text, for links whose label is markup rather than a string. */
export function NewTabHint() {
  return (
    <>
      <NewTabIcon />
      <span className="visually-hidden">{NEW_TAB_SUFFIX}</span>
    </>
  );
}
