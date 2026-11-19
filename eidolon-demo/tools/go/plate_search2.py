"""Search for boards of the fourth level's trial with a trick (the owner, 19/11: "not straight there in two pushes;
a trick, the block must be stopped somewhere in the real world"): corridors before the glass with one or two broken
columns on them; kept when the trial is good (one shortest way, no dead end), the block pushed three times or more
and more than one way, a push that takes it farther from its place before it can reach it, and the columns needed
(without them the way is shorter).

usage: python3 -I tools/go/plate_search2.py [k] [tries] [seed]
"""
import random, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from plate_trial import Trial, screen


def carve(rng, k):
    real = lambda c: c[0] >= 0 and c[1] >= 0 and c[0] + c[1] < k
    cells = {(0, 0)}
    for _ in range(rng.randint(4, 7)):
        c = rng.choice(sorted(cells))
        for _ in range(rng.randint(2, 4)):
            d = rng.choice(((1, 0), (-1, 0), (0, 1), (0, -1)))
            for _ in range(rng.randint(1, 3)):
                n = (c[0] + d[0], c[1] + d[1])
                if not real(n): break
                c = n; cells.add(c)
    return cells


def board(rng, k):
    cells = carve(rng, k)
    if not (10 <= len(cells) <= 18): return None
    near = [c for c in cells if c[0] + c[1] == k - 1]
    if len(near) < 2: return None
    gate, target = rng.sample(near, 2)
    others = [c for c in cells if c not in (gate, target)]
    start = min(others, key=lambda c: c[0] + c[1] + rng.random() * 1.5)
    rest = [c for c in others if c != start]
    stone = rng.choice(rest)
    pil = rng.sample([c for c in rest if c != stone], rng.choice((1, 1, 2)))
    grid = {c: '.' for c in cells}
    grid[gate] = 'G'; grid[target] = 'T'; grid[start] = 'S'; grid[stone] = 'B'
    for c in pil: grid[c] = 'o'
    pairs = [(c, (c[0] + d[0], c[1] + d[1])) for c in cells for d in ((1, 0), (0, 1)) if (c[0] + d[0], c[1] + d[1]) in cells]
    cut = [p for p in pairs if rng.random() < 0.12]
    rows = [''.join(grid.get((gx, gy), ' ') for gx in range(k)) for gy in range(k - 1, -1, -1)]
    return {'glass': k, 'rows': rows, 'cut': cut}


def judge(b):
    t = Trial(b); r = t.solve()
    if not r['ok'] or not r['unique'] or r['dead'] or not (11 <= r['len'] <= 18): return None
    dirs = set(); away = 0; np_ = 0
    dist = lambda c: abs(c[0] - t.target[0]) + abs(c[1] - t.target[1])
    for i, kk in enumerate(r['kinds']):
        if kk != 'push': continue
        np_ += 1
        a_, b_ = r['path'][i], r['path'][i + 1]
        dirs.add((b_[0][0] - a_[0][0], b_[0][1] - a_[0][1]))
        if dist(b_[1]) > dist(a_[1]): away += 1      # (a push that takes the block farther from its place: the trick)
    if np_ < 3 or len(dirs) < 2 or away < 1: return None
    b0 = dict(b, rows=[row.replace('o', '.') for row in b['rows']])      # (the columns must matter)
    r0 = Trial(b0).solve()
    if r0['ok'] and r0['len'] >= r['len']: return None
    return np_ * 3 + len(dirs) * 4 + away * 5 + r['len'], r, t


if __name__ == '__main__':
    k = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    tries = int(sys.argv[2]) if len(sys.argv) > 2 else 60000
    rng = random.Random(int(sys.argv[3]) if len(sys.argv) > 3 else 1)
    best = []
    for _ in range(tries):
        b = board(rng, k)
        if b is None: continue
        j = judge(b)
        if j: best.append((j[0], b, j[1], j[2]))
    best.sort(key=lambda x: -x[0]); seen = set()
    for sc, b, r, t in best:
        key = tuple(b['rows'])
        if key in seen: continue
        seen.add(key)
        print('score', sc, 'moves', r['len'], 'pushes', sum(1 for x in r['kinds'] if x == 'push'), 'states', r['states'])
        print('  rows', b['rows'], 'cut', b['cut'])
        print('  way:', ' '.join('%d,%d%s' % (st[0][0], st[0][1], '*' if kk == 'push' else '') for st, kk in zip(r['path'][1:], r['kinds'])))
        print(screen(t)); print()
        if len(seen) >= 6: break
    print(len(best), 'good boards')
