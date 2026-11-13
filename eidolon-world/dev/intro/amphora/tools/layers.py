#!/usr/bin/env python3
# cut each painting into layers: every element alone on a transparent ground, in its place, at full size; and the
# background with those elements taken out (what lay under them filled in from round about)
import numpy as np, os, json
from PIL import Image
from scipy import ndimage as ndi
S = '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/gem'
OUT = '/home/user/game/eidolon-world/dev/intro/amphora/layers'
SC = 2048 / 1100.0
# name, box (in 1100-pixel units), which pixels inside the box belong to it
#   all: whatever is not bare clay; dark: black slip; bright: cream-white; colour: purple-red and white (not black);
#   notbright: black and purple-red (not the cream-white)
L = {
 1: [('sun', (150, 150, 318, 312), 'dark'), ('waves', (40, 688, 318, 866), 'all'), ('theron', (318, 165, 655, 868), 'notbright', (290, 165, 318, 690)),
     ('statue', (556, 198, 752, 870), 'bright'), ('bench_and_tools', (752, 495, 1030, 868), 'all'), ('olive_branch', (595, 50, 1012, 478), 'dark')],
 2: [('temple', (255, 100, 890, 890), 'thin'), ('theron', (160, 440, 495, 888), 'notbright_thick'), ('ione_statue', (438, 308, 684, 888), 'bright'),
     ('aphrodite', (688, 250, 905, 888), 'all_thick', (640, 325, 725, 492))],
 3: [('sun', (205, 160, 355, 308), 'dark'), ('waves', (96, 508, 488, 698), 'all'), ('ione_hair', (540, 200, 802, 346), 'dark'),
     ('ione_body', (430, 205, 852, 806), 'colour'), ('rocks_door_theron', (300, 205, 1010, 900), 'dark')],
 4: [('wrapped_mirror_1', (75, 215, 210, 540), 'all'), ('wrapped_mirror_2', (85, 625, 232, 955), 'all'), ('wrapped_mirror_3', (725, 215, 842, 540), 'all'),
     ('bare_mirror', (885, 258, 1045, 545), 'all'), ('hand_mirror', (735, 622, 850, 838), 'all'), ('cloth_on_peg', (872, 570, 1032, 908), 'all'),
     ('theron', (268, 205, 452, 958), 'all', (452, 220, 528, 312, 'dark')), ('ione_and_veil', (452, 220, 684, 958), 'colour')],
 5: [('gull_1', (210, 266, 324, 348), 'all'), ('gull_2', (453, 242, 564, 308), 'all'), ('sun', (368, 368, 500, 456), 'dark'), ("sun_road", (384, 456, 484, 792), 'all'),
     ('ione_veiled', (632, 236, 760, 590), 'all'), ('reflection', (636, 600, 756, 852), 'all'), ('shore_and_house', (736, 300, 1010, 700), 'all')],
 6: [('sun', (40, 420, 185, 506), 'all'), ('boat_and_ione', (130, 292, 852, 641), 'all'), ('reflection', (140, 644, 880, 998), 'all'), ('house', (852, 240, 1068, 540), 'all')],
 7: [('sun', (520, 300, 730, 428), 'all'), ('boat', (120, 458, 728, 652), 'dark'), ('veil', (418, 536, 908, 768), 'colour'), ('boat_reflection', (130, 652, 420, 752), 'all'),
     ('theron_on_shore', (770, 400, 1012, 640), 'all')],
}
def sel(a, dg, kind):
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    al = np.clip((dg - 55) / 40.0, 0, 1)
    k = kind.replace('_thick', '')
    if k == 'dark': al = al * np.clip((85 - lum) / 25.0, 0, 1)
    elif k == 'bright': al = al * np.clip((lum - 150) / 30.0, 0, 1)
    elif k == 'colour': al = al * np.clip(np.maximum(sat - 28, lum - 95) / 20.0, 0, 1)
    elif k == 'notbright': al = al * np.clip((165 - lum) / 25.0, 0, 1)
    if kind.endswith('_thick'): al = al * ndi.binary_dilation(ndi.binary_opening(al > 0.3, iterations=7), iterations=8)
    if k == 'thin': al = al * (1 - ndi.binary_dilation(ndi.binary_opening(al > 0.3, iterations=7), iterations=8))      # only the thin lines (a building drawn in line)
    return al
os.makedirs(OUT, exist_ok=True); prev = []
for c, layers in L.items():
    a = np.asarray(Image.open(S + '/out/cons%d.png' % c).convert('RGB')).astype(np.float32)
    H, W, _ = a.shape; g = np.median(a[10:110].reshape(-1, 3), axis=0); dg = np.sqrt(((a - g) ** 2).sum(2))
    d = OUT + '/card%d' % c; os.makedirs(d, exist_ok=True)
    taken = np.zeros((H, W), np.float32); base = a.copy(); names = []; allm = np.zeros((H, W), np.float32)
    for n, lay in enumerate(layers, 1):
        name, box, kind = lay[0], lay[1], lay[2]; extra = lay[3] if len(lay) > 3 else None
        al = np.zeros((H, W), np.float32)
        for bx, kd in [(box, kind)] + ([(extra[:4], extra[4] if len(extra) > 4 else kind)] if extra else []):
            x0, y0, x1, y1 = [int(v * SC) for v in bx]
            al[y0:y1, x0:x1] = np.maximum(al[y0:y1, x0:x1], sel(a[y0:y1, x0:x1], dg[y0:y1, x0:x1], kd))
        al = al * (1 - taken); taken = np.maximum(taken, (al > 0.5).astype(np.float32))
        rgba = np.dstack([a * (al[..., None] > 0), al * 255]).astype(np.uint8)      # (nothing is kept where the layer is empty: the files stay small)
        Image.fromarray(rgba, 'RGBA').save('%s/%02d_%s.png' % (d, n, name), optimize=True); names.append(name)
        x0, y0, x1, y1 = [int(v * SC) for v in box]      # whatever is painted inside an element's box goes out of the background with it
        allm[y0:y1, x0:x1] = np.maximum(allm[y0:y1, x0:x1], (dg[y0:y1, x0:x1] > 50))
        allm = np.maximum(allm, al > 0.03)
    # the background: where something was lifted off, bare clay is laid: the colour of the clay round about, with the grain of a clean piece of the same clay
    hole = ndi.binary_dilation(allm > 0, iterations=6)
    idx = ndi.distance_transform_edt(hole | (dg > 40), return_distances=False, return_indices=True)      # (from the nearest bare clay, not from a dark line beside it)
    near = a[idx[0], idx[1]]
    smooth = np.dstack([ndi.gaussian_filter(near[..., ch], 30) for ch in range(3)])
    strip = a[int(H * 0.955):H - 8]; strip = np.concatenate([strip, strip[::-1]], 0)
    grain = strip - np.dstack([ndi.gaussian_filter(strip[..., ch], 12) for ch in range(3)])
    grain = np.concatenate([grain] * (H // grain.shape[0] + 1), 0)[:H]
    soft = ndi.gaussian_filter(hole.astype(np.float32), 2.0)[..., None]
    base = a * (1 - soft) + (smooth + grain) * soft
    Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).save(d + '/00_background.png', optimize=True)
    Image.fromarray(a.astype(np.uint8)).save(d + '/composite.jpg', quality=95)
    # a picture of the layers, each in a colour of its own, to check them by
    vis = (a * 0.35).copy(); cols = [(255, 80, 80), (80, 220, 80), (90, 140, 255), (255, 220, 60), (240, 90, 240), (60, 230, 230), (255, 150, 60), (180, 255, 120)]
    for n, name in enumerate(names):
        al = np.asarray(Image.open('%s/%02d_%s.png' % (d, n + 1, name)))[..., 3:4].astype(np.float32) / 255.0
        vis = vis * (1 - al * 0.8) + np.array(cols[n % 8], np.float32) * al * 0.8
    prev.append(Image.fromarray(vis.astype(np.uint8)).resize((480, 480)))
    prev.append(Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).resize((480, 480)))
    print('card', c, names)
sh = Image.new('RGB', (480 * 7, 960))
for i in range(7): sh.paste(prev[2 * i], (480 * i, 0)); sh.paste(prev[2 * i + 1], (480 * i, 480))
sh.save(S + '/v/layers_check.jpg', quality=85)
