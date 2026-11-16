"""The plan of "The Waking" (the first level, gowake/): dawn over a still sea. She wakes on a marble threshold at the
water's edge; three stepping stones cross the still water to a pillar of rock; a stair climbs to its terrace, a second
stair to the landing at its top, where a gate stands square to the way, the ring of light in its opening. Far out in the sea
stands the Observer, the first statue of her, veiled, looking out to where she was lost.

It teaches the game: a swipe is a step; a swipe into a thing works it; a flight is climbed by a swipe; the ring ends the
level. Its one trial: the stepping stones lie sunk under the still water, and the winch on the threshold, its chains
running down to them, raises them. One way, every step of it on the path; nothing stands in it.

usage: python3 -I tools/go/wake_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import json, os, sys

E = 0.45
H0, H1, H2 = 0.0, 1.3, 2.6
SEA = -0.3      # (the still water: the threshold and the stones stand a little out of it)
N = {
    'S': [0.0, H0, 0.0],       # the threshold, where she wakes
    'A': [0.0, H0, -1.5],      # the stepping stones
    'B': [0.0, H0, -3.0],
    'C': [0.0, H0, -4.5],
    'D': [0.0, H0, -6.0],      # the foot of the pillar
    'E': [-2.7, H1, -6.0],     # the terrace: the head of the first stair
    'F': [-4.2, H1, -6.0],     #   its far end, the foot of the second
    'G': [-4.2, H2, -8.7],     # the landing at the top
    'R': [-4.2, H2, -10.2],    # the ring, in the gate's opening
    'W': [1.25, H0, 0.0],      # the winch on the threshold: its chains raise the stones out of the water
}
WAY = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'R']


def plan():
    fl1 = [[-E, H0, -6.0], [N['E'][0] + E, H1, -6.0], 0.9, 10]      # (up the pillar's face, toward the eye's upper left)
    fl2 = [[-4.2, H1, -6.0 - E], [-4.2, H2, N['G'][2] + E], 0.9, 10]      # (up to the landing, toward the eye's upper right)
    edges = []
    edges.append(['S', 'W', []])
    for a, b in zip(WAY, WAY[1:]):
        mid = []
        if (a, b) == ('D', 'E'): mid = [fl1[0], fl1[1]]
        if (a, b) == ('F', 'G'): mid = [fl2[0], fl2[1]]
        edges.append([a, b, mid])
    floors = {
        'T': {'h': H0, 'xz': [[-0.7, 0.75], [1.75, 0.75], [1.75, -0.6], [-0.7, -0.6]]},      # (the threshold: long, out toward the eye's right)
        'A': {'h': H0, 'xz': [[-0.5, -1.0], [0.5, -1.0], [0.5, -2.0], [-0.5, -2.0]]},
        'B': {'h': H0, 'xz': [[-0.5, -2.5], [0.5, -2.5], [0.5, -3.5], [-0.5, -3.5]]},
        'C': {'h': H0, 'xz': [[-0.5, -4.0], [0.5, -4.0], [0.5, -5.0], [-0.5, -5.0]]},
        'D': {'h': H0, 'xz': [[0.8, -5.25], [0.8, -6.75], [-E, -6.75], [-E, -5.25]]},      # (the foot of the pillar: its edge at the stair's foot)
        'U': {'h': H1, 'xz': [[N['E'][0] + E, -5.15], [N['E'][0] + E, -6.75], [-3.75, -6.75], [-3.75, -6.0 - E],
                              [-4.95, -6.0 - E], [-4.95, -5.15]]},      # (the terrace; its west end cut back to the second stair's foot)
        'P': {'h': H2, 'xz': [[-3.45, N['G'][2] + E], [-3.45, -10.95], [-4.95, -10.95], [-4.95, N['G'][2] + E]]},      # (the landing, the gate on it)
    }
    puzzle = {
        'nodes': N, 'edges': edges, 'start': 'S', 'exit': 'R', 'block': '',
        'watchers': [], 'wanderers': [], 'plinths': False,
        'volute': {'node': 'W', 'kind': 'winch', 'once': True,      # (turned once, it raises the stepping stones; a way over them is no way till then)
                   'toggles': {'bridge': [['S', 'A'], ['A', 'B'], ['B', 'C'], ['C', 'D']]}},
        'tutorial': True,      # (a hand shows each swipe while she waits)
        'intro': [[0.0, H0, 0.01], [0.0, H0, 0.0]],      # (no way in: she wakes where she lies, facing the stones)
        'solution': ['W'] + WAY[1:],
        'lines': ['Her face lies at the bottom of the sea.', 'To pass over, she must see it once more.'],
        'end': 'Somewhere above, the water was still.',
    }
    pl = {      # (horizon: the sea's rim in the backdrop, gowake/backdrop.jpg, made by tools/bg/iso_backdrop.py from tools/bg/recipes/wake_far.json)
        'scene': 'wake', 'sea_y': SEA, 'risers': ['A', 'B', 'C'], 'horizon': 0.3714, 'sun': [0.5, 0.341], 'heights': {'H0': H0, 'H1': H1, 'H2': H2}, 'floors': floors, 'flights': [fl1, fl2],
        'nodes': N, 'edges': edges, 'ring': N['R'], 'stone': None, 'faces': [],
        'arches': [[[-4.2, H2, -10.2], 'x']],      # (the gate: square to the way, the ring in its opening; behind it the eye would lose her)
        'rocks': [[[-1.6, H0 - 0.35, -6.9], 1.0, H0 - 0.25],       # (the pillar's shoulders, under the stair, the terrace and the landing:
                  [[-3.0, H1 - 0.45, -7.25], 1.05, H1 - 0.35],      #  one mass of rock rising out of the water; every top below the way)
                  [[-5.55, H1 - 0.4, -7.6], 1.05, H1 - 0.15],
                  [[-5.5, H0 - 0.2, -5.3], 0.95, H0 + 0.3],
                  [[-2.7, H2 - 0.6, -10.2], 1.0, H2 - 0.5],
                  [[-5.6, H2 - 0.5, -10.0], 0.95, H2 - 0.45],
                  [[1.35, SEA, -6.75], 0.7, H0 - 0.12],      # (at the pillar's foot, beside the landing)
                  [[-2.3, SEA, -4.55], 0.8, H0 + 0.2],       # (under the terrace's face toward the eye)
                  [[-1.7, SEA, -11.4], 1.2, H2 - 0.9],       # (great rocks behind the landing: the pillar's back)
                  [[-6.3, SEA, -11.2], 1.15, H2 - 0.6],
                  [[-6.6, SEA, -7.9], 0.9, H1 - 0.35],
                  [[1.45, SEA, -2.6], 0.42, SEA + 0.16],     # (small rocks in the still water, well clear of the stepping stones)
                  [[-1.35, SEA, -3.7], 0.38, SEA + 0.12],
                  [[-1.25, SEA, 0.75], 0.5, SEA + 0.2],
                  [[-7.91, SEA, -4.36], 0.55, SEA + 0.34],   # (two rocks at the statue's foot, before her: one to her left,
                  [[-6.95, SEA, -5.24], 0.4, SEA + 0.2]],    #  one toward the island, half a metre clear of its rock)
        'columns': [], 'volute': None,
        'head': None, 'relief': None, 'cypress': None,
        'eye': {'pitch': 35.0, 'centre': [-5.32, 1.3, -7.58], 'width': 9.6},      # (the island large; the sun above the gate)
        # (the Observer, the veiled colossus: a standing veiled figure, smooth marble lit in soft clean bands, the lighter
        # stone's hues; turned 30 degrees to her left, toward the island; her foot 0.8 m under the water, clear of the rocks)
        'observer': [-8.26, SEA - 0.8, -5.77, 6.4, -0.23], 'observer_haze': 0.03, 'observer_model': 'observer_veiled',
        'shore': True,      # (a map of the water's distance from every stone in it: the sea draws small waves along each shore)
    }
    return pl, puzzle


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'gowake/plan.json'
    pl, pz = plan()
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways', len(pz['solution']), 'swipes')
