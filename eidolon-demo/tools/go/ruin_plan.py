"""The plan of the sixth level (goruin/): the ruin's columns (offered 24/11, the owner: "something completely
different"; then "can you make it into a scene?").

Islets of white slabs on dark rock in a still sea, and on them the columns of a drowned ruin, each a different height:
a stump, a broken shaft, a whole column with its capital. Swipe into a standing column from beside it and it falls away
from her over as many places as it is tall, into the shallow water, and lies there as a bridge, its top level with the
slabs: walked only along its length. A column whose top comes down beside another standing one knocks it on the same
way (dominoes). The winch on the start islet raises every column back onto its base. The gate on its islet at the top.

The board is tools/go/topple_trial.py's LEVEL6, proven there: 27 places walked, one way only, no dead end in 200 states,
every column needed. In the world a place of the board is 1.5 m; the board's x (east) goes to the world's -z, its y
(south) to the world's +x, so her start is nearest the eye, the lower row runs up to the right of the picture, the left
column up to its left, and the gate is at the top.

usage: python3 -I tools/go/ruin_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from veil_plan import eye_fit
import topple_trial as T

H0 = 0.15      # (the slabs a little out of the still water; a fallen column's top lies level with them)
SEA = -0.3
STEP = 1.5
EDGE = 0.37      # (a column's base: its slab reaches that far (in places) from its middle toward the water it falls into)
COL_R = 0.36      # (a column's foot radius: a bridge she walks on)
ROWS, HEIGHTS = T.LEVEL6
BH, BW = len(ROWS), len(ROWS[0])


def W(bx, by, h=H0):      # a place of the board, in the world
    return [round(STEP * by - STEP * (BH - 1), 3), h, round(-STEP * bx, 3)]


def XZ(bx, by):
    p = W(bx, by)
    return [p[0], p[2]]


def poly(pts):      # an outline on the board ([(bx, by)], any turn) as a floor's corners in the world, turned as the builder's are
    q = [XZ(bx, by) for bx, by in pts]
    a = sum(q[i][0] * q[(i + 1) % len(q)][1] - q[(i + 1) % len(q)][0] * q[i][1] for i in range(len(q)))
    return q if a > 0 else q[::-1]


def rect(bx0, bx1, by0, by1):
    return poly([(bx0, by0), (bx1, by0), (bx1, by1), (bx0, by1)])


def name(c): return 'c%d_%d' % c


def col_len(h): return round(STEP * (h + 1) - 2 * EDGE * STEP, 3)      # (from its base's edge to the next base's: lying, it reaches that far)


def plan():
    b = T.Board(ROWS, dict(HEIGHTS))
    cells = [(x, y) for y in range(BH) for x in range(BW)]
    slab = set(b.slab) | {b.Wr}
    N = {name(c): W(*c) for c in cells}
    edges = []
    for (x, y) in cells:
        for (dx, dy) in ((1, 0), (0, 1)):
            q = (x + dx, y + dy)
            if q[0] < BW and q[1] < BH: edges.append([name((x, y)), name(q), []])
    r = T.analyse(b)
    assert r is not None and r[1] == 1 and r[3] == 0, r[:4]
    way = []; p = b.S
    for d, kind, s in r[4]:
        q = (p[0] + d[0], p[1] + d[1])
        way.append(name(q))
        if kind != 'push': p = q
    E = EDGE
    floors = {
        'S': {'h': H0, 'xz': poly([(-0.45, 2.48), (0.43, 2.48), (0.43, 4 - E), (1 + E, 4 - E), (1 + E, 5.47), (-0.45, 5.47)])},      # (the start islet: her start, the winch at its back, the two columns of two on its east side)
        'M': {'h': H0, 'xz': rect(4 - E, 4 + E, 4 - E, 5 + E)},      # (the two bases in the middle: the stump and a column of two)
        'P': {'h': H0, 'xz': rect(6 - E, 6 + E, 4 - E, 4 + E)},      # (the tall column's base, alone in the water)
        'G': {'h': H0, 'xz': poly([(6 - E, -0.72), (8.3, -0.72), (8.3, 0.72), (6.56, 0.72), (6.56, E), (6 - E, E)])},      # (the gate's islet: the place before the ring, the ring, the gate; the tall column's top comes to rest at its edge)
    }
    cols = [{'node': name(c), 'cell': list(c), 'h': h, 'len': col_len(h)} for c, h in sorted(HEIGHTS.items(), key=lambda kv: (kv[0][1], kv[0][0]))]
    G_ = b.G
    gate = W(G_[0] + 1.15 / STEP, G_[1])      # (the gate square to the way's last stretch (east), the ring 1.15 m before its middle)
    water = [name(c) for c in cells if c not in slab]
    puzzle = {
        'nodes': N, 'edges': edges, 'start': name(b.S), 'exit': name(G_), 'block': '', 'holes': [],
        'intro': [[N[name(b.S)][0], H0, N[name(b.S)][2] + 0.01], N[name(b.S)]],      # (no way in: she stands where the light of the fifth gate let her go)
        'watchers': [], 'wanderers': [], 'plinths': False, 'tutorial': False, 'gaps': [],
        'volute': {'node': name(b.Wr), 'kind': 'winch', 'once': False},      # (the winch: every column back onto its base)
        'grid': {'E': [0, 0, -1], 'S': [1, 0, 0], 'W': [0, 0, 1], 'N': [-1, 0, 0]},
        'unwalked': water,      # (no disc of the way over the water: a fallen column carries its own)
        'ruin': {'cols': cols, 'slabs': sorted(name(c) for c in slab), 'size': [BW, BH], 'edge': EDGE, 'r': COL_R, 'cells': {name(c): list(c) for c in cells}},
        'solution': way,
        'lines': ['Her soul stayed in the ruin,', 'without a face.'],      # (the script's ninth truth; to be settled with the owner)
    }
    Bk = lambda bx, by, rad, top: [W(bx, by, SEA), rad, top]      # (a rock under the slabs at a place of the board)
    rocks = [Bk(-0.1, 5.1, 0.75, H0 - 0.2), Bk(0.05, 3.0, 0.65, H0 - 0.22), Bk(-0.35, 4.2, 0.6, H0 - 0.25),      # (under the start islet, out of the water about it; never toward the water a column falls into)
             Bk(6.9, -0.35, 0.7, H0 - 0.2), Bk(7.9, 0.1, 0.65, H0 - 0.22)]      # (under the gate's islet, behind the ring)
    lanes = []      # (open water where a column may come to lie: the rock under the slabs keeps clear of it)
    for (c, h) in HEIGHTS.items():
        for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if any((c[0] + dx * k, c[1] + dy * k) in slab for k in range(1, h + 1)): continue      # (it can never fall that way: a slab or a base there)
            x0 = c[0] + dx * E; y0 = c[1] + dy * E
            x1 = c[0] + dx * (h + 1 - E); y1 = c[1] + dy * (h + 1 - E)
            bx0, bx1 = sorted((x0, x1)) if dx else (c[0] - 0.3, c[0] + 0.3)
            by0, by1 = sorted((y0, y1)) if dy else (c[1] - 0.3, c[1] + 0.3)
            (ax, az), (bx_, bz) = XZ(bx0, by0), XZ(bx1, by1)
            lanes.append([round(min(ax, bx_), 3), round(max(ax, bx_), 3), round(min(az, bz), 3), round(max(az, bz), 3)])
    tops = [[N[cc['node']][0], H0 + cc['len'], N[cc['node']][2]] for cc in cols]
    pts = [N[name(c)] for c in slab] + [[x, f['h'], z] for f in floors.values() for x, z in f['xz']] + tops \
        + [[gate[0], H0 + 2.9, gate[2]]]
    pl = {
        'scene': 'wake', 'sea_y': SEA, 'heights': {'H0': H0}, 'floors': floors, 'flights': [],
        'nodes': {name(c): N[name(c)] for c in slab}, 'edges': [e for e in edges if e[0] in [name(c) for c in slab] and e[1] in [name(c) for c in slab]],
        'ring': N[name(G_)], 'stone': None, 'holes': [], 'faces': [],
        'horizon': 0.33, 'sun': [0.72, 0.2],      # (the fifth level's plain sky for now)
        'arches': [[gate, 'x']],
        'waters': lanes,
        'smooth_normals': ['rock', 'marble'],
        'rock_clamp': [0.04, 0.35, 0.06, 1.15, 0.3, 0.45],
        'statues': [], 'pedestals': [], 'shore_statues': [],
        'rocks': rocks,
        'rocks_after': [[W(-1.6, 6.4, SEA), 0.7, SEA + 0.55], [W(3.2, 7.0, SEA), 0.5, SEA + 0.35]],      # (two in the open sea before the start, low)
        'columns': [], 'volute': None, 'head': None, 'relief': None, 'cypress': None, 'observer': None,
        'eye': eye_fit(pts, top_room=0.3, bottom_room=0.16, margin=0.6),
        'shore': True,
        'scenery': [['statue', [N[cc['node']][0], H0 + cc['len'] / 2, N[cc['node']][2]], [0.72, cc['len'], 0.72], [0.9, 0.88, 0.86]] for cc in cols],      # (the columns, in the blockout's preview)
    }
    return pl, puzzle


def check(pz):
    """the plan's board is the trial's: its nodes, its columns, its way"""
    b = T.Board(ROWS, dict(HEIGHTS))
    assert pz['start'] == name(b.S) and pz['exit'] == name(b.G) and pz['volute']['node'] == name(b.Wr)
    assert {c['node'] for c in pz['ruin']['cols']} == {name(c) for c in HEIGHTS}
    print('the plan is the board: %d places, %d columns; the way (%d moves): %s' % (len(pz['nodes']), len(pz['ruin']['cols']), len(pz['solution']), ' '.join(pz['solution'])))


# the columns themselves, each built alone about its own foot (the game stands them on their bases and lays them down):
# Ionic, of drums, fluted, on a turned base of their own (the slab is their plinth); the 1 a stump, the 2 a broken
# shaft, the 3 whole with its capital, its volutes across the way it falls (north), so it lies on its side
COL = {1: {'broken': True, 'yaw': 20}, 2: {'broken': True, 'yaw': -35}, 3: {'broken': False, 'yaw': 0}}
def col_plan(h):
    pl, _ = plan()
    c = COL[h]
    sc = [0.0, 0.0, 0.0, col_len(h), COL_R, c['broken'], [c['yaw'], 0, 0],
          {'style': 'ionic', 'cap': 90, 'drum': 0.62, 'base': 'round', 'taper_h': col_len(3) - 0.5}]
    pl.update({'floors': {}, 'rocks': [], 'rocks_after': [], 'arches': [], 'waters': [], 'shore': False, 'scenery': [],
               'nodes': {}, 'edges': [], 'ring': None, 'sea_columns': [sc]})
    return pl


if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[2].startswith('col'):
    json.dump(col_plan(int(sys.argv[2][3:])), open(sys.argv[1], 'w'), indent=1); print('wrote', sys.argv[1]); sys.exit(0)

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goruin/plan.json'
    pl, pz = plan()
    check(pz)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways; columns', [(c['node'], c['h'], c['len']) for c in pz['ruin']['cols']], '; eye', pl['eye'])
