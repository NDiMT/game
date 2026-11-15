"""Traces a concept picture of an ivory level into the plan of a 3D level.

The picture's eye is taken as the game's: orthographic, turned 45 degrees, looking down PITCH degrees, SCALE pixels to
the metre; the point ORIGIN of the picture is the level's origin on the floor of height 0. Each floor is found as the
brightest marble of the picture (its top), cleaned, and drawn round as a polygon; each point of the picture, standing
at a known height, is turned back into the world (see at()). The plan (floors, flights, things, the way, the eye) is
written as JSON for tools/ivory_level.py (the build in Blender) and for the game.

usage: python3 -I trace.py <concept.png> <plan.json> [debug.png]
"""
import sys, json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

PITCH, SCALE = 35.0, 206.0
ORIGIN = (950.0, 1684.0)
th = math.radians(PITCH)
RIGHT = np.array([math.cos(math.radians(45)), 0.0, -math.sin(math.radians(45))])
UP = np.array([-math.sin(th) * math.sin(math.radians(45)), math.cos(th), -math.sin(th) * math.cos(math.radians(45))])
BACK = np.array([math.cos(th) * math.sin(math.radians(45)), math.sin(th), math.cos(th) * math.cos(math.radians(45))])


def at(px, py, h):
    """a point of the picture standing at height h: where it is (x, y, z), in metres from the level's origin"""
    u = (px - ORIGIN[0]) / SCALE; v = (ORIGIN[1] - py) / SCALE
    t = (h - UP[1] * v) / BACK[1]
    p = RIGHT * u + UP * v + BACK * t
    return [round(float(p[0]), 4), round(float(h), 4), round(float(p[2]), 4)]


def dp(pts, eps):      # Douglas-Peucker: the outline with fewer corners
    if len(pts) < 3: return pts
    a, b = np.array(pts[0]), np.array(pts[-1]); ab = b - a; L = np.hypot(*ab) or 1.0
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / L for p in pts]
    i = int(np.argmax(d))
    if d[i] > eps: return dp(pts[:i + 1], eps)[:-1] + dp(pts[i:], eps)
    return [pts[0], pts[-1]]


def outline(mask, eps=10.0):
    """the outline of a region (filled, its holes closed), as a polygon of picture points"""
    m = nd.binary_closing(mask, iterations=6); m = nd.binary_fill_holes(m)
    edge = m & ~nd.binary_erosion(m)
    ys, xs = np.nonzero(edge); cx, cy = xs.mean(), ys.mean()
    ang = np.arctan2(ys - cy, xs - cx); order = np.argsort(ang)
    pts = [(float(xs[i]), float(ys[i])) for i in order]
    # the farthest edge point in each of 180 directions: a clean ring
    ring = []
    for k in range(180):
        a0 = -math.pi + 2 * math.pi * k / 180; a1 = a0 + 2 * math.pi / 180
        sel = (ang >= a0) & (ang < a1)
        if sel.any():
            j = np.argmax(np.hypot(xs[sel] - cx, ys[sel] - cy)); ring.append((float(xs[sel][j]), float(ys[sel][j])))
    # a closed ring: cut it at the point farthest from its first, simplify each half
    r0 = np.array(ring[0]); far = int(np.argmax([np.hypot(*(np.array(q) - r0)) for q in ring]))
    half1 = dp(ring[:far + 1], eps); half2 = dp(ring[far:] + [ring[0]], eps)
    return half1[:-1] + half2[:-1]


def main():
    src, out = sys.argv[1], sys.argv[2]
    dbg = sys.argv[3] if len(sys.argv) > 3 else None
    im = np.asarray(Image.open(src).convert('RGB')).astype(float) / 255.0
    L = 0.299 * im[..., 0] + 0.587 * im[..., 1] + 0.114 * im[..., 2]
    top = (L > 0.86) & ((im[..., 0] - im[..., 2]) > 0.08)
    top = nd.binary_opening(top, iterations=2)
    H = {'T0': -1.25, 'T1': 0.0, 'L': 0.7, 'T2': 1.48, 'T3': 2.13}
    # each floor: the tops within a box of the picture (x0, y0, x1, y1) that are its own
    boxes = {'T0': (130, 2120, 620, 2520), 'T1': (600, 1580, 1300, 2010), 'L': (1020, 1300, 1536, 1660), 'T2': (540, 900, 1080, 1185), 'T3': (930, 480, 1430, 800)}
    FLOOR_PX = {      # each floor's top as the picture shows it (pixels), corner by corner
        'T0': [(140, 2300), (410, 2160), (600, 2220), (480, 2340), (600, 2430), (470, 2505), (390, 2482), (190, 2392)],
        'T1': [(578, 1838), (662, 1660), (842, 1598), (1002, 1700), (1170, 1728), (1342, 1760), (1382, 1890), (1282, 2000), (800, 2000), (662, 1922)],
        'L': [(1032, 1478), (1042, 1410), (1210, 1278), (1460, 1288), (1530, 1500), (1500, 1600), (1380, 1650), (1180, 1562)],
        'T2': [(544, 906), (940, 924), (1110, 965), (1115, 1030), (880, 1180), (580, 1040)],
        'T3': [(940, 600), (1100, 505), (1410, 515), (1478, 640), (1320, 790), (1120, 762), (1040, 702)],
    }
    found = {}
    for k, (x0, y0, x1, y1) in boxes.items():
        m = np.zeros_like(top); m[y0:y1, x0:x1] = top[y0:y1, x0:x1]
        lab, n = nd.label(m)
        if n == 0: continue
        sizes = nd.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 2000])
        found[k] = outline(keep)
    floors = {}
    for k, poly in FLOOR_PX.items():
        floors[k] = {'h': H[k], 'px': [list(p) for p in poly], 'xz': [[at(p[0], p[1], H[k])[0], at(p[0], p[1], H[k])[2]] for p in poly]}
    P = lambda x, y, h: at(x, y, h)
    def square_flights(fls):
        """a flight runs along one of the plan's axes (as the picture's do), from its head on the upper floor: its foot is
        put where it must be for that"""
        out = []
        for fl in fls:
            f, h = fl[0], fl[1]
            dx, dz = h[0] - f[0], h[2] - f[2]
            L = (dx * dx + dz * dz) ** 0.5
            ax = (1.0 if dx > 0 else -1.0, 0.0) if abs(dx) >= abs(dz) else (0.0, 1.0 if dz > 0 else -1.0)
            nf = [round(h[0] - ax[0] * L, 4), f[1], round(h[2] - ax[1] * L, 4)]
            out.append([nf, h] + list(fl[2:]))
        return out
    plan = {
        'eye': {'pitch': PITCH, 'scale': SCALE, 'origin': ORIGIN, 'size_px': [im.shape[1], im.shape[0]], 'centre': P(im.shape[1] / 2, im.shape[0] / 2, 0.0), 'width': im.shape[1] / SCALE},
        'heights': H,
        'floors': floors,
        'flights': [      # foot (lower floor), head (upper floor), width, its steps (counted on the picture)
            [P(700, 2752, -2.3), P(470, 2515, -1.25), 1.15, 9], [P(512, 2178, -1.25), P(690, 1862, 0.0), 1.2, 10], [P(1050, 1622, 0.0), P(1160, 1440, 0.7), 1.05, 6],
            [P(1185, 1395, 0.7), P(955, 1132, 1.48), 1.0, 9], [P(950, 930, 1.48), P(1120, 722, 2.13), 1.0, 8]],
        'columns': [[P(1050, 585, 2.13), 0.95], [P(770, 880, 1.48), 0.9], [P(1050, 1000, 1.48), 0.85]],
        'arches': [[P(1335, 590, 2.13), 'x'], [P(1405, 1330, 0.7), 'x']],
        'cypress': [P(650, 940, 1.2), 2.6],
        'head': P(420, 1430, -0.45), 'relief': P(300, 1700, -1.3),
        'rocks': [      # rock that binds the floors: a middle (picture point, at a height), a reach, a top
            [P(430, 1580, -0.95), 1.35, -0.95], [P(300, 1820, -1.7), 1.0, -1.7], [P(1100, 1660, -0.55), 0.8, -0.55], [P(620, 990, 1.05), 0.75, 1.05],
            [P(1470, 720, 1.35), 0.9, 1.35], [P(1470, 1900, -0.65), 0.85, -0.65], [P(1480, 1180, 0.05), 0.75, 0.05],
            [P(1300, 1100, 0.9), 0.7, 0.9],
            [P(-110, 640, 0.6), 1.25, 0.6], [P(-60, 1260, -0.9), 1.1, -0.9]],      # (the cliff at the eye's left, far side of the gorge)
        'block': P(727, 1798, 0.0), 'volute': P(1110, 1872, 0.0), 'ring': P(1220, 648, 2.13),
        'nodes': {'s': P(640, 2700, -2.3), 'n0': P(422, 2470, -1.25), 'n1': P(227, 2357, -1.25), 'n2': P(422, 2242, -1.25),
                  't1': P(690, 1862, 0.0), 'b0': P(775, 1802, 0.0), 'i1': P(950, 1688, 0.0), 'v': P(960, 1902, 0.0), 'n': P(1192, 1762, 0.0),
                  'l': P(1240, 1430, 0.7), 't2': P(775, 1025, 1.48), 'r': P(1220, 648, 2.13)},
        'edges': [['s', 'n0', [P(470, 2515, -1.25)]], ['n0', 'n1', []], ['n1', 'n2', []], ['n2', 't1', [P(512, 2178, -1.25), P(690, 1862, 0.0)]],
                  ['t1', 'b0', []], ['b0', 'i1', []], ['b0', 'v', []], ['v', 'n', []],
                  ['i1', 'l', [P(1050, 1622, 0.0), P(1160, 1440, 0.7)]], ['l', 't2', [P(1185, 1395, 0.7), P(955, 1132, 1.48)]],
                  ['t2', 'r', [P(950, 930, 1.48), P(1120, 722, 2.13)]]],
    }
    sq = square_flights(plan['flights'])      # (every flight square to the axes; the way's edges up them follow)
    moved = {tuple(o[0]): n[0] for o, n in zip(plan['flights'], sq)}
    for e in plan['edges']:
        if len(e[2]) == 2 and tuple(e[2][0]) in moved: e[2][0] = moved[tuple(e[2][0])]
    plan['flights'] = sq
    with open(out, 'w') as f: json.dump(plan, f, indent=1)
    if dbg:
        vis = Image.open(src).convert('RGB'); d = ImageDraw.Draw(vis)
        for k, poly in found.items():
            pts = [tuple(p) for p in poly]
            d.line(pts + [pts[0]], fill=(255, 160, 40), width=3)
        for k, fl in floors.items():
            pts = [tuple(p) for p in fl['px']]
            d.line(pts + [pts[0]], fill=(40, 90, 255), width=5)
            d.text(pts[0], k, fill=(0, 0, 255))
        vis.resize((vis.width // 2, vis.height // 2)).save(dbg)
    print('floors', {k: len(v['px']) for k, v in floors.items()})


if __name__ == '__main__':
    main()
