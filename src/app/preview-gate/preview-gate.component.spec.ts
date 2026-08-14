import { describe, it, expect } from 'vitest';
import { passphraseMatches, previewGateSatisfied } from './preview-gate.component';

// The gate's other half — that an unsatisfied gate leaves the app ABSENT from the DOM rather than
// covered by a dialog — is asserted in `app/app.spec.ts`, where `App` is already rendered.
describe('previewGateSatisfied', () => {
  // env.js is absent under the unit-test DOM, so PREVIEW_GATE is off and the gate opens. This is
  // what every other spec in the suite depends on: no gate, no change in behaviour.
  it('should default to open when no gate is configured', () => {
    expect(previewGateSatisfied()).toBe(true);
  });
});

describe('passphraseMatches', () => {
  it('should accept the configured passphrase', () => {
    expect(passphraseMatches('open-sesame', 'open-sesame')).toBe(true);
  });

  it('should trim what the user typed', () => {
    expect(passphraseMatches('  open-sesame \n', 'open-sesame')).toBe(true);
  });

  it('should reject a wrong passphrase', () => {
    expect(passphraseMatches('open-sesam', 'open-sesame')).toBe(false);
  });

  it('should be case sensitive', () => {
    expect(passphraseMatches('OPEN-SESAME', 'open-sesame')).toBe(false);
  });

  // Fails closed: PREVIEW_GATE on with no passphrase configured must not let everyone through.
  it('should never match when no passphrase is configured', () => {
    expect(passphraseMatches('', '')).toBe(false);
    expect(passphraseMatches('anything', '')).toBe(false);
  });
});
