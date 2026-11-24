"""Level 6 trial (offered 24/11, after the twin across the water was kept for later: "something completely different"):
the ruin's columns toppled into bridges. Push a standing column (swipe into it from beside it) and it
falls away from you, over the next h places (its height): over water it is a bridge, walked only along its length
(onto it from its foot or from beyond its top, never from the side). It cannot fall where a standing column or a fallen
one lies, nor onto the start or the ring. Stepping back onto the start raises every column again (as the fourth
level's square sets its block back)."""
import sys, random
from collections import deque
D = {(1,0):'R',(-1,0):'L',(0,1):'D',(0,-1):'U'}
DOMINO = True
RESET = True
SEA_BEYOND = True      # a column may fall past the board's edge into the open sea (lost there)
class Board:
    def __init__(s, rows, heights):
        s.H = len(rows); s.W = len(rows[0]); s.slab=set(); s.cols={}; s.S=s.G=None; s.Wr=None
        for y,r in enumerate(rows):
            for x,c in enumerate(r):
                if c in 'oSGC': s.slab.add((x,y))
                if c=='S': s.S=(x,y)
                if c=='W': s.Wr=(x,y); s.slab.add((x,y))
                if c=='G': s.G=(x,y)
                if c=='C': s.cols[(x,y)]=heights[(x,y)] if isinstance(heights,dict) else heights.pop(0)
    def inb(s,p): return 0<=p[0]<s.W and 0<=p[1]<s.H
def cover(b, fallen):
    cells={}
    for (c,d) in fallen:
        h=b.cols[c]
        for k in range(1,h+1): cells[(c[0]+d[0]*k, c[1]+d[1]*k)]=(c,d,k)
    return cells
def moves(b, st):
    p, fallen = st; fd=dict(fallen); cells=cover(b, fallen)
    standing={c for c in b.cols if c not in fd}
    for d in D:
        q=(p[0]+d[0],p[1]+d[1])
        if not b.inb(q): continue
        if q in standing:      # push it over; its top, landing beside another standing column, knocks that one on (DOMINO)
            new=[]; covered=dict(cells); c=q
            while True:
                h=b.cols[c]; ok=True; span=[]
                for k in range(1,h+1):
                    r=(c[0]+d[0]*k,c[1]+d[1]*k)
                    if (not b.inb(r) and not SEA_BEYOND) or (r in standing and r not in [n for n,_ in new]) or r in covered or r==b.S or r==b.G or r==b.Wr: ok=False; break
                    span.append(r)
                if not ok: break
                new.append((c,d))
                for r in span: covered[r]=(c,d,0)
                t=(c[0]+d[0]*(h+1),c[1]+d[1]*(h+1))
                if not DOMINO or t not in standing or t in [n for n,_ in new]: break
                c=t
            if new: yield d, (p, frozenset(fallen|set(new))), 'push'
            continue
        # walking
        here=cells.get(p); there=cells.get(q)
        if here and here[1]!=d and (here[1][0]!=-d[0] or here[1][1]!=-d[1]): continue      # off a column only along it
        if there:
            c,dd,k=there
            along = dd==d or (dd[0]==-d[0] and dd[1]==-d[1])
            if not along: continue
            # onto a column from its foot (k==1 coming the column's way) or beyond its top (k==h coming back), or along it
            if not here:
                h=b.cols[c]
                if not ((dd==d and k==1 and p==c) or (dd!=d and k==h)): continue
            elif here[0]!=c: continue
        elif q not in b.slab or q in standing: continue
        if q==(b.Wr or b.S) and fallen and RESET: yield d, (q, frozenset()), 'reset'
        else: yield d, (q, fallen), 'walk'
def analyse(b):
    start=(b.S, frozenset()); seen={start:None}; dq=deque([start]); goal=None; edges={}
    while dq:
        s=dq.popleft(); edges[s]=[]
        for d,n,kind in moves(b,s):
            edges[s].append((d,n,kind))
            if n not in seen: seen[n]=(s,d,kind); dq.append(n)
    goals=[s for s in seen if s[0]==b.G]
    if not goals: return None
    rev={}
    for s,l in edges.items():
        for d,n,k in l: rev.setdefault(n,[]).append(s)
    dist={g:0 for g in goals}; dq=deque(goals)
    while dq:
        s=dq.popleft()
        for q in rev.get(s,[]):
            if q not in dist: dist[q]=dist[s]+1; dq.append(q)
    dead=[s for s in seen if s not in dist]
    from functools import lru_cache
    @lru_cache(None)
    def cnt(s):
        if s[0]==b.G: return 1
        return sum(cnt(n) for d,n,k in edges[s] if dist.get(n,10**9)==dist[s]-1)
    # the shortest way
    s=start; path=[]
    while s[0]!=b.G:
        for d,n,k in edges[s]:
            if dist.get(n,10**9)==dist[s]-1: path.append((d,k,n)); s=n; break
    return dist[start], cnt(start), len(seen), len(dead), path
def show(b, fallen=frozenset(), p=None):
    cells=cover(b,fallen); fd=dict(fallen); out=[]
    for y in range(b.H):
        row=''
        for x in range(b.W):
            q=(x,y)
            if q==p: ch='@'
            elif q in cells: ch='=' if cells[q][1][0] else '|'
            elif q in b.cols and q not in fd: ch=str(b.cols[q])
            elif q==b.S: ch='S'
            elif q==b.G: ch='G'
            elif q in b.slab: ch='o'
            else: ch='~'
            row+=ch+' '
        out.append(row)
    return '\n'.join(out)


LEVEL6 = (["~~~~~~oG",
           "~~~~~~oo",
           "~~~~~~~~",
           "W~~~~~~~",
           "oC~~C~C~",
           "SC~~C~~~"],
          {(1, 4): 2, (4, 4): 1, (6, 4): 3, (1, 5): 2, (4, 5): 2})
"""The board offered (x to the right, y down; S her start, W the winch that raises every column, G the ring before the
gate, C a column, its height in places beside it): pushed east from the start, the lower 2 knocks the 2 beyond it
(a bridge of two to x 6); from its end the 3 is pushed north, a bridge to the gate's islet; back, and the upper 2
knocks the 1 on, which stops at the 3's empty foot: the way to it. Pushed first, the upper 2 knocks the 1 and the 3
east into the sea: the winch is the way back. 27 places walked, one way only, no dead end in 201 states (176 of them
need the winch), every column needed: `python3 -I tools/go/topple_trial.py level6`."""

if __name__ == '__main__' and sys.argv[1:2] == ['level6']:
    b = Board(*LEVEL6); r = analyse(b); print('length, ways, states, dead:', r[:4]); print(show(b))
    print(' '.join(('*' if k == 'push' else '') + D[d] for d, k, s in r[4]))
