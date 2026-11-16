"""A level's painted backdrop, composed from the background kit (bgkit/): the sky's gradient, a sun or a moon with its
glow, stars, and elements of the kit, each coloured by the palette for its depth (its greys mapped onto three colours)
and hazed toward the sky behind it, its foot fading into the mist; the mist over the bottom. The same elements in another
palette make another place: the kit is coloured and used again and again.

usage: python3 -I tools/bg/compose.py <recipe.json> <out.jpg> [palette]
  recipe: {"size": [w, h], "palette": name, "orb": {...} | null, "stars": n,
           "layers": [{"el": name, "x": .5, "y": .4, "w": 1.2, "flip": false, "depth": "far" | "mid" | "near", "fade": .3}]}
  x, y: where the element's middle is (of the width, of the height); w: its width (of the width)
"""
import json, math, os, random, sys
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(HERE, '..', '..', 'bgkit')
PALETTES = {      # the sky (four stops: top, the horizon's band, the haze, the mist), the orb, and three colours (dark, mid, light) by depth
    'night': dict(sky=['2f4778', '6f90c2', '8eadd6', '86a7cf'], stops=[0.0, 0.3, 0.52, 1.0], orb=dict(kind='moon', color='eef4fb', glow='a8c3ea'),
                  far=['8ea7d0', 'aec3e3', 'd2e0f2'], mid=['5f78ad', '93add6', 'dbe7f6'], near=['3f5288', '7c96c8', 'e6eef9'], mist='8aabd3', stars=70),
    'dawn': dict(sky=['6b78b0', 'f2b49a', 'e9c3b4', 'd9b6ae'], stops=[0.0, 0.32, 0.5, 1.0], orb=dict(kind='sun', color='fff1d6', glow='ffc89a'),
                 far=['c79fa8', 'dcb5b3', 'f0d0c4'], mid=['9b7e98', 'c79ea5', 'f2d3c7'], near=['6e5c80', 'a88095', 'f6dccd'], mist='e2bfb6', stars=0),
    'day': dict(sky=['f6e3c4', 'fbe9cc', 'f4dbb9', 'e8c9a5'], stops=[0.0, 0.3, 0.55, 1.0], orb=dict(kind='sun', color='fffaf0', glow='fff0d0'),
                far=['e6cba9', 'efd7b8', 'f8e8d0'], mid=['caa680', 'e0c19c', 'f6e2c6'], near=['a9845f', 'cfa983', 'f6e0c2'], mist='f1d6b1', stars=0),
    'dusk': dict(sky=['8a8db3', 'ebb3a2', 'a2a8c4', '7093a8'], stops=[0.0, 0.3, 0.5, 1.0], orb=dict(kind='sun', color='fff0dc', glow='ffb898'),
                 far=['8f93b6', '9da1c2', 'b9b6cc'], mid=['6f7aa0', '9195b8', 'd9b9b3'], near=['4f5f86', '7d86ab', 'e3c2b8'], mist='8fa4bd', stars=0),
    'storm': dict(sky=['4b5560', '7d8790', '939ba2', '8b949b'], stops=[0.0, 0.3, 0.55, 1.0], orb=None,
                  far=['8c959c', '9fa7ad', 'b9c0c4'], mid=['67717a', '8b949b', 'c3c9cc'], near=['48525b', '717b84', 'cfd4d6'], mist='959da3', stars=0),
}


def hexc(h): return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float) / 255.0


def sky_at(P, y):      # the sky's colour at a height of the picture (0 top .. 1 bottom)
    st = P['stops']; cs = [hexc(h) for h in P['sky']]
    if y <= st[0]: return cs[0]
    for i in range(len(st) - 1):
        if y <= st[i + 1]:
            t = (y - st[i]) / (st[i + 1] - st[i]); t = t * t * (3 - 2 * t)
            return cs[i] * (1 - t) + cs[i + 1] * t
    return cs[-1]


def compose(rc, pal_name=None):
    P = PALETTES[pal_name or rc.get('palette', 'night')]
    W, H = rc.get('size', [1080, 1920])
    ys = (np.arange(H) + 0.5) / H
    sky = np.stack([sky_at(P, y) for y in ys])[:, None, :] * np.ones((1, W, 1))
    img = sky.copy()
    orb = rc.get('orb', {}) if rc.get('orb', {}) is not None else None
    if orb is not None and P.get('orb'):
        o = dict(P['orb']); o.update(orb)
        cx, cy, r = o.get('x', 0.7) * W, o.get('y', 0.15) * H, o.get('r', 0.12) * W
        yy, xx = np.mgrid[0:H, 0:W]; d = np.hypot(xx - cx, yy - cy) / r
        glow = hexc(o['glow'])
        img += (glow[None, None, :] * 0.32) * np.exp(-np.maximum(d - 1.0, 0.0) * 1.6)[..., None] * (d > 1.0)[..., None]
        img += (glow[None, None, :] * 0.1) * np.exp(-np.maximum(d - 1.0, 0.0) * 0.35)[..., None]
        disc = np.clip((1.0 - d) * r / 1.5, 0.0, 1.0)[..., None]
        col = hexc(o['color'])[None, None, :] * np.ones_like(img)
        if o['kind'] == 'moon':      # (soft seas on the moon)
            rnd = np.random.RandomState(5)
            n = np.zeros((H, W))
            for k in range(6):
                mx, my, mr = cx + rnd.uniform(-0.6, 0.6) * r, cy + rnd.uniform(-0.6, 0.6) * r, rnd.uniform(0.18, 0.42) * r
                n += np.exp(-((xx - mx) ** 2 + (yy - my) ** 2) / (2 * mr * mr)) * rnd.uniform(0.4, 1.0)
            col = col * (1.0 - 0.13 * np.clip(n, 0, 1))[..., None]
        img = img * (1 - disc) + col * disc
    rnd = random.Random(rc.get('seed', 3))
    for _ in range(rc.get('stars', P.get('stars', 0))):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H * 0.4) ** 1.0
        s = rnd.choice([1, 1, 1, 2, 2, 3]); b = rnd.uniform(0.5, 1.0) * (1.0 - y / (H * 0.42))
        x0, y0 = int(x), int(y)
        img[max(0, y0 - s // 2):y0 + s // 2 + 1, max(0, x0 - s // 2):x0 + s // 2 + 1] += b * 0.6
    for L in rc.get('layers', []):
        el = Image.open(os.path.join(KIT, L['el'] + '.png')).convert('LA').convert('RGBA')
        if L.get('flip'): el = el.transpose(Image.FLIP_LEFT_RIGHT)
        w = int(L.get('w', 1.0) * W); h = max(1, int(el.height * w / el.width))
        el = np.asarray(el.resize((w, h), Image.LANCZOS)).astype(float) / 255.0
        g = el[..., 0]; a = el[..., 3]
        fd = L.get('fade', 0.3)
        if fd > 0:      # (its foot into the mist)
            t = np.clip((np.arange(h)[:, None] / h - (1.0 - fd)) / fd, 0, 1); a = a * (1.0 - t * t * (3 - 2 * t))
        tint = [hexc(c) for c in (L.get('tint') or P[L.get('depth', 'mid')])]
        gg = np.clip((g - L.get('lo', 0.15)) / (L.get('hi', 0.95) - L.get('lo', 0.15)), 0, 1)[..., None]
        col = np.where(gg < 0.5, tint[0] * (1 - gg * 2) + tint[1] * (gg * 2), tint[1] * (2 - gg * 2) + tint[2] * (gg * 2 - 1))
        cx, cy = int(L.get('x', 0.5) * W), int(L.get('y', 0.5) * H)
        x0, y0 = cx - w // 2, cy - h // 2
        X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
        if X1 <= X0 or Y1 <= Y0: continue
        sub = slice(Y0 - y0, Y1 - y0), slice(X0 - x0, X1 - x0)
        hz = L.get('haze', {'far': 0.45, 'mid': 0.22, 'near': 0.06}[L.get('depth', 'mid')])
        sk = img[Y0:Y1, X0:X1]
        skyband = np.stack([sky_at(P, (Y0 + i + 0.5) / H) for i in range(Y1 - Y0)])[:, None, :]
        c2 = col[sub] * (1 - hz) + skyband * hz
        aa = a[sub][..., None]
        img[Y0:Y1, X0:X1] = sk * (1 - aa) + c2 * aa
    m = rc.get('mist', {})
    if m is not None:
        f0, f1 = m.get('from', 0.5), m.get('to', 0.9)
        t = np.clip((ys - f0) / (f1 - f0), 0, 1); t = (t * t * (3 - 2 * t))[:, None, None]
        img = img * (1 - t) + hexc(m.get('color', P['mist']))[None, None, :] * t
    out = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGB')
    return out.filter(ImageFilter.GaussianBlur(0.6))


if __name__ == '__main__':
    rc = json.load(open(sys.argv[1]))
    compose(rc, sys.argv[3] if len(sys.argv) > 3 else None).save(sys.argv[2], quality=92)
    print('saved', sys.argv[2])
