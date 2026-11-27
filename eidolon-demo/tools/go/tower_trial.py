"""A new level, "The counterweights" (27/11; the owner: "I want each map to be a series of clever puzzles on large
structures", then "make a new proposal"): Theron's workshop, a tower of tiers rising out of the sea, where the marble was
hoisted on counterweights. A run of tiers, each a puzzle, joined by stairs; the way goes up.

Two things, both simple, one of them already known:
 - Hoists: two platforms hung on one rope over a wheel. After every step the heavier side goes down and the other comes
   up; equal, they stay as they are. She weighs 1, a statue 2. A platform's low and high place are one tier apart.
 - The statues move only behind her back (the sixth level's rule): she faces the way she last stepped; after each of her
   steps every statue not in front of her takes one step toward her (the way it is farther first, the other if that is
   shut); one that steps onto her takes her (start again). She cannot walk into a statue.
Stairs join a tier to the next. Statues ride the hoists, climb stairs and keep to the floors as she does.

board: rows of two-character cells, a height digit then a kind:
  '.' nothing (sea or air)   'o' floor   '/' stair (its digit the lower tier: it joins that tier and the next)
  'S' her start   'G' the way out (the ring)   'M' a statue on a floor
  'A'..'D' / 'a'..'d' the two ends of hoist A..D; the digit is the end's low place, its high one a tier up.
up0: the ends that start up (by default the lower-case ones).

usage: python3 -I tools/go/tower_trial.py      (proves the stages and prints their ways)"""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
DV = {v: k for k, v in D4.items()}


def sgn(v): return (v > 0) - (v < 0)


class Board:
    def __init__(s, rows, f0=(0, -1), up0=None):
        s.rows = rows; s.H = len(rows); s.W = len(rows[0]) // 2; s.f0 = f0
        s.h = {}; s.kind = {}; s.M = []; s.ends = {}; s.S = s.G = None
        for y, r in enumerate(rows):
            for x in range(s.W):
                d, k = r[2 * x], r[2 * x + 1]
                if k == '.': continue
                q = (x, y); s.h[q] = int(d); s.kind[q] = k
                if k == 'S': s.S = q
                if k == 'G': s.G = q
                if k == 'M': s.M.append(q)
                if k.isalpha() and k.upper() in 'ABCD' and k not in 'SGM': s.ends[q] = k
        s.pairs = sorted({k.upper() for k in s.ends.values()})
        s.end_of = {k: q for q, k in s.ends.items()}
        ups = set(up0) if up0 is not None else {k for k in s.ends.values() if k.islower()}
        s.lift0 = tuple(1 if p.lower() in ups else 0 for p in s.pairs)      # 1: the lower-case end up, the upper-case down

    def height(s, q, lift):
        """a place's height now: a hoist's end by its rope; a stair half a tier up from its digit"""
        if q in s.ends:
            k = s.ends[q]; i = s.pairs.index(k.upper()); up = (lift[i] == 1) == k.islower()
            return s.h[q] + (1 if up else 0)
        return s.h[q] + (0.5 if s.kind[q] == '/' else 0)

    def step_ok(s, p, q, lift):
        if q not in s.h: return False
        a, b = s.height(p, lift), s.height(q, lift)
        if s.kind.get(p) == '/' or s.kind.get(q) == '/': return abs(a - b) == 0.5 or (a == b and s.kind[p] == s.kind[q] == '/')
        return a == b

    def settle(s, lift, her, ms):
        """after the steps: every hoist's heavier side goes down"""
        out = list(lift)
        for i, p in enumerate(s.pairs):
            U, l = s.end_of[p], s.end_of[p.lower()]
            w = lambda q: (1 if q == her else 0) + (2 if q in ms else 0)
            wu, wl = w(U), w(l)
            if wu > wl: out[i] = 1      # the upper-case end goes down, the lower-case up
            elif wl > wu: out[i] = 0
        return tuple(out)


def move(b, st, d):
    """one swipe: (kind, new state, what happened); kind: blocked | move | win | caught"""
    h, f, ms, lift = st
    q = (h[0] + d[0], h[1] + d[1])
    if q in ms or not b.step_ok(h, q, lift): return 'blocked', None, None
    if q == b.G: return 'win', None, None
    nf = d; cur = set(ms); moved = []
    for m in sorted(ms, key=lambda m: (abs(m[0] - q[0]) + abs(m[1] - q[1]), m)):
        if (m[0] - q[0]) * nf[0] + (m[1] - q[1]) * nf[1] > 0: continue      # in front of her: it keeps still
        dx, dy = q[0] - m[0], q[1] - m[1]
        tries = [(sgn(dx), 0), (0, sgn(dy))] if abs(dx) >= abs(dy) else [(0, sgn(dy)), (sgn(dx), 0)]
        for t in tries:
            if t == (0, 0): continue
            n = (m[0] + t[0], m[1] + t[1])
            if n in cur or not b.step_ok(m, n, lift): continue
            if n == q: return 'caught', None, m
            cur.discard(m); cur.add(n); moved.append((m, n)); break
    nl = b.settle(lift, q, cur)
    return 'move', (q, nf, frozenset(cur), nl), (moved, [p for i, p in enumerate(b.pairs) if nl[i] != lift[i]])


def start(b): return (b.S, b.f0, frozenset(b.M), b.lift0)


def analyse(b, count=True, cap=400000):
    s0 = start(b); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            kind, n, ev = move(b, s, d)
            if kind == 'win': wins.add(s); edges[s].append((d, 'win'))
            elif kind == 'move':
                edges[s].append((d, n))
                if n not in seen:
                    seen.add(n); dq.append(n)
                    if len(seen) > cap: return None
    if not wins: return None
    dist = {w: 1 for w in wins}; rev = {}
    for s, l in edges.items():
        for d, n in l:
            if n != 'win': rev.setdefault(n, []).append(s)
    dq = deque(wins)
    while dq:
        s = dq.popleft()
        for p in rev.get(s, []):
            if p not in dist: dist[p] = dist[s] + 1; dq.append(p)
    if s0 not in dist: return None
    memo = {}
    def cnt(s):
        if s in memo: return memo[s]
        if dist[s] == 1: v = sum(1 for d, n in edges[s] if n == 'win')
        else: v = sum(cnt(n) for d, n in edges[s] if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1)
        memo[s] = min(v, 99); return memo[s]
    path = []; s = s0; lifts = 0
    while True:
        if dist[s] == 1: path.append(next(d for d, n in edges[s] if n == 'win')); break
        for d, n in edges[s]:
            if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1:
                lifts += sum(1 for i in range(len(n[3])) if n[3][i] != s[3][i]); path.append(d); s = n; break
    dead = sum(1 for s in seen if s not in dist)
    return dict(L=dist[s0], ways=cnt(s0) if count else None, states=len(seen), dead=dead, path=path, hoists=lifts)


def show(b, st):
    h, f, ms, lift = st; out = []
    for y in range(b.H):
        row = ''
        for x in range(b.W):
            q = (x, y)
            if q not in b.h: row += ' . '; continue
            ch = '@' if q == h else 'M' if q in ms else b.kind[q] if b.kind[q] not in 'SM' else 'o'
            hh = b.height(q, lift)
            row += ('%g' % hh).rjust(1)[:3].ljust(2) + ch if isinstance(hh, int) else '%d^%s' % (int(hh), ch)
        out.append(row)
    return '\n'.join(out) + '\n facing ' + D4[f]


def trace(b, path):
    st = start(b); print(show(b, st)); print()
    for i, d in enumerate(path):
        k, n, ev = move(b, st, d); print(i + 1, D4[d], k, ev or '')
        if k != 'move': break
        st = n; print(show(b, st)); print()


STAGES = [
    # the counterweight: she walks onto the low end; the statue on its plinth beside the high end, behind her back now,
    # steps onto it, which goes down under it, and her end comes up to the way out (let it step down before she is on
    # her end and her end goes up empty, out of reach). (annealed: one way, no step back)
    ('the counterweight', ['......1G', '..0o1a0A', '0o0o2M0o', '0S0o0o0o'], (0, -1), None),
    # (the next four found by annealing about an all-floor grid (a score for the way's length, one way, the hoists moved,
    # every statue and hoist needed, few stairs, no step back) and pruned of cells that changed nothing)
    # the two tiers: ride the hoist up, then bring it back down for the statue to send you up again
    ('the ride', ['......1o1G', '0o0/..0/..', '0o1o1o0A..', '0o2M1a1o..', '0o....1o..', '0o0o0o0o0S'], (0, -1), None),
    # two statues: one weighs the hoist down, the other follows you up the stair behind your back
    ('two weights', ['1G........', '1o........', '1M0/0o....', '....0a0o0o', '0o1o0/2M0/', '0S0o0o0o0A'], (0, -1), None),
    # two hoists and one statue, many ways to be caught
    ('two ropes', ['2G1/......', '1o1M1o....', '0/0o0a0o0o', '1o....0o0b', '1A0o0o0o1o', '0S0o1B0o0/'], (0, -1), None),
    # two hoists and two statues, the hoists moved five times
    ('the summit', ['0o0o0/..1G', '0b..1M1M1o', '0A0o0a..1o', '1o0/....0B', '..1o0o0o0o', '..0/0o..0S'], (0, -1), None),
]

if __name__ == '__main__':
    for name, rows, f0, up0 in STAGES:
        b = Board(rows, f0, up0); r = analyse(b)
        if r is None: print(name, 'no way'); continue
        print('%s: %d swipes (%s), ways %s, %d states, %d dead, hoist moves %d' % (
            name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'], r['states'], r['dead'], r['hoists']))
