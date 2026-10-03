# Map technology

Status: Accepted
Date: 2026-09-01

The library comparison lives once, in `eagle-demi/docs/map-technology.md`. This page
covers eagle-public's own map.

## Stack

MapLibre GL 6 with the `@vis.gl/react-maplibre` 8 React binding. Both are installed
and bundled; nothing loads from a CDN.

`src/app/map/basemaps.tsx` holds what both maps share: the empty style, the three
Esri raster basemaps, the map controls and the BC bounds. The project map
(`/projects`) and the project detail mini-map (`/p/:projId`) import it.

The style starts empty — `{ version: 8, sources: {}, layers: [] }` — and each basemap
is a raster source with its own layer. The Layers menu switches basemap by toggling
layer visibility, so no style reload happens and the project data stays on the map.

The project map puts every project centroid into one GeoJSON source with clustering
on, reads the tiled result back with `querySourceFeatures` on each repaint where the
source reports itself loaded, and renders one HTML `<Marker>` per feature: a pin for a
project, a count bubble for a cluster. The markers
are HTML rather than a symbol layer because a raster-only style carries no glyphs, so
`text-field` cannot draw the cluster counts.

The nine EAO region polygons come from a static GeoJSON asset,
`src/assets/geojson/eao-regions.geojson`, copied from DEMI; `eagle-api` serves no shapes.
The projects map draws them as a fill and a line layer under the pins, filtered to the
regions the Region filter selects, and the Layers menu's Regions checkbox switches them off. A region
filter also sets the opening view: the map frames the selected regions whole, rather
than the projects left inside them.

The selected project shows in a card fixed to the map's bottom-left corner, not in a
pin-anchored popup, so the card never moves with the map or covers the pin it describes.

## Why MapLibre here

The binding gives React components — `<Map>`, `<Source>`, `<Layer>`, `<Marker>` — so the
map is described in JSX instead of managed through refs and imperative calls. An overlay layer is another `<Source>`/`<Layer>` pair, which is what
the coming boundary and wildfire layers need. Rendering is WebGL.

DEMI's page weighs the libraries against DEMI's requirements, which include drawing
tools and BC Gov WMS and ArcGIS REST services. This app has neither.

## Data model

There are no polygons and no drawing, and the data model would not support them.
`eagle-api` stores `centroid` only (`api/helpers/models/project.js:13`) — a
two-number point. There is no geometry field and no shape endpoint anywhere in the
API.

## Accessibility

No screen reader can read a map. The project list beside the map is the keyboard and
screen-reader surface: it holds the same projects under the same filters, each card is
a button, and selecting one moves the map. Markers are `aria-hidden` and out of the
tab order, the map is a labelled `role="region"`, and the result count is an
`aria-live` region. Attribution renders on both maps.
