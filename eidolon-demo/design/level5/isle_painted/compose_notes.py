"""compose.py: the 3D island cut from the level's still (with it, without it) and laid into the plain backdrop where it lies
in the game at that moment (the screen to the painting: uv = screen + bg_off, the painting 1.5 times the 720 screen)"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
S = '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad'
a = np.asarray(Image.open(S + '/g4p/isl_a.png').convert('RGB')).astype(np.float32)
b = np.asarray(Image.open(S + '/g4p/isl_b.png').convert('RGB')).astype(np.float32)
fo = (-0.25, -1.15); vw = 10.95; vh = vw * 1280 / 720
off = (fo[0] / vw, -fo[1] / vh)
d = ndimage.gaussian_filter(np.abs(a - b).mean(-1), 1.0)
m = d > 6
m[int(1280 * 0.56):, :] = False      # (the island is in the upper part: its image in the water, below, is not taken)
lab, n = ndimage.label(m); sz = ndimage.sum(m, lab, range(1, n + 1))
keep = np.isin(lab, 1 + np.argsort(sz)[::-1][:1])      # (the largest part: the island)
keep = ndimage.binary_closing(keep, iterations=4); keep = ndimage.binary_fill_holes(keep)
ys, xs = np.nonzero(keep); print('island on the screen', xs.min(), ys.min(), xs.max(), ys.max())
bd = Image.open('/home/user/game/eidolon-demo/goguard/backdrop.jpg').convert('RGB'); W, H = bd.size
sc = W / 720.0
# the screen's island (its pixels and its cover, a little soft at the edge) scaled into the painting's pixels
al = Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
isl = Image.fromarray(a.astype(np.uint8)).resize((W, int(1280 * sc)), Image.LANCZOS)
alb = al.resize((W, int(1280 * sc)), Image.LANCZOS)
dx, dy = int(round(off[0] * W)), int(round(off[1] * H))
canvas = bd.copy(); A = Image.new('L', bd.size, 0)
canvas.paste(isl, (dx, dy), alb); A.paste(alb, (dx, dy))
canvas.save(S + '/isle/composite.png'); A.save(S + '/isle/island_mask.png')
x0, y0, x1, y1 = [int(v * sc) for v in (xs.min(), ys.min(), xs.max(), ys.max())]
print('island in the painting', x0 + dx, y0 + dy, x1 + dx, y1 + dy, 'offset', dx, dy)
