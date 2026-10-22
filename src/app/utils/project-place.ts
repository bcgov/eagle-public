/** "Kitimat, Skeena region": the town, then the region, either left out when absent. */
export function projectPlace({ location, region }: { location?: string; region?: string }): string {
  // Some stored locations end in "." or ",", which would read "Airport., Lower Mainland region".
  const town = location?.trim().replace(/[\s.,;]+$/, '');
  const area = region?.trim();
  const regionLabel = area && (/region$/i.test(area) ? area : `${area} region`);
  return [town, regionLabel].filter(Boolean).join(', ');
}
