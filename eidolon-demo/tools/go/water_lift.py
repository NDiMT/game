"""A thing the image model painted into a level's water, lifted whole for the game's details in the water (`IV_WATER_DETAILS`
in ch1.gd): the thing itself from its take of the frame with the water made flat green, and about it, what the thing did
to the water (its ripples, its image in it, its part under it) from the painting against the game's own frame it was
painted on, so it sits in the water and is not laid on it.

  python3 -I tools/go/water_lift.py <edit.png> <green.png> <frame.png> <out.png> <x0,y0,x1,y1> <cx,cy,rx,ry>
                                    [--drop x0,y0,x1,y1]... [--floor f] [--wk k] [--new t]

  edit    the image model's painting: the game's frame with the thing added (its own size, 1536 by 2752)
  green   its take of that painting with the open water made flat green
  frame   the game's own frame it was painted on (720 by 1280)
  box     the thing and its water, in the painting's pixels
  ellipse where its water is (its ripples and its image), in the painting's pixels; soft at its rim
  --drop  a box cleared (the level's own rocks the take kept)
  --floor how far the painting's water may stray from the frame's with nothing of the thing in it (0.05)
  --new   keep only the parts of the take that the painting added: those whose mean difference from the frame (0-255)
          is over this (25: the level's rocks, slabs and figures the take kept are left out)
  --wk    the water's strength (1)
It prints the cut's place in the frame's pixels (left, top, width, height) and the thing's foot (the middle of its
lowest part above the water), to place it.
"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_dilation, binary_erosion, label


def boxes(args, flag):
    return [[int(float(v)) for v in args[i + 1].split(',')] for i, a in enumerate(args) if a == flag]


def main(v):
    edit, green, frame, dst = v[:4]
    x0, y0, x1, y1 = [int(float(t)) for t in v[4].split(',')]
    cx, cy, rx, ry = [float(t) for t in v[5].split(',')]
    rest = v[6:]
    floor = float(rest[rest.index('--floor') + 1]) if '--floor' in rest else 0.05
    new_t = float(rest[rest.index('--new') + 1]) if '--new' in rest else 0.0
    wk = float(rest[rest.index('--wk') + 1]) if '--wk' in rest else 1.0
    E = np.asarray(Image.open(edit).convert('RGB')).astype(np.float32) / 255.0
    G = np.asarray(Image.open(green).convert('RGB')).astype(np.float32) / 255.0
    H, W = E.shape[:2]
    if G.shape != E.shape: G = np.asarray(Image.open(green).convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.0
    F0 = Image.open(frame).convert('RGB'); fw, fh = F0.size
    B = np.asarray(F0.resize((W, H), Image.BICUBIC)).astype(np.float32) / 255.0
    sl = (slice(y0, y1), slice(x0, x1))
    e, g, b = E[sl], G[sl], B[sl]
    h, w = e.shape[:2]
    # the thing above the water: whole where the take has it whole (what is not green; even a green bronze, whose green
    # leads its red and blue a little, as no ground's does), its rim from the take's cover; what is under the water the
    # take left half green, and that is left to the water below. Its colours are the painting's own, never the take's.
    lead = g[..., 1] - np.maximum(g[..., 0], g[..., 2])
    gm = lead > 0.78
    bg = g[gm].mean(0) if gm.sum() > 50 else np.array([0.0, 1.0, 0.0], np.float32)
    lead_bg = bg[1] - max(bg[0], bg[2])
    ao = np.clip((lead_bg - lead) / (lead_bg - 0.15), 0.0, 1.0)
    for bx in boxes(rest, '--drop'):
        ao[max(bx[1] - y0, 0):max(bx[3] - y0, 0), max(bx[0] - x0, 0):max(bx[2] - x0, 0)] = 0.0
    lab, n = label(ao > 0.92)
    if n:
        sizes = np.bincount(lab.ravel()); sizes[0] = 0
        keep = sizes >= (max(sizes.max() * 0.08, 30) if new_t <= 0 else 12)
        if new_t > 0:      # (only what the painting added: the level's own rocks, slabs and figures the take kept are in the frame already)
            dif = np.abs(e - b).max(-1) * 255.0
            mean = np.bincount(lab.ravel(), dif.ravel()) / np.maximum(sizes, 1)
            keep &= mean > new_t
        keep[0] = False
        core = np.isin(lab, np.nonzero(keep)[0])
    else: core = np.zeros_like(ao, bool)
    ao = np.where(binary_dilation(core, iterations=2), ao, 0.0)
    ao = np.where(binary_erosion(core, iterations=1), 1.0, ao)
    # its water: the least cover that turns the frame's water into the painting's (its ripples lighter, its image and
    # its part under the water darker or lighter)
    up = np.where(e > b, (e - b) / np.maximum(1.0 - b, 1e-3), 0.0); dn = np.where(e < b, (b - e) / np.maximum(b, 1e-3), 0.0)
    amin = np.clip(np.max(np.maximum(up, dn), -1), 0.0, 1.0)      # (the least cover: its colour then lies within what a screen shows)
    cw = np.clip(b + (e - b) / np.maximum(amin[..., None], 1e-3), 0.0, 1.0)
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    r = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    m = np.clip((1.0 - r) / 0.35, 0.0, 1.0) ** 1.5      # (how much of the painting's water is taken: only about the thing, fading out to its rim,)
    m *= np.clip(np.minimum(np.minimum(xx - x0, x1 - 1 - xx), np.minimum(yy - y0, y1 - 1 - yy)) / 30.0, 0.0, 1.0)      # (never cut by the box's own edge)
    m *= np.clip((gaussian_filter(amin, 1.0) - floor) / floor, 0.0, 1.0)      # (and none where it strays from the frame's no more than the painting's own noise)
    aw = np.clip(amin * m * wk, 0.0, 1.0)      # (so laid over the frame it goes that much of the way to the painting, never less where it is taken whole)
    aw = np.where(ao > 0.02, 0.0, aw)      # (where the thing is, even at its rim, it alone gives back the painting)
    A = ao + aw * (1.0 - ao)
    co = np.clip(b + (e - b) / np.maximum(ao[..., None], 1e-3), 0.0, 1.0)      # (the thing's colours: laid over the frame, it gives back the painting)
    C = (co * ao[..., None] + cw * (aw * (1.0 - ao))[..., None]) / np.maximum(A[..., None], 1e-4)
    A = np.where(A < 0.02, 0.0, A)
    out = np.dstack([C, A])
    Image.fromarray(np.round(out * 255).astype(np.uint8), 'RGBA').save(dst)
    sx, sy = fw / W, fh / H
    ys, xs = np.nonzero(ao > 0.5)
    lo = ys.max(); foot_x = xs[ys >= lo - 4].mean()
    print('cut', dst, (w, h), 'ground', np.round(bg * 255).astype(int))
    print('place: left %.1f top %.1f width %.1f height %.1f foot %.1f %.1f' % (x0 * sx, y0 * sy, w * sx, h * sy, (x0 + foot_x) * sx, (y0 + lo) * sy))


if __name__ == '__main__':
    if len(sys.argv) < 7: print(__doc__); sys.exit(0)
    main(sys.argv[1:])
