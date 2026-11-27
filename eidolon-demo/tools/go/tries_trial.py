"""The tries (27/11; the owner, of the Tower of the Winds: "no, something smarter", then of two put to him, "let's see
the one": the tries). The script's line: he carved a thousand statues, but none was her. Here each of her failed tries
is one of them.

The rule: she may step off into the sea (or onto a bridge that is down) and fall. Then her try is carved: a statue of
her that walks the very same walk again. The floor begins over: she at the start, and with her, at the start, every
statue of her tries, each taking its recorded step at each of her steps, together; at the end of its walk it stands
still, where she stood when she fell, for good. The statues pass through her and each other (they are her own tries,
not bodies that block), but they weigh: a plate holds the bridges of its letter up while she or any of them stands on
it; a bridge that sinks takes whoever stands on it. A floor carves only so many statues (K); a fall beyond them begins
the floor over with the same statues and carves no new one.

So she must fail on purpose, and plan where and when: a try that ends on a plate holds its bridge for the next, from
the moment it gets there; a try that passes over a plate holds it for those steps only; a later try can walk over a
bridge an earlier one holds up.

(Since the statues are the same walks in a world where more stand on plates, every bridge one of them crossed is up
again when it crosses it: a statue never falls, except one that ended on a bridge whose plate was let go later.)

board: rows of cells: '.' the sea, 'o' a slab, 'S' her start, 'G' the ring, 'a' 'b' plates, 'A' 'B' bridges.
usage: python3 -I tools/go/tries_trial.py      (proves the stages and prints their ways)"""
from collections import deque
D4 = {(1, 0): 'R', (-1, 0): 'L', (0, 1): 'D', (0, -1): 'U'}
DV = {v: k for k, v in D4.items()}
TMAX = 26      # (the longest walk a try may have, for the search)


class Board:
    def __init__(s, rows, K=2):
        s.rows = rows; s.H = len(rows); s.W = len(rows[0]); s.K = K
        s.floor = set(); s.plate = {}; s.bridge = {}; s.S = s.G = None
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                q = (x, y)
                if c in 'oSGab': s.floor.add(q)
                if c == 'S': s.S = q
                if c == 'G': s.G = q
                if c in 'ab': s.plate[q] = c.upper()
                if c in 'AB': s.bridge[q] = c

    def ups(s, holders):
        return frozenset(s.plate[q] for q in holders if q in s.plate)

    def stand(s, q, up):
        return q in s.floor or (q in s.bridge and s.bridge[q] in up)


# ---- one swipe, with the tries as walks (lists of places): the page's rules, for the check ----
def at(walk, t): return walk[min(t, len(walk) - 1)]


def move(b, st, d):
    """st = (tries: tuple of walks, run: the walk so far, from the start); -> (kind, new state); kind: move | fall | win"""
    tries, run = st
    t = len(run) - 1; h = run[-1]
    up = b.ups([at(w, t) for w in tries] + [h])
    q = (h[0] + d[0], h[1] + d[1])
    if q == b.G: return 'win', None
    if not b.stand(q, up): return 'fall', fall(b, st)
    up2 = b.ups([at(w, t + 1) for w in tries] + [q])
    if q in b.bridge and b.bridge[q] not in up2: return 'fall', fall(b, st)      # (it sinks under her)
    return 'move', (tries, run + (q,))


def fall(b, st):
    tries, run = st
    if len(tries) < b.K: tries = tries + (run,)
    return (tries, (b.S,))


def start(b): return ((), (b.S,))


# ---- the search: a try matters only by the plates it holds and when, so it is kept as that ----
def canon(seq):
    """a try's plates, step by step (None off them); its last stays for good"""
    seq = list(seq)
    while len(seq) > 1 and seq[-2] == seq[-1]: seq.pop()
    return tuple(seq)


def plate_at(sig, t): return sig[min(t, len(sig) - 1)]


def analyse(b, cap=3000000, count=True):
    """the fewest swipes to the ring over all her tries, and one way; (tries' plate-walks sorted, her plates so far,
    her place, time)"""
    s0 = ((), (None,), b.S, 0)
    dist = {s0: 0}; ways = {s0: 1}; par = {s0: None}; dq = deque([s0]); win = None; wins = []
    while dq:
        s = dq.popleft(); L = dist[s]
        if win is not None and L >= win: continue
        sigs, mine, h, t = s
        up = b.ups([]) | frozenset(p for p in (plate_at(g, t) for g in sigs) if p) | (frozenset([b.plate[h]]) if h in b.plate else frozenset())
        up_next = frozenset(p for p in (plate_at(g, t + 1) for g in sigs) if p)
        nexts = set()      # (two swipes that come to the same state are one way: a fall to either side of a plate)
        for d in D4:
            q = (h[0] + d[0], h[1] + d[1])
            if q == b.G:
                if win is None or L + 1 < win: win = L + 1; wins = []
                if L + 1 == win: wins.append((s, d))
                continue
            sank = False
            if b.stand(q, up):
                up2 = up_next | (frozenset([b.plate[q]]) if q in b.plate else frozenset())
                sank = q in b.bridge and b.bridge[q] not in up2
            if not b.stand(q, up) or sank:      # a fall: her try is carved (if the floor has room) and she begins again
                ns = tuple(sorted(sigs + (canon(mine),), key=repr)) if len(sigs) < b.K else sigs
                n = (ns, (None,), b.S, 0)
            else:
                if t + 1 > TMAX: continue
                n = (sigs, mine + (b.plate.get(q),), q, t + 1)
            if n in nexts: continue
            nexts.add(n)
            if n not in dist:
                dist[n] = L + 1; ways[n] = ways[s]; par[n] = (s, d); dq.append(n)
                if len(dist) > cap: return None
            elif dist[n] == L + 1:
                ways[n] = min(99, ways[n] + ways[s])
    if win is None: return None
    s, d = wins[0]; path = [d]
    while par[s]: s, d0 = par[s]; path.append(d0)
    path.reverse()
    nways = min(99, sum(ways[s] for s in {s for s, d in wins}))
    falls = 0; st = start(b)
    for d in path:
        k, n = move(b, st, d)
        if k == 'fall': falls += 1
        if k == 'win': break
        st = n
    return dict(L=win, ways=nways, states=len(dist), path=path, falls=falls)


def trace(b, path):
    st = start(b)
    for i, d in enumerate(path):
        k, n = move(b, st, d)
        if k == 'win': print(i + 1, D4[d], 'win'); break
        tries, run = n
        print(i + 1, D4[d], k, 'her', run[-1], 'tries at', [at(w, len(run) - 1) for w in tries], 'up', sorted(b.ups([at(w, len(run) - 1) for w in tries] + [run[-1]])))
        st = n


STAGES = [
    # the first try: the bridge rises only while someone stands on the plate; stand on it and give yourself to the
    # sea, and your try holds it for you
    ('the first try', ['..G', '..A', '..o', 'aoo', '.S.'], 1),
    # the wait: the bridge is near, the plate far; her try is slower than she is, so she waits for it (a step back)
    ('the wait', ['..G..', '..A..', 'o.o.o', 'o.S.o', 'ooooa'], 1),
    # two jobs: one try only; it must pass over the near plates at the very steps she crosses their bridge, and end on
    # the far plate that holds the last bridge
    ('two jobs', ['....G', '....B', 'SoAoo', 'o....', 'oaaob'], 1),
    # two tries: the first holds the near bridge, the second crosses it to the far plate and falls there
    ('two tries', ['G....', 'B....', 'o..b.', 'o..A.', 'Soao.'], 2),
]

if __name__ == '__main__':
    for name, rows, K in STAGES:
        b = Board(rows, K); r = analyse(b)
        if r is None: print(name, 'no way'); continue
        print('%s: %d swipes (%s), ways %s, %d states, falls %d (K %d)' % (name, r['L'], ''.join(D4[d] for d in r['path']), r['ways'], r['states'], r['falls'], K))
