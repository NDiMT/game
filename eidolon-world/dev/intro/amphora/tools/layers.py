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
#   red: the red cloth alone; bluer: a thin pale cloth (whatever is bluer than the clay); seed:x,y: the one thing that holds that point; sea: the band of sea, made whole
L = {
 1: [('sun', (40, 35, 165, 160), 'dark'), ('plinth', (425, 955, 680, 1042), 'dark'),
     ('theron', (105, 140, 445, 1042), 'notbright', (445, 225, 505, 410)), ('statue', (440, 160, 670, 970), 'bright'),
     ('bench_and_tools', (775, 700, 1100, 1042), 'all'), ('olive_branch', (720, 0, 1075, 365), 'dark'), ('ground_line', (0, 1040, 1100, 1062), 'all')],
 2: [('theron', (40, 400, 345, 906), 'notbright_thick'), ('plinth', (348, 858, 568, 908), 'dark'),
     ('ione', (348, 235, 570, 862), 'all_thick', (325, 780, 348, 865, 'bright')), ('aphrodite', (755, 235, 1080, 908), 'all_thick'),
     ('temple', (150, 30, 960, 908), 'thin'), ('ground_line', (0, 900, 1100, 925), 'all')],
 3: [('sun', (110, 95, 240, 220), 'dark'), ('waves', (0, 690, 446, 965), 'dark'), ('ione', (370, 100, 800, 890), 'seed:500,600', (395, 880, 560, 948, 'bright'), (440, 240, 810, 590, 'bluer'), (450, 765, 790, 892, 'soft')),
     ('rocks_door_theron', (0, 380, 1100, 1000), 'all')],
 4: [('wrapped_mirror_1', (40, 95, 260, 335), 'all'), ('wrapped_mirror_2', (40, 370, 260, 605), 'all'), ('bare_mirror', (820, 100, 1060, 338), 'all'),
     ('cloth_on_peg', (855, 370, 1005, 775), 'all'),
     ('theron', (265, 110, 500, 1010), 'all', (500, 125, 712, 200, 'dark'), (500, 200, 640, 335, 'dark'), (500, 975, 522, 1010, 'dark')),
     ('ione_veil_on_her_head', (440, 125, 740, 1010), 'all'), ('ground_line', (0, 1008, 1100, 1030), 'all')],
 5: [('sea', None, 'sea'), ('gull_1', (525, 70, 610, 120), 'all'), ('gull_2', (940, 245, 1000, 285), 'all'), ('sun', (745, 130, 885, 268), 'dark'),
     ('ione_veiled', (215, 55, 372, 545), 'colour', (225, 500, 340, 525, 'dark')), ('shore', (0, 518, 690, 552), 'dark'),
     ('reflection', (205, 553, 375, 1050), 'all'), ('sun_road', (735, 553, 900, 1098), 'all')],
 6: [('sea', None, 'sea'), ('sun', (200, 88, 348, 236), 'dark'), ('boat_and_ione', (120, 220, 980, 634), 'all'), ('reflection', (110, 634, 985, 1040), 'all')],
 7: [('sea', None, 'sea'), ('sun', (805, 105, 960, 262), 'dark'), ('theron_on_shore', (0, 135, 375, 712), 'all'), ('boat', (380, 605, 738, 722), 'dark'),
     ('veil', (780, 680, 1095, 812), 'red'), ('boat_reflection', (375, 712, 740, 835), 'all'), ('rings', (735, 705, 1100, 815), 'all')],
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
    elif k == 'soft': al = np.clip((dg - 20) / 18.0, 0, 1) * np.clip((np.abs(a - SEACOL).sum(2) - 30) / 25.0, 0, 1)      # pale paint that is close to the clay's own colour
    elif k == 'red': al = al * np.clip((a[..., 0] - a[..., 1] * 1.6) / 20.0, 0, 1)
    elif k == 'bluer': al = np.clip((a[..., 2] - 99) / 14.0, 0, 1) * np.clip((np.abs(a - SEACOL).sum(2) - 30) / 25.0, 0, 1)      # a thin pale cloth: whatever is bluer than the clay
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
        name, box, kind = lay[0], lay[1], lay[2]; extras = lay[3:]
        if kind == 'sea':      # the band of sea, whole: where something lies on it, sea is laid under
            rgb = np.where(seam[..., None], a, SEACOL + np.random.default_rng(c).normal(0, 1.5, (H, W, 1))); alp = np.zeros((H, W), np.float32); alp[sea_top:] = 255
            Image.fromarray(np.dstack([np.clip(rgb, 0, 255) * (alp[..., None] > 0), alp]).astype(np.uint8), 'RGBA').save('%s/%02d_%s.png' % (d, n, name), optimize=True); names.append(name)
            allm[sea_top - 3:] = 1; continue
        al = np.zeros((H, W), np.float32)
        for bx, kd in [(box, kind)] + [(e[:4], e[4] if len(e) > 4 else kind) for e in extras]:
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
