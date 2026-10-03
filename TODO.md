# TODO

## Deferred review findings (2026-10-03)

- `src/app/project/engage-banner/engage-banner.component.html`: the ENGAGE link sends no `Comment Period Banner Clicked` event, so clicks on the project banner are not counted.
- `npx tsc -p tsconfig.spec.json` fails at `src/app/project/project-document-tabs.spec.ts:44`. Vitest and the pre-push check do not type-check spec files; fix the error and add the type check to the pre-push run.
- `DocumentService.getById` and `CommentService.getById` have no callers outside their tests; delete them if nothing is planned for them.
- `.github/workflows/deploy-azure-prod.yaml:184` and `deploy-azure-staging.yaml:127`: comments mention `/api/config` for the old standalone preview; reword when those steps are next touched.
- Every download makes a HEAD then a GET (two DEMI calls); accepted for now.

## Release checks

- Do one manual attachment download on the test site in Firefox and Safari (Chrome checked on prod 2026-10-03; the download iframe is created after an awaited check, outside the click task).
- The first staging deploy after the `API_LOCATION`/`API_PATH` removal proves the edited deploy workflows; read its rewrite and smoke-test steps.
