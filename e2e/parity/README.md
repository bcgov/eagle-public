# Unified search parity gate

Holds the built `/search` page to the design prototype, state by state, at 924px and
400px. The prototype is a handoff bundle from the design team; it is not in the
repository (see Commands).

## How it works

`states.ts` lists each state as a short series of steps. `selectors.ts` gives every
control two selectors: one for the prototype, one for the app. The capture script and
the parity spec replay the same step list through those two maps, so neither side holds
a selector of its own and a rename is a one-line change.

Backend reads are answered from `../fixtures/unified-search`, which carries the
prototype's own sample rows. Both sides therefore see the same 12 projects, 18
documents, 10 activities and 14 indexed passages, plus 8 hand-made project
notifications.

The sample values are the prototype's, but the field names are the ones
demi-search sends, so the page reads a fixture row the same way it reads a real
one: `displayName` and `datePosted` on a document, `dateUpdated` and a
`proponent` object on a project, `headline` and `dateAdded` on an activity.
Dropdown values ride as `List` and `Organization` ids, and the handler resolves
an id to the label the row carries before it compares, which is the fixture
stand-in for the `<field>Id` columns the real index filters on.

## Commands

Run from the repository root.

    yarn test:parity        # check /search against the design
    yarn parity:reference   # recapture the references from the prototype
    yarn parity:fixtures    # re-extract the JSON fixtures from the prototype

Both installs are needed: `yarn install` at the root (the style checks read
`@bcgov/design-tokens` from the root `node_modules`) and in `e2e` (Playwright).

`test:parity` starts `vite preview` on port 4173 itself, so build first with
`yarn build`. The reference check (below) runs first. While pixel comparison is parked
it only warns; once it is live, a bad reference stops the whole run, including the
checks that need no browser: the fixture backend in `demi-search.spec.ts`, the
reference check in `reference-check.spec.ts` and the network guard in
`stay-local.spec.ts`. The reference images and the JSON fixtures are committed, so
`test:parity` works from a clean checkout.

`parity:reference` and `parity:fixtures` read the prototype instead, so they need the
design handoff bundle unzipped to `design/handoffs/unified-search/` first. Ask the
design team for the bundle. It is deliberately kept out of the repository, and both
commands fail while the folder is missing.

## Where the references live

`e2e/parity/unified-search/reference/<state>-<width>.png`, committed. Playwright is
pointed at that folder by `snapshotPathTemplate`, so the expected image is always a
screenshot of the design, never one Playwright generated from the app.
`updateSnapshots: 'none'` keeps a failing run from writing one.

`manifest.json` in the same folder records, for each image, the page height the capture
measured, whether the shot was full page, and the image's SHA-256. Commit it with the
images.

## Reference check

Before any spec runs, `reference-check.ts` (the config's `globalSetup`) checks every
reference against `states.ts` and `manifest.json`:

- the width is the one its file name says;
- the height is the page height recorded at capture, or the viewport height for a
  viewport-only state;
- full page or viewport matches what the state asks for;
- the SHA-256 matches, so an image swapped for another of the same size is caught;
- no image is missing, no image is one no state asks for, and no manifest entry has lost
  its image. A missing folder or a manifest that is not JSON is reported the same way.

Each problem names the file, for example:

    03-activities-list-924.png: is 924x900, expected 924x2956 (full page)

This guards against a reference that holds only the first 900px of its page, which leaves
everything below the fold uncompared. Fix it by recapturing with `yarn parity:reference`.
While `PIXEL_COMPARISON_PARKED` is true the problems are printed as a warning and the
run goes on, because no spec reads the images.

## Repeatable captures

`capture.ts` holds what both sides share: the viewport (924 by 900), a scale factor of 1,
reduced motion, the time zone and locale, blocked service workers, and the screenshot
options (animations disabled, caret hidden, CSS scale). Both configs read it, so the two
sides cannot drift. `settle` in `drive.ts` waits for `document.fonts.ready` before every
capture.

`MASKS` in `capture.ts` lists regions that change between runs. It is empty: dates come
from the fixtures and the frozen clock, and the page draws no ids or map. Both sides
check this. The parity run captures `01-documents-grid` and `07-search-help-modal`
twice at each width, each time in a new browser context, and the reference run does
the same for `01-documents-grid` at 924. A difference fails the test. When that happens,
freeze the thing that moved or add it to `MASKS`.

## Network guard

The parity specs use the `test` exported from `capture.ts`. It routes the whole browser
context: any HTTP, HTTPS, WS or WSS request to a host other than `localhost`,
`127.0.0.1`, `[::1]`, `0.0.0.0` or a `*.localhost` name is aborted, and the test fails
listing the URLs. `data:` and `blob:` URLs never leave the page and pass. `src/env.js`
points at a deployed API, so without the guard a call the fixtures do not answer would
show live data.

Covered: every page and popup in the context, fetches and navigations, web sockets.
Service workers are blocked outright (`serviceWorkers: 'block'`), because their own
requests would bypass the route. Not covered: requests made by Node rather than the
browser, which the specs do not make, and the reference capture, which does not use
this `test` because the prototype loads version-pinned React and Bootstrap from public
CDNs.

## Value checks

These run as their own tests, beside the parked pixel tests, so they report even when a
screenshot fails:

- Computed styles (`toHaveCSS`) for the search box, record pills, help link and toolbar.
  The expected values live in `tokens.ts` and are read from `@bcgov/design-tokens`, the
  same package `src/styles.css` imports. `rem` values are resolved against the page's
  own root font size. A failure names the element, the property, the token and both
  values.
- Positions and gaps (`boundingBox()`, 1px tolerance): the search box and pills start on
  the grid's left edge, the help link ends on its right edge, pills sit
  `--layout-padding-xsmall` apart, and the toolbar text is inset by
  `--layout-padding-medium`.
- Roles and names (`toMatchAriaSnapshot`) for the search box, record pills and toolbar.
  The record pill list must match exactly (`/children: equal`).
- `list-row-hover.spec.ts` checks the row rule's colour, width and style, and
  `icon-link-underline.spec.ts` the help link's colour at rest and on hover, all from
  `tokens.ts`.

## Recapturing

Recapture only when the handoff bundle changes. `yarn parity:reference` serves the
handoff folder over loopback (the prototype's `dc-import` cannot run from `file://`),
drives every state and re-checks the measurements against the prototype. Only a state
whose measurements pass has its PNG and `manifest.json` entry written. Review the
resulting image diff before committing: a reference that changed because the app changed
is the gate failing silently.

## Pixel comparison parked (2026-09-19)

The search page was redesigned on purpose, so the references predate the shared page
band and the wider layout and no longer show what the page is meant to look like. Each
state therefore runs as two tests: the measurement and text checks, which still run and
still fail the build, and the screenshot, which is parked behind
`PIXEL_COMPARISON_PARKED` in `capture.ts` and reports as fixme. To restore it,
recapture with `yarn parity:reference` from an updated handoff bundle, review the diff,
then set that constant to false. The reference check then stops any run with a bad
reference.
