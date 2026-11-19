"""The fourth level's trial as the owner settled it (19/11): the glass stands still, and no winch ("take the winch out";
before, "why should the glass need pulling? I don't understand"). In the reflection alone a square of light: push the
block so that its image stands in it, and the gate opens on the real side. The same square of light lies at her start:
stepping on it puts the block back where it began (the owner: "if you step on it, it resets the block"), so a block
pushed where it cannot come out again is never the end of the trial.

Board: a corridor low over the water (row 0) from her start S to the gate G; a step above it a terrace (rows 1-3), one
stair between them. The block is pushed one step at a time, as in levels 2-3; it never goes down onto the corridor nor
down the stair. Its target T is the cell whose image is the square (the glass is gx + gy = k; a cell c's image is
(k - c.y, k - c.x)), so only T counts.

run() searches every state (her place, the block's, the gate open or shut): the shortest way, whether the pushing is one
way only, the traps (states from which, without the square at the start, the gate can never be reached) and the true
dead ends (states from which she can reach neither the gate nor the square at the start: there must be none)."""
import collections, itertools, json, sys
S, G = (0, 0), (5, 0)
CORR = [(x, 0) for x in range(6)]
TERR = [(0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (0, 2), (1, 2), (2, 2), (3, 2), (1, 3), (2, 3)]
STAIR = frozenset(((1, 0), (1, 1)))


def run(terr, b0, T, walls=(), reset=True):
    cells = set(CORR) | set(terr)
    cut = {frozenset(((x, 0), (x, 1))) for x in range(6)} - {STAIR} | set(walls)
    def way(a, b): return a in cells and b in cells and abs(a[0]-b[0]) + abs(a[1]-b[1]) == 1 and frozenset((a, b)) not in cut
    def nxt(st, use_reset):
        me, b, op = st
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (me[0]+d[0], me[1]+d[1])
            if not way(me, n): continue
            if n == G and not op: continue
            nb = b; a = ''
            if n == b:
                kk = (b[0]+d[0], b[1]+d[1])
                if not way(b, kk) or frozenset((b, kk)) == STAIR or kk == G or kk[1] == 0: continue
                nb = kk; a = 'P'
            if n == S and use_reset and nb != b0: nb = b0; a = a + 'R'      # (the square at her start: the block back where it began)
            yield (n, nb, op or nb == T), a
    def explore(use_reset):
        start = (S, b0, b0 == T)
        dist = {start: 0}; q = collections.deque([start]); succ = {}
        while q:
            st = q.popleft(); succ[st] = list(nxt(st, use_reset))
            for ns, a in succ[st]:
                if ns not in dist: dist[ns] = dist[st] + 1; q.append(ns)
        return start, dist, succ
    start, dist, succ = explore(reset)
    if start[2]: return None
    goals = [s for s in dist if s[0] == G]
    if not goals: return None
    best = min(dist[s] for s in goals)
    def back(targets):
        rev = collections.defaultdict(list)
        for a, lst in succ.items():
            for ns, _ in lst: rev[ns].append(a)
        bd = {s: 0 for s in targets}; qq = collections.deque(targets)
        while qq:
            s = qq.popleft()
            for a in rev[s]:
                if a not in bd: bd[a] = bd[s] + 1; qq.append(a)
        return bd
    bd = back(goals)
    dead = sum(1 for s in dist if s not in bd)      # (with the square at the start: must be none)
    s0, d0, sc0 = explore(False)      # (without it: the traps it saves her from)
    g0 = [s for s in d0 if s[0] == G]
    rev0 = collections.defaultdict(list)
    for a, lst in sc0.items():
        for ns, _ in lst: rev0[ns].append(a)
    bd0 = {s: 0 for s in g0}; qq = collections.deque(g0)
    while qq:
        s = qq.popleft()
        for a in rev0[s]:
            if a not in bd0: bd0[a] = bd0[s] + 1; qq.append(a)
    traps = sorted(set(s[1] for s in d0 if s not in bd0))      # (the block's places it cannot come back from)
    goal_set = set(s for s in goals if dist[s] == best)
    memo = {}
    def seqs(st):
        if st in memo: return memo[st]
        if st in goal_set: memo[st] = {()}; return memo[st]
        out = set()
        for ns, a in succ[st]:
            if dist.get(ns) == dist[st] + 1 and bd.get(ns, 1e9) == bd[st] - 1:
                h = ((a, ns[1]),) if 'P' in a else ()
                for t in seqs(ns):
                    out.add(h + t)
                    if len(out) > 1: break
            if len(out) > 1: break
        memo[st] = out; return out
    sq = seqs(start)
    path = [start]; st = start
    while st not in goal_set:
        for ns, a in succ[st]:
            if dist.get(ns) == dist[st] + 1 and bd.get(ns, 1e9) == bd[st] - 1: st = ns; path.append(ns); break
    pushes = [(a[1], b[1]) for a, b in zip(path, path[1:]) if a[1] != b[1]]
    dirs = [(b_[0]-a_[0], b_[1]-a_[1]) for a_, b_ in pushes]
    turns = sum(1 for x, y in zip(dirs, dirs[1:]) if x != y)
    return {'len': best, 'dead': dead, 'traps': traps, 'states': len(dist), 'unique': len(sq) == 1, 'pushes': len(pushes),
            'turns': turns, 'path': path}


if __name__ == '__main__':
    out = []
    for drop in [()] + [(c,) for c in TERR if c != (1, 1)]:
        terr = [c for c in TERR if c not in drop]
        for b0 in terr:
            if b0 == (1, 1): continue
            for T in terr:
                if T == b0: continue
                r = run(terr, b0, T)
                if not r or r['dead'] or not r['unique'] or r['pushes'] < 3 or r['turns'] < 1: continue
                walk = r['len'] - r['pushes']
                out.append((r['turns'] * 3 + r['pushes'] + min(len(r['traps']), 3), r['len'], drop, b0, T, r['pushes'], r['turns'], r['traps'], r['states']))
    out.sort(key=lambda o: (-o[0], o[1]))
    print(len(out), 'boards')
    for o in out[:40]:
        print(json.dumps({'score': o[0], 'moves': o[1], 'drop': o[2], 'block': o[3], 'target': o[4], 'pushes': o[5], 'turns': o[6], 'traps': o[7], 'states': o[8]}))
