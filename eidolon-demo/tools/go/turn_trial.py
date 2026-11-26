"""Level 6 trial, "The island that turns" (26/11; the owner, of the eye with pushed stones: "not again with stones you push"). What the eye does not see is not there, and the island turns: no stones. The eye looks at the island from one of
its four corners; a pier hides the place right behind it as the eye sees it (a tall pier two), and sea hidden so is not
there: she walks over it. Stepping onto the turning slab turns the island a quarter (clockwise, seen from above), so
the eye sees it from the next corner and other places are hidden. Board: '~' sea, 'o' slab, '#' a pier, 'I' a tall
pier, 'T' the turning slab, 'S' her start, 'G' the ring. View k: the eye at the corner D[k], so the place behind p is
p - D[k] (k 0: the eye at the front, as the game's camera)."""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
DK = [(1, 1), (1, -1), (-1, -1), (-1, 1)]      # (the eye's corner in each view; a quarter turn of the island each step)

class Board:
    def __init__(s, rows, v0=0):
        s.H = len(rows); s.W = len(rows[0]); s.slab = set(); s.col = {}; s.turn = set(); s.v0 = v0
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in 'oSGT': s.slab.add(q)
                if c == 'T': s.turn.add(q)
                if c == '#': s.col[q] = 1
                if c == 'I': s.col[q] = 2
                if c == 'S': s.S = q
                if c == 'G': s.G = q
    def inside(s, q): return 0 <= q[0] < s.W and 0 <= q[1] < s.H

def hidden(b, v):
    d = DK[v]; out = set()
    for q, h in b.col.items():
        for i in range(1, h + 1): out.add((q[0] - i * d[0], q[1] - i * d[1]))
    return out

def floor(b, q, v):
    return b.inside(q) and q not in b.col and (q in b.slab or q in hidden(b, v))

def move(b, st, d):
    h, v = st; q = (h[0] + d[0], h[1] + d[1])
    if not floor(b, q, v): return 'blocked', None
    if q == b.G: return 'win', None
    if q in b.turn: v = (v + 1) % 4
    return 'move', (q, v)

def analyse(b):
    s0 = (b.S, b.v0); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
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
    path = []; s = s0
    while True:
        if dist[s] == 1: path.append(next(d for d, n in edges[s] if n == 'win')); break
        for d, n in edges[s]:
            if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1: path.append(d); s = n; break
    return dict(L=dist[s0], ways=cnt(s0), states=len(seen), dead=sum(1 for s in seen if s not in dist), path=path)

def trace(b, path):
    st = (b.S, b.v0)
    for i, d in enumerate(path):
        k, n = move(b, st, d)
        print('  %2d %s she %s->%s view %s %s' % (i + 1, D4[d], st[0], n[0] if n else 'G', n[1] if n else '',
              'over the hidden sea' if n and n[0] not in b.slab else ('the island turns' if n and n[1] != st[1] else '')))
        if k != 'move': break
        st = n


# the boards (26/11), each one way; found by annealing (rewarding the views used, the turns and the crossings over hidden
# sea; punishing stepping back and forth on a disc), the first by hand
DISC = ['~~~#', 'ST~G']                                                        # 3: RRR
ROUND = ['~~oG~', '~o~~S', 'T#~~o', 'oT~TI', '~o~o~']                          # 14, no dead end
CORNERS = ['~~~So~', 'o~G~o~', 'T~I~~~', '#T~~o#', '~~ooo~', '~~~TT~']         # 16
GREAT = ['~T~~~', 'o#oS~', 'o~~#T', 'o~o#o', 'G~TT~']                          # 18

if __name__ == '__main__':
    for name, rows in (('the disc', DISC), ('round and round', ROUND), ('four corners', CORNERS), ('the great turn', GREAT)):
        b = Board(rows); r = analyse(b)
        print('%s: %d swipes (%s), one way: %s, %d states, %d dead' % (name, r['L'], ''.join(D4[d] for d in r['path']),
              r['ways'] == 1, r['states'], r['dead']))
        trace(b, r['path'])
