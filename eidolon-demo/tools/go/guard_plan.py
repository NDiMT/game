"""The plan of the fifth level (goguard/): the Guardian (the script's tenth truth: "He looked into the mirror with
longing, and the mirror kept him").

A small island of white slabs on dark rock in a still sea at dusk. In its middle a pool, open to the sea at its back,
and in it on a round pedestal the Guardian of the Glass: Theron as the mirror keeps him, a hooded man of cracked glass.
He turns a quarter with each of her moves, and his gaze runs out along the ways; seen, she is taken back to the start.
The walk goes round the pool on three sides; a stone stands on it south-east of him; a pier runs out along his east
line, over a little water, to the goddess's bronze mirror on its round base (the same as the third level's; the owner,
21/11: "let's use the same mirror here"), at first facing south. The gate at the north-west, shut.

The board is tools/go/gaze_trial.py's guardian(), proven there: 19 swipes, one way, the stone needed. In the world a
step of the board is 1.5 m; grid x goes to the world's -z, grid y to its -x (the pier goes up to the right of the
picture, the gate up to its left).

usage: python3 -I tools/go/guard_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from veil_plan import eye_fit
from gaze_trial import guardian, solve, NAME

H0 = 0.6      # (the walk stands well out of the water, on its rock, as its concept has it)
SEA = -0.3
STEP = 1.5
W = lambda gx, gy, h=H0: [round(-STEP * gy, 3), h, round(-STEP * gx, 3)]      # (a cell of the board, in the world)
CELL = {(-2, -1): 'S', (-1, -1): 'A', (0, -1): 'B', (1, -1): 'K', (1, 0): 'E', (-1, 0): 'W', (-1, 1): 'V', (-1, 2): 'R',
        (0, -2): 'L', (1, -2): 'H', (2, -1): 'P', (2, 0): 'Q', (3, 0): 'T'}
GAZE = {(4, 0): 'M',      # (the goddess's mirror, on the pier's end)
        (0, 0): 'G',      # (the Guardian on his pedestal in the pool)
        (0, 1): 'N1', (0, 2): 'N2', (0, 3): 'N3', (-2, 0): 'W2', (-3, 0): 'W3', (0, -3): 'S3',      # (his lines over the water)
        (1, 1): 'D'}      # (the deep water at the pool's open back: the stone pushed in sinks there)
SINK = (1, 1)      # (deep water at the pool's open back: the stone pushed in sinks)


def rect(x0, x1, y0, y1):      # a rectangle of the board (in steps) as a floor's corners in the world's x and z
    return [[round(-STEP * y1, 3), round(-STEP * x1, 3)], [round(-STEP * y0, 3), round(-STEP * x1, 3)],
            [round(-STEP * y0, 3), round(-STEP * x0, 3)], [round(-STEP * y1, 3), round(-STEP * x0, 3)]]


def plan():
    t = guardian(); res = solve(t)
    name = {**CELL, **GAZE}
    N = {k: W(*c) for c, k in name.items()}
    edges = sorted({tuple(sorted((name[a], name[b]))) for a, b in t.level})
    edges = [[a, b, []] for a, b in edges] + [['M', 'T', []]]      # (the mirror turned from the pier's end: a swipe into it)
    gaps = sorted({tuple(sorted((name[a], name[b]))) for a, b in t.links})
    way = []
    for dn, cell, ev, ph in res['path']:
        way.append('M' if 'mirror' in ev else name[cell])
    floors = {
        'S1': {'h': H0, 'xz': rect(-2.5, 1.5, -1.5, -0.5)},      # (the start and the walk south of the pool)
        'S2': {'h': H0, 'xz': rect(-0.5, 1.5, -2.5, -1.5)},      # (below the stone: where she pushes it from)
        'WC': {'h': H0, 'xz': rect(-1.5, -0.5, -0.5, 2.5)},      # (the walk west of the pool, up to the ring)
        'EC': {'h': H0, 'xz': rect(0.5, 1.3, -0.5, 0.42)},      # (east of the pool, on his east line; a little water between it and the pier)
        'P1': {'h': H0, 'xz': rect(1.5, 2.5, -1.5, -0.5)},      # (round to the pier)
        'P2': {'h': H0, 'xz': rect(1.68, 4.5, -0.5, 0.5)},      # (the pier out along his east line, the mirror at its end)
    }
    guard = {'at': W(0, 0, SEA), 'pedestal_top': H0 + 0.1, 'height': 3.2, 'd0': NAME[t.d0], 'turn': t.turn}      # (a little under twice her height (the owner, 21/11: "smaller"; 4.0 before))
    puzzle = {
        'nodes': N, 'edges': edges, 'start': 'S', 'exit': 'R', 'block': 'K', 'holes': [],
        'intro': [[N['S'][0], H0, N['S'][2] + 0.01], N['S']],      # (no way in: she stands where the light of the fourth gate let her go)
        'watchers': [], 'wanderers': [], 'plinths': False, 'volute': None, 'tutorial': False,
        'gaps': [list(g) for g in gaps],
        'grid': {'E': [0, 0, -1], 'S': [1, 0, 0], 'W': [0, 0, 1], 'N': [-1, 0, 0]},
        'guard': dict(guard, node='G'),      # (he looks first south, and turns clockwise a quarter at each of her moves)
        'mirror_face': {'node': 'M', 'face': NAME[t.mface0], 'from': [name[c] for c in t.mfrom]},      # (a flat mirror, turned a quarter at a swipe into it; its face toward him keeps him)
        'sinks': {'E': {'N': 'D'}},      # (the stone on E pushed north goes over the edge into the deep water, D, and sinks)
        'unwalked': list(GAZE.values()),      # (no disc of the way where only his gaze goes: the water, his pedestal, the mirror, the deep water)
        'solution': way,
        'lines': ['He looked into the mirror', 'with longing,', 'and it kept him.'],      # (three lines, each within a phone's width)      # (the script's tenth truth; to be settled with the owner)
    }
    B = lambda gx, gy, r, top: [W(gx, gy, SEA), r, top]      # (a rock at a place of the board)
    rocks = [B(-2.25, -1.75, 0.85, H0 - 0.1), B(-1.2, -1.8, 0.8, H0 - 0.12), B(-2.8, -0.85, 0.8, H0 - 0.1),      # (the island's rock under its walk, out of the water all round it, its tops just under the slabs (the concept: the slabs on chunky dark rock))
             B(-0.75, -2.45, 0.75, H0 - 0.12), B(0.75, -2.75, 0.8, H0 - 0.1), B(1.6, -2.6, 0.75, H0 - 0.12),      # (none on his lines over the water: his gaze runs out over them)
             B(-1.85, 0.75, 0.8, H0 - 0.1), B(-1.85, 1.85, 0.8, H0 - 0.12), B(-1.6, 2.85, 0.95, H0 - 0.05),
             B(2.0, -1.85, 0.75, H0 - 0.12), B(2.85, -1.05, 0.7, H0 - 0.12), B(3.4, -0.85, 0.7, H0 - 0.12), B(4.35, -0.8, 0.7, H0 - 0.1),
             B(4.85, 0.1, 0.75, H0 - 0.1), B(2.6, 0.85, 0.65, H0 - 0.14), B(3.6, 0.85, 0.7, H0 - 0.12), B(4.5, 0.85, 0.6, H0 - 0.14),
             [[1.6, SEA, 4.0], 0.85, H0 - 0.2],      # (about the start, out of the water)
             [[3.3, SEA, 1.2], 0.7, H0 - 0.25],
             [[3.7, SEA, -1.5], 0.75, H0 - 0.25],      # (under the push spot's outer side)
             [[-4.3, SEA, 2.6], 0.9, H0 - 0.15],      # (behind the gate's rock)
             [[-2.4, SEA, -2.4], 0.6, H0 - 0.3],      # (the walk's back corner, by the deep water)
             [[1.9, SEA, -5.6], 0.7, H0 - 0.25],      # (under the pier's outer side)
             [[-1.6, SEA, -6.3], 0.75, H0 - 0.2]]      # (behind the mirror)
    pts = list(N[k] for k in CELL.values()) + [N['M'], [N['M'][0], H0 + 1.8, N['M'][2]]] + [[x, f['h'], z] for f in floors.values() for x, z in f['xz']] \
        + [[-3.9, H0 + 2.9, 1.5], [guard['at'][0], H0 + 3.8, guard['at'][2]]]
    pl = {
        'scene': 'wake', 'sea_y': SEA, 'heights': {'H0': H0}, 'floors': floors, 'flights': [],
        'nodes': N, 'edges': edges, 'ring': N['R'], 'stone': N['K'], 'holes': [], 'faces': [],
        'horizon': 0.33, 'sun': [0.72, 0.2],      # (a placeholder until its backdrop is painted: the low sun at the upper right)
        'arches': [[[-3.9, H0, 1.5], 'z']],      # (the gate, square to the way's last stretch (north, the world's -x), just behind the ring)
        'waters': [[-0.75, 0.75, -0.75, 0.75],      # (the pool round his pedestal)
                   [-0.75, 0.75, -2.55, -1.92],      # (the water between the walk east of the pool and the pier, where his gaze crosses)
                   [-2.4, -0.62, -2.4, -0.75]],      # (the deep water at the pool's back, beyond the walk east of it)
        'smooth_normals': ['rock', 'marble'],
        'rock_clamp': [0.04, 0.35, 0.06, 1.15, 0.3, 0.45],
        'statues': [], 'pedestals': [], 'shore_statues': [],
        'rocks': rocks,
        'rocks_after': [[[-3.9, SEA, -6.0], 0.95, SEA + 0.95], [[3.9, SEA, 2.4], 0.8, SEA + 0.75], [[4.9, SEA, 3.3], 0.42, SEA + 0.35]],      # (a few rocks in the sea, as its concept has them: one beyond the mirror, two before the start)
        'columns': [], 'volute': None, 'head': None, 'relief': None, 'cypress': None,
        'observer': [-11.3, -3.2, -7.1, 6.5, -0.6], 'observer_model': 'observer', 'observer_haze': 0.2,      # (far out in the sea at the left, a colossal veiled bust rising out of it, 3D as level 1's Observer is (the owner, 21/11: "something else in the background, and let it be 3D"); of three offered, until the owner chooses)
        'eye': eye_fit(pts, top_room=0.33, bottom_room=0.18, margin=0.7),
        'shore': True,
        'scenery': [['statue', [guard['at'][0], H0 + 0.1 + guard['height'] / 2, guard['at'][2]], [0.7, guard['height'], 0.7], [0.8, 0.86, 0.95]],      # (placeholders in the blockout's preview: the Guardian and the mirror)
                    ['statue', [N['M'][0], H0 + 0.8, N['M'][2]], [0.6, 1.6, 0.1], [0.75, 0.55, 0.3]]],
    }
    return pl, puzzle


def check(pz):
    """the plan's way is the board's: every level way and every gaze-only link of gaze_trial.guardian(), and no other"""
    t = guardian(); name = {**CELL, **GAZE}
    lv = {frozenset((name[a], name[b])) for a, b in t.level}
    gp = {frozenset((name[a], name[b])) for a, b in t.links}
    assert lv == {frozenset(e[:2]) for e in pz['edges']} - {frozenset(('M', 'T'))}
    assert gp == {frozenset(g) for g in pz['gaps']}
    assert name[t.ring] == pz['exit'] and name[t.stone0] == pz['block'] and name[t.start] == pz['start'] and name[t.mirror] == 'M'
    print('the plan is the board: %d ways, %d gaze-only links; the way: %s' % (len(lv), len(gp), ' '.join(pz['solution'])))


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goguard/plan.json'
    pl, pz = plan()
    check(pz)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways', len(pz['solution']), 'swipes; eye', pl['eye'])
