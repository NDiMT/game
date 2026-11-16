"""The trial of the third level of Eidolon GO, "The Moon Dial": a sanctuary in the snow under the moon. Its rules are
the game's own (ch1.gd: _ivg_turn, _ivg_w_step, _ivg_seen), mirrored here one to one:

  - Ione moves one node per swipe; after each move of hers that is made, the guardian takes its step.
  - A carved face looks along a line: from the node before it, straight on along level ways, until the stone or another
    face stands in the way (the guardian does not). Whoever ends a step in its look is struck: Ione (the trial begins
    again) or the guardian (it shatters).
  - Walk into a face from beside it or behind it and it falls (its plinth stays); from before it, she is struck.
  - The moon dial: swipe into it from beside it and it turns; every face bound to it turns a quarter (and back).
  - The stone is pushed one node straight on along a level way, never onto a plinth, the dial, the guardian or the
    ring. Behind it is shade.
  - The frozen guardian paces its route, turning back at its ends or where the way is held (the stone, a face, the
    dial). It catches her if it steps onto her, or if she walks into its face; she shatters it from behind.

The generator lays faces, the dial, the stone and the guardian's route on the board, proves each candidate by a
breadth-first search over the whole state, and keeps the best: a shortest way of MIN..MAX swipes, the only one of its
length, no state from which the ring cannot be reached, every thing needed, the dial turned, the stone pushed and the
guardian shattered by a look on the way.

usage: python3 -I tools/go/moon_trial.py [tries] [seed] [min] [max]
"""
import json, math, os, random, sys
from collections import deque

a = [x for x in sys.argv[1:] if not x.startswith('--')]
TRIES = int(a[0]) if len(a) > 0 else 20000
rnd = random.Random(int(a[1]) if len(a) > 1 else 1)
MIN = int(a[2]) if len(a) > 2 else 16
MAX = int(a[3]) if len(a) > 3 else 30
DIRS = [(1, 0), (0, -1), (-1, 0), (0, 1)]      # E, S, W, N (a quarter turn sunwise is +1)

# ------------------------------------------------------------------ the board: cells, ways (level, or flights)
def set_board(cells, ways):
    """cells: names or (x, y); ways: (a, b, 'level' | 'flight'); POS of named cells in NAMED_POS"""
    global CELLS, POS, NAMES, IX, P, NB, LEVEL, GO, START, RING, WAYS
    CELLS = cells; WAYS = ways
    POS = dict(NAMED_POS)
    for c in CELLS:
        if isinstance(c, tuple): POS[c] = c
    NAMES = [c if isinstance(c, str) else '%d%d' % c for c in CELLS]
    IX = {NAMES[i]: i for i in range(len(CELLS))}
    key = lambda c: c if isinstance(c, str) else '%d%d' % c
    P = [POS[c] for c in CELLS]
    NB = [[] for _ in CELLS]; LEVEL = {}
    for p_, q_, k in WAYS:
        i, j = IX[key(p_)], IX[key(q_)]; NB[i].append(j); NB[j].append(i); LEVEL[(i, j)] = LEVEL[(j, i)] = (k == 'level')
    GO = [[go(i, d) for d in range(4)] for i in range(len(CELLS))]
    START, RING = IX['S'], IX['R']
def dir_of(i, j):
    dx, dy = P[j][0] - P[i][0], P[j][1] - P[i][1]; L = math.hypot(dx, dy) or 1.0
    return (dx / L, dy / L)
def go(i, d):      # the node one level step from i the way d
    for j in NB[i]:
        if LEVEL[(i, j)] and dir_of(i, j)[0] * DIRS[d][0] + dir_of(i, j)[1] * DIRS[d][1] > 0.95: return j
    return -1
def cont(i, k):      # straight on from k, coming from i, along level ways
    if not LEVEL.get((i, k)): return -1
    d = dir_of(i, k)
    for c in NB[k]:
        if c != i and LEVEL[(k, c)] and d[0] * dir_of(k, c)[0] + d[1] * dir_of(k, c)[1] >= 0.9: return c
    return -1
def grid_ways(cells, flights=(), cut=()):
    """level ways between grid cells side by side (but those in cut), and flights given by name or cell"""
    out = []
    cs = [c for c in cells if isinstance(c, tuple)]
    for c in cs:
        for d in ((1, 0), (0, 1)):
            q_ = (c[0] + d[0], c[1] + d[1])
            if q_ in cs and (c, q_) not in cut and (q_, c) not in cut and (c, q_) not in flights and (q_, c) not in flights: out.append((c, q_, 'level'))
    for f in flights: out.append((f[0], f[1], 'flight'))
    return out

NAMED_POS = {'S': (-1, 1), 'R': (2, 6)}
_cells = ['S', (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (2, 2), (4, 2), (0, 3), (1, 3), (2, 3), (3, 3), (4, 3), (0, 4), (2, 4),
          (0, 5), (1, 5), (2, 5), (3, 5), 'R']
set_board(_cells, grid_ways(_cells, flights=[('S', (0, 1)), ((2, 5), 'R')], cut=[((0, 1), (0, 2))]))


class Trial:
    def __init__(s, faces, lever, stone, route, plinths=True):
        s.faces = [(IX[n], d0, d1) for n, d0, d1 in faces]      # (node, way it looks with the dial at 0, at 1)
        s.lever = IX[lever] if lever else -1; s.stone0 = IX[stone]
        s.route = [IX[n] for n in route] if route else []
        s.plinth = {f for f, _, _ in s.faces}; s.plinths = plinths
    def looknode(s, k, v):
        f, d0, d1 = s.faces[k]; return GO[f][d1 if v else d0]
    def face_on(s, n, alive):
        for k, (f, _, _) in enumerate(s.faces):
            if alive >> k & 1 and f == n: return k
        return -1
    def seen(s, stone, alive, v):
        out = set()
        for k, (f, _, _) in enumerate(s.faces):
            if not alive >> k & 1: continue
            kk = s.looknode(k, v)
            if kk < 0 or kk == stone or s.face_on(kk, alive) >= 0: continue
            out.add(kk); a_ = f
            while True:
                c = cont(a_, kk)
                if c < 0 or c == stone or s.face_on(c, alive) >= 0: break
                out.add(c); a_, kk = kk, c
        return out
    def init(s):
        return (START, s.stone0, (1 << len(s.faces)) - 1, 0, 0 if s.route else -1, 1)
    def wnode(s, wi): return s.route[wi] if wi >= 0 else -1
    def wfront(s, wi, wd):
        j = wi + wd; return s.route[j] if 0 <= j < len(s.route) else -1
    def behind(s, me, wi, wd):
        w = s.route[wi]; f = s.wfront(wi, wd)
        fd = dir_of(w, f) if f >= 0 else dir_of(s.route[wi - wd], w)
        dm = dir_of(w, me)
        return fd[0] * dm[0] + fd[1] * dm[1] <= -0.9
    def step(s, st, nb):
        """her swipe toward nb: (state after, event) or None if nothing happens; ('dead', why) if she dies"""
        me, stone, alive, v, wi, wd = st
        wn = s.wnode(wi); ev = ''
        if nb == s.lever:
            v ^= 1; ev = 'turn'
            sn = s.seen(stone, alive, v)
            if me in sn: return ('dead', 'struck')
            if wi >= 0 and wn in sn: wi = -1; ev += '+shatter'
        else:
            if nb == stone:
                c = cont(me, nb)
                if c < 0 or c == s.lever or s.face_on(c, alive) >= 0 or c == wn: return None
                if s.plinths and (c in s.plinth or c == RING): return None
                me, stone = nb, c; ev = 'push'
            else:
                fi = s.face_on(nb, alive)
                if fi >= 0:
                    if s.looknode(fi, v) == me: return ('dead', 'struck')
                    alive &= ~(1 << fi); me = nb; ev = 'break'
                elif wi >= 0 and nb == wn:
                    if s.wfront(wi, wd) == me: return ('dead', 'caught')
                    if not s.behind(me, wi, wd): return None
                    wi = -1; me = nb; ev = 'smash'
                else:
                    me = nb
            if me == RING: return ((me, stone, alive, v, wi, wd), ev + ('+' if ev else '') + 'won')
            if me in s.seen(stone, alive, v): return ('dead', 'struck')
        # the guardian's step
        if wi >= 0:
            j = wi + wd
            nx = s.route[j] if 0 <= j < len(s.route) else -1
            if nx < 0 or nx == stone or s.face_on(nx, alive) >= 0 or nx == s.lever:
                if 0 <= wi - wd < len(s.route): wd = -wd
            else:
                wi = j
                if nx == me: return ('dead', 'caught')
                if wi == 0 or wi == len(s.route) - 1: wd = -wd
                if nx in s.seen(stone, alive, v): wi = -1; ev += ('+' if ev else '') + 'shatter'
        return ((me, stone, alive, v, wi, wd), ev)


def solve(t, traps=True):
    s0 = t.init()
    if s0[0] in t.seen(s0[1], s0[2], s0[3]): return None
    dist = {s0: 0}; ways = {s0: 1}; prev = {s0: None}; q = deque([s0]); succ = {}; goals = []
    while q:
        st = q.popleft(); succ[st] = []
        if st[0] == RING: goals.append(st); continue
        cands = list(NB[st[0]])
        if t.lever >= 0 and t.lever in NB[st[0]] and t.lever not in cands: cands.append(t.lever)
        for nb in cands:
            if nb == t.lever and st[0] == t.lever: continue
            r = t.step(st, nb)
            if r is None or r[0] == 'dead': continue
            nst, ev = r
            if nst == st: continue
            succ[st].append(nst)
            if nst not in dist:
                dist[nst] = dist[st] + 1; ways[nst] = ways[st]; prev[nst] = (st, nb, ev); q.append(nst)
            elif dist[nst] == dist[st] + 1: ways[nst] += ways[st]
    if not goals: return None
    best = min(dist[g] for g in goals); nwy = sum(ways[g] for g in goals if dist[g] == best)
    g = min(g for g in goals if dist[g] == best)
    path = []; c = g
    while prev[c] is not None: st, nb, ev = prev[c]; path.append((NAMES[nb], ev)); c = st
    path.reverse()
    nt = 0
    if traps:
        can = set(goals); rev = {}
        for st, ns in succ.items():
            for n2 in ns: rev.setdefault(n2, []).append(st)
        stack = list(goals)
        while stack:
            c = stack.pop()
            for p_ in rev.get(c, []):
                if p_ not in can: can.add(p_); stack.append(p_)
        nt = sum(1 for x in dist if x not in can)
    return dict(len=best, ways=nwy, path=path, states=len(dist), traps=nt)


def candidate():
    inner = [n for n in NAMES if n not in ('S', 'R')]
    lever = rnd.choice(inner)
    faces = []
    for _ in range(2):
        n = rnd.choice([x for x in inner if x != lever and x not in [f for f, _, _ in faces]])
        i = IX[n]
        ds = [d for d in range(4) if GO[i][d] >= 0]
        if not ds: return None
        d0 = rnd.choice(ds)
        d1s = [d for d in ((d0 + 1) % 4, (d0 + 3) % 4) if GO[i][d] >= 0]
        if rnd.random() < 0.3 or not d1s: d1 = d0      # (a face the dial does not turn)
        else: d1 = rnd.choice(d1s)
        faces.append((n, d0, d1))
    if all(f[1] == f[2] for f in faces): return None
    free = [x for x in inner if x != lever and x not in [f for f, _, _ in faces]]
    stone = rnd.choice(free)
    # the guardian: three or four nodes in a straight level line
    lines = []
    for i in range(len(CELLS)):
        for d in range(4):
            r_ = [i]; k = i
            for _ in range(3):
                k = GO[k][d]
                if k < 0: break
                r_.append(k)
            if len(r_) >= 3: lines.append(r_[:rnd.choice((3, 4)) if len(r_) >= 4 else 3])
    rt = rnd.choice(lines)
    rt = [NAMES[k] for k in rt]
    if any(n in (lever, stone, 'S', 'R') or n in [f for f, _, _ in faces] for n in rt): return None
    return (faces, lever, stone, rt)


def judge(spec):
    faces, lever, stone, rt = spec
    t = Trial(faces, lever, stone, rt)
    sol = solve(t, traps=False)
    if not sol or not (MIN <= sol['len'] <= MAX) or sol['ways'] != 1: return None
    evs = [e for _, e in sol['path']]
    if not any('turn' in e for e in evs) or not any('push' in e for e in evs) or not any('shatter' in e for e in evs): return None
    sol = solve(t)
    if sol['traps']: return None
    for k in range(len(faces)):      # (every face needed)
        s2 = solve(Trial([f for i, f in enumerate(faces) if i != k], lever, stone, rt), traps=False)
        if s2 is not None and s2['len'] >= sol['len'] - 1: return None
    s3 = solve(Trial(faces, None, stone, rt), traps=False)
    if s3 is not None and s3['len'] >= sol['len'] - 1: return None      # (the dial needed)
    seen_n = len({n for n, _ in sol['path']})
    score = sol['len'] * 0.5 + seen_n * 0.6 + 2 * sum('push' in e for e in evs) + 2 * sum('turn' in e for e in evs) + 3 * sum('break' in e for e in evs)
    return dict(score=score, sol=sol, spec=spec)


if __name__ == '__main__':
    found = []; tried = set()
    for k in range(TRIES):
        sp = candidate()
        if sp is None: continue
        key = json.dumps(sp)
        if key in tried: continue
        tried.add(key)
        j = judge(sp)
        if j: found.append(j)
    found.sort(key=lambda j: -j['score'])
    print('found', len(found), 'of', len(tried))
    for j in found[:6]:
        faces, lever, stone, rt = j['spec']
        print('\n=== score %.1f  len %d  states %d' % (j['score'], j['sol']['len'], j['sol']['states']))
        print('faces', [(f, 'ESWN'[d0], 'ESWN'[d1]) for f, d0, d1 in faces], 'dial', lever, 'stone', stone, 'guardian', rt)
        print(' '.join('%s%s' % (n, '(' + e + ')' if e else '') for n, e in j['sol']['path']))
    if '--write' in sys.argv and found:
        here = os.path.dirname(os.path.abspath(__file__))
        json.dump([j['spec'] for j in found[:10]], open(os.path.join(here, 'moon_candidates.json'), 'w'), indent=1)
