"""The fourth level's block: a true cube, the same carved and uneven stone as the second level's block
(tools/go/block_meander.py), its meander on all six faces, so it reads the same however it lands as it tumbles (the
owner, 20/11: "the cube looks rectangular rather than square, not the same height on every side").

  - A cube of the first trials' block's width (0.726 m in its own units), its square spiral meander (the same key as
    goiv/block.glb's, laid square) cut 3.3 cm into each of its six faces by a boolean.
  - The meander as cut by hand: its outline wavers, its width and depth vary (each face's own smooth field, the same for
    a groove's rim and its floor, so its walls stay walls; long edges about it cut short first).
  - Each face a little out of true its own way; a few corners broken off aslant.
  - Parted in two, block and meander, so the game can colour the meander (and light it); made SIDE metres on a side,
    its foot at its origin.

usage: python3.11 -I tools/go/block_cube.py -- <out.glb> [side metres] [seed] [one|four|rosette|sun|spiral|eye|zigzag|mirror|...] [depth]
  one (the game's): the single great key of each face; four: on each face four small square keys, two by two, cut thin
  and fine (tried 21/11, the owner: "can we make the designs on the cube like this?", showing the fifth level's concept;
  the same day: "put back the previous cube you push").
  The rest offered 23/11 (the owner: "is there something other than one big meander in the middle we can try?"), each
  cut on every face: rosette (eight petals about a boss, as on a grave stele), sun (the Vergina star, sixteen rays),
  spiral (a volute), eye (the eye painted on ships and cups), zigzag (three bands, as the geometric amphora of the film),
  mirror (a hand mirror, the story's: its disc in its rim and its handle).
  And patterns over the whole face (23/11, the owner: "can you try other designs too? as patterns?"): checker (a board
  of four by four, every other square cut), scales (rows of scales, as a roof's tiles or a cuirass), diamonds (a lattice
  of grooves crossing aslant), teeth (rows of triangles, the wolf's teeth of the geometric vases), rings (three by three
  rings, each with its dot), waves (four rows of waves), keyband (two bands of a running meander), spirals (four small
  spirals, two by two, as the Minoan and Mycenaean).
  And eight more (23/11, the owner: "try other designs too"): frame (a running meander round the face's edge, a plain
  middle; the owner liked it, "with softer lines": frame_thin, its lines finer and less deep, frame_calm, two larger keys
  a side, fine; then "more subdued, and perhaps a little thicker frame": frame_wide, a wider band, its lines a little
  bolder, two keys a side, the outer line unbroken round the edge; and the way's own marks, "lines and circles in the
  middle, like the path's": path4, path2, path3, pathsq, cut shallow), wreath (a laurel wreath), palmette (an anthemion: a fan of leaves over two little volutes), eggdart (rows of
  eggs and darts, the Ionic moulding), basket (a weave of three bars each way, cell by cell), flutes (a column's flutes),
  scroll (two bands of the running wave, the Vitruvian scroll), herringbone (rows of slanted strokes, turned each row).
"""
import bpy, bmesh, sys, random, math
from mathutils import Vector, noise

a = sys.argv[sys.argv.index('--') + 1:]
OUT = a[0]; SIDE = float(a[1]) if len(a) > 1 else 0.92; SEED = int(a[2]) if len(a) > 2 else 11
PATTERN = a[3] if len(a) > 3 else 'one'      # (the game's: the single great key on each face; the owner, 21/11, after four small keys were tried: "put back the previous cube")
rnd = random.Random(SEED)
bpy.ops.wm.read_factory_settings(use_empty=True)

L = 0.726; HF = L / 2.0      # (the source block's width, and half of it)
DEPTH = {'one': 0.033, 'four': 0.02, 'frame_thin': 0.02, 'frame_calm': 0.02, 'frame_wide': 0.026, 'path4': 0.006, 'path2': 0.006, 'path3': 0.006, 'pathsq': 0.006}.get(PATTERN, 0.028)      # (the four small keys, and the fine frames, cut thin and less deep; the motifs between)
if len(a) > 4: DEPTH = float(a[4])      # (another depth, in the source block's units (0.726 a side): the owner, 23/11, of the wide frame at 0.026, "it's too much relief, does it need so much?")
CRISP = PATTERN.startswith(('frame', 'path'))      # (the frames cut true: straight lines, every stroke meeting the next, the faces nearly flat, the corners only chipped (the owner, 23/11, of the first frame: "it looks crooked, as if not all the meander's surfaces touch"))
# the key, in a face's own square (s across, t up, -0.5..0.5): a band from the lower left along the bottom, up the right,
# back along the top, down the left, along the inner bottom and up into the middle, as the first block's
BARS = [(-0.40, 0.40, -0.40, -0.305), (0.305, 0.40, -0.40, 0.40), (-0.28, 0.40, 0.305, 0.40), (-0.28, -0.185, -0.12, 0.40),
        (-0.28, 0.13, -0.12, -0.025), (0.035, 0.13, -0.12, 0.14)]
# the six faces: (outward normal, s axis, t axis); the key turned a different way on each
FACES = [(Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), (Vector((-1, 0, 0)), Vector((0, -1, 0)), Vector((0, 0, 1))),
         (Vector((0, 1, 0)), Vector((-1, 0, 0)), Vector((0, 0, 1))), (Vector((0, -1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1))),
         (Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0))), (Vector((0, 0, -1)), Vector((1, 0, 0)), Vector((0, -1, 0)))]
TURN = [0, 1, 2, 3, 1, 2]      # (quarter turns of the key on each face)

# a small square key (the fifth level's concept's): a band round three sides and down the fourth, then in along the
# inside and up into the middle, a square spiral; in a key's own square (-0.5..0.5), its band this wide
KW = 0.11
KEY = [((-0.45, -0.45), (0.45, -0.45)), ((0.45, -0.45), (0.45, 0.45)), ((0.45, 0.45), (-0.45, 0.45)), ((-0.45, 0.45), (-0.45, -0.17)),
       ((-0.45, -0.17), (0.17, -0.17)), ((0.17, -0.17), (0.17, 0.17)), ((0.17, 0.17), (-0.13, 0.17))]
KEY_AT = [(-0.235, -0.235, 0), (0.235, -0.235, 1), (0.235, 0.235, 2), (-0.235, 0.235, 3)]      # (four on a face, two by two, each turned a quarter on from the last)
KEY_K = 0.43      # (a key's size across, in its face's)
def small_keys():
    for (cx, cy, q) in KEY_AT:
        for (x0, y0), (x1, y1) in KEY:
            s0, s1 = min(x0, x1) - KW * 0.5, max(x0, x1) + KW * 0.5; t0, t1 = min(y0, y1) - KW * 0.5, max(y0, y1) + KW * 0.5
            for _ in range(q): s0, s1, t0, t1 = -t1, -t0, s0, s1
            yield cx + s0 * KEY_K, cx + s1 * KEY_K, cy + t0 * KEY_K, cy + t1 * KEY_K
def key_rects(k):
    q = TURN[k]
    for (s0, s1, t0, t1) in (BARS if PATTERN == 'one' else list(small_keys())):
        for _ in range(q): s0, s1, t0, t1 = -t1, -t0, s0, s1      # (a quarter turn of the rectangle in the face)
        yield s0, s1, t0, t1

# the motifs (23/11), each a list of convex outlines in a face's own square (-0.5..0.5), cut as prisms
def rot(pts, a): ca, sa_ = math.cos(a), math.sin(a); return [(x * ca - y * sa_, x * sa_ + y * ca) for (x, y) in pts]
def disc(r, n=28, cx=0.0, cy=0.0): return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
def ring(r0, r1, n=36, a0=0.0, a1=2 * math.pi, cx=0.0, cy=0.0):      # (an annulus, or an arc of one, in short convex pieces)
    full = abs((a1 - a0) - 2 * math.pi) < 1e-9
    def at(i, r):      # (a whole ring closes on its first point exactly: computed again at 2 pi, its last piece missed its first by a hair, and the cut left a crack there)
        u = a0 + (a1 - a0) * ((i % n) if full else i) / n
        return (cx + r * math.cos(u), cy + r * math.sin(u))
    return [[at(i, r0), at(i, r1), at(i + 1, r1), at(i + 1, r0)] for i in range(n)]
def bar(A, B, hw, ext=0.0):      # (a straight stroke from A to B, hw either side, run on ext past its ends so strokes meet)
    dx, dy = B[0] - A[0], B[1] - A[1]; ln = math.hypot(dx, dy); ux, uy = dx / ln, dy / ln; px, py = -uy * hw, ux * hw
    A2 = (A[0] - ux * ext, A[1] - uy * ext); B2 = (B[0] + ux * ext, B[1] + uy * ext)
    return [(A2[0] + px, A2[1] + py), (B2[0] + px, B2[1] + py), (B2[0] - px, B2[1] - py), (A2[0] - px, A2[1] - py)]
def lens(a, r0, r1, w, n=10):      # (a petal along the angle a, from r0 to r1, w either side at its widest)
    up = [(r0 + (r1 - r0) * i / n, w * math.sin(math.pi * i / n) ** 0.8) for i in range(n + 1)]
    lo = [(x, -y) for (x, y) in up[1:-1]][::-1]
    return rot(up + lo, a)
def clip(poly, lo=-0.44, hi=0.44):      # (a convex outline cut to the square [lo, hi] of the face: what lies outside it gone)
    def cut(pts, inside, inter):
        out = []
        for i in range(len(pts)):
            A, B = pts[i - 1], pts[i]
            if inside(B):
                if not inside(A): out.append(inter(A, B))
                out.append(B)
            elif inside(A): out.append(inter(A, B))
        return out
    def ix(c, keep_lo):
        def inside(p): return p[0] >= c if keep_lo else p[0] <= c
        def inter(A, B): t = (c - A[0]) / (B[0] - A[0]); return (c, A[1] + t * (B[1] - A[1]))
        return inside, inter
    def iy(c, keep_lo):
        def inside(p): return p[1] >= c if keep_lo else p[1] <= c
        def inter(A, B): t = (c - A[1]) / (B[1] - A[1]); return (A[0] + t * (B[0] - A[0]), c)
        return inside, inter
    for f in (ix(lo, True), ix(hi, False), iy(lo, True), iy(hi, False)):
        if len(poly) < 3: return []
        poly = cut(poly, *f)
    return poly if len(poly) >= 3 else []
def spiral_at(cx, cy, r0, pitch, turns, hw, n_per_turn=26, a0=0.0):      # (a small spiral band about (cx, cy))
    P = []; th1 = 2 * math.pi * turns; n = max(8, int(n_per_turn * turns))
    def c(th): r = r0 + pitch * th / (2 * math.pi); return (cx + r * math.cos(th + a0), cy + r * math.sin(th + a0))
    for i in range(n): P.append(bar(c(th1 * i / n), c(th1 * (i + 1) / n), hw, 0.003))
    return P
DISCS = []      # (the stone within each ring of the way's marks: its own part, "disc", lit white with the lines (the owner, 23/11: "and the whole inside of the circle should turn white when it activates"))
def motif():
    P = []
    if PATTERN == 'rosette':
        P += [disc(0.07)] + [lens(i * math.pi / 4.0, 0.115, 0.40, 0.078) for i in range(8)]
    elif PATTERN == 'sun':
        P.append(disc(0.1))
        for i in range(16):
            a = i * math.pi / 8.0; r1, hw = (0.44, 0.03) if i % 2 == 0 else (0.35, 0.024)
            P.append(rot([(0.15, -hw), (r1, 0.0), (0.15, hw)], a))
    elif PATTERN == 'spiral':
        P.append(disc(0.06))
        th0, th1, n = math.pi * 0.5, 2 * math.pi * 2.55, 70
        def c(th): r = 0.04 + 0.118 * th / (2 * math.pi); return (r * math.cos(th), r * math.sin(th))
        for i in range(n):
            a, b = th0 + (th1 - th0) * i / n, th0 + (th1 - th0) * (i + 1) / n
            P.append(bar(c(a), c(b), 0.029, 0.004))
    elif PATTERN == 'eye':
        a, h = 0.42, 0.2; R = (a * a + h * h) / (2 * h); ang = math.asin(a / R)
        P += ring(R - 0.022, R + 0.022, 24, math.pi / 2 - ang, math.pi / 2 + ang, 0.0, h - R)      # (its upper lid)
        P += ring(R - 0.022, R + 0.022, 24, -math.pi / 2 - ang, -math.pi / 2 + ang, 0.0, R - h)      # (its lower lid)
        P += ring(0.088, 0.14, 30) + [disc(0.045, 20)]      # (the iris a ring, the pupil a dot)
    elif PATTERN == 'zigzag':
        for ty in (-0.24, 0.0, 0.24):
            xs = [-0.42 + 0.84 * i / 8 for i in range(9)]
            pts = [(x, ty + (0.06 if i % 2 else -0.06)) for i, x in enumerate(xs)]
            P += [bar(pts[i], pts[i + 1], 0.024, 0.012) for i in range(8)]
    elif PATTERN == 'checker':
        g = 0.84 / 4.0; ins = 0.012
        for i in range(4):
            for j in range(4):
                if (i + j) % 2: continue
                x0, y0 = -0.42 + i * g + ins, -0.42 + j * g + ins
                P.append([(x0, y0), (x0 + g - 2 * ins, y0), (x0 + g - 2 * ins, y0 + g - 2 * ins), (x0, y0 + g - 2 * ins)])
    elif PATTERN == 'scales':
        r = 0.105
        for row in range(5):
            cy = 0.40 - row * 0.19; off = 0.0 if row % 2 == 0 else r
            for k in range(-3, 4):
                cx = -0.42 + off + k * 2 * r + r
                for pg in ring(r - 0.022, r + 0.006, 12, math.pi, 2 * math.pi, cx, cy):
                    q = clip(pg)
                    if q: P.append(q)
    elif PATTERN == 'diamonds':
        for k in range(-4, 5):
            for sgn in (1, -1):
                c0 = k * 0.21
                A = (-0.7, sgn * (-0.7) + c0); B = (0.7, sgn * 0.7 + c0)
                q = clip(bar(A, B, 0.02))
                if q: P.append(q)
    elif PATTERN == 'teeth':
        for row in range(4):
            y0 = -0.42 + row * 0.215
            for k in range(5):
                x0 = -0.42 + k * 0.168
                P.append([(x0 + 0.012, y0 + 0.01), (x0 + 0.168 - 0.012, y0 + 0.01), (x0 + 0.084, y0 + 0.175)])
    elif PATTERN == 'rings':
        for i in (-1, 0, 1):
            for j in (-1, 0, 1):
                P += ring(0.083, 0.115, 20, 0, 2 * math.pi, i * 0.28, j * 0.28) + [disc(0.03, 12, i * 0.28, j * 0.28)]
    elif PATTERN == 'waves':
        for ty in (-0.315, -0.105, 0.105, 0.315):
            pts = [(-0.43 + 0.86 * i / 32, ty + 0.045 * math.sin(2 * math.pi * (0.86 * i / 32) / 0.215)) for i in range(33)]
            P += [bar(pts[i], pts[i + 1], 0.021, 0.004) for i in range(32)]
    elif PATTERN == 'keyband':
        U, w = 0.28, 0.028      # (a unit of the running key, and its stroke)
        for by in (0.205, -0.205):      # (two bands, each a row of three units on a baseline)
            y0 = by - 0.13
            P.append(bar((-0.42, y0), (0.42, y0), w, w))      # (its baseline)
            for k in range(3):
                x0 = -0.42 + k * U
                path = [(x0 + 0.03, y0), (x0 + 0.03, y0 + 0.23), (x0 + 0.23, y0 + 0.23), (x0 + 0.23, y0 + 0.085), (x0 + 0.115, y0 + 0.085), (x0 + 0.115, y0 + 0.155)]
                P += [bar(path[i], path[i + 1], w, w) for i in range(len(path) - 1)]
    elif PATTERN == 'spirals':
        for (cx, cy, a0) in ((-0.21, 0.21, 0.0), (0.21, 0.21, math.pi / 2), (0.21, -0.21, math.pi), (-0.21, -0.21, -math.pi / 2)):
            P.append(disc(0.03, 12, cx, cy)); P += spiral_at(cx, cy, 0.03, 0.062, 2.4, 0.018, 26, a0)
    elif PATTERN.startswith('path'):      # (the way's own marks: rings as its discs, lines as its line, each line stopping at a ring's rim as the way's does (the owner, 23/11: "what if the design on the cube had lines and circles in the middle, like the path's?"))
        lw = 0.02      # (a line's half width)
        def ring_at(cx, cy, r): return ring(r - 0.042, r, 28, 0, 2 * math.pi, cx, cy)
        def line(A, B): return bar(A, B, lw, 0.0)
        if PATTERN == 'path4':      # (a disc where four ways meet; the lines run on over the face's edges, so they meet the next face's and cut the edge clean)
            R = 0.15; P += ring_at(0, 0, R)
            DISCS[:] = [(0.0, 0.0, R - 0.042)]
            for ang in range(4):
                d = rot([(1.0, 0.0)], ang * math.pi / 2)[0]
                P.append(line((d[0] * (R + 0.012), d[1] * (R + 0.012)), (d[0] * 0.54, d[1] * 0.54)))
        elif PATTERN == 'path2':      # (a disc on a straight way)
            R = 0.15; P += ring_at(0, 0, R)
            DISCS[:] = [(0.0, 0.0, R - 0.042)]
            P += [line((R + 0.012, 0), (0.54, 0)), line((-R - 0.012, 0), (-0.54, 0))]
        elif PATTERN == 'path3':      # (three discs on a way)
            R = 0.085
            for x in (-0.29, 0.0, 0.29): P += ring_at(x, 0, R)
            DISCS[:] = [(x, 0.0, R - 0.042) for x in (-0.29, 0.0, 0.29)]
            P += [line((-0.29 + R + 0.012, 0), (-R - 0.012, 0)), line((R + 0.012, 0), (0.29 - R - 0.012, 0)),
                  line((-0.54, 0), (-0.29 - R - 0.012, 0)), line((0.29 + R + 0.012, 0), (0.54, 0))]
        elif PATTERN == 'pathsq':      # (four discs in a square, the way round it)
            R = 0.085; c = 0.22
            for (x, y) in ((-c, -c), (c, -c), (c, c), (-c, c)): P += ring_at(x, y, R)
            DISCS[:] = [(x, y, R - 0.042) for (x, y) in ((-c, -c), (c, -c), (c, c), (-c, c))]
            g = R + 0.012
            P += [line((-c + g, -c), (c - g, -c)), line((c, -c + g), (c, c - g)), line((c - g, c), (-c + g, c)), line((-c, c - g), (-c, -c + g))]
    elif PATTERN == 'frame_wide':      # (a wider frame, its lines a little bolder, two keys a side spaced evenly, the outer line running round the face's edge unbroken, a hooked square in each corner (the owner, 23/11: "a little thicker frame"))
        hw = 0.019; yb, yt = -0.45 + hw, -0.22 - hw
        def bar2(A, B, ea, eb):      # (a stroke run on past its start by ea and past its end by eb)
            dx, dy = B[0] - A[0], B[1] - A[1]; ln = math.hypot(dx, dy); ux, uy = dx / ln, dy / ln
            return bar((A[0] - ux * ea, A[1] - uy * ea), (B[0] + ux * eb, B[1] + uy * eb), hw, 0.0)
        side = [bar2((-0.45 + hw, yb), (0.45 - hw, yb), hw, hw)]      # (the outer line, the face's edge, corner to corner)
        for x0 in (-0.22, 0.0):
            pts = [(x0 + 0.035, yb), (x0 + 0.035, yt), (x0 + 0.185, yt), (x0 + 0.185, yb + 0.07), (x0 + 0.11, yb + 0.07), (x0 + 0.11, yb + 0.135)]
            for m in range(len(pts) - 1): side.append(bar2(pts[m], pts[m + 1], hw, 0.0 if m == len(pts) - 2 else hw))
        corner = [bar2((0.26, -0.37), (0.37, -0.37), hw, hw), bar2((0.37, -0.37), (0.37, -0.26), hw, hw), bar2((0.37, -0.26), (0.26, -0.26), hw, hw), bar2((0.26, -0.26), (0.26, -0.33), hw, 0.0)]
        for q in range(4):
            P += [rot(pg, q * math.pi / 2) for pg in side + corner]
    elif PATTERN in ('frame', 'frame_thin', 'frame_calm'):      # (a running key on each side, square keys at the corners, the middle plain; thin: finer lines; calm: two larger keys a side, fine)
        w = {'frame': 0.017, 'frame_thin': 0.011, 'frame_calm': 0.012}[PATTERN]; nk = 2 if PATTERN == 'frame_calm' else 3
        yb, yt = -0.44 + w, -0.27 - w      # (the band's baseline at the face's edge and its top)
        side = [bar((-0.27, yb), (0.27, yb), w, w)]
        U = 0.54 / nk; sc = U / 0.18
        for k in range(nk):
            x0 = -0.27 + k * U
            path = [(x0 + 0.02 * sc, yb), (x0 + 0.02 * sc, yt), (x0 + 0.155 * sc, yt), (x0 + 0.155 * sc, yb + 0.06), (x0 + 0.085 * sc, yb + 0.06), (x0 + 0.085 * sc, yb + 0.105)]
            if PATTERN == 'frame_calm': path[3:] = [(x0 + 0.155 * sc, yb + 0.055), (x0 + 0.075 * sc, yb + 0.055), (x0 + 0.075 * sc, yt - 0.05), (x0 + 0.115 * sc, yt - 0.05)]
            side += [bar(path[m], path[m + 1], w, w) for m in range(len(path) - 1)]
        for q in range(4):
            P += [rot(pg, q * math.pi / 2) for pg in side]
            c = 0.355; h = 0.06
            corner = [bar((c - h, -c - h), (c + h, -c - h), w, w), bar((c + h, -c - h), (c + h, -c + h), w, w),
                      bar((c + h, -c + h), (c - h, -c + h), w, w), bar((c - h, -c + h), (c - h, -c - 0.005), w, w)]
            P += [rot(pg, q * math.pi / 2) for pg in corner]
    elif PATTERN == 'wreath':      # (leaves either side of a round stem, open at the foot where a ribbon ties it)
        R = 0.29; a0, a1 = -math.pi / 2 + 0.32, 3 * math.pi / 2 - 0.32
        P += ring(R - 0.011, R + 0.011, 40, a0, a1)
        n = 14
        for i in range(n):
            a = a0 + (a1 - a0) * (i + 0.5) / n; side = 1 if a < math.pi / 2 else -1      # (the leaves point up the wreath from its foot on either side)
            for out in (1, -1):
                bx, by = R * math.cos(a), R * math.sin(a)
                t = (-math.sin(a) * side, math.cos(a) * side); nrm = (math.cos(a) * out, math.sin(a) * out)
                d = (t[0] * 0.8 + nrm[0] * 0.6, t[1] * 0.8 + nrm[1] * 0.6); L_ = 0.105
                leaf = lens(0.0, 0.0, L_, 0.032)
                ang = math.atan2(d[1], d[0])
                P.append([(bx + x, by + y) for (x, y) in rot(leaf, ang)])
        P += [bar((-0.05, -R - 0.01), (-0.12, -0.42), 0.02, 0.01), bar((0.05, -R - 0.01), (0.12, -0.42), 0.02, 0.01)]      # (the ribbon's ends)
    elif PATTERN == 'palmette':
        base = (0.0, -0.22)
        for i in range(7):
            a = math.radians(30 + i * 20); r1 = 0.36 + 0.07 * math.cos(math.radians(i * 30 - 90)) ** 2 * (1 if i == 3 else 0.6)
            P.append([(base[0] + x, base[1] + y) for (x, y) in lens(a, 0.07, r1 + 0.02, 0.048)])
        P.append(disc(0.045, 16, base[0], base[1]))
        P += spiral_at(-0.17, -0.33, 0.02, 0.05, 1.6, 0.017, 24, 0.0) + spiral_at(0.17, -0.33, 0.02, 0.05, 1.6, 0.017, 24, math.pi)
    elif PATTERN == 'eggdart':
        for row, cy in enumerate((0.29, 0.0, -0.29)):
            P.append(bar((-0.43, cy + 0.125), (0.43, cy + 0.125), 0.014, 0.0))
            for k in range(4):
                cx = -0.315 + k * 0.21
                P.append([(cx + 0.062 * math.cos(2 * math.pi * j / 20), cy + 0.012 + 0.088 * math.sin(2 * math.pi * j / 20)) for j in range(20)])
                if k < 3: P.append([(cx + 0.105 - 0.022, cy + 0.1), (cx + 0.105 + 0.022, cy + 0.1), (cx + 0.105, cy - 0.09)])
    elif PATTERN == 'basket':
        g = 0.84 / 3.0
        for i in range(3):
            for j in range(3):
                cx, cy = -0.42 + g * (i + 0.5), -0.42 + g * (j + 0.5)
                for k in (-1, 0, 1):
                    if (i + j) % 2 == 0: P.append(bar((cx - 0.1, cy + k * 0.075), (cx + 0.1, cy + k * 0.075), 0.023, 0.0))
                    else: P.append(bar((cx + k * 0.075, cy - 0.1), (cx + k * 0.075, cy + 0.1), 0.023, 0.0))
    elif PATTERN == 'flutes':
        for k in range(5):
            x = -0.32 + k * 0.16
            P.append([(x - 0.045, -0.36), (x + 0.045, -0.36), (x + 0.045, 0.36), (x - 0.045, 0.36)])
            P.append(disc(0.045, 16, x, 0.36)); P.append(disc(0.045, 16, x, -0.36))
    elif PATTERN == 'scroll':      # (the running wave: a line rising into a curl, then down to the next, two bands)
        for by in (0.2, -0.2):
            for k in range(3):
                cx = -0.28 + k * 0.28; cy = by + 0.015
                P += spiral_at(cx, cy, 0.018, 0.055, 1.25, 0.019, 24, math.pi)
                end = (cx - (0.018 + 0.055 * 1.25), cy)      # (the curl's outer end, at its left)
                nxt = (cx - 0.28 + 0.08, by - 0.11) if k > 0 else (-0.43, by - 0.11)
                mid = ((end[0] + nxt[0]) * 0.5 - 0.01, by - 0.085)
                P += [bar(end, mid, 0.019, 0.006), bar(mid, nxt, 0.019, 0.006)]
            P.append(bar((-0.43, by - 0.11), (0.43, by - 0.11), 0.017, 0.0))
    elif PATTERN == 'herringbone':
        for row in range(6):
            cy = -0.36 + row * 0.144
            for k in range(6):
                cx = -0.36 + k * 0.144; d = 0.055 if row % 2 == 0 else -0.055
                P.append(bar((cx - 0.05, cy - d), (cx + 0.05, cy + d), 0.02, 0.0))
    elif PATTERN == 'mirror':
        cy = 0.08
        P += ring(0.235, 0.29, 40, 0, 2 * math.pi, 0.0, cy) + [disc(0.175, 32, 0.0, cy)]      # (its rim and its disc)
        P.append([(-0.04, cy - 0.29 - 0.005), (0.04, cy - 0.29 - 0.005), (0.032, -0.43), (-0.032, -0.43)])      # (its handle)
        P.append(disc(0.05, 16, 0.0, -0.43))      # (the handle's end)
    return P
def polys(k):
    if PATTERN in ('one', 'four'):
        for (s0, s1, t0, t1) in key_rects(k): yield [(s0, t0), (s1, t0), (s1, t1), (s0, t1)]
        return
    for pg in motif():
        for _ in range(TURN[k]): pg = [(-y, x) for (x, y) in pg]
        yield pg

# the cube, centred, and the cutter: a thin box for every bar of every face, reaching out past the face
me = bpy.data.meshes.new('cube'); bm = bmesh.new(); bmesh.ops.create_cube(bm, size=L); bm.to_mesh(me); bm.free()
cube = bpy.data.objects.new('cube', me); bpy.context.scene.collection.objects.link(cube)
cm = bpy.data.meshes.new('cut'); cb = bmesh.new()
for k, (n, sa, ta) in enumerate(FACES):
    for pg in polys(k):      # (each outline a prism from DEPTH under the face to 2 cm over it)
        lo = [cb.verts.new(n * (HF - DEPTH) + sa * (x * L) + ta * (y * L)) for (x, y) in pg]
        hi = [cb.verts.new(n * (HF + 0.02) + sa * (x * L) + ta * (y * L)) for (x, y) in pg]
        cb.faces.new(lo[::-1]); cb.faces.new(hi)
        for i in range(len(pg)): j = (i + 1) % len(pg); cb.faces.new((lo[i], lo[j], hi[j], hi[i]))
bmesh.ops.recalc_face_normals(cb, faces=cb.faces[:])
cb.to_mesh(cm); cb.free()
cut = bpy.data.objects.new('cut', cm); bpy.context.scene.collection.objects.link(cut)
mod = cube.modifiers.new('cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = cut; mod.solver = 'EXACT'
mod.use_self = True; mod.use_hole_tolerant = True
dg = bpy.context.evaluated_depsgraph_get()
ev = cube.evaluated_get(dg)
bm = bmesh.new(); bm.from_mesh(ev.to_mesh())
ev.to_mesh_clear()
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.05), verts=bm.verts[:], edges=bm.edges[:])
print('cut: faces', len(bm.faces), 'verts', len(bm.verts))

def side_of(co):      # (the face a point lies nearest, its across and its up there, how deep under it, how far from its edges)
    k = max(range(6), key=lambda i: co.dot(FACES[i][0]))
    n, sa, ta = FACES[k]
    u, v = co.dot(sa), co.dot(ta)
    def sm(e0, e1, x):
        t = min(max((x - e0) / (e1 - e0), 0.0), 1.0); return t * t * (3.0 - 2.0 * t)
    w = (1.0 - sm(HF - 0.075, HF - 0.035, abs(u))) * (1.0 - sm(HF - 0.075, HF - 0.035, abs(v)))
    return k, n, sa, ta, HF - co.dot(n), u, v, w

mark = bm.faces.layers.int.new('mea')
for f in bm.faces:
    c = f.calc_center_median(); k, n, sa, ta, depth, u, v, w = side_of(c)
    lim = 0.83 if PATTERN == 'one' else 0.95      # (the four small keys, and the motifs, reach nearer the face's edges)
    f[mark] = 1 if ((0.0015 if CRISP else 0.003) < depth < DEPTH + 0.008 and abs(u) < HF * lim and abs(v) < HF * lim) else 0      # (a shallow frame's floor lies only millimetres under the face)
    if f[mark] == 0 and DISCS and abs(depth) < 0.0015:
        for (dx, dy, rr) in DISCS:
            for _ in range(TURN[k]): dx, dy = -dy, dx
            if all((x.co.dot(sa) / L - dx) ** 2 + (x.co.dot(ta) / L - dy) ** 2 < (rr + 0.004) ** 2 for x in f.verts): f[mark] = 2; break      # (every corner of it within the ring: a face's middle by its corners lies near the ring for the four fields round it too, whose many corners run along the ring's arc, and they were taken in (the owner, 23/11: "why did you make it all white"))
print('meander faces', sum(f[mark] for f in bm.faces))

# the meander uneven, as cut by hand (as tools/go/block_meander.py)
WOB = (0.0, 0.0, 0.0) if CRISP else {'one': (0.02, 0.0125, 0.015), 'four': (0.006, 0.004, 0.006)}.get(PATTERN, (0.008, 0.005, 0.008))      # (thin grooves waver less, or they would close)
SEG = 0.035
def split_long(e):
    A, B = e.verts[0].co.copy(), e.verts[1].co.copy(); n = int((B - A).length / SEG) + 1
    cur = e
    for i in range(1, n):
        P = A + (B - A) * (i / n)
        a0 = cur.verts[0] if (cur.verts[0].co - A).length < (cur.verts[1].co - A).length else cur.verts[1]
        ne, nv = bmesh.utils.edge_split(cur, a0, (P - a0.co).length / cur.calc_length())
        nv.co = P
        cur = ne if B.to_tuple(6) in [x.co.to_tuple(6) for x in ne.verts] else cur
long_es = [e for e in bm.edges if e.calc_length() > SEG and any(f[mark] for f in e.link_faces) and side_of((e.verts[0].co + e.verts[1].co) * 0.5)[7] > 0.0]
for e in long_es: split_long(e)
noise.seed_set(SEED)
moved = 0
for v in bm.verts:
    k, n, sa, ta, depth, u, vv, w = side_of(v.co)
    if w <= 0.0 or depth < -0.01 or depth > DEPTH + 0.017: continue
    q = Vector((u, vv, 0.0))
    d1 = noise.noise_vector(q / 0.2 + Vector((0.0, 0.0, 3.1 * k + 0.5)))
    d2 = noise.noise_vector(q / 0.09 + Vector((0.0, 0.0, 7.3 * k + 11.5)))
    off = sa * (WOB[0] * d1.x + WOB[1] * d2.x) + ta * (WOB[0] * d1.y + WOB[1] * d2.y)
    if depth > 0.018: off -= n * WOB[2] * noise.noise(q / 0.09 + Vector((0.0, 0.0, 5.7 * k + 23.0)))
    v.co += off * w; moved += 1
bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
print('uneven: verts moved', moved, 'faces', len(bm.faces))

HEWN = PATTERN.startswith("path")      # (the way's designs on a stone hewn rough: its faces well out of true, many corners broken, chips along its edges; its marks cut true (the owner, 23/11: "can we make the cube more crooked, cut and hewn? it's too straight"))
LK = 1.45 if HEWN else (0.25 if CRISP else 1.0)
LEAN = [(rnd.uniform(-0.022, 0.022) * LK, rnd.uniform(-0.022, 0.022) * LK) for _ in range(6)]      # (each face out of true its own way; the frames' nearly flat)
def bend(co):
    p = co.copy()
    for k, (n, sa, ta) in enumerate(FACES):
        s = co.dot(n)
        if s > 0:
            w = s / HF
            p += n * w * (LEAN[k][0] * co.dot(sa) / HF + LEAN[k][1] * co.dot(ta) / HF)
    return p
for v in bm.verts: v.co = bend(v.co)

def cutp(b, co, no):
    geom = b.verts[:] + b.edges[:] + b.faces[:]
    r = bmesh.ops.bisect_plane(b, geom=geom, dist=1e-6, plane_co=co, plane_no=no, clear_outer=True)
    edges = [e for e in r['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    if edges:
        made = bmesh.ops.holes_fill(b, edges=edges, sides=0)
        for f in made.get('faces', []): f[mark] = 0
corners = [(sx, sy, sz) for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
rnd.shuffle(corners)
for (sx, sy, sz) in corners[:(7 if HEWN else (3 if CRISP else 5))]:      # (corners broken off aslant, each its own size; the frames' only chipped, clear of their keys; the hewn's seven, 4.4 to 10 cm: softer ones were tried (23/11) and the owner kept these, "I liked this cut more after all")
    c = Vector((sx * HF, sy * HF, sz * HF))
    n = Vector((sx * rnd.uniform(0.6, 1.0), sy * rnd.uniform(0.6, 1.0), sz * rnd.uniform(0.6, 1.0))).normalized()
    cutp(bm, bend(c) - n * (rnd.uniform(0.035, 0.08) if HEWN else (rnd.uniform(0.012, 0.02) if CRISP else rnd.uniform(0.03, 0.065))), n)
if HEWN:      # (chips along the edges, near their ends: a plane leaning off the edge's two faces and along it, so the chip runs out along the edge)
    axes = [Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))]
    for _ in range(5):
        i, j = rnd.sample(range(3), 2); m_ = 3 - i - j
        si, sj, sm = rnd.choice((-1, 1)), rnd.choice((-1, 1)), rnd.choice((-1, 1))
        e = axes[i] * si + axes[j] * sj      # (the edge between face i and face j, running along axis m)
        p0 = axes[i] * (si * HF) + axes[j] * (sj * HF) + axes[m_] * (sm * HF * rnd.uniform(0.35, 0.7))
        n = (e.normalized() + axes[m_] * (sm * rnd.uniform(0.35, 0.7))).normalized()
        cutp(bm, bend(p0) - n * rnd.uniform(0.016, 0.03), n)

holes = [e for e in bm.edges if e.is_boundary]
if holes: bmesh.ops.holes_fill(bm, edges=holes, sides=0)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
bm.verts.index_update()
print('marked after the cuts', sum(f[mark] for f in bm.faces), 'open edges', len([e for e in bm.edges if e.is_boundary]))

def part(val):
    b2 = bmesh.new(); vmap = {}
    for f in bm.faces:
        if f[mark] != val: continue
        vs = []
        for v in f.verts:
            if v.index not in vmap: vmap[v.index] = b2.verts.new(v.co)
            vs.append(vmap[v.index])
        try: b2.faces.new(vs)
        except ValueError: pass
    return b2
body = part(0); mbm = part(1); dbm = part(2)
print('parted: block', len(body.faces), 'faces, meander', len(mbm.faces), 'faces, disc', len(dbm.faces), 'faces')
S = SIDE / L
for b, name in ((body, 'block'), (mbm, 'meander')) + (((dbm, 'disc'),) if len(dbm.faces) else ()):
    for v in b.verts: v.co = Vector((v.co.x * S, v.co.y * S, (v.co.z + HF) * S))      # (its foot at its origin)
    m2 = bpy.data.meshes.new(name); b.to_mesh(m2); b.free()
    for p in m2.polygons: p.use_smooth = False
    o = bpy.data.objects.new(name, m2); bpy.context.scene.collection.objects.link(o)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.name in ('block', 'meander', 'disc'): o.select_set(True)
bpy.data.objects.remove(cube); bpy.data.objects.remove(cut)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_normals=True, export_materials='NONE')
print('SAVED', OUT)
