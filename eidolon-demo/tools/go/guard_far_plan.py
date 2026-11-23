"""The far island of the fifth level (goguard/): a ruin standing in the still sea behind the gate, at the left of the
picture, built as every level is (white slabs with broken edges on chunky dark rock, fluted broken columns), so it is
the same world, only far off: the game lays it in the haze and gives it its image in the water (the owner, 21/11: "put
something else in the background, and let it be 3D"; of the ways offered he chose "a 3D island with ruins").

No one walks there: it has no way, no nodes, no shore of its own. It is built in its own place in the level's axes, so
the game sets it down where it was made.

usage: python3 -I tools/go/guard_far_plan.py <out far_plan.json> [float | cols | near | isle]
  float: the island in the air (the owner, 22/11, after the painted ones: "I don't like the background"; of the 3D one
  before, "shadows, more detail, a column less, the columns randomly, slightly turned"): its rock under the old water
  line drawn into one jagged point under it (`hang`), no rocks or columns in the sea about it, the back row's second
  column gone, every column turned and leaning a little its own way; the game lifts it (IV_FAR_LIFT)
  cols: only the far columns standing out of the water behind the level (FAR_COLS; the owner, 22/11), built as
  goguard/far_cols.glb from goguard/far_cols_plan.json the same way (seed 91)
  near: the island's colonnade in the water where the island was, and two lone columns (NEAR_COLS; 23/11), built as
  goguard/near_cols.glb from goguard/near_cols_plan.json the same way (seed 93), in detail since 23/11 (Ionic)
  isle: one whole Ionic column about the origin, the one near the island (23/11), built as goguard/isle_col.glb from
  goguard/isle_col_plan.json (seed 95); the game sets it where it stands
then:  python3.11 -I tools/ivory_level.py -- <scratch>/far.glb <scratch>/far.json 77 24 goguard/far_plan.json
       and copy far.glb into goguard/ (built elsewhere so its json and no shore map touch the level's own)
"""
import json, math, os, sys
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


# the island's colonnade standing in the sea where the island was, and two lone broken columns about it (the owner,
# 23/11: "instead of the island, can we put the triptych of the island's columns in the water, and another 2 random
# columns?"; painted ones were "out of place"; "make columns again so they fit the place better"): built as the far
# columns are, so they are the same world, nearer and less in the haze. Three whole columns in a row going a little away
# to the right, an architrave across their tops; their feet where the level's frame at her start has open sea, at these
# pixels of it (720 by 1280): 148 575, 213 555, 278 535 (the row: a little lower than the painted one raised 120 px,
# which the owner asked "a little lower"), 60 495 and 375 520 (the two, further back), from the game's own map of the
# frame to the sea (IV_WD_PICK); each column's foot 0.6 under the water
NEAR_ROW = [(-7.474, -3.307), (-7.15, -4.381), (-6.826, -5.455)]
NEAR_H = 2.7
NEAR_YAW = round(math.degrees(math.atan2(-(NEAR_ROW[-1][1] - NEAR_ROW[0][1]), NEAR_ROW[-1][0] - NEAR_ROW[0][0])), 2)      # (the row's way, as a stone's yaw)
# in detail (the owner, 23/11: "it isn't bad, but I'd like it with more detail"): Ionic columns of drums, fluted, their
# capitals' volutes along the row; the architrave in two blocks meeting over the middle column, the far one settled a
# little and its end broken off, the piece fallen into the water at the third column's foot
ION = lambda cap=None, drum=0.62: {'style': 'ionic', 'cap': NEAR_YAW if cap is None else cap, 'drum': drum}
NEAR_COLS = [[x, SEA - 0.6, z, NEAR_H, 0.2, False, [t, 0, 0], ION()] for (x, z), t in zip(NEAR_ROW, (1.5, -2.0, 2.5))] + \
            [[-9.92, SEA - 0.6, -3.862, 2.1, 0.19, True, [25, 9, 140], ION(10)], [-6.064, SEA - 0.6, -6.78, 1.7, 0.18, True, [-30, 12, 320], ION(-40)]]


def near_plan():
    """the colonnade and the two lone columns, in the water at the left: no floors, no rock"""
    pl = cols_plan()
    (x0, z0), (x1, z1), (x2, z2) = NEAR_ROW
    d = ((x2 - x0), (z2 - z0)); L = math.hypot(*d); d = (d[0] / L, d[1] / L); e = (0.96, 0.29)      # (along the row; across it, toward the eye)
    yA = SEA - 0.6 + NEAR_H; D, H = 0.36, 0.34
    def blk(a, b, opt):      # (a block from a to b along the row, measured from the first column)
        m = (a + b) / 2.0
        return [round(x0 + d[0] * m, 3), round(yA, 3), round(z0 + d[1] * m, 3), round(b - a, 3), D, H, NEAR_YAW, opt]
    d01 = math.hypot(x1 - x0, z1 - z0)
    arch = [blk(-0.3, d01 - 0.004, {'break': 'start'}),
            blk(d01 + 0.004, L + 0.18, {'break': 'end', 'roll': 1.5, 'pitch': -1.2})]
    fx, fz = x2 + d[0] * 0.62 + e[0] * 0.38, z2 + d[1] * 0.62 + e[1] * 0.38      # (the piece broken off its end, fallen into the water by the third column)
    arch.append([round(fx, 3), SEA - 0.2, round(fz, 3), 0.62, D, H, NEAR_YAW + 38, {'break': 'both', 'roll': 24, 'pitch': 11}])
    pl.update({'sea_columns': NEAR_COLS, 'stones': [], 'architraves': arch,
               'drums': [[-9.92 + 0.62, SEA - 0.94 * 0.19, -3.862 + 0.3, 0.55, 0.19, 64]]})      # (a drum of the far lone column, half sunk beside it)
    return pl


# one more column near the island (the owner, 23/11: "and another one near the island"): a whole Ionic column in the
# water, its volutes facing the eye; built about the level's origin, the game sets it where it stands (IVGD_ISLE_COL)
def isle_plan():
    pl = cols_plan()
    pl.update({'sea_columns': [[0.0, SEA - 0.6, 0.0, 2.9, 0.2, False, [0, 0, 0], ION(45)]], 'stones': [], 'drums': []})
    return pl


def cols_plan():
    """only the far columns in the water: no floors, no rock"""
    pl = far_plan()
    pl.update({'floors': {}, 'rocks': [], 'columns': [], 'sea_columns': FAR_COLS})
    pl.pop('hang', None)
    return pl


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goguard/far_plan.json'
    mode = sys.argv[2] if len(sys.argv) > 2 else ''
    json.dump({'float': float_plan, 'cols': cols_plan, 'near': near_plan, 'isle': isle_plan}.get(mode, far_plan)(), open(out, 'w'), indent=1)
    print('wrote', out)
