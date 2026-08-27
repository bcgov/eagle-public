// Renders trusted HTML through dangerouslySetInnerHTML; do not use with (non-staff) user input.
export function safeHtml(value: string): { __html: string } {
  return { __html: value ?? '' };
}
