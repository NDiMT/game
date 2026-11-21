"""Level 5, the Guardian (the script's tenth truth: "He looked into the mirror with longing, and the mirror kept him").

The Guardian of the Glass stands on his pedestal and turns his head a quarter with every move she makes (a step, a push,
a turn of the mirror), clockwise. His gaze runs straight out along the ways and over the water until a stone, a wall or
the mirror stops it. Where he looks now, and where he will look after her move (shown faintly), she may not end a move:
seen, she is held and taken back to the start (everything as it began; so no state is ever a dead end). The stone she
pushes stops his gaze (she hides behind it). The goddess's bronze mirror stands on its own place and turns a quarter at a
swipe into it from beside it; when his gaze falls on its face, it is thrown straight back into his eyes: he sees himself,
and the mirror keeps him: he stops, his gaze goes out, and the gate opens. She wins on the ring before it.

usage: python3 -I tools/go/gaze_trial.py [search]

A board: cells; level ways (walk, push, gaze); gaze-only links (the water, his pedestal's edge); the Guardian's cell and
first direction; the mirror (cell, facing, the cells it is turned from); the stone; the start; the ring."""
import sys, itertools
from collections import deque
E, S_, W, N = 0, 1, 2, 3
DIRS = [(1, 0), (0, -1), (-1, 0), (0, 1)]
NAME = 'ESWN'

class Gaze:
    def __init__(s, level, links, guard, d0, mirror, mface, mfrom, stone, start, ring, turn=1, sinks=()):
        s.level = set()
        for a, b in level: s.level |= {(a, b), (b, a)}
        s.links = set()
        for a, b in links: s.links |= {(a, b), (b, a)}
        s.cells = {c for w in s.level for c in w}
        s.guard, s.d0, s.turn = guard, d0, turn
        s.mirror, s.mface0, s.mfrom = mirror, mface, set(mfrom)
        s.stone0, s.start, s.ring = stone, start, ring
        s.sinks = set(sinks)      # (deep water beside a way: the stone pushed into it sinks, and is gone)
    def nxt(s, c, d, gaze):
        q = (c[0] + DIRS[d][0], c[1] + DIRS[d][1])
        if (c, q) in s.level or (gaze and (c, q) in s.links): return q
        return None
    def look(s, phase):
        return (s.d0 + s.turn * phase) % 4
    def beam(s, me, stone, mface, phase):
        """the cells his gaze reaches (in order) and whether it comes back to him off the mirror's face"""
        c, d = s.guard, s.look(phase); out = []
        while True:
            q = s.nxt(c, d, True)
            if q is None or q == stone: return out, False
            if q == s.mirror: return out, mface == (d + 2) % 4
            out.append(q)
            if q == me: return out, False
            c = q
    def init(s):
        return (s.start, s.stone0, s.mface0, 0, False)
    def step(s, st, d):
        """one swipe: the new state and what happened, or None (nothing moves), or 'seen'"""
        me, stone, mf, ph, kept = st
        q = (me[0] + DIRS[d][0], me[1] + DIRS[d][1])
        ev = ''
        if q == s.mirror and me in s.mfrom:
            if kept: return None
            nm, nmf = me, (mf + 1) % 4; ev = 'mirror'
            nstone = stone
        else:
            if (me, q) not in s.level or q == s.guard or q == s.mirror: return None
            if q == s.ring and not kept: return None      # (the gate is shut: the ring will not take her)
            nstone = stone
            if q == stone:
                c = s.nxt(q, d, False)
                c2 = (q[0] + DIRS[d][0], q[1] + DIRS[d][1])
                if c is None and c2 in s.sinks: nstone = None; ev = 'push+sinks'
                elif c is None or c in (s.guard, s.mirror, s.ring): return None
                else: nstone = c; ev = 'push'
            nm, nmf = q, mf
            if not kept:
                lit, _ = s.beam(None, stone, mf, ph)      # (where he looks now: she may not step into it)
                if nm in lit: return 'seen'
        nph = ph + 1; nkept = kept
        if not kept:
            lit, back = s.beam(nm, nstone, nmf, nph)
            if nm in lit: return 'seen'
            if back: nkept = True; ev += ('+' if ev else '') + 'kept'
        if nm == s.ring: ev += ('+' if ev else '') + 'won'
        return (nm, nstone, nmf, nph % 4 if not nkept else 0, nkept), ev

def solve(t, limit=400000, nostone=False):
    s0 = t.init()
    if nostone: s0 = (s0[0], None, s0[2], s0[3], s0[4])
    dist = {s0: 0}; ways = {s0: 1}; prev = {s0: None}; q = deque([s0]); goals = []
    while q:
        st = q.popleft()
        if st[0] == t.ring: goals.append(st); continue
        for d in range(4):
            r = t.step(st, d)
            if r is None or r == 'seen': continue
            nst, ev = r
            if nst not in dist:
                if len(dist) > limit: return None
                dist[nst] = dist[st] + 1; ways[nst] = ways[st]; prev[nst] = (st, d, ev); q.append(nst)
            elif dist[nst] == dist[st] + 1: ways[nst] += ways[st]
    if not goals: return None
    best = min(dist[g] for g in goals); nw = sum(ways[g] for g in goals if dist[g] == best)
    g = min((x for x in goals if dist[x] == best), key=str); path = []; c = g
    while prev[c] is not None: st, d, ev = prev[c]; path.append((NAME[d], c[0], ev, c[3])); c = st
    path.reverse()
    return dict(len=best, ways=nw, path=path, states=len(dist))

def show(t, res, title=''):
    print('==', title, 'len', res['len'], 'ways', res['ways'], 'states', res['states'])
    for i, (dn, cell, ev, ph) in enumerate(res['path']):
        print('  %2d %s -> %-8s %-12s he looks %s' % (i + 1, dn, cell, ev, NAME[t.look(ph)] if 'kept' not in ev else '-'))


def guardian():      # the fifth level: his pedestal in a small pool in the middle, the walk round it open at the back
    # x: east (up and right on the screen), y: north (up and left). She comes in at the south-west foot of the picture;
    # the stone stands south-east of him; the pier runs out along his east line to the goddess's mirror (turned from the
    # pier's end, at first facing south); north-east of him the pool is deep (the stone pushed in sinks); the gate at
    # the north-west. He first looks south and turns clockwise.
    u = [(-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1), (1, 0)]
    lv = [(u[i], u[i + 1]) for i in range(len(u) - 1)]
    lv += [((-2, -1), (-1, -1))]                                     # the start's way in
    lv += [((1, -1), (1, -2)), ((1, -2), (0, -2)), ((0, -2), (0, -1))]      # below the stone: where she pushes it from
    lv += [((1, -1), (2, -1)), ((2, -1), (2, 0)), ((2, 0), (3, 0))]     # round to the pier, and out along it
    lv += [((-1, 1), (-1, 2))]                                       # the ring before the gate
    links = [((0, 0), (0, 1)), ((0, 0), (1, 0)), ((0, 0), (0, -1)), ((0, 0), (-1, 0)),      # his pedestal's edge
             ((-1, 0), (-2, 0)), ((-2, 0), (-3, 0)), ((0, 1), (0, 2)), ((0, 2), (0, 3)), ((0, -1), (0, -2)), ((0, -2), (0, -3)),
             ((1, 0), (2, 0)), ((3, 0), (4, 0))]                      # the water between the walk and the pier; the mirror
    return Gaze(lv, links, (0, 0), S_, (4, 0), S_, [(3, 0)], (1, -1), (-2, -1), (-1, 2), turn=1, sinks=[(1, 1)])

def replay(t, res):
    st = t.init(); out = [st]
    for dn, cell, ev, ph in res['path']:
        st = t.step(st, NAME.index(dn))[0]; out.append(st)
    return out

if __name__ == '__main__':
    t = guardian(); r = solve(t)
    show(t, r, 'the Guardian (level 5)')
    print('without the stone:', solve(t, nostone=True))
