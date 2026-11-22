"""A statue painted in a backdrop made to read more as a solid form (the owner, 22/11: "can the backgrounds in 3 and 4
look more 3D? In 3 Aphrodite, in 4 the head"). Only its light and shade change; its drawing, its colours and where it
stands do not.

  round   a figure painted alone on flat green (tools/go/backdrop_figure.py lays it in a backdrop): its own broad light
          and shade drawn out (form k times as strong about its broader light, its fine detail a little), and each row of
          it shaded as a turning form, darker as it turns away from the light on the left, a little at its far right edge;
          the shadow side a touch cooler. The third level's goddess:
            python3 -I tools/go/figure_volume.py round design/level3/goddess_painted.png <scratch>/goddess_round.png 2.4 0.4 0.12
          then backdrop_figure.py with it (haze 0.22: see CLAUDE.md, level 3).
  relief  a backdrop repainted (Gemini: the same picture, only its light and shade on the thing modelled more strongly)
          laid into the old one within the thing's mask, its luminance and colour, and a little local relief there:
            python3 -I tools/go/figure_volume.py relief design/level4/game/backdrop_head_3d_gemini.jpg \\
                design/level4/game/backdrop_head_game.jpg design/level4/game/head_mask.png design/level4/game/backdrop_head_3d.jpg
          then backdrop_haze.py with it (0.58: see CLAUDE.md, level 4).
"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def ycc(im): return np.asarray(im.convert('YCbCr')).astype(np.float32)
def rgb(a): return Image.fromarray(np.clip(a, 0, 255).round().astype(np.uint8), 'YCbCr').convert('RGB')
def blur(Y, r): return np.asarray(Image.fromarray(np.clip(Y, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32)


def round_figure(src, out, kf, a_, b_):
    gi = Image.open(src).convert('RGB'); a = np.asarray(gi).astype(np.float32)
    fig = (a[..., 1] - np.maximum(a[..., 0], a[..., 2])) < 60      # (her, not the green ground)
    y = ycc(gi); Y = y[..., 0].copy(); Yf = np.where(fig, Y, Y[fig].mean())      # (the ground's green kept out of her blurs)
    H, W = fig.shape; t = np.zeros_like(Y)
    fs = np.asarray(Image.fromarray((fig * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))).astype(np.float32) / 255 > 0.5
    for r in range(H):      # (across each row of her: 0 at her left edge, 1 at her right)
        xs = np.nonzero(fs[r])[0]
        if xs.size < 4: continue
        x0, x1 = xs.min(), xs.max(); t[r, x0:x1 + 1] = (np.arange(x0, x1 + 1) - x0) / max(x1 - x0, 1)
    t = blur(t * 255, 14) / 255
    lo = blur(Yf, 36); base = blur(Yf, 260); hi = Yf - lo
    Y2 = (base + kf * (lo - base) + 1.1 * hi) * (1 - a_ * (1 - t) ** 2 - b_ * t ** 6)
    m = np.asarray(Image.fromarray((fig * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255.0
    o = y.copy(); o[..., 0] = Y * (1 - m) + Y2 * m
    sh = np.clip((Y - Y2) / 40.0, 0, 1) * m      # (where it went darker, a touch cooler)
    o[..., 1] += 6 * sh; o[..., 2] -= 2 * sh
    Image.composite(rgb(o), gi, Image.fromarray((fig * 255).astype(np.uint8))).save(out)
    print('rounded', src, '->', out)


def relief(new, old, mask, out, r=22, s=0.3):
    hi_ = Image.open(old).convert('RGB'); ho = Image.open(new).convert('RGB').resize(hi_.size, Image.LANCZOS)
    mf = np.asarray(Image.open(mask).convert('L').filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255.0
    yi, yo = ycc(hi_), ycc(ho)
    o = yi * (1 - mf[..., None]) + yo * mf[..., None]
    o[..., 0] = o[..., 0] + s * (o[..., 0] - blur(o[..., 0], r)) * mf
    rgb(o).save(out, quality=95)
    print('relief', new, 'into', old, '->', out)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'round': round_figure(a[1], a[2], float(a[3]), float(a[4]), float(a[5]))
    elif a[0] == 'relief': relief(a[1], a[2], a[3], a[4])
    else: print(__doc__)
