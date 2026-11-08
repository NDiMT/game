#!/usr/bin/env python3
"""EIDOLON v3 (dev/CH1_V3.md): the Chapter I block plan, top-down, drawn from Map3 (scripts/v3/map3.gd).
Usage: godot --headless --path . -s res://tests/map3_dump.gd | grep ^MAP3JSON | cut -c10- > /tmp/map3.json
       python3 tests/render_map3.py /tmp/map3.json dev/shots/v3-map.png   (scripts/v3/map3.gd is the source)
North is up (-z), metres, the Atrium's centre is 0,0. The camera looks from the south-west: mirrors only on N or E walls."""
import sys
from PIL import Image, ImageDraw, ImageFont

import json
src, out = sys.argv[1], sys.argv[2]
M = json.load(open(src))
# Map3.SPACES rows: [id, beat, name, kind, [x0, z0, x1, z1], y0, y1, axis, part] -> (id, beat, name, kind, rect, group)
S = [(s[0], s[1], s[2] + ("" if s[0] != "N4" else " (new)"), s[3], tuple(s[4]), s[8] if s[0] != "A" else "hub") for s in M["spaces"]]
PART = {s[0]: s[5] for s in S}
WATER = [(w[0], w[1], w[2], w[3], "the Lagoon" if i == 0 else "") for i, w in enumerate(M["water"])]
OBSERVER = tuple(M["observer"])
RECT = {s[0]: s[4] for s in S}
MIRRORS = []
for m in M["mirrors"]:
    x0, z0, x1, z1 = RECT[m[0]]
    MIRRORS.append(((m[2], z0), (m[3], z0)) if m[1] == "N" else ((x1, m[2]), (x1, m[3])))
ROUTE = {pt: [(e[0], e[1]) for e in pts] for pt, pts in M["route_parts"].items()}
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
