import { describe, it, expect } from 'vitest';
import geojsonText from '../../../../../assets/geojson/pacific-link-corridors.geojson?raw';
import { pacificLink } from './pacific-link';

// The page-model rules (version, plain JSON, allowed links, site-relative map data) are checked for
// every content entry in validate-extended-page.spec.ts; these are facts about this page alone.
describe('Pacific Link content', () => {
  it('has the six federal review steps', () => {
    expect(pacificLink.timeline?.steps.map((step) => step.name)).toEqual([
      'Referred to Major Projects Office',
      'Listing consultation',
      'Canada Gazette notice',
      'Listed as national interest',
      'Federal review and CER hearings',
      'Conditions document',
    ]);
  });

  it('puts the current step inside the list, so exactly one step is in progress', () => {
    const timeline = pacificLink.timeline!;
    expect(timeline.currentStep).toBe(4);
    expect(timeline.steps[timeline.currentStep]?.name).toBe('Federal review and CER hearings');
  });

  it('gives every update a date, a headline, a source and an https link', () => {
    const updates = pacificLink.updates ?? [];
    const incomplete = updates.filter(
      (update) =>
        !update.date.trim() ||
        !update.headline.trim() ||
        !update.source.trim() ||
        !update.href.startsWith('https://'),
    );

    expect(updates.length).toBeGreaterThan(0);
    expect(incomplete).toEqual([]);
  });

  it('lists five documents others published, each its own https file link', () => {
    const external = pacificLink.documents?.external;
    const items = external?.groups.flatMap((group) => group.items) ?? [];

    expect(external?.heading).toBe('Documents published by others');
    expect(items).toHaveLength(5);
    expect(items.filter((item) => !item.href.startsWith('https://'))).toEqual([]);
    expect(new Set(items.map((item) => item.href)).size).toBe(5);
  });

  it('names each map line after the lines in the bundled GeoJSON', () => {
    const geojson = JSON.parse(geojsonText) as {
      features: { geometry: { type: string }; properties: Record<string, unknown> }[];
    };
    const geojsonLines = geojson.features
      .filter((feature) => feature.geometry.type === 'LineString')
      .map((feature) => feature.properties['line']);

    expect(pacificLink.map?.lines.map((line) => line.id)).toEqual(geojsonLines);
  });
});
