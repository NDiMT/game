"""The plan of "The Drowned Sanctuary", the level of the first trial (The Shield, tools/go/first_trial.py), laid
square on the plan's axes in world metres, as tools/ivory_level.py builds levels: its floors (height and outline),
flights, nodes and ways, and where its things stand.

The board, as the solver proves it (grid x across, y up the causeway):
  the causeway: K0 (2,-1) K1 (2,0) K2 (2,1) K3 (2,2) K4 (2,3), the face at its head (2,4) looking down it, the ring
  behind (2,5); the start arm: S (0,0), the stone ST (1,0); the lower ledge: L0 (0,-1), L1 (1,-1); the west arm:
  W1 (1,2), W0 (0,2); the west terrace: U3 (0,3), U4 (0,4), U5 (1,4).
Up the causeway is -x in the world (on the screen: up and to the left); across it, toward the west arm, is +z.
Where a way is a flight its two nodes stand further apart, so the steps have room; the lines a look runs along (the
causeway) and a push runs along (the start arm into the causeway) stay straight and level.

usage: python3 -I tools/go/shield_plan.py <out plan.json>
"""
import json, os, sys

H0, HL, HU = 0.0, -0.6, 0.6      # the causeway and its arms; the lower ledge; the west terrace and the ring's dais
N = {
    'S': (0.0, H0, 2.8), 'ST': (0.0, H0, 1.4), 'K1': (0.0, H0, 0.0),
    'L0': (1.6, HL, 2.8), 'L1': (1.6, HL, 1.6), 'K0': (1.6, H0, 0.0),
    'K2': (-1.0, H0, 0.0), 'K3': (-2.0, H0, 0.0), 'K4': (-3.2, H0, 0.0), 'F': (-5.0, H0, 0.0),
    'W1': (-2.0, H0, 1.4), 'W0': (-2.0, H0, 2.8),
    'U3': (-3.8, HU, 2.8), 'U4': (-5.0, HU, 2.8), 'U5': (-5.0, HU, 1.7),
    'R': (-6.75, HU, 0.0),
}
FLOORS = {
    # the causeway and its two arms, at the water's height: one floor (E-shaped)
    'C': {'h': H0, 'xz': [[2.1, -0.5], [2.1, 0.5], [0.5, 0.5], [0.5, 3.3], [-0.5, 3.3], [-0.5, 0.5], [-1.5, 0.5], [-1.5, 3.3],
                          [-2.5, 3.3], [-2.5, 0.5], [-5.5, 0.5], [-5.5, -0.5]]},
    'LE': {'h': HL, 'xz': [[1.1, 1.15], [2.85, 1.15], [2.85, 3.3], [1.1, 3.3]]},      # the lower ledge, just over the sea (room for a column off the way)
    'WT': {'h': HU, 'xz': [[-3.3, 2.3], [-3.3, 4.1], [-5.5, 4.1], [-5.5, 1.25], [-4.5, 1.25], [-4.5, 2.3]]},      # the west terrace (a bay behind the way for its columns)
    'D': {'h': HU, 'xz': [[-6.2, -1.3], [-6.2, 1.3], [-7.9, 1.3], [-7.9, -1.3]]},      # the dais of the ring
}
FLIGHTS = [      # foot, head, width, steps (each from one floor's edge to the next, square to the axes)
    [[1.1, HL, 2.8], [0.5, H0, 2.8], 0.9, 5],      # the start arm down to the ledge
    [[1.6, HL, 1.15], [1.6, H0, 0.5], 0.9, 5],      # the ledge up to the causeway's foot
    [[-2.5, H0, 2.8], [-3.3, HU, 2.8], 0.9, 5],      # the west arm up to the terrace
    [[-5.0, H0, 0.5], [-5.0, HU, 1.25], 0.9, 5],      # the terrace down to the face's side
    [[-5.5, H0, 0.0], [-6.2, HU, 0.0], 0.9, 5],      # behind the face, up to the ring
    [[0.0, -1.95, 5.75], [0.0, H0, 3.3], 0.9, 12],      # out of the sea up to the start (where she comes in)
]
SEA_Y = -1.6      # (the still sea, under the level)
BOARD = {      # the solver's board (tools/go/first_trial.py, HAND['shield']): its cells, by the nodes here
    'S': (0, 0), 'ST': (1, 0), 'K1': (2, 0), 'L0': (0, -1), 'L1': (1, -1), 'K0': (2, -1), 'K2': (2, 1), 'K3': (2, 2), 'K4': (2, 3),
    'F': (2, 4), 'W1': (1, 2), 'W0': (0, 2), 'U3': (0, 3), 'U4': (0, 4), 'U5': (1, 4), 'R': (2, 5)}
EDGES = [('S', 'ST'), ('ST', 'K1'), ('S', 'L0'), ('L0', 'L1'), ('L1', 'K0'), ('K0', 'K1'), ('K1', 'K2'), ('K2', 'K3'), ('K3', 'K4'),
         ('K4', 'F'), ('K3', 'W1'), ('W1', 'W0'), ('W0', 'U3'), ('U3', 'U4'), ('U4', 'U5'), ('U5', 'F'), ('F', 'R')]
FL_OF = {('S', 'L0'): 0, ('L1', 'K0'): 1, ('W0', 'U3'): 2, ('U5', 'F'): 3, ('F', 'R'): 4}


def plan():
    edges = []
    for a, b in EDGES:
        k = FL_OF.get((a, b))
        if k is None: edges.append([a, b, []])
        else:
            f = FLIGHTS[k]; fa, fb = (f[0], f[1]) if N[a][1] <= N[b][1] else (f[1], f[0])
            lo, hi = (f[0], f[1])
            edges.append([a, b, [lo, hi] if N[a][1] < N[b][1] else [hi, lo]])
    return {
        'scene': 'sea', 'sea_y': SEA_Y,
        'heights': {'H0': H0, 'HL': HL, 'HU': HU},
        'floors': FLOORS, 'flights': FLIGHTS,
        'nodes': {k: list(v) for k, v in N.items()}, 'edges': edges,
        'start': 'S', 'ring': list(N['R']), 'stone': list(N['ST']),
        'faces': [[list(N['F']), [1.0, 0.0, 0.0]]],      # (where, the way it looks: down the causeway)
        'columns': [[[2.42, HL, 2.5], 0.6], [[-4.3, HU, 3.66], 1.2], [[-5.1, HU, 3.66], 0.75], [[-6.62, HU, -0.88], 0.9]],      # (never on the way: tools/ivory_level.py moves or drops any that would be)
        'arches': [[[-7.25, HU, 0.0], 'z']],
        'rocks': [[[2.6, -0.9, 2.4], 0.9, -0.9], [[-1.0, -0.7, 2.2], 0.75, -0.45], [[-4.0, -0.5, -1.2], 1.0, -0.35], [[0.8, -0.8, -1.3], 0.9, -0.7],
                  [[-7.2, 0.0, 1.6], 1.0, 0.1], [[-6.0, 0.2, -1.6], 0.9, 0.2], [[-3.0, 0.1, 3.9], 0.9, 0.25]],
        'volute': None, 'head': None, 'relief': None, 'cypress': None, 'block': list(N['ST']),
        'eye': {'pitch': 35.0, 'centre': [-2.2, 0.3, 0.6], 'width': 8.6},
        'scenery': [      # (for the concept's layout only: what the picture is to paint far off)
            ['face', [-1.5, -2.4, -7.5], [2.4, 2.0, 1.9], [0.8, 0.8, 0.82]],      # a colossal face, half sunk beyond the causeway, looking at it
        ],
    }


def puzzle():
    """the trial for the game (as goiv/puzzle.json is): its way, the stone, the face and how it looks, the solution the
    solver proved (as the nodes she swipes to), and where she comes in: up out of the sea"""
    import importlib.util, os
    here = os.path.dirname(os.path.abspath(__file__))
    sv = sys.argv; sys.argv = [sv[0], '--none']
    spec = importlib.util.spec_from_file_location('ft', os.path.join(here, 'first_trial.py')); ft = importlib.util.module_from_spec(spec)
    try: spec.loader.exec_module(ft)
    except SystemExit: pass
    sys.argv = sv
    d = ft.HAND['shield']
    xs = [c[0] for c in d['nodes']]; ys = [c[1] for c in d['nodes']]; ox, oy = min(xs), min(ys)
    sh = lambda c: (c[0] - ox, c[1] - oy)
    nodes = sorted(sh(c) for c in d['nodes']); E = ft.edges_of([(sh(p_), sh(q_)) for p_, q_ in d['pairs']])
    ft.W, ft.H = max(c[0] for c in nodes) + 1, max(c[1] for c in nodes) + 1
    t = ft.Trial(nodes, E, sh(d['start']), sh(d['ring']), sh(d['stone']), [(sh(c), dd) for c, dd in d['faces']])
    sol = ft.solve(t)
    of_cell = {sh(v): k for k, v in BOARD.items()}
    seq = [of_cell[t.nodes[st[0]]] for st in sol['path'][1:]]
    # (the way here must be the board's: the same nodes joined)
    mine = {tuple(sorted((a_, b_))) for a_, b_ in EDGES}
    theirs = {tuple(sorted((of_cell[p_], of_cell[q_]))) for p_, q_ in E}
    assert mine == theirs, ('the way differs from the board', mine ^ theirs)
    pl = plan()
    return {
        'nodes': pl['nodes'], 'edges': pl['edges'], 'start': 'S', 'exit': 'R', 'block': 'ST',
        'watchers': [{'node': 'F', 'facing': 'K4', 'gaze': True}], 'plinths': True,
        'intro': [FLIGHTS[-1][0], FLIGHTS[-1][1]],
        'solution': seq, 'len': sol['len'],
        'lines': ['The sea took the sanctuary.', 'One face still keeps the way.'],
    }


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'gosea/plan.json'
    json.dump(plan(), open(out, 'w'), indent=1); print('wrote', out)
    pz = puzzle(); po = os.path.join(os.path.dirname(out), 'puzzle.json')
    json.dump(pz, open(po, 'w'), indent=1); print('wrote', po, 'solution', len(pz['solution']), ' '.join(pz['solution']))
