"""Level 6 trial (offered 24/11; the owner: "think of something very clever for the 6th puzzle"): you and your image (Ione, in red) across still water. Each swipe moves both the same way in their own
board's terms (along the water: the same; toward the water: both toward it), each only where her own way goes on.
Coordinates on each side: x along the water, y how far from it (1 nearest). A 'ripple' node on your side: stepping onto
it stirs the water, and she does not follow on that swipe."""
import random, itertools, sys
from collections import deque
D = [(1,0),(-1,0),(0,1),(0,-1)]
def step(nodes, p, d):
    q = (p[0]+d[0], p[1]+d[1])
    return q if q in nodes else p
def solve(A, B, sa, sb, ga, gb, ripple=frozenset()):
    start = (sa, sb); prev = {start: None}; dq = deque([start]); goal=None
    while dq:
        s = dq.popleft()
        if s == (ga, gb): goal = s; break
        for d in D:
            a = step(A, s[0], d); b = s[1] if a in ripple and a != s[0] else step(B, s[1], d)
            n = (a, b)
            if n == s or n in prev: continue
            prev[n] = (s, d); dq.append(n)
    if goal is None: return None
    path=[]; s=goal
    while prev[s]: s0,d=prev[s]; path.append((d,s)); s=s0
    return path[::-1]
def analyse(A, B, sa, sb, ga, gb, ripple=frozenset()):
    # all states reachable, their distance to the goal (reverse search over the explicit graph)
    start=(sa,sb); seen={start}; dq=deque([start]); edges={}
    while dq:
        s=dq.popleft(); edges[s]=[]
        for d in D:
            a=step(A,s[0],d); b=s[1] if a in ripple and a!=s[0] else step(B,s[1],d); n=(a,b)
            if n==s: continue
            edges[s].append((d,n))
            if n not in seen: seen.add(n); dq.append(n)
    rev={}
    for s,l in edges.items():
        for d,n in l: rev.setdefault(n,[]).append(s)
    G=(ga,gb); dist={G:0}; dq=deque([G])
    while dq:
        s=dq.popleft()
        for p in rev.get(s,[]):
            if p not in dist: dist[p]=dist[s]+1; dq.append(p)
    if start not in dist: return None
    dead=[s for s in seen if s not in dist]
    # count shortest solutions
    from functools import lru_cache
    @lru_cache(None)
    def cnt(s):
        if s==G: return 1
        return sum(cnt(n) for d,n in edges[s] if dist.get(n,10**9)==dist[s]-1)
    return dist[start], cnt(start), len(seen), len(dead)
def show(A, B, sa, sb, ga, gb, W, H, ripple=frozenset()):
    rows=[]
    for y in range(H,0,-1):
        rows.append(' '.join(('R' if (x,y)==gb else 'I' if (x,y)==sb else 'o') if (x,y) in B else '.' for x in range(W)))
    rows.append('~ '*W+' still water')
    for y in range(1,H+1):
        rows.append(' '.join(('G' if (x,y)==ga else 'Y' if (x,y)==sa else 'r' if (x,y) in ripple else 'o') if (x,y) in A else '.' for x in range(W)))
    return '\n'.join(rows)
def level6():
    """The board offered: a 4 by 3 slab terrace each side of the still water. One column stands in your glass temple
    (it stops only you); one slab has fallen from her real ruin (it stops only her); the island's edges and the water's
    stop each of you in turn. She starts as your image. Your ring before the gate at the right end of the far row, her
    pool at the right end by the water. 15 swipes, one way only, no dead end in 106 states, the column and the gap both
    needed (tools/go/twin_trial.py level6 prints it)."""
    W, H = 4, 3
    full = [(x, y) for x in range(W) for y in range(1, H + 1)]
    A = frozenset(set(full) - {(0, 2)}); B = frozenset(set(full) - {(1, 1)})
    return A, B, (0, 1), (0, 1), (3, 3), (3, 1), W, H


if __name__ == '__main__' and sys.argv[1:2] == ['level6']:
    A, B, sa, sb, ga, gb, W, H = level6()
    print(analyse(A, B, sa, sb, ga, gb)); print(show(A, B, sa, sb, ga, gb, W, H))
    print(' '.join({(1,0):'R',(-1,0):'L',(0,1):'B',(0,-1):'F'}[d] for d, s in solve(A, B, sa, sb, ga, gb)))
elif __name__ == '__main__':
    W, H = int(sys.argv[1]), int(sys.argv[2]); seed=int(sys.argv[3]); N=int(sys.argv[4])
    rng=random.Random(seed); full=[(x,y) for x in range(W) for y in range(1,H+1)]
    best=[]
    for it in range(N):
        A=set(full); B=set(full)
        for _ in range(rng.randint(1,3)): A.discard(rng.choice(full))
        for _ in range(rng.randint(1,3)): B.discard(rng.choice(full))
        A=frozenset(A); B=frozenset(B)
        sa=rng.choice(sorted(A)); sb=rng.choice(sorted(B)); ga=rng.choice(sorted(A)); gb=rng.choice(sorted(B))
        if sa==ga or sb==gb: continue
        # her start mirrors yours (she is your image when the level begins)
        if sb!=sa: continue
        r=analyse(A,B,sa,sb,ga,gb)
        if not r: continue
        L,c,n,dead=r
        if 10<=L<=14 and c==1 and dead==0:
            best.append((L,len(full)*2-len(A)-len(B),n,A,B,sa,sb,ga,gb))
    best.sort(key=lambda t:(-t[0],t[1]))
    for L,miss,n,A,B,sa,sb,ga,gb in best[:6]:
        print('L',L,'missing',miss,'states',n); print(show(A,B,sa,sb,ga,gb,W,H)); p=solve(A,B,sa,sb,ga,gb)
        print(' '.join({(1,0):'R',(-1,0):'L',(0,1):'B',(0,-1):'F'}[d] for d,s in p)); print()

