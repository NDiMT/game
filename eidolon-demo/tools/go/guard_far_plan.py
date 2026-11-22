"""The far island of the fifth level (goguard/): a ruin standing in the still sea behind the gate, at the left of the
picture, built as every level is (white slabs with broken edges on chunky dark rock, fluted broken columns), so it is
the same world, only far off: the game lays it in the haze and gives it its image in the water (the owner, 21/11: "put
something else in the background, and let it be 3D"; of the ways offered he chose "a 3D island with ruins").

No one walks there: it has no way, no nodes, no shore of its own. It is built in its own place in the level's axes, so
the game sets it down where it was made.

usage: python3 -I tools/go/guard_far_plan.py <out far_plan.json> [float]
  float: the island in the air (the owner, 22/11, after the painted ones: "I don't like the background"; of the 3D one
  before, "shadows, more detail, a column less, the columns randomly, slightly turned"): its rock under the old water
  line drawn into one jagged point under it (`hang`), no rocks or columns in the sea about it, the back row's second
  column gone, every column turned and leaning a little its own way; the game lifts it (IV_FAR_LIFT)
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
    pl['rocks'] = [r for r in pl['rocks'] if r[2] >= LO - 0.13]      # (the island's own rock, under its slabs; the small ones out in the sea about it are gone)
    pl['sea_columns'] = []
    pl['hang'] = [SEA, 2.8, -11.2, -6.9, 1.3]
    return pl


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'goguard/far_plan.json'
    json.dump(float_plan() if 'float' in sys.argv[2:] else far_plan(), open(out, 'w'), indent=1)
    print('wrote', out)
