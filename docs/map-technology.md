# Map technology

Status: Proposed
Date: 2026-08-28

The library comparison lives once, in `eagle-demi/docs/map-technology.md`. This page
covers eagle-public's own map and what a revision would change here.

## What we run today

`src/app/pages/projects/projlist-map.tsx`, 501 lines. Leaflet 1.9.4 with
leaflet.markercluster 1.5.3, both loaded as script tags from unpkg.com
(`index.html` lines 21-34) rather than installed. Only the `@types` packages are in
`package.json`, so `L` is a global the bundler never sees.

The map shows one thing: a clustered marker per project, positioned from the
project's `centroid`, with a popup. Basemaps are three Esri layers from
`server.arcgisonline.com`.

There are no polygons and no drawing, and the data model would not support them.
`eagle-api` stores `centroid` only (`api/helpers/models/project.js:13`) — a
two-number point. There is no geometry field and no shape endpoint anywhere in the
API.

## What a revision changes

The recommendation is **OpenLayers 10.10**, for the reasons in the DEMI page: the
drawing tools are core modules rather than a plugin, it reads BC Gov WMS and ArcGIS
REST without help, it tree-shakes to about 82 kB gzipped, and it is plain TypeScript
that both this app and DEMI's Angular frontend can share.

For this repo specifically:

1. **Install the library.** Moving to OpenLayers removes the unpkg.com script tags
   as a side effect. A public service should not depend on a third party CDN being
   up to render its map.
2. **There is no React binding, and that is fine.** About 30 lines: a `useRef` div, a
   `useEffect` that constructs `new Map({target})`, and `map.setTarget(undefined)`
   for cleanup. `projlist-map.tsx` already manages the Leaflet instance by hand
   through refs and effects, so the shape of the component does not change much.
3. **Polygons need backend work first.** Storing project boundaries or user-drawn
   shapes needs a geometry field and endpoints that do not exist yet. Decide where
   that lives — DEMI's Cosmos NoSQL already has spatial indexes and 281 boundary
   polygons, so pushing this into eagle-api may be the wrong direction given eagle-api
   is being retired.
4. **Ship a list view for accessibility.** No screen reader can read a map, whichever
   library draws it. WCAG 2.2 AA needs a keyboard-reachable list of the same projects
   with the same filters. This page already has a project list beside the map, so the
   work is making sure it stays in step with the map's filter state rather than
   building something new.

## When not to do this

If the map stays as pins on a basemap, Leaflet already does that and a migration buys
nothing. The case for changing rests on the layers and drawing we do not have yet.
Move when those become real requirements with a ticket behind them.
