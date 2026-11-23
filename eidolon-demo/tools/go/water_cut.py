"""A thing painted in a level's water, cut out of the image model's take of it on flat green, for the game's details in the
water (`IV_WATER_DETAILS` in ch1.gd; the owner, 23/11: "I'd like details in the water, like the ones you made at some
point in between, in all the levels"; "the water lilies in 4 I liked"; "and they needn't all be striking").

  python3 -I tools/go/water_cut.py <green.png> <out.png> [--drop x0,y0,x1,y1]... [--faint x0,y0,x1,y1]...
                                    [--dark x0,y0,x1,y1]... [--scale s] [--pad px]

The ground's green is measured (the pixels it leads most); each pixel's cover is how far its green's lead over red and
blue falls short of the ground's, its colour unmixed from the ground and the green spill taken out of it. Where the
cover is partial over a few pixels only (an edge), the colour comes from the thing's inside near it.
  --drop   a box cleared (the level's own rocks and slabs the take kept)
  --faint  a box where only what is near whole is kept (ghosts of a pad under the mist, a seam's leavings)
  --dark   a box where a light thing stands before the level's dark rock (the take kept the rock): there its cover is
           its lightness over the rock's, only where it joins the thing going on out of the box's foot, and its colour
           is unmixed from the rock's; a fifth value, the lightness in hundredths that only the thing passes (above the
           rock's own lit top)
  --solid  a box where the take made a thing see-through that the painting has whole (a pad the take turned half green):
           there what has any cover is whole, its colour from --orig, the painting before the take (in the same frame)
  --scale  the cut's size against the take's
  --pad    the clear margin kept about the thing
  --fade   what reaches the take's edge fades out over that many pixels before it
It prints the thing's box in the take's pixels (before --scale), to place it.
"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation, label


def boxes(args, flag):
    out = []
    for i, a in enumerate(args):
        if a == flag: out.append([int(float(v)) for v in args[i + 1].split(',')])
    return out


def main(v):
    src, dst = v[0], v[1]; rest = v[2:]
    scale = float(rest[rest.index('--scale') + 1]) if '--scale' in rest else 1.0
    pad = int(rest[rest.index('--pad') + 1]) if '--pad' in rest else 8
    c = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255.0
    H, W = c.shape[:2]
    lead = c[..., 1] - np.maximum(c[..., 0], c[..., 2])
    g = lead > 0.78
    bg = c[g].mean(0) if g.sum() > 100 else np.array([0.0, 1.0, 0.0], np.float32)
    lead_bg = bg[1] - max(bg[0], bg[2])
    fg = lead < 0.0
    lead_fg = float(np.median(lead[fg])) if fg.sum() > 100 else -0.03      # (the thing's own colours: a little less green than red or blue)
    a = np.clip((lead_bg - lead) / (lead_bg - lead_fg), 0.0, 1.0)
    rgb = (c - (1.0 - a[..., None]) * bg) / np.maximum(a[..., None], 1e-3)
    for bx in boxes(rest, '--dark'):
        x0, y0, x1, y1 = bx[:4]
        cc = c[y0:y1, x0:x1]; aa = a[y0:y1, x0:x1]
        L = cc @ np.array([0.3, 0.55, 0.15], np.float32)
        solid = aa > 0.95
        Ls = np.sort(L[solid])
        lo = float(Ls[int(len(Ls) * 0.12)]); hi = float(Ls[int(len(Ls) * 0.9)])      # (the rock's light and the thing's)
        dark = solid & (L < lo + 0.04)
        rock = cc[dark].mean(0) if dark.sum() > 20 else np.array([0.3, 0.27, 0.33], np.float32)
        Lr = float(rock @ np.array([0.3, 0.55, 0.15], np.float32))
        k = np.clip((L - (Lr + 0.07)) / max(hi - 0.08 - (Lr + 0.07), 0.05), 0.0, 1.0)
        k = k * k * (3.0 - 2.0 * k)
        mix = aa > 0.5      # (before the rock: what is not green; about it the green's own cover stands)
        lmin = bx[4] / 100.0 if len(bx) > 4 else Lr + 0.1
        lab, n = label(L > lmin)      # (only the light that is the thing itself, which goes on out of the box's foot into the water: lighter than the rock's own lit top, which may touch it)
        keep = np.isin(lab, [int(v) for v in np.unique(lab[-1, :]) if v > 0])
        keep = binary_dilation(keep, iterations=1)
        k = np.where(keep, k, 0.0)
        col = np.where(mix[..., None], (cc - (1.0 - k[..., None]) * rock) / np.maximum(k[..., None], 1e-3), rgb[y0:y1, x0:x1])
        a[y0:y1, x0:x1] = np.where(keep, np.where(mix, np.minimum(aa, k), aa), 0.0); rgb[y0:y1, x0:x1] = col
        print('dark box', (x0, y0, x1, y1), 'rock', np.round(rock * 255).astype(int), 'light', round(Lr, 3), 'thing', round(hi, 3))
    if '--orig' in rest:
        o = np.asarray(Image.open(rest[rest.index('--orig') + 1]).convert('RGB')).astype(np.float32) / 255.0
        for x0, y0, x1, y1 in boxes(rest, '--solid'):
            aa = a[y0:y1, x0:x1]; t = np.clip((aa - 0.06) / 0.2, 0.0, 1.0); t = t * t * (3.0 - 2.0 * t)
            rgb[y0:y1, x0:x1] = np.where((aa < 0.9)[..., None], o[y0:y1, x0:x1], rgb[y0:y1, x0:x1]); a[y0:y1, x0:x1] = np.maximum(aa, t)
    for x0, y0, x1, y1 in boxes(rest, '--faint'):
        aa = a[y0:y1, x0:x1]; t = np.clip((aa - 0.55) / 0.3, 0.0, 1.0); a[y0:y1, x0:x1] = aa * t * t * (3.0 - 2.0 * t)
    for x0, y0, x1, y1 in boxes(rest, '--drop'):
        a[y0:y1, x0:x1] = 0.0
    rgb[..., 1] = np.minimum(rgb[..., 1], (rgb[..., 0] + rgb[..., 2]) * 0.5 + 4.0 / 255.0)      # (no green spill, nor the cold green-grey it leaves on a pale thing)
    rgb = np.clip(rgb, 0.0, 1.0)
    inner = a > 0.92      # (an edge's colour from the inside near it, where there is an inside: a thin stem keeps its own)
    wi = gaussian_filter(inner.astype(np.float32), 3.0)
    ci = np.stack([gaussian_filter(rgb[..., i] * inner, 3.0) for i in range(3)], -1) / np.maximum(wi[..., None], 1e-4)
    edge = (a > 0.0) & (a < 0.92) & (wi > 0.08)
    t = np.clip((wi - 0.08) / 0.3, 0.0, 1.0)[..., None]
    rgb = np.where(edge[..., None], rgb * (1.0 - t) + ci * t, rgb)
    a = np.where(a < 0.03, 0.0, a)
    ys, xs = np.nonzero(a > 0.0)
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + 1 + pad, W); y0, y1 = max(ys.min() - pad, 0), min(ys.max() + 1 + pad, H)
    out = np.dstack([rgb, a])[y0:y1, x0:x1]
    fade = int(rest[rest.index('--fade') + 1]) if '--fade' in rest else 0
    if fade > 0:      # (what reaches the take's own edge fades out before it, so no straight cut is ever seen)
        hh, ww = out.shape[:2]; yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
        r = np.clip(np.minimum(np.minimum(xx + x0, (W - 1) - (xx + x0)), np.minimum(yy + y0, (H - 1) - (yy + y0))) / fade, 0.0, 1.0)
        out[..., 3] *= r * r * (3.0 - 2.0 * r)
    im = Image.fromarray(np.round(out * 255).astype(np.uint8), 'RGBA')
    if scale != 1.0:      # (scaled with its colour weighted by its cover, so no dark fringe)
        pm = np.dstack([out[..., :3] * out[..., 3:4], out[..., 3:4]])
        sz = (max(1, round(pm.shape[1] * scale)), max(1, round(pm.shape[0] * scale)))
        ch = [np.asarray(Image.fromarray(pm[..., i].astype(np.float32), 'F').resize(sz, Image.LANCZOS)) for i in range(4)]
        A = np.clip(ch[3], 0.0, 1.0); C = np.stack(ch[:3], -1) / np.maximum(A, 1e-4)[..., None]
        im = Image.fromarray(np.round(np.dstack([np.clip(C, 0, 1), A]) * 255).astype(np.uint8), 'RGBA')
    im.save(dst)
    print('ground', np.round(bg * 255).astype(int), 'lead', round(float(lead_bg), 3), 'its own', round(lead_fg, 3))
    print('cut', dst, im.size, 'box in the take', (int(x0), int(y0), int(x1), int(y1)))


if __name__ == '__main__':
    if len(sys.argv) < 3: print(__doc__); sys.exit(0)
    main(sys.argv[1:])
