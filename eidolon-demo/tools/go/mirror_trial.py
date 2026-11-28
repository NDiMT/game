"""The mirror (28/11; the owner, of four ideas for puzzles where she moves many statues: "4, the one goes up, the other
goes down"). Her image: a statue of her that takes every step she takes, mirrored: when she goes up the board it goes
down, when she goes down it goes up; left and right it goes her way, as an image in still water.

The rules:
 - Each swipe moves her and her image together, each one place, she the way of the swipe, it the mirrored way. Each is
   stopped on its own by the sea, a column or a bridge that is down, and stays where it is while the other goes.
 - They are bodies: neither steps into the other; if both would come to one place, or pass through each other, neither
   moves.
 - Plates and bridges (the sixth level's): a plate holds the bridges of its letter up while she or her image stands on
   it; a bridge that sinks takes whoever stands on it, and the floor begins again.
 - The floor is done when she stands in her ring and her image in its own, at once.
So the edges and the columns are how she sets herself and her image apart.

board: rows of cells: '.' the sea, 'o' a slab, '#' a column, 'S' her start, 's' her image's start, 'G' her ring,
'g' her image's ring, 'a' 'b' plates, 'A' 'B' bridges.
usage: python3 -I tools/go/mirror_trial.py      (proves the stages and prints their ways)"""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
DV = {v: k for k, v in D4.items()}


def mirror(d): return (d[0], -d[1])


class Board:
    def __init__(s, rows):
        s.rows = rows; s.H = len(rows); s.W = len(rows[0])
        s.floor = set(); s.plate = {}; s.bridge = {}; s.S = s.s = s.G = s.g = None
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in 'oSsGgab': s.floor.add(q)
                if c == 'S': s.S = q
                if c == 's': s.s = q
                if c == 'G': s.G = q
                if c == 'g': s.g = q
                if c in 'ab': s.plate[q] = c.upper()
                if c in 'AB': s.bridge[q] = c

    def ups(s, held):
        return frozenset(s.plate[q] for q in held if q in s.plate)

    def stand(s, q, up):
        return q in s.floor or (q in s.bridge and s.bridge[q] in up)


def move(b, st, d):
    """one swipe: (kind, new state); kind: blocked (no one moves) | move | win | fell"""
    h, m = st
    up = b.ups([h, m])
    th = (h[0] + d[0], h[1] + d[1]); e = mirror(d); tm = (m[0] + e[0], m[1] + e[1])
    if not b.stand(th, up): th = h
    if not b.stand(tm, up): tm = m
    while True:      # (bodies: settle who is stopped by whom)
        if th == tm and (th != h or tm != m): th, tm = h, m; continue
        if th == m and tm == h and th != h: th, tm = h, m; continue
        if th == m and tm == m and th != h: th = h; continue
        if tm == h and th == h and tm != m: tm = m; continue
        break
    if th == h and tm == m: return 'blocked', None
    up2 = b.ups([th, tm])
    if any(q in b.bridge and b.bridge[q] not in up2 for q in (th, tm)): return 'fell', None
    if th == b.G and tm == b.g: return 'win', None
    return 'move', (th, tm)


def start(b): return (b.S, b.s)


def analyse(b, count=True):
    s0 = start(b); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            k, n = move(b, s, d)
            if k == 'win': wins.add(s); edges[s].append((d, 'win'))
            elif k == 'move':
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
    path = []; s = s0; apart = 0; held = 0
    while True:
        if dist[s] == 1: path.append(next(d for d, n in edges[s] if n == 'win')); break
        for d, n in edges[s]:
            if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1:
                apart += (n[0] == s[0]) != (n[1] == s[1])      # (one of them stopped, the other went)
                held += any(q in b.bridge for q in n)
                path.append(d); s = n; break
    dead = sum(1 for s in seen if s not in dist)
    return dict(L=dist[s0], ways=cnt(s0) if count else None, states=len(seen), dead=dead, path=path, apart=apart, held=held)


def trace(b, path):
    st = start(b)
    for i, d in enumerate(path):
        k, n = move(b, st, d); print(i + 1, D4[d], k, n or '')
        if k != 'move': break
        st = n


STAGES = [
    # (found by annealing: a score for the way's length, one way, the steps where one is stopped and the other goes, the
    # bridges crossed, every bridge needed, no step back; then pruned of slabs that changed nothing, a hole within the
    # island stood as a column, which stops as the sea does)
    # the image: she and her image start a row apart; the edges stop one and not the other until each stands by its ring
    ('the image', ["gs#o", "oooG", ".#o.", "Soo."]),
    # apart: they would meet in the middle and stop each other; one must be held by the edge while the other goes round
    ('apart', [".o.s.", "oo#o.", ".oooG", "..g#.", "..ooS"]),
    # the bridge: one of them holds the plate while the other crosses the bridge it raises
    ('the bridge', [".oa#s", ".GooA", "oo#S#", "...og"]),
    # the plate: many ways to set them wrong (98 places they can no longer come out of)
    ('the plate', ["S...a", "ooooo", "so#AG", "...o.", "oooo.", "goooo"]),
    # two bridges: each holds a plate for the other in turn
    ('two bridges', ["GoBo..", ".A#g..", ".oooo.", ".#bao.", "Soosoo"]),
]

if __name__ == '__main__':
    for name, rows in STAGES:
        b = Board(rows); r = analyse(b)
        if r is None: print(name, 'no way'); continue
        print('%s: %d swipes (%s), ways %s, %d states, %d dead; apart %d, on bridges %d' % (
            name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'], r['states'], r['dead'], r['apart'], r['held']))
