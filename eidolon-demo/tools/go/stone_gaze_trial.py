"""Level 6 trial, "The gaze that turns to stone" (25/11; the owner, of ten ideas of machines: "what the hell are these, I
want something very clever"; the cunning he means is Odysseus', the polymechanos: making one danger undo another).

Two dangers the player already knows, and one trick between them:
- the Faithful (level 6's statue): two steps toward her for each of hers, sideways (the board's x) first, never a step
  away; reaching her, she starts over; onto the cracked slab, it sinks (the crack holds her, a soul, not it);
- the Guardian (level 5's): he stands in the water and turns a quarter clockwise at each of her moves; his gaze runs
  straight out over slabs and water to the board's edge; seen, she starts over; she may not step into it as it lies.
The new rule, the only one: his gaze turns to stone the first statue it falls on. The Faithful, caught in it, is a stone
pillar from then on: it moves no more, and it stops his gaze, and it stops her too.

The trick: the statue that hunts her is the only thing that can shield her from the gaze. She must lead it, at the right
turn, to the one place where, turned to stone, it hides her way to the gate. The crack, which saved her in level 6, is
a lure here: sunk, the Faithful can shield no one.

A board: rows of cells: 'o' a slab, '~' water, 'S' her start, 'F' the Faithful, 'C' the cracked slab, 'G' the ring
before the gate, 'W' the Guardian (in the water), '#' a column (blocks feet and gaze); `face` is his first look: 'N',
'E', 'S' or 'W' (N up the board).

usage: python3 -I tools/go/stone_gaze_trial.py      (proves LEVEL and prints its way, step by step)"""
import sys
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
LOOK = [(0, -1), (1, 0), (0, 1), (-1, 0)]      # (N, E, S, W: a quarter clockwise each move)
MOVING, STONE, GONE = 0, 1, 2


class Board:
    def __init__(s, rows, face='N'):
        s.H = len(rows); s.W = len(rows[0]); s.slab = set(); s.cols = set(); s.C = None
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                if c in 'oSFCG': s.slab.add((x, y))
                if c == '#': s.cols.add((x, y))
                if c == 'S': s.S = (x, y)
                if c == 'F': s.F = (x, y)
                if c == 'C': s.C = (x, y)
                if c == 'G': s.G = (x, y)
                if c == 'W': s.Wg = (x, y)
        s.f0 = 'NESW'.index(face)

    def inside(s, c): return 0 <= c[0] < s.W and 0 <= c[1] < s.H

    def open(s, a, b):
        return b in s.slab and a in s.slab and abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1


def statue_steps(b, m, h, stone=None):
    """the Faithful's two steps toward her (x first, never away); None after the place where it sank"""
    out = []
    for _ in range(2):
        dx, dy = h[0] - m[0], h[1] - m[1]; n = m
        sx = (m[0] + (1 if dx > 0 else -1), m[1]); sy = (m[0], m[1] + (1 if dy > 0 else -1))
        if dx and b.open(m, sx) and sx != b.G: n = sx
        elif dy and b.open(m, sy) and sy != b.G: n = sy
        m = n; out.append(m)
        if m == h: break
        if m == b.C: out.append(None); break
    return out


def gaze(b, ph, h, m, mode):
    """the cells his gaze crosses in turn, and what it falls on first: 'her', 'statue', or None"""
    d = LOOK[(b.f0 + ph) % 4]; c = b.Wg; cells = []
    while True:
        c = (c[0] + d[0], c[1] + d[1])
        if not b.inside(c) or c in b.cols: return cells, None
        cells.append(c)
        if c == h: return cells, 'her'
        if mode != GONE and c == m: return cells, 'statue'


def move(b, st, d, stone_rule=True):
    """one swipe: ('blocked'|'win'|'caught'|'move', new state, what happened on the way)"""
    h, m, mode, ph = st
    q = (h[0] + d[0], h[1] + d[1])
    if not b.open(h, q) or (mode != GONE and q == m): return 'blocked', None, None
    if q == b.G: return 'win', None, None
    _, hit = gaze(b, ph, q, m, mode)
    if hit == 'her': return 'caught', None, 'stepped into his gaze'
    ev = []
    if mode == MOVING:
        steps = statue_steps(b, m, q)
        if steps[-1] is None: mode = GONE; m = None; ev.append('sank')
        else:
            m = steps[-1]
            if m == q: return 'caught', None, 'the Faithful reached her'
    ph = (ph + 1) % 4
    _, hit = gaze(b, ph, q, m, mode)
    if hit == 'her': return 'caught', None, 'he turned and saw her'
    if hit == 'statue' and mode == MOVING:
        if not stone_rule: return 'caught', None, 'no stone allowed'      # (to test whether the stone is needed)
        mode = STONE; ev.append('stone')
    return 'move', (q, m, mode, ph), ev


def analyse(b, stone_rule=True):
    s0 = (b.S, b.F, MOVING, 0); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            kind, n, _ = move(b, s, d, stone_rule)
            if kind == 'win': wins.add(s); edges[s].append((d, 'win'))
            elif kind == 'move':
                edges[s].append((d, n))
                if n not in seen: seen.add(n); dq.append(n)
    if not wins: return None
    dist = {s: 1 for s in wins}; rev = {}
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
    dead = {s for s in seen if s not in dist}
    alive = set(dead); ch = True
    while ch:
        ch = False
        for s in list(alive):
            if not any(n in alive for d, n in edges[s] if n != 'win'): alive.discard(s); ch = True
    path = []; s = s0
    while True:
        if dist[s] == 1: path.append(next(d for d, n in edges[s] if n == 'win')); break
        for d, n in edges[s]:
            if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1: path.append(d); s = n; break
    return dict(L=dist[s0], ways=cnt(s0), states=len(seen), dead=len(dead), limbo=len(alive),
                limbo_alive=sum(1 for s in alive if s[2] != GONE), path=path,
                gone_reachable=any(s[2] == GONE for s in seen), gone_wins=any(s[2] == GONE for s in dist))


def show(b, h=None, m=None, mode=MOVING, ph=0):
    cells, _ = gaze(b, ph, h if h else b.S, m if m else b.F, mode)
    out = []
    for y in range(b.H):
        row = ''
        for x in range(b.W):
            q = (x, y)
            if q == h: ch = '@'
            elif m and q == m: ch = 'M' if mode == MOVING else 'X'
            elif q == b.Wg: ch = 'NESW'[(b.f0 + ph) % 4]
            elif q in b.cols: ch = '#'
            elif q == b.G: ch = 'G'
            elif q == b.C and mode != GONE: ch = 'C'
            elif q in b.slab: ch = '*' if q in cells else 'o'
            else: ch = ':' if q in cells else '~'
            row += ch + ' '
        out.append(row)
    return '\n'.join(out)


def trace(b, path):
    st = (b.S, b.F, MOVING, 0)
    print(show(b, st[0], st[1], st[2], st[3])); print()
    for i, d in enumerate(path):
        kind, n, ev = move(b, st, d)
        print('%d %s %s %s' % (i + 1, D4[d], kind, ' '.join(ev) if isinstance(ev, list) else (ev or '')))
        if kind != 'move': break
        st = n
        print(show(b, st[0], st[1], st[2], st[3])); print()


# the board (25/11): found by simulated annealing (one way, no limbo at all, the stone needed, the crack a lure, the
# stone shielding her at least once), 27 swipes. The Guardian stands in the water at the foot of the corridor that runs
# up to the gate; the Faithful waits at its head, beside the ring. She lures it down the corridor, timing her dance at
# the bottom so that it comes level with him as he turns north: it turns to stone at the corridor's foot, and from then
# on his gaze up the corridor stops at it; she climbs the corridor behind it. Sunk in the crack, it shields no one: the
# corridor is swept every fourth move and she is seen.
LEVEL = (["~~oFoG",
          "~~~o~~",
          "~ooooC",
          "oooo~~",
          "S~oWoo",
          "~oooo~"], 'E')
# a second (24 swipes), a column at the corridor's side
LEVEL_B = (["~o~~~G",
            "ooo#~F",
            "o~o~~o",
            "ooSooo",
            "CW~~~~",
            "o~~~~~"], 'S')

if __name__ == '__main__':
    b = Board(*LEVEL); r = analyse(b)
    print('way %d swipes (%s), one way: %s, %d states, %d dead, limbo %d (%d before it sinks)' % (
        r['L'], ''.join(D4[d] for d in r['path']), r['ways'] == 1, r['states'], r['dead'], r['limbo'], r['limbo_alive']))
    print('without the stone: %s' % ('no way' if analyse(b, False) is None else 'a way'))
    trace(b, r['path'])
