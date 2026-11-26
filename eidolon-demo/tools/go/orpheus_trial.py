"""Level 6 trial, "Don't look back" (26/11; the Orpheus idea of the research's ten, made playable as the owner asked:
"make them as previews I can play"), with a soul that waits. A first version, the soul always one step behind, came
out a maze: her place and the soul's were one and the same choice, so there was nothing to decide. The waiting soul
gives the board a memory.

Her soul follows one step behind: after each of her steps it steps where she stood, if that place is beside it and will
still bear it once it stands there. Otherwise it waits where it is (it never falls). She must never look at it: if,
after her step, the soul stands anywhere on the straight line she now faces (over slabs and water, as far as a rock),
she has looked back and it is lost; walking into it is the same. A plate holds its bridges up while someone stands on
it; she must not be left on a bridge that sinks. The gate lets her through only with the soul following her.

cells: 'o' slab, '~' sea, '#' rock (stops sight), 'S' her start, 'E' the soul (beside S), 'G' the ring,
'a'/'b' plates, 'A'/'B' one-place bridges, up while any plate of their letter is held."""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
DV = {v: k for k, v in D4.items()}


class Board:
    def __init__(s, rows):
        s.rows = rows; s.H = len(rows); s.W = len(rows[0])
        s.slab = set(); s.plate = {}; s.bridge = {}; s.rock = set()
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in 'oSEG': s.slab.add(q)
                if c in 'ab': s.plate[q] = c.upper()
                if c in 'AB': s.bridge[q] = c
                if c == '#': s.rock.add(q)
                if c == 'S': s.S = q
                if c == 'E': s.E = q
                if c == 'G': s.G = q

    def inside(s, q): return 0 <= q[0] < s.W and 0 <= q[1] < s.H
    def ups(s, held): return {s.plate[q] for q in held if q in s.plate}
    def walk(s, q, ups): return q in s.slab or q in s.plate or (q in s.bridge and s.bridge[q] in ups)

    def sees(s, q, d, e):
        p = (q[0] + d[0], q[1] + d[1])
        while s.inside(p) and p not in s.rock:
            if p == e: return True
            p = (p[0] + d[0], p[1] + d[1])
        return False


def adj(a, c): return abs(a[0] - c[0]) + abs(a[1] - c[1]) == 1


def move(b, st, d):
    """one swipe: (kind, new state, what happened); kind: blocked | move | win | looked | fell"""
    h, e = st
    q = (h[0] + d[0], h[1] + d[1])
    if q == e: return 'looked', None, 'into'
    if not b.walk(q, b.ups((h, e))): return 'blocked', None, None
    f = e
    if adj(e, h) and b.walk(h, b.ups((q, e))) and b.walk(h, b.ups((q, h))): f = h
    ev = 'follows' if f == h else 'waits'
    if q in b.bridge and b.bridge[q] not in b.ups((q, f)): return 'fell', None, ev
    if b.sees(q, d, f): return 'looked', None, ev
    if q == b.G and f == h: return 'win', None, ev
    return 'move', (q, f), ev


def analyse(b):
    s0 = (b.S, b.E); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            kind, n, ev = move(b, s, d)
            if kind == 'win': wins.add(s); edges[s].append((d, 'win'))
            elif kind == 'move':
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
    return dict(L=dist[s0], ways=cnt(s0), states=len(seen), dead=dead, path=path)


def show(b, st):
    h, e = st; ups = b.ups((h, e)); out = []
    for y in range(b.H):
        row = ''
        for x in range(b.W):
            q = (x, y)
            ch = '@' if q == h else '&' if q == e else 'G' if q == b.G else b.rows[y][x].replace('S', 'o').replace('E', 'o')
            if q in b.bridge and q not in (h, e): ch = b.bridge[q] if b.bridge[q] in ups else '~'
            row += ch + ' '
        out.append(row)
    return '\n'.join(out)


def trace(b, path):
    st = (b.S, b.E); print(show(b, st)); print()
    for i, d in enumerate(path):
        k, n, ev = move(b, st, d); print(i + 1, D4[d], k, ev or '')
        if k != 'move': break
        st = n; print(show(b, st)); print()


# the boards (26/11), each one way: the first two teach (the bridge each holds for the other; turning back by letting
# the soul wait on the plate while she walks round the bridges it holds); the others found by annealing (in the
# scratchpad's way: rewarding the soul waiting, parked on a plate while she crosses a bridge it holds, and swipes that
# would look at a waiting soul; bridges no plate raises taken out). Playable: design/level6/orpheus/play.html.
BOARDS = [
    ('the bridge', ['~G~', '~a~', '~A~', '~a~', '~S~', '~E~']),                                         # 4  UUUU
    ('the turn', ['~~~~', '~aA~', '~SA~', '~E~~', '~o~~', '~G~~']),                                     # 7  URDLDDD
    ('the wait', ['oo~~oG', 'o~~~Aa', 'oo~~a~', 'aA~~oo', 'SA~~o~', 'EoaAa~']),                         # 15 URDLDRRRRUUUURU
    ('the great round', ['~~aG~o', '~aAooo', '~oo~~~', '~~aAAo', '~~Aoao', '~~aAS~', '~oooE~']),         # 20 UULLDDRRDLLUUUULURUR
]

if __name__ == '__main__':
    for name, rows in BOARDS:
        b = Board(rows); r = analyse(b)
        print('%s: %d swipes (%s), one way: %s, %d states, %d dead' % (
            name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'] == 1, r['states'], r['dead']))
