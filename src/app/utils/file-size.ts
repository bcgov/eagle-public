/** `internalSize` arrives as a byte count in a string; some rows never carry one. */
export function fileSize(bytes: string | number | undefined): string {
  const value = Number(bytes);
  if (!value) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const step = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** step).toFixed(step ? 1 : 0)} ${units[step]}`;
}
