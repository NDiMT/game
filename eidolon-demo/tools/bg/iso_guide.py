"""A perspective guide for the image model: far ruins drawn as flat grey blockouts, projected exactly as the game's eye
sees them (orthographic, yaw 45, the level's pitch), over the level's sky. The model then repaints the blockouts as
ruins in the haze, keeping their place, size and slant, so the painted backdrop sits in the same perspective as the map.

Each group stands on the sea where the screen point (u, v) of its foot lies. A group is a rock islet with columns on it
in a row along the world's x or z (so the row and its lintel slant along the map's own diagonals), optionally a
pediment over the lintel. Farther groups are drawn paler (`shade`, 0 near .. 1 as pale as the sky).

usage: python3 -I tools/bg/iso_guide.py <spec.json> <sky.png> <out.png>
spec: {"eye": {"centre": [x, y, z], "width": W, "pitch": 35}, "sea_y": y, "horizon": v,
       "groups": [{"u":, "v":, "rock_w":, "rock_h":, "cols":, "col_h":, "axis": "x"|"z", "broken": [i, ...],
                   "lintel": true, "pediment": false, "shade": 0..1, "seed": n}, ...]}
"""
import json, math, random, sys
from PIL import Image, ImageDraw

spec = json.load(open(sys.argv[1])); sky = Image.open(sys.argv[2]).convert('RGB').resize((1080, 1920), Image.LANCZOS); out = sys.argv[3]
eye = spec['eye']; W = float(eye['width']); Hh = W * 16.0 / 9.0; P = math.radians(float(eye.get('pitch', 35.0)))
c, s = math.cos(math.radians(45.0)), math.sin(math.radians(45.0))
BX = (c, 0.0, -s); BY = (-math.sin(P) * s, math.cos(P), -math.sin(P) * c); FW = (-math.cos(P) * s, -math.sin(P), -math.cos(P) * c)
REF = tuple(float(v) for v in eye['centre']); SEA = float(spec['sea_y'])
dot = lambda a, b: a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
sub = lambda a, b: (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def px(p):      # a world point to the guide's pixels
    r = sub(p, REF)
    return ((0.5 + dot(r, BX) / W) * 1080.0, (0.5 - dot(r, BY) / Hh) * 1920.0)


def foot(u, v):      # the point of the sea the eye sees at (u, v)
    sx = (u - 0.5) * W; sy = (0.5 - v) * Hh
    q = tuple(REF[i] + BX[i] * sx + BY[i] * sy for i in range(3))
    t = (SEA - q[1]) / FW[1]
    return tuple(q[i] + FW[i] * t for i in range(3))


def hull(pts):
    pts = sorted(set((round(x, 2), round(y, 2)) for x, y in pts))
    if len(pts) < 3: return pts
    cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cr(hi[-2], hi[-1], p) <= 0: hi.pop()
        hi.append(p)
    return lo[:-1] + hi[:-1]


def prism(poly_xz, y0, y1):      # a vertical prism's corners
    return [(x, y, z) for (x, z) in poly_xz for y in (y0, y1)]


def box(a, b):
    return [(x, y, z) for x in (a[0], b[0]) for y in (a[1], b[1]) for z in (a[2], b[2])]


img = sky.copy(); dr = ImageDraw.Draw(img)
sky_c = sky.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
groups = sorted(spec['groups'], key=lambda g: -dot(sub(foot(g['u'], g['v']), REF), FW))      # (the farthest first)
for g in groups:
    rnd = random.Random(g.get('seed', 1))
    f = foot(float(g['u']), float(g['v'])); sh = float(g.get('shade', 0.3))
    near = (92, 74, 104)      # (the nearest blockout's grey; farther ones toward the sky's own colour)
    col = tuple(int(near[i] + (sky_c[i] - near[i]) * sh) for i in range(3))
    shapes = []
    rw = float(g.get('rock_w', 2.0)) * 0.5; rh = float(g.get('rock_h', 0.6))
    for k in range(3):      # (the islet: a few rough lumps)
        cx = f[0] + rnd.uniform(-0.45, 0.45) * rw; cz = f[2] + rnd.uniform(-0.45, 0.45) * rw
        r0 = rw * rnd.uniform(0.6, 1.0); r1 = r0 * rnd.uniform(0.45, 0.7); top = f[1] + rh * rnd.uniform(0.6, 1.0)
        n = rnd.choice((5, 6, 7)); a0 = rnd.uniform(0, math.tau)
        bot = [(cx + math.cos(a0 + math.tau * i / n) * r0, cz + math.sin(a0 + math.tau * i / n) * r0) for i in range(n)]
        tp = [(cx + math.cos(a0 + 0.4 + math.tau * i / n) * r1, cz + math.sin(a0 + 0.4 + math.tau * i / n) * r1) for i in range(n)]
        shapes.append([(x, f[1] - 0.3, z) for (x, z) in bot] + [(x, top, z) for (x, z) in tp])
    n = int(g.get('cols', 0)); hh = float(g.get('col_h', 1.5))
    if n:
        ax = (0.0, 0.0, -1.0) if g.get('axis', 'z') == 'z' else (-1.0, 0.0, 0.0)
        r = hh * 0.075; sp = hh * 0.55; base = f[1] + rh * 0.85
        c0 = tuple(f[i] - ax[i] * sp * (n - 1) * 0.5 for i in range(3))
        broken = set(g.get('broken', []))
        for k in range(n):
            p = tuple(c0[i] + ax[i] * sp * k for i in range(3))
            h2 = hh * (rnd.uniform(0.35, 0.6) if k in broken else 1.0)
            oct_ = [(p[0] + math.cos(math.tau * m / 8) * r, p[2] + math.sin(math.tau * m / 8) * r) for m in range(8)]
            shapes.append(prism(oct_, base, base + h2))
            shapes.append(box((p[0] - r * 1.35, base + h2 - r * 0.6, p[2] - r * 1.35), (p[0] + r * 1.35, base + h2, p[2] + r * 1.35)))      # (its capital)
        whole = [k for k in range(n) if k not in broken]
        if g.get('lintel', True) and len(whole) >= 2:
            a = tuple(c0[i] + ax[i] * sp * min(whole) for i in range(3)); b = tuple(c0[i] + ax[i] * sp * max(whole) for i in range(3))
            lo = (min(a[0], b[0]) - r * 1.6, base + hh, min(a[2], b[2]) - r * 1.6); hi = (max(a[0], b[0]) + r * 1.6, base + hh + r * 2.0, max(a[2], b[2]) + r * 1.6)
            shapes.append(box(lo, hi))
            if g.get('pediment'):
                ml = ((lo[0] + hi[0]) * 0.5, (lo[2] + hi[2]) * 0.5); ph = hh * 0.28
                if g.get('axis', 'z') == 'z':      # (its ridge along the row)
                    shapes.append([(lo[0], hi[1], lo[2]), (hi[0], hi[1], lo[2]), (lo[0], hi[1], hi[2]), (hi[0], hi[1], hi[2]), (ml[0], hi[1] + ph, lo[2]), (ml[0], hi[1] + ph, hi[2])])
                else:
                    shapes.append([(lo[0], hi[1], lo[2]), (hi[0], hi[1], lo[2]), (lo[0], hi[1], hi[2]), (hi[0], hi[1], hi[2]), (lo[0], hi[1] + ph, ml[1]), (hi[0], hi[1] + ph, ml[1])])
    for sh_ in shapes:
        dr.polygon(hull([px(p) for p in sh_]), fill=col)
hz = float(spec.get('horizon', 0.414)) * 1920.0
img.save(out); print('GUIDE', out, len(groups), 'groups; horizon at', round(hz))
