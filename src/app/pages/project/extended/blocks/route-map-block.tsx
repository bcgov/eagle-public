import { lazy, Suspense } from 'react';
import { Skeleton } from 'app/components/skeleton/skeleton';
import { RichTextView } from '../rich-text';
import { RouteMapBoundary } from '../extended-shell';
import { RouteLineOptions } from '../route-lines';
import type { RouteMapBlock } from '../types';
import type { BlockContext } from './block-context';
import { BlockSection, Subheading } from './block-section';
import '../extended.css';
import './route-map-block.css';

// maplibre-gl is ~1 MB; keep it out of the main bundle until the block renders.
const RouteMap = lazy(() => import('../route-map').then((m) => ({ default: m.RouteMap })));

/** In the map's place when its code fails to load; route-map.css is missing then too. */
const MAP_UNAVAILABLE = (
  <div className="extended-route__unavailable">
    <p>The map could not be loaded.</p>
  </div>
);

/** The page's map with its caption, a tile per line, then the facts under it. */
export function RouteMapBlockView({
  block,
  context,
}: {
  block: RouteMapBlock;
  context: BlockContext;
}) {
  const { map } = context.content;
  return (
    <BlockSection block={block} context={context} className="extended-copy">
      {map && (
        <>
          <figure className="extended-route__figure">
            <div className="extended-route__map">
              <RouteMapBoundary fallback={MAP_UNAVAILABLE}>
                <Suspense
                  fallback={
                    <div className="extended-route__loading" aria-busy="true">
                      <span className="visually-hidden">Loading map</span>
                      <Skeleton height="100%" />
                    </div>
                  }
                >
                  <RouteMap map={map} />
                </Suspense>
              </RouteMapBoundary>
            </div>
            <figcaption className="extended-route__caption">
              <p className="extended-route__description">{map.label}</p>
              <span>
                <RichTextView text={map.attribution} />
              </span>
            </figcaption>
          </figure>

          {block.optionsHeading && (
            <Subheading block={block} context={context} className="extended-block__subtitle">
              {block.optionsHeading}
            </Subheading>
          )}
          <RouteLineOptions lines={map.lines} />
        </>
      )}

      {!!block.facts?.length && (
        <ul className="extended-route-map__bullets">
          {block.facts.map((fact, index) => (
            <li key={index}>
              <RichTextView text={fact} />
            </li>
          ))}
        </ul>
      )}
    </BlockSection>
  );
}
