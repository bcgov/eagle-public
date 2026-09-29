import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import type { TypeNode } from './types-tree';

const TYPE = 'type';
const SUB_TYPE = 'subType';

export interface TypeLevel {
  type: string | null;
  subType: string | null;
  /** Moves to a level as a new history entry, so Back returns to the level before. */
  setLevel: (type: string | null, subType?: string | null) => void;
  /** Link target for a level: `?` plus the current search with the level keys swapped in. */
  hrefFor: (type: string | null, subType?: string | null) => string;
}

/** `prev` with the level keys set for a level; a sub-type without a type is dropped. */
function withLevel(
  prev: URLSearchParams,
  type: string | null,
  subType: string | null,
): URLSearchParams {
  const next = new URLSearchParams(prev);
  if (type) next.set(TYPE, type);
  else next.delete(TYPE);
  if (type && subType) next.set(SUB_TYPE, subType);
  else next.delete(SUB_TYPE);
  return next;
}

/**
 * The chart level the address names. Once the tree is in, a type it does not hold clears both keys
 * and a sub-type the type does not hold clears the sub-type; before that the raw values pass through.
 */
export function useTypeLevel(tree: readonly TypeNode[] | null): TypeLevel {
  const [params, setParams] = useSearchParams();
  const rawType = params.get(TYPE) || null;
  const rawSubType = params.get(SUB_TYPE) || null;

  let type = rawType;
  let subType = rawSubType;
  if (tree) {
    const node = tree.find((t) => t.name === rawType);
    type = node ? node.name : null;
    subType = node?.subs.some((s) => s.name === rawSubType) ? rawSubType : null;
  }

  const setLevel = useCallback(
    (nextType: string | null, nextSubType: string | null = null) => {
      setParams((prev) => withLevel(prev, nextType, nextSubType), { preventScrollReset: true });
    },
    [setParams],
  );

  const hrefFor = useCallback(
    (nextType: string | null, nextSubType: string | null = null) =>
      `?${withLevel(params, nextType, nextSubType)}`,
    [params],
  );

  return { type, subType, setLevel, hrefFor };
}
