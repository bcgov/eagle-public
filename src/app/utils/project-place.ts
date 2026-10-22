/** "Kitimat, Skeena region": the town, then the region, either left out when absent. */
export function projectPlace({ location, region }: { location?: string; region?: string }): string {
  const town = location?.trim();
  const area = region?.trim();
  const regionLabel = area && (/region$/i.test(area) ? area : `${area} region`);
  return [town, regionLabel].filter(Boolean).join(', ');
}
