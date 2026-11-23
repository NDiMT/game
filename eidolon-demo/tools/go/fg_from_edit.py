"""A thing before the eye taken out of the image model's edit of a frame of the game (the owner, 23/11: "I want other
blurred things in front, in 4 and in 5"; of figures painted alone and laid on: "they don't look natural and don't match
the colours"). The model is given a still of the level (the game's own frame, 720x1280) and asked to add one thing at a
lower corner, near the eye and out of focus, lit and coloured as the scene is; it returns the whole frame stretched to its
own size, so resized back it lies on the still. Where it differs from the still, in the corner's box, is the thing: its
cover from how much it differs, its colour unmixed from the still behind it (so laid on a frame a little moved, no ghost
of the old one shows at its soft edge).

  python3 -I tools/go/fg_from_edit.py <still.png> <edit.png> <out.png> <x0,y0,x1,y1 box at 720x1280> [lo hi]
  prints where to lay it: left, top over the picture's foot, width (at 720 wide)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def main(still, edit, out, box, lo=10.0, hi=30.0):
    b = np.asarray(Image.open(still).convert('RGB')).astype(np.float32)
    H, W = b.shape[:2]
    g = np.asarray(Image.open(edit).convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32)
    d = np.abs(g - b).max(-1)
    d = ndimage.gaussian_filter(d, 1.5)
    a = np.clip((d - lo) / (hi - lo), 0.0, 1.0); a = a * a * (3 - 2 * a)
    x0, y0, x1, y1 = box
    m = np.zeros_like(a); m[y0:y1, x0:x1] = 1.0
    m = ndimage.gaussian_filter(m, 8.0)      # (the box's own edge soft)
    a = a * m
    core = ndimage.binary_opening(a > 0.5, iterations=2)      # (specks of the model's repainting away from the thing left out)
    lab, n = ndimage.label(core)
    if n:
        sizes = ndimage.sum(core, lab, range(1, n + 1)); keep = np.isin(lab, 1 + np.nonzero(sizes >= 0.02 * sizes.max())[0])
        near = ndimage.binary_dilation(keep, iterations=14)
        a = a * ndimage.gaussian_filter(near.astype(np.float32), 4.0)
    filled = ndimage.binary_fill_holes(a > 0.35)      # (where the thing's own colour is the still's, it does not differ: holes in it, filled)
    a = np.maximum(a, ndimage.gaussian_filter(filled.astype(np.float32), 1.2) * (a > 0.0))
    F = (g - b * (1.0 - a[..., None])) / np.maximum(a, 0.05)[..., None]      # (its own colour, the still behind it unmixed)
    F = np.clip(F, 0, 255)
    ys, xs = np.nonzero(a > 0.01)
    if len(ys) == 0: print('nothing found'); return
    X0, X1, Y0, Y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = np.dstack([F, a * 255])[Y0:Y1, X0:X1]
    Image.fromarray(rgba.round().astype(np.uint8), 'RGBA').save(out)
    k = 720.0 / W
    print('lay at: left %.0f, top over foot %.0f, width %.0f  (box %d,%d-%d,%d)' % (X0 * k, (H - Y0) * k, (X1 - X0) * k, X0, Y0, X1, Y1))


if __name__ == '__main__':
    v = sys.argv[1:]
    if len(v) < 4: print(__doc__); sys.exit(1)
    main(v[0], v[1], v[2], [int(x) for x in v[3].split(',')], *(float(x) for x in v[4:6]))
