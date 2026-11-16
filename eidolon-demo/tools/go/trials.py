"""Puzzles for Eidolon GO: the game's rules (ch1.gd: _ivg_turn, _ivg_w_step, _ivg_seen) as one solver, with new things.

The things the game has (as tools/go/moon_trial.py has them):
  - a FACE looks along a line, from the node before it straight on along level ways, until the stone, a face, a mirror's
    back or a hole stops it. Whoever ends a step in its look is struck: Ione (the trial begins again), or a statue (it
    shatters). Walk into a face from beside or behind and it falls (its plinth stays); from before it, she is struck.
  - the DIAL: swipe into it from beside and it turns; every face bound to it looks its other way.
  - the STONE: pushed one node straight on along a level way, never onto a plinth, the dial, a mirror, a statue or the
    ring. Behind it is shade.
  - the GUARDIAN paces its route, turning back at its ends or where the way is held. It catches her if it steps onto
    her or she walks into its face; she shatters it from behind.
  - the RING.
New things:
  - a MIRROR of bronze stands on a node: a look that reaches it turns a quarter, as light from a mirror does ('/' or
    '\\'). Swipe into it from beside and it turns the other way. Nothing walks onto it.
  - a HUNTER (a sleeping statue) faces one way. When she ends a step in its line (straight on, nothing between) it
    wakes; from the next turn it steps toward her each turn by the shortest level way (ties: straight on, then E, S,
    W, N). If it steps onto her she is caught; she cannot break it. It shatters in a look.
  - CRACKED floor holds her, but a statue or the stone on it falls, and the floor with it: a hole.
  - (faces_break) a face that another face's look reaches breaks, its plinth staying: so a mirror can turn one face's
    look onto another.

usage: python3 -I tools/go/trials.py [design ...]      (proves each design in DESIGNS, or all)
"""
import math, sys
from collections import deque

E, S_, W, N = 0, 1, 2, 3
DIRS = [(1, 0), (0, -1), (-1, 0), (0, 1)]
MIRROR = [{E: N, N: E, W: S_, S_: W}, {E: S_, S_: E, W: N, N: W}]      # ('/', '\\'): the way a look goes on, by the way it came


class Board:
    def __init__(s, cells, start, ring, cut=(), flights=(), gaps=(), start_at=None, ring_at=None):
        """cells (x, y) in a grid; level ways between cells side by side but those cut; flights (a, b) not level.
        start and ring are cells or ('S'/'R', the cell it joins by a flight, its place)"""
        s.cells = list(dict.fromkeys(cells))
        s.pos = {c: c for c in s.cells}
        s.names = ['%d%d' % c for c in s.cells]
        s.nb = {c: [] for c in s.cells}; s.level = {}
        for c in s.cells:
            for d in ((1, 0), (0, 1)):
                q = (c[0] + d[0], c[1] + d[1])
                if q in s.pos and (c, q) not in cut and (q, c) not in cut and (c, q) not in flights and (q, c) not in flights:
                    s.nb[c].append(q); s.nb[q].append(c); s.level[(c, q)] = s.level[(q, c)] = True
        for a, b in flights:
            s.nb.setdefault(a, []); s.nb.setdefault(b, [])
            s.nb[a].append(b); s.nb[b].append(a); s.level[(a, b)] = s.level[(b, a)] = False
        s.gap = {}
        for a, b in gaps: s.gap[(a, b)] = s.gap[(b, a)] = True      # (a chasm between two floors: a look goes over it, nobody walks it)
        s.start = start; s.ring = ring
        for c in (start, ring):
            if c not in s.pos: s.pos[c] = c
    def go(s, c, d):      # one level step from c the way d, or None
        q = (c[0] + DIRS[d][0], c[1] + DIRS[d][1])
        return q if s.level.get((c, q)) else None
    def go_look(s, c, d):      # where a look goes on from c the way d: a level way, or over a chasm
        q = (c[0] + DIRS[d][0], c[1] + DIRS[d][1])
        return q if (s.level.get((c, q)) or s.gap.get((c, q))) else None
    def dir_to(s, a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        for d, (x, y) in enumerate(DIRS):
            if (x, y) == (dx, dy): return d
        return None


class Trial:
    def __init__(s, B, faces=(), dial=None, stone=None, route=None, mirrors=(), hunters=(), cracks=(), plinths=True, faces_break=False):
        s.B = B
        s.faces = [(c, d0, d1) for c, d0, d1 in faces]      # (node, the way it looks with the dial at 0, at 1)
        s.dial = dial; s.stone0 = stone; s.route = list(route or [])
        s.mirrors = [(c, o) for c, o in mirrors]; s.mpos = {c: i for i, (c, _) in enumerate(s.mirrors)}
        s.hunters0 = [(c, d) for c, d in hunters]
        s.cracks = list(cracks); s.cix = {c: i for i, c in enumerate(s.cracks)}
        s.plinth = {c for c, _, _ in s.faces}; s.plinths = plinths; s.faces_break = faces_break
    # state: (me, stone, alive faces, dial, guardian's place on its route, its way, mirrors (bits: turned), hunters
    #         ((node, facing, awake) or None each), holes (bits))
    def init(s):
        m0 = sum(1 << i for i, (_, o) in enumerate(s.mirrors) if o)
        return (s.B.start, s.stone0, (1 << len(s.faces)) - 1, 0, 0 if s.route else -1, 1, m0,
                tuple((c, d, 0) for c, d in s.hunters0), 0)
    def face_on(s, n, alive):
        for k, (f, _, _) in enumerate(s.faces):
            if alive >> k & 1 and f == n: return k
        return -1
    def hole(s, n, holes): return n in s.cix and holes >> s.cix[n] & 1
    def walkable(s, n, holes): return n in s.B.nb and not s.hole(n, holes)
    def look(s, k, st, hit=None):
        """the nodes face k's look strikes (and, in hit, the face it stops at)"""
        me, stone, alive, v, wi, wd, mir, hs, holes = st
        f, d0, d1 = s.faces[k]; d = d1 if v else d0
        out = []; c = f; seen = set()
        while True:
            q = s.B.go_look(c, d)
            if q is not None and hit is not None and s.face_on(q, alive) >= 0 and q not in (stone,): hit.add(s.face_on(q, alive))
            if q is None or s.hole(q, holes) or q == stone or s.face_on(q, alive) >= 0 or q == s.dial: break
            if q in s.mpos:
                d = MIRROR[mir >> s.mpos[q] & 1][d]
                if (q, d) in seen: break
                seen.add((q, d)); c = q; continue
            out.append(q); c = q
            if len(out) > 60: break
        return out
    def seen(s, st):
        out = set()
        for k in range(len(s.faces)):
            if st[2] >> k & 1: out.update(s.look(k, st))
        return out
    def settle(s, st):
        """(faces_break) every face another's look reaches breaks, again until none does: the new state, how many broke"""
        if not s.faces_break: return st, 0
        n = 0
        while True:
            hit = set()
            for k in range(len(s.faces)):
                if st[2] >> k & 1: s.look(k, st, hit)
            hit = {k for k in hit if st[2] >> k & 1}
            if not hit: return st, n
            al = st[2]
            for k in hit: al &= ~(1 << k)
            n += len(hit); st = (st[0], st[1], al) + st[3:]
    def wnode(s, wi): return s.route[wi] if wi >= 0 else None
    def wfront(s, wi, wd):
        j = wi + wd; return s.route[j] if 0 <= j < len(s.route) else None
    def behind(s, me, wi, wd):
        w = s.route[wi]; f = s.wfront(wi, wd)
        fd = s.B.dir_to(w, f) if f else s.B.dir_to(s.route[wi - wd], w)
        return s.B.dir_to(w, me) == (fd + 2) % 4
    def blocked_for_statue(s, n, st, also=()):
        me, stone, alive, v, wi, wd, mir, hs, holes = st
        return (n == stone or s.face_on(n, alive) >= 0 or n == s.dial or n in s.mpos or n == s.wnode(wi) or n in also
                or s.hole(n, holes) or n == s.B.ring)
    def hunter_step(s, h, st, others):
        """where an awake hunter steps: toward her by the shortest level way (ties: straight on, then E, S, W, N)"""
        me = st[0]; c, face, aw = h
        if c == me: return c, face
        dist = {me: 0}; q = deque([me])
        while q:
            x = q.popleft()
            for d in range(4):
                y = s.B.go(x, d)
                if y is None or y in dist: continue
                if y != c and s.blocked_for_statue(y, st, others): continue
                dist[y] = dist[x] + 1; q.append(y)
        if c not in dist: return c, face
        best = None
        for d in [face] + [e for e in range(4) if e != face]:
            y = s.B.go(c, d)
            if y is None or y not in dist or (y != me and s.blocked_for_statue(y, st, others)): continue
            if dist[y] == dist[c] - 1: best = (y, d); break
        return best if best else (c, face)
    def in_line(s, h, st):      # she stands in a sleeping hunter's line: straight on from it, nothing between
        me, stone, alive, v, wi, wd, mir, hs, holes = st
        c, face, aw = h; x = c
        while True:
            x = s.B.go_look(x, face)
            if x is None or s.hole(x, holes) or x == stone or s.face_on(x, alive) >= 0 or x in s.mpos or x == s.dial: return False
            if x == me: return True
    def step(s, st, nb):
        """her swipe toward nb: (state, event), None if nothing happens, ('dead', why)"""
        me, stone, alive, v, wi, wd, mir, hs, holes = st
        ev = ''
        wn = s.wnode(wi)
        hpos = {h[0]: i for i, h in enumerate(hs) if h}
        if nb == s.dial:
            v ^= 1; ev = 'turn'
        elif nb in s.mpos:
            mir ^= 1 << s.mpos[nb]; ev = 'mirror'
        elif nb == stone:
            if not s.B.level.get((me, nb)): return None
            c = s.B.go(nb, s.B.dir_to(me, nb))
            if c is None or s.hole(c, holes) or c == s.dial or c in s.mpos or s.face_on(c, alive) >= 0 or c == wn or c in hpos: return None
            if s.plinths and (c in s.plinth or c == s.B.ring): return None
            me, stone = nb, c; ev = 'push'
            if c in s.cix: holes |= 1 << s.cix[c]; stone = None; ev += '+falls'
        elif nb in hpos: return ('dead', 'caught')
        else:
            if not s.walkable(nb, holes) and nb != s.B.ring: return None
            fi = s.face_on(nb, alive)
            if fi >= 0:
                f, d0, d1 = s.faces[fi]
                if s.B.go(f, d1 if v else d0) == me: return ('dead', 'struck')
                alive &= ~(1 << fi); me = nb; ev = 'break'
            elif wi >= 0 and nb == wn:
                if s.wfront(wi, wd) == me: return ('dead', 'caught')
                if not s.behind(me, wi, wd): return None
                wi = -1; me = nb; ev = 'smash'
            else: me = nb
        st = (me, stone, alive, v, wi, wd, mir, hs, holes)
        if me == s.B.ring: return (st, ev + ('+' if ev else '') + 'won')
        st, nb_ = s.settle(st)
        if nb_: alive = st[2]; ev += '+%d face%s broken by a look' % (nb_, '' if nb_ == 1 else 's')
        sn = s.seen(st)
        if me in sn: return ('dead', 'struck')
        # the statues in a look shatter (after the dial or a mirror turned)
        if wi >= 0 and s.wnode(wi) in sn: wi = -1; ev += '+shatter'
        n0 = sum(1 for h in hs if h)
        hs = tuple(None if (h and h[0] in sn) else h for h in hs)
        if sum(1 for h in hs if h) < n0: ev += '+hunter shatters'
        # the world's turn: the guardian
        if wi >= 0:
            j = wi + wd
            nx = s.route[j] if 0 <= j < len(s.route) else None
            hp = {h[0] for h in hs if h}
            if nx is None or nx == stone or s.face_on(nx, alive) >= 0 or nx == s.dial or nx in s.mpos or nx in hp or s.hole(nx, holes):
                if 0 <= wi - wd < len(s.route): wd = -wd
            else:
                wi = j
                if nx == me: return ('dead', 'caught')
                if wi == 0 or wi == len(s.route) - 1: wd = -wd
                if nx in s.cix: holes |= 1 << s.cix[nx]; wi = -1; ev += '+guardian falls'
        st = (me, stone, alive, v, wi, wd, mir, hs, holes)
        if wi >= 0 and s.wnode(wi) in s.seen(st): wi = -1; ev += '+shatter'
        # the hunters: the awake step toward her; the sleeping wake if she is in their line
        nhs = []
        for i, h in enumerate(hs):
            if h is None: nhs.append(None); continue
            c, face, aw = h
            if aw:
                cur = list(nhs) + list(hs[i + 1:])
                others = {x[0] for x in cur if x}
                st = (me, stone, alive, v, wi, wd, mir, tuple(cur[:i]) + (h,) + tuple(cur[i:]), holes)
                y, d2 = s.hunter_step(h, st, others)
                if y == me: return ('dead', 'caught')
                if y in s.cix: holes |= 1 << s.cix[y]; nhs.append(None); ev += '+hunter falls'; continue
                nhs.append((y, d2, 1)); continue
            nhs.append(h)
        hs = tuple(nhs)
        st = (me, stone, alive, v, wi, wd, mir, hs, holes)
        sn = s.seen(st)
        hs2 = []
        for h in hs:
            if h and h[0] in sn: hs2.append(None); ev += '+hunter shatters'; continue
            if h and not h[2] and s.in_line(h, st): h = (h[0], h[1], 1); ev += '+hunter wakes'
            hs2.append(h)
        st = (me, stone, alive, v, wi, wd, mir, tuple(hs2), holes)
        return (st, ev)


def moves(t, st):
    me = st[0]; out = list(t.B.nb.get(me, []))
    for x in [t.dial] + [c for c, _ in t.mirrors]:
        if x is not None and x in t.B.nb.get(me, []) and x not in out: out.append(x)
    if me == t.B.start or me in t.B.nb: pass
    return out


def solve(t, traps=True, limit=400000):
    s0 = t.init()
    if s0[0] in t.seen(s0): return None
    dist = {s0: 0}; ways = {s0: 1}; prev = {s0: None}; q = deque([s0]); succ = {}; goals = []
    while q:
        st = q.popleft(); succ[st] = []
        if st[0] == t.B.ring: goals.append(st); continue
        for nb in moves(t, st):
            r = t.step(st, nb)
            if r is None or r[0] == 'dead': continue
            nst, ev = r
            if nst == st: continue
            succ[st].append(nst)
            if nst not in dist:
                if len(dist) > limit: return dict(len=-1, ways=0, path=[], states=len(dist), traps=-1)
                dist[nst] = dist[st] + 1; ways[nst] = ways[st]; prev[nst] = (st, nb, ev); q.append(nst)
            elif dist[nst] == dist[st] + 1: ways[nst] += ways[st]
    if not goals: return None
    best = min(dist[g] for g in goals); nwy = sum(ways[g] for g in goals if dist[g] == best)
    g = min((x for x in goals if dist[x] == best), key=str)
    path = []; c = g
    while prev[c] is not None:
        st, nb, ev = prev[c]; path.append((nb, ev)); c = st
    path.reverse()
    nt = 0
    if traps:
        can = set(goals); rev = {}
        for st, ns in succ.items():
            for n2 in ns: rev.setdefault(n2, []).append(st)
        stack = list(goals)
        while stack:
            c = stack.pop()
            for p_ in rev.get(c, []):
                if p_ not in can: can.add(p_); stack.append(p_)
        nt = sum(1 for x in dist if x not in can)
    return dict(len=best, ways=nwy, path=path, states=len(dist), traps=nt)


def nm(c): return c if isinstance(c, str) else ('%d%d' % c if isinstance(c, tuple) and len(c) == 2 and isinstance(c[0], int) else str(c))


BUILT = {}
def report(name, t, without=True):
    sol = solve(t)
    BUILT[name] = (t, sol)
    print('\n######', name)
    if not sol: print('NO WAY'); return None
    print('shortest %d, %d way(s) of that length, %d states, %d dead ends' % (sol['len'], sol['ways'], sol['states'], sol['traps']))
    print(' '.join('%s%s' % (nm(n), '(' + e + ')' if e else '') for n, e in sol['path']))
    if without:      # each thing needed: without it the trial is shorter, or has no way
        import copy
        for what in ('faces', 'mirrors', 'hunters', 'cracks', 'route', 'stone', 'dial'):
            items = getattr(t, {'route': 'route', 'stone': 'stone0', 'dial': 'dial', 'hunters': 'hunters0'}.get(what, what))
            if not items: continue
            for k in (range(len(items)) if isinstance(items, list) and what not in ('route',) else [None]):
                t2 = copy.copy(t)
                if what == 'route': t2.route = []
                elif what == 'stone': t2.stone0 = None
                elif what == 'dial': t2.dial = None
                elif what == 'hunters': t2.hunters0 = [h for i, h in enumerate(t.hunters0) if i != k]
                elif what == 'faces': t2.faces = [f for i, f in enumerate(t.faces) if i != k]; t2.plinth = {c for c, _, _ in t2.faces}
                elif what == 'mirrors': t2.mirrors = [m for i, m in enumerate(t.mirrors) if i != k]; t2.mpos = {c: i for i, (c, _) in enumerate(t2.mirrors)}
                elif what == 'cracks': t2.cracks = [c for i, c in enumerate(t.cracks) if i != k]; t2.cix = {c: i for i, c in enumerate(t2.cracks)}
                s2 = solve(t2, traps=False)
                tag = what if k is None else '%s %s' % (what, nm(items[k][0] if isinstance(items[k], tuple) and isinstance(items[k][0], tuple) else items[k]))
                print('  without %-14s' % tag, 'no way' if s2 is None else s2['len'])
    return sol


DESIGNS = {}
def design(f): DESIGNS[f.__name__] = f; return f


if __name__ == '__main__':
    import importlib.util, os
    here = os.path.dirname(os.path.abspath(__file__))
    for fn in ('trials_designs.py',):
        p = os.path.join(here, fn)
        if os.path.exists(p):
            spec = importlib.util.spec_from_file_location('td', p); td = importlib.util.module_from_spec(spec)
            sys.modules['trials'] = sys.modules[__name__]; spec.loader.exec_module(td)
    names = [a for a in sys.argv[1:] if not a.startswith('-')] or list(DESIGNS)
    for n in names: DESIGNS[n]()
