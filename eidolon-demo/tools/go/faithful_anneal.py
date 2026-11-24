"""Simulated annealing toward hard boards of The Faithful (24/11; one statue, the same rules as faithful_trial.py): a
board changes a cell, a piece or a channel at a time and is kept while it stays one way, with no limbo and the crack
needed, and scores better: the chase's length, dances (a step and its reverse), holds in more than one place, steps
away from the ring or toward the statue; a long walk after the statue has sunk counts against it.

usage: python3 -I tools/go/faithful_anneal.py <W> <H> <seed> <seconds> ['[rows, cuts]' to start from]
       (prints the best and writes ann_<W><H>_<seed>.json in the current folder)"""
import sys, os, random, math, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from faithful_trial import Board, analyse, statue, D4
W, H, seed, secs = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4])
init = json.loads(sys.argv[5]) if len(sys.argv) > 5 else None
rnd = random.Random(seed)

def rows_of(st):
    g = [['o' if (x, y) in st['slab'] else '~' for x in range(W)] for y in range(H)]
    for k in 'SFCG': x, y = st[k]; g[y][x] = k
    return [''.join(r) for r in g]

def conn(slab, cuts):
    slab = set(slab); s0 = next(iter(slab)); seen = {s0}; stk = [s0]
    while stk:
        c = stk.pop()
        for d in D4:
            q = (c[0] + d[0], c[1] + d[1])
            if q in slab and q not in seen and frozenset((c, q)) not in cuts: seen.add(q); stk.append(q)
    return len(seen) == len(slab)

def evaluate(st):
    if len({st['S'], st['F'], st['C'], st['G']}) < 4: return None
    if not all(st[k] in st['slab'] for k in 'SFCG'): return None
    if st['G'][1] != 0: return None
    cuts = [tuple(map(tuple, c)) for c in st['cuts']]
    if not conn(st['slab'], {frozenset(c) for c in cuts}): return None
    b = Board(rows_of(st), cuts)
    G = st['G']
    if sum(1 for d in D4 if b.open(G, (G[0] + d[0], G[1] + d[1]))) != 1: return None
    if abs(st['S'][0] - st['F'][0]) + abs(st['S'][1] - st['F'][1]) < 3: return None
    r = analyse(b)
    if not r or r['ways'] != 1 or r['limbo']: return None
    if analyse(b, 2, False): return None
    # the way's character
    h, m = b.S, b.F; rev = away = brave = 0; prev = None; holds = set(); still = 0
    for d in r['path']:
        q = (h[0] + d[0], h[1] + d[1])
        if prev and d == (-prev[0], -prev[1]): rev += 1
        prev = d
        if q == b.G: break
        if m is not None:
            if abs(q[0] - m[0]) + abs(q[1] - m[1]) < abs(h[0] - m[0]) + abs(h[1] - m[1]): brave += 1
            st_ = statue(b, m, q)
            if st_[-1] == m: still += 1
            else:
                if still >= 2: holds.add(m)
                still = 0
            m = st_[-1]
        if abs(q[0] - G[0]) + abs(q[1] - G[1]) > abs(h[0] - G[0]) + abs(h[1] - G[1]): away += 1
        h = q
    if still >= 2 and m is not None: holds.add(m)
    holes = sum(1 for y in range(H) for x in range(W) if (x, y) not in st['slab'] and
                sum(1 for dx, dy in D4 if (x + dx, y + dy) in st['slab']) >= 3)
    epi = r['L'] - r['chase']
    score = (r['chase'] + 0.3 * min(epi, 6) + 1.5 * rev + 0.4 * away + 0.6 * brave + 2.5 * max(0, len(holds) - 1) - 0.25 * len(st['slab'])
             - 1.0 * len(cuts) - 0.4 * holes - 1.5 * max(0, epi - 6) - 0.1 * r['dead'])
    return score, r, dict(rev=rev, away=away, brave=brave, holds=len(holds), holes=holes, epi=epi)

def random_state():
    while True:
        slab = {(x, y) for y in range(H) for x in range(W) if rnd.random() > 0.35}
        if len(slab) < 8: continue
        cells = sorted(slab)
        top = [c for c in cells if c[1] == 0]
        if not top: continue
        G = rnd.choice(top); S, F, C = rnd.sample([c for c in cells if c != G], 3)
        st = dict(slab=slab, S=S, F=F, C=C, G=G, cuts=[])
        if evaluate(st): return st

def mutate(st):
    st = dict(slab=set(st['slab']), S=st['S'], F=st['F'], C=st['C'], G=st['G'], cuts=list(st['cuts']))
    k = rnd.random()
    if k < 0.5:
        c = (rnd.randrange(W), rnd.randrange(H))
        if c in (st['S'], st['F'], st['C'], st['G']): return None
        if c in st['slab']: st['slab'].discard(c); st['cuts'] = [e for e in st['cuts'] if c not in map(tuple, e)]
        else: st['slab'].add(c)
    elif k < 0.8:
        key = rnd.choice('SFC'); others = {st[x] for x in 'SFCG' if x != key}
        cand = [c for c in st['slab'] if c not in others]
        st[key] = rnd.choice(cand)
    elif k < 0.88:
        cand = [c for c in st['slab'] if c[1] == 0 and c not in (st['S'], st['F'], st['C'])]
        if not cand: return None
        st['G'] = rnd.choice(cand)
    else:
        pairs = [((x, y), (x + dx, y + dy)) for (x, y) in st['slab'] for dx, dy in ((1, 0), (0, 1)) if (x + dx, y + dy) in st['slab']]
        if not pairs: return None
        p = rnd.choice(pairs); key = [list(p[0]), list(p[1])]
        if key in st['cuts']: st['cuts'].remove(key)
        elif len(st['cuts']) < 3: st['cuts'].append(key)
        else: return None
    return st

t0 = time.time(); best = []
while time.time() - t0 < secs:
    if init and rnd.random() < 0.5:
        rows, cuts = init
        st = dict(slab={(x, y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch != '~'}, cuts=[list(map(list, c)) for c in cuts])
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch in 'SFCG': st[ch] = (x, y)
        if len(rows) != H or len(rows[0]) != W: st = random_state()
    else:
        st = random_state()
    cur = evaluate(st)
    if not cur: continue
    T = 3.0; steps = 3000
    for i in range(steps):
        T = 3.0 * (1 - i / steps) + 0.05
        n = mutate(st)
        if not n: continue
        e = evaluate(n)
        if not e: continue
        if e[0] >= cur[0] or rnd.random() < math.exp((e[0] - cur[0]) / T):
            st, cur = n, e
            best.append((cur[0], rows_of(st), [list(map(list, c)) for c in st['cuts']], cur[1]['L'], cur[1]['chase'], cur[1]['states'], cur[1]['dead'], cur[2], ''.join(D4[d] for d in cur[1]['path'])))
        if time.time() - t0 > secs: break
    best.sort(key=lambda t: -t[0])
    uniq = []; seen = set()
    for t in best:
        key = tuple(t[1]) + tuple(map(str, t[2]))
        if key not in seen: seen.add(key); uniq.append(t)
    best = uniq[:60]
json.dump(best, open('ann_%d%d_%d.json' % (W, H, seed), 'w'))
for t in best[:6]:
    print('score %.1f len %d chase %d states %d dead %d %s %s' % (t[0], t[3], t[4], t[5], t[6], t[7], t[8]))
    print('\n'.join(t[1])); print('cuts', t[2]); print()
