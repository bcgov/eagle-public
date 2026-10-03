import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GateComponent } from './gate.component';
import { GateService } from 'app/services/gate.service';

describe('GateComponent', () => {
  let fixture: ComponentFixture<GateComponent>;
  let unlock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unlock = vi.fn();
    TestBed.configureTestingModule({
      imports: [GateComponent],
      providers: [{ provide: GateService, useValue: { unlock } }]
    });
    fixture = TestBed.createComponent(GateComponent);
    fixture.detectChanges();
  });

  function input(): HTMLInputElement {
    return fixture.nativeElement.querySelector('#gate-password');
  }

  async function submit(password: string): Promise<void> {
    input().value = password;
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function errorText(): string | null {
    return fixture.nativeElement.querySelector('#gate-error')?.textContent?.trim() ?? null;
  }

  it('renders a labelled password field and no error', () => {
    expect(input().type).toBe('password');
    expect(fixture.nativeElement.querySelector('label[for="gate-password"]')).toBeTruthy();
    expect(errorText()).toBe(null);
  });

  it('sends the typed password to the service', async () => {
    unlock.mockResolvedValue(true);
    await submit('hunter2');
    expect(unlock).toHaveBeenCalledWith('hunter2');
  });

  it('shows no error once the password is accepted', async () => {
    unlock.mockResolvedValue(true);
    await submit('hunter2');
    expect(errorText()).toBe(null);
  });

  it('shows "Incorrect password" when the password is rejected', async () => {
    unlock.mockResolvedValue(false);
    await submit('wrong');
    expect(errorText()).toBe('Incorrect password');
    expect(input().getAttribute('aria-describedby')).toBe('gate-error');
  });

  it('shows a generic error when the check itself fails', async () => {
    unlock.mockRejectedValue(new Error('boom'));
    await submit('anything');
    expect(errorText()).toContain('Could not check the password');
  });
});
