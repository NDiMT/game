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
#   red: the red cloth alone; seed:x,y: the one thing that holds that point; sea: the band of sea, made whole
L = {
 1: [('sun', (105, 75, 255, 225), 'dark'), ('waves', (0, 905, 242, 1056), 'all'), ('plinth', (608, 975, 842, 1060), 'dark'),
     ('theron', (255, 195, 690, 1060), 'notbright'), ('statue', (630, 215, 828, 990), 'bright'),
     ('bench_and_tools', (870, 650, 1100, 1060), 'all'), ('olive_branch', (545, 0, 1100, 215), 'dark', (770, 215, 1100, 475)), ('ground_line', (0, 1040, 1100, 1072), 'all')],
 2: [('theron', (55, 420, 405, 1008), 'notbright_thick'), ('aphrodite', (652, 150, 1100, 1010), 'all_thick', (630, 200, 652, 440)),
     ('plinth', (400, 952, 670, 1010), 'dark'), ('ione', (378, 200, 652, 952), 'all_thick'), ('temple', (150, 30, 1000, 660), 'thin'), ('ground_line', (0, 990, 1100, 1024), 'all')],
 3: [('sun', (105, 95, 258, 246), 'dark'), ('waves', (0, 708, 437, 876), 'all'), ('ione', (383, 140, 885, 872), 'seed:600,600', (383, 872, 660, 940, 'bright')),
     ('rocks_door_theron', (0, 400, 1100, 1000), 'all')],
 4: [('wrapped_mirror_1', (0, 70, 270, 340), 'all'), ('wrapped_mirror_2', (0, 400, 270, 665), 'all'), ('bare_mirror', (835, 70, 1100, 330), 'all'),
     ('cloth_on_peg', (858, 503, 980, 858), 'all', (895, 462, 945, 503, 'red')), ('hand_mirror_and_peg', (880, 458, 1100, 650), 'all'),
     ('ione_with_her_face', (585, 190, 860, 1030), 'all'), ('veil_held_above', (520, 80, 810, 760), 'red'),
     ('theron', (300, 60, 600, 1030), 'all', (600, 60, 800, 300, 'dark')), ('ground_line', (0, 1000, 1100, 1040), 'all')],
 5: [('sea', None, 'sea'), ('gull_1', (540, 15, 670, 105), 'all'), ('gull_2', (950, 215, 1070, 305), 'all'), ('sun', (770, 45, 915, 195), 'dark'),
     ('ione_veiled', (150, 0, 400, 585), 'colour', (190, 540, 380, 590, 'dark')), ('shore', (0, 540, 460, 616), 'dark'),
     ('reflection', (120, 614, 420, 1090), 'all'), ('sun_road', (760, 614, 930, 1098), 'all')],
 6: [('sea', None, 'sea'), ('sun', (75, 50, 225, 195), 'dark'), ('boat_and_ione', (100, 230, 945, 677), 'all'), ('reflection', (100, 678, 960, 1096), 'all')],
 7: [('sea', None, 'sea'), ('sun', (845, 225, 990, 365), 'dark'), ('theron_on_shore', (0, 480, 225, 712), 'all'), ('boat', (310, 600, 760, 748), 'dark'),
     ('veil', (776, 738, 1022, 804), 'red'), ('boat_reflection', (300, 748, 770, 892), 'all'), ('rings', (740, 715, 1100, 840), 'all')],
}
SEACOL = np.array([20, 54, 68], np.float32)
def sel(a, dg, kind):
    lum = a.mean(2); sat = a.max(2) - a.min(2)
    al = np.clip((dg - 55) / 40.0, 0, 1) * np.clip((np.abs(a - SEACOL).sum(2) - 30) / 25.0, 0, 1)      # not clay, not sea
    k = kind.replace('_thick', '')
    if k == 'dark': al = al * np.clip((85 - lum) / 25.0, 0, 1)
    elif k == 'bright': al = al * np.clip((lum - 150) / 30.0, 0, 1)
    elif k == 'colour': al = al * np.clip(np.maximum(sat - 28, lum - 95) / 20.0, 0, 1)
    elif k == 'notbright': al = al * np.clip((165 - lum) / 25.0, 0, 1)
    elif k == 'red': al = al * np.clip((a[..., 0] - a[..., 1] * 1.6) / 20.0, 0, 1)
    elif k.startswith('seed:'):
        sx, sy = [int(int(v) * SC) for v in k[5:].split(',')]; lab, n = ndi.label(al > 0.3); kk = lab[sy - sel.org[1], sx - sel.org[0]]; assert kk > 0
        al = al * ndi.binary_dilation(lab == kk, iterations=3)
    if kind.endswith('_thick'): al = al * ndi.binary_dilation(ndi.binary_opening(al > 0.3, iterations=7), iterations=8)
    if k == 'thin': al = al * (1 - ndi.binary_dilation(ndi.binary_opening(al > 0.3, iterations=7), iterations=8))      # only the thin lines (a building drawn in line)
    return al
os.makedirs(OUT, exist_ok=True); prev = []
for c, layers in L.items():
    a = np.asarray(Image.open(S + '/v/big/panel%d.png' % c).convert('RGB')).astype(np.float32)
    H, W, _ = a.shape; g = np.median(a[10:110].reshape(-1, 3), axis=0); dg = np.sqrt(((a - g) ** 2).sum(2))
    d = OUT + '/card%d' % c; os.makedirs(d, exist_ok=True)
    taken = np.zeros((H, W), np.float32); base = a.copy(); names = []; allm = np.zeros((H, W), np.float32)
    for f in os.listdir(d):
        if f.endswith('.png'): os.remove(d + '/' + f)
    seam = np.abs(a - SEACOL).sum(2) < 45; rows = np.where(seam.mean(1) > 0.5)[0]; sea_top = rows.min() if len(rows) > 100 else H
    for n, lay in enumerate(layers, 1):
        name, box, kind = lay[0], lay[1], lay[2]; extra = lay[3] if len(lay) > 3 else None
        if kind == 'sea':      # the band of sea, whole: where something lies on it, sea is laid under
            rgb = np.where(seam[..., None], a, SEACOL + np.random.default_rng(c).normal(0, 1.5, (H, W, 1))); alp = np.zeros((H, W), np.float32); alp[sea_top:] = 255
            Image.fromarray(np.dstack([np.clip(rgb, 0, 255) * (alp[..., None] > 0), alp]).astype(np.uint8), 'RGBA').save('%s/%02d_%s.png' % (d, n, name), optimize=True); names.append(name)
            allm[sea_top - 3:] = 1; continue
        al = np.zeros((H, W), np.float32)
        for bx, kd in [(box, kind)] + ([(extra[:4], extra[4] if len(extra) > 4 else kind)] if extra else []):
            x0, y0, x1, y1 = [int(v * SC) for v in bx]; sel.org = (x0, y0)
            al[y0:y1, x0:x1] = np.maximum(al[y0:y1, x0:x1], sel(a[y0:y1, x0:x1], dg[y0:y1, x0:x1], kd))
        al = al * (1 - taken); taken = np.maximum(taken, (al > 0.5).astype(np.float32))
        rgba = np.dstack([a * (al[..., None] > 0), al * 255]).astype(np.uint8)      # (nothing is kept where the layer is empty: the files stay small)
        Image.fromarray(rgba, 'RGBA').save('%s/%02d_%s.png' % (d, n, name), optimize=True); names.append(name)
        x0, y0, x1, y1 = [int(v * SC) for v in box]      # whatever is painted inside an element's box goes out of the background with it
        allm[y0:y1, x0:x1] = np.maximum(allm[y0:y1, x0:x1], (dg[y0:y1, x0:x1] > 50))
        allm = np.maximum(allm, al > 0.03)
    # the background: where something was lifted off, bare clay is laid: the colour of the clay round about, with the grain of a clean piece of the same clay
    hole = ndi.binary_dilation(allm > 0, iterations=6)
    notclay = hole | (dg > 40); notclay[0, 0] = False if notclay.all() else notclay[0, 0]
    idx = ndi.distance_transform_edt(notclay, return_distances=False, return_indices=True)      # (from the nearest bare clay, not from a dark line beside it)
    near = a[idx[0], idx[1]]
    if sea_top < H: near[sea_top - 6:] = g      # under the sea: plain clay
    smooth = np.dstack([ndi.gaussian_filter(near[..., ch], 30) for ch in range(3)])
    busy = ndi.maximum_filter((dg > 26).astype(np.uint8), size=(100, 300), origin=(-50, -150))      # a clean piece of bare clay, 300 x 100, to take the grain from
    ys, xs = np.where(busy[:H - 100, :W - 300] == 0); assert len(ys), 'no clean clay'
    j = len(ys) // 2; pc = a[ys[j]:ys[j] + 100, xs[j]:xs[j] + 300]
    pc = pc - np.dstack([ndi.gaussian_filter(pc[..., ch], 12) for ch in range(3)])
    pc = np.concatenate([pc, pc[:, ::-1]], 1); pc = np.concatenate([pc, pc[::-1]], 0)
    grain = np.tile(pc, (H // pc.shape[0] + 1, W // pc.shape[1] + 1, 1))[:H, :W]
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
