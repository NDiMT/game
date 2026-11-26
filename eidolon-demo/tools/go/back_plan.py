"""The plan of the sixth level (goback/): behind your back (the script's seventh truth: the goddess gave breath to every
statue Theron carved from outside, and he could not bear to look at them; he veiled them).

Veiled statues stand on the walks of a small island in a still sea. They move only when she is not looking at them:
after each of her steps, every statue not in front of her (in the half of the world she faces) takes one step toward
her; one that reaches her takes her back to the start. On a plate a statue holds the bridges up; a bridge that sinks
takes whoever stands on it. She looks the way she last stepped, and she starts facing the gate.

The board is tools/go/back_trial.py's BOARDS (the owner, 26/11, of the playable sample: "the 4, make it first", the
bridge that sinks; before, "the two plates, 2, I like it, make it a level"), proven there: one way, the statues needed.
In the world a step of the board is 1.5 m; board x goes to the world's +x (down the picture to the right), board y to
its +z (down the picture to the left): the gate stands at the top of the picture, her start at its foot.

usage: python3 -I tools/go/back_plan.py <out plan.json> [board name]      (writes puzzle.json beside it)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from veil_plan import eye_fit
from back_trial import BOARDS, Board, analyse, D4

H0 = 0.6      # (the walks stand well out of the water, on their rock, as the fifth level's)
SEA = -0.3
STEP = 1.5
ARCH = 1.15      # (the gate's arch this far beyond the ring, along her last stretch)
WORLD = {'U': [0, 0, -1], 'D': [0, 0, 1], 'L': [-1, 0, 0], 'R': [1, 0, 0]}


def plan(name='the bridge that sinks'):
    rows = dict(BOARDS)[name]; b = Board(rows); r = analyse(b)
    assert r and r['ways'] == 1, 'the board must have one way'
    cells = {q for q in b.slab} | set(b.plate) | set(b.bridge)
    xs = [q[0] for q in cells]; ys = [q[1] for q in cells]
    cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2
    W = lambda x, y, h=H0: [round(STEP * (x - cx), 3), h, round(STEP * (y - cy), 3)]
    nm = lambda q: 'S' if q == b.S else 'R' if q == b.G else 'c%d%d' % q
    N = {nm(q): W(*q) for q in sorted(cells)}
    edges = []
    for q in sorted(cells):
        for d in ((1, 0), (0, 1)):
            p = (q[0] + d[0], q[1] + d[1])
            if p in cells: edges.append([nm(q), nm(p), []])
    way = []; at = b.S
    for d in r['path']: at = (at[0] + d[0], at[1] + d[1]); way.append(nm(at))
    # the floors: each run of fixed places as a rectangle of the board, the bridges as floors that rise and sink
    fixed = {q for q in cells if q not in b.bridge}
    rect = lambda x0, x1, y0, y1: [[round(STEP * (x0 - cx), 3), round(STEP * (y0 - cy), 3)], [round(STEP * (x1 - cx), 3), round(STEP * (y0 - cy), 3)],
                                   [round(STEP * (x1 - cx), 3), round(STEP * (y1 - cy), 3)], [round(STEP * (x0 - cx), 3), round(STEP * (y1 - cy), 3)]]
    floors = {}; left = set(fixed)
    while left:      # (greedy: the longest run down a column, then as far across as every row of it allows)
        q = min(left, key=lambda c: (c[1], c[0]))
        y1 = q[1]
        while (q[0], y1 + 1) in left: y1 += 1
        x1 = q[0]
        while all((x1 + 1, y) in left for y in range(q[1], y1 + 1)): x1 += 1
        for x in range(q[0], x1 + 1):
            for y in range(q[1], y1 + 1): left.discard((x, y))
        y0 = q[1] - (0.5 + ARCH / STEP + 0.45) if (b.G[0] in range(q[0], x1 + 1) and b.G[1] == q[1]) else q[1] - 0.5      # (the gate's islet runs on under its arch)
        floors['F%d' % len(floors)] = {'h': H0, 'xz': rect(q[0] - 0.5, x1 + 0.5, y0, y1 + 0.5)}
    risers = []; left = set(b.bridge)
    while left:      # (each run of bridges one stone that rises and sinks)
        q = min(left, key=lambda c: (c[1], c[0]))
        x1 = q[0]
        while (x1 + 1, q[1]) in left: x1 += 1
        for x in range(q[0], x1 + 1): left.discard((x, q[1]))
        k = 'B%d' % len(risers); risers.append(k)
        floors[k] = {'h': H0, 'xz': rect(q[0] - 0.5, x1 + 0.5, q[1] - 0.5, q[1] + 0.5)}
    riser_of = {}
    for k in risers:
        (x0, z0), (x1, _), (_, z1) = floors[k]['xz'][0], floors[k]['xz'][1], floors[k]['xz'][2]
        for q in b.bridge:
            p = W(*q)
            if x0 < p[0] < x1 and z0 < p[2] < z1: riser_of[nm(q)] = k
    ring = N['R']; arch = [ring[0], H0, round(ring[2] - ARCH, 3)]      # (square to her last stretch, up the board: the world's -z)
    bridge_edges = [e[:2] for e in edges if e[0] in riser_of or e[1] in riser_of]
    puzzle = {
        'nodes': N, 'edges': edges, 'start': 'S', 'exit': 'R', 'block': '', 'holes': [],
        'intro': [[N['S'][0], H0, N['S'][2] + 0.01], N['S']],      # (no way in: she stands where the light of the fifth gate let her go, facing the gate)
        'watchers': [], 'wanderers': [], 'plinths': False, 'volute': None, 'tutorial': False, 'gaps': [],
        'grid': {'E': [0, 0, -1], 'S': [1, 0, 0], 'W': [0, 0, 1], 'N': [-1, 0, 0]},
        'back': {'board': name, 'statues': [nm(m) for m in b.M], 'plates': {nm(q): l for q, l in b.plate.items()},
                 'bridges': {nm(q): l for q, l in b.bridge.items()}, 'riser_of': riser_of, 'bridge_edges': bridge_edges,
                 'cells': {nm(q): list(q) for q in sorted(cells)}, 'face0': list(b.f0), 'dirs': WORLD,
                 'size': [b.W, b.H], 'step': STEP, 'origin': W(0, 0)},      # (the board's measure: cell (x, y) stands at origin + step * (x, 0, y); her look runs to its edge)
        'unwalked': [],
        'solution': way,
        'lines': ['The goddess woke his statues.', 'He could not bear', 'to look at them.'],      # (the script's seventh truth: the goddess's second answer; to be settled with the owner)
    }
    xs_w = [p[0] for p in N.values()]; zs_w = [p[2] for p in N.values()]
    inner = {(x, y) for x in range(min(xs), max(xs) + 1) for y in range(min(ys), max(ys) + 1)
             if (x, y) not in cells and sum((x + dx, y + dy) in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) >= 2}      # (the channels between the walks: open water, the rock flush along them)
    rocks = []
    for q in sorted(fixed):      # (the island's rock under its walks: chunky blocks out from each side that meets the water, their tops just under the slabs)
        p = W(*q, SEA)
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (q[0] + d[0], q[1] + d[1]) in cells or (q[0] + d[0], q[1] + d[1]) in inner: continue
            k = (q[0] * 7 + q[1] * 13 + d[0] * 3 + d[1] * 5) % 5      # (each its own size and height, from the place: never from Python's hash)
            rocks.append([[round(p[0] + d[0] * 0.62, 3), SEA, round(p[2] + d[1] * 0.62, 3)], round(0.62 + 0.04 * k, 3), round(H0 - 0.1 - 0.03 * k, 3)])
    waters = []
    for q in sorted(set(b.bridge) | inner):      # (open water under each bridge: the rock stands flush along it)
        p = W(*q); waters.append([round(p[0] - 0.75, 3), round(p[0] + 0.75, 3), round(p[2] - 0.75, 3), round(p[2] + 0.75, 3)])
    pts = list(N.values()) + [[x, f['h'], z] for f in floors.values() for x, z in f['xz']] + [[arch[0], H0 + 2.9, arch[2]]] \
        + [W(*m) for m in b.M] + [[W(*m)[0], H0 + 2.0, W(*m)[2]] for m in b.M]
    pl = {
        'scene': 'wake', 'sea_y': SEA, 'heights': {'H0': H0}, 'floors': floors, 'flights': [], 'risers': risers,
        'nodes': N, 'edges': edges, 'ring': ring, 'stone': None, 'holes': [], 'faces': [],
        'horizon': 0.47, 'sun': [0.765, 0.3],      # (its backdrop's haze band and its setting sun: goback/backdrop.jpg, painted for it at dusk)
        'arches': [[arch, 'x']],      # (the gate, square to the way's last stretch (up the board, the world's -z), just behind the ring)
        'waters': waters,
        'smooth_normals': ['rock', 'marble'],
        'rock_clamp': [0.04, 0.35, 0.06, 1.15, 0.3, 0.45],
        'statues': [], 'pedestals': [], 'shore_statues': [],
        'rocks': rocks,
        'rocks_after': [],
        'columns': [], 'volute': None, 'head': None, 'relief': None, 'cypress': None, 'observer': None,
        'eye': eye_fit(pts, top_room=0.3, bottom_room=0.16, margin=0.9),
        'shore': True,
        'scenery': [['statue', [W(*m)[0], H0 + 0.95, W(*m)[2]], [0.55, 1.9, 0.55], [0.85, 0.84, 0.9]] for m in b.M],      # (the statues, in the blockout's preview)
    }
    return pl, puzzle


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goback/plan.json'
    name = sys.argv[2] if len(sys.argv) > 2 else 'the bridge that sinks'
    pl, pz = plan(name)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways', len(pz['solution']), 'swipes;',
          'floors', sorted(pl['floors']), 'risers', pl['risers'], '; eye', pl['eye'])
    print('the way:', ' '.join(pz['solution']))
