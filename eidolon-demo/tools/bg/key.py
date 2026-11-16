"""The background kit: each element painted in greys on flat magenta, keyed out to a grey picture with its own alpha,
trimmed to what is painted. The greys are what the composer colours (tools/bg/compose.py).

usage: python3 -I tools/bg/key.py <raw dir> <kit dir>
"""
import os, sys
import numpy as np
from PIL import Image

raw, kit = sys.argv[1], sys.argv[2]
os.makedirs(kit, exist_ok=True)
for fn in sorted(os.listdir(raw)):
    if not fn.endswith('.png'): continue
    im = np.asarray(Image.open(os.path.join(raw, fn)).convert('RGB')).astype(float)
    R, G, B = im[..., 0], im[..., 1], im[..., 2]
    k = (np.minimum(R, B) - G) / 255.0      # (how magenta: the key)
    a = np.clip(1.0 - (k - 0.06) / 0.7, 0.0, 1.0)
    M = np.array([255.0, 0.0, 255.0])
    c = np.clip((im - (1.0 - a)[..., None] * M) / np.maximum(a, 0.04)[..., None], 0, 255)
    L = 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]      # (the greys only: the colour is the composer's)
    a[a < 0.02] = 0.0
    ys, xs = np.nonzero(a > 0.05)
    if len(xs) == 0: print('EMPTY', fn); continue
    m = 12
    x0, x1, y0, y1 = max(0, xs.min() - m), min(im.shape[1], xs.max() + m), max(0, ys.min() - m), min(im.shape[0], ys.max() + m)
    L, a = L[y0:y1, x0:x1], a[y0:y1, x0:x1]
    hh, ww = a.shape; f = max(16, int(0.12 * min(hh, ww)))      # (its edges fade: what was painted to the picture's border never ends on a line)
    ry = np.minimum(np.arange(hh), np.arange(hh)[::-1])[:, None] / f; rx = np.minimum(np.arange(ww), np.arange(ww)[::-1])[None, :] / f
    edge = np.clip(np.minimum(ry, rx), 0, 1); a = a * edge * edge * (3 - 2 * edge)
    img = Image.fromarray(np.dstack([L, a * 255]).astype(np.uint8), 'LA')      # (greys and their alpha only)
    if img.width > 1200: img = img.resize((1200, round(img.height * 1200 / img.width)), Image.LANCZOS)
    img.save(os.path.join(kit, fn))
    print('%-18s %4dx%-4d  painted %.0f%%' % (fn, img.width, img.height, 100 * (a > 0.5).mean()))
