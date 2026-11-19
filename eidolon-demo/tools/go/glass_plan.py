"""The plan of the fourth level (goglass/): the image is stepped on.

A wall of glass stands across the level, facing the eye: the goddess's mirror, grown into a sheet as tall as the sky,
in a still sea. Before it is the real place: a low ledge in the water where she stands, and above it a terrace of
marble with a block on it; a stair climbs from the ledge's far end to the one place where the glass is cracked. Beyond
the glass is its image, as a mirror shows it, the same floors turned over about the glass: but the image is not whole,
there is fog where one of its floors should be, and the ring of light and the gate stand only in the image. She alone
is not in the mirror: a mirror gives no souls, only images.

The board is tools/go/glass_trial.py's 'glass', proven there (11 moves, one way, no dead end, the image needed): from
the crack she pushes the block twice along the terrace; its image goes the other way, out of the crack's way and into
the fog by the ring, and holds her there. In the world a step of the board is 1.5 m; grid x goes to the world's -z,
grid y to its -x (as in the third level), so the glass, gx + gy = 4, is the plane x + z = -6 and the eye sees it across
the screen. Only the real side is built (level.glb): the game makes the image by turning it over about the glass.

usage: python3 -I tools/go/glass_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from veil_plan import eye_fit
from glass_trial import BOARDS, Trial

H0, H1 = 0.0, 1.0      # (the ledge in the water; the terrace)
SEA = -0.3
STEP = 1.5
K = 4      # (the glass: gx + gy = K)
XC = 1.4      # (the ledge lies this far out toward the eye from the terrace's grid line, so the stair has room)
W = lambda gx, gy, h: [round(-STEP * gy, 3), h, round(-STEP * gx, 3)]
MIRROR = lambda p: [round(-p[2] - STEP * K, 3), p[1], round(-p[0] - STEP * K, 3)]      # (a point of the world turned over about the glass)
REAL = {      # name: (gx, gy), its place
    'Q': ((0, 0), W(0, 0, H1)),      # (the terrace's nook: its image is the ring)
    'S': ((1, 0), [XC, H0, -1.5]),      # (her start, on the ledge)
    'L1': ((2, 0), [XC, H0, -3.0]),
    'L2': ((3, 0), [XC, H0, -4.5]),      # (the ledge's far end, the stair's foot)
    'T0': ((0, 1), W(0, 1, H1)),      # (the terrace's end: its image is missing, fog)
    'T1': ((1, 1), W(1, 1, H1)),
    'B': ((2, 1), W(2, 1, H1)),      # (the block)
    'X': ((3, 1), W(3, 1, H1)),      # (the crack in the glass)
}
IMAGE_NAME = {'Q': 'R', 'T0': 'F'}      # (the ring; the fog)
BOARD = dict(BOARDS['glass'], stairs=[((3, 0), (3, 1))])      # (the stair from the ledge to the crack: no push over it)


def iname(n): return IMAGE_NAME.get(n, 'i' + n)


def plan():
    t = Trial(BOARD)
    cell = {}
    for n, (g, p) in REAL.items():
        cell[g] = n
        if n != 'X': cell[t.m(g)] = iname(n)
    nodes = {n: p for n, (g, p) in REAL.items()}
    for n, (g, p) in REAL.items():
        if n != 'X': nodes[iname(n)] = MIRROR(p)
    fl = [[XC - 0.75, H0, -4.5], [-0.75, H1, -4.5], 0.95, 7]      # (up from the ledge's far end to the crack, away from the eye)
    ifl = [MIRROR(fl[0]), MIRROR(fl[1]), fl[2], fl[3]]
    edges, seen = [], set()
    for c in t.kind:
        for d in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            n = (c[0] + d[0], c[1] + d[1])
            if not t.way(c, n): continue
            a, b = cell[c], cell[n]
            if frozenset((a, b)) in seen: continue
            seen.add(frozenset((a, b)))
            st = (c, n) in t.stairs
            if st:      # (her way up or down the stair: from the lower end to the upper)
                lo, hi = (a, b) if nodes[a][1] < nodes[b][1] else (b, a)
                f = fl if lo == 'L2' else ifl
                edges.append([lo, hi, [f[0], f[1]]])
            else: edges.append([a, b, []])
    floors = {
        'U': {'h': H1, 'xz': [[0.6, 0.75], [0.6, -0.75], [-0.75, -0.75], [-0.75, -5.25], [-2.25, -3.75], [-2.25, 0.75]]},      # (the terrace: the nook, the block's row and the crack's real half, its edge on the glass)
        'L': {'h': H0, 'xz': [[XC + 0.72, -0.8], [XC + 0.72, -5.2], [XC - 0.75, -5.2], [XC - 0.75, -0.8]]},      # (the ledge in the water)
    }
    puzzle = {
        'nodes': nodes, 'edges': edges, 'start': 'S', 'exit': 'R', 'block': 'B', 'holes': [],
        'intro': [[XC, H0, -1.49], [XC, H0, -1.5]],      # (no way in: she stands where the light of the third gate let her go)
        'watchers': [], 'wanderers': [], 'plinths': False, 'volute': None,
        'tutorial': False,
        'glass': {'k': K, 'plane': [1.0, 1.0, STEP * K],      # (x + z + 6 = 0: the real side where it is above 0)
                  'cracks': ['X'], 'fog': ['F'],
                  'image_of': {n: iname(n) for n in REAL if n != 'X'}},
        'solution': ['L1', 'L2', 'X', 'B', 'T1', 'B', 'X', 'iB', 'iT1', 'F', 'R'],      # (B, T1: the pushes from the crack, the block on to T1, then T0; F: on the block's image)
        'lines': ['But a mirror gives no souls,', 'only images.'],      # (the script's next truth, after the goddess's mirror; to be settled with the owner)
    }
    gate = [-6.0, H1, -6.85]      # (beyond the ring, square to the last stretch, in the image only)
    rocks = [[[-3.05, SEA, -0.2], 0.95, H1 - 0.25],      # (the terrace's back, between it and the glass)
             [[-2.9, SEA, -2.2], 0.8, H1 - 0.35],
             [[0.2, SEA, 1.6], 0.85, H1 - 0.3],      # (the nook's shoulder, toward the eye)
             [[-1.3, SEA, 1.75], 0.75, H1 - 0.4],
             [[XC + 1.45, SEA, -2.4], 0.6, H0 - 0.15],      # (the ledge's shoulders in the water)
             [[XC + 1.2, SEA, -0.3], 0.5, H0 - 0.2],
             [[XC + 1.6, SEA, -4.6], 0.42, SEA + 0.16]]      # (a small rock in the still water)
    pts = [p for p in nodes.values()] + [[x, f['h'], z] for f in floors.values() for x, z in f['xz']] \
        + [MIRROR([x, f['h'], z]) for f in floors.values() for x, z in f['xz']] + [[gate[0], gate[1] + 2.6, gate[2]]]
    pl = {
        'scene': 'wake', 'sea_y': SEA, 'heights': {'H0': H0, 'H1': H1}, 'floors': floors, 'flights': [fl],
        'nodes': {n: p for n, (g, p) in REAL.items()}, 'edges': [e for e in edges if e[0] in REAL and e[1] in REAL],
        'ring': nodes['R'], 'stone': nodes['B'], 'holes': [], 'faces': [],
        'horizon': 0.33, 'sun': [0.5, 0.3],      # (placeholders until its backdrop is painted)
        'arches': [],      # (the gate stands in the image only: the game sets it there, it is not turned over)
        'gate': [gate, 'x'],
        'glass': {'k': K, 'plane': [1.0, 1.0, STEP * K], 'crack': REAL['X'][1], 'fog': [nodes['F']]},
        'rocks': rocks,
        'columns': [], 'volute': None, 'head': None, 'relief': None, 'cypress': None,
        'eye': eye_fit(pts, top_room=0.3, bottom_room=0.16, margin=0.7),
        'shore': True,
        'smooth_normals': ['rock', 'marble'],      # (for the light laid in brushstrokes, as in the other levels)
        'scenery': [],
    }
    return pl, puzzle, t, cell


def check(pz, t, cell):
    """the plan's way is the board's: every way of glass_trial's 'glass' (real and image), and no other"""
    ways = set()
    for c in t.kind:
        for d in ((1, 0), (0, 1)):
            n = (c[0] + d[0], c[1] + d[1])
            if t.way(c, n): ways.add(frozenset((cell[c], cell[n])))
    pe = {frozenset((e[0], e[1])) for e in pz['edges']}
    assert ways == pe, ('ways', ways ^ pe)
    assert cell[t.ring] == pz['exit'] and cell[t.stone0] == pz['block'] and cell[t.start] == pz['start']
    assert [cell[h] for h in t.holes] == pz['glass']['fog']
    r = t.solve()
    assert [cell[st[0]] for st in r['path'][1:]] == pz['solution'], [cell[st[0]] for st in r['path'][1:]]
    print('the plan is the board: %d ways; the solution %d moves, %s' % (len(pe), r['len'], 'unique' if r['unique'] else 'NOT unique'))


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goglass/plan.json'
    pl, pz, t, cell = plan()
    check(pz, t, cell)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways', len(pz['solution']), 'moves; eye', pl['eye'])
