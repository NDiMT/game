"""A painted card's image in the water made from the card itself (the owner, 23/11, of the painted ruin at the fifth
level's upper left: "the reflection in the water is tragic"): the image the model painted under each thing is taken
away, and each thing is turned over about where it meets the water, as the game's own images are (each point about the
water under it: a column about its foot, a row of columns and their architrave about the line through their feet),
going toward the sea's colour as it goes down (as `img_k` in the game's shaders: 0.28, and 0.5 more over 3.2 m), never
whole (the sea's glints show through it), its lines a little shaken, as on still water.

  python3 -I tools/go/card_reflect.py <card.png> <out.png> <pixels a metre of height> [--k 0.75] [--wave 2.5] [--contact 22] [--fade 0.85] [--part x0,y0,x1,y1]... [--contour]

Each solid part of the card (cover over 0.9) is one thing; one wider than 120 pixels whose underside rises between its
legs (a row of columns under an architrave) is turned over about the line through its legs' feet.
"""
import sys, math
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation, binary_erosion, gaussian_filter, distance_transform_edt


def main(v):
    src, dst, ppm = v[0], v[1], float(v[2]); rest = v[3:]
    K = float(rest[rest.index('--k') + 1]) if '--k' in rest else 0.75
    WAVE = float(rest[rest.index('--wave') + 1]) if '--wave' in rest else 2.5
    CB = int(rest[rest.index('--contact') + 1]) if '--contact' in rest else 22
    FADE = float(rest[rest.index('--fade') + 1]) if '--fade' in rest else 0.85
    CONTOUR = '--contour' in rest
    a = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255.0
    H, W = a.shape[:2]
    solid = a[..., 3] > 0.9
    keep = binary_dilation(solid, iterations=2)      # (its own soft rim stays; the painted water about it goes)
    thing = np.where(keep[..., None], a, 0.0)
    # each thing apart, even where two touch on the card (a broken column and a fallen piece before it): split where they
    # meet by eroding, then each part of the solid goes to the nearest of them (the owner: "the right one of the left part
    # has no reflection": it was one with the piece, and turned over about the piece's foot)
    core = binary_erosion(solid, iterations=4)
    lab0, n = label(core, structure=np.ones((3, 3)))
    if n:
        iy, ix = distance_transform_edt(lab0 == 0, return_distances=False, return_indices=True)
        lab = np.where(solid, lab0[iy, ix], 0)
    else: lab = lab0
    for i_, t_ in enumerate(rest):      # (--part x0,y0,x1,y1: a thing of its own, where two overlap on the card: a drum lying before a column's foot)
        if t_ != '--part': continue
        x0_, y0_, x1_, y1_ = [int(q) for q in rest[i_ + 1].split(',')]
        n += 1; box_ = np.zeros_like(solid); box_[y0_:y1_, x0_:x1_] = True; lab = np.where(solid & box_, n, lab)
    refl = np.zeros((H, W, 4), np.float32)
    contact = []
    for k in range(1, n + 1):
        m = lab == k
        if m.sum() < 400: continue
        ys, xs = np.nonzero(m)
        x0, x1 = xs.min(), xs.max()
        bot = np.full(W, -1)
        np.maximum.at(bot, xs, ys)
        cols = np.arange(x0, x1 + 1); b = bot[x0:x1 + 1]
        line = np.full(W, float(ys.max()))
        if x1 - x0 > 120:      # (legs: where its underside comes far lower than between them)
            low = b > b[b >= 0].min() + 0.35 * (b.max() - b[b >= 0].min())
            legs, cur = [], []
            for c, l in zip(cols, low):
                if l: cur.append(c)
                elif cur: legs.append(cur); cur = []
            if cur: legs.append(cur)
            legs = [g for g in legs if len(g) > 6]
            if len(legs) >= 2:
                px = np.array([np.mean(g) for g in legs]); py = np.array([bot[g].max() for g in legs])
                A_, c_ = np.polyfit(px, py, 1); line = A_ * np.arange(W) + c_
                print('thing', k, 'legs at', np.round(px).astype(int), 'feet', py, 'line slope', round(float(A_), 3))
        # where it meets the water at each x: its own underside where that lies on the water (an upright column's foot, the
        # arc of its base; a drum lying in it), else the line under it (between legs; the shaft of a leaning column, over
        # the water but for its foot): mirrored about where it really meets the water, it never floats over its image
        mline = line.copy()
        if CONTOUR:      # (every thing about its own underside at each x: far things standing close behind one another)
            near = bot >= 0
        elif x1 - x0 > 120 and np.any(line != float(ys.max())):      # (a row on legs: each leg about its own base, the rest about the line through their feet)
            near = (bot >= 0) & (bot >= line - 22)
        else:
            okb = bot[x0:x1 + 1] >= 0
            sl = np.polyfit(cols[okb], bot[x0:x1 + 1][okb], 1)[0] if okb.sum() > 3 else 0.0
            rng = bot[x0:x1 + 1][okb].max() - bot[x0:x1 + 1][okb].min() if okb.any() else 0
            if abs(sl) > 0.8 and rng > 60:      # (leaning: only its foot is in the water, its shaft over it)
                near = (bot >= 0) & (bot >= line - 10)
            else:      # (standing, or lying in the water: where its underside is, it meets the water, all along)
                near = bot >= 0
        mline[near] = bot[near]
        contact.append((np.arange(W)[near], mline[near]))
        mm = binary_dilation(m, iterations=2) & keep
        ys, xs = np.nonzero(mm)
        yl = mline[xs]
        up = ys <= yl
        ys, xs, yl = ys[up], xs[up], yl[up]
        yr = np.round(2.0 * yl - ys).astype(int)
        d = (yr - yl) / ppm      # (metres under the water)
        t = np.clip(d / 3.2, 0.0, 1.0); t = t * t * (3.0 - 2.0 * t)
        hob = max(float(np.max(yl) - ys.min()), 10.0)      # (its height over the water, in pixels)
        f = np.clip((yr - yl) / (FADE * hob), 0.0, 1.0)      # (and gone toward its foot's image's far end: the owner, "and they should fade toward the bottom")
        al = (1.0 - (0.28 + 0.5 * t)) * K * a[ys, xs, 3] * (1.0 - f) ** 1.3
        wob = np.sin(yr * 0.21 + 1.7 * np.sin(yr * 0.047)) * 0.65 + np.sin(yr * 0.53 + 0.8) * 0.35      # (no one wave: two, the slow one bending the quick)
        xr = np.round(xs + WAVE * wob * np.clip(d / 0.4, 0.0, 1.0)).astype(int)      # (its lines a little shaken, more the further down)
        ok = (yr >= 0) & (yr < H) & (xr >= 0) & (xr < W)
        yr, xr, al, ys2, xs2 = yr[ok], xr[ok], al[ok], ys[ok], xs[ok]
        better = al > refl[yr, xr, 3]
        refl[yr[better], xr[better], :3] = a[ys2[better], xs2[better], :3]; refl[yr[better], xr[better], 3] = al[better]
    pm = refl[..., :3] * refl[..., 3:4]
    pm = np.stack([gaussian_filter(pm[..., i], (1.6, 0.6)) for i in range(3)], -1); ra = gaussian_filter(refl[..., 3], (1.6, 0.6))      # (soft, more along the up than across)
    rc = pm / np.maximum(ra, 1e-4)[..., None]
    # the painted water where each thing goes into it kept, a band under where it meets the water fading over CB pixels
    # (its ripples and the dark of its foot going in: without them the things stood on the water as on glass)
    wc = np.zeros((H, W), np.float32)
    for (xc, yc) in contact:
        for x_, y_ in zip(xc, yc):
            y0 = int(round(y_)) - 2
            for dy in range(CB):
                yy = y0 + dy
                if 0 <= yy < H: wc[yy, x_] = max(wc[yy, x_], 1.0 - dy / float(CB))
    wc = gaussian_filter(wc, 1.5)
    pw = np.where(keep[..., None], 0.0, a)      # (the painted water alone)
    pa = pw[..., 3] * wc
    ua = pa + ra * (1.0 - pa); uc = (pw[..., :3] * pa[..., None] + rc * (ra * (1.0 - pa))[..., None]) / np.maximum(ua, 1e-4)[..., None]
    ra, rc = ua, uc
    ta = thing[..., 3:4]
    oa = ta + ra[..., None] * (1.0 - ta)
    oc = (thing[..., :3] * ta + rc * ra[..., None] * (1.0 - ta)) / np.maximum(oa, 1e-4)
    Image.fromarray(np.round(np.dstack([np.clip(oc, 0, 1), np.clip(oa, 0, 1)]) * 255).astype(np.uint8), 'RGBA').save(dst)
    print('reflected', dst)


if __name__ == '__main__':
    if len(sys.argv) < 4: print(__doc__); sys.exit(0)
    main(sys.argv[1:])
