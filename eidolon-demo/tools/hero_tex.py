"""Reads the heroine's generated texture and writes what the game needs from it, as a small data picture.
usage: python3 hero_tex.py <in 4096 png> <out data png> [size]
The shader (wrap_lift) only wants three things: where the cloth is, and how light the folds are in the cloth and in
the marble. Each is smoothed on its own side of the cloth's edge and written to a channel:
  R  folds of the cloth   (light / mean light of the cloth, halved), carried a little way past the edge
  G  folds of the marble  (the same for the marble)
  B  signed distance to the edge of the cloth: 0.5 on the edge, more inside the cloth, less on the marble
hero_opt.py carries these into the vertices of the model; the picture itself does not ship."""
import sys, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, grey_closing, distance_transform_edt, label
src, out = sys.argv[1], sys.argv[2]; size = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255.0
r, g, b = im[..., 0], im[..., 1], im[..., 2]
lum = 0.3 * r + 0.55 * g + 0.15 * b
m0 = np.clip((r - b - 0.08) / 0.12, 0.0, 1.0)
mb = gaussian_filter(m0, 5.0, mode="wrap") > 0.5                               # the cloth, its edge drawn smooth
for kind in (True, False):                                                      # specks of one kind inside the other are stray paint
    lab, n = label(mb == kind)
    if n:
        sizes = np.bincount(lab.ravel()); small = sizes < 260; small[0] = False
        mb = np.where(small[lab], not kind, mb)
mf = mb.astype(np.float32)
def side(l, mask):                                                              # light and dark, smoothed without crossing the edge
    res = None; sure = None                                                     # and carried outwards, more loosely the further out
    for sigma in (4.0, 14.0, 40.0):
        w = gaussian_filter(mask, sigma, mode="wrap"); v = gaussian_filter(l * mask, sigma, mode="wrap") / np.maximum(w, 1e-4)
        if res is None: res, sure = v, w > 0.08
        else: res = np.where(sure, res, v); sure = sure | (w > 0.08)
    return res
lum_s = np.where(mb, 1.0, lum); lum_s = np.where(mb, lum, grey_closing(lum_s, size=(21, 21)))   # thin dark scribbles on the marble close up
lc = side(lum, mf); ls = side(lum_s, 1.0 - mf)
lc_mean = float((lc * mf).sum() / mf.sum()); ls_mean = float((ls * (1 - mf)).sum() / (1 - mf).sum())
sd = distance_transform_edt(mb) - distance_transform_edt(~mb)                    # in pixels of the 4096 picture
data = np.stack([np.clip(lc / lc_mean, 0.5, 1.5) * 0.5, np.clip(ls / ls_mean, 0.5, 1.5) * 0.5, 0.5 + 0.5 * np.clip(sd / 48.0, -1.0, 1.0)], axis=2)
Image.fromarray((np.clip(data, 0, 1) * 255 + 0.5).astype(np.uint8)).resize((size, size), Image.BILINEAR).save(out)
print("DATA cloth share %.3f, mean light of cloth %.3f, of marble %.3f" % (mf.mean(), lc_mean, ls_mean))
