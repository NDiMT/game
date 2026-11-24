"""Level 6 trial, "The Faithful" (idea 2 of the large research, offered 24/11; the owner: "how would we make 2?"):
Robert Abbott's Theseus and the Minotaur on islets in a still sea.

A veiled statue, the one of Theron's statues that never lets her go to the sea, takes two steps toward her for each of
hers: a step along the board's x if that brings it nearer and the way is open, else a step along y if that does, else
it stands. If it reaches her, she is gone in a red puff and starts over. It never steps away, so water between them
holds it where it stands. A cracked slab lies in the way: it holds her, a soul, but not the statue: lured onto it, the
statue breaks it and sinks, and its veiled head is the stone there now, flush with the way; the Faithful is gone.
She enters the ring before the gate whenever she reaches it, but the statue guards the way there.

A first take had a plate before the gate that held it open only while the statue stood on it; on islet boards it gave
almost no puzzles (the statue, twice as fast, caught her nearly everywhere), so the cracked slab of the offered idea it
is. Without waiting (a swipe is a move) the boards need water between the islets, not open floors.

A board: rows of cells, 'o' a slab, '~' water, 'S' her start, 'F' the statue's, 'C' the cracked slab, 'G' the ring
before the gate (the statue never steps onto it); `cuts` are pairs of adjacent slabs with water between them.

usage: python3 -I tools/go/faithful_trial.py      (proves LEVEL6 and prints its way)"""
import sys
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}


class Board:
    def __init__(s, rows, cuts=()):
        s.H = len(rows); s.W = len(rows[0]); s.slab = set(); s.C = None
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                if c != '~': s.slab.add((x, y))
                if c == 'S': s.S = (x, y)
                if c == 'F': s.F = (x, y)
                if c == 'C': s.C = (x, y)
                if c == 'G': s.G = (x, y)
        s.cuts = {frozenset(map(tuple, c)) for c in cuts}

    def open(s, a, b):
        return b in s.slab and a in s.slab and frozenset((a, b)) not in s.cuts and abs(a[0] - b[0]) + abs(a[1] - b[1]) == 1


def statue(b, m, h, n=2, sink=True):
    """its steps toward her; returns its places after each step (it stops on reaching her); None after the place
    where it sank"""
    out = []
    for _ in range(n):
        dx, dy = h[0] - m[0], h[1] - m[1]; nn = m
        sx = (m[0] + (1 if dx > 0 else -1), m[1]); sy = (m[0], m[1] + (1 if dy > 0 else -1))
        if dx and b.open(m, sx) and sx != b.G: nn = sx
        elif dy and b.open(m, sy) and sy != b.G: nn = sy
        m = nn; out.append(m)
        if m == h: break
        if sink and m == b.C: out.append(None); break
    return out


def moves(b, st, n=2, sink=True):
    h, m = st
    for d in D4:
        q = (h[0] + d[0], h[1] + d[1])
        if not b.open(h, q) or q == m: continue
        if q == b.G: yield d, 'win', None; continue
        if m is None: yield d, 'move', (q, None); continue
        steps = statue(b, m, q, n, sink)
        if steps[-1] == q: yield d, 'caught', None
        else: yield d, 'move', (q, steps[-1])


def analyse(b, n=2, sink=True):
    """the shortest way; how many shortest ways; states reached; states from which the ring can no longer be reached
    (dead); of those, the ones she can wander in for ever without being caught (limbo); the moves until the statue is
    gone on the shortest way (chase)"""
    s0 = (b.S, b.F); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d, kind, nx in moves(b, s, n, sink):
            if kind == 'win': wins.add(s); edges[s].append((d, 'win'))
            elif kind == 'move':
                edges[s].append((d, nx))
                if nx not in seen: seen.add(nx); dq.append(nx)
    if not wins: return None
    dist = {s: 1 for s in wins}; rev = {}
    for s, l in edges.items():
        for d, nx in l:
            if nx != 'win': rev.setdefault(nx, []).append(s)
    dq = deque(wins)
    while dq:
        s = dq.popleft()
        for p in rev.get(s, []):
            if p not in dist: dist[p] = dist[s] + 1; dq.append(p)
    memo = {}
    def cnt(s):
        if s in memo: return memo[s]
        if dist[s] == 1: v = sum(1 for d, nx in edges[s] if nx == 'win')
        else: v = sum(cnt(nx) for d, nx in edges[s] if nx != 'win' and dist.get(nx, 10 ** 9) == dist[s] - 1)
        memo[s] = min(v, 99); return memo[s]
    dead = {s for s in seen if s not in dist}
    alive = set(dead); ch = True
    while ch:
        ch = False
        for s in list(alive):
            if not any(nx in alive for d, nx in edges[s] if nx != 'win'): alive.discard(s); ch = True
    path = []; s = s0
    while True:
        if dist[s] == 1: path.append(next(d for d, nx in edges[s] if nx == 'win')); break
        for d, nx in edges[s]:
            if nx != 'win' and dist.get(nx, 10 ** 9) == dist[s] - 1: path.append(d); s = nx; break
    h, m = b.S, b.F; k = 0
    for d in path:
        if m is None: break
        q = (h[0] + d[0], h[1] + d[1]); k += 1
        if q == b.G: break
        h, m = q, statue(b, m, q, n, sink)[-1]
    return dict(L=dist[s0], ways=cnt(s0), states=len(seen), dead=len(dead), limbo=len(alive), path=path, chase=k)


def show(b, h=None, m=None):
    out = []
    for y in range(b.H):
        row = ''
        for x in range(b.W):
            q = (x, y)
            ch = '~' if q not in b.slab else ('@' if q == h else 'M' if q == m else 'S' if q == b.S and h is None else
                                             'F' if q == b.F and h is None else 'C' if q == b.C else 'G' if q == b.G else 'o')
            row += ch
            if x < b.W - 1: row += ('|' if frozenset((q, (x + 1, y))) in b.cuts else ' ')
        out.append(row)
        if y < b.H - 1: out.append(''.join(('-' if frozenset(((x, y), (x, y + 1))) in b.cuts else ' ') + ' ' for x in range(b.W)))
    return '\n'.join(out)


# the board offered to the owner (24/11): found by a search over 5x5 to 6x6 boards scored by the real decisions along
# its way (steps where another move she can make dooms her); 13 swipes, one way only, no limbo. She draws the statue
# down to the left, then along behind her into the corner of water at (2,3), where it is held (water to its right and
# below); she goes round and up the right side; as she rises past it, it comes out, and its first step sideways is the
# cracked slab: it sinks. Running for the gate first gets her caught at the second swipe.
LEVEL6 = (["~F~~~G",
           "oooooo",
           "~ooCo~",
           "oSo~oo",
           "oo~~oo",
           "oooooo"], [])


if __name__ == '__main__':
    b = Board(*LEVEL6)
    r = analyse(b)
    assert r and r['ways'] == 1 and r['limbo'] == 0, r
    assert analyse(b, 2, False) is None      # (without the crack there is no way: the statue must be drowned)
    print(show(b)); print()
    print('way %d swipes (%s), the statue sunk at swipe %d; %d states, %d dead (each ends caught), %d limbo' % (
        r['L'], ''.join(D4[d] for d in r['path']), r['chase'], r['states'], r['dead'], r['limbo']))
