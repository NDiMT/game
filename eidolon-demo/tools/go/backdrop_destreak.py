"""Horizontal streaks taken out of a painted backdrop's sky (the owner, 22/11, of the fourth level: "some strange lines
behind, in the sky, in the background": the image model had painted its haze in fine horizontal lines, long and faint,
which read on a phone as lines across the sky).

A streak is what is left of a row against its neighbours above and below (the picture less its blur along y), held
along the row (that residue blurred along x): taken out in a few passes, the soft clouds, the sun and every shape that
is not a long thin horizontal line stay as they were. Only the sky changes: from the top down to `sky_to` (a share of
the height) in full, fading out by `fade_to`; and nothing within the mask, if one is given (the thing painted there,
grown and feathered), so its own lines (an eyelid, a lip) are kept.

  python3 -I tools/go/backdrop_destreak.py <in> <out> <sky_to> <fade_to> [mask png]

The fourth level's (its plate and its head painting both, then backdrop_haze.py with the two):
  python3 -I tools/go/backdrop_destreak.py design/level4/game/backdrop_plate.jpg design/level4/game/backdrop_plate_clean.jpg 0.40 0.47 design/level4/game/head_mask.png
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter1d

PASSES = [(10, 16), (6, 16), (4, 16)]      # (blur along y, then the residue's along x, in pixels at 1920 high)


def destreak(a):
    o = a.copy()
    for sy, sx in PASSES:
        for c in range(3):
            ch = o[..., c]
            res = ch - gaussian_filter1d(ch, sy, axis=0, mode='reflect')
            o[..., c] = ch - gaussian_filter1d(res, sx, axis=1, mode='reflect')
    return o


if __name__ == '__main__':
    if len(sys.argv) < 5: print(__doc__); sys.exit(1)
    src, out, sky_to, fade_to = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
    im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(np.float32); H, W = a.shape[:2]
    y = (np.arange(H) / H)[:, None, None]
    w = np.clip((fade_to - y) / max(fade_to - sky_to, 1e-6), 0, 1) * np.ones((1, W, 1))
    if len(sys.argv) > 5:
        m = Image.open(sys.argv[5]).convert('L').resize((W, H)).filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.GaussianBlur(14))
        w = w * (1 - np.asarray(m).astype(np.float32)[..., None] / 255.0)
    o = a * (1 - w) + destreak(a) * w
    Image.fromarray(np.clip(o, 0, 255).round().astype(np.uint8)).save(out, quality=95)
    print('destreaked', src, '->', out, '(sky to %.2f, fading out by %.2f)' % (sky_to, fade_to))
