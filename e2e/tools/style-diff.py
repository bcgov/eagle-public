#!/usr/bin/env python3
"""Compares two style dumps from tools/style-dump.ts and prints the properties that differ.

    python3 tools/style-diff.py screenshots/test.styles.json screenshots/local.styles.json

Elements are aligned per route with difflib on their `tag.class` key, so rows that exist on only
one side are reported separately from rows that exist on both but are styled differently.
"""
import json
import sys
from collections import Counter
from difflib import SequenceMatcher

# Values that differ for reasons other than CSS: live data changes the text, hence the box size.
NOISY = {'width', 'height', 'min-height'}


def main() -> int:
    a_path, b_path = sys.argv[1], sys.argv[2]
    only = sys.argv[3] if len(sys.argv) > 3 else None
    a, b = json.load(open(a_path)), json.load(open(b_path))

    for route in a:
        if only and route != only:
            continue
        if route not in b:
            print(f'## {route}: missing from {b_path}')
            continue
        ka = [r[0] for r in a[route]]
        kb = [r[0] for r in b[route]]
        diffs = Counter()
        examples = {}
        for tag, i1, i2, j1, j2 in SequenceMatcher(None, ka, kb, autojunk=False).get_opcodes():
            if tag != 'equal':
                continue
            for off in range(i2 - i1):
                key = ka[i1 + off]
                sa, sb = a[route][i1 + off][1], b[route][j1 + off][1]
                for prop, va in sa.items():
                    if prop in NOISY:
                        continue
                    vb = sb.get(prop)
                    if va != vb:
                        diffs[(key, prop, va, vb)] += 1
                        examples.setdefault((key, prop), (va, vb))
        if diffs:
            print(f'\n## {route}')
            for (key, prop, va, vb), n in diffs.most_common():
                print(f'  x{n:<4} {key}\n         {prop}: {va}  ->  {vb}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
