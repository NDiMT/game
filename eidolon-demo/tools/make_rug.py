"""Weaves the rug of the first court: a long deep-teal carpet with a meander border and, along it, the five figures
of the row of statues. The middle one, in front of her empty plinth, has one arm raised: that is the stance she
has to take.

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

# the five figures. Each is drawn upright in its own frame (u across, v up, metres) and laid on the rug with its
# head towards the statues (west = the picture's x = 0) and its feet towards the east
def lay(cy, u, v):   # figure frame -> picture pixels; cy: where its middle line lies along the rug
    return (px(2.08 - v), px(cy + u))
def poly(cy, pts, fill): d.polygon([lay(cy, u, v) for u, v in pts], fill=fill)
def limb(cy, pts, w, fill):
    for a, b in zip(pts, pts[1:]):
        (x0, y0), (x1, y1) = lay(cy, *a), lay(cy, *b)
        d.line([x0, y0, x1, y1], fill=fill, width=px(w))
    for p in pts:
        x, y = lay(cy, *p); r = px(w) / 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=fill)
def figure(cy, pose):
    lean = 0.07 if pose in ('mourn', 'bow') else 0.0
    # the skirt and body, wound in cloth
    poly(cy, [(-0.17, 1.06), (0.17, 1.06), (0.13, 0.74), (0.2, 0.3), (0.25, 0.0), (-0.25, 0.0), (-0.2, 0.3), (-0.13, 0.74)], CREAM)
    for k in range(5):   # the bands of her wrap
        v0 = 0.12 + 0.19 * k
        poly(cy, [(-0.26, v0), (0.26, v0 + 0.11), (0.26, v0 + 0.15), (-0.26, v0 + 0.04)], GOLD)
    poly(cy, [(-0.27, 1.07), (-0.165, 1.07), (-0.125, 0.74), (-0.195, 0.3), (-0.245, 0.0), (-0.3, 0.0)], TEAL)   # trim the bands to the body
    poly(cy, [(0.27, 1.07), (0.165, 1.07), (0.125, 0.74), (0.195, 0.3), (0.245, 0.0), (0.3, 0.0)], TEAL)
    # the head, wrapped
    hx, hy = lean, 1.22 - lean * 0.4
    x, y = lay(cy, hx, hy); r = px(0.115)
    d.ellipse([x - r * 1.12, y - r * 0.92, x + r * 1.12, y + r * 0.92], fill=CREAM)
    poly(cy, [(-0.05 + hx * 0.5, 1.02), (0.05 + hx * 0.5, 1.02), (0.06 + hx, 1.14), (-0.06 + hx, 1.14)], CREAM)
    limb(cy, [(hx - 0.1, hy + 0.035), (hx + 0.1, hy - 0.02)], 0.022, GOLD)
    # the arms
    a = 0.062
    if pose == 'calm':
        limb(cy, [(-0.17, 1.02), (-0.24, 0.78), (-0.25, 0.52)], a, CREAM); limb(cy, [(0.17, 1.02), (0.24, 0.78), (0.25, 0.52)], a, CREAM)
    elif pose == 'pray':
        limb(cy, [(-0.17, 1.02), (-0.25, 0.82), (-0.03, 0.93)], a, CREAM); limb(cy, [(0.17, 1.02), (0.25, 0.82), (0.03, 0.93)], a, CREAM)
    elif pose == 'reach':
        limb(cy, [(-0.17, 1.02), (-0.24, 0.78), (-0.25, 0.52)], a, CREAM)
        limb(cy, [(0.17, 1.03), (0.3, 1.25), (0.33, 1.58)], a, CREAM)
        x, y = lay(cy, 0.33, 1.7)   # a small sun over the raised hand
        for k in range(8):
            an = k * math.pi / 4
            d.line([x + px(0.05) * math.cos(an), y + px(0.05) * math.sin(an), x + px(0.095) * math.cos(an), y + px(0.095) * math.sin(an)], fill=GOLD, width=px(0.016))
        d.ellipse([x - px(0.032), y - px(0.032), x + px(0.032), y + px(0.032)], fill=GOLD)
    elif pose == 'mourn':
        limb(cy, [(-0.17, 1.02), (-0.24, 0.9), (-0.04 + hx, 1.17)], a, CREAM); limb(cy, [(0.17, 1.02), (0.25, 0.9), (0.1 + hx, 1.17)], a, CREAM)
    elif pose == 'bow':
        limb(cy, [(-0.17, 1.02), (-0.22, 0.84), (0.1, 0.98)], a, CREAM); limb(cy, [(0.17, 1.02), (0.22, 0.84), (-0.1, 0.98)], a, CREAM)
    # the plinth it stands on
    poly(cy, [(-0.3, 0.0), (0.3, 0.0), (0.3, -0.05), (-0.3, -0.05)], GOLD); poly(cy, [(-0.34, -0.05), (0.34, -0.05), (0.34, -0.1), (-0.34, -0.1)], CREAM)
for i, pose in enumerate(['calm', 'pray', 'reach', 'mourn', 'bow']):
    figure(0.55 + 0.9 * i, pose)     # 0.9 m apart, as the plinths are

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
