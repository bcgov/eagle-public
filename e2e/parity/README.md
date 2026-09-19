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

    yarn test:parity        # check /search against the design (see Pixel comparison parked)
    yarn parity:reference   # recapture the references from the prototype
    yarn parity:fixtures    # re-extract the JSON fixtures from the prototype

`test:parity` starts `vite preview` on port 4173 itself, so build first with
`yarn build`. It also runs the checks on the fixture backend in `demi-search.spec.ts`,
which need neither a browser nor a server. The reference images and the JSON fixtures it
reads are both committed, so `test:parity` works from a clean checkout.

`parity:reference` and `parity:fixtures` read the prototype instead, so they need the
design handoff bundle unzipped to `design/handoffs/unified-search/` first. Ask the
design team for the bundle. It is deliberately kept out of the repository, and both
commands fail while the folder is missing.

## Where the references live

`e2e/parity/unified-search/reference/<state>-<width>.png`, committed. Playwright is
pointed at that folder by `snapshotPathTemplate`, so the expected image is always a
screenshot of the design, never one Playwright generated from the app.

## Recapturing

Recapture only when the handoff bundle changes. `yarn parity:reference` serves the
handoff folder over loopback (the prototype's `dc-import` cannot run from `file://`),
drives every state, writes the PNGs and re-checks the measurements against the
prototype. Review the resulting image diff before committing: a reference that changed
because the app changed is the gate failing silently.

## Pixel comparison parked (2026-09-19)

The search page was redesigned on purpose, so the references predate the shared page
band and the wider layout and no longer show what the page is meant to look like. Each
state therefore runs as two tests: the measurement and text checks, which still run and
still fail the build, and the screenshot, which is parked behind
`PIXEL_COMPARISON_PARKED` in `unified-search.parity.spec.ts` and reports as fixme. To
restore it, recapture with `yarn parity:reference` from an updated handoff bundle,
review the diff, then delete that constant.
