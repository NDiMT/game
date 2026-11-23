"""Each lamp's flame mirrored in the water under it as a small warm glint, a soft upright streak (flames on still water),
laid into the card's water under the lamps.
  python3 -I lamp_glints.py <card (the lamps alone)> <card with images> <out>"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import label, gaussian_filter
src, refl, out = sys.argv[1:4]
c = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255
r = np.asarray(Image.open(refl).convert('RGBA')).astype(np.float32) / 255
H, W = c.shape[:2]
fl = (c[..., 0] > 0.97) & (c[..., 1] > 0.9) & (c[..., 3] > 0.3)      # (the flames: yellow white; the lit clay is orange)
lab, n = label(fl); s = np.bincount(lab.ravel()); s[0] = 0
solid = c[..., 3] > 0.9
lamps, nl = label(solid, structure=np.ones((3, 3)))
g = np.zeros((H, W), np.float32)
yy, xx = np.mgrid[0:H, 0:W]
for k in range(1, n + 1):
    if s[k] < 150: continue
    ys, xs = np.nonzero(lab == k); fx, fy = xs.mean(), ys.mean()
    # its lamp: the solid part it lies in or nearest under it; the lamp's underside about the flame
    cand = lamps[ys.max():min(H, ys.max() + 40), int(fx)]
    cand = cand[cand > 0]
    li = int(cand[0]) if len(cand) else int(np.bincount(lamps[ys, xs][lamps[ys, xs] > 0]).argmax())
    m = lamps == li
    band = m[:, max(0, int(fx) - 10):int(fx) + 11]
    bot = np.nonzero(band.any(1))[0].max(); yr = 2 * bot - fy
    g = np.maximum(g, 0.62 * np.exp(-((xx - fx) ** 2) / (2 * 2.6 ** 2) - ((yy - yr) ** 2) / (2 * 10.0 ** 2)))
    g = np.maximum(g, 0.2 * np.exp(-((xx - fx) ** 2 + (yy - yr) ** 2) / (2 * 11.0 ** 2)))
    print('flame', round(fx), round(fy), 'lamp', li, 'underside', bot, 'glint at', round(yr))
col = np.array([1.0, 0.84, 0.6], np.float32)
ga = g * (1 - c[..., 3])      # (under the lamps, never over them)
oa = ga + r[..., 3] * (1 - ga)
oc = (col * ga[..., None] + r[..., :3] * (r[..., 3] * (1 - ga))[..., None]) / np.maximum(oa, 1e-4)[..., None]
# the lamps themselves stay on top as they are
oa2 = c[..., 3] + oa * (1 - c[..., 3]); oc2 = (c[..., :3] * c[..., 3:4] + oc * (oa * (1 - c[..., 3]))[..., None]) / np.maximum(oa2, 1e-4)[..., None]
Image.fromarray(np.round(np.dstack([np.clip(oc2, 0, 1), np.clip(oa2, 0, 1)]) * 255).astype(np.uint8), 'RGBA').save(out)
