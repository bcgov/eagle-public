# TODO

## eagle-api leftovers

The app makes no request to eagle-api. What is left is config and dead UI:

- 2026-10-03: `src/env.js` `API_LOCATION` and `API_PATH`: the app reads neither, but `deploy-azure-prod.yaml:248,265,276,616` and `deploy-azure-staging.yaml:159,167,178,406` rewrite and assert them. Drop the two lines and those checks together.

## Deferred review findings (2026-10-03)

- `.github/workflows/deploy-azure-prod.yaml:252` and `deploy-azure-staging.yaml:151,161-162`: comments still say the SPA fetches `/api/config` with a fallback; reword to `/demi-search/config`, drop the fallback sentence.
- `src/app/comments/comments.component.ts:59` and `src/app/project/project.html:34` (`safeHtml` pipe, `shared/pipes/safe-html-converter.pipe.ts:11`): period `instructions` still use `bypassSecurityTrustHtml`; bind the plain string so Angular's sanitizer runs.
- `src/app/comments/comments.component.ts:284`: keep the previous `totalListItems` when `totalCount` is null instead of the page length.
- `src/app/models/project.ts:15,22,96,103`: `projectLeadObj`/`responsibleEPDObj` are never filled; delete.
- `src/app/search/content-result/content-result.component.ts:11`: header comment cites eagle-search `service/snippet.js`; content search is DEMI now.
- `src/app/project/documents/documents-tab.component.ts:166` (also amendments, application tabs): each picked filter id adds `&and[<key>]=<24-char id>` to one paged, sorted search, so 40 to 50 picks reach the 1919-char query the prod edge 404s (all four filters fully picked: about 6000 chars). Batching would break paging and sort; cap picks or move filters to a POST body.
- `src/app/services/config.service.spec.ts:140`: no test fails if the 1 s / 2 s backoff is deleted; advance 999 ms, assert one fetch, then 1 ms, assert two.
- `src/app/services/config.service.ts:11,159`: `CONFIG_PATH` is set by nothing; use the default path directly and delete the key.
- `src/app/services/config.service.ts:172`: worst-case wait before the unavailable page is about 39 s with a blank page (`src/index.html:28` empty `<app-root>`); add a static "Loading…" inside `<app-root>` and do not retry a definite 4xx other than 408/429.
- `src/app/services/project.service.spec.ts:149`: "calls the api when forceReload is true" cannot fail; prime the cache first.
- `src/app/shared/components/activity-card/activity-card.component.html:19`: Angular's sanitizer now strips `id`/`name`, `iframe`/`embed`/`object`, `form` controls and `svg` from older updates; check legacy RecentActivity content for `<iframe` or ` id=` before prod.
- `src/app/shared/components/activity-card/activity-card.component.html:44,51`: `documentHref()` runs on every change detection; compute it in the `rowData` setter.
- `src/main.ts:8`: final config failure is logged twice.
- eao-nginx `conf.d/server.conf.tmpl:383-392`: comment says eagle-public falls back to `/api/config`; false once this ships.
- Wiki `eagle-dev-guides.wiki/Eagle-Search.md:24,36` and `Local-Development.md:175`: empty `SEARCH_API_PATH` is no longer a kill switch on the Angular line (empty now means `/demi-search`); update with this change.
- `src/app/services/api.ts:164`: `analytics.track('Document Downloaded')` fires before the HEAD check, so a failed download is still counted; move it after the check.
- `src/app/project/documents/detail/detail.component.html:28`: calls `api.downloadDocument` with no catch, so a failed check shows no toast; route it through a handler like the one in `comments.component.ts`.
- `src/app/services/api.search-routing.spec.ts:107`: `querySelector('iframe')` matches any iframe; select by `src`.
- `src/app/comments/comments.component.spec.ts:45`: each passing test leaves a 60 s timer pending; use fake timers.
- Every download now makes a HEAD then a GET (two DEMI calls); accepted for now.
- `src/app/comments/comments.component.html:32`: clicks on the ENGAGE link are not tracked; send `Comment Period Banner Clicked` with `destination: 'external_met'` as `project.ts:543-549` does.
- `src/app/comments/comments.component.spec.ts:67`: add a closed non-ENGAGE case (no link, no sentence) and a closed ENGAGE case ("View Engagement").
- `src/app/project/commenting-tab/commenting-tab.component.spec.ts:29`: add Upcoming and no-dates rows to the label table.
- `src/app/project/engage-banner/engage-banner.component.html:25`: the `open_in_new` icon needs `aria-hidden` and the hidden "(opens in new tab)" text, as on the comments page link.
- `src/app/services/api.search-routing.spec.ts:127`: assert every request URL starts with the search or projects path instead of "does not start with `/api/`".
- `src/app/shared/components/activity-card/activity-card.component.html:36`: label is "View Engagement" for every period, ENGAGE or not.
- `src/env.js` keeps `API_LOCATION`/`API_PATH` only because the deploy workflows assert them; remove from both once the workflows stop checking.

## Release checks for the DEMI reads change (v2.8.0)

- DEMI on the target environment must be v0.132.5 or later (HEAD on the download route answers 200 or 404 without redirecting). Check: `curl -I https://<host>/demi-search/documents/<id>/download?redirect=1` returns 200 with no `Location` header.
- The DEMI public config document must be seeded with `ENVIRONMENT` and a boolean `ACCESS_GATE`; a failed config fetch now shows the "EPIC is temporarily unavailable" page instead of falling back to `env.js`.
- Front Door WAF rule `search` allows 600 requests per client IP per minute on `/demi-search/search`; every public read now counts against it (the `/api/` rule allowed 1800). Decide whether to raise it before prod.
- Document links now download as attachments instead of opening in the browser viewer (DEMI signs `Content-Disposition: attachment`). Open decision: add an inline option to the DEMI download route, or relabel "Open"/"View" links.
- Do one manual attachment download on the test site in Chrome, Firefox and Safari (the download iframe is now created after an awaited check, outside the click task).
- Check older RecentActivity content for `<iframe` or ` id=`; Angular's sanitizer now strips them on the updates card.
- Update wiki `Eagle-Search.md` and `Local-Development.md`: an empty `SEARCH_API_PATH` is no longer a kill switch back to eagle-api on the Angular line.
