"""The gears (28/11; the owner, of five mechanical ideas put to him, chose the first: "1", the gears of the Antikythera
mechanism). Theron's great bronze mechanism in the sea, its floors round wheels of slabs that turn.

The rules:
 - A wheel is a round floor three places across: its hub in the middle, and up to four spokes, slabs from the hub to
   its rim (north, east, south, west of the hub); where it has no spoke there is open water. She walks on its hub and
   its spokes as on any slab, and from a spoke's end onto what lies beyond it, if there is a slab or another wheel's
   spoke there.
 - A crank, a bronze handle at a wheel's rim between two of its spokes (a corner of its three places), turns it a
   quarter. She swipes into it from a place beside it and does not move: it turns the way she pushes it (pushed from
   the east it goes round to the west, and so on, as a handle pushed round its wheel).
 - Wheels whose rims touch (their hubs three places apart, in a row or a column) are meshed: when one turns, the other
   turns the other way, and so on along the train.
 - Whatever stands on a wheel turns with it: she rides it round, from one spoke to the next.
 - A column stops her. The sea stops her (no one falls).
 - She reaches the ring: the floor is done.
So she turns wheels to lay a way, rides them to carry herself round, and every turn turns the whole train.

board: rows of cells: '.' the sea, 'o' a slab, '#' a column, 'S' her start, 'G' the ring; a wheel is 'O' its hub, '+'
a spoke (on the four places beside the hub), 'c' a crank (on the four corners about the hub); the other places of a
wheel's three by three are '.'.
usage: python3 -I tools/go/gears_trial.py      (proves the stages and prints their ways)"""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
DV = {v: k for k, v in D4.items()}
ARMS = [(0, -1), (1, 0), (0, 1), (-1, 0)]      # north, east, south, west: a quarter clockwise is the next


def cw(v, k):      # v turned k quarters clockwise (x right, y down)
    for _ in range(k % 4): v = (-v[1], v[0])
    return v


class Board:
    def __init__(s, rows):
        s.rows = rows; s.H = len(rows); s.W = len(rows[0])
        s.land = set(); s.col = set(); s.S = s.G = None
        s.hubs = []; s.spokes = []; s.crank = {}; s.cell = {}      # cell: place -> (wheel, offset) for its hub and arms
        g = lambda x, y: rows[y][x] if 0 <= y < s.H and 0 <= x < s.W else '.'
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                if c == 'O': s.hubs.append((x, y))
        for i, (hx, hy) in enumerate(s.hubs):
            sp = frozenset(a for a in ARMS if g(hx + a[0], hy + a[1]) == '+')
            s.spokes.append(sp); s.cell[(hx, hy)] = (i, (0, 0))
            for a in ARMS: s.cell[(hx + a[0], hy + a[1])] = (i, a)
            for cx in (-1, 1):
                for cy in (-1, 1):
                    if g(hx + cx, hy + cy) == 'c': s.crank[(hx + cx, hy + cy)] = (i, (cx, cy))
        block = {(hx + dx, hy + dy) for hx, hy in s.hubs for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in '+c' and q not in block: raise ValueError('a spoke or crank off its wheel at %s' % (q,))
                if q in block and c not in 'O+c.': raise ValueError('something on a wheel at %s' % (q,))
                if c in 'oSG': s.land.add(q)
                if c == '#': s.col.add(q)
                if c == 'S': s.S = q
                if c == 'G': s.G = q
        # the trains: wheels whose hubs are three apart in a row or a column mesh; each wheel's sense in its train
        n = len(s.hubs); s.train = [-1] * n; s.sense = [1] * n; s.trains = 0
        for i in range(n):
            if s.train[i] >= 0: continue
            s.train[i] = s.trains; dq = deque([i])
            while dq:
                a = dq.popleft()
                for j in range(n):
                    dx, dy = s.hubs[j][0] - s.hubs[a][0], s.hubs[j][1] - s.hubs[a][1]
                    if sorted((abs(dx), abs(dy))) == [0, 3]:
                        if s.train[j] < 0: s.train[j] = s.trains; s.sense[j] = -s.sense[a]; dq.append(j)
                        elif s.sense[j] == s.sense[a]: raise ValueError('a train that jams')
            s.trains += 1

    def rot(s, turns, i):      # wheel i's quarter turns clockwise from where it began
        return (turns[s.train[i]] * s.sense[i]) % 4

    def walk(s, q, turns):
        if q in s.land: return True
        if q not in s.cell: return False
        i, a = s.cell[q]
        if a == (0, 0): return True
        return cw(a, -s.rot(turns, i)) in s.spokes[i]      # (the arm that lies there now began a few quarters back)


def move(b, st, d):
    """one swipe: (kind, new state, what happened); kind: blocked | move | turn | win.
    what happened, for a turn: (wheel driven, its quarters clockwise +1 or -1)"""
    h, turns = st
    q = (h[0] + d[0], h[1] + d[1])
    if q in b.crank:
        i, r = b.crank[q]
        k = r[0] * d[1] - r[1] * d[0]      # pushed round its hub: +1 clockwise, -1 the other way
        t = b.train[i]; nt = list(turns); nt[t] = (nt[t] + k * b.sense[i]) % 4; nt = tuple(nt)
        nh = h
        if h in b.cell and b.train[b.cell[h][0]] == t:      # she rides her wheel round
            j, a = b.cell[h]; hx, hy = b.hubs[j]; a2 = cw(a, k * b.sense[i] * b.sense[j]); nh = (hx + a2[0], hy + a2[1])
        return 'turn', (nh, nt), (i, k)
    if not b.walk(q, turns) or q in b.col: return 'blocked', None, None
    if q == b.G: return 'win', None, None
    return 'move', (q, turns), None


def start(b): return (b.S, tuple([0] * b.trains))


def analyse(b, count=True, cap=500000):
    s0 = start(b); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            k, n, ev = move(b, s, d)
            if k == 'win': wins.add(s); edges[s].append((d, 'win'))
            elif k in ('move', 'turn'):
                edges[s].append((d, n))
                if n not in seen:
                    seen.add(n); dq.append(n)
                    if len(seen) > cap: return None
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
    path = []; s = s0; feats = dict(turns=0, rides=0, cranks=set(), back=0); last = None
    while True:
        if dist[s] == 1: path.append(next(d for d, n in edges[s] if n == 'win')); break
        for d, n in edges[s]:
            if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1:
                k, _, ev = move(b, s, d)
                if k == 'turn':
                    feats['turns'] += 1; feats['rides'] += n[0] != s[0]; feats['cranks'].add((s[0][0] + d[0], s[0][1] + d[1]))
                    if last and last[0] == 'turn' and last[1][0] == ev[0] and last[1][1] == -ev[1]: feats['back'] += 1
                elif last and last[0] == 'move' and last[1] == (-d[0], -d[1]): feats['back'] += 1
                last = (k, ev if k == 'turn' else d)
                path.append(d); s = n; break
    feats['cranks'] = len(feats['cranks'])
    return dict(L=dist[s0], ways=cnt(s0) if count else None, states=len(seen), path=path, **feats)


def trace(b, path):
    st = start(b)
    for i, d in enumerate(path):
        k, n, ev = move(b, st, d); print(i + 1, D4[d], k, n or '', ev or '')
        if k not in ('move', 'turn'): break
        st = n


STAGES = [
    # (found by annealing: a score for the way's length, one way, the turns, the rides, the cranks used, every crank
    # and wheel needed, the meshing needed, few slabs, and how rarely a player swiping at random comes through; then
    # pruned of slabs, spokes and cranks that changed nothing)
    # the wheel: turn it from the slab to bring its one spoke round to her, then ride it three quarters round, crank by
    # crank, to face the ring
    ('the wheel', ['c.co.', '+O.oS', 'c....', '.G...']),
    # two wheels: each turned and ridden in turn; the second's crank turned from the slab between them
    ('two wheels', ['.c+coc.c', 'S.O.o.O+', 'oc.....c', '......G.']),
    # the pair: meshed, they turn each the other way; riding the far one brings its spoke to meet the near one's
    ('the pair', ['.G.......', 'c..c.co.S', '.O++O.ooo', 'c.c......']),
    # from afar: three meshed; a wheel with no spoke turns the whole train from the far slab
    ('from afar', ['..coo.', '.O..o.', '....S.', 'c.c..c', '+O..O+', 'c..c.c', '.G....']),
    # the mechanism: four wheels in two trains; a crank of the one turned from a spoke of the other
    ('the mechanism', ['.oooc....+.', 'So.o.O+o.O.', '....c.c.c..', '.....c.c..c', '....G.O..O.', '......+.c+c']),
]

if __name__ == '__main__':
    for name, rows in STAGES:
        b = Board(rows); r = analyse(b)
        if r is None: print(name, 'no way'); continue
        print('%s: %d swipes (%s), ways %s, %d states; turns %d, rides %d, cranks %d, back %d' % (
            name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'], r['states'], r['turns'], r['rides'], r['cranks'],
            r['back']))
