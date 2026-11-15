"""The puzzle of the ivory level of Eidolon GO, laid on the level's own floors and flights (goiv/trace.json), proved
solvable by a breadth-first search over its whole state, and written for the game as goiv/puzzle.json.

The puzzle (Lara Croft GO rules, as adapted here; the rules are stated exactly in RULES below and in step()):
  - Ione moves one edge per swipe; then the walking statue takes one step.
  - Faces (watchers) strike whatever ends a move on the node they look at: Ione, and the walking statue too.
    Stepped on from any other side, a face shatters.
  - The volute turns the two faces on turntables (the landing's and the upper terrace's) together.
  - The walking statue paces its route back and forth; it is broken only from behind.
  - The meander stone starts in the foot of the second stair: it keeps the statue up on the landing, and it must be
    pushed aside (from the side, never up a stair) to climb.

usage: python3 -I tools/ivory/puzzle_design.py [trace.json] [puzzle.json]
"""
import json, math, os, sys
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TRACE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'goiv', 'trace.json')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'goiv', 'puzzle.json')
T = json.load(open(TRACE))
FLOORS = T['floors']

# ------------------------------------------------------------------ the eye (Godot: Basis.from_euler(Vector3(-35, 45, 0) deg), order YXZ)
def _basis(pitch_deg=35.0, yaw_deg=45.0):
    """b = Ry(yaw) * Rx(-pitch): its columns are the screen's right (b.x), up (b.y) and back (b.z)"""
    a, y = math.radians(-pitch_deg), math.radians(yaw_deg)
    rx = [[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]]
    ry = [[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]]
    m = [[sum(ry[i][k] * rx[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    return [m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]]
BX, BY = _basis(T['eye']['pitch'], 45.0)
def screen(v):
    """the on-screen direction of a world vector: (right, up)"""
    return (sum(a * b for a, b in zip(v, BX)), sum(a * b for a, b in zip(v, BY)))
def sangle(v):
    sx, sy = screen(v); return math.degrees(math.atan2(sy, sx))

# ------------------------------------------------------------------ the flights, found by the floors they join
def floor_at(h):
    for k, f in FLOORS.items():
        if abs(f['h'] - h) < 1e-3: return k
    return None
FLIGHTS = {}
for fl in T['flights']:
    lo, hi = floor_at(fl[0][1]), floor_at(fl[1][1])
    FLIGHTS[(lo, hi)] = fl
F_S0, F_S1, F_S2, F_S2b, F_S3 = (FLIGHTS[(None, 'T0')], FLIGHTS[('T0', 'T1')], FLIGHTS[('T1', 'L')], FLIGHTS[('L', 'T2')], FLIGHTS[('T2', 'T3')])

# ------------------------------------------------------------------ the nodes: floor, x, z (y is the floor's height)
VOL = T['volute']; RING = T['ring']
NODE_DEF = {
    # T0, the lowest terrace: she comes up the first flight (S0) out of the mist to a0
    'a0': ('T0', 1.2, 4.9),        # start
    'a1': ('T0', 0.22, 4.9),       # the bend; a face here looks up toward the stair (teaches: break a face from its side)
    'a2': ('T0', 0.22, 3.95),      # foot of S1
    # T1, the great terrace
    'b0': ('T1', 0.17, 1.55),      # head of S1
    'b1': ('T1', 0.92, 1.55),
    'b2': ('T1', 0.17, 0.6),       # foot of S2: the meander stone stands here
    'b3': ('T1', 0.92, 0.6),       # the middle; the volute is turned from here, the stone pushed from here
    'b4': ('T1', -0.55, 0.6),      # the west nook, where the stone goes
    'b5': ('T1', VOL[0], VOL[2]),  # the volute (not walkable)
    # L, the landing
    'c0': ('L', 0.0, -1.7),        # head of S2, foot of S2'
    'c1': ('L', 0.75, -1.7),       # the landing face (on a turntable)
    'c2': ('L', 1.5, -1.7),
    'c3': ('L', 0.0, -2.45),       # before the arch; the statue turns here
    # T2, the upper terrace
    'd0': ('T2', -2.35, -1.75),    # head of S2'
    'd1': ('T2', -3.1, -1.75),     # the upper face (on a turntable)
    'd2': ('T2', -3.02, -2.45),    # foot of S3
    # T3, the top
    'ring': ('T3', RING[0], RING[2]),
}
NODES = {n: [round(x, 4), FLOORS[f]['h'], round(z, 4)] for n, (f, x, z) in NODE_DEF.items()}
WHERE = {n: f for n, (f, x, z) in NODE_DEF.items()}

# edges: [a, b, flight or None]; on a flight a is the lower node, b the upper, mids = [foot, head] of the flight
EDGE_DEF = [
    ('a0', 'a1', None), ('a1', 'a2', None), ('a2', 'b0', F_S1),
    ('b0', 'b1', None), ('b0', 'b2', None), ('b1', 'b3', None), ('b4', 'b2', None), ('b2', 'b3', None), ('b3', 'b5', None),
    ('b2', 'c0', F_S2),
    ('c0', 'c1', None), ('c1', 'c2', None), ('c0', 'c3', None),
    ('c0', 'd0', F_S2b),
    ('d0', 'd1', None), ('d1', 'd2', None),
    ('d2', 'ring', F_S3),
]
EDGES = [[a, b, [list(f[0]), list(f[1])] if f else []] for a, b, f in EDGE_DEF]

# ------------------------------------------------------------------ the things
START, EXIT = 'a0', 'ring'
BLOCK = 'b2'
VOLUTE = {'node': 'b5', 'toggles': {'watchers': {'c1': ['c2', 'c0'], 'd1': ['d0', 'd2']}}}      # facing in volute state 0, 1
WATCHERS = [{'node': 'a1', 'facing': 'a2'}, {'node': 'c1', 'facing': 'c2'}, {'node': 'd1', 'facing': 'd0'}]
WANDERERS = [{'route': ['c3', 'c0', 'b2', 'b0']}]      # starts on route[0], facing route[1]
LINES = ["He set a thousand faces to watch for her.", "Not one of them would know her."]
PUSH_COS = 0.9      # the stone goes on only straight on: cos of the angle between the push and the next edge (x, z)
BEHIND_COS = -0.9   # "behind the statue": cos of the angle between its facing and the way to her (x, z)
RULES = {
    'turn': "one swipe = one action of Ione; if it took a turn, the wanderer then takes one step",
    'swipe': "the edge from her node whose on-screen direction (neighbour minus node, camera basis) is nearest the swipe, within 45 deg; none: nothing happens",
    'volute': "swiping toward the volute from a neighbour turns it: its state flips 0<->1, every watcher in volute.toggles takes its facing for the new state; Ione stays; a turn passes; then a watcher looking at Ione strikes her, a watcher looking at the wanderer shatters it",
    'push': "swiping toward the block along a flat edge pushes it to the next node straight on (flat edge, cos >= %.2f in x,z), if that node is empty (no block, watcher, wanderer, volute); Ione takes the block's node; else nothing happens (no turn)" % PUSH_COS,
    'watcher': "steps onto a watcher's node: if it looks at her node she is struck, else it shatters and she takes its node",
    'wanderer_attack': "steps onto the wanderer's node: from directly behind it (cos <= %.2f between its facing and the way to her) it shatters; from its front she is caught; from the side nothing happens (no turn)" % BEHIND_COS,
    'after_move': "a watcher looking at her node strikes her (restart); on the exit the level ends (the wanderer does not step)",
    'wanderer_step': "it faces the next node of its route; if that node holds the block, a watcher or the volute it turns round in place (at a route end it stays); else it moves there (on Ione: caught), turns round at once if that was a route end, and is shattered if a watcher looks at that node",
    'death': "struck or caught: the level restarts",
}

# ------------------------------------------------------------------ the rules
class Puzzle:
    def __init__(s, block=BLOCK, wanderer=WANDERERS[0]['route'], volute=VOLUTE, watchers=WATCHERS, face_hits_wanderer=True, volute_frozen=False):
        s.names = list(NODES); s.ix = {n: i for i, n in enumerate(s.names)}
        s.pos = [NODES[n] for n in s.names]
        s.adj = [[] for _ in s.names]; s.flat = {}
        for a, b, mids in EDGES:
            i, j = s.ix[a], s.ix[b]; s.adj[i].append(j); s.adj[j].append(i); s.flat[(i, j)] = s.flat[(j, i)] = not mids
        s.start, s.exit = s.ix[START], s.ix[EXIT]
        s.block0 = s.ix[block] if block else -1
        s.vol = s.ix[volute['node']]
        tog = volute['toggles']['watchers']
        s.faces = []      # (node, facing in state 0, facing in state 1)
        for w in watchers:
            f = tog.get(w['node'], [w['facing'], w['facing']])
            s.faces.append((s.ix[w['node']], s.ix[f[0]], s.ix[f[1]]))
        s.route = [s.ix[n] for n in wanderer] if wanderer else None
        s.fhw = face_hits_wanderer; s.frozen = volute_frozen
        s.cont = {}      # (from, block node) -> the node the block is pushed to
        for k in range(len(s.names)):
            for a in s.adj[k]:
                if not s.flat[(a, k)]: continue
                d = s._dir(a, k)
                for c in s.adj[k]:
                    if c != a and s.flat[(k, c)] and s._dot(d, s._dir(k, c)) >= PUSH_COS: s.cont[(a, k)] = c
    def _dir(s, a, b):
        dx, dz = s.pos[b][0] - s.pos[a][0], s.pos[b][2] - s.pos[a][2]; L = math.hypot(dx, dz) or 1.0
        return (dx / L, dz / L)
    def _dot(s, u, v): return u[0] * v[0] + u[1] * v[1]
    # a state: (Ione, block, volute 0/1, mask of faces standing, wanderer index on its route (-1: shattered), its direction +1/-1)
    def init(s): return (s.start, s.block0, 0, (1 << len(s.faces)) - 1, 0 if s.route else -1, 1)
    def looked_at(s, node, v, fm):
        return any(fm >> i & 1 and f[1 + v] == node for i, f in enumerate(s.faces))
    def face_on(s, node, fm):
        for i, f in enumerate(s.faces):
            if fm >> i & 1 and f[0] == node: return i
        return -1
    def w_front(s, wi, wd):
        j = wi + wd
        return s.route[j] if 0 <= j < len(s.route) else -1
    def w_behind(s, me, wi, wd):
        """is node me straight behind the wanderer (opposite the way it faces)?"""
        w = s.route[wi]; f = s.w_front(wi, wd)
        fd = s._dir(w, f) if f >= 0 else s._dir(s.route[wi - wd], w)
        return s._dot(fd, s._dir(w, me)) <= BEHIND_COS
    def step(s, st, nb):
        """Ione swipes along the edge to nb. Returns the new state, 'dead', 'win', or None (nothing happens, no turn)."""
        me, blk, v, fm, wi, wd = st
        R = s.route; wn = R[wi] if wi >= 0 else -1
        if nb == s.vol:                                   # the volute turns
            if s.frozen: return None
            v ^= 1
            if s.looked_at(me, v, fm): return 'dead'
            if wi >= 0 and s.fhw and s.looked_at(wn, v, fm): wi = -1; wn = -1
        else:
            if nb == blk:                                 # the stone is pushed
                if not s.flat[(me, nb)]: return None
                c = s.cont.get((me, nb))
                if c is None or c == s.vol or s.face_on(c, fm) >= 0 or c == wn: return None
                blk = c
            else:
                fi = s.face_on(nb, fm)
                if fi >= 0:                               # onto a face
                    if s.faces[fi][1 + v] == me: return 'dead'
                    fm &= ~(1 << fi)
                elif nb == wn:                            # onto the walking statue
                    if s.w_front(wi, wd) == me: return 'dead'
                    if not s.w_behind(me, wi, wd): return None
                    wi = -1; wn = -1
            me = nb
            if s.looked_at(me, v, fm): return 'dead'
            if me == s.exit: return 'win'
        if wi >= 0:                                       # the statue's step
            j = wi + wd
            nx = R[j] if 0 <= j < len(R) else -1
            if nx < 0 or nx == blk or s.face_on(nx, fm) >= 0 or nx == s.vol:
                if 0 <= wi - wd < len(R): wd = -wd
            else:
                wi = j
                if nx == me: return 'dead'
                if wi == 0 or wi == len(R) - 1: wd = -wd
                if s.fhw and s.looked_at(nx, v, fm): wi = -1
        return (me, blk, v, fm, wi, wd)

    def explore(s):
        """every state reachable without dying; for each, its moves"""
        st0 = s.init(); succ = {}; q = deque([st0]); seen = {st0}
        while q:
            x = q.popleft(); succ[x] = []
            for nb in s.adj[x[0]]:
                r = s.step(x, nb)
                if r is None: continue
                succ[x].append((nb, r))
                if r not in ('dead', 'win') and r not in seen: seen.add(r); q.append(r)
        return st0, succ
    def solve(s):
        st0, succ = s.explore()
        # distance to the exit, backwards
        rev = {}
        for x, lst in succ.items():
            for nb, r in lst:
                if r not in ('dead', 'win'): rev.setdefault(r, []).append(x)
        togo = {}; q = deque()
        for x, lst in succ.items():
            if any(r == 'win' for nb, r in lst): togo[x] = 1; q.append(x)
        while q:
            x = q.popleft()
            for p in rev.get(x, ()):
                if p not in togo: togo[p] = togo[x] + 1; q.append(p)
        res = {'states': len(succ), 'stuck': [x for x in succ if x not in togo],
               'deaths': sum(1 for lst in succ.values() for nb, r in lst if r == 'dead'),
               'moves': sum(len(l) for l in succ.values()), 'length': togo.get(st0)}
        if st0 in togo:      # the shortest way (first in edge order), and how many shortest ways there are
            path, states, x = [], [st0], st0
            while True:
                for nb, r in succ[x]:
                    if r == 'win' and togo[x] == 1: path.append(s.names[nb]); x = None; break
                    if r not in ('dead', 'win') and togo.get(r) == togo[x] - 1: path.append(s.names[nb]); x = r; states.append(r); break
                if x is None: break
            ways = {}
            def count(x):
                if x in ways: return ways[x]
                n = sum(1 if (r == 'win' and togo[x] == 1) else (count(r) if r not in ('dead', 'win') and togo.get(r) == togo[x] - 1 else 0) for nb, r in succ[x])
                ways[x] = n; return n
            res.update(solution=path, path_states=states, optimal_ways=count(st0))
        return res
    def describe(s, x):
        me, blk, v, fm, wi, wd = x
        faces = [s.names[f[0]] + '>' + s.names[f[1 + v]] for i, f in enumerate(s.faces) if fm >> i & 1]
        w = (s.names[s.route[wi]] + '>' + (s.names[s.w_front(wi, wd)] if s.w_front(wi, wd) >= 0 else '-')) if wi >= 0 else 'shattered'
        return {'ione': s.names[me], 'block': s.names[blk] if blk >= 0 else None, 'volute': v, 'watchers': faces, 'wanderer': w}

# ------------------------------------------------------------------ checks of the way on the level
def seg_dist(p, a, b):
    ax, az = a; bx, bz = b; dx, dz = bx - ax, bz - az; L2 = dx * dx + dz * dz
    t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - az) * dz) / L2)) if L2 else 0.0
    return math.hypot(p[0] - ax - t * dx, p[1] - az - t * dz)
def inside(poly, x, z):
    c = False
    for i in range(len(poly)):
        (x1, z1), (x2, z2) = poly[i], poly[(i + 1) % len(poly)]
        if (z1 > z) != (z2 > z) and x < x1 + (z - z1) * (x2 - x1) / (z2 - z1): c = not c
    return c
def inset(poly, x, z):
    d = min(seg_dist((x, z), poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly)))
    return d if inside(poly, x, z) else -d
def obstacles():
    """footprints of what stands on the floors, as (centre x, centre z, half size x, half size z, height, what): a
    column's plinth (0.29 m half), an arch's two piers (0.52..0.95 m out from its middle, 0.25 m deep), the cypress,
    the head"""
    out = []
    for p, h in T['columns']: out.append((p[0], p[2], 0.29, 0.29, p[1], 'column'))
    for p, ax in T['arches']:
        for sg in (-1, 1):
            u = sg * (0.52 + 0.95) / 2
            out.append((p[0] + u, p[2], 0.215, 0.25, p[1], 'arch pier') if ax == 'x' else (p[0], p[2] + u, 0.25, 0.215, p[1], 'arch pier'))
    cp = T['cypress'][0]; out.append((cp[0], cp[2], 0.3, 0.3, cp[1], 'cypress'))
    hp = T['head']; out.append((hp[0], hp[2], 1.1, 1.1, hp[1], 'head'))
    return out
def clearance(x, z, o):
    cx, cz, hx, hz = o[:4]
    return math.hypot(max(abs(x - cx) - hx, 0.0), max(abs(z - cz) - hz, 0.0))

def check_way():
    bad = []; rep = []
    obs = obstacles()
    for n, p in NODES.items():
        f = WHERE[n]; poly = FLOORS[f]['xz']; d = inset(poly, p[0], p[2])
        near = min(((clearance(p[0], p[2], o), o[5]) for o in obs if abs(o[4] - p[1]) < 1.0), default=(9.9, '-'))      # (things near its own height)
        rep.append('  %-5s %-3s (%6.3f %5.2f %6.3f)  inside its floor by %.2f m, clear of things by %.2f m (%s)' % (n, f, p[0], p[1], p[2], d, near[0], near[1]))
        if n == VOLUTE['node']: continue
        if d < 0.45: bad.append('%s: only %.2f m inside floor %s' % (n, d, f))
        if near[0] < 0.25: bad.append('%s: %.2f m from a %s' % (n, near[0], near[1]))
    for a, b, mids in EDGES:
        pa, pb = NODES[a], NODES[b]
        if not mids:
            L = math.hypot(pb[0] - pa[0], pb[2] - pa[2])
            if not 0.6 <= L <= 1.05: bad.append('%s-%s: spacing %.2f m' % (a, b, L))
        else:
            fa = math.hypot(pa[0] - mids[0][0], pa[2] - mids[0][2]); fb = math.hypot(pb[0] - mids[1][0], pb[2] - mids[1][2])
            rep.append('  %-4s-%-4s climbs a flight: %.2f m from its node to the foot, %.2f m from the head to its node' % (a, b, fa, fb))
            if abs(pa[1] - mids[0][1]) > 1e-3 or abs(pb[1] - mids[1][1]) > 1e-3: bad.append('%s-%s: heights do not meet the flight' % (a, b))
    return rep, bad

def check_swipes(min_sep=50.0):
    """every edge from a node must lie at least min_sep degrees on screen from every other edge from it"""
    out = []; bad = []
    nbrs = {n: [] for n in NODES}
    for a, b, mids in EDGES: nbrs[a].append((b, mids, True)); nbrs[b].append((a, mids, False))
    for n, lst in nbrs.items():
        p = NODES[n]; angs = []
        for m, mids, fwd in lst:
            q = NODES[m]; ang = sangle([q[i] - p[i] for i in range(3)])
            first = (mids[0] if fwd else mids[1]) if mids else q      # the first leg (to the flight's end) for a check
            leg = [first[i] - p[i] for i in range(3)]
            leg_ang = sangle(leg) if math.hypot(leg[0], leg[2]) > 0.3 else ang
            angs.append((m, ang, leg_ang))
        seps = []
        for i in range(len(angs)):
            for j in range(i + 1, len(angs)):
                d = abs((angs[i][1] - angs[j][1] + 180) % 360 - 180); seps.append(d)
                if d < min_sep: bad.append('%s: edges to %s and %s only %.0f deg apart on screen' % (n, angs[i][0], angs[j][0], d))
        for m, a, l in angs:
            if abs((a - l + 180) % 360 - 180) > 25: bad.append('%s->%s: the first leg (%.0f deg) strays from the edge (%.0f deg)' % (n, m, l, a))
        out.append('  %-5s %s%s' % (n, '  '.join('%s %+4.0f' % (m, a) for m, a, l in angs), ('   (min %.0f deg apart)' % min(seps)) if seps else ''))
    return out, bad

# ------------------------------------------------------------------ run
def main():
    print('trace:', TRACE)
    rep, bad_way = check_way()
    print('\nthe way on the level (node, floor, position, inset from the floor edge, clearance from columns/arches/cypress/head):')
    print('\n'.join(rep))
    sw, bad_sw = check_swipes()
    print('\nscreen directions of the edges from each node (deg, 0 = screen right, 90 = screen up):')
    print('\n'.join(sw))
    print('\nviolations:', ('\n  ' + '\n  '.join(bad_way + bad_sw)) if bad_way + bad_sw else 'none')

    P = Puzzle(); r = P.solve()
    print('\nreachable states (alive):', r['states'], ' moves between them:', r['moves'], ' moves that kill:', r['deaths'])
    print('states from which the ring can no longer be reached (traps):', len(r['stuck']))
    if r['length'] is None: print('UNSOLVABLE'); sys.exit(1)
    print('minimal solution: %d swipes, %d shortest way(s)' % (r['length'], r['optimal_ways']))
    print('solution:', ' '.join(r['solution']))
    print('\nthe solution step by step (after each swipe):')
    for k, (mv, x) in enumerate(zip(r['solution'], r['path_states'][1:] + [None])):
        print('  %2d %-5s %s' % (k + 1, mv, 'the ring: level complete' if x is None else json.dumps(P.describe(x))))
    print('\nwhat each thing does (the minimal solution without it):')
    for label, kw in (('no meander stone', dict(block=None)), ('no walking statue', dict(wanderer=None)), ('the volute never turns', dict(volute_frozen=True)),
                      ('faces do not strike the statue', dict(face_hits_wanderer=False))):
        rr = Puzzle(**kw).solve()
        print('  %-32s %s%s' % (label, ('%d swipes' % rr['length']) if rr['length'] else 'unsolvable', ('' if not rr['length'] else '  (' + ' '.join(rr['solution']) + ')')))
    if r['stuck'] or bad_way or bad_sw:
        print('\nNOT WRITTEN: fix the violations / traps above'); sys.exit(1)

    out = {
        'nodes': NODES, 'edges': EDGES, 'start': START, 'exit': EXIT, 'block': BLOCK, 'volute': VOLUTE,
        'watchers': WATCHERS, 'wanderers': WANDERERS,
        'mechanisms': {
            'volute_turns_watchers': {'what': 'the faces on turntables turn together with the volute: [facing in state 0, facing in state 1]', 'watchers': VOLUTE['toggles']['watchers'], 'initial_state': 0},
            'watchers_strike_wanderer': True,
            'block_holds_wanderer': {'block': BLOCK, 'what': 'while the stone stands in the foot of S2 the statue turns back at the head of S2 (c0) and paces c3-c0 on the landing'},
            'wanderer_shattered_from': 'behind only',
        },
        'rules': dict(RULES, push_cos=PUSH_COS, behind_cos=BEHIND_COS, screen_basis={'right': [round(v, 5) for v in BX], 'up': [round(v, 5) for v in BY]}),
        'where': WHERE,
        'intro': [list(F_S0[0]), list(F_S0[1])],
        'solution': r['solution'],
        'solution_trace': [P.describe(x) for x in r['path_states'][1:]],
        'lines': LINES,
    }
    with open(OUT, 'w') as f: json.dump(out, f, indent=1)
    print('\nwritten:', OUT)


if __name__ == '__main__':
    main()
