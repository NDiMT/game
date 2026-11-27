"""The Tower of the Winds (27/11; the owner, of the tower of counterweights: "instead of the hoists, can we think of
something else?", then of five put to him, "make the preview and show me" for the first: the Tower of the Winds, the
octagonal tower in Athens with its eight winds carved round it and a bronze vane on its roof).

Theron's tower, in tiers out of the sea, joined by stairs. Two rules, one of them known:
 - The statues move only behind her back (the sixth level's): she faces the way she last stepped; after each of her
   steps every statue not in front of her takes one step toward her (the way it is farther first, the other if that is
   shut), on its own height or by a stair as she walks; one that steps onto her takes her.
 - The wind: stepping onto a wind's bronze disc sets the wind to blow that way, and it blows on until another disc
   turns it. After the statues' steps it pushes every statue she does not see one place downwind (their veils catch it;
   she, unveiled, it does not move): along the floor, or down off a ledge onto the lower place there; never up, never
   into a column, a wall of a higher tier or another statue; off the edge into the sea, the statue is gone; onto her,
   it takes her. What she sees holds still: she anchors a statue against the wind by looking at it.
   So with the wind at their backs the statues come at her two places a step; against it they stand still.
 - Plates and bridges (the sixth level's): a bridge stands up while a plate of its letter is held, by her or a statue;
   one that sinks takes whoever stands on it (a statue blown onto a sunken bridge goes into the sea).

board: rows of two-character cells, a height digit then a kind:
  '.' the sea   'o' floor   '/' a stair (its digit the lower tier: it joins that tier and the next)   '#' a column
  'S' her start   'G' the ring   'M' a statue on a floor
  '^' '>' 'v' '<' a wind's disc: the wind then blows up / right / down / left the board
  'a' 'b' plates, 'A' 'B' bridges (up while a plate of their letter is held)
f0: the way she faces at the start (up the board); w0: the wind at the start (None: still air).

usage: python3 -I tools/go/winds_trial.py      (proves the stages and prints their ways)"""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
DV = {v: k for k, v in D4.items()}
WIND = {'^': (0, -1), '>': (1, 0), 'v': (0, 1), '<': (-1, 0)}


def sgn(v): return (v > 0) - (v < 0)


class Board:
    def __init__(s, rows, f0=(0, -1), w0=None):
        s.rows = rows; s.H = len(rows); s.W = len(rows[0]) // 2; s.f0 = f0; s.w0 = w0
        s.h = {}; s.kind = {}; s.M = []; s.S = s.G = None; s.plate = {}; s.bridge = {}; s.wind = {}
        for y, r in enumerate(rows):
            for x in range(s.W):
                d, k = r[2 * x], r[2 * x + 1]
                if k == '.': continue
                q = (x, y); s.h[q] = int(d); s.kind[q] = k
                if k == 'S': s.S = q
                if k == 'G': s.G = q
                if k == 'M': s.M.append(q)
                if k in 'ab': s.plate[q] = k.upper()
                if k in 'AB': s.bridge[q] = k
                if k in WIND: s.wind[q] = WIND[k]

    def ups(s, held):
        return frozenset(s.plate[q] for q in held if q in s.plate)

    def stand(s, q, up):
        if q not in s.h or s.kind[q] == '#': return False
        return q not in s.bridge or s.bridge[q] in up

    def height(s, q):
        return s.h[q] + (0.5 if s.kind[q] == '/' else 0)

    def step_ok(s, p, q, up):
        if not s.stand(q, up): return False
        a, c = s.height(p), s.height(q)
        if s.kind[p] == '/' or s.kind[q] == '/': return abs(a - c) == 0.5 or (a == c and s.kind[p] == s.kind[q] == '/')
        return a == c


def ahead(m, h, f): return (m[0] - h[0]) * f[0] + (m[1] - h[1]) * f[1] > 0      # in front of her: she sees it


def move(b, st, d):
    """one swipe: (kind, new state, what happened); kind: blocked | move | win | caught | fell.
    what happened: (steps [(from, to)], pushes [(from, to or None if into the sea)], sunk [place])"""
    h, f, ms, w = st
    q = (h[0] + d[0], h[1] + d[1])
    if q in ms or not b.step_ok(h, q, b.ups([h, *ms])): return 'blocked', None, None
    if q == b.G: return 'win', None, None
    nf = d; nw = b.wind.get(q, w); cur = set(ms); steps = []; pushes = []
    up = b.ups([q, *ms])
    for m in sorted(ms, key=lambda m: (abs(m[0] - q[0]) + abs(m[1] - q[1]), m)):      # the statues behind her back
        if ahead(m, q, nf): continue
        dx, dy = q[0] - m[0], q[1] - m[1]
        tries = [(sgn(dx), 0), (0, sgn(dy))] if abs(dx) >= abs(dy) else [(0, sgn(dy)), (sgn(dx), 0)]
        for t in tries:
            if t == (0, 0): continue
            n = (m[0] + t[0], m[1] + t[1])
            if n in cur or not b.step_ok(m, n, up): continue
            if n == q: return 'caught', None, (steps, pushes, m)
            cur.discard(m); cur.add(n); steps.append((m, n)); break
    if nw:      # the wind: the farthest downwind first, so a row goes together
        for m in sorted(cur, key=lambda m: (-(m[0] * nw[0] + m[1] * nw[1]), m)):
            if ahead(m, q, nf): continue      # (what she sees holds still)
            n = (m[0] + nw[0], m[1] + nw[1])
            if n in cur: continue
            if n not in b.h or (n in b.bridge and b.bridge[n] not in up):      # off the edge, or onto a sunken bridge
                cur.discard(m); pushes.append((m, None)); continue
            if b.kind[n] == '#' or b.height(n) > b.height(m): continue      # a column, a wall: it shelters
            if n == q: return 'caught', None, (steps, pushes, m)
            cur.discard(m); cur.add(n); pushes.append((m, n))
    up2 = b.ups([q, *cur])
    if q in b.bridge and b.bridge[q] not in up2: return 'fell', None, (steps, pushes, [])
    sunk = [m for m in cur if m in b.bridge and b.bridge[m] not in up2]
    for m in sunk: cur.discard(m)
    return 'move', (q, nf, frozenset(cur), nw), (steps, pushes, sunk)


def start(b): return (b.S, b.f0, frozenset(b.M), b.w0)


def analyse(b, count=True, cap=400000):
    s0 = start(b); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            kind, n, ev = move(b, s, d)
            if kind == 'win': wins.add(s); edges[s].append((d, 'win'))
            elif kind == 'move':
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
    path = []; s = s0; feats = dict(winds=0, pushes=0, lost=0, anchored=0, falls=0)
    while True:
        if dist[s] == 1: path.append(next(d for d, n in edges[s] if n == 'win')); break
        for d, n in edges[s]:
            if n != 'win' and dist.get(n, 10 ** 9) == dist[s] - 1:
                k, _, ev = move(b, s, d)
                feats['winds'] += n[3] != s[3]
                feats['pushes'] += sum(1 for a, c in ev[1] if c)
                feats['lost'] += sum(1 for a, c in ev[1] if c is None) + len(ev[2])
                feats['falls'] += sum(1 for a, c in ev[1] if c and b.height(c) < b.height(a))
                if n[3]:      # a statue she held still against the wind, where it would have gone
                    for m in n[2]:
                        if ahead(m, n[0], n[1]):
                            t = (m[0] + n[3][0], m[1] + n[3][1])
                            if t not in n[2] and (t not in b.h or (b.kind[t] != '#' and b.height(t) <= b.height(m))): feats['anchored'] += 1
                path.append(d); s = n; break
    dead = sum(1 for s in seen if s not in dist)
    return dict(L=dist[s0], ways=cnt(s0) if count else None, states=len(seen), dead=dead, path=path, **feats)


def show(b, st):
    h, f, ms, w = st; out = []
    for y in range(b.H):
        row = ''
        for x in range(b.W):
            q = (x, y)
            if q not in b.h: row += ' . '; continue
            ch = '@' if q == h else 'M' if q in ms else b.kind[q] if b.kind[q] not in 'SM' else 'o'
            row += '%d%s ' % (b.h[q], ch)
        out.append(row)
    return '\n'.join(out) + '\n facing %s, wind %s' % (D4[f], D4.get(w, '-'))


def trace(b, path):
    st = start(b); print(show(b, st)); print()
    for i, d in enumerate(path):
        k, n, ev = move(b, st, d); print(i + 1, D4[d], k, ev or '')
        if k != 'move': break
        st = n; print(show(b, st)); print()


STAGES = [
    # the wind: a statue stands in the way up; step aside onto the disc (it is no longer before her), it comes a step
    # toward her and the wind takes it off the edge into the sea
    ('the wind', ['..1G..', '..0/..', '..0M..', '..0o0<', '..0S..'], (0, -1), None),
    # against the wind: on the stair it comes toward her and the wind sets it back down, so it stands still
    ('against the wind', ['1#1G0o1o', '2o1M0/2o', '1o0^0/0o', '0/0o0o0S'], (0, -1), None),
    # (the next three found by annealing about an all-floor grid: a score for the way's length, one way, the winds
    # turned, the statues pushed, held still by her look, lost and fallen, every statue and disc needed, no step back;
    # then pruned of cells that changed nothing)
    # the stairs: the north wind holds them down the stairs while she climbs; the east wind takes one off the edge
    ('the stairs', ['..2o2G0M..', '..1/1<0o0o', '0o0M0/0/0o', '....1o0o0o', '......0v0S'], (0, -1), None),
    # the turn: with the wind against them they cannot come; on the north disc it turns and takes them both
    ('the turn', ['..0o0^..0G', '0o0o0o0o0M', '0/1/..2M2o', '0>0o......', '0o0S......'], (0, -1), None),
    # the look: the west wind holds both statues at the far edge as long as she does not look at them; looking, she
    # holds them on the walk; the south wind takes them off it one by one
    ('the look', ['....0o0o0M0G', '....0o......', '..1v0^......', '0M0o0o0/0o..', '0o0>........', '0S0o0o0/....'], (0, -1), None),
    # four winds: east, west, east and west again, one statue held at the shore while the other goes into the sea
    ('four winds', ['0G0o0/....', '....0o....', '....0M1/1M', '..0<0o....', '0o0>0o1o..', '0o0o0o0S..'], (0, -1), None),
]

if __name__ == '__main__':
    for name, rows, f0, w0 in STAGES:
        b = Board(rows, f0, w0); r = analyse(b)
        if r is None: print(name, 'no way'); continue
        print('%s: %d swipes (%s), ways %s, %d states, %d dead; winds %d, pushes %d, lost %d, falls %d, anchored %d' % (
            name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'], r['states'], r['dead'], r['winds'], r['pushes'],
            r['lost'], r['falls'], r['anchored']))
