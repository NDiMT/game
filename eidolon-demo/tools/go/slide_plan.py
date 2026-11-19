"""The plan of the fourth level (goglass/), as the owner settled its trial (19/11): she never crosses the glass; the
block slides until something stops it; it must be brought to rest where its reflection stands in a bright square of
light that is only in the mirror; then the ring before the gate lights and the gate opens.

A wall of glass stands across the level, facing the eye, in a still sea that mirrors nothing (only the glass does: the
owner, "with what you set up we have two reflections"). Before it is the real place: a corridor of marble low over
the water, from where she stands to a shut gate by the glass, and a step above it a terrace with the block, a broken
column and two low thresholds on it. Beyond the glass its reflection, the gate's toned down (the owner). A great face
lies far behind in the sea, only its face out of the water.

The board is tools/go/plate_trial.py's 'slide', proven there (19 moves, three pushes, one way, no dead end, the column
needed): push the block east, the column stops it; round by the thresholds, push it south, the terrace's edge stops
it; push it east, it slides to the glass, onto its place. In the world a step of the board is 1.5 m; grid x goes to
the world's -z, grid y to its -x, so the glass, gx + gy = 6, is the plane x + z = -9. Only the real side is built
(level.glb); the game turns it over about the glass for the reflection.

usage: python3 -I tools/go/slide_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from veil_plan import eye_fit
from plate_trial import BOARDS, Trial

H0, H1 = 0.1, 0.55      # (the corridor, low over the water; the terrace a step above it)
SEA = -0.3
STEP = 1.5
K = 6      # (the board's glass: gx + gy = K)
GAP = 0.8      # (the glass stands a little beyond the floors' far corners, x + z = -(9 + GAP): a strip of still water between
# the real terrace and the glass, so the real place and its reflection read apart (in the first concepts they ran into
# one another and the painter mixed them); the block still stops at its place, where the floor ends)
PLANE = STEP * K + GAP
W = lambda gx, gy, h: [round(-STEP * gy, 3), h, round(-STEP * gx, 3)]
MIRROR = lambda p: [round(-p[2] - PLANE, 3), p[1], round(-p[0] - PLANE, 3)]
BOARD = BOARDS['slide']


def names(t):
    out = {}
    for c in t.cells:
        h = H0 if c[1] == 0 else H1
        n = {t.start: 'S', t.stone0: 'B', t.target: 'T', t.gate: 'R'}.get(c, 'n%d%d' % c)
        out[c] = (n, W(c[0], c[1], h))
    return out


def plan():
    t = Trial(BOARD)
    nm = names(t); cell = {g: n for g, (n, p) in nm.items()}
    nodes = {n: p for g, (n, p) in nm.items()}
    fl = [[-0.3, H0, -1.5], [-1.2, H1, -1.5], 0.95, 3]      # (up from the corridor onto the terrace, away from the eye)
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
    floors = {      # (plain rectangles only: the builder caps a floor's rock core in a fan, and over a recess it came up black)
        'C': {'h': H0, 'xz': [[0.75, 0.75], [0.75, -8.25], [-0.75, -8.25], [-0.75, 0.75]]},      # (the corridor, her start to the gate)
        'R1': {'h': H1, 'xz': [[-0.75, 0.75], [-0.75, -6.75], [-2.25, -6.75], [-2.25, 0.75]]},      # (the terrace's first row, its place by the glass)
        'R2': {'h': H1, 'xz': [[-2.25, 0.75], [-2.25, -5.25], [-3.75, -5.25], [-3.75, 0.75]]},      # (its second: the block, the column)
        'R3': {'h': H1, 'xz': [[-3.75, -0.75], [-3.75, -3.75], [-5.25, -3.75], [-5.25, -0.75]]},      # (its third, the way round)
    }
    col = W(*sorted(t.pillars)[0], H1)      # (the broken column that stops the block's first slide)
    plate = MIRROR(nodes['T'])
    gate = [0.0, H0, -8.1]
    edge_mid = lambda a, b: [round((W(*a, H1)[0] + W(*b, H1)[0]) / 2, 3), H1, round((W(*a, H1)[2] + W(*b, H1)[2]) / 2, 3)]
    sills = [[edge_mid(a, b), 'z' if a[0] != b[0] else 'x'] for a, b in BOARD['sills']]      # (a low threshold across the joint: she steps over it, the block stops at it)
    walls = [[edge_mid(a, b), 'z' if a[0] != b[0] else 'x'] for a, b in BOARD['cut'] if a[1] >= 1 and b[1] >= 1]      # (a low wall where two floors of the terrace have no way between them)
    puzzle = {
        'nodes': nodes, 'edges': edges, 'start': 'S', 'exit': 'R', 'block': 'B', 'holes': [],
        'intro': [[0.0, H0, 0.01], [0.0, H0, 0.0]],      # (no way in: she stands where the light of the third gate let her go)
        'watchers': [], 'wanderers': [], 'plinths': False, 'volute': None, 'tutorial': False,
        'slide': True,      # (a pushed block slides until something stops it)
        'pillars': [col], 'sills': [[cell[a], cell[b]] for a, b in BOARD['sills']],
        'mirror': {'k': K, 'plane': [1.0, 1.0, PLANE], 'plate_of': 'T', 'plate': plate},
        'solution': None,
        'lines': ['But a mirror gives no souls,', 'only images.'],      # (the script's next truth, after the goddess's mirror; to be settled with the owner)
    }
    r = t.solve(); puzzle['solution'] = [cell[st[0]] for st in r['path'][1:]]
    rocks = [[[-6.1, SEA, -1.6], 0.9, H1 - 0.2], [[-5.9, SEA, 0.4], 0.8, H1 - 0.25],      # (the terrace's back, toward the glass)
             [[-4.6, SEA, 1.7], 0.75, H1 - 0.3], [[-2.3, SEA, 1.9], 0.7, H1 - 0.3],      # (its front, toward the eye)
             [[1.7, SEA, -2.6], 0.75, H0 - 0.1], [[1.6, SEA, -5.4], 0.7, H0 - 0.12], [[1.3, SEA, 0.9], 0.55, H0 - 0.12],      # (the corridor's right side)
             [[-1.0, SEA, 2.7], 0.38, SEA + 0.14]]
    pts = [p for p in nodes.values()] + [[x, f['h'], z] for f in floors.values() for x, z in f['xz']] \
        + [MIRROR([x, f['h'], z]) for f in floors.values() for x, z in f['xz']] + [[gate[0], gate[1] + 2.6, gate[2]]]
    pl = {
        'scene': 'wake', 'sea_y': SEA, 'heights': {'H0': H0, 'H1': H1}, 'floors': floors, 'flights': [fl],
        'nodes': nodes, 'edges': edges, 'ring': nodes['R'], 'stone': nodes['B'], 'holes': [], 'faces': [],
        'horizon': 0.33, 'sun': [0.5, 0.3],
        'arches': [[gate, 'x']],      # (the gate is real; the mirror shows it, toned down)
        'columns': [[col, 1.25]],      # (broken, a little higher than she is)
        'sills': sills, 'walls': walls,
        'glass': {'k': K, 'plane': [1.0, 1.0, PLANE], 'plate': plate},
        'face': {'model': 'props/iv_head.glb', 'at': [-15.0, SEA - 1.2, -17.0], 'size': 11.0, 'up': 30, 'lean': 30, 'turn': 0,
                 'alpha': 0.55},      # (the great face far behind in the sea, only its face out of the water, looking 30 up and leaning 30 aside (the owner, 19/11))
        'solved_at': nodes[cell[r['path'][13][0]]],      # (where she stands as the gate opens, for the solved picture)
        'rocks': rocks,
        'volute': None, 'head': None, 'relief': None, 'cypress': None,
        'eye': eye_fit(pts, top_room=0.3, bottom_room=0.16, margin=0.7),
        'shore': True,
        'smooth_normals': ['rock', 'marble'],      # (for the light laid in brushstrokes, as on the other maps)
        'rock_clamp': [0.04, 0.35, 0.06],      # (no rock up through a slab, as on the other maps)
        'scenery': [],
    }
    return pl, puzzle, t, cell


def check(pz, t, cell):
    """the plan's way is the board's: every way of plate_trial's 'slide', and no other"""
    ways = set()
    for c in t.cells:
        for d in ((1, 0), (0, 1)):
            n = (c[0] + d[0], c[1] + d[1])
            if t.way(c, n): ways.add(frozenset((cell[c], cell[n])))
    pe = {frozenset((e[0], e[1])) for e in pz['edges']}
    assert ways == pe, ('ways', ways ^ pe)
    r = t.solve(); assert r['unique'] and not r['dead']
    print('the plan is the board: %d ways; the solution %d moves, unique, no dead end' % (len(pe), r['len']))


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goglass/plan.json'
    pl, pz, t, cell = plan()
    check(pz, t, cell)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways', len(pz['solution']), 'moves; eye', pl['eye'])
