"""The painted columns brought into the colours of the rest of the map (the owner, 23/11: "the lower ones and the upper
ones should match the colours of the rest of the map"): each card's marble (its solid part, not its water) moved in Lab
to the mean and spread of the map's own marble, as the game draws it at the same place (the 3D column by the island,
nearly clear of the haze, in a frame of the game); a part of a card can be laid a little further into the haze behind it
(the colonnade: "slightly fainter").

  python3 -I design/level5/columns_facets/grade.py <card.png> <out.png> <ref.png> <ref mask.png> [k]
         [--haze <frame crop under the card, same size as the card> <x0,y0,x1,y1 in the card> <amount>]...
k: how far toward the map's marble (1: all the way).
"""
import sys
import numpy as np
from PIL import Image


def to_lab(rgb):
    c = np.where(rgb > 0.04045, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16.0 / 116.0)
    return np.stack([116.0 * f[..., 1] - 16.0, 500.0 * (f[..., 0] - f[..., 1]), 200.0 * (f[..., 1] - f[..., 2])], -1)


def to_rgb(lab):
    fy = (lab[..., 0] + 16.0) / 116.0; fx = fy + lab[..., 1] / 500.0; fz = fy - lab[..., 2] / 200.0
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16.0 / 116.0) / 7.787) * np.array([0.95047, 1.0, 1.08883])
    Mi = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    c = np.clip(xyz @ Mi.T, 0.0, 1.0)
    return np.where(c > 0.0031308, 1.055 * c ** (1.0 / 2.4) - 0.055, 12.92 * c)


def main(v):
    card, out, ref, refm = v[:4]; rest = v[4:]
    k = float(rest[0]) if rest and not rest[0].startswith('--') else 1.0
    a = np.asarray(Image.open(card).convert('RGBA')).astype(np.float32) / 255.0
    R = np.asarray(Image.open(ref).convert('RGB')).astype(np.float32) / 255.0
    Rm = np.asarray(Image.open(refm).convert('L')).astype(np.float32) / 255.0 > 0.5
    rl = to_lab(R[Rm]); rmu, rsd = rl.mean(0), rl.std(0)
    solid = a[..., 3] > 0.9      # (the marble itself: the water about it is let be)
    lab = to_lab(a[..., :3]); cl = lab[solid]; mu, sd = cl.mean(0), cl.std(0)
    moved = (lab - mu) / np.maximum(sd, 1e-3) * rsd + rmu
    w = np.clip((a[..., 3] - 0.8) / 0.15, 0.0, 1.0)[..., None] * k
    rgb = to_rgb(lab * (1.0 - w) + moved * w)
    for i, t in enumerate(rest):
        if t != '--haze': continue
        base = np.asarray(Image.open(rest[i + 1]).convert('RGB').resize((a.shape[1], a.shape[0]), Image.BICUBIC)).astype(np.float32) / 255.0
        x0, y0, x1, y1 = [int(q) for q in rest[i + 2].split(',')]; amt = float(rest[i + 3])
        rgb[y0:y1, x0:x1] = rgb[y0:y1, x0:x1] * (1.0 - amt) + base[y0:y1, x0:x1] * amt
    Image.fromarray(np.round(np.dstack([rgb, a[..., 3:4]]) * 255).astype(np.uint8), 'RGBA').save(out)
    print('graded', out, 'marble Lab mean', np.round(mu, 1), '->', np.round(rmu, 1), 'spread', np.round(sd, 1), '->', np.round(rsd, 1))


if __name__ == '__main__':
    if len(sys.argv) < 5: print(__doc__); sys.exit(0)
    main(sys.argv[1:])
