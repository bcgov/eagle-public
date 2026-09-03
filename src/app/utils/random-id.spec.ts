import { describe, it, expect, afterEach, vi } from 'vitest';
import { randomId } from './random-id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Fills every byte with one value, so the version and variant bits are the only ones that vary. */
function fixedBytes(byte: number) {
  return {
    getRandomValues: (array: Uint8Array) => {
      array.fill(byte);
      return array;
    },
  };
}

describe('randomId', () => {
  const realCrypto = globalThis.crypto;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('takes crypto.randomUUID where the browser has one', () => {
    const native = vi
      .spyOn(realCrypto, 'randomUUID')
      .mockReturnValue('11111111-2222-4333-8444-555555555555');

    expect(randomId()).toBe('11111111-2222-4333-8444-555555555555');
    expect(native).toHaveBeenCalledTimes(1);
  });

  it('hands back a v4 UUID from either path', () => {
    expect(randomId()).toMatch(UUID_V4);

    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => realCrypto.getRandomValues(a) });

    const id = randomId();
    expect(id).toHaveLength(36);
    expect(id).toMatch(UUID_V4);
  });

  // The fallback runs outside a secure context, where nothing else stamps the RFC 4122 bits.
  it('stamps version 4 and the variant bits itself in the fallback', () => {
    vi.stubGlobal('crypto', fixedBytes(0xff));
    expect(randomId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');

    vi.stubGlobal('crypto', fixedBytes(0x00));
    expect(randomId()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('gives a different id every call in the fallback', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => realCrypto.getRandomValues(a) });

    const ids = new Set(Array.from({ length: 50 }, randomId));

    expect(ids.size).toBe(50);
  });
});
