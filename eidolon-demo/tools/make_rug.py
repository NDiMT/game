"""Weaves the rug of the first court: a long deep-teal carpet with a meander border, a medallion in the middle and
small ornaments in the corners of its field.

usage: python3 make_rug.py <out.png>
The picture's x runs east (0 = the edge under the statues), its y runs south; 400 px to the metre, 2.6 x 4.7 m.
"""
import sys, math, random
from PIL import Image, ImageDraw, ImageFilter
out = sys.argv[1]
PPM, SS = 400, 2
Wm, Hm = 2.6, 4.7
W, H = int(Wm * PPM * SS), int(Hm * PPM * SS)
TEAL, TEAL_D, TEAL_L = (27, 74, 92), (18, 52, 68), (44, 104, 120)
CREAM, GOLD, RUST = (238, 225, 198), (214, 170, 96), (176, 96, 70)
im = Image.new('RGB', (W, H), TEAL); d = ImageDraw.Draw(im)
def px(m): return int(round(m * PPM * SS))

# the border: a cream band with a running key, a gold line inside it
B0, B1 = 0.07, 0.33
d.rectangle([px(B0), px(B0), W - px(B0), H - px(B0)], fill=CREAM)
d.rectangle([px(B1), px(B1), W - px(B1), H - px(B1)], fill=TEAL)
d.rectangle([px(B1 + 0.035), px(B1 + 0.035), W - px(B1 + 0.035), H - px(B1 + 0.035)], outline=GOLD, width=px(0.016))
def key(x, y, s, flip=False):
    """one turn of a Greek key in a square of side s whose top-left is x, y"""
    t = s / 7.0
    pts = [(0, 6), (0, 1), (6, 1), (6, 5), (2, 5), (2, 3), (4, 3)]
    for a, b in zip(pts, pts[1:]):
        x0, y0 = min(a[0], b[0]), min(a[1], b[1]); x1, y1 = max(a[0], b[0]) + 1, max(a[1], b[1]) + 1
        if flip: x0, y0, x1, y1 = y0, x0, y1, x1
        d.rectangle([x + x0 * t, y + y0 * t, x + x1 * t - 1, y + y1 * t - 1], fill=TEAL_D)
s = px(B1 - B0 - 0.07); off = px(B0 + 0.035)
n = int((W - 2 * off) // s); gap = (W - 2 * off - n * s) / max(n - 1, 1)
for i in range(n):
    key(off + i * (s + gap), off, s); key(off + i * (s + gap), H - off - s, s)
n = int((H - 2 * off - 2 * s) // s); gap = (H - 2 * off - 2 * s - n * s) / (n + 1)
for i in range(n):
    y = off + s + gap + i * (s + gap)
    key(off, y, s, True); key(W - off - s, y, s, True)

# the field: small gold stars, thinly
random.seed(5)
F0 = B1 + 0.11
for _ in range(150):
    x = random.uniform(F0, Wm - F0); y = random.uniform(F0, Hm - F0); r = random.uniform(0.012, 0.02)
    d.polygon([(px(x), px(y - r)), (px(x + r * 0.35), px(y)), (px(x), px(y + r)), (px(x - r * 0.35), px(y))], fill=TEAL_L)
    d.polygon([(px(x - r), px(y)), (px(x), px(y + r * 0.35)), (px(x + r), px(y)), (px(x), px(y - r * 0.35))], fill=TEAL_L)

# the medallion: a long lozenge in cream and gold with a rosette at its heart, and a small one above and below it
def lozenge(cx, cy, rx, ry, fill): d.polygon([(px(cx), px(cy - ry)), (px(cx + rx), px(cy)), (px(cx), px(cy + ry)), (px(cx - rx), px(cy))], fill=fill)
cx, cy = Wm / 2, Hm / 2
lozenge(cx, cy, 0.78, 1.5, CREAM); lozenge(cx, cy, 0.7, 1.38, TEAL_D); lozenge(cx, cy, 0.64, 1.28, GOLD); lozenge(cx, cy, 0.6, 1.2, TEAL)
lozenge(cx, cy, 0.4, 0.8, CREAM); lozenge(cx, cy, 0.34, 0.7, TEAL_D)
for k in range(12):   # the rosette
    an = k * math.pi / 6
    x, y = cx + 0.17 * math.cos(an), cy + 0.17 * math.sin(an)
    d.ellipse([px(x - 0.06), px(y - 0.06), px(x + 0.06), px(y + 0.06)], fill=CREAM if k % 2 == 0 else GOLD)
d.ellipse([px(cx - 0.1), px(cy - 0.1), px(cx + 0.1), px(cy + 0.1)], fill=GOLD); d.ellipse([px(cx - 0.05), px(cy - 0.05), px(cx + 0.05), px(cy + 0.05)], fill=RUST)
for sy in (-1, 1):
    lozenge(cx, cy + sy * 1.78, 0.2, 0.22, CREAM); lozenge(cx, cy + sy * 1.78, 0.13, 0.15, RUST)
    for sx in (-1, 1):   # the corners of the field
        ox, oy = cx + sx * 0.72, cy + sy * 1.72
        lozenge(ox, oy, 0.13, 0.13, GOLD); lozenge(ox, oy, 0.07, 0.07, TEAL_D)
        for t in range(3):
            lozenge(ox - sx * (0.2 + 0.13 * t), oy, 0.035, 0.035, CREAM); lozenge(ox, oy - sy * (0.2 + 0.13 * t), 0.035, 0.035, CREAM)

im = im.resize((W // SS, H // SS), Image.LANCZOS)
# the weave: fine threads both ways, and a little unevenness of dye
import numpy as np
a = np.asarray(im).astype(np.float32)
yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
weave = 1.0 + 0.045 * np.sin(xx * 2.1) * np.sin(yy * 2.1) + 0.03 * np.sin(yy * 0.9)
rng = np.random.default_rng(3)
blot = np.asarray(Image.fromarray((rng.random((a.shape[0] // 40 + 2, a.shape[1] // 40 + 2)) * 255).astype(np.uint8)).resize((a.shape[1], a.shape[0]), Image.BICUBIC)).astype(np.float32) / 255.0
a *= (weave * (0.94 + 0.12 * blot))[..., None]
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out)
print('wrote', out, im.size)
