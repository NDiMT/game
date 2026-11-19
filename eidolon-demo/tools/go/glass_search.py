"""Search for boards of the fourth level's trial (glass_trial.py): random real sides laid as corridors on a small
board, a stone, cracks in the glass and holes in the image, kept when the trial is good: one shortest way, no dead end,
the image needed, a few pushes and crossings. Prints the best as the eye would see them.

usage: python3 -I tools/go/glass_search.py [N] [tries] [seed]
"""
import random, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from glass_trial import Trial, screen


def carve(rng, N):
    cells = set(); real = [(gx, gy) for gy in range(N) for gx in range(N) if gy > gx]
    c = rng.choice([x for x in real if x[0] <= 1 and x[1] <= 3])
    cells.add(c)
    for _ in range(rng.randint(3, 6)):      # (a few corridors, each a run of straight lengths)
        c = rng.choice(sorted(cells))
        for _ in range(rng.randint(2, 4)):
            d = rng.choice(((1, 0), (-1, 0), (0, 1), (0, -1)))
            for _ in range(rng.randint(1, 3)):
                n = (c[0] + d[0], c[1] + d[1])
                if n[1] <= n[0] or not (0 <= n[0] < N and 0 <= n[1] < N): break
                c = n; cells.add(c)
    return cells


def board(rng, N):
    cells = carve(rng, N)
    if len(cells) < 9 or len(cells) > 18: return None
    cs = sorted(cells)
    diag = [(k, k) for k in range(N) if ((k - 1, k) in cells or (k, k + 1) in cells)]
    if not diag: return None
    cracks = rng.sample(diag, min(len(diag), rng.choice((1, 2, 2))))
    start = min(cs, key=lambda c: c[0] + c[1] + rng.random() * 2)
    others = [c for c in cs if c != start]
    stone = rng.choice(others)
    ring_src = max([c for c in others if c != stone], key=lambda c: c[0] + c[1] + rng.random() * 2)
    hole_n = rng.choice((1, 2, 2, 3))
    hc = [c for c in others if c not in (ring_src,)]
    holes = rng.sample(hc, min(hole_n, len(hc)))
    grid = {}
    for c in cs: grid[c] = '.'
    for c in holes: grid[c] = 'h'
    grid[start] = 'S'
    if grid.get(stone) == 'h': grid[stone] = 'B'; holes = [h for h in holes if h != stone]
    else: grid[stone] = 'B'
    grid[ring_src] = 'r'
    for c in cracks: grid[c] = 'X'
    # (a stone that starts on a hole's mirror: its 'B' hides the 'h'; keep it a plain stone)
    rows = []
    for gy in range(N - 1, -1, -1):
        rows.append(''.join(grid.get((gx, gy), ' ') for gx in range(N)))
    return {'rows': rows}


def score(b):
    try: t = Trial(b)
    except Exception: return None
    if t.ring is None: return None
    r = t.solve()
    if not r['ok'] or not r['unique'] or r['dead']: return None
    if not (14 <= r['len'] <= 32): return None
    pushes = sum(1 for k in r['kinds'] if k == 'push'); cross = t.crossings(r['path'])
    if pushes < 2 or cross < 1: return None
    if Trial(b, image=False).solve()['ok']: return None
    # (the image must bridge a hole at least once and stand in the way at least once on the way)
    bridged = blocked = False
    for st in r['path']:
        img = t.image_of(st[1])
        if img and img in t.holes and st[0] == img: bridged = True
    for st in r['path']:
        img = t.image_of(st[1])
        if img and img not in t.holes: blocked = True
    if not bridged: return None
    return r['len'] + 3 * pushes + 4 * cross + (2 if blocked else 0), r, t


if __name__ == '__main__':
    N = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    tries = int(sys.argv[2]) if len(sys.argv) > 2 else 20000
    seed = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    rng = random.Random(seed); best = []
    for i in range(tries):
        b = board(rng, N)
        if b is None: continue
        s = score(b)
        if s is None: continue
        best.append((s[0], b, s[1], s[2]))
    best.sort(key=lambda x: -x[0])
    seen = set()
    for sc, b, r, t in best[:40]:
        key = tuple(b['rows'])
        if key in seen: continue
        seen.add(key)
        print('score', sc, 'moves', r['len'], 'pushes', sum(1 for k in r['kinds'] if k == 'push'), 'crossings', t.crossings(r['path']), 'states', r['states'])
        print('  rows', b['rows'])
        print(screen(t)); print()
        if len(seen) >= 8: break
    print(len(best), 'good boards of', tries)
