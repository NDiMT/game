"""A thing before the eye taken out of the image model's edit of a frame of the game (the owner, 23/11: "I want other
blurred things in front, in 4 and in 5"; of figures painted alone and laid on: "they don't look natural and don't match
the colours"). The model is given a still of the level (the game's own frame, 720x1280) and asked to add one thing at a
lower corner, near the eye and out of focus, lit and coloured as the scene is; it returns the whole frame stretched to its
own size, so resized back it lies on the still. Where it differs from the still, in a box at the corner, is the thing:
its cover from how much it differs (so its own soft, out-of-focus edge is kept), its colour unmixed from the still behind
it (so laid on a frame a little moved, no ghost of the old one shows at its edge). With --green, the model's own take of
the same edit with the water made flat green (water_green_prompt.txt) gives the thing's body, made solid within.
Keep the box clear of the level: what the model repainted of the level near the thing comes along with it as a ghost
(in level 4, she came twice). Level 5's column was cut with a polygon and a rule at the capital (only the light marble
where it meets the level's dark rocks), done by hand in the scratchpad; this is the plain box case.

  python3 -I tools/go/fg_from_edit.py <still.png> <edit.png> <out.png> <x0,y0,x1,y1 box at 720x1280> [--green g.png] [lo hi]
  prints where to lay it: left, top over the picture's foot, width (at 720 wide)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def main(still, edit, out, box, green=None, lo=9.0, hi=31.0):
    b = np.asarray(Image.open(still).convert('RGB')).astype(np.float32)
    H, W = b.shape[:2]
    g = np.asarray(Image.open(edit).convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32)
    x0, y0, x1, y1 = box
    inbox = np.zeros((H, W), bool); inbox[y0:y1, x0:x1] = True
    d = ndimage.gaussian_filter(np.abs(g - b).max(-1), 1.2)
    a = np.clip((d - lo) / (hi - lo), 0.0, 1.0) * inbox
    body = ndimage.binary_fill_holes(ndimage.binary_closing(a > 0.22, iterations=6)) & inbox
    if green:
        gg = np.asarray(Image.open(green).convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32)
        sp = gg[..., 1] - np.maximum(gg[..., 0], gg[..., 2])
        body |= (1.0 - np.clip((sp - 10.0) / 45.0, 0, 1) > 0.5) & inbox
    lab, n = ndimage.label(body)
    if n:
        sizes = ndimage.sum(body, lab, range(1, n + 1)); body = np.isin(lab, 1 + np.nonzero(sizes >= 0.2 * sizes.max())[0])
    inner = ndimage.gaussian_filter(ndimage.binary_erosion(body, iterations=4).astype(np.float32), 2.0)
    near = ndimage.gaussian_filter(ndimage.binary_dilation(body, iterations=10).astype(np.float32), 2.0)
    a = np.maximum(a * near, inner) * ndimage.gaussian_filter(inbox.astype(np.float32), 1.5)
    F = np.clip((g - b * (1.0 - a[..., None])) / np.maximum(a, 0.06)[..., None], 0, 255)      # (its own colour, the still behind it unmixed)
    ys, xs = np.nonzero(a > 0.02)
    if len(ys) == 0: print('nothing found'); return
    X0, X1, Y0, Y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    Image.fromarray(np.dstack([F, a * 255])[Y0:Y1, X0:X1].round().astype(np.uint8), 'RGBA').save(out)
    k = 720.0 / W
    print('lay at: left %.0f, top over foot %.0f, width %.0f  (box %d,%d-%d,%d)' % (X0 * k, (H - Y0) * k, (X1 - X0) * k, X0, Y0, X1, Y1))


if __name__ == '__main__':
    v = sys.argv[1:]
    gr = None
    if '--green' in v: i = v.index('--green'); gr = v[i + 1]; v = v[:i] + v[i + 2:]
    if len(v) < 4: print(__doc__); sys.exit(1)
    main(v[0], v[1], v[2], [int(x) for x in v[3].split(',')], gr, *(float(x) for x in v[4:6]))
