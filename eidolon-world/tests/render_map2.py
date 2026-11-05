#!/usr/bin/env python3
"""EIDOLON v2 rebuild: the top-down map of Chapter I's new world (every space labelled with its script beat).
Usage: godot --headless --path . -s res://tests/map2_dump.gd | grep ^MAP2JSON | cut -c10- > map2.json
       python3 tests/render_map2.py map2.json dev/shots/v2-map.png
North is up (-z), local metres (the Atrium's centre is 0, 0)."""
import json
import sys
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
M = json.load(open(src))
PX = 13.0
X0, X1, Z0, Z1 = -57.0, 34.0, -70.0, 31.0
PAD_L, PAD_T, LEG_W = 40, 120, 520
W = int((X1 - X0) * PX) + PAD_L * 2 + LEG_W
H = int((Z1 - Z0) * PX) + PAD_T + 60


def P(x, z):
    return (PAD_L + (x - X0) * PX, PAD_T + (z - Z0) * PX)


def R(r):
    a = P(min(r[0], r[2]), min(r[1], r[3]))
    b = P(max(r[0], r[2]), max(r[1], r[3]))
    return [a, b]


FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
f_small = ImageFont.truetype(FONT, 11)
f_lab = ImageFont.truetype(FONTB, 12)
f_id = ImageFont.truetype(FONTB, 15)
f_title = ImageFont.truetype(SERIF, 30)
f_sub = ImageFont.truetype(FONT, 15)
f_leg = ImageFont.truetype(FONT, 13)
f_legb = ImageFont.truetype(FONTB, 14)

KIND = {
    "puzzle": (214, 150, 150), "breath": (186, 204, 186), "traversal": (205, 200, 190), "spectacle": (226, 205, 150),
    "hub": (238, 226, 200), "between": (200, 190, 216),
}
GROUP = {}
for s in M["spaces"]:
    b = s["beat"]
    g = "act1" if b.startswith("I.") and b not in ("I.20", "I.21", "I.22", "I.23") else None
    if s["id"] in ("WS",):
        g = "act1"
    if b.startswith("W") or s["id"] in ("WR", "IBW", "WB"):
        g = "west"
    if b.startswith("N") or s["id"] in ("IBN", "NB", "NS"):
        g = "north"
    if b.startswith("E") or s["id"] in ("IBE", "ER", "EB", "EH"):
        g = "east"
    if b in ("I.20", "I.21", "I.22", "I.23") or s["id"] in ("VW", "P", "PW"):
        g = "act3"
    if s["id"] == "IB1":
        g = "act1"
    if s["id"] == "A":
        g = "hub"
    GROUP[s["id"]] = g or "act1"
GCOL = {"act1": (60, 60, 60), "west": (40, 70, 130), "north": (40, 110, 60), "east": (150, 90, 20), "act3": (150, 20, 40), "hub": (0, 0, 0)}

img = Image.new("RGB", (W, H), (236, 236, 232))
d = ImageDraw.Draw(img, "RGBA")
# fog grid
for gx in range(int(X0), int(X1) + 1, 5):
    a, b = P(gx, Z0), P(gx, Z1)
    d.line([a, b], fill=(0, 0, 0, 18 if gx % 10 else 40), width=1)
for gz in range(int(Z0), int(Z1) + 1, 5):
    a, b = P(X0, gz), P(X1, gz)
    d.line([a, b], fill=(0, 0, 0, 18 if gz % 10 else 40), width=1)
for gx in range(int(X0) + int(X0) % 10, int(X1) + 1, 10):
    x, y = P(gx, Z0)
    d.text((x + 2, y - 14), "%d" % gx, font=f_small, fill=(120, 120, 120))
for gz in range(-70, 31, 10):
    x, y = P(X0, gz)
    d.text((x - 32, y - 6), "%d" % gz, font=f_small, fill=(120, 120, 120))

# water
for w in M["water"]:
    d.rectangle(R(w[:4]), fill=(150, 168, 180, 255 if w[5] else 140))
sid = {s["id"]: s for s in M["spaces"]}
# walk regions
for e in M["walk"]:
    sp = e["space"]
    base = {"I4s": "I4", "W2c": "W2", "N7d": "N7", "N7x": "N7", "E3l": "E3", "E5u": "E5"}.get(sp, sp)
    s = sid.get(base)
    col = KIND.get(s["kind"] if s else "traversal")
    r = R(e["rect"])
    d.rectangle(r, fill=col + (255,), outline=(90, 85, 80), width=1)
    if e["axis"] >= 0 and e["y0"] != e["y1"]:
        # a ramp / stair: hatching and an arrow uphill
        (ax, ay), (bx, by) = r
        if e["axis"] == 0:
            for k in range(int(ax), int(bx), 5):
                d.line([(k, ay), (k, by)], fill=(90, 85, 80, 90))
        else:
            for k in range(int(ay), int(by), 5):
                d.line([(ax, k), (bx, k)], fill=(90, 85, 80, 90))
        cx, cy = (ax + bx) / 2, (ay + by) / 2
        lo, hi = e["y0"], e["y1"]
        d.text((cx - 18, cy - 6), "%g→%g" % (lo, hi) if e["axis"] == 0 else "%g↓%g" % (lo, hi), font=f_small, fill=(40, 40, 40))
# walls
for w in M["walls"]:
    d.rectangle(R(w[:4]), fill=(50, 45, 45))
# wing outlines (by group) on the space rects
for s in M["spaces"]:
    r = R(s["rect"])
    c = GCOL[GROUP[s["id"]]]
    d.rectangle(r, outline=c + (200,), width=2)
# the route
rt = M["route"]
for i in range(len(rt) - 1):
    a, b = P(rt[i][0], rt[i][1]), P(rt[i + 1][0], rt[i + 1][1])
    d.line([a, b], fill=(160, 10, 30, 150), width=2)
for i, e in enumerate(rt):
    x, y = P(e[0], e[1])
    d.ellipse([x - 2.5, y - 2.5, x + 2.5, y + 2.5], fill=(160, 10, 30, 200))
x, y = P(rt[0][0], rt[0][1])
d.ellipse([x - 7, y - 7, x + 7, y + 7], outline=(160, 10, 30), width=3)
d.text((x + 9, y - 22), "she wakes", font=f_lab, fill=(160, 10, 30))
# pieces (Tripo)
for p in M["pieces"]:
    x, y = P(p["x"], p["z"])
    big = p["asset"] == "colossus_head_veiled"
    rr = 34 if big else 4
    d.ellipse([x - rr, y - rr, x + rr, y + rr], outline=(40, 40, 40, 220), width=2, fill=(255, 255, 255, 90) if big else (40, 40, 40, 200))
    if big:
        d.text((x - 30, y - 8), "the Observer\n(8 m face)", font=f_small, fill=(30, 30, 30))
    if p["asset"].startswith("door") or p["asset"].startswith("gate"):
        d.rectangle([x - 5, y - 5, x + 5, y + 5], fill=(90, 20, 30, 230))
    if p["asset"] == "brazier":
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(200, 20, 40, 255), outline=(60, 0, 0), width=2)
# labels
for s in M["spaces"]:
    r = R(s["rect"])
    cx, cy = (r[0][0] + r[1][0]) / 2, (r[0][1] + r[1][1]) / 2
    beat = s["beat"]
    name = s["name"]
    w_px = r[1][0] - r[0][0]
    h_px = r[1][1] - r[0][1]
    txt = beat
    tw = d.textlength(txt, font=f_id)
    if w_px < 70 or h_px < 30:
        # small space: the label beside it
        d.text((r[1][0] + 4, cy - 8), txt, font=f_id, fill=GCOL[GROUP[s["id"]]])
        continue
    d.text((cx - tw / 2, cy - 18), txt, font=f_id, fill=GCOL[GROUP[s["id"]]])
    nm = name if d.textlength(name, font=f_small) < w_px - 4 else name.split(" (")[0]
    if d.textlength(nm, font=f_small) > w_px - 4:
        words = nm.split(" ")
        nm = " ".join(words[: max(1, len(words) // 2)]) + "\n" + " ".join(words[max(1, len(words) // 2):])
    d.multiline_text((cx, cy + 6), nm, font=f_small, fill=(30, 30, 30), anchor="ma", align="center")

# title
d.text((PAD_L, 18), "EIDOLON  Chapter I: The Veiled Gate  (v2 rebuild, the new world)", font=f_title, fill=(120, 10, 30))
d.text((PAD_L, 60), "Top-down, north up (the camera looks from the south-west). Local metres, the Atrium at 0,0 (world: + %s). "
       "Every space is labelled with its beat in dev/EIDOLON_SCRIPT.md §6." % (M["origin"],), font=f_sub, fill=(60, 60, 60))
d.text((PAD_L, 82), "The crimson line is the play route the flow test walks (tests/flow_v2.gd): wake, Act 1, West, North, East, Act 3.",
       font=f_sub, fill=(60, 60, 60))
# legend
lx = W - LEG_W + 10
ly = PAD_T
d.text((lx, ly), "Kinds (the script's symbols)", font=f_legb, fill=(20, 20, 20)); ly += 22
for k, lab in [("puzzle", "puzzle"), ("breath", "breath (rest)"), ("traversal", "traversal / road"), ("spectacle", "spectacle / beacon"),
               ("hub", "hub (the Atrium)"), ("between", "in-between point (between two puzzles)")]:
    d.rectangle([lx, ly, lx + 26, ly + 14], fill=KIND[k], outline=(90, 85, 80))
    d.text((lx + 34, ly), lab, font=f_leg, fill=(20, 20, 20)); ly += 20
ly += 6
d.text((lx, ly), "Parts of the chapter", font=f_legb, fill=(20, 20, 20)); ly += 22
for g, lab in [("act1", "Prologue + Act 1: the Awakening (linear)"), ("hub", "I.6 the Atrium (hub)"), ("west", "Act 2 West: the Glass wing"),
               ("north", "Act 2 North: the Garden wing"), ("east", "Act 2 East: the High wing"), ("act3", "Act 3: the Convergence")]:
    d.rectangle([lx, ly, lx + 26, ly + 14], outline=GCOL[g], width=3)
    d.text((lx + 34, ly), lab, font=f_leg, fill=(20, 20, 20)); ly += 20
ly += 6
d.rectangle([lx, ly, lx + 26, ly + 14], fill=(150, 168, 180)); d.text((lx + 34, ly), "still water (pool, inlet, stream)", font=f_leg, fill=(20, 20, 20)); ly += 20
d.rectangle([lx, ly, lx + 26, ly + 14], fill=(150, 168, 180, 140)); d.text((lx + 34, ly), "the sea", font=f_leg, fill=(20, 20, 20)); ly += 20
d.rectangle([lx + 8, ly + 2, lx + 18, ly + 12], fill=(90, 20, 30)); d.text((lx + 34, ly), "door / gate (Tripo)", font=f_leg, fill=(20, 20, 20)); ly += 20
d.ellipse([lx + 6, ly, lx + 20, ly + 14], fill=(200, 20, 40)); d.text((lx + 34, ly), "Beacon (lit with the lamp)", font=f_leg, fill=(20, 20, 20)); ly += 20
d.rectangle([lx, ly + 4, lx + 26, ly + 9], fill=(50, 45, 45)); d.text((lx + 34, ly), "wall", font=f_leg, fill=(20, 20, 20)); ly += 20
d.text((lx, ly), "hatched: stair / ramp (heights in m)", font=f_leg, fill=(20, 20, 20)); ly += 28
d.text((lx, ly), "Beats, in play order", font=f_legb, fill=(20, 20, 20)); ly += 22
seen = []
for e in rt:
    if e[2] not in seen:
        seen.append(e[2])
for s in M["spaces"]:
    pass
order = []
for e in rt:
    b = {"I4s": "I4", "W2c": "W2", "N7d": "N7", "N7x": "N7", "E3l": "E3", "E5u": "E5"}.get(e[2], e[2])
    if b not in order:
        order.append(b)
for b in order:
    s = sid[b]
    txt = "%-9s %s" % (s["beat"], s["name"])
    d.text((lx, ly), txt[:62], font=f_leg, fill=GCOL[GROUP[b]]); ly += 17
# scale bar + compass
sx, sy = P(-55, 28)
d.line([(sx, sy), (sx + 10 * PX, sy)], fill=(20, 20, 20), width=3)
d.text((sx, sy + 4), "10 m", font=f_small, fill=(20, 20, 20))
cx, cy = P(-52, -66)
d.polygon([(cx, cy - 22), (cx - 8, cy), (cx + 8, cy)], fill=(120, 10, 30))
d.text((cx - 4, cy + 2), "N", font=f_lab, fill=(20, 20, 20))
img.save(out)
print("map ->", out, img.size)
