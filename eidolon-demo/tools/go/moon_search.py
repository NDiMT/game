"""A search for "The Moon Dial" (rules: tools/go/moon_trial.py): boards grown at random about one idea, each proven.

The idea: a court below, a terrace above where the frozen guardian walks, the ring beyond the terrace. A face at the
terrace's end looks along it when the dial is turned (the guardian shatters) and elsewhere when it is not; a second face
bound to the same dial guards the court, and the stone must be brought to shade the way. The dial must be turned more
than once, the stone pushed, the guardian shattered; every thing needed; one shortest way; few dead ends.

usage: python3 -I tools/go/moon_search.py [tries] [seed] [--write]
"""
import importlib.util, json, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
_argv = sys.argv; sys.argv = [sys.argv[0], '0']
spec = importlib.util.spec_from_file_location('mt', os.path.join(HERE, 'moon_trial.py')); mt = importlib.util.module_from_spec(spec); spec.loader.exec_module(mt)
sys.argv = _argv
a = [x for x in sys.argv[1:] if not x.startswith('--')]
TRIES = int(a[0]) if a else 4000
rnd = random.Random(int(a[1]) if len(a) > 1 else 1)
W_, H_ = 5, 5      # (x 0..4, y 1..5)


def board():
    cells = {(x, y) for x in range(W_) for y in range(1, H_ + 1)}
    # the terrace (top row) and the court (bottom row) stay; the middle rows are thinned
    for c in list(cells):
        if 1 < c[1] < H_ and rnd.random() < 0.55: cells.discard(c)
    ways = []
    for c in cells:
        for d in ((1, 0), (0, 1)):
            q = (c[0] + d[0], c[1] + d[1])
            if q in cells and rnd.random() < (0.92 if c[1] in (1, H_) and q[1] == c[1] else 0.75):
                ways.append((c, q, 'flight' if (d == (0, 1) and rnd.random() < 0.25) else 'level'))
    return cells, ways


def connected(cells, ways, a_, b_):
    nb = {}
    for p, q, k in ways: nb.setdefault(p, []).append(q); nb.setdefault(q, []).append(p)
    seen = {a_}; st = [a_]
    while st:
        c = st.pop()
        for d in nb.get(c, []):
            if d not in seen: seen.add(d); st.append(d)
    return b_ in seen


def candidate():
    cells, ways = board()
    sx = rnd.choice([c for c in cells if c[1] == 1]); rx = rnd.choice([c for c in cells if c[1] == H_])
    named = {'S': (sx[0], 0), 'R': (rx[0], H_ + 1)}
    if named['S'] == named.get('R'): return None
    ways = ways + [('S', sx, 'flight'), (rx, 'R', 'flight')]
    # the dial: a cell of the court's row or beside it, not walked on
    dial = rnd.choice([c for c in cells if c[1] <= 2 and c != sx])
    if not connected(cells, ways, 'S', 'R'): return None
    cl = ['S'] + sorted(cells) + ['R']
    mt.NAMED_POS = named; mt.set_board(cl, ways)
    nm = lambda c: c if isinstance(c, str) else '%d%d' % c
    inner = [nm(c) for c in cells if c not in (sx, rx) and c != dial]
    # face A at the terrace's end
    top = [nm(c) for c in cells if c[1] == H_ and c != rx]
    if not top: return None
    A = rnd.choice(top); i = mt.IX[A]
    ds = [d for d in range(4) if mt.GO[i][d] >= 0]
    if len(ds) < 2: return None
    d0, d1 = rnd.sample(ds, 2)
    B = rnd.choice([x for x in inner if x != A])
    j = mt.IX[B]; ds2 = [d for d in range(4) if mt.GO[j][d] >= 0]
    if not ds2: return None
    e0 = rnd.choice(ds2); e1 = rnd.choice(ds2)
    free = [x for x in inner if x not in (A, B)]
    if not free: return None
    stone = rnd.choice(free)
    # the guardian: along the terrace, three nodes in a level line
    lines = []
    for c in cells:
        if c[1] != H_: continue
        k = mt.IX[nm(c)]
        for d in (0, 2):
            r_ = [k]; kk = k
            for _ in range(2):
                kk = mt.GO[kk][d]
                if kk < 0: break
                r_.append(kk)
            if len(r_) == 3: lines.append([mt.NAMES[x] for x in r_])
    lines = [l for l in lines if not set(l) & {A, B, stone, nm(rx), nm(dial)}]
    route = rnd.choice(lines) if lines else []
    return dict(cells=cl, ways=ways, named=named, faces=[(A, d0, d1), (B, e0, e1)], dial=nm(dial), stone=stone, route=route)


def judge(c):
    mt.NAMED_POS = c['named']; mt.set_board(c['cells'], c['ways'])
    t = mt.Trial(c['faces'], c['dial'], c['stone'], c['route'])
    sol = mt.solve(t, traps=False)
    if not sol or not (16 <= sol['len'] <= 28) or sol['ways'] != 1: return None
    evs = [e for _, e in sol['path']]
    if sum('turn' in e for e in evs) < 2 or not any('push' in e for e in evs) or not any('shatter' in e for e in evs): return None
    for k in range(2):
        s2 = mt.solve(mt.Trial([f for i, f in enumerate(c['faces']) if i != k], c['dial'], c['stone'], c['route']), traps=False)
        if s2 is not None and s2['len'] >= sol['len'] - 1: return None
    if c['route']:
        s5 = mt.solve(mt.Trial(c['faces'], c['dial'], c['stone'], []), traps=False)
        if s5 is not None and s5['len'] >= sol['len']: return None      # (the guardian matters)
    sol = mt.solve(t)
    if sol['traps'] > 40: return None
    score = sol['len'] * 0.4 + 2 * sum('push' in e for e in evs) + 1.5 * sum('turn' in e for e in evs) + 2 * sum('break' in e for e in evs) - 0.05 * sol['traps']
    return dict(score=score, sol=sol, c=c)


if __name__ == '__main__':
    found = []
    for k in range(TRIES):
        c = candidate()
        if c is None: continue
        j = judge(c)
        if j: found.append(j)
    found.sort(key=lambda j: -j['score'])
    print('found', len(found))
    for j in found[:4]:
        c = j['c']; sol = j['sol']
        print('\\n=== score %.1f len %d dead ends %d' % (j['score'], sol['len'], sol['traps']))
        print(json.dumps({k: c[k] for k in ('faces', 'dial', 'stone', 'route', 'named')}))
        print(' '.join('%s%s' % (n, '(' + e + ')' if e else '') for n, e in sol['path']))
    if '--write' in sys.argv and found:
        json.dump([j['c'] for j in found[:8]], open(os.path.join(HERE, 'moon_found.json'), 'w'), indent=1, default=list)
