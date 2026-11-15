"""The first trial of Eidolon GO, all new, on a board of its own: "The Gaze". Rules, as the game will play them:

  - Ione moves one node per swipe, along a path.
  - A carved face looks one way along the paths: node after node, straight on, until the stone or another face
    stands in the way. Whoever ends a step where a face looks is turned to stone: the trial begins again.
  - Walk into a face (from beside it or behind it: before it is death) and it falls and breaks.
  - The stone is pushed one node straight on along a path, if the node beyond is free (never onto the ring, nor up onto
    a face's plinth, standing or broken). It stops a look: behind it is shade. (Faces stop looks too: break one and the
    face behind it may see further.)
  - Reach the ring of light.

The generator lays boards on a small grid, proves each by a breadth-first search over the whole state (where she
is, where the stone is, which faces stand) and keeps the best: a shortest way of MIN..MAX swipes and the only one of
that length, no state from which the ring cannot be reached (no dead end but death), every thing needed (without the
stone no way at all; without either face a shorter way), the stone pushed at least twice, a face broken on the way.

usage: python3 -I tools/go/first_trial.py [tries] [seed] [min] [max]      (prints the best boards; --write N saves N)
"""
import json, os, random, sys
from collections import deque

a = [x for x in sys.argv[1:] if not x.startswith('--')]
TRIES = int(a[0]) if len(a) > 0 else 60000
rnd = random.Random(int(a[1]) if len(a) > 1 else 1)
MIN = int(a[2]) if len(a) > 2 else 11
MAX = int(a[3]) if len(a) > 3 else 17
W, H = 5, 5
DIRS = {'E': (1, 0), 'W': (-1, 0), 'N': (0, 1), 'S': (0, -1)}


def board():
    """a few rooms and ways on the grid: a tree grown from a cell, and a loop or two closed"""
    cells = [(x, y) for x in range(W) for y in range(H)]
    n = rnd.randint(12, 17)
    seed = rnd.choice(cells); have = {seed}; edges = set()
    while len(have) < n:
        c = rnd.choice(sorted(have))
        d = rnd.choice(list(DIRS.values())); q = (c[0] + d[0], c[1] + d[1])
        if q in have or not (0 <= q[0] < W and 0 <= q[1] < H): continue
        if deg(edges, c) >= 3: continue
        have.add(q); edges.add(tuple(sorted((c, q))))
    for _ in range(rnd.randint(1, 3)):      # (loops: a way round, so there is a choice of way)
        c = rnd.choice(sorted(have)); d = rnd.choice(list(DIRS.values())); q = (c[0] + d[0], c[1] + d[1])
        e = tuple(sorted((c, q)))
        if q in have and e not in edges and deg(edges, c) < 3 and deg(edges, q) < 3: edges.add(e)
    return sorted(have), edges


def deg(edges, c): return sum(1 for e in edges if c in e)


class Trial:
    def __init__(s, nodes, edges, start, ring, stone, faces):
        s.nodes = nodes; s.ix = {c: i for i, c in enumerate(nodes)}; s.edges = edges
        s.nb = [[] for _ in nodes]
        for (p, q) in edges: s.nb[s.ix[p]].append(s.ix[q]); s.nb[s.ix[q]].append(s.ix[p])
        s.start, s.ring = s.ix[start], s.ix[ring]
        s.stone0 = s.ix[stone] if stone is not None else -1
        s.faces = [(s.ix[c], DIRS[d]) for (c, d) in faces]
    def step_to(s, i, d):      # the node one step from i the way d, if a path goes there
        c = s.nodes[i]; q = (c[0] + d[0], c[1] + d[1])
        j = s.ix.get(q)
        return j if (j is not None and tuple(sorted((c, q))) in s.edges) else -1
    def watched(s, stone, alive):
        w = set()
        blocks = {stone} | {f for k, (f, d) in enumerate(s.faces) if alive >> k & 1}
        for k, (f, d) in enumerate(s.faces):
            if not alive >> k & 1: continue
            j = s.step_to(f, d)
            while j >= 0 and j not in blocks:
                w.add(j); j = s.step_to(j, d)
        return w
    def init(s): return (s.start, s.stone0, (1 << len(s.faces)) - 1)
    def moves(s, st):
        me, stone, alive = st
        for d in DIRS.values():
            j = s.step_to(me, d)
            if j < 0: continue
            ns, na = stone, alive
            if j == stone:
                t = s.step_to(j, d)
                if t < 0 or t == s.ring or any(f == t for (f, _) in s.faces): continue      # (never onto a plinth: a face's, standing or broken)
                ns = t
            for k, (f, fd) in enumerate(s.faces):
                if alive >> k & 1 and f == j:
                    na &= ~(1 << k)      # (walked into: it breaks; before it she could not have stood)
            nst = (j, ns, na)
            dead = j in s.watched(ns, na)
            yield (d, nst, dead)


def solve(t):
    s0 = t.init()
    if s0[0] in t.watched(s0[1], s0[2]): return None
    dist = {s0: 0}; ways = {s0: 1}; prev = {s0: None}; order = [s0]; q = deque([s0]); goal = None
    succ = {}
    while q:
        st = q.popleft(); succ[st] = []
        if st[0] == t.ring: continue
        for d, nst, dead in t.moves(st):
            if dead: continue
            succ[st].append(nst)
            if nst not in dist:
                dist[nst] = dist[st] + 1; ways[nst] = ways[st]; prev[nst] = st; q.append(nst); order.append(nst)
            elif dist[nst] == dist[st] + 1: ways[nst] += ways[st]
    goals = [s for s in dist if s[0] == t.ring]
    if not goals: return None
    best = min(dist[g] for g in goals)
    n_best = sum(ways[g] for g in goals if dist[g] == best)
    g = min((g for g in goals if dist[g] == best), key=lambda g: g)
    path = []; c = g
    while c is not None: path.append(c); c = prev[c]
    path.reverse()
    # dead ends: a live state from which the ring cannot be reached
    can = {s for s in goals}; changed = True
    rev = {}
    for st, ns in succ.items():
        for n2 in ns: rev.setdefault(n2, []).append(st)
    stack = list(goals)
    while stack:
        c = stack.pop()
        for p in rev.get(c, []):
            if p not in can: can.add(p); stack.append(p)
    traps = sum(1 for s in dist if s not in can)
    return dict(len=best, ways=n_best, path=path, states=len(dist), traps=traps)


def describe(t, sol):
    """the moves of the solution as compass steps, with what happened (push, break)"""
    out = []
    for a_, b_ in zip(sol['path'], sol['path'][1:]):
        c0, c1 = t.nodes[a_[0]], t.nodes[b_[0]]
        d = [k for k, v in DIRS.items() if v == (c1[0] - c0[0], c1[1] - c0[1])][0]
        tag = d
        if b_[1] != a_[1]: tag += '(push)'
        if b_[2] != a_[2]: tag += '(break)'
        out.append(tag)
    return out


def draw(t, extra=''):
    """the board in letters: o a node, S start, R ring, # stone, faces as their way of looking (> < ^ v)"""
    g = [[' '] * (W * 4 - 3) for _ in range(H * 2 - 1)]
    sym = {}
    for c in t.nodes: sym[c] = 'o'
    sym[t.nodes[t.start]] = 'S'; sym[t.nodes[t.ring]] = 'R'
    if t.stone0 >= 0: sym[t.nodes[t.stone0]] = '#'
    arrow = {(1, 0): '>', (-1, 0): '<', (0, 1): '^', (0, -1): 'v'}
    for (f, d) in t.faces: sym[t.nodes[f]] = arrow[d]
    for (p, q) in t.edges:
        if p[1] == q[1]:
            y = (H - 1 - p[1]) * 2; x = min(p[0], q[0]) * 4
            g[y][x + 1] = g[y][x + 2] = g[y][x + 3] = '-'
        else:
            y = (H - 1 - max(p[1], q[1])) * 2 + 1; g[y][p[0] * 4] = '|'
    for c, ch in sym.items(): g[(H - 1 - c[1]) * 2][c[0] * 4] = ch
    w = t.watched(t.stone0, (1 << len(t.faces)) - 1)
    for j in w:
        c = t.nodes[j]
        if sym.get(c) == 'o': g[(H - 1 - c[1]) * 2][c[0] * 4] = '*'
    return '\n'.join(''.join(r).rstrip() for r in g)


def candidate():
    """a board, and on it: the start at an end of a way, the ring far off, a face looking across the bare way to the
    ring, a second face looking across that way or across the ways to the first face's sides, the stone near a look"""
    nodes, edges = board()
    nodes_set = set(nodes)
    deg1 = [c for c in nodes if deg(edges, c) == 1]
    start = rnd.choice(deg1 or nodes)
    t0 = Trial(nodes, edges, start, start, None, [])
    dist = {t0.ix[start]: 0}; prv = {t0.ix[start]: None}; q = deque([t0.ix[start]])
    while q:
        i = q.popleft()
        for j in t0.nb[i]:
            if j not in dist: dist[j] = dist[i] + 1; prv[j] = i; q.append(j)
    far = [nodes[i] for i, d in dist.items() if d >= 6]
    if not far: return None
    ring = rnd.choice(far)
    way = []; c = t0.ix[ring]
    while c is not None: way.append(c); c = prv[c]
    way_set = set(way)
    def look(i, d):      # (the bare look of a face at i, the way d)
        out = []; j = t0.step_to(i, DIRS[d])
        while j >= 0: out.append(j); j = t0.step_to(j, DIRS[d])
        return out
    faces = []; taken = {t0.ix[start], t0.ix[ring]}
    for k in range(2):
        opts = []
        for i in range(len(nodes)):
            if i in taken or i in way_set: continue
            for d in DIRS:
                lk = look(i, d)
                if not lk or t0.ix[start] in lk: continue
                if k == 0 and any(j in way_set for j in lk): opts.append((i, d))
                if k == 1:
                    f1 = faces[0][0]
                    sides = [j for j in t0.nb[f1] if j not in look(f1, faces[0][1])]
                    if any(j in way_set or j in sides for j in lk): opts.append((i, d))
        if not opts: return None
        i, d = rnd.choice(opts); faces.append((i, d)); taken.add(i)
    looked = set()
    for (i, d) in faces: looked |= set(look(i, d))
    near = [i for i in range(len(nodes)) if i not in taken and i not in looked and any(j in looked for j in t0.nb[i])]
    if not near: return None
    stone = rnd.choice(near)
    spec = (nodes, edges, start, ring, nodes[stone], [(nodes[i], d) for (i, d) in faces])
    return Trial(*spec), spec


def judge(t, spec):
    sol = solve(t)
    if not sol or not (MIN <= sol['len'] <= MAX) or sol['ways'] != 1 or sol['traps'] > 0: return None
    nodes, edges, start, ring, stone, faces = spec
    if solve(Trial(nodes, edges, start, ring, None, faces)) is not None: return None      # (the stone is needed)
    for k in range(len(faces)):      # (each face is in the way)
        s2 = solve(Trial(nodes, edges, start, ring, stone, [f for i, f in enumerate(faces) if i != k]))
        if s2 is not None and s2['len'] >= sol['len'] - 1: return None
    mv = describe(t, sol)
    pushes = sum('push' in m for m in mv); breaks = sum('break' in m for m in mv)
    if pushes < 1 or breaks < 1: return None
    seen = len({st[0] for st in sol['path']})
    score = sol['len'] + 2 * pushes + 3 * breaks + seen * 0.5 - len(nodes) * 0.3 + len(t.watched(t.stone0, 3)) * 0.8
    return dict(score=score, sol=sol, moves=mv, pushes=pushes, breaks=breaks, seen=seen)


# ------------------------------------------------------------------ boards laid by hand, proven by the same search
def edges_of(pairs):
    return {tuple(sorted((tuple(p), tuple(q)))) for p, q in pairs}


def evaluate(name, nodes, pairs, start, ring, stone, faces, show=True):
    global W, H
    xs = [c[0] for c in nodes]; ys = [c[1] for c in nodes]
    ox, oy = min(xs), min(ys)
    sh = lambda c: (c[0] - ox, c[1] - oy)
    nodes = [sh(c) for c in nodes]; pairs = [(sh(p), sh(q)) for p, q in pairs]
    start, ring = sh(start), sh(ring); stone = sh(stone) if stone else None; faces = [(sh(c), d) for c, d in faces]
    W, H = max(c[0] for c in nodes) + 1, max(c[1] for c in nodes) + 1
    e = edges_of(pairs)
    t = Trial(sorted(nodes), e, start, ring, stone, faces)
    sol = solve(t)
    print('\n######', name)
    print(draw(t))
    if not sol: print('NO WAY'); return None
    mv = describe(t, sol)
    print('shortest %d swipes, %d way(s) of that length, %d states, %d dead ends' % (sol['len'], sol['ways'], sol['states'], sol['traps']))
    print(' '.join(mv))
    s2 = solve(Trial(sorted(nodes), e, start, ring, None, faces))
    print('without the stone:', 'no way' if s2 is None else '%d swipes' % s2['len'])
    for k in range(len(faces)):
        s3 = solve(Trial(sorted(nodes), e, start, ring, stone, [f for i, f in enumerate(faces) if i != k]))
        print('without face %d:' % k, 'no way' if s3 is None else '%d swipes' % s3['len'])
    return t, sol


HAND = {
    # The Shield: a face at the head of a level way looks down it; the stone is pushed into the way, she goes round to
    # come up behind it, and walks up the way in its shade, pushing it before her to the face; then round to its side.
    'shield': dict(
        nodes=[(0, 0), (1, 0), (2, 0), (0, -1), (1, -1), (2, -1), (2, 1), (2, 2), (2, 3), (2, 4), (1, 2), (0, 2), (0, 3), (0, 4), (1, 4), (2, 5)],
        pairs=[((0, 0), (1, 0)), ((1, 0), (2, 0)), ((0, 0), (0, -1)), ((0, -1), (1, -1)), ((1, -1), (2, -1)), ((2, -1), (2, 0)),
               ((2, 0), (2, 1)), ((2, 1), (2, 2)), ((2, 2), (2, 3)), ((2, 3), (2, 4)), ((2, 2), (1, 2)), ((1, 2), (0, 2)), ((0, 2), (0, 3)),
               ((0, 3), (0, 4)), ((0, 4), (1, 4)), ((1, 4), (2, 4)), ((2, 4), (2, 5))],
        start=(0, 0), ring=(2, 5), stone=(1, 0), faces=[((2, 4), 'S')]),
}

if '--hand' in sys.argv:
    for nm, d in HAND.items():
        if len(a) > 0 and a[0] in HAND and a[0] != nm: continue
        evaluate(nm, **d)
    sys.exit(0)


if __name__ == '__main__':
    found = []
    for k in range(TRIES):
        c = candidate()
        if not c: continue
        t, spec = c
        j = judge(t, spec)
        if j: found.append((j['score'], k, t, spec, j))
    found.sort(key=lambda f: -f[0])
    print('found', len(found))
    nw = int(sys.argv[sys.argv.index('--write') + 1]) if '--write' in sys.argv else 0
    keep = []
    for sc, k, t, spec, j in found[:8]:
        print('\n=== score %.1f  len %d  pushes %d  breaks %d  nodes %d  seen %d  states %d' % (sc, j['sol']['len'], j['pushes'], j['breaks'], len(t.nodes), j['seen'], j['sol']['states']))
        print(draw(t)); print(' '.join(j['moves']))
        nodes, edges, start, ring, stone, faces = spec
        keep.append(dict(nodes=nodes, edges=[list(e) for e in edges], start=start, ring=ring, stone=stone, faces=faces,
                         solution=j['moves'], len=j['sol']['len']))
    if nw:
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'first_candidates.json')
        json.dump(keep[:nw], open(out, 'w'), indent=1); print('wrote', out)
