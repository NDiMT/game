"""The plan of the fourth level (goglass/) with the glass that moves (the owner, 19/11: the sliding block and its low
thresholds turned down, "can you think of something else?"). A wall of glass stands across the level in the still sea;
before it the real place: a corridor low over the water from her start to the shut gate by the glass, and a step
above it a terrace with the block. In the reflection alone a square of light. With the glass where it stands, the
square falls on the image of the corridor, where the block can never go down; a winch on the terrace slides the glass
back one step, and the whole image slides with it, twice as far, as in any mirror: the square now falls on the image of
the terrace's corner by the glass. Push the block there: its image stands in the square, the ring lights, the gate
opens. One way, no dead end (tools/go/move_glass_trial.py proves it).

In the world a step of the board is 1.5 m; grid x goes to the world's -z, grid y to its -x; the glass, gx + gy = k, is
the plane x + z = -(1.5 k + GAP). Only the real side is built (level.glb); the game turns it over about the glass.

usage: python3 -I tools/go/move_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from veil_plan import eye_fit
from move_glass_trial import run, BASE_TERR

H0, H1 = 0.1, 0.55      # (the corridor, low over the water; the terrace a step above it)
SEA = -0.3
STEP = 1.5
KS = (6, 7)      # (the glass's two places on the board: gx + gy = k)
GAP = 0.8
PLANES = [STEP * k + GAP for k in KS]
W = lambda gx, gy, h: [round(-STEP * gy, 3), h, round(-STEP * gx, 3)]
S, G, T = (0, 0), (5, 0), (4, 1)
WINCH = (3, 2)      # (the winch, where the column stood: turned from the terrace beside it)
BLOCK = (2, 1)
Q = (6, 3)      # (the square, in the image: the image of the corridor's (3, 0) with the glass at 6, of T with it at 7)
CORR = [(x, 0) for x in range(6)]
TERR = list(BASE_TERR)


def node_name(c):
    return {S: 'S', T: 'T', G: 'R', BLOCK: 'B', WINCH: 'W'}.get(c, 'n%d%d' % c)


def plan():
    cells = CORR + TERR + [WINCH]
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
    img = lambda c, k: (k - c[1], k - c[0])
    MIR_ = lambda p, P: [round(-p[2] - P, 3), p[1], round(-p[0] - P, 3)]
    q_world = MIR_(W(T[0], T[1], H1), PLANES[1])      # (the square stands still in the image's space, at the terrace's height: where the image of T lies with the glass moved back)
    assert MIR_(W(KS[0] - Q[1], KS[0] - Q[0], H0), PLANES[0])[0::2] == q_world[0::2]      # (with the glass where it stands, it hangs over the image of the corridor's (3, 0))
    q_y = [H1, H1]      # (a square of light standing still in the image: over the image of the low corridor at first, on the image of the terrace's corner once the glass has moved)
    gate = [0.0, H0, -8.1]
    r = run(cells, [], BLOCK, WINCH, Q, ks=KS, k0=KS[0])
    puzzle = {
        'nodes': nodes, 'edges': edges, 'start': 'S', 'exit': 'R', 'block': 'B', 'holes': [],
        'intro': [[0.0, H0, 0.01], [0.0, H0, 0.0]],
        'watchers': [], 'wanderers': [], 'plinths': False, 'tutorial': False,
        'volute': {'node': 'W', 'kind': 'winch', 'once': False},      # (it turns back and forth: the glass between its two places)
        'unwalked': ['W'],
        'mirror': {'planes': PLANES, 'k0': 0, 'plane': [1.0, 1.0, PLANES[0]],
                   'plate': q_world, 'plate_y': q_y,
                   'plate_of': [node_name(c) if c in cells else '' for c in ((KS[0] - Q[1], KS[0] - Q[0]), (KS[1] - Q[1], KS[1] - Q[0]))]},
        'solution': None,
        'lines': ['But a mirror gives no souls,', 'only images.'],      # (the script's next truth; to be settled with the owner)
    }
    path = r['path']
    sol = []
    for a, b in zip(path, path[1:]):
        if a[0] != b[0]: sol.append(node_name(b[0]))
        elif a[2] != b[2]: sol.append('W')      # (she turns the winch: the swipe toward it)
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
        'columns': [],      # (no column: the winch stands where it stood)
        'glass': {'planes': PLANES, 'plate': q_world},
        'rocks': rocks,
        'volute': None, 'head': None, 'relief': None, 'cypress': None,
        'eye': eye_fit(pts, top_room=0.3, bottom_room=0.16, margin=0.7),
        'shore': True,
        'smooth_normals': ['rock', 'marble'],
        'rock_clamp': [0.04, 0.35, 0.06],
        'scenery': [],
    }
    return pl, puzzle, r


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goglass/plan.json'
    pl, pz, r = plan()
    assert r and not r['dead'] and r['unique'], r and (r['dead'], r['unique'])
    print('the trial: %d moves, %d states, no dead end, one way of pushing; solution %s' % (r['len'], r['states'], ' '.join(pz['solution'])))
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json; plate_of', pz['mirror']['plate_of'], 'eye', pl['eye'])
