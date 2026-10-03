import type { ExpressionSpecification } from 'maplibre-gl';

// Paint for the EAO region polygons, as feature-state expressions: plain, picked, hovered, and
// faded when another region is picked. Picked and faded values follow the DEMI admin map.

/** How far into its hover look a region is, 0 to 1, eased by `createHoverTween`. */
const HOVER_T: ExpressionSpecification = ['number', ['feature-state', 'hoverT'], 0];
const REGION_PICKED: ExpressionSpecification = ['boolean', ['feature-state', 'selected'], false];

/** From the resting value to the hovered one as the hover amount runs 0 to 1. */
function byHover(rest: number, hovered: number): ExpressionSpecification {
  return ['interpolate', ['linear'], HOVER_T, 0, rest, 1, hovered];
}

/** Plain, picked and hovered; with a pick, the unpicked polygons recede to half strength. */
export function regionFillOpacity(hasPick: boolean): ExpressionSpecification {
  return hasPick
    ? ['case', REGION_PICKED, byHover(0.14, 0.17), byHover(0.04, 0.09)]
    : byHover(0.08, 0.13);
}

export function regionLineWidth(hasPick: boolean): ExpressionSpecification {
  // A picked outline holds its weight under the pointer; hover must not thin it.
  return hasPick ? ['case', REGION_PICKED, 4.5, byHover(1, 2)] : byHover(1, 2);
}

export function regionLineOpacity(hasPick: boolean): ExpressionSpecification {
  return hasPick ? ['case', REGION_PICKED, 1, byHover(0.4, 0.6)] : byHover(0.5, 0.7);
}
