"""The fifth level's colonnade standing in the sea in place of the island in the air (the owner, 23/11: "instead of the
island, can we put the triptych of the island's columns in the water, and another 2 random columns?"; "3D with facets";
of the repaint with facets beside the faceted light laid on the painting: "make them again and not so subdued", "the
second one I liked").

The plain sky (design/level5/backdrop_plain_clean.jpg) given to the image model with the island's colonnade
(colonnade_ref.png, cut from the backdrop with the island) for its look (painting_prompt.txt -> painting_gemini.jpg); a
square crop about the new things (facets_crop.txt) repainted by it as finely faceted low-poly marble (facets_prompt.txt
-> facets_gemini.jpg), taken as it is; only what it adds to the plain sky is laid on it, as a difference, feathered, the
lone column at the left moved (-60, -105) and the one at the right (-22, -262), backdrop pixels, clear of the gate and of
the rock before them in the game.

  python3 -I design/level5/columns_painted/lay_in.py goguard/backdrop.jpg
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
D = os.path.dirname(os.path.abspath(__file__))
out_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(D, 'backdrop.jpg')
plain = np.asarray(Image.open(os.path.join(D, '..', 'backdrop_plain_clean.jpg')).convert('RGB')).astype(np.float32)
X0, Y0, sz, _ = [int(v) for v in open(os.path.join(D, 'facets_crop.txt')).read().split(',')]
gem = np.asarray(Image.open(os.path.join(D, 'facets_gemini.jpg')).convert('RGB').resize((sz, sz), Image.LANCZOS)).astype(np.float32)
full = plain.copy(); full[Y0:Y0 + sz, X0:X0 + sz] = gem
d = ndimage.gaussian_filter(np.abs(full - plain).mean(-1), 2.0)
reg = np.zeros(d.shape, bool); reg[Y0:Y0 + sz, X0:X0 + sz] = True
m = ndimage.binary_opening((d > 10) & reg, iterations=2)
lab, n = ndimage.label(m); s = ndimage.sum(m, lab, range(1, n + 1))
H, W = m.shape; out = plain.copy()
MOVE = {'L': (-60, -105), 'R': (-22, -262), 'C': (0, 0)}
def group(k):
    cx = np.nonzero(lab == k)[1].mean()
    return 'L' if cx < 200 else ('R' if cx > 520 else 'C')
parts = [k for k in range(1, n + 1) if s[k - 1] > 300]
for g, (dx, dy) in MOVE.items():
    mg = np.isin(lab, [k for k in parts if group(k) == g])
    mg = ndimage.binary_dilation(ndimage.binary_fill_holes(ndimage.binary_closing(mg, iterations=4)), iterations=6)
    kk = np.asarray(Image.fromarray((mg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8))).astype(np.float32)[..., None] / 255
    diff = (full - plain) * kk; sh = np.zeros_like(diff)
    y0, y1, x0, x1 = max(0, dy), min(H, H + dy), max(0, dx), min(W, W + dx)
    sh[y0:y1, x0:x1] = diff[y0 - dy:y1 - dy, x0 - dx:x1 - dx]
    out += sh
Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8)).save(out_path, quality=93)
print('laid', out_path)
