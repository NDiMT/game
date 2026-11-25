"""Level 6 trial, kept for later (25/11, laid aside when the owner came back to the balance), "The obedient ones": every swipe, she and every obedient statue step that way at once (front first); a statue that
steps into the sea sinks and becomes a stone there, flush with the way; she never steps into the sea; rock and the
board's edge hold everyone. Board: '~' sea, 'o' slab, '#' rock, 'S' her start, 'M' a statue, 'G' the ring."""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}

class Board:
    def __init__(s, rows):
        s.H = len(rows); s.W = len(rows[0]); s.slab = set(); s.rock = set(); s.M = []
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in 'oSMG': s.slab.add(q)
                if c == '#': s.rock.add(q)
                if c == 'S': s.S = q
                if c == 'M': s.M.append(q)
                if c == 'G': s.G = q
    def inside(s, q): return 0 <= q[0] < s.W and 0 <= q[1] < s.H

def move(b, st, d):
    """('win'|'move'|'none', state, events)"""
    h, ms, filled = st
    ground = b.slab | filled
    movers = [('h', h)] + [('m', m) for m in ms]
    movers.sort(key=lambda t: -(t[1][0] * d[0] + t[1][1] * d[1]))      # front first
    taken = set(p for _, p in movers); newh = h; newms = []; nf = set(filled); ev = []
    for kind, p in movers:
        q = (p[0] + d[0], p[1] + d[1])
        if not b.inside(q) and kind == 'm':      # off the board: the open sea takes it, no stone
            taken.discard(p); ev.append(('lost', p, q)); continue
        if not b.inside(q) or q in b.rock or q in taken:
            (newms.append(p) if kind == 'm' else None); continue
        if q in ground or q in nf:
            taken.discard(p); taken.add(q)
            if kind == 'h': newh = q
            else: newms.append(q)
        elif kind == 'm':      # into the sea: it sinks and is a stone there
            taken.discard(p); nf.add(q); ev.append(('sink', p, q))
        else:
            pass      # she does not step into the sea
    if newh == b.G: return 'win', None, ev
    nst = (newh, frozenset(newms), frozenset(nf))
    if nst == st: return 'none', st, ev
    return 'move', nst, ev

def analyse(b, ms=None):
    s0 = (b.S, frozenset(b.M if ms is None else ms), frozenset()); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d in D4:
            k, n, ev = move(b, s, d)
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
    dead = sum(1 for s in seen if s not in dist)
    return dict(L=dist[s0], ways=cnt(s0), states=len(seen), dead=dead, path=path)

def show(b, st):
    h, ms, filled = st; out = []
    for y in range(b.H):
        r = ''
        for x in range(b.W):
            q = (x, y)
            r += '@' if q == h else 'M' if q in ms else 'G' if q == b.G else '#' if q in b.rock else '*' if q in filled else 'o' if q in b.slab else '~'
            r += ' '
        out.append(r)
    return '\n'.join(out)

def trace(b, path):
    st = (b.S, frozenset(b.M), frozenset()); print(show(b, st)); print()
    for i, d in enumerate(path):
        k, n, ev = move(b, st, d); print(i + 1, D4[d], k, ev)
        if k != 'move': break
        st = n; print(show(b, st)); print()


# boards found (an annealer in a frame: the gate's islet on top, a strait of two rows of sea, the shore below), each one
# way, every statue needed; the second statue walks out over the first one's stone and sinks one further
FIRST = ['So~oG', 'Mo~o~']                                  # 7: RRDRRUR
STRAIT = ['ooooG', '~~~~~', '~~~~~', 'ooMMS', '#oo~o']      # 14: LLDRUUULUUURRR (a rock and her body hold one)
STRAIT_B = ['~Gooo', '~~~~~', '~~~~~', 'ooooo', 'MMS#o']    # 14: URRDURUULUUULL

if __name__ == '__main__':
    for rows in (FIRST, STRAIT, STRAIT_B):
        b = Board(rows); r = analyse(b)
        print(rows, r['L'], ''.join(D4[d] for d in r['path']), 'one way:', r['ways'] == 1, 'dead %d/%d' % (r['dead'], r['states']))
