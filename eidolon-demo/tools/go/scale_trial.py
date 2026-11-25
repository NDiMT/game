"""Level 6 trial, "The scale" (25/11; the owner, of the balance: "it wasn't bad, a little smarter if we made it"): a marble beam on a rock, tipping toward the heavier side and lying LEVEL when both sides weigh the same
(weight times distance from the pivot; she weighs 1, the stone 2). Level, every place on it is at the pier's height (1)
and meets the piers beside it; tipped, its pivot is at 1, its lowered end at 0 (the low quay), its raised end at 2 (the
high terrace), its other places meet nothing off it. Board: '~' sea, 'o' low quay, 'm' pier, 'H' high terrace, 's' a
stair low-pier, 't' a stair pier-high, '=' the beam, 'P' its pivot, 'S'/'Q'/'R' her start (low, pier, high),
'C'/'J'/'K' the stone (low, pier, high), 'g'/'Y'/'G' the ring (low, pier, high), 'x' a hole in the low quay.
memory=True: when both sides weigh the same it stays as it was (the first trial's rule), to test whether level is needed."""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
W_HER, W_STONE = 1, 2

class Board:
    def __init__(s, rows, t0=0):
        s.H = len(rows); s.W = len(rows[0]); s.h = {}; s.stair = {}; s.beam = []; s.holes = set(); s.t0 = t0
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in 'oSCgx': s.h[q] = 0
                if c in 'mQJY': s.h[q] = 1
                if c in 'HRKG': s.h[q] = 2
                if c == 's': s.stair[q] = (0, 1)
                if c == 't': s.stair[q] = (1, 2)
                if c in '=P': s.beam.append(q)
                if c == 'P': s.pivot = q
                if c in 'SQR': s.S = q
                if c in 'CJK': s.C = q
                if c in 'gYG': s.G = q
                if c == 'x': s.holes.add(q); del s.h[q]
        s.beam.sort(); s.bi = {q: i for i, q in enumerate(s.beam)}; s.p = s.bi[s.pivot]

    def height(s, q, tilt):
        if q in s.bi:
            i = s.bi[q]
            if tilt == 0 or i == s.p: return 1
            if i == 0: return 0 if tilt == -1 else 2
            if i == len(s.beam) - 1: return 0 if tilt == 1 else 2
            return None
        return s.h.get(q)

    def walkable(s, q, filled):
        return q in s.h or q in s.stair or q in s.bi or (q in s.holes and q in filled)

    def link(s, a, b, tilt, filled):
        if not (s.walkable(a, filled) and s.walkable(b, filled)): return False
        if a in s.bi and b in s.bi: return True
        ha = 0 if (a in s.holes and a in filled) else s.height(a, tilt)
        hb = 0 if (b in s.holes and b in filled) else s.height(b, tilt)
        if a in s.stair and b in s.stair: return False
        if a in s.stair: return hb is not None and hb in s.stair[a]
        if b in s.stair: return ha is not None and ha in s.stair[b]
        return ha is not None and ha == hb

def torque(b, h, c):
    t = 0
    if h in b.bi: t += W_HER * (b.bi[h] - b.p)
    if c is not None and c in b.bi: t += W_STONE * (b.bi[c] - b.p)
    return t

def move(b, st, d, memory=False):
    h, c, tilt, filled = st
    q = (h[0] + d[0], h[1] + d[1])
    if not b.link(h, q, tilt, filled): return 'blocked', None, None
    ev = []
    if q == c:
        r = (q[0] + d[0], q[1] + d[1])
        if r in b.holes and r not in filled and b.height(q, tilt) == 0: filled = filled | {r}; c = None; ev.append('fill')
        elif r in b.stair or not b.link(q, r, tilt, filled): return 'blocked', None, None
        else: c = r; ev.append('push')
    if q == b.G: return 'win', None, ev
    tq = torque(b, q, c)
    nt = (tilt if memory else 0) if tq == 0 else (1 if tq > 0 else -1)
    if nt != tilt: ev.append('tilt%+d' % nt if nt else 'level')
    return 'move', (q, c, nt, filled), ev

def start(b):
    t = torque(b, b.S, b.C)
    return (b.S, b.C, b.t0 if t == 0 else (1 if t > 0 else -1), frozenset())

def analyse(b, cube=True, memory=False):
    s0 = start(b)
    if not cube: s0 = (s0[0], None, s0[2], s0[3])
    seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            k, n, ev = move(b, s, d, memory)
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

def show(b, st):
    h, c, tilt, filled = st; out = []
    for y in range(b.H):
        row = ''
        for x in range(b.W):
            q = (x, y)
            if q == h: ch = '@'
            elif q == c: ch = '#'
            elif q == b.G: ch = 'G'
            elif q in b.bi:
                hh = b.height(q, tilt); ch = 'P' if q == b.pivot else ('-' if tilt == 0 else 'v' if hh == 0 else '^' if hh == 2 else '=')
            elif q in b.holes: ch = 'o' if q in filled else 'x'
            elif q in b.stair: ch = 's' if b.stair[q] == (0, 1) else 't'
            elif q in b.h: ch = 'oMH'[b.h[q]]
            else: ch = '~'
            row += ch + ' '
        out.append(row)
    return '\n'.join(out)

def trace(b, path):
    st = start(b); print(show(b, st)); print()
    for i, d in enumerate(path):
        k, n, ev = move(b, st, d); print(i + 1, D4[d], k, ' '.join(ev or []))
        if k != 'move': break
        st = n; print(show(b, st)); print()


# the boards (25/11), each one way, the stone needed, the level needed (with the old rule, which kept the beam as it
# was when the sides weighed the same, none can be solved):
# 1, the balance (7 swipes): the stone onto the pivot from the pier, round by the pier onto the far arm, the stone
#    pushed back to the half distance, out to the end, which the stone now holds level, and onto the ring at the pier
BALANCE = ['~~Qm~~',
           '~~Jm~~',
           '==P==Y']
# 2, high (16, no dead end): onto the level beam by the stair, which tips under her and carries her down; the stone
#    loaded from the side while the beam lies level; round behind it, pushed to the far end; out to the raised end
HIGH = ['Rso~G',
        'tJs~H',
        '==P==']
# 3, at half the distance (19): from the high start down onto the level beam and over to the low quay; the stone loaded
#    from the side while level; round behind it and pushed over the pivot, but only to the half distance: at the far end
#    it would raise her end past the ring, which stands at the pier's height; back to her end, which it holds level
HALF = ['~sm~~R',
        '~oJ~~t',
        'Y==P==']

if __name__ == '__main__':
    for name, rows in (('the balance', BALANCE), ('high', HIGH), ('at half the distance', HALF)):
        b = Board(rows); r = analyse(b)
        print('%s: %d swipes (%s), one way: %s, %d states, %d dead, the stone needed: %s, the level needed: %s' % (
            name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'] == 1, r['states'], r['dead'],
            analyse(b, False) is None, analyse(b, True, True) is None))
    trace(Board(HALF), analyse(Board(HALF))['path'])
