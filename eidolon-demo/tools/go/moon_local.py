"""A local search for "The Moon Dial" about a hand-laid board (tools/go/moon_design.py v4): small changes to where the
second face stands and looks, where the stone and the dial are, which cells and ways the middle has; each proven by
tools/go/moon_trial.py; the best kept.

usage: python3 -I tools/go/moon_local.py [steps] [seed]
"""
import importlib.util, json, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
_argv = sys.argv; sys.argv = [sys.argv[0], '0']
spec = importlib.util.spec_from_file_location('mt', os.path.join(HERE, 'moon_trial.py')); mt = importlib.util.module_from_spec(spec); spec.loader.exec_module(mt)
sys.argv = _argv
a = [x for x in sys.argv[1:] if not x.startswith('--')]
STEPS = int(a[0]) if a else 3000
rnd = random.Random(int(a[1]) if len(a) > 1 else 1)
E, S_, W, N = 0, 1, 2, 3
BASE = {
    'mid': [(1, 2), (2, 2), (2, 3), (3, 2), (3, 3), (4, 2), (1, 3), (4, 3), (3, 4), (2, 4), (1, 4)],
    'mid_on': [(1, 2), (2, 2), (2, 3), (3, 2), (3, 3), (4, 2)],
    'cut': [((3, 2), (4, 2)), ((1, 2), (0, 2))],
    'B': ('41', N, W), 'stone': '22', 'dial': (1, 0),
}
FIXED = ['S', (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (0, 2), (0, 3), (0, 4), (0, 5), (1, 5), (2, 5), (3, 5), 'R']
NAMED = {'S': (-1, 1), 'R': (3, 6)}


def build(g):
    cells = list(FIXED) + [c for c in g['mid_on']] + [g['dial']]
    cells = list(dict.fromkeys(cells))
    ways = mt.grid_ways(cells, flights=[('S', (0, 1)), ((3, 5), 'R'), ((0, 1), (0, 2))], cut=g['cut'])
    # the dial is turned only from the cells beside it that the genome allows (it is never walked on)
    return cells, ways


def evaluate(g):
    cells, ways = build(g)
    mt.NAMED_POS = NAMED; mt.set_board(['S'] + [c for c in cells if c not in ('S', 'R')] + ['R'], ways)
    nm = lambda c: c if isinstance(c, str) else '%d%d' % c
    dial = nm(g['dial'])
    faces = [('05', S_, E), g['B']]
    if g['B'][0] not in mt.IX or g['stone'] not in mt.IX or dial not in mt.IX: return None
    if g['stone'] in (dial, g['B'][0], '05'): return None
    for (f, d0, d1) in faces:
        if mt.GO[mt.IX[f]][d0] < 0 or mt.GO[mt.IX[f]][d1] < 0: return None
    t = mt.Trial(faces, dial, g['stone'], ['15', '25', '35'])
    sol = mt.solve(t, traps=False)
    if not sol: return None
    evs = [e for _, e in sol['path']]
    res = dict(len=sol['len'], ways=sol['ways'], path=sol['path'], push=sum('push' in e for e in evs), turn=sum('turn' in e for e in evs),
               shatter=any('shatter' in e for e in evs), brk=sum('break' in e for e in evs))
    s_nb = mt.solve(mt.Trial([faces[0]], dial, g['stone'], ['15', '25', '35']), traps=False)
    res['needB'] = s_nb is None or s_nb['len'] < sol['len'] - 1
    free = [n for n in mt.NAMES if n not in ('S', 'R', dial, '05', g['B'][0], g['stone'], '15', '25', '35')]
    s_ns = mt.solve(mt.Trial(faces, dial, free[-1], ['15', '25', '35']), traps=False) if free else None
    res['needStone'] = res['push'] > 0
    return res


def score(r):
    if r is None: return -999
    sc = 0.0
    sc += -abs(r['len'] - 21) * 0.6
    sc += 6 if r['ways'] == 1 else -2 * min(r['ways'], 6)
    sc += 5 if r['push'] else -5
    sc += min(r['push'], 4) * 1.0
    sc += 3 * min(r['turn'], 3)
    sc += 4 if r['shatter'] else -4
    sc += 4 if r['needB'] else -6
    return sc


def mutate(g):
    g = json.loads(json.dumps(g)); g['mid_on'] = [tuple(c) for c in g['mid_on']]; g['cut'] = [tuple(map(tuple, c)) for c in g['cut']]
    g['dial'] = tuple(g['dial']); g['B'] = tuple(g['B'])
    k = rnd.random()
    if k < 0.25:
        c = rnd.choice(BASE['mid'])
        if c in g['mid_on']: g['mid_on'].remove(c)
        else: g['mid_on'].append(c)
    elif k < 0.4:
        cs = [c for c in FIXED if isinstance(c, tuple)] + g['mid_on']
        c = rnd.choice(cs); d = rnd.choice([(1, 0), (0, 1)]); q = (c[0] + d[0], c[1] + d[1])
        e = (c, q)
        if e in g['cut']: g['cut'].remove(e)
        else: g['cut'].append(e)
    elif k < 0.55:
        cells = [c for c in g['mid_on']] + [c for c in FIXED if isinstance(c, tuple) and c not in ((0, 5), (1, 5), (2, 5), (3, 5))]
        g['stone'] = '%d%d' % rnd.choice(cells)
    elif k < 0.75:
        cells = [c for c in g['mid_on']] + [(2, 1), (3, 1), (4, 1), (1, 1)]
        c = rnd.choice(cells); g['B'] = ('%d%d' % c, rnd.randrange(4), rnd.randrange(4))
    else:
        g['dial'] = rnd.choice([(1, 0), (2, 0), (3, 0), (4, 0)] + [c for c in BASE['mid'] if c not in g['mid_on']])
    return g


if __name__ == '__main__':
    best = dict(BASE); best['mid_on'] = list(BASE['mid_on'])
    bs = score(evaluate(best)); hist = []
    for step in range(STEPS):
        g = mutate(best)
        r = evaluate(g); sc = score(r)
        if sc >= bs:
            best, bs = g, sc
            if r: hist.append((sc, r['len'], r['ways'], r['push'], r['turn'], r['shatter'], r['needB']))
    r = evaluate(best)
    print('best score', bs)
    print(json.dumps(best, default=list))
    if r:
        print('len', r['len'], 'ways', r['ways'], 'push', r['push'], 'turn', r['turn'], 'shatter', r['shatter'], 'needB', r['needB'])
        print(' '.join('%s%s' % (n, '(' + e + ')' if e else '') for n, e in r['path']))
    json.dump(best, open(os.path.join(HERE, 'moon_best_%s.json' % (a[1] if len(a) > 1 else '1')), 'w'), default=list)
