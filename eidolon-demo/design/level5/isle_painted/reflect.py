"""The painted island's image in the water, painted into the backdrop under it (the owner, 23/11: "on the floating island
in 5, shouldn't a reflection show below too?"; then "yes" to a faint one just under its rock's point). The 3D island's
own image falls on the painted rock or wholly behind the level (see CLAUDE.md), so the image is the painting's: the
island (where the backdrop differs from the plain sky) turned over about a line a little under its point, faint,
rippled and softened, given to the sky's colour there. The sea lets the backdrop through where it lies open, so it shows
in the water between the island's point and the walk, and the level hides the rest, as it would.

  python3 -I design/level5/isle_painted/reflect.py <backdrop without it> <out.jpg> [gap px] [strength] [fade px] [sky] [dark]
  the game's (23/11; the owner of a darker one: "the reflection is too dark"):
  python3 -I design/level5/isle_painted/reflect.py design/level5/isle_painted/backdrop_noreflect.jpg goguard/backdrop.jpg 24 0.8 700 0.5 1.0
"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

D = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 3: print(__doc__); sys.exit(1)
src, out = sys.argv[1], sys.argv[2]
gap = float(sys.argv[3]) if len(sys.argv) > 3 else 36.0
k = float(sys.argv[4]) if len(sys.argv) > 4 else 0.55
fade = float(sys.argv[5]) if len(sys.argv) > 5 else 260.0
sky = float(sys.argv[6]) if len(sys.argv) > 6 else 0.28      # (how much of the sky's colour it is given)
dark = float(sys.argv[7]) if len(sys.argv) > 7 else 0.9      # (how much darker than the island)
B = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
P = np.asarray(Image.open(os.path.join(D, '..', 'backdrop_plain_clean.jpg')).convert('RGB').resize((B.shape[1], B.shape[0]), Image.LANCZOS)).astype(np.float32)
H, W = B.shape[:2]
d = ndimage.gaussian_filter(np.abs(B - P).mean(-1), 1.5)
M = np.clip((d - 4.0) / 10.0, 0, 1)
lab, n = ndimage.label(M > 0.5)
big = np.argmax(ndimage.sum(M > 0.5, lab, range(1, n + 1))) + 1      # (the island, the largest)
isl = ndimage.binary_dilation(lab == big, iterations=6)
M = M * ndimage.gaussian_filter(isl.astype(np.float32), 3.0)
ys, xs = np.nonzero(M > 0.5)
y_tip = ys.max(); x_tip = int(np.median(xs[ys > y_tip - 6]))
yw = y_tip + gap * 0.5      # (the water under its point: the image of its point lies `gap` under it)
print('island rows', ys.min(), '-', y_tip, 'point at x', x_tip, 'water line', yw)
yy = np.arange(H, dtype=np.float32)
src_y = 2.0 * yw - yy      # (each row below the line shows the row as far above it)
rip = 2.6 * np.sin(yy * 0.31) + 1.4 * np.sin(yy * 0.093 + 1.3)      # (the water's small waves, along each row)
R = np.zeros_like(B); A = np.zeros((H, W), np.float32)
xx = np.arange(W, dtype=np.float32)
for y in range(int(np.ceil(yw)), H):
    sy = src_y[y]
    if sy < 0: break
    s0 = int(np.floor(sy)); t = sy - s0
    if s0 + 1 >= H: continue
    row = B[s0] * (1 - t) + B[s0 + 1] * t; mrow = M[s0] * (1 - t) + M[s0 + 1] * t
    sx = np.clip(xx - rip[y], 0, W - 1); i0 = np.floor(sx).astype(int); i1 = np.minimum(i0 + 1, W - 1); u = sx - i0
    R[y] = row[i0] * (1 - u[:, None]) + row[i1] * u[:, None]
    A[y] = (mrow[i0] * (1 - u) + mrow[i1] * u) * k * np.exp(-(y - yw) / fade)
R = np.stack([ndimage.gaussian_filter(R[..., c] * A, (2.6, 1.0)) for c in range(3)], -1) / np.maximum(ndimage.gaussian_filter(A, (2.6, 1.0)), 1e-3)[..., None]
A = ndimage.gaussian_filter(A, (2.6, 1.0))
R = R * (1.0 - sky) + P * sky      # (given a little to the sky's colour there, and darker than the island: an image in water)
R = R * dark
O = B * (1 - A[..., None]) + R * A[..., None]
Image.fromarray(np.clip(O, 0, 255).round().astype(np.uint8)).save(out, quality=95)
print('wrote', out, 'image rows', int(yw), '-', int(min(H, yw + 4 * fade)))
