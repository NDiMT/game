"""Level 3 (the owner's rule): the gate is closed and dark; a beam of sunlight comes in from the sea up a channel to the
goddess's bronze mirror; the mirror (a swipe into it turns it, '/' or '\\') sends it on; the stone stops it, and so does
Ione herself (her body casts a shade). The moment the beam reaches the ring on the threshold, the gate opens, and stays
open. She wins on the ring with the gate open.

usage: python3 -I tools/go/light_trial.py      (proves the Milos board)

A board: cells; level ways (walk, push, light); gaps (light only: the channel's water, a chasm); the source (cell, dir)."""
import random, sys, json
from collections import deque
E, S_, W, N = 0, 1, 2, 3
DIRS = [(1, 0), (0, -1), (-1, 0), (0, 1)]
MIR = [{E: N, N: E, W: S_, S_: W}, {E: S_, S_: E, W: N, N: W}]

class Light:
    def __init__(s, cells, level, gaps, start, ring, source, mirrors, stone):
        s.cells = set(cells); s.level = set(); s.gaps = set()
        for a, b in level: s.level |= {(a, b), (b, a)}
        for a, b in gaps: s.gaps |= {(a, b), (b, a)}
        s.start, s.ring, s.source = start, ring, source
        s.mirrors = [(c, o) for c, o in mirrors]; s.mpos = {c: i for i, (c, _) in enumerate(s.mirrors)}
        s.stone0 = stone
    def nxt(s, c, d, light):
        q = (c[0] + DIRS[d][0], c[1] + DIRS[d][1])
        if (c, q) in s.level or (light and (c, q) in s.gaps): return q
        return None
    def beam(s, me, stone, mir):
        """the cells the beam lights, in order, from the source"""
        c, d = s.source; out = [c]; seen = set()
        while True:
            q = s.nxt(c, d, True)
            if q is None or q == stone: return out
            out.append(q)
            if q == me: return out
            if q in s.mpos:
                d = MIR[mir >> s.mpos[q] & 1][d]
                if (q, d) in seen: return out
                seen.add((q, d))
            c = q
    def init(s):
        m0 = sum(1 << i for i, (_, o) in enumerate(s.mirrors) if o)
        st = (s.start, s.stone0, m0, False)
        return s.settle(st)
    def settle(s, st):
        me, stone, mir, op = st
        if not op and s.ring in s.beam(me, stone, mir): op = True
        return (me, stone, mir, op)
    def step(s, st, d):
        me, stone, mir, op = st
        q = s.nxt(me, d, False)
        if q is None:
            q2 = (me[0] + DIRS[d][0], me[1] + DIRS[d][1])
            if q2 in s.mpos and ((me, q2) in s.level): return s.settle((me, stone, mir ^ (1 << s.mpos[q2]), op)), 'mirror'
            return None
        if q in s.mpos: return s.settle((me, stone, mir ^ (1 << s.mpos[q]), op)), 'mirror'
        ev = ''
        if q == stone:
            c = s.nxt(q, d, False)
            if c is None or c in s.mpos or c == s.ring or c == s.source[0]: return None
            stone = c; ev = 'push'
        if q == s.ring and not op: return None      # (the gate is shut: the threshold will not take her)
        if q == s.source[0]: return None
        st = s.settle((q, stone, mir, op))
        if q == s.ring: return st, ev + ('+' if ev else '') + 'won'
        if st[3] and not op: ev += ('+' if ev else '') + 'gate opens'
        return st, ev

def solve(t, limit=200000):
    s0 = t.init(); dist = {s0: 0}; ways = {s0: 1}; prev = {s0: None}; q = deque([s0]); succ = {}; goals = []
    while q:
        st = q.popleft(); succ[st] = []
        if st[0] == t.ring: goals.append(st); continue
        for d in range(4):
            r = t.step(st, d)
            if r is None: continue
            nst, ev = r
            if nst == st: continue
            succ[st].append(nst)
            if nst not in dist:
                if len(dist) > limit: return None
                dist[nst] = dist[st] + 1; ways[nst] = ways[st]; prev[nst] = (st, d, ev); q.append(nst)
            elif dist[nst] == dist[st] + 1: ways[nst] += ways[st]
    if not goals: return None
    best = min(dist[g] for g in goals); nw = sum(ways[g] for g in goals if dist[g] == best)
    g = min((x for x in goals if dist[x] == best), key=str); path = []; c = g
    while prev[c] is not None: st, d, ev = prev[c]; path.append((c[0], ev, c)); c = st
    path.reverse()
    can = set(goals); rev = {}
    for a, ns in succ.items():
        for b in ns: rev.setdefault(b, []).append(a)
    stack = list(goals)
    while stack:
        c = stack.pop()
        for p in rev.get(c, []):
            if p not in can: can.add(p); stack.append(p)
    dead = sum(1 for x in dist if x not in can)
    return dict(len=best, ways=nw, path=path, states=len(dist), dead=dead)


def milos():      # the third level, Milos (the owner's rule): the stone stands on the bridge's head in the light; turn the
    # mirror, push the stone off the line from the far side, twice: the second push takes her out of the light too, and the
    # beam reaches the ring
    cells = [(0, 3), (0, 4), (0, 5), (0, 6), (1, 6), (2, 6), (3, 6), (4, 6), (1, 5), (2, 5), (3, 5), (4, 5), (4, 4), (4, 3), (5, 4), (5, 5)] + [(1, k) for k in range(5)]
    lv = [((0, 3), (0, 4)), ((0, 4), (0, 5)), ((0, 5), (0, 6)), ((0, 6), (1, 6)), ((1, 6), (2, 6)), ((2, 6), (3, 6)), ((3, 6), (4, 6)),
          ((0, 5), (1, 5)), ((1, 5), (2, 5)), ((2, 5), (3, 5)), ((3, 5), (4, 5)), ((1, 5), (1, 6)), ((4, 5), (4, 6)),
          ((4, 5), (4, 4)), ((4, 4), (4, 3)), ((4, 4), (5, 4)), ((5, 4), (5, 5))]
    gp = [((1, k), (1, k + 1)) for k in range(5)] + [((4, 5), (5, 5))]      # (the channel's water and the chasm: light only)
    return Light(cells, lv, gp, (0, 3), (5, 5), ((1, 0), N), [((1, 5), 1)], (4, 5))


if __name__ == '__main__':
    r = solve(milos())
    print('milos: shortest', r['len'], 'ways', r['ways'], 'states', r['states'], 'dead ends', r['dead'])
    print(' '.join('%d%d%s' % (c[0], c[1], '(' + e + ')' if e else '') for c, e, _ in r['path']))
