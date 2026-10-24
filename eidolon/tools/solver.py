#!/usr/bin/env python3
"""EIDOLON level solver (design tool). Mirrors the rules in scripts/rules.gd exactly.

usage:  python3 tools/solver.py [levels_dir] [--path]

Rules (one swipe = one turn, direction d):
  1. The CUBE rolls one tile if the target is floor, free of bodies and not across a mirror panel.
  2. Each EIDOLON (in mirror order) receives d reflected across its own mirror (the component
     perpendicular to the mirror is negated) and steps one tile under the same test.
  3. Each COUNTER-MIRROR whose rail runs along d slides one line OPPOSITE to d, if the rail
     continues and the row/column of tiles it would sweep holds no body and no column (wall).
  4. Each Eidolon whose mirror slid is carried 2 more tiles in the mirror's slide direction,
     tile by tile, stopping at the first blocked tile (2*slide = how far its reflection moved).
  A swipe that changes nothing is not a move. Goal: cube on its glyph AND every Eidolon on its glyph.
"""
import json, os, sys
from collections import deque

DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
DNAME = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}


class Level:
    def __init__(self, data):
        self.data = data
        rows = data['map']
        self.h = len(rows)
        self.w = max(len(r) for r in rows)
        self.floor = set(); self.walls = set()
        self.cube = None; self.goal = None
        self.eid = {}; self.egoal = {}
        for z, row in enumerate(rows):
            for x, ch in enumerate(row):
                p = (x, z)
                if ch in '~ ':
                    continue
                if ch == '#':
                    self.walls.add(p); continue
                self.floor.add(p)
                if ch == 'P': self.cube = p
                elif ch == 'G': self.goal = p
                elif ch in 'AB': self.eid['AB'.index(ch)] = p
                elif ch in 'ab': self.egoal['ab'.index(ch)] = p
                elif ch in '*': self.goal = p; self.cube = p
        self.mirrors = data['mirrors']
        assert len(self.eid) == len(self.mirrors) == len(self.egoal), 'one Eidolon + glyph per mirror'
        self.start = (self.cube, tuple(self.eid[i] for i in range(len(self.mirrors))),
                      tuple(m['pos'] for m in self.mirrors))

    def passable(self, p):
        return p in self.floor

    def crosses(self, mpos, a, b):
        for i, m in enumerate(self.mirrors):
            k = 0 if m['axis'] == 'x' else 1
            if (a[k] < mpos[i]) != (b[k] < mpos[i]):
                return True
        return False

    def step(self, state, d):
        """returns (new_state, info) ; info = dict for degenerate checks"""
        cube, eids, mpos = state
        eids = list(eids); mpos = list(mpos)
        bodies = [cube] + eids
        info = {'cube': False, 'eid': [0] * len(eids), 'slid': [0] * len(mpos), 'blocked': False}

        def free(i, a, b):  # body i moves a->b
            if not self.passable(b): return False
            if self.crosses(mpos, a, b): return False
            for j, q in enumerate(bodies):
                if j != i and q == b: return False
            return True

        t = (cube[0] + d[0], cube[1] + d[1])
        if free(0, cube, t):
            cube = t; bodies[0] = t; info['cube'] = True
        for i, m in enumerate(self.mirrors):
            e = eids[i]
            dd = (-d[0], d[1]) if m['axis'] == 'x' else (d[0], -d[1])
            t = (e[0] + dd[0], e[1] + dd[1])
            if free(i + 1, e, t):
                eids[i] = t; bodies[i + 1] = t; info['eid'][i] += 1
        for i, m in enumerate(self.mirrors):
            if 'rail' not in m: continue
            k = 0 if m['axis'] == 'x' else 1
            if d[k] == 0: continue
            s = -d[k]
            np_ = mpos[i] + s
            lo, hi = m['rail']
            if np_ < lo or np_ > hi: continue
            swept = mpos[i] - 1 if s < 0 else mpos[i]
            blocked = any(q[k] == swept for q in bodies) or any(wq[k] == swept for wq in self.walls)
            if blocked: continue
            mpos[i] = np_; info['slid'][i] = s
        for i, m in enumerate(self.mirrors):
            s = info['slid'][i]
            if s == 0: continue
            k = 0 if m['axis'] == 'x' else 1
            v = (s, 0) if k == 0 else (0, s)
            for _ in range(2):
                e = eids[i]
                t = (e[0] + v[0], e[1] + v[1])
                if not free(i + 1, e, t): break
                eids[i] = t; bodies[i + 1] = t; info['eid'][i] += 1
        ns = (cube, tuple(eids), tuple(mpos))
        moved_any = info['cube'] or any(info['eid'])
        info['blocked'] = moved_any and (not info['cube'] or any(
            info['eid'][i] == 0 for i in range(len(eids))))
        return ns, info

    def won(self, state):
        cube, eids, _ = state
        return cube == self.goal and all(eids[i] == self.egoal[i] for i in range(len(eids)))

    def solve(self, limit=2_000_000):
        start = self.start
        if self.won(start): return 0, [], 1
        prev = {start: None}
        q = deque([start])
        while q:
            s = q.popleft()
            for d in DIRS:
                ns, info = self.step(s, d)
                if ns == s or ns in prev: continue
                prev[ns] = (s, d)
                if self.won(ns):
                    path = []
                    c = ns
                    while prev[c] is not None:
                        ps, dd = prev[c]; path.append(dd); c = ps
                    path.reverse()
                    return len(path), path, len(prev)
                q.append(ns)
                if len(prev) > limit: return None, None, len(prev)
        return None, None, len(prev)

    def count_optimal(self, par):
        """number of distinct optimal move sequences (capped)"""
        # BFS layers with counts
        from collections import defaultdict
        layer = {self.start: 1}
        seen = {self.start: 0}
        for depth in range(par):
            nxt = defaultdict(int)
            for s, c in layer.items():
                for d in DIRS:
                    ns, _ = self.step(s, d)
                    if ns == s: continue
                    if ns in seen and seen[ns] <= depth: continue
                    seen[ns] = depth + 1
                    nxt[ns] += c
            layer = nxt
        return sum(c for s, c in layer.items() if self.won(s))

    def analyse(self, path):
        s = self.start
        desync = 0; slides = 0
        for d in path:
            s, info = self.step(s, d)
            if info['blocked']: desync += 1
            slides += sum(1 for v in info['slid'] if v)
        return desync, slides


def load_levels(dirpath):
    out = []
    for fn in sorted(os.listdir(dirpath)):
        if fn.endswith('.json'):
            with open(os.path.join(dirpath, fn)) as f:
                out.append((fn, json.load(f)))
    return out


def report(dirpath, show_path=False):
    ok = True
    for idx, (fn, data) in enumerate(load_levels(dirpath), start=1):
        L = Level(data)
        par, path, states = L.solve()
        flags = []
        if par is None:
            flags.append('UNSOLVABLE'); ok = False
            print(f'{idx:2d} {fn:24s} UNSOLVABLE states={states}')
            continue
        desync, slides = L.analyse(path)
        nopt = L.count_optimal(par)
        has_rail = any('rail' in m for m in L.mirrors)
        if idx > 2 and par < 4: flags.append('TOO-EASY')
        if par == 0: flags.append('DEGENERATE:start-solved')
        if idx >= 3 and desync == 0: flags.append('DEGENERATE:no-desync')
        if has_rail and slides == 0: flags.append('DEGENERATE:mirror-never-slides')
        if data.get('par') not in (None, par): flags.append(f'PAR-MISMATCH(json {data.get("par")})')
        for i, m in enumerate(L.mirrors):
            k = 0 if m['axis'] == 'x' else 1
            refl = list(L.cube); refl[k] = 2 * m['pos'] - 1 - refl[k]
            if tuple(refl) != L.eid[i]: flags.append(f'EIDOLON-{i}-NOT-REFLECTION')
        sol = ''.join(DNAME[d] for d in path)
        print(f'{idx:2d} {fn:24s} par={par:2d} states={states:6d} optimal_solutions={nopt:4d} '
              f'desync_moves={desync} mirror_slides={slides} {" ".join(flags) or "ok"}'
              + (f'  {sol}' if show_path else ''))
        if any(f.startswith(('UNSOLVABLE', 'TOO', 'DEGEN', 'PAR', 'EIDOLON')) for f in flags): ok = False
        if '--write-par' in sys.argv:
            data['par'] = par; data['solution'] = sol
            with open(os.path.join(dirpath, fn), 'w') as f: f.write(json.dumps(data, indent=1) + '\n')
    return ok


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    d = args[0] if args else os.path.join(os.path.dirname(__file__), '..', 'levels')
    sys.exit(0 if report(d, '--path' in sys.argv) else 1)
