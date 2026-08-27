import * as Leaflet from 'leaflet';
import 'leaflet.markercluster';

declare global {
  interface Window {
    /** HotJar, loaded by an external tag; absent unless the tag is on the page. */
    hj?: (event: string, name: string) => void;
  }

  const L: typeof Leaflet & {
    markerClusterGroup: (options?: any) => any;
  };
}

export {};