import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, signal, viewChild } from '@angular/core';

/**
 * THIS IS OBFUSCATION, NOT ACCESS CONTROL.
 *
 * The passphrase is `window.__env.PREVIEW_GATE_PASSPHRASE`, which ships in the deployed bundle in
 * plain text — anyone can read it out of `/env.js` and type it in. It stops a stranger
 * stumbling onto unreleased UI on a site whose DATA IS ALREADY PUBLIC — nothing behind it is
 * secret, `eagle-search-api-test` answers anonymous callers regardless of this gate.
 *
 * It replaces the HTTP basic auth that `azure/server.js` applied when this preview ran on App
 * Service. Blob storage `$web` cannot authenticate, so the gate moved into the app.
 *
 * Real enforcement, if it is ever needed, is a Front Door WAF custom rule — Block action with an
 * IP CIDR match — which is free on the Standard tier and runs before the origin is reached.
 */

/** sessionStorage, not localStorage: the gate is per browsing session by design. */
const MARKER = 'eagle-public-preview-gate';

/**
 * False = `App` renders NOTHING (see `app.html`): no header, no router outlet, so no route
 * component is constructed and no API call is made.
 *
 * A modal over a live app was not enough. `<app-preview-gate>` was a sibling of the app wrapper, so
 * the outlet bootstrapped underneath it and `::backdrop` — translucent — left the unreleased UI
 * readable and screenshottable without touching devtools. The basic auth this replaces answered 401
 * before a byte of the bundle shipped; this is the closest an in-bundle gate gets to that.
 *
 * A module-level signal rather than a service: there is one gate, it holds one bit, and `App` only
 * reads it. Only the literal 'ok' is ever persisted — never the passphrase.
 */
export const previewGateSatisfied = signal(
  !gateEnabled() || sessionStorage.getItem(MARKER) === 'ok'
);

/**
 * Whether `entered` opens the gate. Exported so the logic is checkable without a DOM.
 *
 * An empty expected passphrase never matches: PREVIEW_GATE on with no passphrase configured is a
 * misconfiguration, and the safe reading of it is "gate everything", not "gate nothing".
 */
export function passphraseMatches(entered: string, expected: string): boolean {
  return expected.length > 0 && entered.trim() === expected;
}

@Component({
  selector: 'app-preview-gate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!satisfied()) {
      <!-- (cancel) is Escape. Letting it close the dialog would dismiss the gate with a keystroke. -->
      <dialog #dialog class="preview-gate" aria-labelledby="preview-gate-title" (cancel)="$event.preventDefault()">
        <form (submit)="submit($event, passphrase.value)">
          <h1 id="preview-gate-title" class="h5">EPIC preview</h1>
          <p class="text-muted small">This build is not released yet. Enter the preview passphrase to continue.</p>

          <label class="form-label" for="preview-gate-passphrase">Preview passphrase</label>
          <input
            id="preview-gate-passphrase"
            #passphrase
            class="form-control"
            type="password"
            autocomplete="off"
            aria-describedby="preview-gate-error" />

          <!-- Always rendered, so the live region exists before the text changes into it. -->
          <p id="preview-gate-error" class="text-danger small mt-2 mb-0" role="alert" aria-live="polite">{{ error() }}</p>

          <button class="btn btn-primary mt-3" type="submit">Continue</button>
        </form>
      </dialog>
    }
  `,
  styles: [`
    .preview-gate {
      border: 0;
      border-radius: 4px;
      padding: 1.5rem;
      max-width: 24rem;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    }
    .preview-gate::backdrop {
      background: rgba(0, 0, 0, 0.6);
    }
  `]
})
export class PreviewGateComponent {
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly satisfied = previewGateSatisfied;
  protected readonly error = signal('');

  constructor() {
    // showModal() is what does the blocking, and why this is a <dialog> rather than a div overlay:
    // the platform makes the rest of the page inert, moves focus to the first focusable child (the
    // passphrase input) and traps it there, so there is no focus management or aria-modal
    // bookkeeping to hand-roll. `autofocus` would say the same thing and is banned by the a11y lint.
    afterNextRender(() => this.dialog()?.nativeElement.showModal());
  }

  protected submit(event: Event, entered: string): void {
    event.preventDefault();
    if (!passphraseMatches(entered, expectedPassphrase())) {
      this.error.set('That passphrase is not correct.');
      return;
    }
    // The marker, not the passphrase: it survives a reload, and a lifted sessionStorage dump
    // hands over nothing that opens another browser.
    sessionStorage.setItem(MARKER, 'ok');
    this.satisfied.set(true);
  }
}

// env.js runs before Angular bootstraps, but it is absent under the unit-test DOM — hence the
// fallback, which leaves the gate off and the app behaving exactly as it does today.
function gateEnabled(): boolean {
  return Boolean(window.__env && window.__env.PREVIEW_GATE);
}

function expectedPassphrase(): string {
  return (window.__env && window.__env.PREVIEW_GATE_PASSPHRASE) || '';
}
