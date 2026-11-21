"""Lay a thing an image model added to a plain backdrop back onto that backdrop, smaller or moved: the thing is found by
its difference from the plain picture (the model's edit lies on it exactly), scaled about the top middle of its outline
and set with that point where asked, faded out above a band if asked (under the story's lines). Writes the full-size
picture and the game's 1080x1920 crop. (The fifth level's islands, 21/11: design/level5/surreal/.)

usage: python3 -I tools/go/backdrop_place.py <plain.jpg> <edit.png> <out_full.png> <out_game.jpg> <scale> <x> <top> [fade_from fade_to]
       x, top, fade_*: fractions of the picture's width and height
"""
import sys
from PIL import Image, ImageFilter
import numpy as np

plain, edit, out_full, out_game = sys.argv[1:5]
sc, dx, dt = (float(v) for v in sys.argv[5:8])
ff = [float(v) for v in sys.argv[8:10]] if len(sys.argv) > 9 else None
P = np.asarray(Image.open(plain).convert('RGB')).astype(np.float32)
I = np.asarray(Image.open(edit).convert('RGB')).astype(np.float32)
H, W, _ = P.shape
d = np.abs(I - P).mean(2); reg = np.zeros_like(d); reg[:int(0.97 * H), :int(0.74 * W)] = 1      # (its left part: the sun at the right stays the plain one's)
m = (d > 7).astype(np.float32) * reg
mi = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.GaussianBlur(10))
m = np.asarray(mi).astype(np.float32) / 255.0
ys, xs = np.where(m > 0.3); y0, x0, x1 = ys.min(), xs.min(), xs.max()
cx, ty = (x0 + x1) / 2.0, float(y0)
nw, nh = int(W * sc), int(H * sc)
lay = Image.fromarray(np.clip(I, 0, 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
ml = Image.fromarray((m * 255).astype(np.uint8)).resize((nw, nh), Image.LANCZOS)
ox, oy = int(round(dx * W - cx * sc)), int(round(dt * H - ty * sc))
full_l = Image.new('RGB', (W, H)); full_m = Image.new('L', (W, H), 0)
full_l.paste(lay, (ox, oy)); full_m.paste(ml, (ox, oy))
if ff:
    fm = np.asarray(full_m).astype(np.float32)
    fm *= np.clip(((np.arange(H) / H)[:, None] - ff[0]) / (ff[1] - ff[0]), 0, 1)
    full_m = Image.fromarray(fm.astype(np.uint8))
out = Image.composite(full_l, Image.fromarray(np.clip(P, 0, 255).astype(np.uint8)), full_m)
out.save(out_full)
im = out.resize((1080, round(H * 1080 / W)), Image.LANCZOS); t = (im.size[1] - 1920) // 2
im.crop((0, t, 1080, t + 1920)).convert('RGB').save(out_game, quality=90)
yy, xx = np.where(np.asarray(full_m) > 76)
print('placed: x %.3f-%.3f y %.3f-%.3f' % (xx.min() / W, xx.max() / W, yy.min() / H, yy.max() / H))
