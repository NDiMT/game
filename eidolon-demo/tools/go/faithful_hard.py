"""How hard a board of The Faithful is (24/11, after the owner's "it doesn't look very hard"): the state graph, how long
a wrong move lets her live before she is caught (a trap that bites late is one she cannot see), and how often simple
players solve it: `thinker` looks k moves ahead for danger and otherwise heads for the ring or the crack (the first
board: 93 in 100 looking 2 ahead; LEVEL6: 0 in 200 looking 2, 3 or 4 ahead).

usage: python3 -I tools/go/faithful_hard.py      (rates LEVEL6_FIRST and LEVEL6)"""
import sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from faithful_trial import Board, analyse, statue, show, D4, moves
from collections import deque

def graph(b):
    s0 = (b.S, b.F); seen = {s0}; dq = deque([s0]); edges = {}; wins = set()
    while dq:
        s = dq.popleft(); edges[s] = []
        for d, kind, nx in moves(b, s):
            edges[s].append((d, kind, nx))
            if kind == 'win': wins.add(s)
            elif kind == 'move' and nx not in seen: seen.add(nx); dq.append(nx)
    good = set(wins); rev = {}
    for s, l in edges.items():
        for d, kind, nx in l:
            if kind == 'move': rev.setdefault(nx, []).append(s)
    dq = deque(wins)
    while dq:
        s = dq.popleft()
        for p in rev.get(s, []):
            if p not in good: good.add(p); dq.append(p)
    return s0, edges, good

def survival(edges, good):
    """for each dead state: the most moves she can still make before it takes her (no limbo: the dead states form no
    loop)"""
    memo = {}
    def f(s):
        if s in memo: return memo[s]
        memo[s] = 0
        best = 0
        for d, kind, nx in edges[s]:
            if kind == 'move' and nx not in good: best = max(best, 1 + f(nx))
        memo[s] = best; return best
    for s in edges:
        if s not in good: f(s)
    return memo

def play(b, edges, good, s0, rnd, budget, look):
    """a player: never walks into it; with look, also never into a place where every move is into it"""
    s = s0
    for _ in range(budget):
        opts = [(d, kind, nx) for d, kind, nx in edges[s] if kind != 'caught']
        if any(kind == 'win' for d, kind, nx in opts): return True
        if look:
            safe = [o for o in opts if any(k2 != 'caught' for d2, k2, n2 in edges[o[2]])]
            opts = safe or opts
        if not opts: return False
        s = rnd.choice(opts)[2]
    return False

def rate(b, edges, good, s0, n=300, budget=80, look=False, seed=1):
    rnd = random.Random(seed)
    return sum(play(b, edges, good, s0, rnd, budget, look) for _ in range(n)) / n

def judge(b, r=None):
    r = r or analyse(b)
    s0, edges, good = graph(b)
    surv = survival(edges, good)
    s = s0; traps = []; rev = 0; prev = None
    for d in r['path']:
        alts = [(dd, kind, nx) for dd, kind, nx in edges[s] if dd != d and kind == 'move' and nx not in good]
        if alts: traps.append(max(1 + surv[nx] for dd, kind, nx in alts))
        if prev and (d[0] == -prev[0] and d[1] == -prev[1]): rev += 1
        prev = d
        nx = next(nx for dd, kind, nx in edges[s] if dd == d)
        if nx == 'win' or nx is None: break
        s = nx
        if s[1] is None: break
    return dict(traps=len(traps), deep=sum(1 for t in traps if t >= 3), longest=max(traps or [0]), rev=rev,
                rnd=rate(b, edges, good, s0), look=rate(b, edges, good, s0, look=True), deadfrac=r['dead'] / r['states'])

def gdist(b):
    """her distance to the ring on the board, the statue aside"""
    dist = {b.G: 0}; dq = deque([b.G])
    while dq:
        c = dq.popleft()
        for d in D4:
            q = (c[0] + d[0], c[1] + d[1])
            if q not in dist and b.open(c, q): dist[q] = dist[c] + 1; dq.append(q)
    return dist

def lives(edges, s, k, memo):
    """she can make k more moves from s without being taken"""
    if k == 0: return True
    key = (s, k)
    if key in memo: return memo[key]
    v = any(kind == 'win' or (kind == 'move' and lives(edges, nx, k - 1, memo)) for d, kind, nx in edges[s])
    memo[key] = v; return v

def thinker(b, edges, s0, k=3, n=200, budget=70, greed=0.6, seed=7):
    """a player who looks k moves ahead for danger and otherwise likes to go toward the ring or toward the crack"""
    rnd = random.Random(seed); gd = gdist(b); memo = {}; wins = 0
    cd = {}
    if b.C:
        cd = {b.C: 0}; dq = deque([b.C])
        while dq:
            c = dq.popleft()
            for d in D4:
                q = (c[0] + d[0], c[1] + d[1])
                if q not in cd and b.open(c, q): cd[q] = cd[c] + 1; dq.append(q)
    for _ in range(n):
        s = s0; won = False
        for t in range(budget):
            opts = [(d, kind, nx) for d, kind, nx in edges[s] if kind != 'caught']
            if any(kind == 'win' for d, kind, nx in opts): won = True; break
            safe = [o for o in opts if lives(edges, o[2], k, memo)]
            opts = safe or opts
            if not opts: break
            if rnd.random() < greed:
                aim = gd if (s[1] is None or rnd.random() < 0.5) else cd
                m = min(aim.get(o[2][0], 99) for o in opts)
                opts = [o for o in opts if aim.get(o[2][0], 99) == m]
            s = rnd.choice(opts)[2]
        wins += won
    return wins / n


if __name__ == '__main__':
    from faithful_trial import LEVEL6_FIRST, LEVEL6
    for name, bd in (('first', LEVEL6_FIRST), ('LEVEL6', LEVEL6)):
        b = Board(*bd); s0, e, g = graph(b)
        print(name, ' '.join('look %d: %.2f' % (k, thinker(b, e, s0, k=k)) for k in (2, 3, 4)))
