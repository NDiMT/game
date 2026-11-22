"""The far island of the fifth level (goguard/): a ruin standing in the still sea behind the gate, at the left of the
picture, built as every level is (white slabs with broken edges on chunky dark rock, fluted broken columns), so it is
the same world, only far off: the game lays it in the haze and gives it its image in the water (the owner, 21/11: "put
something else in the background, and let it be 3D"; of the ways offered he chose "a 3D island with ruins").

No one walks there: it has no way, no nodes, no shore of its own. It is built in its own place in the level's axes, so
the game sets it down where it was made.

usage: python3 -I tools/go/guard_far_plan.py <out far_plan.json> [float | cols]
  float: the island in the air (the owner, 22/11, after the painted ones: "I don't like the background"; of the 3D one
  before, "shadows, more detail, a column less, the columns randomly, slightly turned"): its rock under the old water
  line drawn into one jagged point under it (`hang`), no rocks or columns in the sea about it, the back row's second
  column gone, every column turned and leaning a little its own way; the game lifts it (IV_FAR_LIFT)
  cols: only the far columns standing out of the water behind the level (FAR_COLS; the owner, 22/11), built as
  goguard/far_cols.glb from goguard/far_cols_plan.json the same way (seed 91)
then:  python3.11 -I tools/ivory_level.py -- <scratch>/far.glb <scratch>/far.json 77 24 goguard/far_plan.json
       and copy far.glb into goguard/ (built elsewhere so its json and no shore map touch the level's own)
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guard_plan import plan, SEA

HI, LO = 0.85, 0.35      # (its upper terrace and its lower one, over the sea at -0.3)


def far_plan():
    pl, _ = plan()
    R = lambda x0, x1, z0, z1: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
    floors = {
        'FA': {'h': HI, 'xz': R(-13.2, -9.6, -8.7, -6.2)},      # (the upper terrace, its colonnade at its back)
        'FB': {'h': LO, 'xz': R(-10.6, -8.7, -6.2, -4.7)},      # (a lower terrace before it, toward the eye)
    }
    rk = lambda x, z, r, top: [[x, SEA, z], r, top]
    rocks = [rk(-12.8, -8.3, 1.0, HI - 0.1), rk(-11.4, -8.55, 1.05, HI - 0.1), rk(-10.0, -8.3, 0.95, HI - 0.12),
             rk(-13.0, -6.6, 0.95, HI - 0.12), rk(-11.6, -6.5, 0.9, HI - 0.12), rk(-10.0, -6.5, 0.85, HI - 0.12),
             rk(-10.2, -5.0, 0.8, LO - 0.1), rk(-9.0, -5.2, 0.8, LO - 0.1), rk(-9.3, -6.0, 0.7, LO - 0.12),
             rk(-14.0, -7.3, 0.7, 0.2), rk(-8.1, -7.7, 0.6, 0.0), rk(-12.3, -4.9, 0.6, -0.05)]      # (under its slabs, and a few out in the sea about it)
    columns = [[[-12.75, HI, -8.2], 2.6], [[-11.8, HI, -8.2], 1.5], [[-10.85, HI, -8.2], 2.6], [[-9.95, HI, -8.2], 0.9],
               [[-12.8, HI, -6.7], 1.1], [[-9.3, LO, -5.4], 0.7]]      # (a colonnade at the upper terrace's back, broken at different heights; a stump on the lower)
    sea_columns = [[-8.5, SEA - 0.6, -8.5, 1.9, 0.2, True], [-14.1, SEA - 0.6, -5.7, 1.4, 0.2, True]]      # (two more half sunk in the water beside it)
    keep = {k: pl[k] for k in ('scene', 'sea_y', 'heights', 'horizon', 'sun', 'smooth_normals', 'rock_clamp', 'eye', 'rock_style') if k in pl}
    keep.update({'floors': floors, 'flights': [], 'nodes': {}, 'edges': [], 'ring': None, 'stone': None, 'holes': [], 'faces': [],
                 'arches': [], 'waters': [], 'statues': [], 'pedestals': [], 'shore_statues': [], 'rocks': rocks, 'rocks_after': [],
                 'columns': columns, 'sea_columns': sea_columns, 'volute': None, 'head': None, 'relief': None, 'cypress': None,
                 'shore': False, 'scenery': []})
    return keep


def float_plan():
    pl = far_plan()
    turn = [[17, 3.0, 40], [-23, 2.5, 200], [35, 4.0, 120], [8, 3.5, 300], [-12, 2.0, 80]]
    cols = [c for c in pl['columns'] if not (abs(c[0][0] + 11.8) < 0.01 and abs(c[0][2] + 8.2) < 0.01)]      # (the back row's second, the middle one)
    pl['columns'] = [c + [turn[i]] for i, c in enumerate(cols)]
    for c in pl['columns']:      # (the short one of the back row's three a little to the left on the screen, clear of the tall one's plinth (the owner, 22/11: "the short column in the trio a little more to the left"))
        if abs(c[0][0] + 9.95) < 0.01 and abs(c[0][2] + 8.2) < 0.01: c[0] = [-10.2, HI, -7.95]
    # more detail (the owner, 22/11: "on the island let's put more detail"): the upper terrace paved in four slabs, a
    # little out of level, joints between them; drums of fallen columns on their sides; a fallen architrave before the
    # colonnade; a few cut blocks lying about
    R = lambda x0, x1, z0, z1: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
    pl['floors'] = {'FA1': {'h': HI, 'xz': R(-13.2, -11.8, -8.7, -7.43)}, 'FA2': {'h': HI + 0.03, 'xz': R(-11.8, -9.6, -8.7, -7.43)},
                    'FA3': {'h': HI - 0.02, 'xz': R(-13.2, -11.8, -7.43, -6.2)}, 'FA4': {'h': HI + 0.015, 'xz': R(-11.8, -9.6, -7.43, -6.2)},
                    'FB': pl['floors']['FB']}      # (the four meet edge to edge, a little out of level, so the joints are thin steps; 0.14 apart, the rock showed between them and the terrace fell into pieces)
    pl['drums'] = [[-10.45, HI + 0.015, -6.65, 0.72, 0.2, 32], [-12.2, HI - 0.02, -6.95, 0.6, 0.2, -52], [-10.15, LO, -5.15, 0.55, 0.18, 74]]
    pl['stones'] = [[-11.85, HI + 0.02, -7.62, 1.75, 0.34, 0.3, 11],      # (an architrave fallen before the colonnade)
                    [-12.95, HI - 0.02, -7.25, 0.32, 0.24, 0.25, 22], [-9.88, HI + 0.015, -6.5, 0.27, 0.22, 0.21, -37],
                    [-12.2, HI, -8.5, 0.3, 0.28, 0.24, 8], [-8.98, LO, -4.98, 0.32, 0.26, 0.2, 51]]
    pl['rocks'] = [r for r in pl['rocks'] if r[2] >= LO - 0.13]      # (the island's own rock, under its slabs; the small ones out in the sea about it are gone)
    pl['sea_columns'] = []
    pl['hang'] = [SEA, 2.8, -11.2, -6.9, 1.3]
    return pl


# columns standing out of the water far behind the level, a drowned colonnade in the haze under the sun (the owner,
# 22/11: "in the background, in the depth, add columns that stick up out of the water"): [x, foot, z, height, radius,
# broken, [turn, lean, lean's way]], their plinths under the water (a column's foot 0.6 under it), so each comes up out
# of the sea; laid where the picture at the level's start has open sea under the haze, clear of the island in the air
# and of the level (each at about these points of the screen, x and y: 0.60 0.385, 0.67 0.375, 0.78 0.395, 0.95 0.37,
# 0.50 0.375, at first; the level's eye, its follow lifting the picture 0.07 at the start)
FAR_COLS = [[-5.48, SEA - 0.6, -7.23, 3.0, 0.24, False, [14, 7, 20]],
            [-5.56, SEA - 0.6, -8.40, 1.85, 0.21, True, [-31, 13, 150]],
            [-3.68, SEA - 0.6, -8.07, 2.5, 0.25, True, [47, 9, 300]],
            [-4.10, SEA - 0.6, -9.42, 1.22, 0.22, True, [-8, 5, 210]],
            [-2.91, SEA - 0.6, -10.09, 2.15, 0.23, True, [22, 14, 60]],
            [-1.50, SEA - 0.6, -9.76, 1.65, 0.2, True, [-40, 10, 330]],
            [-6.73, SEA - 0.6, -7.71, 1.45, 0.2, True, [5, 11, 250]]]      # (then crooked and more at random (the owner, 22/11: "the columns in the water a little crooked, and more random"): seven, leaning 5 to 14 degrees each its own way, of other heights and girths, scattered in depth, not in a row; their feet at about these points of the screen at the start: 0.565 0.398, 0.635 0.372, 0.735 0.418, 0.795 0.381, 0.915 0.392, 0.985 0.428, 0.515 0.362)


def cols_plan():
    """only the far columns in the water: no floors, no rock"""
    pl = far_plan()
    pl.update({'floors': {}, 'rocks': [], 'columns': [], 'sea_columns': FAR_COLS})
    pl.pop('hang', None)
    return pl


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goguard/far_plan.json'
    mode = sys.argv[2] if len(sys.argv) > 2 else ''
    json.dump({'float': float_plan, 'cols': cols_plan}.get(mode, far_plan)(), open(out, 'w'), indent=1)
    print('wrote', out)
