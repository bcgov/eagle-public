import { resolve } from 'node:path';

/** This folder. `__dirname`, not `import.meta.url`: Playwright transpiles these files to CJS. */
export const PARITY_DIR = resolve(__dirname);

/**
 * Where the prototype screenshots live. The parity spec points Playwright's snapshot path here
 * rather than letting it generate its own, so the expected image is always the designed one.
 */
export const REFERENCE_DIR = resolve(PARITY_DIR, 'unified-search', 'reference');
