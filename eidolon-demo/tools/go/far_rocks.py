"""Strange rocks painted alone on green (design/level3/far_rocks.png, Gemini) cut out one by one and laid very far off
into a backdrop, small, blurred, deep in haze, their feet going into the bright band (the owner, 19/11: "strange rocks
in the depth of the background ... very far, behind Aphrodite, blurred, and not so many"). Level 3:

  python3 -I tools/go/far_rocks.py design/level3/far_rocks.png design/level3/backdrop_plain.jpg /tmp/r.jpg \
      "1,0.08,0.34,0.085,3.5,0.55;2,0.45,0.34,0.1,3.5,0.55;4,0.6,0.335,0.075,3.5,0.6"
  python3 -I tools/go/backdrop_figure.py design/level3/goddess_lowpoly.png /tmp/r.jpg gomilos/backdrop.jpg 0.25 0.085 0.335 0.2

each rock "<index left to right, centre x, foot y, height, blur px, haze>" (x, y, height as shares of the backdrop)
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
src, bd, out, spec = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
sp = g - np.maximum(r, b)
al = 1.0 - np.clip((sp - 12.0) / 50.0, 0.0, 1.0)
a[..., 1] = np.where(sp > 0, np.maximum(r, b), g)
lab, n = ndimage.label(ndimage.binary_dilation(al > 0.5, iterations=12))
objs = []
for k, sl in enumerate(ndimage.find_objects(lab)):
    ys, xs = sl; area = (lab[sl] == k + 1).sum()
    if area > 4000: objs.append((xs.start, ys.start, xs.stop, ys.stop, k + 1))
objs.sort()
print('rocks found:', len(objs), [(o[0], o[1], o[2], o[3]) for o in objs])
B = Image.open(bd).convert('RGB'); W, H = B.size; bg = np.asarray(B).astype(np.float32)
for item in spec.split(';'):
    i, cx, foot, hf, blur, haze = [float(v) for v in item.split(',')]
    x0, y0, x1, y1, k = objs[int(i)]
    m = (lab[y0:y1, x0:x1] == k).astype(np.float32) * al[y0:y1, x0:x1]
    rgba = np.dstack([a[y0:y1, x0:x1], m * 255.0]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA'); sc = hf * H / (y1 - y0)
    im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.LANCZOS)
    pad = int(blur * 3) + 2; big = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0)); big.paste(im, (pad, pad))
    big = big.filter(ImageFilter.GaussianBlur(blur))
    st = np.asarray(big).astype(np.float32); h_, w_ = st.shape[:2]
    px, py = int(cx * W - w_ / 2), int(foot * H - h_ + pad)
    ya, yb = max(py, 0), min(py + h_, H); xa, xb = max(px, 0), min(px + w_, W)
    s = st[ya - py:yb - py, xa - px:xb - px]; reg = bg[ya:yb, xa:xb]
    yy = (np.arange(ya, yb) - py)[:, None] / float(h_)
    k_ = np.clip(haze + (1.0 - haze) * np.clip((yy - 0.62) / 0.33, 0.0, 1.0), 0.0, 1.0)      # (the haze over it, its foot gone into the band)
    col = s[..., :3] * (1.0 - k_[..., None]) + reg * k_[..., None]
    alp = s[..., 3:4] / 255.0
    bg[ya:yb, xa:xb] = reg * (1.0 - alp) + col * alp
    print('rock', int(i), 'at', px, py, 'size', w_, h_)
Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).save(out, quality=95)
