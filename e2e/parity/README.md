# Unified search parity gate

Holds the built `/search` page to the design prototype in
`design/handoffs/unified-search`, state by state, at 924px and 400px.

## How it works

`states.ts` lists each state as a short series of steps. `selectors.ts` gives every
control two selectors: one for the prototype, one for the app. The capture script and
the parity spec replay the same step list through those two maps, so neither side holds
a selector of its own and a rename is a one-line change.

Backend reads are answered from `../fixtures/unified-search`, which carries the
prototype's own sample rows. Both sides therefore see the same 12 projects, 18
documents, 10 activities and 14 indexed passages.

## Commands

Run from the repository root.

    yarn test:parity        # compare /search against the references
    yarn parity:reference   # recapture the references from the prototype
    yarn parity:fixtures    # re-extract the JSON fixtures from the prototype

`test:parity` starts `vite preview` on port 4173 itself, so build first with
`yarn build`. It also runs the checks on the fixture backend in `demi-search.spec.ts`,
which need neither a browser nor a server.

## Where the references live

`e2e/parity/unified-search/reference/<state>-<width>.png`, committed. Playwright is
pointed at that folder by `snapshotPathTemplate`, so the expected image is always a
screenshot of the design, never one Playwright generated from the app.

## Recapturing

Recapture only when the handoff file changes. `yarn parity:reference` serves the
handoff folder over loopback (the prototype's `dc-import` cannot run from `file://`),
drives every state, writes the PNGs and re-checks the measurements against the
prototype. Review the resulting image diff before committing: a reference that changed
because the app changed is the gate failing silently.

## Until the page exists

The unified `/search` page is not built yet. Each screenshot test navigates, finds no
grid, and skips. The suite goes live with no change here the moment the component
renders `.display-grid`.
