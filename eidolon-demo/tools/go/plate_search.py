"""Search for boards of the fourth level's trial as the owner put it (plate_trial.py): random real sides laid as
corridors before the glass, the block, the plate's real cell and the gate's ring near the glass, her start far from it;
kept when the trial is good: one shortest way, no dead end, the block pushed more than one way.

usage: python3 -I tools/go/plate_search.py [k] [tries] [seed]
"""
import random, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from plate_trial import Trial, screen


def carve(rng, k):
    real = lambda c: c[0] >= 0 and c[1] >= 0 and c[0] + c[1] < k
    cells = {(0, 0)}
    for _ in range(rng.randint(3, 6)):
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
    if not (8 <= len(cells) <= 15): return None
    near = [c for c in cells if c[0] + c[1] == k - 1]      # (by the glass)
    if len(near) < 2: return None
    gate, target = rng.sample(near, 2)
    others = [c for c in cells if c not in (gate, target)]
    start = min(others, key=lambda c: c[0] + c[1] + rng.random() * 1.5)
    stone = rng.choice([c for c in others if c != start])
    grid = {c: '.' for c in cells}
    grid[gate] = 'G'; grid[target] = 'T'; grid[start] = 'S'; grid[stone] = 'B'
    pairs = [(c, (c[0] + d[0], c[1] + d[1])) for c in cells for d in ((1, 0), (0, 1)) if (c[0] + d[0], c[1] + d[1]) in cells]
    cut = [p for p in pairs if rng.random() < 0.18]
    N = k
    rows = [''.join(grid.get((gx, gy), ' ') for gx in range(N)) for gy in range(N - 1, -1, -1)]
    return {'glass': k, 'rows': rows, 'cut': cut}


def score(b):
    t = Trial(b); r = t.solve()
    if not r['ok'] or not r['unique'] or r['dead']: return None
    if not (9 <= r['len'] <= 15): return None
    pushes = [d for (st, k), d in zip(zip(r['path'][1:], r['kinds']), [None] * 99) if k == 'push']
    dirs = set()
    for i, k in enumerate(r['kinds']):
        if k == 'push':
            a_, b_ = r['path'][i][0], r['path'][i + 1][0]; dirs.add((b_[0] - a_[0], b_[1] - a_[1]))
    np_ = sum(1 for k in r['kinds'] if k == 'push')
    if np_ < 2 or len(dirs) < 2: return None
    return r['len'] + 3 * np_ + 4 * len(dirs), r, t


if __name__ == '__main__':
    k = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    tries = int(sys.argv[2]) if len(sys.argv) > 2 else 20000
    rng = random.Random(int(sys.argv[3]) if len(sys.argv) > 3 else 1)
    best = []
    for _ in range(tries):
        b = board(rng, k)
        if b is None: continue
        s = score(b)
        if s: best.append((s[0], b, s[1], s[2]))
    best.sort(key=lambda x: -x[0]); seen = set()
    for sc, b, r, t in best:
        key = tuple(b['rows'])
        if key in seen: continue
        seen.add(key)
        print('score', sc, 'moves', r['len'], 'pushes', sum(1 for x in r['kinds'] if x == 'push'), 'states', r['states'])
        print('  rows', b['rows'], 'cut', b['cut'])
        print(screen(t)); print()
        if len(seen) >= 6: break
    print(len(best), 'good boards')
