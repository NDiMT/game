# Eidolon: two worlds, one push — the rules as the game plays them (the solver and the level checker).
# A court seen from the front, cut across by a channel (row c). Far side (z < c): the eidolon court; near side: the court.
# Map: ' ' sea (no floor), '.' floor, '#' a column, '*' a ring, '@' Ione, 'A'.. stones (near side), 'a'.. their images,
#      '~' channel water, '=' a stepping slab in the channel. The gate rises from the water at (W//2, c) once every ring
#      is filled (a stone on each near ring, an image on each far ring); she walks into it.
# Pushing: she pushes what stands on her side. Its twin moves mirrored (z flipped) if its way is free on its side, else
# stays. A stone (or image) may go into the channel only where its twin arrives at the same moment: they become a slab.
from collections import deque
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
class MW:
    def __init__(self, rows, cross=True, slip=True, merge=True):
        self.rows = rows; self.H = len(rows); self.W = max(len(r) for r in rows)
        rows = [r.ljust(self.W) for r in rows]
        self.c = next(z for z, r in enumerate(rows) if set(r.strip()) <= set('~=') and r.strip())
        self.floor = set(); self.rings = set(); self.chan = set(); self.cols = set(); stones = set(); bodies = {}; images = {}
        self.ione = None
        for z, r in enumerate(rows):
            for x, ch in enumerate(r):
                p = (x, z)
                if z == self.c:
                    if ch in '~=': self.chan.add(p)
                    if ch == '=': stones.add(p)
                    continue
                if ch == ' ': continue
                if ch == '#': self.cols.add(p); continue
                self.floor.add(p)
                if ch == '*': self.rings.add(p)
                elif ch == '@': self.ione = p
                elif ch.isupper(): bodies[ch] = p
                elif ch.islower(): images[ch.upper()] = p
        self.gate = (self.W // 2, self.c)
        keys = sorted(set(bodies) | set(images))
        self.pairs0 = tuple(sorted(((bodies.get(k), images.get(k)) for k in keys), key=self.key))
        self.stones0 = frozenset(stones); self.cross = cross; self.slip = slip; self.merge = merge
    @staticmethod
    def key(pr): return (pr[0] or (-1, -1), pr[1] or (-1, -1))
    def side(self, p): return 0 if p[1] == self.c else (1 if p[1] > self.c else -1)
    def start(self): return (self.ione, self.pairs0, self.stones0)
    def full(self, pairs):
        occ = set(q for pr in pairs for q in pr if q)
        return self.rings <= occ
    def won(self, st): return st[0] == self.gate and self.full(st[1])
    def moves(self, st):
        ione, pairs, slabs = st
        objs = {}
        for k, (b, i) in enumerate(pairs):
            if b: objs[b] = (k, 0)
            if i: objs[i] = (k, 1)
        for d in DIRS:
            q = (ione[0] + d[0], ione[1] + d[1])
            if q == self.gate and self.full(pairs): yield d, (q, pairs, slabs), 'gate'; continue
            if q == self.gate: continue
            if q in self.chan:
                if q in slabs:
                    # (with crossing off she may stand on a slab but not step off it to the far side)
                    yield d, (q, pairs, slabs), None
                continue
            if q not in self.floor: continue
            if not self.cross and self.side(q) == -1: continue
            if q not in objs: yield d, (q, pairs, slabs), None; continue
            k, which = objs[q]
            if which != (0 if self.side(q) == 1 else 1): continue
            tw = pairs[k][1 - which]
            q2 = (q[0] + d[0], q[1] + d[1]); md = (d[0], -d[1])
            t2 = (tw[0] + md[0], tw[1] + md[1]) if tw else None
            def free(c, sd): return c in self.floor and self.side(c) == sd and c not in objs
            if q2 in self.chan:
                if not self.merge or q2 in slabs or q2 == self.gate or t2 != q2: continue
                np = [pr for j, pr in enumerate(pairs) if j != k]
                yield d, (q, tuple(sorted(np, key=self.key)), slabs | {q2}), 'merge'; continue
            if not free(q2, self.side(q)): continue
            nt = tw
            if tw:
                if free(t2, self.side(tw)): nt = t2
                elif not self.slip: continue
            np = list(pairs); np[k] = (q2, nt) if which == 0 else (nt, q2)
            yield d, (q, tuple(sorted(np, key=self.key)), slabs), ('push' if (nt != tw or not tw) else 'slip')
    def solve(self, limit=6_000_000):
        s0 = self.start(); prev = {s0: None}; dq = deque([s0])
        while dq:
            s = dq.popleft()
            if self.won(s):
                path = []
                while prev[s] is not None:
                    ps, d, kind = prev[s]; path.append((d, kind, s)); s = ps
                return path[::-1], len(prev)
            for d, ns, kind in self.moves(s):
                if ns not in prev:
                    prev[ns] = (s, d, kind); dq.append(ns)
                    if len(prev) > limit: return None, len(prev)
        return None, len(prev)
    def explore(self, limit=6_000_000):
        s0 = self.start(); depth = {s0: 0}; dq = deque([s0])
        while dq:
            s = dq.popleft()
            for d, ns, kind in self.moves(s):
                if kind == 'gate': continue
                if ns not in depth:
                    depth[ns] = depth[s] + 1; dq.append(ns)
                    if len(depth) > limit: return None
        return depth

def show(L, st=None):
    ione, pairs, slabs = st or L.start()
    occ = {}
    for b, i in pairs:
        if b: occ[b] = 'B'
        if i: occ[i] = 'b'
    out = []
    for z in range(L.H):
        line = ''
        for x in range(L.W):
            p = (x, z); c = ' '
            if p in L.chan: c = '=' if p in slabs else ('G' if p == L.gate else '~')
            elif p in L.cols: c = '#'
            elif p in L.floor:
                c = '.'
                if p in L.rings: c = '*'
                if p in occ: c = occ[p] if p not in L.rings else {'B': '8', 'b': '6'}[occ[p]]
            if p == ione: c = '@'
            line += c + ' '
        out.append(line.rstrip())
    print('\n'.join(out))

def taps(L, path):
    """the solution as the cells she is sent to (one per step)"""
    s = L.start(); out = []
    for d, kind, ns in path:
        out.append([ns[0][0], ns[0][1]])
    return out

if __name__ == '__main__':
    import sys, json
    lv = json.load(open(sys.argv[1]))
    for k, rows in enumerate(lv):
        L = MW(rows); path, n = L.solve()
        print('level', k + 1, 'moves', len(path) if path else None, 'states', n)
