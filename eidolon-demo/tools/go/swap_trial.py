"""Level 6 trial, "From statue to statue" (26/11; the owner, of three flat samples: "wtf no", then "new ideas,
isometric"): her soul passes along her gaze into a statue she sees, and they change places.

A swipe walks her onto the next place if she can stand there (a slab, a plate, the ring, a raised bridge) and no statue
stands on it. Otherwise she looks that way, over the sea and flat stone, as far as a column: the first statue she sees
there takes her place, and she takes its. So she crosses the sea, and the statue she leaves stands where she stood.
A plate holds its bridges up while she or a statue stands on it; a bridge that sinks takes whoever stands on it.

cells: 'o' slab, '~' sea, '#' column (stops her and her look), 'S' her start, 'G' the ring, 'M' a statue (on a slab),
'a'/'b' plates, 'A'/'B' one-place bridges over the sea, up while a plate of their letter is held."""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
DV = {v: k for k, v in D4.items()}


class Board:
    def __init__(s, rows):
        s.rows = rows; s.H = len(rows); s.W = len(rows[0])
        s.slab = set(); s.col = set(); s.plate = {}; s.bridge = {}; s.M = []
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in 'oSGM': s.slab.add(q)
                if c == '#': s.col.add(q)
                if c in 'ab': s.plate[q] = c.upper()
                if c in 'AB': s.bridge[q] = c
                if c == 'S': s.S = q
                if c == 'G': s.G = q
                if c == 'M': s.M.append(q)

    def inside(s, q): return 0 <= q[0] < s.W and 0 <= q[1] < s.H
    def ups(s, held): return {s.plate[q] for q in held if q in s.plate}
    def stand(s, q, ups): return q in s.slab or q in s.plate or (q in s.bridge and s.bridge[q] in ups)


def move(b, st, d):
    """one swipe: (kind, new state, what happened); kind: blocked | move | win | fell"""
    h, ms = st
    ups = b.ups((h,) + tuple(ms))
    q = (h[0] + d[0], h[1] + d[1])
    if not b.inside(q) or q in b.col: return 'blocked', None, None
    if q not in ms and b.stand(q, ups):
        nh, nms, ev = q, ms, ('walk',)
    else:
        p = q
        while b.inside(p) and p not in b.col and p not in ms: p = (p[0] + d[0], p[1] + d[1])
        if not b.inside(p) or p in b.col: return 'blocked', None, None
        nh, nms, ev = p, (ms - {p}) | {h}, ('swap', p)
    ups = b.ups((nh,) + tuple(nms))
    if nh in b.bridge and b.bridge[nh] not in ups: return 'fell', None, ev
    sunk = {m for m in nms if m in b.bridge and b.bridge[m] not in ups}
    if sunk: nms = nms - sunk; ev = ev + (('sunk',) + tuple(sorted(sunk)),)
    if nh == b.G: return 'win', None, ev
    return 'move', (nh, frozenset(nms)), ev


def analyse(b, ms=None, count=True):
    s0 = (b.S, frozenset(b.M if ms is None else ms)); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            kind, n, ev = move(b, s, d)
            if kind == 'win': wins.add(s); edges[s].append((d, 'win'))
            elif kind == 'move' and n != s:
                edges[s].append((d, n))
                if n not in seen: seen.add(n); dq.append(n)
    if not wins: return None
    dist = {w: 1 for w in wins}; rev = {}
    for s, l in edges.items():
        for d, n in l:
            if n != 'win': rev.setdefault(n, []).append(s)
    dq = deque(wins)
    while dq:
        s = dq.popleft()
        for p in rev.get(s, []):
            if p not in dist: dist[p] = dist[s] + 1; dq.append(p)
    if s0 not in dist: return None
    memo = {}
    def cnt(s):
        if s in memo: return memo[s]
        if dist[s] == 1: v = sum(1 for d, n in edges[s] if n == 'win')
        else: v = sum(cnt(n) for d, n in edges[s] if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1)
        memo[s] = min(v, 99); return memo[s]
    path = []; s = s0
    while True:
        if dist[s] == 1: path.append(next(d for d, n in edges[s] if n == 'win')); break
        for d, n in edges[s]:
            if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1: path.append(d); s = n; break
    dead = sum(1 for s in seen if s not in dist)
    return dict(L=dist[s0], ways=cnt(s0) if count else None, states=len(seen), dead=dead, path=path)


def show(b, st):
    h, ms = st; ups = b.ups((h,) + tuple(ms)); out = []
    for y in range(b.H):
        row = ''
        for x in range(b.W):
            q = (x, y)
            ch = '@' if q == h else 'M' if q in ms else 'G' if q == b.G else b.rows[y][x].replace('S', 'o').replace('M', 'o')
            if q in b.bridge and q not in ms and q != h: ch = b.bridge[q] if b.bridge[q] in ups else '~'
            row += ch + ' '
        out.append(row)
    return '\n'.join(out)


def trace(b, path):
    st = (b.S, frozenset(b.M)); print(show(b, st)); print()
    for i, d in enumerate(path):
        k, n, ev = move(b, st, d); print(i + 1, D4[d], k, ev or '')
        if k != 'move': break
        st = n; print(show(b, st)); print()


# the boards (26/11), each one way: the first two teach (the look across the sea; the statue left on the plate, which
# holds the bridge); the others found by annealing (in the scratchpad's way: rewarding swaps, statues set on plates, a
# statue used twice, a near statue that hides a far one; every statue, plate and bridge needed), then pruned of every
# cell that changed nothing (keeping most of the wrong turns). Playable, drawn isometric: design/level6/swap/play.html.
BOARDS = [
    ('the look', ['S~~M', '~~~o', '~~~G']),                                                          # 3  RDD
    ('the plate', ['~~~~G', '~~~~A', 'Sa~~M']),                                                      # 4  RRUU
    ('three islands', ['Goa~~~', '~~o~~~', 'MoAMa~', '~~~~~~', '~~ooo~', '~~~~M~', 'Soo~a~']),       # 14 URRRDDLRURUULL
    ('beside the gate', ['MG~~~~', '~~~~~~', '~~oo~~', '~M~o~~', 'aAao~~', '~Ma~~~', '~S~~~~']),     # 18 URURULDUURDLDLULUR
    ('four islands', ['~G~~~~', 'aa~~~~', 'o~~~~~', 'a~~~aM', 'Ao~~~~', '~A~oMa', 'Mo~oS~']),        # 16 URULDLLRUULUUURU
]

if __name__ == '__main__':
    for name, rows in BOARDS:
        b = Board(rows); r = analyse(b)
        print('%s: %d swipes (%s), one way: %s, %d states, %d dead' % (
            name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'] == 1, r['states'], r['dead']))
