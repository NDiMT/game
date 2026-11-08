#!/usr/bin/env python3
"""EIDOLON v3 (dev/CH1_V3.md): the Chapter I block plan, top-down. A DRAFT layout (phase 1 moves it into map3.gd).
Usage: python3 tests/render_map3.py dev/shots/v3-map.png
North is up (-z), metres, the Atrium's centre is 0,0. The camera looks from the south-west: mirrors only on N or E walls."""
import sys
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1] if len(sys.argv) > 1 else "dev/shots/v3-map.png"
# [id, beat, name, kind, (x0, z0, x1, z1), group]
S = [
    ("WS", "P", "Waking Shore", "story", (-10, 31, 2, 35), "act1"),
    ("I1", "I.1", "Plate She Treads", "puzzle", (2, 24, 10, 33), "act1"),
    ("I2", "I.2", "The Bell", "between", (10, 26, 15, 32), "act1"),
    ("I3", "I.3", "First Glass", "puzzle", (15, 16, 20, 30), "act1"),
    ("IB1", "-", "Reed Bank", "between", (14, 10, 21, 16), "act1"),
    ("I4", "I.4", "One Slab", "puzzle", (4, 10, 14, 17), "act1"),
    ("I5", "I.5", "Crypt (Lamp)", "story", (-3, 10, 4, 19), "act1"),
    ("A", "I.6", "Atrium of a Thousand Faces", "hub", (-10, -10, 10, 10), "hub"),
    ("WR", "-", "Inlet Road", "between", (-18, -1.5, -10, 1.5), "west"),
    ("W1", "W.1", "Stair of Breath", "puzzle", (-22, -12, -18, 2), "west"),
    ("W2", "W.2", "Offering", "between", (-22, -16, -18, -12), "west"),
    ("W3", "W.3", "Hall of Glass (Shard)", "puzzle", (-32, -27, -22, -16), "west"),
    ("W4", "W.4", "Star Corridor", "story", (-38, -23, -32, -20), "west"),
    ("W5", "W.5", "Where Her Shadow Fell", "puzzle", (-48, -28, -38, -17), "west"),
    ("IBW", "-", "Ash Landing", "between", (-46, -17, -40, -12), "west"),
    ("W6", "W.6", "Hidden Way", "between", (-46, -12, -40, -6), "west"),
    ("WB", "W*", "Glass Beacon", "landmark", (-48, -6, -38, 2), "west"),
    ("W7", "W.7", "Colossus Stones", "landmark", (-38, 2, -17, 5), "west"),
    ("N1", "N.1", "Flooded Colonnade", "puzzle", (-3, -20, 3, -10), "north"),
    ("NG", "-", "Garden Landing", "between", (-4, -24, 6, -20), "north"),
    ("N2", "N.2", "The Turned Ones", "puzzle", (-8, -36, 4, -24), "north"),
    ("N3", "N.3", "Votive", "between", (4, -30, 8, -24), "north"),
    ("N4", "N.4", "THE STILL ROOM (new)", "puzzle", (8, -36, 18, -26), "north"),
    ("IBN", "-", "Wind Ramp", "between", (13, -42, 18, -36), "north"),
    ("N5", "N.5", "Court of Light", "puzzle", (2, -54, 16, -42), "north"),
    ("N6", "N.6", "Tree of Shards", "landmark", (-4, -50, 2, -44), "north"),
    ("N7", "N.7", "Mist Maze", "puzzle", (-10, -66, 2, -54), "north"),
    ("NB", "N*", "Garden Beacon", "landmark", (-11, -74, -1, -66), "north"),
    ("NS", "-", "Cloister Stair", "between", (-14, -72, -11, -9), "north"),
    ("ER", "-", "Climbing Road", "between", (10, -1.5, 18, 1.5), "east"),
    ("E1", "E.1", "Balcony", "landmark", (18, -18, 23, 2), "east"),
    ("E2", "E.2", "Singing Stones", "puzzle", (18, -28, 28, -18), "east"),
    ("IBE", "-", "Veil Stair", "between", (28, -27, 31, -21), "east"),
    ("E3", "E.3", "Mirror Walk", "puzzle", (31, -56, 35, -21), "east"),
    ("E4", "E.4", "Upward Spring", "landmark", (27, -42, 31, -36), "east"),
    ("E5", "E.5", "The Scales", "puzzle", (24, -68, 36, -56), "east"),
    ("EB", "E.6*", "High Beacon + Plate", "landmark", (24, -78, 34, -68), "east"),
    ("EH", "-", "High Stair", "between", (20, -76, 24, -28), "east"),
    ("VW", "-", "Veiled Way", "between", (-9, 10, -5, 24), "act3"),
    ("P", "I.20", "Pool of Halves", "puzzle", (-10, 24, -1, 31), "act3"),
    ("PW", "-", "Far Shore", "between", (-14, 24, -10, 31), "act3"),
    ("I21", "I.21", "Bridge that Gives Way", "story", (-34, 26, -14, 29), "act3"),
    ("I22", "I.22", "Gate of the Four", "puzzle", (-46, 22, -34, 33), "act3"),
    ("I23", "I.23", "First Shrine", "story", (-46, 10, -34, 22), "act3"),
]
WATER = [(-34, 5, -14, 26, "the Lagoon"), (-10, 24, -1, 31, ""), (8.4, 10, 9.6, 17, "")]
OBSERVER = (-24, 13)
MIRRORS = [((-31, -27), (-23, -27)), ((-7, -36), (3, -36)), ((9, -36), (17, -36)), ((35, -54), (35, -23))]
ROUTE = {
    "act1": [(-4, 33), (6, 28), (12, 29), (17.5, 27), (17.5, 18), (17.5, 13), (9, 13.5), (3, 13.5), (0.5, 15), (0.5, 9)],
    "west": [(-9, 0), (-20, 0), (-20, -14), (-23, -18), (-29, -21), (-35, -21.5), (-43, -22), (-43, -14), (-43, -9),
             (-43, -2), (-36, 3.5), (-18, 3.5), (-18, 0)],
    "north": [(0, -9), (0, -19), (1, -22), (-2, -27), (-2, -33), (6, -27), (13, -30), (15.5, -37), (15.5, -41), (9, -48),
              (0, -47), (-4, -56), (-4, -64), (-6, -69), (-12.5, -60), (-12.5, -10), (-9, -9)],
    "east": [(9, 0), (20.5, 0), (20.5, -19), (23, -23), (29.5, -24), (33, -26), (33, -39), (29, -39), (33, -39), (33, -55),
             (30, -60), (29, -70), (22, -70), (22, -30), (20.5, -19)],
    "act3": [(-7, 9), (-7, 24), (-5, 27.5), (-9, 27.5), (-12, 27.5), (-24, 27.5), (-40, 27.5), (-40, 22), (-40, 16)],
}
KIND = {"puzzle": (214, 140, 140), "between": (200, 192, 222), "landmark": (226, 205, 150), "story": (176, 206, 186),
        "hub": (238, 226, 200)}
GCOL = {"act1": (60, 120, 70), "hub": (90, 90, 90), "west": (60, 90, 170), "north": (60, 140, 60), "east": (170, 110, 40),
        "act3": (150, 40, 60)}
CRIMSON = (165, 20, 40)
PX = 11.0
X0, X1, Z0, Z1 = -52.0, 40.0, -80.0, 38.0
PAD_L, PAD_T, LEG_W = 30, 100, 400
W = int((X1 - X0) * PX) + PAD_L * 2 + LEG_W
H = int((Z1 - Z0) * PX) + PAD_T + 40


def P(x, z):
    return (PAD_L + (x - X0) * PX, PAD_T + (z - Z0) * PX)


F = "/usr/share/fonts/truetype/dejavu/"
f_s = ImageFont.truetype(F + "DejaVuSans.ttf", 10)
f_id = ImageFont.truetype(F + "DejaVuSans-Bold.ttf", 12)
f_t = ImageFont.truetype(F + "DejaVuSerif-Bold.ttf", 26)
f_l = ImageFont.truetype(F + "DejaVuSans.ttf", 13)
f_lb = ImageFont.truetype(F + "DejaVuSans-Bold.ttf", 14)
im = Image.new("RGB", (W, H), (246, 243, 236))
d = ImageDraw.Draw(im)
d.text((PAD_L, 18), "EIDOLON v3 - Chapter I block plan (draft)", font=f_t, fill=(30, 30, 30))
d.text((PAD_L, 56), "top-down, north up, 1 grid = 10 m; camera looks from the SW (mirrors on N/E walls only)", font=f_l, fill=(80, 80, 80))
for gx in range(-50, 41, 10):
    d.line([P(gx, Z0), P(gx, Z1)], fill=(226, 222, 214))
for gz in range(-80, 39, 10):
    d.line([P(X0, gz), P(X1, gz)], fill=(226, 222, 214))
for x0, z0, x1, z1, nm in WATER:
    d.rectangle([P(x0, z0), P(x1, z1)], fill=(150, 175, 196))
    if nm:
        d.text(P(x0 + 0.6, z1 - 2.2), nm, font=f_l, fill=(40, 70, 100))
for s in S:
    x0, z0, x1, z1 = s[4]
    fill = KIND[s[3]] if s[0] != "P" else None
    d.rectangle([P(x0, z0), P(x1, z1)], fill=fill, outline=GCOL[s[5]], width=3 if s[0] == "N4" else 2)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    lab = s[0] if s[1] in ("-",) else "%s %s" % (s[0], s[1]) if s[0] != s[1] else s[0]
    tw = d.textlength(s[0], font=f_id)
    if (x1 - x0) * PX >= 34:
        d.text((P(cx, cz)[0] - tw / 2, P(cx, cz)[1] - 8), s[0], font=f_id, fill=(25, 25, 25))
    else:   # thin strips: the id beside
        d.text((P(x1, cz)[0] + 2, P(x1, cz)[1] - 7), s[0], font=f_id, fill=(25, 25, 25))
for a, b in MIRRORS:
    d.line([P(*a), P(*b)], fill=(40, 200, 230), width=5)
ox, oz = P(*OBSERVER)
d.ellipse([ox - 26, oz - 32, ox + 26, oz + 32], fill=(110, 110, 120), outline=(40, 40, 50), width=2)
d.text((ox - 30, oz + 34), "Observer head", font=f_s, fill=(20, 30, 50))
for g, pts in ROUTE.items():
    d.line([P(*p) for p in pts], fill=GCOL[g], width=2)
    for p in pts[1:-1]:
        q = P(*p)
        d.ellipse([q[0] - 2, q[1] - 2, q[0] + 2, q[1] + 2], fill=GCOL[g])
q = P(-4, 33)
d.ellipse([q[0] - 7, q[1] - 7, q[0] + 7, q[1] + 7], fill=CRIMSON)
d.text((q[0] - 20, q[1] + 8), "START", font=f_id, fill=CRIMSON)
for gx, gz in ((-7, 10), (0, -10), (10, 0)):
    q = P(gx, gz)
    d.rectangle([q[0] - 5, q[1] - 5, q[0] + 5, q[1] + 5], outline=CRIMSON, width=2)
# legend
lx = W - LEG_W + 10
y = PAD_T
d.text((lx, y), "Route order (beats)", font=f_lb, fill=(20, 20, 20))
y += 22
for g, title in (("act1", "Act 1 (linear)"), ("hub", "Hub"), ("west", "West - Glass"), ("north", "North - Garden"),
                 ("east", "East - High"), ("act3", "Act 3 (3 beacons)")):
    d.line([(lx, y + 8), (lx + 24, y + 8)], fill=GCOL[g], width=4)
    d.text((lx + 30, y), title, font=f_lb, fill=GCOL[g])
    y += 20
    for s in S:
        if s[5] == g:
            d.text((lx + 12, y), "%-4s %-5s %s" % (s[0], s[1], s[2]), font=f_l, fill=(40, 40, 40))
            y += 16
    y += 4
y += 6
for k, c in KIND.items():
    d.rectangle([lx, y, lx + 18, y + 12], fill=c, outline=(90, 90, 90))
    d.text((lx + 26, y - 1), k, font=f_l, fill=(40, 40, 40))
    y += 18
d.line([(lx, y + 6), (lx + 18, y + 6)], fill=(40, 200, 230), width=5)
d.text((lx + 26, y - 1), "big planar mirror", font=f_l, fill=(40, 40, 40))
y += 18
d.rectangle([lx + 4, y + 1, lx + 14, y + 11], outline=CRIMSON, width=2)
d.text((lx + 26, y - 1), "Atrium gates (S gate = 3 beacons)", font=f_l, fill=(40, 40, 40))
im.save(out)
print("wrote", out, im.size)
