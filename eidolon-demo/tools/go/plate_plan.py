"""The plan of the fourth level (goglass/), as the owner put it (19/11): she never crosses the glass.

A wall of glass stands across the level, facing the eye, in a still sea: the goddess's mirror, grown as tall as the
sky. Before it is the real place: a low landing where she stands, a stair up to a corridor of marble that runs to a
shut gate standing by the glass, and beside it a small terrace with a block on it. Beyond the glass is its reflection,
the same place turned over about the glass, and in the reflection only, just behind the glass, a plate of light. Push
the block so that its reflection stands on the plate, and the gate opens; it stays open. A great face lies far behind
in the sea, only its face out of the water (the owner).

The board is tools/go/plate_trial.py's 'plate' with a stair from her landing (proven there: 10 moves, one way, no dead
end): the block up, round it by the left, the block on; its reflection on the plate; back down the corridor to the
gate. In the world a step of the board is 1.5 m; grid x goes to the world's -z, grid y to its -x (as in the third
level), so the glass, gx + gy = 5, is the plane x + z = -7.5. Only the real side is built (level.glb); the game turns
it over about the glass for the reflection.

usage: python3 -I tools/go/plate_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from veil_plan import eye_fit
from plate_trial import BOARDS, Trial

HS, H0 = 0.0, 0.55      # (her landing; the corridor and the terrace)
SEA = -0.3
STEP = 1.5
K = 5      # (the glass: gx + gy = K)
W = lambda gx, gy, h: [round(-STEP * gy, 3), h, round(-STEP * gx, 3)]
MIRROR = lambda p: [round(-p[2] - STEP * K, 3), p[1], round(-p[0] - STEP * K, 3)]      # (a point turned over about the glass)
REAL = {      # name: (gx, gy), its place
    'S': ((0, 0), [0.0, HS, 0.45]),      # (her landing, a little out toward the eye so its stair has room)
    'C1': ((1, 0), W(1, 0, H0)), 'C2': ((2, 0), W(2, 0, H0)), 'C3': ((3, 0), W(3, 0, H0)),      # (the corridor)
    'R': ((4, 0), W(4, 0, H0)),      # (the gate's ring, by the glass)
    'A': ((0, 1), W(0, 1, H0)), 'B': ((1, 1), W(1, 1, H0)),      # (the terrace; the block)
    'D': ((0, 2), W(0, 2, H0)), 'E': ((1, 2), W(1, 2, H0)),
    'T': ((2, 2), W(2, 2, H0)),      # (the floor whose reflection is the plate, by the glass)
}
BOARD = dict(BOARDS['plate'], stairs=[((0, 0), (1, 0))])


def plan():
    t = Trial(BOARD)
    cell = {g: n for n, (g, p) in REAL.items()}
    nodes = {n: p for n, (g, p) in REAL.items()}
    fl = [[0.0, HS, -0.15], [0.0, H0, -0.95], 0.95, 4]      # (up from her landing to the corridor, away from the eye)
    edges, seen = [], set()
    for c in t.cells:
        for d in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            n = (c[0] + d[0], c[1] + d[1])
            if not t.way(c, n): continue
            a, b = cell[c], cell[n]
            if frozenset((a, b)) in seen: continue
            seen.add(frozenset((a, b)))
            if (c, n) in t.stairs:
                lo, hi = (a, b) if nodes[a][1] < nodes[b][1] else (b, a)
                edges.append([lo, hi, [fl[0], fl[1]]])
            else: edges.append([a, b, []])
    floors = {
        'L': {'h': HS, 'xz': [[0.7, 1.05], [0.7, -0.15], [-0.7, -0.15], [-0.7, 1.05]]},      # (her landing)
        'C': {'h': H0, 'xz': [[0.75, -0.95], [0.75, -6.75], [-0.75, -6.75], [-0.75, -0.95]]},      # (the corridor to the gate)
        'U': {'h': H0, 'xz': [[-0.75, 0.75], [-0.75, -2.25], [-3.75, -2.25], [-3.75, 0.75]]},      # (the terrace with the block)
        'P': {'h': H0, 'xz': [[-2.25, -2.25], [-2.25, -3.75], [-3.75, -3.75], [-3.75, -2.25]]},      # (its corner by the glass, the plate's real place)
        # (three plain slabs, never one outline with a recess: the builder caps the rock's core under a floor in a fan,
        # and over a recess the cap came up as a black face in it)
    }
    plate = MIRROR(nodes['T'])
    gate = [0.0, H0, -6.6]      # (beyond the ring, square to her last stretch, clear of the glass)
    puzzle = {
        'nodes': nodes, 'edges': edges, 'start': 'S', 'exit': 'R', 'block': 'B', 'holes': [],
        'intro': [[0.0, HS, 0.46], [0.0, HS, 0.45]],      # (no way in: she stands where the light of the third gate let her go)
        'watchers': [], 'wanderers': [], 'plinths': False, 'volute': None,
        'tutorial': False,
        'mirror': {'k': K, 'plane': [1.0, 1.0, STEP * K],      # (x + z + 7.5 = 0: the real side where it is above 0)
                   'plate_of': 'T', 'plate': plate},      # (the gate opens when the block stands on T: its reflection on the plate)
        'solution': ['C1', 'B', 'A', 'D', 'E', 'B', 'C1', 'C2', 'C3', 'R'],      # (B: the block pushed up to E; E: on to T)
        'lines': ['But a mirror gives no souls,', 'only images.'],      # (the script's next truth, after the goddess's mirror; to be settled with the owner)
    }
    rocks = [[[-4.75, SEA, -0.9], 0.95, H0 - 0.2],      # (the terrace's back, toward the glass)
             [[-4.6, SEA, 0.9], 0.8, H0 - 0.25],
             [[1.75, SEA, -2.6], 0.75, H0 - 0.2],      # (the corridor's right side)
             [[1.7, SEA, -5.0], 0.7, H0 - 0.25],
             [[-1.6, SEA, 1.8], 0.8, H0 - 0.3],      # (toward the eye, beside her landing)
             [[1.3, SEA, 1.25], 0.55, HS - 0.12],
             [[-2.6, SEA, 2.9], 0.38, SEA + 0.14]]      # (a small rock in the still water)
    pts = [p for p in nodes.values()] + [[x, f['h'], z] for f in floors.values() for x, z in f['xz']] \
        + [MIRROR([x, f['h'], z]) for f in floors.values() for x, z in f['xz']] + [[gate[0], gate[1] + 2.6, gate[2]], MIRROR([gate[0], gate[1] + 2.6, gate[2]])]
    pl = {
        'scene': 'wake', 'sea_y': SEA, 'heights': {'HS': HS, 'H0': H0}, 'floors': floors, 'flights': [fl],
        'nodes': nodes, 'edges': edges, 'ring': nodes['R'], 'stone': nodes['B'], 'holes': [], 'faces': [],
        'horizon': 0.33, 'sun': [0.5, 0.3],      # (placeholders until its backdrop is painted)
        'arches': [[gate, 'x']],      # (the gate is real: the mirror shows it too)
        'glass': {'k': K, 'plane': [1.0, 1.0, STEP * K], 'plate': plate},
        'rocks': rocks,
        'columns': [], 'volute': None, 'head': None, 'relief': None, 'cypress': None,
        'eye': eye_fit(pts, top_room=0.3, bottom_room=0.16, margin=0.7),
        'shore': True,
        'smooth_normals': ['rock', 'marble'],      # (for the light laid in brushstrokes, as in the other levels)
        'scenery': [],
    }
    return pl, puzzle, t, cell


def check(pz, t, cell):
    """the plan's way is the board's: every way of plate_trial's 'plate' with its stair, and no other"""
    ways = set()
    for c in t.cells:
        for d in ((1, 0), (0, 1)):
            n = (c[0] + d[0], c[1] + d[1])
            if t.way(c, n): ways.add(frozenset((cell[c], cell[n])))
    pe = {frozenset((e[0], e[1])) for e in pz['edges']}
    assert ways == pe, ('ways', ways ^ pe)
    assert cell[t.gate] == pz['exit'] and cell[t.stone0] == pz['block'] and cell[t.start] == pz['start'] and cell[t.target] == pz['mirror']['plate_of']
    r = t.solve()
    assert [cell[st[0]] for st in r['path'][1:]] == pz['solution'], [cell[st[0]] for st in r['path'][1:]]
    assert r['unique'] and not r['dead']
    print('the plan is the board: %d ways; the solution %d moves, unique, no dead end' % (len(pe), r['len']))


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goglass/plan.json'
    pl, pz, t, cell = plan()
    check(pz, t, cell)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways', len(pz['solution']), 'moves; eye', pl['eye'])
