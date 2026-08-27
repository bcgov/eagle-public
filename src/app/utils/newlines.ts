/** Changes newlines to HTML linebreaks. */
export function newlines(value: string): string {
  const input = value || '';
  return input.replace(/\n/g, '<br />');
}
