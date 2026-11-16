"""The plan of "The Quarry" (the fourth level, goquarry/): the marble quarry where the sculptor cut his faces. Its board
is "aim, then fire" laid on benches (tools/go/trials_designs.py QUARRY, proven by tools/go/trials.py): a lower bench
where she starts, a stair up the left side to the upper bench (a U round a slot), a trench a look crosses, and the
corridor along the back wall to the door in the rock.

grid (gx, gy) -> world: x = X[gy] (the eye's upper left), z = Z[gx] (the eye's upper right); every edge on a 0.45 m
lattice, so the quarry is cut as a heightfield of square benches (tools/ivory_level.py, scene 'quarry')

usage: python3 -I tools/go/quarry_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import trials
spec = importlib.util.spec_from_file_location('td', os.path.join(HERE, 'trials_designs.py')); td = importlib.util.module_from_spec(spec)
sys.modules['trials'] = trials; spec.loader.exec_module(td)
Q = td.QUARRY
X = {0: 0.0, 1: -1.8, 2: -3.6, 3: -5.4, 4: -7.2, 5: -9.0}
Z = {0: 0.0, 1: -1.8, 2: -3.6, 3: -5.4, 4: -8.1}
E = 0.45
H0, HM, HT = 0.0, 0.65, 1.3
DIRS = {0: 'E', 1: 'S', 2: 'W', 3: 'N'}


def W(c): return [X[c[1]], Q['H'][c], Z[c[0]]]
def nm(c): return '%d%d' % c


def proof():
    """the trial proven again here, its one shortest way taken for the game's own play"""
    td.DESIGNS['quarry']()
    t, sol = trials.BUILT['the quarry (aim, then fire)']
    assert sol and sol['ways'] == 1 and sol['traps'] == 0, 'the quarry must have one shortest way and no dead end'
    return [nm(n) for n, _ in sol['path']]


def plan():
    SOL = proof()
    nodes = {nm(c): W(c) for c in Q['H']}      # (the dial and the mirror too: she swipes into them, never onto them)
    dial = W(Q['dial']); mirrors = [[W(c), o] for c, o in Q['mirrors']]
    flights = []; fl_of = {}
    for a, b in Q['flights']:      # from the lower floor's edge to the upper's, square to the axes
        lo, hi = (a, b) if Q['H'][a] < Q['H'][b] else (b, a)
        pl, ph = W(lo), W(hi)
        dx, dz = ph[0] - pl[0], ph[2] - pl[2]
        L = abs(dx) + abs(dz); ux, uz = dx / L, dz / L
        foot = [round(pl[0] + ux * E, 3), pl[1], round(pl[2] + uz * E, 3)]; head = [round(ph[0] - ux * E, 3), ph[1], round(ph[2] - uz * E, 3)]
        n = max(4, round((ph[1] - pl[1]) / 0.13))
        flights.append([foot, head, 0.9, n]); fl_of[frozenset((a, b))] = (foot, head, lo)
    edges = []
    for a, b in Q['level']: edges.append([nm(a), nm(b), []])
    for a, b in Q['flights']:
        foot, head, lo = fl_of[frozenset((a, b))]
        edges.append([nm(a), nm(b), [foot, head] if a == lo else [head, foot]])
    # the floors: one rectangle a cell, joined by the level ways (and the flights' heads): the benches' tops
    rects = {}
    for c, h in Q['H'].items():
        x, z = X[c[1]], Z[c[0]]
        rects[c] = [x - E, x + E, z - E, z + E, h]
    links = [[-E, E, E, 1.8, H0]]      # (the landing she comes in by)
    for a, b in Q['level']:
        pa, pb = W(a), W(b)
        if abs(pa[1] - pb[1]) > 0.01: continue
        links.append([min(pa[0], pb[0]) - E, max(pa[0], pb[0]) + E, min(pa[2], pb[2]) - E, max(pa[2], pb[2]) + E, pa[1]])
    puzzle = {
        'nodes': nodes, 'edges': edges, 'start': nm(Q['start']), 'exit': nm(Q['ring']), 'block': '',
        'watchers': [{'node': nm(f), 'dirs': [DIRS[d0], DIRS[d1]], 'gaze': True} for f, d0, d1 in Q['faces']],
        'volute': {'node': nm(Q['dial']), 'kind': 'capstan', 'toggles': {'faces': [nm(f) for f, d0, d1 in Q['faces'] if d0 != d1]}},
        'mirrors': [{'node': nm(c), 'turn': o} for c, o in Q['mirrors']],
        'gaps': [[nm(a), nm(b)] for a, b in Q['gaps']], 'faces_break': True,
        'grid': {'E': [0, 0, -1], 'S': [1, 0, 0], 'W': [0, 0, 1], 'N': [-1, 0, 0]},      # (the board's ways in the world: E is +gx, N is +gy)
        'wanderers': [], 'plinths': True, 'intro': [[0.0, H0, 1.35], [0.0, H0, E]],
        'solution': SOL,
        'lines': ['A face cannot bear another face.', 'Turn the bronze, and it will look.'],
        'end': 'He never carved a face that looked at her.',
    }
    pl = {
        'scene': 'quarry', 'heights': {'H0': H0, 'HM': HM, 'HT': HT}, 'cells': rects and [v for v in rects.values()], 'links': links,
        'floors': {}, 'flights': flights, 'nodes': dict(nodes, **{nm(Q['dial']): dial}), 'edges': edges, 'ring': W(Q['ring']),
        'faces': [[W(f), d0] for f, d0, d1 in Q['faces']], 'dial': dial, 'mirrors': mirrors, 'stone': None,
        'trench': [[-8.1, 1.4, -7.65, -5.85]],      # (x0, x1, z0, z1: the cut a look crosses; it stops at the west face)
        'walls': {'west': -8.1, 'north': -8.55, 'top': HT + 3.3, 'low_front': [-9.45, -7.65]},      # (the north face right behind the corridor: it runs along its foot, then through the west face)      # (the quarry's back faces: where they stand, how high)
        'door': [X[5] - 0.9, HT, Z[4]],      # (the way out: a door cut into the west face, the ring before it)
        'blocks': [[1.35, H0, -2.4, 0.9, 0.7, 0.8, 0.2], [1.25, H0, -3.4, 0.7, 0.55, 0.7, -0.1], [-2.25, HM, 1.2, 0.8, 0.6, 0.9, 0.3],
                   [-4.4, HT, -3.15, 0.9, 0.75, 1.1, 0.05], [-0.3, HT, -9.35, 1.1, 0.8, 0.9, 0.0]],      # (cut blocks lying about: x, y, z, width, height, depth, turn)
        'eye': {'pitch': 35.0, 'centre': [-5.4, 0.7, -5.4], 'width': 14.6},
        'volute': None, 'head': None, 'relief': None, 'cypress': None, 'columns': [], 'arches': [], 'rocks': [],
    }
    return pl, puzzle


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goquarry/plan.json'
    pl, pz = plan()
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways', len(pz['solution']), 'swipes')
