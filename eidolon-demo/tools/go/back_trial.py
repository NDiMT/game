"""Level 6 trial, "Behind your back" (26/11, the second of the owner's "new ideas, isometric"; a sun that turns the
columns' shadows into ways over the sea was tried first and dropped: it came out a maze, 22 to 46 states, almost no
wrong turn): the statues move only when she is not looking at them.

She faces the way she last stepped. After each of her steps, every statue that is not in front of her (in the half of
the world she faces) takes one step toward her: along the way it is farther from her first, the other way if that one is
shut; never onto the sea, a column or another statue. A statue that steps onto her takes her (start again). She cannot
walk into a statue. A plate holds its bridges up while she or a statue stands on it; a bridge that sinks takes whoever
stands on it.

cells: 'o' slab, '~' sea, '#' column, 'S' her start, 'G' the ring, 'M' a statue (on a slab), 'a'/'b' plates,
'A'/'B' one-place bridges up while a plate of their letter is held. She starts facing f0 (a direction).

usage: python3 -I tools/go/back_trial.py      (proves the boards and prints their ways)"""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
DV = {v: k for k, v in D4.items()}


class Board:
    def __init__(s, rows, f0=(0, -1)):
        s.rows = rows; s.H = len(rows); s.W = len(rows[0]); s.f0 = f0
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
    def stand(s, q, ups): return s.inside(q) and (q in s.slab or q in s.plate or (q in s.bridge and s.bridge[q] in ups))


def sgn(v): return (v > 0) - (v < 0)


def move(b, st, d):
    """one swipe: (kind, new state, what happened); kind: blocked | move | win | caught | fell"""
    h, f, ms = st
    q = (h[0] + d[0], h[1] + d[1])
    ups = b.ups((h,) + tuple(ms))
    if q in ms or not b.stand(q, ups): return 'blocked', None, None
    if q == b.G: return 'win', None, None
    nf = d
    ups = b.ups((q,) + tuple(ms))
    cur = set(ms); moved = []
    for m in sorted(ms, key=lambda m: (abs(m[0] - q[0]) + abs(m[1] - q[1]), m)):
        if (m[0] - q[0]) * nf[0] + (m[1] - q[1]) * nf[1] > 0: continue      # in front of her: it keeps still
        dx, dy = q[0] - m[0], q[1] - m[1]
        tries = [(sgn(dx), 0), (0, sgn(dy))] if abs(dx) >= abs(dy) else [(0, sgn(dy)), (sgn(dx), 0)]
        for t in tries:
            if t == (0, 0): continue
            n = (m[0] + t[0], m[1] + t[1])
            if n == q: return 'caught', None, m
            if n in cur or not b.stand(n, ups): continue
            cur.discard(m); cur.add(n); moved.append((m, n)); break
    ups = b.ups((q,) + tuple(cur))
    if q in b.bridge and b.bridge[q] not in ups: return 'fell', None, None
    sunk = {m for m in cur if m in b.bridge and b.bridge[m] not in ups}
    cur -= sunk
    return 'move', (q, nf, frozenset(cur)), (moved, sunk)


def analyse(b, ms=None, count=True):
    s0 = (b.S, b.f0, frozenset(b.M if ms is None else ms)); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
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
    return dict(L=dist[s0], ways=cnt(s0) if count else None, states=len(seen), dead=dead, path=path)


def show(b, st):
    h, f, ms = st; ups = b.ups((h,) + tuple(ms)); out = []
    for y in range(b.H):
        row = ''
        for x in range(b.W):
            q = (x, y)
            ch = '@' if q == h else 'M' if q in ms else 'G' if q == b.G else b.rows[y][x].replace('S', 'o').replace('M', 'o')
            if q in b.bridge and q not in ms and q != h: ch = b.bridge[q] if b.bridge[q] in ups else '~'
            row += ch + ' '
        out.append(row)
    return '\n'.join(out) + '\n facing ' + D4[f]


def trace(b, path):
    st = (b.S, b.f0, frozenset(b.M)); print(show(b, st)); print()
    for i, d in enumerate(path):
        k, n, ev = move(b, st, d); print(i + 1, D4[d], k, ev or '')
        if k != 'move': break
        st = n; print(show(b, st)); print()


# the boards (26/11), each one way, she starting faced up the board: the first teaches (the statue comes behind her onto
# the plate and holds the bridge); the others found by annealing (in the scratchpad's way: rewarding a bridge she stands
# on held by a statue on its plate, swipes beside the way that would let one take her, statues held still by her look;
# punishing a step back and forth to let them come, which the first finds were full of; every statue, plate and bridge
# needed), then pruned. A player swiping at random wins 7%, 4% and 0% of tries in 150 swipes. Playable, isometric:
# design/level6/back/play.html.
BOARDS = [
    ('behind you', ['~~G~~', '~~A~~', 'Moao~', '~~S~~']),                                                  # 3  UUU
    ('two plates', ['G~~~~~', 'Aoo~~~', '~aooM~', '~ooA~~', 'Mo~aAM', '~~~a~a', '~~~oSo']),               # 20 RLLUURRDDLLUUULUULLU
    ('the lure', ['~~~GAA', '~~~~~a', '~~~~ao', '~AooM~', '~o~~a~', '~aoaa~', '~~SoaM']),                  # 15 RLULUURRRURUULL
    ('the bridge that sinks', ['~~GM~~', '~AAa~~', '~a~~~~', '~aAA~~', '~o~o~~', '~o~a~~', '~oSoM~']),    # 18 LUUURRDDDLLUUUUURU
]

if __name__ == '__main__':
    for name, rows in BOARDS:
        b = Board(rows); r = analyse(b)
        print('%s: %d swipes (%s), one way: %s, %d states, %d dead' % (
            name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'] == 1, r['states'], r['dead']))
