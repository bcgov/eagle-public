import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';

const KEY = 'eagle-gate';

/** sessionStorage throws in private mode; a browser that will not remember just re-asks. */
function remembered(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // ignored
  }
}

/**
 * Shared-password curtain for pre-launch environments.
 *
 * The password is only ever checked by eagle-api — the client holds nothing to compare against,
 * and sessionStorage carries a flag, not a secret. Only a literal `ACCESS_GATE: true` closes the
 * curtain, so prod (false or unset) renders as it always has.
 */
@Injectable({ providedIn: 'root' })
export class GateService {
  private http = inject(HttpClient);
  private configService = inject(ConfigService);

  private unlocked = signal(remembered());

  public readonly open = computed(
    () => this.configService.config().ACCESS_GATE !== true || this.unlocked()
  );

  /** True when the password was accepted, false when it was rejected. Anything else throws. */
  public async unlock(password: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.http.post(`${this.configService.getApiPath()}/public/gate`, { password })
      );
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 401) {
        return false;
      }
      throw e;
    }
    remember();
    this.unlocked.set(true);
    return true;
  }
}
