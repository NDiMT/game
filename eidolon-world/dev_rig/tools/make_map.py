"""EIDOLON v1.0 M3c (Agent A): the chapter map, hand-drawn on parchment, with a region-id mask for fog-of-war.
  godot --headless --path eidolon-world res://tests/dump_layout.tscn > layout.txt      (W's region dump)
  python3 eidolon-world/dev_rig/tools/make_map.py layout.txt eidolon-world/assets/textures/map
Writes map_paper.jpg (the blank parchment), map_ink.png (L: the ink, drawn over it by the shader), map_ids.png
(L: walk-region id per texel, 0 = always shown: frame, compass, title) and map_meta.json (world rect, ids by region
name, regions by area, label positions). Plan view, north (-z) up, x to the right. Needs numpy, scipy, Pillow.
"""
import sys, os, re, json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage as ndi

LAYOUT, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, '..', '..', 'assets', 'fonts')
F_REG = os.path.join(FONTS, 'LiberationSerif-Regular.ttf')
F_IT = os.path.join(FONTS, 'LiberationSerif-Italic.ttf')
rng = np.random.default_rng(11)

# ------------------------------------------------------------------ the regions
AREAS = {"waking_pool": "The Waking Pool", "atrium": "The Atrium of a Thousand Faces", "stair_breath": "The Stair of Breath",
         "hall_glass": "Hall of Glass", "shard_gallery": "Where Her Shadow Fell", "garden_veiled": "Garden of the Veiled",
         "hollow_walk": "Our Steps", "court_light": "Court of Light", "mist_maze": "The Mist Maze", "echo_corridor": "The Echo Corridor",
         "scales": "The Scales", "eidolon_ledge": "The Eidolon Ledge", "gate_four": "Gate of the Four Veiled", "first_shrine": "The First Shrine"}
MINOR = {"CO": "the Sunken Colossus", "TS": "the Tree of Shards", "SPB": "the Upward Spring", "T1": "the Crumbling Bridge",
         "A_scaf": "Theron's Scaffold", "T4": "the Flooded Colonnade", "UC": "the Undercroft", "BAL": "the Wind-swept Balcony"}
rx = re.compile(r'^REGION (\S*)\s+(\S+)\s+x\s+(-?[\d.]+)\.\.\s*(-?[\d.]+) z\s+(-?[\d.]+)\.\.\s*(-?[\d.]+) y (-?[\d.]+)\.\.(-?[\d.]+)')
regs = []
for line in open(LAYOUT):
    m = rx.match(line.rstrip('\n'))
    if not m: continue
    name, area = m.group(1), m.group(2)
    if not name: continue
    x0, x1, z0, z1, y0, y1 = map(float, m.groups()[2:])
    if name.startswith('pool'): area = 'waking_pool'
    regs.append(dict(name=name, area=area, x0=x0, x1=x1, z0=z0, z1=z1, y0=y0, y1=y1))
assert regs, 'no REGION lines in ' + LAYOUT
names = []
for r in regs:
    if r['name'] not in names: names.append(r['name'])
ID = {n: i + 1 for i, n in enumerate(names)}
X0 = min(r['x0'] for r in regs) - 4.0; X1 = max(r['x1'] for r in regs) + 4.0
Z0 = min(r['z0'] for r in regs) - 5.0; Z1 = max(r['z1'] for r in regs) + 6.5
W, H = 1024, 1536
S = min(W / (X1 - X0), H / (Z1 - Z0))
ox = (W - (X1 - X0) * S) / 2; oz = (H - (Z1 - Z0) * S) / 2
def px(x, z): return (ox + (x - X0) * S, oz + (z - Z0) * S)
U0 = X0 - ox / S; V0 = Z0 - oz / S          # world at texel (0, 0)
print('regions', len(regs), 'names', len(names), 'scale %.1f px/m' % S)

# ------------------------------------------------------------------ the parchment
def fbm(shape, scales, amps):
    out = np.zeros(shape)
    for s_, a in zip(scales, amps):
        n = rng.random((shape[0] // s_ + 2, shape[1] // s_ + 2))
        n = np.array(Image.fromarray((n * 255).astype(np.uint8)).resize((shape[1], shape[0]), Image.BICUBIC), float) / 255
        out += a * n
    return out / sum(amps)
n1 = fbm((H, W), [256, 96, 32, 8], [1.0, 0.6, 0.35, 0.15])
paper = np.zeros((H, W, 3))
base = np.array([0.86, 0.80, 0.68])
paper[:] = base
paper *= (0.9 + 0.2 * n1)[..., None]
# tea stains and foxing
for _ in range(8):
    cx, cy, r = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(40, 200)
    yy, xx = np.ogrid[:H, :W]; d = np.hypot(xx - cx, yy - cy) / r
    ring = np.exp(-((d - 1.0) / 0.06) ** 2) * 0.022 + np.exp(-d ** 2 * 2) * 0.03
    paper -= ring[..., None] * np.array([0.6, 0.75, 1.0])
for _ in range(60):
    cx, cy, r = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(2, 7)
    yy, xx = np.ogrid[max(0, int(cy - 20)):min(H, int(cy + 20)), max(0, int(cx - 20)):min(W, int(cx + 20))]
    paper[yy, xx] -= (np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r)) * 0.08)[..., None] * np.array([0.5, 0.7, 1.0])
# the edges: darker and burnt, a little uneven
yy, xx = np.mgrid[:H, :W]
e = np.minimum.reduce([xx, yy, W - 1 - xx, H - 1 - yy]).astype(float) + (n1 - 0.5) * 60
paper *= (0.62 + 0.38 * np.clip(e / 70, 0, 1) ** 0.6)[..., None]
paper = np.clip(paper, 0, 1)
Image.fromarray((paper * 255).astype(np.uint8)).save(os.path.join(OUT, 'map_paper.jpg'), quality=88, optimize=True)

# ------------------------------------------------------------------ the ink
ink = np.zeros((H, W))
ids = np.zeros((H, W), np.uint8)
wob = fbm((H, W), [24, 8], [1.0, 0.5]) - 0.5
def rect_mask(r, grow=0.0):
    m = np.zeros((H, W), bool)
    a = px(r['x0'] - grow, r['z0'] - grow); b = px(r['x1'] + grow, r['z1'] + grow)
    m[max(0, int(a[1])):min(H, int(math.ceil(b[1]))), max(0, int(a[0])):min(W, int(math.ceil(b[0])))] = True
    return m
groups = {}
for r in regs: groups.setdefault(r['name'], []).append(r)
order = sorted(groups, key=lambda n: max(g['y1'] for g in groups[n]) + max(g['y0'] for g in groups[n]))
for n in order:
    rs = groups[n]
    m = np.zeros((H, W), bool)
    for r in rs: m |= rect_mask(r)
    ids[ndi.binary_dilation(m, iterations=6) & (ids == 0)] = ID[n]
    ids[m] = ID[n]
    hi = max(max(r['y0'], r['y1']) for r in rs)
    soft = ndi.gaussian_filter(m.astype(float), 1.4) + wob * 0.35
    inside = soft > 0.5
    ink = np.maximum(ink, inside * (0.10 + 0.035 * hi) * (0.8 + 0.4 * n1))                     # the wash (higher = darker)
    edge = (soft > 0.36) & (soft < 0.64)
    ink = np.maximum(ink, edge * (0.78 + 0.2 * rng.random((H, W))))                          # the outline
    # ramps and stairs: hatching across the way up
    for r in rs:
        if abs(r['y1'] - r['y0']) > 0.05:
            a = px(r['x0'], r['z0']); b = px(r['x1'], r['z1'])
            along_x = (b[0] - a[0]) > (b[1] - a[1])
            step = 6
            if along_x:
                for xq in range(int(a[0]) + 3, int(b[0]) - 2, step): ink[int(a[1]) + 2:int(b[1]) - 2, xq] = np.maximum(ink[int(a[1]) + 2:int(b[1]) - 2, xq], 0.6)
            else:
                for zq in range(int(a[1]) + 3, int(b[1]) - 2, step): ink[zq, int(a[0]) + 2:int(b[0]) - 2] = np.maximum(ink[zq, int(a[0]) + 2:int(b[0]) - 2], 0.6)
# water: the colossus lake and the waking pool, short wavy strokes where nothing stands
def waves(x0, z0, x1, z1, owner):
    a = px(x0, z0); b = px(x1, z1)
    land = ids > 0
    for _ in range(int((b[0] - a[0]) * (b[1] - a[1]) / 260)):
        cx, cy = rng.uniform(a[0], b[0]), rng.uniform(a[1], b[1])
        if land[int(cy), int(cx)]: continue
        for k in range(14):
            xq = int(cx + k - 7); yq = int(cy + 1.6 * math.sin(k * 0.9))
            if 0 <= xq < W and 0 <= yq < H and not land[yq, xq]:
                ink[yq, xq] = max(ink[yq, xq], 0.45)
                if ids[yq, xq] == 0: ids[yq, xq] = ID.get(owner, 0)
waves(6.8, -4.9, 22.4, 9.6, 'T4' if 'T4' in ID else 'CO')
waves(-10.0, -0.2, -0.6, 3.6, 'T')
img = Image.fromarray((np.clip(ink, 0, 1) * 255).astype(np.uint8), 'L')
d = ImageDraw.Draw(img)
dids = Image.fromarray(ids, 'L'); di = ImageDraw.Draw(dids)
# ------------------------------------------------------------------ labels (revealed with their space)
f_big = ImageFont.truetype(F_REG, 22); f_min = ImageFont.truetype(F_IT, 17)
labels = {}
def place(text, font, cx, cy, owner, alpha=230):
    bb = d.textbbox((0, 0), text, font=font); tw, th = bb[2] - bb[0], bb[3] - bb[1]
    x = int(min(max(cx - tw / 2, 40), W - 40 - tw)); y = int(min(max(cy - th / 2, 40), H - 60 - th))
    d.text((x, y), text, font=font, fill=alpha)
    di.rectangle((x - 4, y - 2, x + tw + 4, y + th + 6), fill=ID[owner])
    return [x / W, y / H, tw / W, th / H]
ANCHOR = {"eidolon_ledge": ("E", 0, 0), "stair_breath": ("W_land", 30, 44), "first_shrine": ("sealed_way", 0, -30),
          "waking_pool": ("T", 0, -20), "garden_veiled": ("G", 0, 0), "shard_gallery": ("GL", 0, 0)}
for key, label in AREAS.items():
    rs = [r for r in regs if r['area'] == key]
    if not rs: continue
    big = max(rs, key=lambda r: (r['x1'] - r['x0']) * (r['z1'] - r['z0']))
    dx = dy = 0
    if key in ANCHOR and ANCHOR[key][0] in groups:
        big = groups[ANCHOR[key][0]][0]; dx, dy = ANCHOR[key][1], ANCHOR[key][2]
    cx, cy = px((big['x0'] + big['x1']) / 2, (big['z0'] + big['z1']) / 2)
    cx += dx; cy += dy
    text = label.upper() if len(label) < 20 else label
    labels[key] = place(text, f_big if len(label) < 26 else f_min, cx, cy, big['name'])
for n, label in MINOR.items():
    if n not in groups: continue
    rs = groups[n]
    cx, cy = px(np.mean([(r['x0'] + r['x1']) / 2 for r in rs]), np.mean([(r['z0'] + r['z1']) / 2 for r in rs]))
    labels[n] = place(label, f_min, cx, cy + 18, n, 200)
# ------------------------------------------------------------------ frame, compass, title (always shown: id 0)
d.rectangle((26, 26, W - 27, H - 27), outline=170, width=2)
d.rectangle((34, 34, W - 35, H - 35), outline=120, width=1)
cx, cy, R = W - 110, 120, 52
for ang, ln in ((0, 1.0), (90, 0.6), (180, 0.6), (270, 0.6)):
    a = math.radians(ang - 90)
    tip = (cx + math.cos(a) * R * ln, cy + math.sin(a) * R * ln)
    l = (cx + math.cos(a + 1.75) * 9, cy + math.sin(a + 1.75) * 9); rr = (cx + math.cos(a - 1.75) * 9, cy + math.sin(a - 1.75) * 9)
    d.polygon([tip, l, (cx, cy)], fill=200); d.polygon([tip, rr, (cx, cy)], outline=200)
d.ellipse((cx - R * 0.45, cy - R * 0.45, cx + R * 0.45, cy + R * 0.45), outline=150, width=1)
d.text((cx - 6, cy - R - 26), "N", font=f_big, fill=210)
ft = ImageFont.truetype(F_IT, 30)
t = "The Veiled Gate"; bb = d.textbbox((0, 0), t, font=ft)
d.text(((W - (bb[2] - bb[0])) / 2, H - 92), t, font=ft, fill=200)
for k in range(3):
    di.rectangle((0, 0, W, 40), fill=0)
img = img.filter(ImageFilter.GaussianBlur(0.45))
img.save(os.path.join(OUT, 'map_ink.png'), optimize=True)
dids.save(os.path.join(OUT, 'map_ids.png'), optimize=True)
meta = {'size': [W, H], 'world_origin': [U0, V0], 'px_per_m': S,
        'note': 'uv = ((x - world_origin.x) * px_per_m / size.x, (z - world_origin.y) * px_per_m / size.y); north (-z) up',
        'ids': ID, 'areas': {k: sorted({r['name'] for r in regs if r['area'] == k}) for k in AREAS}, 'labels': labels}
json.dump(meta, open(os.path.join(OUT, 'map_meta.json'), 'w'), indent=1)
print('wrote', OUT, W, H)
