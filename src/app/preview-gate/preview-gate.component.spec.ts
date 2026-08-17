import { describe, it, expect, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PreviewGateComponent, passphraseMatches, previewGateSatisfied } from './preview-gate.component';

// jsdom implements <dialog> but not showModal(), so the gate's afterNextRender would throw.
HTMLDialogElement.prototype.showModal = () => undefined;

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

describe('the error message', () => {
  // The module-level signal is shared, so an unsatisfied gate has to be put back.
  afterEach(() => previewGateSatisfied.set(true));

  // No env.js under the unit-test DOM means the expected passphrase is '', which never matches —
  // so any submit here is a failed one.
  function renderGatedForm() {
    previewGateSatisfied.set(false);
    const fixture = TestBed.createComponent(PreviewGateComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      input: el.querySelector('input') as HTMLInputElement,
      form: el.querySelector('form') as HTMLFormElement,
      error: () => el.querySelector('#preview-gate-error')?.textContent?.trim()
    };
  }

  it('should report a wrong passphrase', () => {
    const { fixture, input, form, error } = renderGatedForm();
    input.value = 'wrong';
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(error()).toBe('That passphrase is not correct.');
    expect(previewGateSatisfied()).toBe(false);
  });

  // Clearing on input is what makes a SECOND wrong attempt announce: re-setting the signal to the
  // string it already holds is a no-op, so the aria-live region never mutates and a screen-reader
  // user hears nothing from attempt 2 onwards. The clear puts a real mutation back in between.
  it('should clear as the user types, so the next failure re-announces', () => {
    const { fixture, input, form, error } = renderGatedForm();
    input.value = 'wrong';
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(error()).toBe('That passphrase is not correct.');

    input.value = 'wrong-again';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(error()).toBe('');

    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(error()).toBe('That passphrase is not correct.');
  });
});
