"""The third level redrawn from the start (the owner, 18/11: "redesign the third from the start"), stepped as the first two
levels are: a low platform in the sea, a terrace up a stair, an upper terrace up another, the gate at the top.

The goddess's sanctuary on Milos. A veiled marble woman stands in the sea to the east; the light of her eyes runs over
the water to the goddess's bronze mirror on its ledge at the terrace's west end, which throws it down onto the terrace
at first. Turned, it throws it north over the cleft to the upper terrace, where a stone stands in it before the ring.
Behind, out of the sea, the goddess herself, a colossus without arms (they broke when Theron took her mirror).

The board is tools/go/light_trial.py's terraces() (12 swipes, one way, no dead end): grid x runs east toward the statue,
y north up the terraces. In the world a step of the board is 1.5 m; grid x goes to the world's +x, y to its -z (the eye
sees the terrace run up to the left, the light come from the lower right, the terraces climb to the upper right).

usage: python3 -I tools/go/terraces_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from veil_plan import eye_fit

H0, H1, H2 = 0.0, 1.3, 2.3      # (the platform, the terrace, the upper terrace: the light from the mirror's disc on the terrace must meet the stone on the upper one)
SEA = -0.3
STEP = 1.5
BACK = 1.2      # (the upper terrace set back past the cleft: room for its stair)
W = lambda gx, gy, h: [round(STEP * gx, 3), h, round(-STEP * gy - (BACK if gy >= 3 else 0.0), 3)]      # (a cell of the board, in the world)
N = {
    'S': [3.0, H0, 1.4],          # (the platform in the sea where she stands as the level comes out of the light)
    'A': W(2, 1, H1),             # (the stair's head, the terrace's east end)
    'B': W(1, 1, H1), 'C': W(0, 1, H1),
    'M': W(0, 2, H1),             # (the goddess's mirror on its ledge: turned from C)
    'D': W(-1, 1, H1),            # (the terrace's west end)
    'E': W(-1, 2, H1),            # (the foot of the stair to the upper terrace)
    'F': W(-1, 3, H2),            # (its head)
    'G': W(-1, 4, H2),            # (behind the stone: from here it is pushed east)
    'K': W(0, 4, H2),             # (the stone, in the light's way)
    'NI': W(1, 4, H2),            # (its niche)
    'R': W(0, 5, H2),             # (the ring, before the gate)
}
LIGHT = {      # (places the light passes and no one walks: the sea between the statue and the mirror, the cleft)
    'Z': W(4, 2, H1), 'Q3': W(3, 2, H1), 'Q2': W(2, 2, H1), 'Q1': W(1, 2, H1),
    'CL': [0.0, H1, -STEP * 3 - BACK / 2],
}
GODDESS = ['goddess', [-7.6, SEA - 4.2, -9.0], 11.0, -1.2]      # (behind, at the left, out of the sea: a colossus as the Observer is in the first level)
WAY = ['A', 'B', 'C', 'M', 'D', 'E', 'F', 'G', 'K', 'G', 'K', 'R']      # (M: the mirror turned from C; the first K: the push)


def plan():
    fl1 = [[3.0, H0, 0.95], [3.0, H1, -1.05], 0.95, 10]      # (up from the platform to the terrace's east end)
    fl2 = [[-1.5, H1, -3.45], [-1.5, H2, -5.25], 0.95, 7]      # (from the terrace's west end up to the upper terrace)
    pairs = [('S', 'A'), ('A', 'B'), ('B', 'C'), ('C', 'D'), ('C', 'M'), ('D', 'E'), ('E', 'F'), ('F', 'G'), ('G', 'K'), ('K', 'NI'), ('K', 'R')]
    edges = [[a, b, [fl1[0], fl1[1]] if (a, b) == ('S', 'A') else ([fl2[0], fl2[1]] if (a, b) == ('E', 'F') else [])] for a, b in pairs]
    gaps = [['Z', 'Q3'], ['Q3', 'Q2'], ['Q2', 'Q1'], ['Q1', 'M'], ['M', 'CL'], ['CL', 'K']]
    floors = {
        'S': {'h': H0, 'xz': [[2.3, 2.15], [3.7, 2.15], [3.7, 0.95], [2.3, 0.95]]},      # (the platform)
        'T': {'h': H1, 'xz': [[-2.25, -0.75], [3.75, -0.75], [3.75, -2.25], [0.6, -2.25], [0.6, -3.75], [-0.6, -3.75],
                              [-0.6, -2.25], [-0.9, -2.25], [-0.9, -3.45], [-2.25, -3.45]]},      # (the terrace; the mirror's ledge to its north; its west end where the stair goes up, a cut of water between them)
        'U': {'h': H2, 'xz': [[-2.25, -5.25], [-0.75, -5.25], [-0.75, -6.45], [2.25, -6.45], [2.25, -7.95], [0.75, -7.95],
                              [0.75, -9.0], [1.25, -9.0], [1.25, -10.3], [-1.25, -10.3], [-1.25, -9.0], [-0.75, -9.0], [-0.75, -7.95],
                              [-2.25, -7.95]]},      # (the upper terrace: the stair's head, behind the stone, the stone, its niche, the ring, the gate's landing)
    }
    face = lambda dx, dz: round(math.atan2(-dz, dx), 3)
    statues = [['standing', [6.0, -1.0, -3.0], 3.4, face(-1.0, 0.0)],      # (the light's statue in the sea, her eyes on the mirror; a placeholder model)
               GODDESS]
    puzzle = {
        'nodes': dict(N, **LIGHT), 'edges': edges, 'start': 'S', 'exit': 'R', 'block': 'K', 'holes': [],
        'intro': [[3.0, H0, 1.41], [3.0, H0, 1.4]],
        'watchers': [], 'wanderers': [], 'plinths': False, 'volute': None, 'tutorial': False,
        'mirrors': [{'node': 'M', 'turn': 0}],      # ('/': the light coming west goes on south, onto the terrace, until it is turned)
        'gaps': gaps,
        'grid': {'E': [1, 0, 0], 'S': [0, 0, 1], 'W': [-1, 0, 0], 'N': [0, 0, -1]},
        'light': {'from': 'Z', 'dir': 'W', 'at': [5.75, 2.2, -3.0]},      # (from the height of her eyes (the owner))
        'unwalked': list(LIGHT) + ['NI'],
        'solution': WAY,
        'lines': ["He stole the goddess's mirror.", 'She let him.'],
    }
    rocks = [[[3.0, SEA, 1.55], 0.95, H0 - 0.25],      # (under the platform)
             [[-0.5, SEA, -8.4], 1.3, H2 - 0.35], [[-2.6, SEA, -6.9], 1.0, H2 - 0.5],      # (under the upper terrace, its back and sides)
             [[2.6, SEA, -8.4], 0.9, H2 - 0.6], [[3.25, SEA, -7.2], 0.85, H2 + 1.0],      # (and the rock the niche is cut against)
             [[-2.8, SEA, -2.4], 0.95, H1 - 0.45], [[4.3, SEA, -1.2], 0.7, H1 - 0.7]]      # (the terrace's ends)
    pts = [p for p in N.values()] + [[x, f['h'], z] for f in floors.values() for x, z in f['xz']] + [[0.0, H2 + 2.3, -9.55]] \
        + [[6.0, 2.4, -3.0]]
    pl = {
        'scene': 'wake', 'sea_y': SEA, 'heights': {'H0': H0, 'H1': H1, 'H2': H2}, 'floors': floors, 'flights': [fl1, fl2],
        'nodes': N, 'edges': edges, 'ring': N['R'], 'stone': N['K'], 'holes': [], 'faces': [],
        'horizon': 0.475, 'sun': [0.658, 0.282],
        'arches': [[[0.0, H2, -9.55], 'x']],      # (the gate, square to the way's last stretch, just behind the ring)
        'statues': statues, 'pedestals': [],
        'rocks': rocks,
        'columns': [], 'volute': None, 'head': None, 'relief': None, 'cypress': None,
        'eye': eye_fit(pts, top_room=0.33, bottom_room=0.2, margin=0.8),
        'shore': True,
        'scenery': [['statue', [s[1][0], s[1][1] + s[2] / 2, s[1][2]], [0.46 * s[2] / 3.4, s[2], 0.46 * s[2] / 3.4], [0.94, 0.93, 0.9]] for s in statues],
    }
    return pl, puzzle


def check(pz):
    """the plan's way is the board's: every level way and every light-only way of light_trial.terraces(), and no other"""
    from light_trial import terraces
    T = terraces()
    cell = {(-1, 2): 'E', (-1, 3): 'F', (-1, 4): 'G', (0, 4): 'K', (1, 4): 'NI', (0, 5): 'R', (2, 0): 'S', (2, 1): 'A', (1, 1): 'B',
            (0, 1): 'C', (0, 2): 'M', (-1, 1): 'D', (4, 2): 'Z', (3, 2): 'Q3', (2, 2): 'Q2', (1, 2): 'Q1', (0, 3): 'CL'}
    lv = {frozenset((cell[a], cell[b])) for a, b in T.level}
    gp = {frozenset((cell[a], cell[b])) for a, b in T.gaps}
    pe = {frozenset((e[0], e[1])) for e in pz['edges']}
    pg = {frozenset(g) for g in pz['gaps']}
    assert lv == pe, ('ways', lv ^ pe)
    assert gp == pg, ('gaps', gp ^ pg)
    assert cell[T.ring] == pz['exit'] and cell[T.stone0] == pz['block'] and cell[T.start] == pz['start']
    assert cell[T.mirrors[0][0]] == pz['mirrors'][0]['node'] and T.mirrors[0][1] == pz['mirrors'][0]['turn']
    print('the plan is the board: %d ways, %d light-only ways' % (len(pe), len(pg)))


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'gomilos/plan.json'
    pl, pz = plan()
    check(pz)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways', len(pz['solution']), 'swipes; eye', pl['eye'])
