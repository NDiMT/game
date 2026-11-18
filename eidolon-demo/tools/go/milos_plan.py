"""The plan of the third level (gomilos/): the goddess's sanctuary on Milos, laid on the concept's own map.

An island of white rock in a pale turquoise sea. A marble statue stands in the water before it, a light in her hands,
and the light runs up a channel cut into the island to the goddess's bronze mirror at its head. The mirror throws it
back over the path that climbs beside the channel; turned, it throws it over the channel's arm onto the stone at the
head of the bridge, and beyond the stone, over the chasm, lies the ring before the gate: unlit, the gate's door shut.
Behind the island the goddess rises out of the sea, a colossus without arms; rocks stand all about it in the water.

The board is tools/go/light_trial.py's milos(), proven there (18 swipes, one way, no dead end): grid x runs from the
stone over the bridge to the ring, y up the channel from the statue to the mirror. In the world a step of the board is
1.5 m; grid x goes to the world's -z, grid y to its -x (the eye sees the channel go up to the left of the picture, and
the light turned at the mirror go up to its right, to the gate).

usage: python3 -I tools/go/milos_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from veil_plan import eye_fit

H0, H1 = 0.0, 1.3
SEA = -0.3
STEP = 1.5
W = lambda gx, gy, h: [round(-STEP * gy, 3), h, round(-STEP * gx, 3)]      # (a cell of the board, in the world)
N = {
    'S': [0.0, H0, 4.4],          # where she stands as the level comes out of the light: the platform at the stair's foot
    'A': W(-1, 0, H1),            # the stair's head
    'B': W(-1, 1, H1), 'C': W(-1, 2, H1),
    'D': W(-1, 3, H1),            # the path's head, the mirror's only side on land
    'M': W(0, 3, H1),             # the goddess's mirror, at the channel's head
    'X': W(0, 0, H1),             # the crossing over the channel's mouth
    'F': W(1, 0, H1), 'G': W(1, 1, H1), 'H': W(1, 2, H1),
    'P': W(2, 2, H1),             # south of the stone: from here it is pushed
    'K': W(2, 3, H1),             # the stone, at the bridge's head
    'NI': W(2, 4, H1),            # its niche, cut into the goddess's rock
    'Y': W(3, 3, H1),             # the bridge over the chasm
    'R': W(4, 3, H1),             # the ring, before the gate
}
LIGHT = {      # nodes the light passes and no one walks: the sea before the island, the channel's water, its arm
    'Z': [3.0, H1, 0.0],          # (the statue: the light's source)
    'Q': W(0, -1, H1), 'W1': W(0, 1, H1), 'W2': W(0, 2, H1), 'W3': W(1, 3, H1),
}
GODDESS = ['goddess', [-10.62, SEA - 4.2, -5.25], 11.0, -1.2]      # (Aphrodite, a colossus rising out of the sea behind her sanctuary, the highest rock hiding where she meets the water (the owner: "a big statue of Aphrodite", "much bigger"), her face turned to the eye; without arms: they broke when Theron took her mirror; a little more of her shape than at first (the owner) (props/statue_goddess.glb, 4200 faces))
SALT = [(-1.45, 4.55, 0.62, 0.52), (1.4, 3.7, 0.55, 0.42), (2.3, 1.85, 0.5, 0.48), (2.15, -1.85, 0.48, 0.4),
        (-6.25, 2.77, 0.7, 0.66), (1.83, 5.93, 0.62, 0.5), (3.34, -2.9, 0.72, 0.62), (0.66, 7.91, 0.45, 0.34)]      # (white sea-worn rocks in the water about it, as Milos has them at Sarakiniko: round and soft, low (the owner: "fewer rocks around", "the rocks you had before, like salt"): the first four at the island's foot where the first build had its white lumps, the rest a little out; x, z, how broad, how far out of the water; each below the painted sea's rim on the screen, clear of the way, the light and its statue)
WAY = ['A', 'B', 'C', 'D', 'M', 'C', 'B', 'A', 'X', 'F', 'G', 'H', 'P', 'K', 'P', 'K', 'Y', 'R']      # (M: the mirror turned; the first K: the push)


def plan():
    fl = [[0.0, H0, 3.95], [0.0, H1, 1.95], 0.95, 10]      # (up from the platform, away from the eye, toward its upper right)
    pairs = [('S', 'A'), ('A', 'B'), ('B', 'C'), ('C', 'D'), ('D', 'M'), ('A', 'X'), ('X', 'F'), ('F', 'G'), ('G', 'H'),
             ('H', 'P'), ('P', 'K'), ('K', 'NI'), ('K', 'Y'), ('Y', 'R')]
    edges = [[a, b, [fl[0], fl[1]] if (a, b) == ('S', 'A') else []] for a, b in pairs]
    gaps = [['Z', 'Q'], ['Q', 'X'], ['X', 'W1'], ['W1', 'W2'], ['W2', 'M'], ['M', 'W3'], ['W3', 'K']]
    floors = {
        'S': {'h': H0, 'xz': [[-0.7, 5.15], [0.7, 5.15], [0.7, 3.95], [-0.7, 3.95]]},      # (the platform at the stair's foot)
        'L': {'h': H1, 'xz': [[0.75, 1.95], [0.75, -0.75], [-0.75, -0.75], [-0.75, 0.75], [-3.75, 0.75], [-3.75, -0.75],
                              [-5.25, -0.75], [-5.25, 1.95]]},      # (the path beside the channel, the crossing at its mouth, the mirror's floor at its head)
        'R': {'h': H1, 'xz': [[0.75, -0.75], [0.75, -2.25], [-2.25, -2.25], [-2.25, -3.75], [-6.75, -3.75], [-6.75, -2.25],
                              [-3.75, -2.25], [-3.75, -0.75]]},      # (the other side, the stone's place and its niche)
        'G': {'h': H1, 'xz': [[-3.1, -5.25], [-3.1, -7.6], [-5.9, -7.6], [-5.9, -5.25]]},      # (the gate's rock, over the chasm)
    }
    face = lambda dx, dz: round(math.atan2(-dz, dx), 3)
    statues = [['standing', [3.2, -1.0, 0.0], 3.4, face(-1.0, 0.0)],      # (she stands in the water before the island, looking up the channel; a placeholder model)
               GODDESS]
    puzzle = {
        'nodes': dict(N, **LIGHT), 'edges': edges, 'start': 'S', 'exit': 'R', 'block': 'K', 'holes': [],
        'intro': [[0.0, H0, 4.41], [0.0, H0, 4.4]],      # (no way in: she stands where the light of the second gate let her go)
        'watchers': [], 'wanderers': [], 'plinths': False, 'volute': None,
        'tutorial': False,
        'mirrors': [{'node': 'M', 'turn': 1}],      # ('\\': the light coming up the channel goes on west, onto the path)
        'gaps': gaps,
        'grid': {'E': [0, 0, -1], 'S': [1, 0, 0], 'W': [0, 0, 1], 'N': [-1, 0, 0]},
        'light': {'from': 'Z', 'dir': 'N', 'at': [2.95, 2.2, 0.0]},      # (the light leaves her at the height of her eyes, just before her face (the owner: "from the height of the statue's eyes"))
        'unwalked': list(LIGHT) + ['NI'],      # (no disc of the way: the light's own places, and the niche)
        'solution': WAY,
        'lines': ["He stole the goddess's mirror.", 'She let him.'],      # (the script's next truth; only at the level's start)
    }
    rocks = [[[-8.3, SEA, -3.2], 1.75, H1 + 2.1],      # (the highest rock, behind the niche: the goddess rises out of the sea behind it)
             [[-6.35, SEA, -1.35], 0.72, H1 + 1.25],      # (the niche's walls)
             [[-6.35, SEA, -4.65], 0.72, H1 + 1.05],
             [[-6.5, SEA, 0.7], 0.95, H1 + 0.55],      # (behind the mirror)
             [[-4.6, SEA, -8.7], 1.15, H1 + 0.8],      # (behind the gate)
             [[-6.7, SEA, -6.5], 0.95, H1 + 1.3],
             [[-2.0, SEA, 3.05], 1.05, H1 - 0.55],      # (the island's shoulder beside the path)
             [[-4.4, SEA, 3.0], 0.95, H1 - 0.45],
             [[-0.7, SEA, -3.3], 0.8, H1 - 0.6]]      # (its shoulder over the chasm's mouth)
    pts = [p for p in N.values()] + [[x, f['h'], z] for f in floors.values() for x, z in f['xz']] + [[-4.5, H1 + 2.3, -6.85]] \
        + [[s[1][0], s[1][1] + s[2], s[1][2]] for s in statues if s[0] != 'goddess'] + [LIGHT['Z']]
    pl = {
        'scene': 'wake', 'sea_y': SEA, 'heights': {'H0': H0, 'H1': H1}, 'floors': floors, 'flights': [fl],
        'nodes': N, 'edges': edges, 'ring': N['R'], 'stone': N['K'], 'holes': [], 'faces': [],
        'horizon': 0.475, 'sun': [0.658, 0.282],      # (its own backdrop's sea rim and sun, measured on gomilos/backdrop.jpg: a hazy glowing morning in pale blue and lilac, in the painted style of the first two levels' (the owner: "the feeling of the first two"), the white rocks of Milos far off in the haze)
        'arches': [[[-4.5, H1, -6.85], 'x']],      # (the gate, square to the way's last stretch, just behind the ring)
        'waters': [[-3.75, -0.75, -0.75, 0.75], [-5.25, -3.75, -2.25, -0.75], [-6.75, -2.25, -5.25, -3.75]],      # (the channel, its arm, the chasm: open water the rock keeps clear of)
        'rock_style': {'ease': [0.006, 0.016], 'boulder_ease': 0.012, 'tilt': [0.2, 0.45], 'lean': 2.6, 'cut_p': 0.85, 'chamf': [0.12, 0.36], 'side_cuts': [2, 3], 'sat_min': 0.2},      # (its rock cut sharper and more aslant than the other levels' (the owner))
        'bridges': [[-5.0, -4.0, -5.24, -3.76, H1]],      # (a slab over the chasm, nothing under it but the sea; a joint's breadth from each floor)
        'statues': statues, 'pedestals': [], 'shore_statues': ['standing'],      # (the light's statue stands in the water: the sea's thin foam hugs her as it does the rock)
        'rocks': rocks, 'salt_rocks': SALT,
        'columns': [], 'volute': None, 'head': None, 'relief': None, 'cypress': None,
        'eye': eye_fit(pts, top_room=0.33, bottom_room=0.16, margin=0.6),      # (the colossus is left out of the fit: it rises behind, into the sky)
        'shore': True,
        'scenery': [['statue', [s[1][0], s[1][1] + s[2] / 2, s[1][2]], [0.46, s[2], 0.46], [0.94, 0.93, 0.9]] for s in statues],      # (placeholders in the blockout's preview)
    }
    return pl, puzzle


def check(pz):
    """the plan's way is the board's: every level way and every light-only way of light_trial.milos(), and no other"""
    from light_trial import milos
    T = milos()
    cell = {}
    for k, v in pz['nodes'].items():
        if k in ('S', 'Z'): continue
        cell[(round(-v[2] / STEP), round(-v[0] / STEP))] = k
    cell[(-2, 0)] = 'S'; cell[(0, -2)] = 'Z'
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
