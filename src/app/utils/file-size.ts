/** `internalSize` arrives as a byte count in a string; some rows never carry one. */
export function fileSize(bytes: string | number | undefined): string {
  const value = Number(bytes);
  if (!value) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const step = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** step).toFixed(step ? 1 : 0)} ${units[step]}`;
}

/** A byte total, plus how many of the documents in it carried no size at all. */
export interface SizeEstimate {
  bytes: number;
  unknownCount: number;
}

/**
 * A total nobody can be exact about, in words: the sum is of the documents, not of the zip built
 * from them. Sizes the rows never carried make it a floor rather than an estimate, and a total
 * with nothing known behind it says nothing.
 */
export function sizeEstimate({ bytes, unknownCount }: SizeEstimate): string {
  if (bytes <= 0) return '';
  return `${unknownCount > 0 ? 'at least' : 'about'} ${fileSize(bytes)}`;
}
