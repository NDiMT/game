"""The plan of the fourth level (goglass/) as the owner settled it (19/11): the glass stands still and there is no winch
("take the winch out"; the glass hauled or slid by one was not understood: "why should the glass need pulling? I don't
understand"), and the real place and its image stand a little apart ("let the two sections have a little distance
between them": the glass further off than before). A wall of glass stands across the level in the still sea; before it
the real place: a corridor low over the water from her start to the shut gate by the glass, and a step above it a
terrace with the block. In the reflection alone a square of light, on the image of the terrace's corner by the glass:
push the block there and its image stands in the square; the ring lights, the gate opens. The same square of light lies
at her start: stepping on it puts the block back where it began (the owner: "if you step on it, it resets the block"),
for a block pushed into a corner never comes out. Four pushes, two ways of pushing, no dead end with the square at the
start (tools/go/still_glass_trial.py proves it).

In the world a step of the board is 1.5 m; grid x goes to the world's -z, grid y to its -x; the glass is the plane
x + z = -(1.5 K + GAP). Only the real side is built (level.glb, as for the moving glass: the same floors); the game
turns it over about the glass.

usage: python3 -I tools/go/still_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from veil_plan import eye_fit
from still_glass_trial import run, TERR as TERR0

H0, H1 = 0.1, 0.55      # (the corridor, low over the water; the terrace a step above it)
SEA = -0.3
STEP = 1.5
K = 6      # (the glass on the board: gx + gy = K, beyond the terrace's nearest row (gx + gy = 5))
GAP = 2.4      # (a little water between the real place and its image: 0.8 when they stood all but touching)
PLANES = [STEP * K + GAP]
W = lambda gx, gy, h: [round(-STEP * gy, 3), h, round(-STEP * gx, 3)]
S, G, T = (0, 0), (5, 0), (4, 1)
BLOCK = (1, 2)      # (the block at the terrace's back, by the far corner)
CORR = [(x, 0) for x in range(6)]
TERR = list(TERR0)      # (where the winch stood, a cell of the terrace as any other)


def node_name(c):
    return {S: 'S', T: 'T', G: 'R', BLOCK: 'B'}.get(c, 'n%d%d' % c)


def plan():
    cells = CORR + TERR
    h = lambda c: H0 if c[1] == 0 else H1
    nodes = {node_name(c): W(c[0], c[1], h(c)) for c in cells}
    cut = {frozenset(((x, 0), (x, 1))) for x in range(5)} - {frozenset(((1, 0), (1, 1)))}
    stairs = {frozenset(((1, 0), (1, 1)))}
    fl = [[-0.3, H0, -1.5], [-1.2, H1, -1.5], 0.95, 3]      # (up from the corridor onto the terrace, away from the eye)
    edges, seen = [], set()
    for a in cells:
        for d in ((1, 0), (0, 1)):
            b = (a[0] + d[0], a[1] + d[1])
            if b not in cells or frozenset((a, b)) in cut: continue
            ea, eb = node_name(a), node_name(b)
            if frozenset((a, b)) in stairs:
                lo, hi = (ea, eb) if nodes[ea][1] < nodes[eb][1] else (eb, ea)
                edges.append([lo, hi, [fl[0], fl[1]]])
            else: edges.append([ea, eb, []])
    floors = {      # (plain rectangles: the builder caps a floor's rock core in a fan, and over a recess it came up black)
        'C': {'h': H0, 'xz': [[0.75, 0.75], [0.75, -8.25], [-0.75, -8.25], [-0.75, 0.75]]},      # (the corridor, her start to the gate)
        'R1': {'h': H1, 'xz': [[-0.75, 0.75], [-0.75, -6.75], [-2.25, -6.75], [-2.25, 0.75]]},      # (the terrace's first row, its corner by the glass)
        'R2': {'h': H1, 'xz': [[-2.25, 0.75], [-2.25, -5.25], [-3.75, -5.25], [-3.75, 0.75]]},      # (its second, the winch at its end)
        'R3': {'h': H1, 'xz': [[-3.75, -0.75], [-3.75, -3.75], [-5.25, -3.75], [-5.25, -0.75]]},      # (its third)
    }
    MIR_ = lambda p, P: [round(-p[2] - P, 3), p[1], round(-p[0] - P, 3)]
    q_world = MIR_(W(T[0], T[1], H1), PLANES[0])      # (the square in the image: on the image of the terrace's corner by the glass)
    q_y = [H1]
    gate = [0.0, H0, -8.1]
    r = run(TERR, BLOCK, T)
    puzzle = {
        'nodes': nodes, 'edges': edges, 'start': 'S', 'exit': 'R', 'block': 'B', 'holes': [],
        'intro': [[0.0, H0, 0.01], [0.0, H0, 0.0]],
        'watchers': [], 'wanderers': [], 'plinths': False, 'tutorial': False,
        'volute': None,
        'unwalked': [],
        'reset': 'S',      # (the square of light at her start: stepping on it puts the block back where it began)
        'mirror': {'planes': PLANES, 'k0': 0, 'plane': [1.0, 1.0, PLANES[0]],
                   'plate': q_world, 'plate_y': q_y, 'plate_of': ['T']},
        'solution': None,
        'lines': ['But a mirror gives no souls,', 'only images.'],      # (the script's next truth; to be settled with the owner)
    }
    path = r['path']
    sol = []
    for a, b in zip(path, path[1:]):
        if a[0] != b[0]: sol.append(node_name(b[0]))
    puzzle['solution'] = sol
    rocks = [[[-6.1, SEA, -1.6], 0.9, H1 - 0.2], [[-5.9, SEA, 0.4], 0.8, H1 - 0.25],
             [[-4.6, SEA, 1.7], 0.75, H1 - 0.3], [[-2.3, SEA, 1.9], 0.7, H1 - 0.3],
             [[1.7, SEA, -2.6], 0.75, H0 - 0.1], [[1.6, SEA, -5.4], 0.7, H0 - 0.12], [[1.3, SEA, 0.9], 0.55, H0 - 0.12],
             [[-1.0, SEA, 2.7], 0.38, SEA + 0.14]]
    MIR = lambda p, P: [round(-p[2] - P, 3), p[1], round(-p[0] - P, 3)]
    pts = [p for p in nodes.values()] + [[x, f['h'], z] for f in floors.values() for x, z in f['xz']] \
        + [MIR([x, f['h'], z], PLANES[0]) for f in floors.values() for x, z in f['xz']] + [[gate[0], gate[1] + 2.6, gate[2]]]
    pl = {
        'scene': 'wake', 'sea_y': SEA, 'heights': {'H0': H0, 'H1': H1}, 'floors': floors, 'flights': [fl],
        'nodes': nodes, 'edges': edges, 'ring': nodes['R'], 'stone': nodes['B'], 'holes': [], 'faces': [],
        'horizon': 0.38, 'sun': [0.8, 0.17],
        'arches': [[gate, 'x']],
        'columns': [],
        'glass': {'planes': PLANES, 'plate': q_world},
        'rocks': rocks,
        'rocks_after': [[[0.0, SEA, 3.0], 1.0, SEA + 0.8, {'noimg': True}], [[1.35, SEA, 2.25], 0.55, SEA + 0.38, {'noimg': True}], [[4.45, SEA, -2.25], 0.8, SEA + 0.6, {'noimg': True}],
                        [[-0.72, SEA, 0.78], 0.44, H0 + 0.22], [[0.8, SEA, 0.12], 0.4, H0 + 0.16], [[0.12, SEA, 1.02], 0.32, H0 + 0.08]],      # (and brown rock about the corridor's end where she starts (the owner, 19/11: "I'd like brown rocks at the starting point"): its front corner, its right side, before it; sunk under the slab as every rock is, never up through it (the owner, 20/11: "I've told you a hundred times, no brown rocks through the slab"; for a day they stood up through its edges, let through by a 'noclamp' that is not to be used))      # (in the empty sea at the picture's foot, a rock and a smaller one beside it at the left, one at the right (the owner, 19/11: "two, three rocks down in the empty space"); made after all the rest)
        'volute': None, 'head': None, 'relief': None, 'cypress': None,
        'eye': eye_fit(pts, top_room=0.3, bottom_room=0.12, margin=0.7),      # (a little lower than before: the image, further off, stands higher)
        'shore': True,
        'smooth_normals': ['rock', 'marble'],
        'rock_clamp': [0.04, 0.35, 0.06, 1.15, 0.3],      # (and the tall rock reaching in over a floor cut back to its edge, as the third level's: the terrace's rock came 0.23 m in over the corridor at her start, 0.35 m over it (the owner, 20/11: "no brown rocks through the slab"))
        'scenery': [],
    }
    return pl, puzzle, r


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goglass/plan.json'
    pl, pz, r = plan()
    assert r and not r['dead'], r and r['dead']
    print('the trial: %d moves, %d pushes, %d states, no dead end with the square at the start; traps (the block cannot come out): %s; one way of pushing: %s; solution %s' % (r['len'], r['pushes'], r['states'], r['traps'], r['unique'], ' '.join(pz['solution'])))
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json; plate_of', pz['mirror']['plate_of'], 'eye', pl['eye'])
