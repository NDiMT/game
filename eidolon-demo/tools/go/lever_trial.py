"""Level 6 trial, "The balance" (25/11; the owner, of the gaze that turns to stone: "nice but a bit complicated, we keep
it for future levels, can you think of something else?"): one new thing, a lever, and the cube the player knows.

A long marble beam lies across a rock in the still water, its pivot under one of its places. The heavier side goes
down: weight times distance from the pivot (Archimedes' law of the lever). She is a soul and weighs 1; the cube weighs 2.
If the two sides weigh the same, the beam stays as it was. Its ends meet the floors: the end that is down meets the low
quay (height 0), the end that is up meets the high terrace (height 2), the pivot meets a pier at height 1. Along the
beam she walks and pushes the cube as on any way. Stairs join the heights where the board has them. The ring before the
gate is on a high terrace. In the script, the third chapter's Mourners are quieted "with a Weight".

A board: rows of cells: '~' water, 'o' low floor, 'm' a pier at the pivot's height, 'H' high floor, 's' a stair between
low and pier, 't' a stair between pier and high, '=' the beam, 'P' its pivot (on the beam), 'S' her start (low), 'C' the
cube (low), 'G' the ring (high), 'x' a hole in the low floor that the cube can be pushed into (it fills it, flush);
'R' and 'Q' her start on a high floor or on a pier, 'K' and 'J' the cube on a high floor or on a pier, 'g' the ring
on a low floor;
t0: which way the beam lies at first, -1 its first end down (the left or top one), +1 its last end down.

usage: python3 -I tools/go/lever_trial.py      (proves the boards and prints their ways)"""
import sys
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
W_HER, W_CUBE = 1, 2


class Board:
    def __init__(s, rows, t0=-1):
        s.H = len(rows); s.W = len(rows[0]); s.h = {}; s.stair = {}; s.beam = []; s.holes = set(); s.t0 = t0
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in 'oSCxg': s.h[q] = 0
                if c in 'mQJ': s.h[q] = 1
                if c in 'HGRK': s.h[q] = 2
                if c == 's': s.stair[q] = (0, 1)
                if c == 't': s.stair[q] = (1, 2)
                if c in '=P': s.beam.append(q)
                if c == 'P': s.pivot = q
                if c in 'SRQ': s.S = q
                if c in 'CKJ': s.C = q
                if c in 'Gg': s.G = q
                if c == 'x': s.holes.add(q); del s.h[q]
        s.beam.sort()
        s.bi = {q: i for i, q in enumerate(s.beam)}
        s.p = s.bi[s.pivot]

    def height(s, q, tilt):
        """a place's height now (None: not a floor that meets others off the beam)"""
        if q in s.bi:
            i = s.bi[q]
            if i == s.p: return 1
            if i == 0: return 0 if tilt == -1 else 2
            if i == len(s.beam) - 1: return 0 if tilt == 1 else 2
            return None
        return s.h.get(q)

    def walkable(s, q, filled):
        return q in s.h or q in s.stair or q in s.bi or (q in s.holes and q in filled)

    def link(s, a, b, tilt, filled):
        """can one go from a to b (neighbours) as things lie"""
        if not (s.walkable(a, filled) and s.walkable(b, filled)): return False
        if a in s.bi and b in s.bi: return True
        ha = 0 if (a in s.holes and a in filled) else s.height(a, tilt)
        hb = 0 if (b in s.holes and b in filled) else s.height(b, tilt)
        if a in s.stair and b in s.stair: return False
        if a in s.stair: return hb is not None and hb in s.stair[a]
        if b in s.stair: return ha is not None and ha in s.stair[b]
        return ha is not None and ha == hb


def torque(b, h, c):
    t = 0
    if h in b.bi: t += W_HER * (b.bi[h] - b.p)
    if c in b.bi: t += W_CUBE * (b.bi[c] - b.p)
    return t


def move(b, st, d):
    """one swipe: ('blocked'|'win'|'move', new state, what happened)"""
    h, c, tilt, filled = st
    q = (h[0] + d[0], h[1] + d[1])
    if not b.link(h, q, tilt, filled): return 'blocked', None, None
    ev = []
    if q == c:      # (a push: the cube to the next place, along the way or into a hole, never onto a stair)
        r = (q[0] + d[0], q[1] + d[1])
        if r in b.holes and r not in filled and b.height(q, tilt) == 0:
            filled = filled | {r}; c = None; ev.append('fill')
        elif r in b.stair or not b.link(q, r, tilt, filled): return 'blocked', None, None
        else: c = r; ev.append('push')
    if q == b.G: return 'win', None, None
    tq = torque(b, q, c)
    nt = tilt if tq == 0 else (1 if tq > 0 else -1)
    if nt != tilt: ev.append('tilt')
    return 'move', (q, c, nt, filled), ev


def analyse(b, cube=True):
    s0 = (b.S, b.C if cube else None, b.t0, frozenset()); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            kind, n, ev = move(b, s, d)
            if kind == 'win': wins.add(s); edges[s].append((d, 'win'))
            elif kind == 'move':
                edges[s].append((d, n))
                if n not in seen: seen.add(n); dq.append(n)
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
    path = []; s = s0
    while True:
        if dist[s] == 1: path.append(next(d for d, n in edges[s] if n == 'win')); break
        for d, n in edges[s]:
            if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1: path.append(d); s = n; break
    dead = sum(1 for s in seen if s not in dist)
    return dict(L=dist[s0], ways=cnt(s0), states=len(seen), dead=dead, path=path)


def show(b, st):
    h, c, tilt, filled = st
    out = []
    for y in range(b.H):
        row = ''
        for x in range(b.W):
            q = (x, y)
            if q == h: ch = '@'
            elif q == c: ch = '#'
            elif q == b.G: ch = 'G'
            elif q in b.bi:
                hh = b.height(q, tilt); ch = 'P' if q == b.pivot else ('v' if hh == 0 else '^' if hh == 2 else '=')
            elif q in b.holes: ch = 'o' if q in filled else 'x'
            elif q in b.stair: ch = 's' if b.stair[q] == (0, 1) else 't'
            elif q in b.h: ch = 'oMH'[b.h[q]]
            else: ch = '~'
            row += ch + ' '
        out.append(row)
    return '\n'.join(out)


def trace(b, path):
    st = (b.S, b.C, b.t0, frozenset()); print(show(b, st)); print()
    for i, d in enumerate(path):
        kind, n, ev = move(b, st, d)
        print('%d %s %s %s' % (i + 1, D4[d], kind, ' '.join(ev or [])))
        if kind != 'move': break
        st = n; print(show(b, st)); print()


# the boards (25/11), each one way, the stone needed:
# 1, the counterweight (7 swipes): push the stone along the beam past the pivot; its weight raises your end; walk back
#    to it and step up to the gate
TUTOR = (["~~G~~~~",
          "SC==P=="], -1)
# 2, down to go up (18 swipes, no dead end): the stone stands on a terrace over the beam's lowered end; tip the beam
#    with your own weight first (go down the stair onto the pivot and step to the other side), so that end comes up;
#    push the stone onto it: it rides down and raises the far end; come back down the stair onto the pivot (the only
#    way past the stone) and walk out to the raised end, which the stone now holds up
LEVEL = (["HRH~~",
          "K~t~G",
          "==P=="], -1)
# 3, around the stone (13 swipes; it can stick, then start over): she must stand on the far end with the stone on the
#    near side of the pivot, but it lies between her and the beam: push it past the pivot, slip out by the pier, come
#    round onto the far end, and push it back over the middle
AROUND = (["~~~~~~G",
           "SC==P==",
           "~~~~mso"], -1)

if __name__ == '__main__':
    for name, bd in (('the counterweight', TUTOR), ('down to go up', LEVEL), ('around the stone', AROUND)):
        b = Board(*bd); r = analyse(b)
        print('%s: %d swipes (%s), one way: %s, %d states, %d dead, the stone needed: %s' % (
            name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'] == 1, r['states'], r['dead'], analyse(b, False) is None))
    trace(Board(*LEVEL), analyse(Board(*LEVEL))['path'])
