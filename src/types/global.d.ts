import * as Leaflet from 'leaflet';
import 'leaflet.markercluster';

declare global {
  const L: typeof Leaflet & {
    markerClusterGroup: (options?: any) => any;
  };
}

export {};