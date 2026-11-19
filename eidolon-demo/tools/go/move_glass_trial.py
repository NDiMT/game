"""The fourth level's trial as the owner settled it (19/11, after the sliding block and its thresholds were turned down:
"can you think of something else?"). The glass moves: a winch slides the glass back (or forward) one step; the whole
image slides with it, twice as far (as a real mirror). The square of light stands still, beyond the glass. The block's image must stand in it: with the
glass where it is, the block would have to stand where it cannot (in the corridor, in the column, off the floor);
with the glass moved, it must stand somewhere it can be pushed to. The block is pushed one step, as in levels 2-3 (no
sliding, no thresholds). Grid: the glass is gx + gy = k; a cell c's image is (k - c.y, k - c.x)."""
import collections, itertools, json, sys
S, G = (0, 0), (5, 0)
BASE_TERR = [(0,1),(1,1),(2,1),(3,1),(4,1), (0,2),(1,2),(2,2), (1,3),(2,3)]
CORR = [(x, 0) for x in range(6)]
def run(terr, walls, b0, lever, Q, ks=(6, 7), k0=6, need_lever=True):
    cells = set(CORR) | set(terr)
    cut = {frozenset(((x, 0), (x, 1))) for x in range(5)} - {frozenset(((1, 0), (1, 1)))} | set(walls)
    stairs = {frozenset(((1, 0), (1, 1)))}
    def way(a, b): return a in cells and b in cells and abs(a[0]-b[0]) + abs(a[1]-b[1]) == 1 and frozenset((a, b)) not in cut
    img = lambda c, k: (k - c[1], k - c[0])
    def nxt(st):
        me, b, k, op = st
        for d in ((1,0),(-1,0),(0,1),(0,-1)):
            n = (me[0]+d[0], me[1]+d[1])
            if not way(me, n): continue
            if n == G and not op: continue
            if n == lever:      # (she turns the winch: the glass slides to its other place)
                k2 = ks[(ks.index(k) + 1) % len(ks)]
                yield (me, b, k2, op or img(b, k2) == Q), 'L'
                continue
            nb = b; push = ''
            if n == b:
                kk = (b[0]+d[0], b[1]+d[1])
                if not way(b, kk) or frozenset((b, kk)) in stairs or kk == G or kk[1] == 0 or kk == lever: continue
                nb = kk; push = 'P'
            yield (n, nb, k, op or img(nb, k) == Q), push
    start = (S, b0, k0, img(b0, k0) == Q)
    if start[3]: return None
    dist = {start: 0}; q = collections.deque([start]); succ = {}
    while q:
        st = q.popleft(); succ[st] = []
        for ns, a in nxt(st):
            succ[st].append((ns, a))
            if ns not in dist: dist[ns] = dist[st] + 1; q.append(ns)
    goals = [s for s in dist if s[0] == G]
    if not goals: return None
    best = min(dist[s] for s in goals)
    rev = collections.defaultdict(list)
    for a, lst in succ.items():
        for ns, _ in lst: rev[ns].append(a)
    bd = {s: 0 for s in goals}; qq = collections.deque(goals)
    while qq:
        s = qq.popleft()
        for a in rev[s]:
            if a not in bd: bd[a] = bd[s] + 1; qq.append(a)
    dead = sum(1 for s in dist if s not in bd)
    goal_set = set(s for s in goals if dist[s] == best)
    memo = {}
    def seqs(st):
        if st in memo: return memo[st]
        if st in goal_set: memo[st] = {()}; return memo[st]
        out = set()
        for ns, a in succ[st]:
            if dist.get(ns) == dist[st] + 1 and bd.get(ns, 1e9) == bd[st] - 1:
                h = ((a, ns[1]),) if a == 'P' else ()
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
    acts = []
    for a_, b_ in zip(path, path[1:]):
        if a_[1] != b_[1]: acts.append(('P', b_[1], b_[2]))
        elif a_[2] != b_[2]: acts.append(('L', b_[1], b_[2]))
    return {'len': best, 'dead': dead, 'states': len(dist), 'unique': len(sq) == 1, 'acts': acts, 'path': path}
if __name__ == '__main__':
    out = []
    terr_opts = []
    base = BASE_TERR
    # the terrace as it is, or with one or two cells taken away; low walls 0..2 among the terrace's joints
    for drop in [()] + [(c,) for c in base if c not in ((1,1), (4,1))] + list(itertools.combinations([c for c in base if c not in ((1,1),(4,1))], 2)):
        terr = [c for c in base if c not in drop]
        joints = [frozenset((a, b)) for a in terr for b in terr if a < b and abs(a[0]-b[0]) + abs(a[1]-b[1]) == 1]
        for nw in (0, 1, 2, 3):
            for walls in itertools.combinations(joints, nw):
                for b0 in terr:
                    if b0 == (1, 1): continue
                    for lever in [(3, 2), (0, 3), (3, 1), (2, 3), (0, 2)]:
                        if lever == b0: continue
                        terr2 = terr + [lever] if lever not in terr else terr
                        for Q in [(6, 3), (5, 4), (4, 5), (3, 6), (7, 3), (6, 4), (5, 5), (4, 6), (3, 7)]:
                            r = run(terr2, walls, b0, lever, Q)
                            if not r or r['dead'] or not r['unique']: continue
                            np_ = sum(1 for a in r['acts'] if a[0] == 'P'); nl = sum(1 for a in r['acts'] if a[0] == 'L')
                            if np_ < 3 or nl < 1 or not (12 <= r['len'] <= 24): continue
                            # the lever is needed: without turning it, no way
                            r0 = run(terr2, walls, b0, None, Q)
                            if r0: continue
                            out.append((np_ + 2 * len(set(a[1] for a in r['acts'])) , r['len'], terr, [tuple(sorted(w)) for w in walls], b0, lever, Q, np_, nl, r['states']))
    out.sort(key=lambda o: (-o[0], o[1]))
    print(len(out), 'boards')
    seen = set()
    for o in out[:30]:
        print(json.dumps({'score': o[0], 'moves': o[1], 'drop': [c for c in BASE_TERR if c not in o[2]], 'walls': o[3], 'block': o[4], 'lever': o[5], 'square': o[6], 'pushes': o[7], 'turns': o[8], 'states': o[9]}))
