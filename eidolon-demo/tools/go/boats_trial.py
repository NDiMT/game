"""Level 6 trial, "The still water" (26/11; the owner: "not again with stones you push", then "make them as previews I
can play, and then we move it into the game with proper graphics"): boats glide on glass water until they strike
something; a boat struck passes the knock on, as in Newton's cradle. Nobody pushes anything from land.

cells: 'o' slab, '~' water, '#' rock (in the water), 'S' her start (slab), 'B' a boat (on water), 'G' the ring (slab).
She walks on slabs and steps onto a boat beside her, from boat to boat, and off a boat onto a slab. On a boat, a swipe
toward open water sets it gliding with her until the next place is a slab or a rock (it docks there), or a boat: then
hers stops short of it and the knock passes through the row of boats touching it to the last, which glides on (and may
strike another: the knock passes again). Off the board is the open sea: a boat that glides out is lost, and with her on
it she is lost (start again).

usage: python3 -I tools/go/boats_trial.py      (proves the boards and prints their ways)"""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
DV = {v: k for k, v in D4.items()}


class Board:
    def __init__(s, rows):
        s.H = len(rows); s.W = len(rows[0]); s.slab = set(); s.rock = set(); s.B = []
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in 'oSG': s.slab.add(q)
                if c == '#': s.rock.add(q)
                if c == 'S': s.S = q
                if c == 'G': s.G = q
                if c == 'B': s.B.append(q)
        s.rows = rows

    def inside(s, q): return 0 <= q[0] < s.W and 0 <= q[1] < s.H


def glide(b, boats, p, d, ev):
    """boat at p (already out of `boats`) glides in d; returns where it rests (None: lost); knocks pass on"""
    while True:
        n = (p[0] + d[0], p[1] + d[1])
        if not b.inside(n): ev.append(('lost', p)); return None
        if n in b.slab or n in b.rock: return p
        if n in boats:
            last = n
            while (last[0] + d[0], last[1] + d[1]) in boats: last = (last[0] + d[0], last[1] + d[1])
            ev.append(('knock', p, n, last))
            boats.discard(last)
            r = glide(b, boats, last, d, ev)
            if r is not None: boats.add(r); ev.append(('rest', last, r))
            return p
        p = n


def move(b, st, d):
    """one swipe: (kind, new state, events); kind: blocked | move | win | lost"""
    h, boats = st
    q = (h[0] + d[0], h[1] + d[1])
    if h not in boats:                                  # on a slab
        if q in b.slab or q in boats:
            return ('win' if q == b.G else 'move'), (q, boats), [('step', h, q)]
        return 'blocked', None, None
    if q in b.slab or q in boats: return ('win' if q == b.G else 'move'), (q, boats), [('step', h, q)]
    if q in b.rock: return 'blocked', None, None
    bs = set(boats); bs.discard(h); ev = [('ride', h)]
    r = glide(b, bs, h, d, ev)
    if r is None: return 'lost', None, ev
    bs.add(r); ev.append(('docked', h, r))
    return 'move', (r, frozenset(bs)), ev


def analyse(b, boats=None, need_count=True):
    s0 = (b.S, frozenset(b.B if boats is None else boats)); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            kind, n, ev = move(b, s, d)
            if kind == 'win': wins.add(s); edges[s].append((d, 'win', ev))
            elif kind == 'move' and n != s:
                edges[s].append((d, n, ev))
                if n not in seen: seen.add(n); dq.append(n)
    if not wins: return None
    dist = {w: 1 for w in wins}; rev = {}
    for s, l in edges.items():
        for d, n, ev in l:
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
        if dist[s] == 1: v = sum(1 for d, n, ev in edges[s] if n == 'win')
        else: v = sum(cnt(n) for d, n, ev in edges[s] if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1)
        memo[s] = min(v, 99); return memo[s]
    path = []; evs = []; s = s0
    while True:
        if dist[s] == 1:
            d, n, ev = next(e for e in edges[s] if e[1] == 'win'); path.append(d); evs.append(ev); break
        for d, n, ev in edges[s]:
            if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1: path.append(d); evs.append(ev); s = n; break
    dead = sum(1 for s in seen if s not in dist)
    return dict(L=dist[s0], ways=cnt(s0) if need_count else None, states=len(seen), dead=dead, path=path, evs=evs)


def show(b, st):
    h, boats = st; out = []
    for y in range(b.H):
        row = ''
        for x in range(b.W):
            q = (x, y)
            ch = '@' if q == h and q in boats else '&' if q == h else 'B' if q in boats else 'G' if q == b.G else \
                'o' if q in b.slab else '#' if q in b.rock else '~'
            row += ch + ' '
        out.append(row)
    return '\n'.join(out)


def trace(b, path):
    st = (b.S, frozenset(b.B)); print(show(b, st)); print()
    for i, d in enumerate(path):
        k, n, ev = move(b, st, d); print(i + 1, D4[d], k, ev)
        if k != 'move': break
        st = n; print(show(b, st)); print()


# the boards (26/11), each one way: the first three teach (the glide, the knock, the cradle: the knock passes through the
# row to the last boat); the others found by annealing (in the scratchpad's way: rewarding knocks, cascades, boats
# reused after a knock and every boat needed; capping the way's length and its repeats), then pruned of every cell that
# changed nothing. Playable: design/level6/boats/play.html.
BOARDS = [
    ('the boat', ['~~~~~~', 'SB~~oG', '~~~~~~']),                                            # 4  RRRR
    ('the knock', ['~~~G~~~', '~~~~~~~', 'SB~~B~#']),                                         # 4  RRUU
    ('the cradle', ['~~~~G~~', '~~~~~~~', 'SB~BB~#']),                                        # 6  RRRRUU
    ('the round', ['~~B~G~', '~#~~o~', '~~~~#~', '~B~~~~', '~~~~~#', '~BS#~~']),              # 13 LUUURDRULURRU
    ('the row', ['#G~~~~', '~~~~o~', 'B~~~o~', '~o~~B~', 'B~~~~~', '~~~~~~', 'BS~~~~']),      # 18 LUUUURRDLLLUURDLUU
    ('the passage', ['~GB~~~', '~~~~~~', '~B~~#~', '~#B~~~', '~~~o~~', '#~~~~~', '~~#SB~']),  # 18 RULLDLURRULDDUULUU
]

if __name__ == '__main__':
    for name, rows in BOARDS:
        b = Board(rows); r = analyse(b)
        print('%s: %d swipes (%s), one way: %s, %d states, %d dead' % (
            name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'] == 1, r['states'], r['dead']))
