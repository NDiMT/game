"""Simulated annealing toward boards of the gaze that turns to stone (25/11; stone_gaze_trial.py): one way, no limbo
while the Faithful walks, the stone needed, the crack a lure (sunk, it can shield no one), and the stone shielding her
from the gaze at least once on the way.

usage: python3 -I tools/go/stone_gaze_anneal.py <W> <H> <seed> <seconds>   (writes sg_<W><H>_<seed>.json here)"""
import sys, os, random, math, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stone_gaze_trial import Board, analyse, move, D4, MOVING, STONE, GONE, statue_steps
W, H, seed, secs = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), float(sys.argv[4])
rnd = random.Random(seed)
KEYS = 'SFCGW'
def rows_of(st):
    g = [['o' if (x, y) in st['slab'] else '~' for x in range(W)] for y in range(H)]
    for c in st['cols']: g[c[1]][c[0]] = '#'
    for k in KEYS:
        if st.get(k): x, y = st[k]; g[y][x] = k
    return [''.join(r) for r in g]
def conn(slab):
    slab = set(slab); s0 = next(iter(slab)); seen = {s0}; stk = [s0]
    while stk:
        c = stk.pop()
        for d in D4:
            q = (c[0] + d[0], c[1] + d[1])
            if q in slab and q not in seen: seen.add(q); stk.append(q)
    return len(seen) == len(slab)
def evaluate(st):
    for k in 'SFCG':
        if st[k] not in st['slab']: return None
    if st['W'] in st['slab'] or st['W'] in st['cols']: return None
    if len({st[k] for k in 'SFCGW'}) < 5: return None
    if st['G'][1] != 0: return None
    if any(c in st['slab'] for c in st['cols']): return None
    walk = st['slab']
    if not conn(walk): return None
    b = Board(rows_of(st), st['face'])
    G = st['G']
    if sum(1 for d in D4 if b.open(G, (G[0] + d[0], G[1] + d[1]))) != 1: return None
    if abs(st['S'][0] - st['F'][0]) + abs(st['S'][1] - st['F'][1]) < 3: return None
    r = analyse(b)
    if not r or r['ways'] != 1 or r['limbo_alive'] or r['L'] < 10 or r['L'] > 34: return None
    if analyse(b, False): return None
    trap = r['gone_reachable'] and not r['gone_wins']
    # the way's character
    st_ = (b.S, b.F, MOVING, 0); rev = 0; prev = None; stone_at = None
    for i, d in enumerate(r['path']):
        if prev and d == (-prev[0], -prev[1]): rev += 1
        prev = d
        kind, n, ev = move(b, st_, d)
        if kind != 'move': break
        if ev and 'stone' in ev: stone_at = i + 1
        st_ = n
    after = r['L'] - (stone_at or 0)
    # the stone as a shield: after it stands, moves where his gaze would have reached her but for it
    from stone_gaze_trial import gaze as _gz
    st2 = (b.S, b.F, MOVING, 0); shield = 0
    for d in r['path']:
        kind, n, ev = move(b, st2, d)
        if kind != 'move': break
        h2, m2, mode2, ph2 = n
        if mode2 == STONE:
            for ph_ in (ph2, ph2 - 1):
                cells, hit = _gz(b, ph_ % 4, h2, m2, mode2)
                if hit == 'statue':
                    c2, hit2 = _gz(b, ph_ % 4, h2, None, GONE)
                    if hit2 == 'her': shield += 1; break
        st2 = n
    if shield < 1 or rev > 7: return None
    holes = sum(1 for y in range(H) for x in range(W) if (x, y) not in st['slab'] and (x, y) != st['W'] and
                sum(1 for dx, dy in D4 if (x + dx, y + dy) in st['slab']) >= 3)
    score = (r['L'] + 0.6 * rev + 2.0 * min(shield, 4) + (6 if trap else 0) + 0.04 * r['states'] - 0.3 * len(st['slab'])
             - 0.5 * holes - 1.5 * len(st['cols']) - 0.8 * max(0, after - 8) + 0.3 * min(stone_at or 0, 12))
    return score, r, dict(rev=rev, trap=trap, stone_at=stone_at, after=after, holes=holes, shield=shield)
def random_state():
    while True:
        slab = {(x, y) for y in range(H) for x in range(W) if rnd.random() > 0.35}
        water = [(x, y) for y in range(1, H - 1) for x in range(1, W - 1) if (x, y) not in slab]
        if len(slab) < 9 or not water: continue
        top = [c for c in slab if c[1] == 0]
        if not top: continue
        st = dict(slab=slab, cols=set(), face=rnd.choice('NESW'), W=rnd.choice(water), G=rnd.choice(top))
        rest = [c for c in slab if c != st['G']]
        if len(rest) < 3: continue
        st['S'], st['F'], st['C'] = rnd.sample(rest, 3)
        if evaluate(st): return st
def mutate(st):
    st = dict(st); st['slab'] = set(st['slab']); st['cols'] = set(st['cols'])
    k = rnd.random()
    if k < 0.45:
        c = (rnd.randrange(W), rnd.randrange(H))
        if c in [st[x] for x in KEYS]: return None
        if c in st['cols']: st['cols'].discard(c); st['slab'].add(c)
        elif c in st['slab']: st['slab'].discard(c)
        else: st['slab'].add(c)
    elif k < 0.72:
        key = rnd.choice('SFC'); others = {st[x] for x in KEYS if x != key}
        st[key] = rnd.choice([c for c in st['slab'] if c not in others])
    elif k < 0.8:
        water = [(x, y) for y in range(H) for x in range(W) if (x, y) not in st['slab'] and (x, y) not in st['cols']]
        st['W'] = rnd.choice(water)
    elif k < 0.86: st['face'] = rnd.choice('NESW')
    elif k < 0.92:
        cand = [c for c in st['slab'] if c[1] == 0 and c not in (st['S'], st['F'], st['C'])]
        if not cand: return None
        st['G'] = rnd.choice(cand)
    else:
        cand = [c for c in st['slab'] if c not in [st[x] for x in KEYS]]
        if not cand: return None
        c = rnd.choice(cand)
        if len(st['cols']) >= 2: return None
        st['slab'].discard(c); st['cols'].add(c)
    return st
t0 = time.time(); best = []
while time.time() - t0 < secs:
    st = random_state(); cur = evaluate(st)
    for i in range(2500):
        T = 3.0 * (1 - i / 2500) + 0.05
        n = mutate(st)
        if not n: continue
        e = evaluate(n)
        if not e: continue
        if e[0] >= cur[0] or rnd.random() < math.exp((e[0] - cur[0]) / T):
            st, cur = n, e
            best.append((cur[0], rows_of(st), st['face'], cur[1]['L'], cur[1]['states'], cur[1]['dead'], cur[1]['limbo'], cur[2], ''.join(D4[d] for d in cur[1]['path'])))
        if time.time() - t0 > secs: break
    best.sort(key=lambda t: -t[0]); seen = set(); u = []
    for t in best:
        k = tuple(t[1]) + (t[2],)
        if k not in seen: seen.add(k); u.append(t)
    best = u[:40]
json.dump(best, open('sg_%d%d_%d.json' % (W, H, seed), 'w'))
for t in best[:6]:
    print('score %.1f len %d states %d dead %d limbo %d %s %s face %s' % (t[0], t[3], t[4], t[5], t[6], t[7], t[8], t[2]))
    print('\n'.join(t[1])); print()
