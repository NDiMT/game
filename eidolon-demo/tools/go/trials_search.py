"""A local search for puzzles of tools/go/trials.py around one idea: boards on a small grid, each proven by the search;
the best kept. An idea is a dict: the things it has, and what its proof must show (events on the way, things needed).

usage: python3 -I tools/go/trials_search.py <idea> [steps] [seed]      (writes trials_found_<idea>_<seed>.json)
"""
import copy, json, math, os, random, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from trials import *

a = [x for x in sys.argv[1:] if not x.startswith('--')]
IDEA = a[0] if a else 'mirror'
STEPS = int(a[1]) if len(a) > 1 else 3000
SEED = int(a[2]) if len(a) > 2 else 1
rnd = random.Random(SEED)
GW, GH = 5, 6

IDEAS = {
    # a mirror turns one face's look onto the face that guards the way; turned from the right side, at the right time
    'mirror': dict(faces=2, mirrors=1, stone=True, route=False, hunters=0, cracks=0, gaps=1, faces_break=True,
                   want=['mirror', 'broken by a look'], need=['faces', 'mirrors'], length=(12, 22)),
    # a hunter wakes and follows her; she leads it over cracked floor, which holds her and not it
    'hunter': dict(faces=0, mirrors=0, stone=False, route=False, hunters=1, cracks=1, gaps=0, faces_break=False, flights=1,
                   want=['hunter wakes', 'hunter falls'], need=['hunters', 'tool:cracks'], length=(10, 20)),
    # a hunter led the long way round, through a face's look, while she goes up a flight it cannot
    'lure': dict(faces=1, mirrors=0, stone=False, route=False, hunters=1, cracks=0, gaps=0, faces_break=False, flights=1,
                 want=['hunter wakes', 'hunter shatters'], need=['hunters', 'faces'], length=(10, 20)),
    # two mirrors and a stone: a look led round two corners onto the face at the gate
    'mirror2': dict(faces=2, mirrors=2, stone=True, route=False, hunters=0, cracks=0, gaps=1, faces_break=True,
                    want=['mirror', 'broken by a look', 'push'], need=['faces', 'mirrors', 'stone'], length=(14, 26)),
}
I = IDEAS[IDEA]


def all_cells(): return [(x, y) for x in range(GW) for y in range(GH)]


def random_genome():
    cells = set(all_cells())
    for c in list(cells):
        if rnd.random() < 0.35: cells.discard(c)
    g = dict(cells=sorted(cells), cut=[], gaps=[], flights=[], faces=[], mirrors=[], stone=None, hunters=[], cracks=[], start=(0, 0), ring=(GW - 1, GH - 1))
    g['cells'] = sorted(set(g['cells']) | {g['start'], g['ring']})
    for _ in range(I['faces']): g['faces'].append([rnd.choice(g['cells']), rnd.randrange(4), None])
    for _ in range(I['mirrors']): g['mirrors'].append([rnd.choice(g['cells']), rnd.randrange(2)])
    if I['stone']: g['stone'] = rnd.choice(g['cells'])
    for _ in range(I['hunters']): g['hunters'].append([rnd.choice(g['cells']), rnd.randrange(4)])
    for _ in range(I['cracks']): g['cracks'].append(rnd.choice(g['cells']))
    return g


def adj_pairs(cells):
    cs = set(cells); out = []
    for c in cs:
        for d in ((1, 0), (0, 1)):
            q = (c[0] + d[0], c[1] + d[1])
            if q in cs: out.append((c, q))
    return out


def build(g):
    cells = [tuple(c) for c in g['cells']]
    gaps = [tuple(map(tuple, p)) for p in g['gaps']]; fls = [tuple(map(tuple, p)) for p in g['flights']]
    cut = [tuple(map(tuple, p)) for p in g['cut']] + gaps
    B = Board(cells, tuple(g['start']), tuple(g['ring']), cut=cut, flights=fls, gaps=gaps)
    faces = [(tuple(f[0]), f[1], f[1] if f[2] is None else f[2]) for f in g['faces']]
    t = Trial(B, faces=faces, stone=tuple(g['stone']) if g['stone'] else None, mirrors=[(tuple(m[0]), m[1]) for m in g['mirrors']],
              hunters=[(tuple(h[0]), h[1]) for h in g['hunters']], cracks=[tuple(c) for c in g['cracks']], faces_break=I['faces_break'])
    return t


def valid(g):
    cells = set(tuple(c) for c in g['cells'])
    things = [tuple(f[0]) for f in g['faces']] + [tuple(m[0]) for m in g['mirrors']] + [tuple(h[0]) for h in g['hunters']] + [tuple(c) for c in g['cracks']]
    if g['stone']: things.append(tuple(g['stone']))
    if len(set(things)) < len(things): return False
    if any(t not in cells for t in things): return False
    if tuple(g['start']) in things or tuple(g['ring']) in things: return False
    return True


def stable(t):
    """at the start nothing happens by itself: no face in another's look, she in none, no statue in one, no hunter awake"""
    s0 = t.init()
    if t.settle(s0)[1]: return False
    sn = t.seen(s0)
    if s0[0] in sn: return False
    if t.route and t.route[0] in sn: return False
    for h in s0[7]:
        if h and (h[0] in sn or t.in_line(h, s0)): return False
    return True


def evaluate(g):
    if not valid(g): return None
    t = build(g)
    if not stable(t): return None
    try: sol = solve(t, traps=True, limit=60000)
    except Exception: return None
    if not sol or sol['len'] < 0: return None
    evs = ' '.join(e for _, e in sol['path'])
    r = dict(len=sol['len'], ways=sol['ways'], traps=sol['traps'], states=sol['states'], path=[('%d%d' % n if isinstance(n, tuple) else n, e) for n, e in sol['path']])
    r['want'] = sum(1 for w in I['want'] if w in evs)
    need = 0
    for what in I['need']:
        t2 = copy.copy(t)
        if what.startswith('tool:'):      # (a tool: without it there is no way at all)
            w = what[5:]
            if w == 'cracks': t2.cracks = []; t2.cix = {}
            elif w == 'stone': t2.stone0 = None
            elif w == 'mirrors': t2.mirrors = []; t2.mpos = {}
            s2 = solve(t2, traps=False, limit=60000); need += (s2 is None); continue
        if what == 'faces':
            ok = True
            for k in range(len(t.faces)):
                t2 = copy.copy(t); t2.faces = [f for i, f in enumerate(t.faces) if i != k]; t2.plinth = {c for c, _, _ in t2.faces}
                s2 = solve(t2, traps=False, limit=60000)
                if s2 is not None and s2['len'] >= sol['len']: ok = False
            need += ok
        elif what == 'mirrors':
            ok = True
            for k in range(len(t.mirrors)):
                t2 = copy.copy(t); t2.mirrors = [m for i, m in enumerate(t.mirrors) if i != k]; t2.mpos = {c: i for i, (c, _) in enumerate(t2.mirrors)}
                s2 = solve(t2, traps=False, limit=60000)
                if s2 is not None and s2['len'] >= sol['len']: ok = False
            need += ok
        elif what == 'stone':
            t2.stone0 = None; s2 = solve(t2, traps=False, limit=60000); need += (s2 is None or s2['len'] < sol['len'])
        elif what == 'hunters':
            t2.hunters0 = []; s2 = solve(t2, traps=False, limit=60000); need += (s2 is None or s2['len'] < sol['len'])
        elif what == 'cracks':
            t2.cracks = []; t2.cix = {}; s2 = solve(t2, traps=False, limit=60000); need += (s2 is None or s2['len'] < sol['len'])
    r['need'] = need
    return r


def score(r):
    if r is None: return -999.0
    lo, hi = I['length']
    sc = 0.0
    sc -= 2.0 * max(0, lo - r['len']) + 0.8 * max(0, r['len'] - hi)
    sc += 6 if r['ways'] == 1 else -1.5 * min(r['ways'], 8)
    sc += 8 * r['want'] - 8 * (len(I['want']) - r['want'])
    sc += 7 * r['need'] - 7 * (len(I['need']) - r['need'])
    sc -= 0.25 * min(r['traps'], 40)
    sc += 0.15 * min(r['len'], hi)
    return sc


def mutate(g):
    g = json.loads(json.dumps(g)); k = rnd.random()
    cells = [tuple(c) for c in g['cells']]
    if k < 0.2:      # a cell in or out
        c = (rnd.randrange(GW), rnd.randrange(GH))
        if c in cells and c not in (tuple(g['start']), tuple(g['ring'])): cells.remove(c)
        else: cells.append(c)
        g['cells'] = sorted(set(cells))
    elif k < 0.38:      # a way cut or joined
        ps = adj_pairs(cells)
        if ps:
            p = list(rnd.choice(ps))
            if p in g['cut']: g['cut'].remove(p)
            else: g['cut'].append(p)
    elif k < 0.46 and I.get('gaps'):      # a chasm a look crosses
        ps = adj_pairs(cells)
        if ps:
            p = list(rnd.choice(ps))
            if p in g['gaps']: g['gaps'].remove(p)
            elif len(g['gaps']) < I['gaps']: g['gaps'].append(p)
            else: g['gaps'][rnd.randrange(len(g['gaps']))] = p
    elif k < 0.52 and I.get('flights'):
        ps = adj_pairs(cells)
        if ps:
            p = list(rnd.choice(ps))
            if p in g['flights']: g['flights'].remove(p)
            elif len(g['flights']) < I['flights']: g['flights'].append(p)
            else: g['flights'][rnd.randrange(len(g['flights']))] = p
    elif k < 0.64 and g['faces']:
        f = rnd.choice(g['faces'])
        if rnd.random() < 0.5: f[0] = list(rnd.choice(cells))
        else: f[1] = rnd.randrange(4)
    elif k < 0.74 and g['mirrors']:
        m = rnd.choice(g['mirrors'])
        if rnd.random() < 0.6: m[0] = list(rnd.choice(cells))
        else: m[1] ^= 1
    elif k < 0.8 and g['stone'] is not None:
        g['stone'] = list(rnd.choice(cells))
    elif k < 0.88 and g['hunters']:
        h = rnd.choice(g['hunters'])
        if rnd.random() < 0.6: h[0] = list(rnd.choice(cells))
        else: h[1] = rnd.randrange(4)
    elif k < 0.94 and g['cracks']:
        g['cracks'][rnd.randrange(len(g['cracks']))] = list(rnd.choice(cells))
    else:
        if rnd.random() < 0.5: g['start'] = list(rnd.choice(cells))
        else: g['ring'] = list(rnd.choice(cells))
    return g


if __name__ == '__main__':
    best = None; bs = -1e9
    for _ in range(600):
        g = random_genome(); s_ = score(evaluate(g))
        if s_ > bs: best, bs = g, s_
    T = 1.5
    cur, cs = best, bs
    for step in range(STEPS):      # (a little annealing: now and then a worse board is taken, to get out of a dead end)
        g = mutate(cur); r = evaluate(g); s_ = score(r)
        temp = T * (1.0 - step / STEPS) + 0.01
        if s_ >= cs or rnd.random() < math.exp((s_ - cs) / temp) * 0.3:
            cur, cs = g, s_
            if s_ > bs: best, bs = g, s_
    r = evaluate(best)
    print('idea', IDEA, 'seed', SEED, 'score %.1f' % bs)
    if r:
        print('len', r['len'], 'ways', r['ways'], 'dead ends', r['traps'], 'want', r['want'], '/', len(I['want']), 'need', r['need'], '/', len(I['need']))
        print(' '.join('%s%s' % (n, '(' + e + ')' if e else '') for n, e in r['path']))
    json.dump(dict(genome=best, result=r, score=bs), open(os.path.join(HERE, 'trials_found_%s_%d.json' % (IDEA, SEED)), 'w'), default=list)
