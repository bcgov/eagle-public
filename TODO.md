# TODO

## Deferred review findings (2026-10-03)

- `src/app/services/project.service.ts:24`: the `project` cache is never filled, so `getById` always calls the API and the `forceReload` argument does nothing. Delete the field, the cache branch, the "calls the api when forceReload is true" test and the argument (callers: `project/project.ts:99`, `comments/comments.component.ts:132`). Check `comment.service.ts:47` and `document.service.ts:49` for the same dead argument.
- `src/app/project/project.html`: the period `instructions` binding has no test; add one render case to `project.spec.ts` that fails if the sanitizer is bypassed again.
- `src/app/project/documents/detail/`: `DocumentDetailComponent` is in no route; delete it if nothing is planned for it.
- `src/app/comments/comments.component.html:73`: the related-document row is `<li role="button">` inside a `<ul>` (fails the axe `list` rule, and a held key starts several downloads). Use a native `<button>` inside a plain `<li>`.
- `src/app/comments/comments.component.ts` `loadComments`: `currentPage` and `pageSize` are read after the await, so a late response can count rows for the wrong page. Copy both into constants first.
- `src/app/models/commentperiod.ts`: `project` is typed `Project` but holds a string id at runtime.
- `src/app/comments/comments.component.html`: `Comment Period Banner Clicked` has no `source` field, so the comments page and the project banner cannot be told apart; middle-click on the ENGAGE link is not tracked.
- `src/app/project/project.ts` `goToCP`: checks `isMet && isSafeUrl(metURL)` itself; read `commentPeriod.isEngage` instead.
- `src/app/shared/components/activity-card/`: an open ENGAGE period reads "View Engagement" on activity cards, not "Share your thoughts", because the search response sends `pcp` as `{ _id, isMet, metURL }` with no dates. Needs `dateStarted` and `dateCompleted` on `pcp` from the search API.
- `src/app/shared/utils/search-query-limit.ts`: the 1800-character limit is a guess between two measured points (1544 passed, 1919 failed) and leaves out the `/demi-search/` prefix; measure the real edge limit. The message says "filters" even when a long keyword is the cause, has no error styling, and may not be announced when a page loads already holding it. No test checks the warning log line.
- `src/app/shared/components/table-list/table-list.component.ts` (project list, search page): no query-length guard.
- Document tabs: the filter panel does not show picks that come from the URL, and picking a new value replaces them (older than the guard). A slower earlier response can still land in the table.
- `src/app/services/global-error-handler.ts`: the final config failure is logged as "Unhandled Error: <message>"; for a network error the message does not name the config URL.
- `.github/workflows/deploy-azure-prod.yaml:184` and `deploy-azure-staging.yaml:127`: comments mention `/api/config` for the old standalone preview; reword when those steps are next touched.
- Every download makes a HEAD then a GET (two DEMI calls); accepted for now.

## Release checks

- Do one manual attachment download on the test site in Firefox and Safari (Chrome checked on prod 2026-10-03; the download iframe is created after an awaited check, outside the click task).
- The first staging deploy after the `API_LOCATION`/`API_PATH` removal proves the edited deploy workflows; read its rewrite and smoke-test steps.
