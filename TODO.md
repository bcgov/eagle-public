# TODO

## Angular reads still on eagle-api

- 2026-10-03: `getDecision`, `getDecisionByAppId`, `getDocumentsByDecisionId` (`src/app/services/api.ts`): demi-search has no Decision dataset. No live caller today (`decisions-tab` template is commented out, `DecisionService` is not injected anywhere); delete them, or route them once DEMI serves decisions.
- 2026-10-03: `getDocumentsByAppId`, `getDocumentsByCommentId` (`api.ts`): no live caller; delete or route through `docIds`.

## Deferred review findings (2026-10-03)

- `.github/workflows/deploy-azure-prod.yaml:252` and `deploy-azure-staging.yaml:151,161-162`: comments still say the SPA fetches `/api/config` with a fallback; reword to `/demi-search/config`, drop the fallback sentence.
- `proxy.conf.js:25`: comment undersells the `/demi-projects` rule; say "Single project reads; rewritten onto DEMI's /api/projects."
- `src/app/comments/comments.component.ts:64` and `src/app/project/project.html:34` (`safeHtml` pipe, `shared/pipes/safe-html-converter.pipe.ts:11`): period `instructions` still use `bypassSecurityTrustHtml`; bind the plain string so Angular's sanitizer runs.
- `src/app/comments/comments.component.ts:290`: keep the previous `totalListItems` when `totalCount` is null instead of the page length.
- `src/app/models/project.ts:15,22,96,103`: `projectLeadObj`/`responsibleEPDObj` are never filled; delete.
- `src/app/search/content-result/content-result.component.ts:11`: header comment cites eagle-search `service/snippet.js`; content search is DEMI now.
- `src/app/services/api.search-routing.spec.ts:64`: add a test pinning behaviour when one document batch fails.
- `src/app/services/api.ts:488`: `internalOriginalName` listed twice in `fields`.
- `src/app/services/api.ts:516`: `forkJoin` over document batches is all-or-nothing; `DocumentService.getByMultiId` (`document.service.ts:18-39`) has no `catchError`, so loading never stops and `comments.component.ts:202,272` drop every attachment. Add `catchError` per batch to `[]` with a warn, or `catchError` + stop loading in the service.
- `src/app/services/config.service.spec.ts:140`: no test fails if the 1 s / 2 s backoff is deleted; advance 999 ms, assert one fetch, then 1 ms, assert two.
- `src/app/services/config.service.ts:11,159`: `CONFIG_PATH` is set by nothing; use the default path directly and delete the key.
- `src/app/services/config.service.ts:172`: worst-case wait before the unavailable page is about 39 s with a blank page (`src/index.html:28` empty `<app-root>`); add a static "Loading…" inside `<app-root>` and do not retry a definite 4xx other than 408/429.
- `src/app/services/project.service.spec.ts:149`: "calls the api when forceReload is true" cannot fail; prime the cache first.
- `src/app/shared/components/activity-card/activity-card.component.html:19`: Angular's sanitizer now strips `id`/`name`, `iframe`/`embed`/`object`, `form` controls and `svg` from older updates; check legacy RecentActivity content for `<iframe` or ` id=` before prod.
- `src/app/shared/components/activity-card/activity-card.component.html:44,51`: `documentHref()` runs on every change detection; compute it in the `rowData` setter.
- `src/main.ts:8`: final config failure is logged twice.
- eao-nginx `conf.d/server.conf.tmpl:383-392`: comment says eagle-public falls back to `/api/config`; false once this ships.
- Wiki `eagle-dev-guides.wiki/Eagle-Search.md:24,36` and `Local-Development.md:175`: empty `SEARCH_API_PATH` is no longer a kill switch on the Angular line (empty now means `/demi-search`); update with this change.
- `src/app/services/api.ts:173`: `analytics.track('Document Downloaded')` fires before the HEAD check, so a failed download is still counted; move it after the check.
- `src/app/project/documents/detail/detail.component.html:28`: calls `api.downloadDocument` with no catch, so a failed check shows no toast; route it through a handler like the one in `comments.component.ts`.
- `src/app/services/api.search-routing.spec.ts:102`: `querySelector('iframe')` matches any iframe; select by `src`.
- `src/app/comments/comments.component.spec.ts:42`: each passing test leaves a 60 s timer pending; use fake timers.
- Every download now makes a HEAD then a GET (two DEMI calls); accepted for now.

## Release checks for the DEMI reads change (v2.8.0)

- DEMI on the target environment must be v0.132.5 or later (HEAD on the download route answers 200 or 404 without redirecting). Check: `curl -I https://<host>/demi-search/documents/<id>/download?redirect=1` returns 200 with no `Location` header.
- The DEMI public config document must be seeded with `ENVIRONMENT` and a boolean `ACCESS_GATE`; a failed config fetch now shows the "EPIC is temporarily unavailable" page instead of falling back to `env.js`.
- Front Door WAF rule `search` allows 600 requests per client IP per minute on `/demi-search/search`; every public read now counts against it (the `/api/` rule allowed 1800). Decide whether to raise it before prod.
- Document links now download as attachments instead of opening in the browser viewer (DEMI signs `Content-Disposition: attachment`). Open decision: add an inline option to the DEMI download route, or relabel "Open"/"View" links.
- Do one manual attachment download on the test site in Chrome, Firefox and Safari (the download iframe is now created after an awaited check, outside the click task).
- Check older RecentActivity content for `<iframe` or ` id=`; Angular's sanitizer now strips them on the updates card.
- Update wiki `Eagle-Search.md` and `Local-Development.md`: an empty `SEARCH_API_PATH` is no longer a kill switch back to eagle-api on the Angular line.
