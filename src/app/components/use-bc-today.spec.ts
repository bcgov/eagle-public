import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBcToday } from './use-bc-today';

beforeEach(() => {
  vi.useFakeTimers();
  // 23:59 on October 26 in BC; already October 27 in UTC.
  vi.setSystemTime(new Date('2026-10-27T06:59:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useBcToday', () => {
  it("reads today's date in BC", () => {
    const { result } = renderHook(() => useBcToday());

    expect(result.current).toBe('2026-10-26');
  });

  it('keeps the day until BC midnight', async () => {
    const { result } = renderHook(() => useBcToday());

    await act(() => vi.advanceTimersByTimeAsync(30_000));

    expect(result.current).toBe('2026-10-26');
  });

  it('turns to the next day once BC midnight passes', async () => {
    const { result } = renderHook(() => useBcToday());

    await act(() => vi.advanceTimersByTimeAsync(2 * 60_000));

    expect(result.current).toBe('2026-10-27');
  });

  it('turns again at the following BC midnight', async () => {
    const { result } = renderHook(() => useBcToday());

    await act(() => vi.advanceTimersByTimeAsync(2 * 60_000 + 24 * 60 * 60_000));

    expect(result.current).toBe('2026-10-28');
  });
});
