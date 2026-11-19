"""The plan of the second level (goveil/), a tutorial: the stone pushed into the gap of a causeway.

A small quay of marble at the edge of a still sea; on it a squared block of marble, never carved. From the quay a
causeway of stepping stones runs out over the water to a rock, and a stair climbs to its terrace, where a gate stands
square to the way, the ring of light on its threshold, and veiled statues stand on either side of it: the faces
Theron carved from outside, given breath by the goddess, veiled by him so as not to see them. One stone of the
causeway is missing: there is still water where it lay.

It teaches the stone: a swipe into it pushes it one node straight on; it goes only straight, so she must get behind
it; pushed into the gap, it falls in and its top lies flush with the way. The board is tools/go/push_trial.py's
'gap', proven there: 9 swipes, the only way of that length, no dead end, the stone needed.

usage: python3 -I tools/go/veil_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, math, os, sys

E = 0.45
H0, H1 = 0.0, 1.3
SEA = -0.3      # (still water: the quay and the stones stand a little out of it)
S_ = 1.5        # (a step of the board, in metres)
N = {
    'S': [1.5, H0, 0.0],       # where she comes onto the quay
    'K': [0.0, H0, 0.0],       # the block of marble
    'L': [-1.5, H0, 0.0],      # the head of the causeway, on the quay
    'N': [0.0, H0, 1.5],       # the quay's back, the way round behind the block
    'M': [-1.5, H0, 1.5],
    'C': [-1.5, H0, -1.5],     # the first stepping stone
    'H': [-1.5, H0, -3.0],     # the gap: the stone that fell, still water
    'D': [-1.5, H0, -4.5],     # the stone at the stair's foot
    'E': [-1.5, H1, -7.2],     # the terrace: the head of the stair
    'R': [-1.5, H1, -8.1],     # the ring, on the gate's threshold
}
WAY = ['K', 'N', 'M', 'L', 'C', 'H', 'D', 'E', 'R']      # (the solution: K, L and C are pushes; at C the block falls into H)


def eye_fit(points, top_room=0.36, bottom_room=0.2, margin=1.1):
    """the level's own eye: every point on the screen, the width its extent and margins, room above for the sky and
    below for the mist; the centre set at height 0.5 along the line of sight"""
    yaw, pit = math.radians(45.0), math.radians(35.0)
    f = (-math.sin(yaw) * math.cos(pit), -math.sin(pit), -math.cos(yaw) * math.cos(pit))
    r = (0.7071, 0.0, -0.7071)
    u = (r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0])
    dot = lambda a, b: sum(x * y for x, y in zip(a, b))
    sx = [dot(p, r) for p in points]; sy = [dot(p, u) for p in points]
    w = max(max(sx) - min(sx) + 2 * margin, (max(sy) - min(sy)) / (1.0 - top_room - bottom_room) * 9 / 16)
    h = w * 16 / 9
    cx = (max(sx) + min(sx)) / 2
    cy = min(sy) - bottom_room * h + h / 2      # (the level's foot at bottom_room of the screen's height)
    base = [cx * r[i] + cy * u[i] for i in range(3)]
    t = (0.5 - base[1]) / f[1]
    return {'pitch': 35.0, 'centre': [round(base[i] + t * f[i], 3) for i in range(3)], 'width': round(w, 2)}


def plan():
    fl = [[-1.5, H0, -4.5 - E], [-1.5, H1, -7.2 + E], 0.95, 10]      # (up the rock, away from the eye, toward its upper right)
    pairs = [('S', 'K'), ('K', 'L'), ('K', 'N'), ('N', 'M'), ('M', 'L'), ('L', 'C'), ('C', 'H'), ('H', 'D'), ('D', 'E'), ('E', 'R')]
    edges = [[a, b, [fl[0], fl[1]] if (a, b) == ('D', 'E') else []] for a, b in pairs]
    floors = {
        'Q': {'h': H0, 'xz': [[-2.2, 2.25], [0.7, 2.25], [0.7, 0.7], [2.25, 0.7], [2.25, -0.65], [-2.2, -0.65]]},      # (the quay: an L, her way in at its east end)
        'C': {'h': H0, 'xz': [[-2.0, -1.0], [-1.0, -1.0], [-1.0, -2.0], [-2.0, -2.0]]},
        'D': {'h': H0, 'xz': [[-2.1, -3.95], [-0.9, -3.95], [-0.9, -4.95], [-2.1, -4.95]]},
        'U': {'h': H1, 'xz': [[-3.35, -6.75], [0.35, -6.75], [0.35, -9.7], [-3.35, -9.7]]},      # (the terrace: the gate, the veiled ones beside it)
    }
    # (the veiled ones, each carved as he wished her to be, each different (the owner): two beside the gate, clear of it as
    # the eye sees it, and three in the sea on pedestals behind the causeway, turned to it: she passes before them.
    # model (props/statue_<model>.glb), where its foot stands, its height, its turn about the upright)
    # (each model faces its own +x, as it was made from a picture of its front; a turn t sets that face toward (cos t, -sin t)
    # in the world's x and z: toward the eye is (0.71, 0.71). They are a third larger than she is: monuments)
    face = lambda dx, dz: round(math.atan2(-dz, dx), 3)
    statues = [['seated', [-3.0, H1, -8.0], 1.9, face(0.8, 0.6)], ['welcome', [-0.15, H1, -9.15], 2.4, face(0.1, 1.0)]]
    sea_statues = [['kneeling', [-3.3, H0, -1.2], 1.7, face(0.8, 0.6)], ['standing', [-3.3, H0, -3.0], 2.4, face(0.8, 0.6)], ['unfinished', [-3.3, H0, -4.8], 2.4, face(0.8, 0.6)]]
    puzzle = {
        'nodes': N, 'edges': edges, 'start': 'S', 'exit': 'R', 'block': 'K', 'holes': ['H'],
        'intro': [[1.5, H0, 0.01], [1.5, H0, 0.0]],      # (no way in: she stands where the light of the first gate let her go)
        'watchers': [], 'wanderers': [], 'plinths': False, 'volute': None,
        'tutorial': True,
        'solution': WAY,
        'lines': ['He tried to find her face again,', 'so he carved a thousand statues,', 'but none was her.'],      # (the owner's own words, 18/11: "he tried to find her face again, so he carved a thousand statues, but none was her"; three lines, each within a phone's width; only at the level's start)
    }
    pts = [p for p in N.values()] + [[x, f['h'], z] for f in floors.values() for x, z in f['xz']] + [[-1.5, H1 + 2.6, -8.9]] + [[s[1][0], s[1][1] + s[2], s[1][2]] for s in statues + sea_statues]
    pl = {
        'scene': 'wake', 'sea_y': SEA, 'heights': {'H0': H0, 'H1': H1}, 'floors': floors, 'flights': [fl],
        'nodes': N, 'edges': edges, 'ring': N['R'], 'stone': N['K'], 'holes': ['H'], 'faces': [],
        'horizon': 0.362, 'sun': [0.51, 0.286],      # (its own backdrop's sea rim and sun, measured on goveil/backdrop.jpg: the golden morning, the veiled ones far off)
        'arches': [[[-1.5, H1, -8.9], 'x']],      # (the gate, square to the way's last stretch, just behind the ring)
        'statues': statues + sea_statues,
        'pedestals': [[s[1][0], s[1][2], H0, 0.42] for s in sea_statues],      # (square marble pedestals out of the water, their tops level with the way)
        'rocks': [[[-2.95, SEA, 1.0], 0.95, H0 - 0.2],      # (the quay's shoulders, out of the water)
                  [[0.35, SEA, 2.85], 0.8, H0 - 0.22],
                  [[2.75, SEA, -0.75], 0.62, H0 - 0.28],
                  [[-0.35, SEA, -6.6], 1.0, H1 - 0.55],      # (the rock under the terrace, beside the stair: its foot in the water)
                  [[-2.75, SEA, -6.45], 0.95, H1 - 0.5],
                  [[-3.95, SEA, -8.6], 1.15, H1 - 0.35],     # (its back and sides)
                  [[0.95, SEA, -8.7], 1.1, H1 - 0.4],
                  [[-1.6, SEA, -10.4], 1.3, H1 - 0.3],
                  [[0.6, SEA, -3.1], 0.42, SEA + 0.16],      # (small rocks in the still water, clear of the stepping stones and the gap)
                  [[0.85, SEA, -5.3], 0.38, SEA + 0.12]],
        'rocks_after': [[[5.1, SEA, -0.75], 1.05, SEA + 1.05], [[6.55, SEA, -0.2], 0.62, SEA + 0.6],
                        [[-2.95, SEA, 1.0], 1.05, H0 - 0.07], [[0.35, SEA, 2.85], 0.9, H0 - 0.07], [[2.75, SEA, -0.75], 0.72, H0 - 0.1],
                        [[-1.05, SEA, 2.8], 0.85, H0 - 0.08], [[1.65, SEA, 1.3], 0.75, H0 - 0.1]],      # (the brown rock under the quay where she starts made stronger, its tops near the slab's (the owner, 18/11): over its first shoulders and two more toward the eye)      # (in the empty sea at the bottom right, a rock and a smaller one beside it (the owner, 18/11); made after all the rest)
        'columns': [], 'volute': None, 'head': None, 'relief': None, 'cypress': None,
        'eye': eye_fit(pts, top_room=0.33, bottom_room=0.2, margin=0.8),
        'shore': True,
        'smooth_normals': ['rock', 'marble'],      # (for the light laid in brushstrokes: smooth normals to mix into the facets' light (the owner, 19/11: "the brushstrokes on the other maps too"))
        'scenery': [['statue', [s[1][0], s[1][1] + s[2] / 2, s[1][2]], [0.46, s[2], 0.46], [0.94, 0.93, 0.9]] for s in statues + sea_statues],      # (placeholders in the blockout's preview)
    }
    return pl, puzzle


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goveil/plan.json'
    pl, pz = plan()
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways', len(pz['solution']), 'swipes; eye', pl['eye'])
