"""A second trial for the ivory level of Eidolon GO, all new: "The Mirror". Lara Croft GO rules, adapted:

  - Ione moves one edge per swipe; then the walking statue takes one step.
  - A face looks along a line: the node before it, and on straight along level ways until something stands in the
    way (the stone, the mirror, another face, the statue, the floor's end). Whoever stands first in that line is
    struck: Ione (the trial begins again) or the walking statue (it breaks).
  - Stepped on from anywhere but the node it looks at first, a face falls and breaks.
  - The bronze mirror is pushed as the stone is. A face whose look reaches the mirror sees itself, and breaks
    ("none of them was hers").
  - The stone is pushed one node straight on along a level way; it stops a face's look: behind it is shade.
  - The walking statue paces its route; caught from its front, broken from behind; stone, mirror and faces turn it.

The generator lays these on the level's floors (goiv/trace.json), proves every candidate by a breadth-first search
over the whole state, and keeps the best: a shortest way of 16-32 swipes, the only one of its length, no state from
which the ring cannot be reached, and every thing needed (without the mirror, no way at all).

usage: python3 -I tools/ivory/puzzle2_design.py [tries] [seed]     (writes goiv/puzzle2.json)
"""
import json, math, os, random, sys
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
T = json.load(open(os.path.join(ROOT, 'goiv', 'trace.json')))
FL = T['floors']; H = {k: v['h'] for k, v in FL.items()}
TRIES = int(sys.argv[1]) if len(sys.argv) > 1 else 40000
MINLEN = int(sys.argv[3]) if len(sys.argv) > 3 else 15
rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 3)

# ------------------------------------------------------------------ the way: a grid on each floor, the flights between
G = 0.75
NODES = {'a0': ('T0', 1.2, 4.95), 'a1': ('T0', 0.175, 4.95), 'a2': ('T0', 0.175, 4.2), 'a3': ('T0', 0.175, 3.45 + 0.25)}
NODES.pop('a3')
for i, x in enumerate((-0.575, 0.175, 0.925, 1.675)):
    for j, z in enumerate((1.45, 0.7, -0.05)): NODES['t%d%d' % (i, j)] = ('T1', x, z)
for i, x in enumerate((0.175, 0.925, 1.675)):
    for j, z in enumerate((-1.97, -2.72)): NODES['l%d%d' % (i, j)] = ('L', x, z)
for i, x in enumerate((-2.35, -3.1)):
    for j, z in enumerate((-1.97, -2.67)): NODES['u%d%d' % (i, j)] = ('T2', x, z)
NODES['ring'] = ('T3', -3.1, -4.95)
POS = {n: (x, H[f], z) for n, (f, x, z) in NODES.items()}
FLIGHTS = {tuple(sorted((T['flights'][k][0][1], T['flights'][k][1][1]))): T['flights'][k] for k in range(len(T['flights']))}
def fl(lo, hi): return FLIGHTS[(lo, hi)]
EDGES = []
def flat(a, b): EDGES.append((a, b, None))
for n, (f, x, z) in NODES.items():      # grid neighbours on one floor
    for m, (f2, x2, z2) in NODES.items():
        if n < m and f == f2 and abs(math.hypot(x - x2, z - z2) - G) < 0.08 and (abs(x - x2) < 0.01 or abs(z - z2) < 0.01): flat(n, m)
flat('a0', 'a1')
EDGES += [('a2', 't10', fl(-1.25, 0.0)), ('t12', 'l00', fl(0.0, 0.7)), ('l00', 'u00', fl(0.7, 1.48)), ('u11', 'ring', fl(1.48, 2.13))]
START, EXIT = 'a0', 'ring'
NAMES = list(NODES); IX = {n: i for i, n in enumerate(NAMES)}
ADJ = [[] for _ in NAMES]; FLAT = {}
for a, b, f in EDGES:
    i, j = IX[a], IX[b]; ADJ[i].append(j); ADJ[j].append(i); FLAT[(i, j)] = FLAT[(j, i)] = f is None
def _dir(a, b):
    dx, dz = POS[NAMES[b]][0] - POS[NAMES[a]][0], POS[NAMES[b]][2] - POS[NAMES[a]][2]; L = math.hypot(dx, dz) or 1.0
    return (dx / L, dz / L)
CONT = {}
for k in range(len(NAMES)):
    for a in ADJ[k]:
        if not FLAT[(a, k)]: continue
        d = _dir(a, k)
        for c in ADJ[k]:
            if c != a and FLAT[(k, c)] and d[0] * _dir(k, c)[0] + d[1] * _dir(k, c)[1] >= 0.9: CONT[(a, k)] = c

# ------------------------------------------------------------------ the rules
class Trial:
    def __init__(s, stone, mirror, faces, route):
        s.stone0 = IX[stone] if stone else -1; s.mirror0 = IX[mirror] if mirror else -1
        s.faces = [(IX[n], IX[f]) for n, f in faces]      # (node, the node it looks at first)
        s.route = [IX[n] for n in route] if route else None
        s.start, s.exit = IX[START], IX[EXIT]
    def init(s): return (s.start, s.stone0, s.mirror0, (1 << len(s.faces)) - 1, 0 if s.route else -1, 1)
    def wnode(s, wi): return s.route[wi] if wi >= 0 else -1
    def wfront(s, wi, wd):
        j = wi + wd
        return s.route[j] if 0 <= j < len(s.route) else -1
    def wbehind(s, me, wi, wd):
        w = s.route[wi]; f = s.wfront(wi, wd)
        fd = _dir(w, f) if f >= 0 else _dir(s.route[wi - wd], w)
        d = _dir(w, me)
        return fd[0] * d[0] + fd[1] * d[1] <= -0.9
    def face_on(s, n, fm):
        for i, (fn, ff) in enumerate(s.faces):
            if fm >> i & 1 and fn == n: return i
        return -1
    def looks(s, me, stone, mirror, fm, wn):
        """every face's look, all at once: who is struck. Returns (Ione struck, faces broken by the mirror, statue struck)"""
        hit_me = False; broken = 0; hit_w = False
        for i, (fn, ff) in enumerate(s.faces):
            if not fm >> i & 1: continue
            prev, nxt = fn, ff
            while nxt >= 0:
                if nxt == stone: break
                if nxt == mirror: broken |= 1 << i; break
                if s.face_on(nxt, fm) >= 0: break
                if nxt == wn: hit_w = True; break
                if nxt == me: hit_me = True; break
                c = CONT.get((prev, nxt), -1); prev, nxt = nxt, c
        return hit_me, broken, hit_w
    def settle(s, me, stone, mirror, fm, wi):
        """the looks, until nothing more changes (a face broken may free another's look). None: Ione struck"""
        while True:
            hm, br, hw = s.looks(me, stone, mirror, fm, s.wnode(wi))
            if hm: return None
            nfm = fm & ~br; nwi = -1 if hw else wi
            if nfm == fm and nwi == wi: return fm, wi
            fm, wi = nfm, nwi
    def step(s, st, nb):
        me, stone, mirror, fm, wi, wd = st
        wn = s.wnode(wi)
        if nb == stone or nb == mirror:      # pushed on, straight, along a level way, to a free node
            if not FLAT[(me, nb)]: return None
            c = CONT.get((me, nb), -1)
            if c < 0 or c in (stone, mirror, wn, s.exit) or s.face_on(c, fm) >= 0: return None
            if nb == stone: stone = c
            else: mirror = c
        else:
            fi = s.face_on(nb, fm)
            if fi >= 0:
                if s.faces[fi][1] == me: return 'dead'
                fm &= ~(1 << fi)
            elif nb == wn:
                if s.wfront(wi, wd) == me: return 'dead'
                if not s.wbehind(me, wi, wd): return None
                wi = -1; wn = -1
        me = nb
        r = s.settle(me, stone, mirror, fm, wi)
        if r is None: return 'dead'
        fm, wi = r
        if me == s.exit: return 'win'
        if wi >= 0:      # the statue's step
            j = wi + wd; nx = s.route[j] if 0 <= j < len(s.route) else -1
            if nx < 0 or nx in (stone, mirror) or s.face_on(nx, fm) >= 0:
                if 0 <= wi - wd < len(s.route): wd = -wd
            else:
                wi = j
                if nx == me: return 'dead'
                if wi == 0 or wi == len(s.route) - 1: wd = -wd
                r = s.settle(me, stone, mirror, fm, wi)
                if r is None: return 'dead'
                fm, wi = r
        return (me, stone, mirror, fm, wi, wd)
    def solve(s, need_path=False):
        st0 = s.init()
        if s.settle(st0[0], st0[1], st0[2], st0[3], st0[4]) != (st0[3], st0[4]): return None      # (a start already struck or changing)
        succ = {}; q = deque([st0]); seen = {st0}; win_from = set()
        while q:
            x = q.popleft(); succ[x] = []
            for nb in ADJ[x[0]]:
                r = s.step(x, nb)
                if r is None or r == 'dead': continue
                succ[x].append((nb, r))
                if r == 'win': win_from.add(x)
                elif r not in seen: seen.add(r); q.append(r)
            if len(succ) > 60000: return None
        if not win_from: return {'states': len(succ), 'length': None}
        rev = {}
        for x, lst in succ.items():
            for nb, r in lst:
                if r != 'win': rev.setdefault(r, []).append(x)
        togo = {x: 1 for x in win_from}; q = deque(win_from)
        while q:
            x = q.popleft()
            for p in rev.get(x, ()):
                if p not in togo: togo[p] = togo[x] + 1; q.append(p)
        res = {'states': len(succ), 'length': togo.get(st0), 'stuck': sum(1 for x in succ if x not in togo)}
        if st0 not in togo: return res
        ways = {}
        def count(x):
            if x in ways: return ways[x]
            n = 0
            for nb, r in succ[x]:
                if r == 'win' and togo[x] == 1: n += 1
                elif r != 'win' and togo.get(r) == togo[x] - 1: n += count(r)
            ways[x] = min(n, 99); return ways[x]
        sys.setrecursionlimit(100000)
        res['ways'] = count(st0)
        if need_path:
            path, trace, x = [], [], st0
            while True:
                for nb, r in succ[x]:
                    if r == 'win' and togo[x] == 1: path.append(NAMES[nb]); x = None; break
                    if r != 'win' and togo.get(r) == togo[x] - 1: path.append(NAMES[nb]); trace.append(s.describe(r)); x = r; break
                if x is None: break
            res['solution'] = path; res['trace'] = trace
        return res
    def describe(s, x):
        me, stone, mirror, fm, wi, wd = x
        return {'ione': NAMES[me], 'stone': NAMES[stone] if stone >= 0 else None, 'mirror': NAMES[mirror] if mirror >= 0 else None,
                'faces': [NAMES[fn] + '>' + NAMES[ff] for i, (fn, ff) in enumerate(s.faces) if fm >> i & 1],
                'statue': (NAMES[s.route[wi]] + '>' + (NAMES[s.wfront(wi, wd)] if s.wfront(wi, wd) >= 0 else '-')) if wi >= 0 else 'broken'}

# ------------------------------------------------------------------ the search for a good trial
WALK = [n for n in NAMES if n not in (START, EXIT)]
FLATNB = {n: [NAMES[j] for j in ADJ[IX[n]] if FLAT[(IX[n], j)]] for n in NAMES}
def random_trial():
    used = set([START, EXIT, 'a1', 'a2', 't10'])      # (the start and the way up from it kept clear)
    def pick(pool):
        c = [n for n in pool if n not in used]
        if not c: return None
        n = rnd.choice(c); used.add(n); return n
    t1 = [n for n in NAMES if NODES[n][0] == 'T1']
    stone = pick(t1); mirror = pick(t1)
    faces = []
    for _ in range(rnd.choice((2, 3, 3, 4))):
        n = pick([m for m in WALK if NODES[m][0] == 'T1'] if rnd.random() < 0.8 else [m for m in WALK if NODES[m][0] in ('L', 'T2')])
        if n is None or not FLATNB[n]: continue
        faces.append((n, rnd.choice(FLATNB[n])))
    route = None
    if rnd.random() < 0.8:      # a statue pacing a straight run of two or three nodes on one floor
        a = rnd.choice([m for m in NAMES if NODES[m][0] == 'T1' and m not in used])
        nb = [m for m in FLATNB[a] if m not in used]
        if nb:
            b = rnd.choice(nb); r = [a, b]
            c = CONT.get((IX[a], IX[b]), -1)
            if c >= 0 and NAMES[c] not in used and rnd.random() < 0.6: r.append(NAMES[c])
            route = r; used.update(r)
    return {'stone': stone, 'mirror': mirror, 'faces': faces, 'route': route}

def evaluate(d):
    t = Trial(d['stone'], d['mirror'], d['faces'], d['route'])
    r = t.solve()
    if not r or r.get('length') is None or r.get('ways', 0) > 2: return None
    L = r['length']
    if not (MINLEN <= L <= 32): return None
    # every thing needed: without it, no way at all, or a way at least 3 swipes shorter
    abl = {}
    no_m = Trial(d['stone'], None, d['faces'], d['route']).solve()
    if no_m and no_m.get('length') is not None: return None      # (the mirror must be needed)
    abl['mirror'] = None
    for i in range(len(d['faces'])):
        f2 = d['faces'][:i] + d['faces'][i + 1:]
        a = Trial(d['stone'], d['mirror'], f2, d['route']).solve()
        if a is None or a.get('length') is None or a['length'] > L - 3: return None
        abl['face %s' % d['faces'][i][0]] = a['length']
    if d['route']:
        a = Trial(d['stone'], d['mirror'], d['faces'], None).solve()
        if a is None or a.get('length') is None or a['length'] > L - 2: return None
        abl['statue'] = a['length']
    if d['stone']:
        a = Trial(None, d['mirror'], d['faces'], d['route']).solve()
        if a is not None and a.get('length') is not None and a['length'] > L - 3: return None
        abl['stone'] = a['length'] if a else None
    return {'length': L, 'states': r['states'], 'ablation': abl, 'stuck': r.get('stuck', 0), 'ways': r.get('ways')}

def main():
    best = []
    for k in range(TRIES):
        d = random_trial()
        if d['stone'] is None or d['mirror'] is None or len(d['faces']) < 2: continue
        e = evaluate(d)
        if e:
            score = e['length'] + 3 * len(d['faces']) + (4 if d['route'] else 0) - 3 * (e.get('stuck', 0) > 0)
            best.append((score, d, e)); print('found', k, e['length'], d, e['ablation'], flush=True)
    best.sort(key=lambda x: -x[0])
    if not best: print('none found'); return
    score, d, e = best[0]
    t = Trial(d['stone'], d['mirror'], d['faces'], d['route']); r = t.solve(need_path=True)
    print('\nchosen:', d, '\nlength', r['length'], 'states', r['states'], 'ablation', e['ablation'])
    for i, (n, s) in enumerate(zip(r['solution'], r['trace'] + ['the ring'])): print('%3d %-5s %s' % (i + 1, n, json.dumps(s) if isinstance(s, dict) else s))
    out = {'nodes': {n: list(POS[n]) for n in NAMES},
           'edges': [[a, b, [list(f[0]), list(f[1])] if f else []] for a, b, f in EDGES],
           'start': START, 'exit': EXIT, 'stone': d['stone'], 'mirror': d['mirror'],
           'faces': [{'node': n, 'looks': f} for n, f in d['faces']], 'statue': {'route': d['route']} if d['route'] else None,
           'intro': [list(fl(-2.3, -1.25)[0]), list(fl(-2.3, -1.25)[1])], 'solution': r['solution'], 'solution_trace': r['trace'],
           'ablation': e['ablation'], 'rules': __doc__.split('\n\n')[0],
           'lines': ["One of his faces saw itself in the bronze.", "It knew at once it was not hers."]}
    with open(os.path.join(ROOT, 'goiv', 'puzzle2.json'), 'w') as f: json.dump(out, f, indent=1)
    print('written goiv/puzzle2.json')

if __name__ == '__main__': main()
