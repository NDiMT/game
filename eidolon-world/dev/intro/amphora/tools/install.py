#!/usr/bin/env python3
# the seven drawings -> the seven panels of the vase: cropped square, one clay for all, the game's red, a sea-coloured sea
import sys, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
S = '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/gem'
CLAY = np.array([231, 150, 88], np.float32); RED = np.array([178, 60, 46], np.float32); SEA = np.array([20, 54, 68], np.float32)
SRC = {1: 'z1', 2: 'z2', 3: 'z3', 4: 'z4', 5: 'z5', 6: 'z6', 7: 'z7', 8: 'z2end'}
def hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; mx = a.max(2); mn = a.min(2); d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60.0
    return h, d / (mx + 1e-6), mx
def one(c):
    a = np.asarray(Image.open(S + '/n/%s.png' % SRC[c]).convert('RGB')).astype(np.float32); H, W = a.shape[:2]
    g = np.median(a[10:110].reshape(-1, 3), axis=0)
    # one clay for all: the ground's own slow unevenness is taken out, its grain and its cracks stay
    isg = np.sqrt(((a - g) ** 2).sum(2)) < 42
    wgt = ndi.gaussian_filter(isg.astype(np.float32), 40) + 1e-3
    low = np.dstack([ndi.gaussian_filter(a[..., k] * isg, 40) / wgt for k in range(3)])
    low = np.where((wgt > 0.25)[..., None], low, g)
    a = a * (CLAY / low)
    a = np.clip(a, 0, 255)
    # the sea: a band of deep sea colour
    sea = (a.max(2) < 70) & (a[..., 2] > a[..., 0] + 7)
    lab, n = ndi.label(ndi.binary_opening(sea, iterations=3)); box = None
    if n:
        sz = ndi.sum(sea, lab, range(1, n + 1)); k = 1 + int(np.argmax(sz))
        if sz[k - 1] > 0.08 * H * W:
            ys, xs = np.where(lab == k); box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
            sc = np.median(a[lab == k], axis=0)
            w = np.clip(1.0 - np.sqrt(((a - sc) ** 2).sum(2)) / 46.0, 0, 1)
            w[:box[1] - 4] = 0
            a = a + w[..., None] * (SEA - sc)
    top = box[1] - 4 if box else H      # above the sea, black is black (not the sea's blue-black)
    dk = np.clip((80 - a[:top].max(2)) / 25.0, 0, 1)[..., None]
    a[:top] = a[:top] * (1 - dk) + a[:top].mean(2, keepdims=True) * dk
    # the added red is the red of her dress in the game
    h, s, v = hsv(a)
    w = np.clip((h - 262) / 14.0, 0, 1) * np.clip((s - 0.18) / 0.14, 0, 1) * (v > 40) + np.clip((8 - h) / 8.0, 0, 1) * (h < 8) * np.clip((s - 0.3) / 0.1, 0, 1) * (v < 150)
    w = np.clip(w, 0, 1)
    pur = np.array([121, 57, 74], np.float32)
    lum = (a * [0.3, 0.5, 0.2]).sum(2) / (pur * [0.3, 0.5, 0.2]).sum()
    a = a * (1 - w[..., None]) + np.clip(RED[None, None] * lum[..., None], 0, 255) * w[..., None]
    # the square that becomes the panel
    if box:
        x0, x1 = box[0] + 8, box[2] - 8; y1 = box[3] - 8; y0 = y1 - (x1 - x0)
    else:
        x0, y0, x1, y1 = 0, 0, W, H
    out = np.empty((y1 - y0, x1 - x0, 3), np.float32); out[:] = CLAY
    rng = np.random.default_rng(c); out += ndi.gaussian_filter(rng.normal(0, 1, out.shape[:2]), 1.2)[..., None] * 3.0
    sy0 = max(0, y0); out[sy0 - y0:, :] = a[sy0:y1, x0:x1]
    if sy0 > y0:      # clay laid above: blend the join
        j = sy0 - y0; ramp = np.linspace(0, 1, 60)[:, None, None]
        fill = np.empty((60, x1 - x0, 3), np.float32); fill[:] = CLAY
        out[j:j + 60] = fill * (1 - ramp) + out[j:j + 60] * ramp
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((2048, 2048), Image.LANCZOS).save(S + '/v/big/panel%d.png' % c)
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((1100, 1100), Image.LANCZOS)
    im.save(S + '/v/panel%d.png' % c); print(c, SRC[c], 'box', box, 'crop', (x0, y0, x1, y1))
np.save(S + '/v/clay.npy', CLAY)
for c in ([int(x) for x in sys.argv[1:]] or range(1, 8)): one(c)
