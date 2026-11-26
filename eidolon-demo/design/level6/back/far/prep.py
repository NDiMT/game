"""the far statues' repaint made ready for water_lift: motes out of the painting and the frame, the painting's slow drift of
colour from the frame (away from the statues) taken out, the green take's haze band made green away from the statues"""
import sys, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, median_filter, binary_dilation
S = sys.argv[1]
E = np.asarray(Image.open(S + '/style_a.png').convert('RGB')).astype(np.float32) / 255
H, W = E.shape[:2]
B = np.asarray(Image.open(S + '/crop_without.png').convert('RGB').resize((W, H), Image.BICUBIC)).astype(np.float32) / 255
G = np.asarray(Image.open(S + '/style_a_green.png').convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
def demote(X):
    L = X.mean(-1); M = median_filter(X, size=(21, 21, 1)); m = (L - M.mean(-1)) > 0.03
    m = binary_dilation(m, iterations=4) & (gaussian_filter(m.astype(np.float32), 6) < 0.25)      # (small dots only)
    return np.where(m[..., None], M, X), m
E, me = demote(E); B, mb = demote(B)
print('motes', me.sum(), mb.sum())
lead = G[..., 1] - np.maximum(G[..., 0], G[..., 2])
thing = binary_dilation(lead < 0.45, iterations=12)
D = E - B
ok = (~thing) & (np.abs(D).max(-1) < 0.07)
w = gaussian_filter(ok.astype(np.float32), 40) + 1e-4
drift = np.stack([gaussian_filter(D[..., c] * ok, 40) for c in range(3)], -1) / w[..., None]
E2 = np.clip(E - drift, 0, 1)
d2 = gaussian_filter(np.abs(E2 - B).max(-1), 2)
yy = np.arange(H)[:, None] * np.ones((1, W))
band = (yy < 640) & (d2 < 0.03) & (lead < 0.45)
G2 = G.copy(); G2[band] = [0.0, 1.0, 0.0]
print('band cleared', band.sum())
Image.fromarray((E2 * 255).round().astype(np.uint8)).save(S + '/lift_edit.png')
Image.fromarray((B * 255).round().astype(np.uint8)).save(S + '/lift_base.png')
Image.fromarray((G2 * 255).round().astype(np.uint8)).save(S + '/lift_green.png')
for (y0, y1, x0, x1, n) in [(650, 1000, 30, 120, 'water left'), (600, 1100, 1100, 1200, 'between statues'), (50, 300, 100, 1500, 'sky')]:
    print(n, np.percentile(d2[y0:y1, x0:x1], [50, 95]).round(3))
