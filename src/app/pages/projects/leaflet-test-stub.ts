import { vi } from 'vitest';

/**
 * Enough of the Leaflet + markercluster CDN global for the map page to mount under jsdom.
 * Markers record their click handlers so a test can drive a marker click.
 */

export interface StubMarker {
  project: { lat: number; lng: number };
  click: () => void;
  popup: any;
  setIcon: ReturnType<typeof vi.fn>;
}

export const stubMarkers: StubMarker[] = [];

function latLng(lat: number, lng: number) {
  return { lat, lng, equals: (other: any) => other?.lat === lat && other?.lng === lng };
}

function bounds(south: number, west: number, north: number, east: number) {
  return {
    getSouth: () => south,
    getWest: () => west,
    getNorth: () => north,
    getEast: () => east,
    isValid: () => true,
    contains: (point: any) =>
      point.lat >= south && point.lat <= north && point.lng >= west && point.lng <= east
  };
}

/** The whole of BC, so every fixture marker counts as visible. */
const BC_BOUNDS = bounds(48, -139, 60, -114);

export function installLeafletStub(): void {
  stubMarkers.length = 0;

  const chain = () => {
    const self: any = {
      addTo: vi.fn(() => self),
      on: vi.fn(() => self),
      setLatLng: vi.fn(() => self),
      setContent: vi.fn(() => self),
      isOpen: vi.fn(() => false),
      update: vi.fn()
    };
    return self;
  };

  const stub = {
    icon: (options: any) => ({ options }),
    latLng,
    latLngBounds: (a: any, b: any) => bounds(a.lat, a.lng, b.lat, b.lng),
    point: (x: number, y: number) => ({ x, y }),
    tileLayer: () => ({}),
    popup: () => chain(),
    marker: (position: any) => {
      const handlers = new Map<string, () => void>();
      const marker: any = {
        getLatLng: () => position,
        setLatLng: vi.fn(),
        setIcon: vi.fn(() => marker),
        on: (event: string, handler: () => void) => {
          handlers.set(event, handler);
          return marker;
        },
        getPopup: () => marker.popup,
        bindPopup: (popup: any) => {
          marker.popup = popup;
          return marker;
        },
        unbindPopup: vi.fn(),
        openPopup: vi.fn(),
        closePopup: vi.fn(),
        popup: undefined
      };
      stubMarkers.push({
        project: position,
        click: () => handlers.get('click')?.(),
        get popup() {
          return marker.popup;
        },
        setIcon: marker.setIcon
      } as StubMarker);
      return marker;
    },
    markerClusterGroup: () => {
      const layers = new Set<any>();
      return {
        addLayers: (items: any[]) => items.forEach(item => layers.add(item)),
        removeLayers: (items: any[]) => items.forEach(item => layers.delete(item)),
        clearLayers: () => layers.clear(),
        hasLayer: (item: any) => layers.has(item),
        getBounds: () => BC_BOUNDS
      };
    },
    map: () => ({
      on: vi.fn(),
      addLayer: vi.fn(),
      addControl: vi.fn(),
      remove: vi.fn(),
      closePopup: vi.fn(),
      invalidateSize: vi.fn(),
      fitBounds: vi.fn(),
      setView: vi.fn(),
      panTo: vi.fn(),
      getBounds: () => BC_BOUNDS,
      getSize: () => ({ x: 800, y: 600 }),
      latLngToContainerPoint: () => ({ x: 0, y: 0 }),
      containerPointToLatLng: () => latLng(0, 0)
    }),
    control: {
      scale: () => ({ addTo: vi.fn() }),
      layers: () => ({ addTo: vi.fn() }),
      zoom: () => ({ addTo: vi.fn() })
    },
    Control: { extend: () => class {} },
    DomUtil: { create: (tag: string) => document.createElement(tag) },
    DomEvent: { disableClickPropagation: vi.fn(), disableScrollPropagation: vi.fn() }
  };

  vi.stubGlobal('L', stub);
}
