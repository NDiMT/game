"""The fifth level's island in the air, painted by the image model, laid into the plain sky where the game draws it (the
owner, 22/11, of the trial: "the new floating island!! but a little more to the right").

The model was given the plain backdrop with the 3D island laid in where the game draws it (composite_given.jpg, 1080x1920)
and returned the whole picture at its own size (gemini_raw.jpg, 1536x2752): resized whole to 1080x1920 it lies on the
plain one exactly. The island is where the 3D one was laid (island3d_mask.png) or where the repaint differs from the plain
sky, near it; only that (grown 10 px, feathered 10) is taken, moved `dx` pixels to the right, and laid on the plain sky
(design/level5/backdrop_plain_clean.jpg: backdrop_source.jpg at 1080 wide, its middle 1920, its sky's fine lines taken
out) as a difference from the sky it was painted on, so its soft edge leaves no seam where the sky changes along x.

  python3 -I design/level5/isle_painted/lay_in.py <dx px> <out.jpg>
  the game's (22/11): python3 -I design/level5/isle_painted/lay_in.py 40 goguard/backdrop.jpg
  (0: as it was offered, design/level5/isle_painted/backdrop.jpg). 40 px (27 on a 720 screen) is as far as it goes clear
  of the far columns (goguard/far_cols.glb, drawn over the painting): at 48 the leftmost broken one stands before its
  rock's edge, at 76 (0.07 of the width, tried first) the island's edge passes behind it.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

D = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 3: print(__doc__); sys.exit(1)
dx, out = int(sys.argv[1]), sys.argv[2]
bd = Image.open(os.path.join(D, '..', 'backdrop_plain_clean.jpg')).convert('RGB'); W, H = bd.size
g = Image.open(os.path.join(D, 'gemini_raw.jpg')).convert('RGB').resize((W, H), Image.LANCZOS)
b = np.asarray(bd).astype(np.float32); ga = np.asarray(g).astype(np.float32)
m0 = np.asarray(Image.open(os.path.join(D, 'island3d_mask.png')).convert('L')).astype(np.float32) / 255 > 0.3
d = ndimage.gaussian_filter(np.abs(ga - b).mean(-1), 2.0) > 7
box = np.zeros_like(m0); ys, xs = np.nonzero(m0)
box[max(ys.min() - 120, 0):min(ys.max() + 260, H), max(xs.min() - 80, 0):min(xs.max() + 80, W)] = True
m = (m0 | d) & box
lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n + 1)); m = np.isin(lab, 1 + np.argsort(sz)[::-1][:1])
m = ndimage.binary_closing(m, iterations=6); m = ndimage.binary_fill_holes(m); m = ndimage.binary_dilation(m, iterations=10)
k = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))).astype(np.float32)[..., None] / 255
diff = (ga - b) * k
sh = np.zeros_like(diff)
if dx >= 0: sh[:, dx:] = diff[:, :W - dx]
else: sh[:, :W + dx] = diff[:, -dx:]
o = b + sh
Image.fromarray(np.clip(o, 0, 255).round().astype(np.uint8)).save(out, quality=95)
ys, xs = np.nonzero(m); print('island laid in at x %d-%d, y %d-%d (moved %d px right)' % (xs.min() + dx, xs.max() + dx, ys.min(), ys.max(), dx))
