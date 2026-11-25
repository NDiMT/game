"""Level 6 trial, "What the eye does not see" (25/11; the owner: "think of something clever", "completely different, clever, out of the box"). What the eye does not see is not there: inside the glass only the seen is real. The eye looks down the board's
diagonal (from the front, as the game's camera does): a tall thing at (x, y) hides the place (x-1, y-1) behind it, a
very tall column hides (x-1, y-1) and (x-2, y-2). A gap of sea the eye cannot see is not there: she walks over it as over
stone. The veiled statues can be pushed (onto slabs only); as they move, what they hide moves with them.
Board: '~' sea, 'o' slab, '#' a column (hides one place behind it), 'I' a tall column (two), 'M' a veiled statue on a
slab (hides one), 'S' her start, 'G' the ring."""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}

class Board:
    def __init__(s, rows):
        s.H = len(rows); s.W = len(rows[0]); s.slab = set(); s.col = {}; s.M = []
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in 'oSMG': s.slab.add(q)
                if c == '#': s.col[q] = 1
                if c == 'I': s.col[q] = 2
                if c == 'S': s.S = q
                if c == 'M': s.M.append(q)
                if c == 'G': s.G = q
    def inside(s, q): return 0 <= q[0] < s.W and 0 <= q[1] < s.H

def hidden(b, ms):
    out = set()
    for q, k in list(b.col.items()) + [(m, 1) for m in ms]:
        for i in range(1, k + 1): out.add((q[0] - i, q[1] - i))
    return out

def floor(b, q, ms, hid):
    """can she stand there"""
    if not b.inside(q) or q in b.col or q in ms: return False
    return q in b.slab or q in hid

def move(b, st, d):
    h, ms = st; hid = hidden(b, ms)
    q = (h[0] + d[0], h[1] + d[1])
    if q in ms:
        r = (q[0] + d[0], q[1] + d[1])
        if not b.inside(r) or r not in b.slab or r in ms or r in b.col or r == b.G: return 'blocked', None
        ms = (ms - {q}) | {r}
        if h not in b.slab and h not in hidden(b, ms): return 'blocked', None      # (never pull the stone from under her)
        return 'move', (q, ms)
    if not floor(b, q, ms, hid): return 'blocked', None
    if q == b.G: return 'win', None
    return 'move', (q, ms)

def analyse(b, ms=None):
    s0 = (b.S, frozenset(b.M if ms is None else ms)); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
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


# the boards (25/11), each one way; the stone (a rose cube, one place high, so in the game's isometric eye its top covers
# the place behind it exactly) and the piers hide the sea she walks over
BEHIND = ['So~oG', '~~~#~']                                                 # 4: RRRR, behind the pier
STONE = ['oS~~~', 'o~~~~', '~o~~~', '~M~oo', 'ooooG']                       # 13: the stone hides three gaps in turn
TWO = ['G~~~~', 'oooo~', '~~~o~', '~oo~S', '~ooMo', '~M~~~']                # 17: two stones
PIERS = ['~~~~~G', '~o~~~o', '~Mo#~I', '~oMoSo', '~o~~~~']                  # 20: two stones, a pier and a tall pier

if __name__ == '__main__':
    for name, rows in (('behind the pier', BEHIND), ('the stone hides', STONE), ('two stones', TWO), ('the piers', PIERS)):
        b = Board(rows); r = analyse(b)
        print('%s: %d swipes (%s), one way: %s, %d states, %d dead' % (name, r['L'], ''.join(D4[d] for d in r['path']),
              r['ways'] == 1, r['states'], r['dead']))
