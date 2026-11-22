"""A figure before the eye, blurred, dark against the light, for a level's lower corners (the fifth level's, the owner,
22/11: "in the fifth I don't like the blurred columns below, put something else"): painted alone by the image model on
flat green (design/level5/fg/: its prompt, the picture on white, then the same on green), cut out, brought into the
plum of the level's things before the eye (its marble's light and shade kept, from `dark` to `light`), and blurred as a
thing close to the eye is (the colour blurred with its cover, so no dark rim comes in from the cut).

usage: python3 -I tools/go/fg_figure.py <figure on green> <out png> <height px> <blur px> [dark hex] [light hex] [keep]
  keep: the share of the figure's height kept from its top (the rest cut off; it runs on below the picture's edge)

The fifth level's (laid on in ch1.gd, _ivgd_fg):
  python3 -I tools/go/fg_figure.py design/level5/fg/youth_mirror_green.png goguard/fg_youth.png 1100 9
  python3 -I tools/go/fg_figure.py design/level5/fg/hand_mirror_green.png goguard/fg_hand.png 1100 9 46384f a8949f 0.86
"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter


def main(src, out, height, blur, dark='463a4f', light='a8949f', keep=1.0):
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    sp = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    al = 1.0 - np.clip((sp - 12.0) / 50.0, 0.0, 1.0)
    a[..., 1] = np.where(sp > 0, np.maximum(a[..., 0], a[..., 2]), a[..., 1])      # (no green on its edges)
    ys, xs = np.nonzero(al > 0.5)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    y1 = y0 + int((y1 - y0) * keep)
    a, al = a[y0:y1 + 1, x0:x1 + 1], al[y0:y1 + 1, x0:x1 + 1]
    L = (a @ np.array([0.3, 0.55, 0.15], np.float32)) / 255.0
    lo = np.array([int(dark[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
    hi = np.array([int(light[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
    c = lo + (hi - lo) * np.clip(L, 0, 1)[..., None] ** 0.9
    pad = int(blur * 3) + 2
    H, W = al.shape
    cp = np.zeros((H + 2 * pad, W + 2 * pad, 3), np.float32); ap = np.zeros((H + 2 * pad, W + 2 * pad), np.float32)
    cp[pad:pad + H, pad:pad + W] = c * al[..., None]; ap[pad:pad + H, pad:pad + W] = al
    sc = height / float(H + 2 * pad); size = (max(1, int((W + 2 * pad) * sc)), int(height))
    def bl(ch): return gaussian_filter(np.asarray(Image.fromarray(ch.astype(np.float32), 'F').resize(size, Image.LANCZOS)).astype(np.float32), blur)
    A = np.clip(bl(ap), 0, 1)
    C = np.stack([bl(cp[..., i]) for i in range(3)], -1) / np.maximum(A, 1e-3)[..., None]
    o = np.dstack([np.clip(C, 0, 255), A * 255]).round().astype(np.uint8)
    Image.fromarray(o, 'RGBA').save(out)
    print('figure', src, '->', out, size, 'blur', blur)


if __name__ == '__main__':
    v = sys.argv[1:]
    if len(v) < 4: print(__doc__); sys.exit(1)
    main(v[0], v[1], int(v[2]), float(v[3]), *(v[4:6] if len(v) > 5 else []), **({'keep': float(v[6])} if len(v) > 6 else {}))
