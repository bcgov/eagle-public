/**
 * Assigns listed fields from obj to target using `??` (not `||`).
 * Fixes the `obj && obj.field || null` anti-pattern which incorrectly nulls 0/false/''.
 *
 * @param target   Model instance to assign into
 * @param obj      Raw API response object (may be undefined)
 * @param fields   Keys to copy from obj → target
 * @param fallback Value when field is absent/null (default: null)
 */
export function assignFromObj<T extends object>(
  target: T,
  obj: any,
  fields: (keyof T)[],
  fallback: null | undefined = null
): void {
  for (const field of fields) {
    (target as any)[field] = obj?.[field] ?? fallback;
  }
}
