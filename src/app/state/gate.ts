import { createStore, useStore } from './store';
import { ApiError, checkGatePassword } from 'app/api/api';
import { getConfig } from 'app/config/config';

const KEY = 'eagle-gate';

/** localStorage survives closing the tab, so one password entry lasts until site data is cleared.
    It throws in private mode; a browser that will not remember just re-asks. */
function remembered(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // ignored
  }
}

const unlocked = createStore(remembered());

/**
 * Shared-password curtain for pre-launch environments.
 *
 * The password is only ever checked by eagle-api — the client holds nothing to compare against,
 * and localStorage carries a flag, not a secret. Only a literal `ACCESS_GATE: true` closes the
 * curtain, so prod (false or unset) renders as it always has.
 */
export function useGateOpen(): boolean {
  const isUnlocked = useStore(unlocked);
  return getConfig().ACCESS_GATE !== true || isUnlocked;
}

/** True when the password was accepted, false when it was rejected. Anything else throws. */
export async function unlock(password: string): Promise<boolean> {
  try {
    await checkGatePassword(password);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      return false;
    }
    throw e;
  }
  remember();
  unlocked.set(true);
  return true;
}
