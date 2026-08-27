import { useRef, useState } from 'react';
import { unlock } from 'app/state/gate';
import './gate.css';

/** Password curtain shown instead of the app while ACCESS_GATE is true. */
export function Gate() {
  const password = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (!(await unlock(password.current?.value ?? ''))) {
        setError('Incorrect password');
      }
    } catch {
      setError('Could not check the password. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <header className="gate__header">
        <div className="gate__brand">
          <strong>EPIC</strong>
          <span>Environmental Assessment Office</span>
        </div>
      </header>
      <main className="gate__body">
        <section className="gate__card">
          <h1>EPIC is not open to the public yet</h1>
          <p>Enter the access password to continue.</p>
          <form onSubmit={submit}>
            <div className="form-group">
              <label htmlFor="gate-password" className="control-label">Password</label>
              <input
                ref={password}
                id="gate-password"
                name="password"
                className="form-control"
                type="password"
                autoComplete="current-password"
                autoFocus
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? 'gate-error' : undefined}
              />
            </div>
            {error && (
              <p id="gate-error" className="text-danger" role="alert">{error}</p>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>Continue</button>
          </form>
        </section>
      </main>
      <footer className="gate__footer">Government of British Columbia</footer>
    </div>
  );
}
