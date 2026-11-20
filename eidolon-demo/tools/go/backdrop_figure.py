"""A figure painted alone on flat green (Gemini: "isolated on a perfectly flat, uniform pure green background") cut out
and laid into a level's backdrop, far off: its top at a height of the backdrop, its lower part going into the haze over
the sea at another, under a breath of the haze; the rest of the backdrop as it is. The third level's goddess (the owner,
19/11: "make Aphrodite in Gemini, further back in the background, like low poly but big; don't spoil the background"):

  python3 -I tools/go/backdrop_figure.py design/level3/goddess_lowpoly.png design/level3/backdrop_plain.jpg \\
      gomilos/backdrop.jpg 0.25 0.085 0.335 0.2

usage: backdrop_figure.py <figure on green> <backdrop> <out> <centre x> <top y> <haze band y> [haze, 0.22] [dark, 1]
                          [--onto <finished backdrop> x0,y0,x1,y1]
(x and y as shares of the backdrop's width and height; the figure's hips, 0.6 of its height, go into the band)

--onto: the figure laid on the plain backdrop, then only the box about her (pixels, its edge feathered) set into a
finished backdrop, so what was painted into that one elsewhere (the third level's far rocks) stays as it is. The third
level's painted goddess, a little bigger and lower (the owner, 20/11: "Aphrodite a little bigger and a little lower"):

  python3 -I tools/go/backdrop_figure.py design/level3/goddess_painted.png design/level3/backdrop_plain.jpg \
      gomilos/backdrop.jpg 0.25 0.105 0.395 0.2 1 --onto design/level3/backdrop_whole.jpg 70,130,458,1240
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
onto = None
if '--onto' in sys.argv:
    k = sys.argv.index('--onto'); onto = (sys.argv[k + 1], [int(v) for v in sys.argv[k + 2].split(',')]); del sys.argv[k:k + 3]
src, bd, out, cx, top, band = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5]), float(sys.argv[6])
haze = float(sys.argv[7]) if len(sys.argv) > 7 else 0.22
dark = float(sys.argv[8]) if len(sys.argv) > 8 else 1.0      # (her tone: under 1 darker than painted, a cool slate in her shade, so she stands out of the light sky; the owner, 19/11: "she must not get lost in the background, darker")
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
sp = g - np.maximum(r, b)      # (how green: the ground, not her)
al = 1.0 - np.clip((sp - 12.0) / 50.0, 0.0, 1.0)
g2 = np.where(sp > 0, np.maximum(r, b), g)      # (no green on her edges)
a[..., 1] = g2
ys, xs = np.nonzero(al > 0.5); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
print('her bbox in the painting', x0, y0, x1, y1)
# her hips: where the drapery's top is, about 0.62 of her height from her head (knees at the bottom of the painting)
B = Image.open(bd).convert('RGB'); W, H = B.size
hip_f = 0.60
scale = ((band - top) * H) / (hip_f * (y1 - y0))
im = Image.fromarray(np.dstack([a, al * 255]).astype(np.uint8), 'RGBA').crop((x0, y0, x1 + 1, y1 + 1))
im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
px, py = int(cx * W - im.width / 2), int(top * H)
bg = np.asarray(B).astype(np.float32)
st = np.asarray(im).astype(np.float32)
h_, w_ = st.shape[:2]
ya, yb = max(py, 0), min(py + h_, H); xa, xb = max(px, 0), min(px + w_, W)
s = st[ya - py:yb - py, xa - px:xb - px]; reg = bg[ya:yb, xa:xb]
yy = (np.arange(ya, yb) / H)[:, None]
k = np.clip(haze + (1.0 - haze) * np.clip((yy - (band - 0.07)) / 0.085, 0.0, 1.0), 0.0, 1.0)      # (the haze over her, thickening down into the band till she is gone in it)
fig = s[..., :3]
if dark < 1.0:
    lum = fig.mean(axis=2, keepdims=True) / 255.0
    fig = fig * dark * np.array([0.95, 0.96, 1.04]) * (0.85 + 0.15 * lum)      # (darker, a little cooler, its shade most)
col = fig * (1.0 - k[..., None]) + reg * k[..., None]
alp = s[..., 3:4] / 255.0
bg[ya:yb, xa:xb] = reg * (1.0 - alp) + col * alp
if onto is not None:      # (only the box about her, into the finished backdrop)
    fin = np.asarray(Image.open(onto[0]).convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32)
    x0b, y0b, x1b, y1b = onto[1]
    m = np.zeros((H, W), np.float32); m[y0b:y1b, x0b:x1b] = 1.0
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))).astype(np.float32) / 255.0
    bg = fin * (1.0 - m[..., None]) + bg * m[..., None]
Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).save(out, quality=95)
print('laid at', px, py, 'size', w_, h_)
