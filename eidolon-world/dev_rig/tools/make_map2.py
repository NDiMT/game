"""EIDOLON v2.0 (Agent A): the satchel map of the NEW Chapter I (Map2), hand-drawn on parchment, with a region-id mask
for fog of war. The v1 make_map.py's look; the layout comes from the v2 world:
  EIDOLON_V2=1 godot --headless --path eidolon-world res://dev_rig/tools/map2_layout.tscn | grep ^MAP2LAYOUT | cut -c12- > layout2.json
  python3 eidolon-world/dev_rig/tools/make_map2.py layout2.json eidolon-world/assets/textures/map
Writes map_paper.jpg, map_ink.png (L), map_ids.png (L: walk-region id, 0 = always shown) and map_meta.json (world rect,
ids by region name, regions by space id ("areas"), labels, beacons' uv). Plan view, north (-z) up. Needs numpy, scipy, Pillow.
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

# ------------------------------------------------------------------ the layout (v2)
L = json.load(open(LAYOUT))
SP = {s['id']: s for s in L['spaces']}
def space_of(key):
    if key in SP: return key
    k = re.sub(r'[a-z]+$', '', key)
    return k if k in SP else key
regs = []
for r in L['regions']:
    regs.append(dict(name=r['name'], area=space_of(r['key']), x0=r['x0'], x1=r['x1'], z0=r['z0'], z1=r['z1'], y0=r['y0'], y1=r['y1']))
assert regs, 'no regions in ' + LAYOUT
names = []
for r in regs:
    if r['name'] not in names: names.append(r['name'])
ID = {n: i + 1 for i, n in enumerate(names)}
X0 = min(r['x0'] for r in regs) - 5.0; X1 = max(r['x1'] for r in regs) + 5.0
Z0 = min(r['z0'] for r in regs) - 9.0; Z1 = max(r['z1'] for r in regs) + 9.0
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
# water: every sheet of the new world, short wavy strokes where nothing stands (revealed with the space nearest it)
def nearest_region(x, z):
    best, bd = None, 1e9
    for r in regs:
        cx, cz = (r['x0'] + r['x1']) / 2, (r['z0'] + r['z1']) / 2
        d = (cx - x) ** 2 + (cz - z) ** 2
        if d < bd: best, bd = r['name'], d
    return best
def waves(x0, z0, x1, z1, owner, density=260):
    a = px(x0, z0); b = px(x1, z1)
    land = ids > 0
    for _ in range(int((b[0] - a[0]) * (b[1] - a[1]) / density)):
        cx, cy = rng.uniform(a[0], b[0]), rng.uniform(a[1], b[1])
        if not (0 <= int(cy) < H and 0 <= int(cx) < W) or land[int(cy), int(cx)]: continue
        for k in range(14):
            xq = int(cx + k - 7); yq = int(cy + 1.6 * math.sin(k * 0.9))
            if 0 <= xq < W and 0 <= yq < H and not land[yq, xq]:
                ink[yq, xq] = max(ink[yq, xq], 0.45)
                if ids[yq, xq] == 0: ids[yq, xq] = ID.get(owner, 0)
for wtr in L['water']:
    big = (wtr['x1'] - wtr['x0']) * (wtr['z1'] - wtr['z0']) > 300
    waves(wtr['x0'], wtr['z0'], wtr['x1'], wtr['z1'], nearest_region((wtr['x0'] + wtr['x1']) / 2, (wtr['z0'] + wtr['z1']) / 2), 900 if big else 260)
img = Image.fromarray((np.clip(ink, 0, 1) * 255).astype(np.uint8), 'L')
d = ImageDraw.Draw(img)
dids = Image.fromarray(ids, 'L'); di = ImageDraw.Draw(dids)
# ------------------------------------------------------------------ labels (revealed with their space)
f_big = ImageFont.truetype(F_REG, 22); f_min = ImageFont.truetype(F_IT, 15); f_wing = ImageFont.truetype(F_REG, 26)
labels = {}
taken = []          # label boxes already set (no two labels overlap: a label tries a few spots, else it is left out)
def place(text, font, cx, cy, owner, alpha=230, tries=((0, 0), (0, -15), (0, 15), (0, -28), (0, 28), (-36, 0), (36, 0), (0, -42), (0, 42))):
    bb = d.textbbox((0, 0), text, font=font); tw, th = bb[2] - bb[0], bb[3] - bb[1]
    for dx, dy in tries:
        x = int(min(max(cx + dx - tw / 2, 40), W - 40 - tw)); y = int(min(max(cy + dy - th / 2, 40), H - 60 - th))
        box = (x - 3, y - 2, x + tw + 3, y + th + 4)
        if not any(box[0] < t[2] and box[2] > t[0] and box[1] < t[3] and box[3] > t[1] for t in taken): break
    else:
        return None
    taken.append(box)
    d.text((x, y), text, font=font, fill=alpha)
    if owner in ID: di.rectangle((x - 4, y - 2, x + tw + 4, y + th + 6), fill=ID[owner])
    return [x / W, y / H, tw / W, th / H]
groups = {}
for r in regs: groups.setdefault(r['name'], []).append(r)
def owner_of(sid):
    rs = [r for r in regs if r['area'] == sid]
    return max(rs, key=lambda r: (r['x1'] - r['x0']) * (r['z1'] - r['z0']))['name'] if rs else None
# the wings and the hub: big titles, revealed with their first space
WINGS = [("THE WEST WING", ["W1", "W2", "W3", "W5", "WB"], "W3", (-30, -70)),
         ("THE NORTH WING", ["N2", "N4", "N5", "N7", "NB"], "N7", (-130, 0)),
         ("THE EAST WING", ["E1", "E2", "E3", "E5", "EB"], "E1", (60, 0)),
         ("THE ATRIUM", ["A"], "A", (0, -36)), ("THE WAKING POOL", ["WS", "P"], "P", (0, 40))]
for title, sids, at, off in WINGS:
    if at not in SP: continue
    s = SP[at]; cx, cy = px((s['x0'] + s['x1']) / 2, (s['z0'] + s['z1']) / 2)
    o = owner_of(at)
    if o: labels['wing_' + at] = place(title, f_wing, cx + off[0], cy + off[1], o, 235, tries=((0, 0), (0, -30), (0, 30), (-60, 0), (60, 0), (0, -60), (0, 60)))
# the beats: a small italic name on each space (the in-betweens too: they are places), revealed with it
SHORT = {"I21": "The Bridge", "I22": "Gate of the Four", "I23": "The First Shrine", "E5": "The Scales", "EB": "The High Beacon",
         "NB": "The Garden Beacon", "WB": "The Glass Beacon", "NS": "Cloister Stair", "EH": "High Stair", "VW": "The Veiled Way"}
for s in L['spaces']:
    o = owner_of(s['id'])
    if not o or s['kind'] == 'between': continue
    name = SHORT.get(s['id'], re.sub(r'\s*\(.*?\)', '', s['name'].split(':')[0]))
    if len(name) > 22: name = name[:21] + '.'
    cx, cy = px((s['x0'] + s['x1']) / 2, (s['z0'] + s['z1']) / 2)
    labels[s['id']] = place(name, f_min, cx, cy, o, 205)
# the Beacons: a brazier with its flame (crimson on the map when lit: map_reveal.gdshader), revealed with their space
beacon_uv = {}
for k, (bx, bz) in L['beacons'].items():
    cx, cy = px(bx, bz)
    sid = {"W": "WB", "N": "NB", "E": "EB"}.get(k, "")
    o = owner_of(sid) or nearest_region(bx, bz)
    r0 = 9
    d.ellipse((cx - r0, cy - r0 * 0.45, cx + r0, cy + r0 * 0.45), outline=230, width=2)          # the bowl
    d.line((cx - 6, cy + 4, cx - 9, cy + 13), fill=220, width=2); d.line((cx + 6, cy + 4, cx + 9, cy + 13), fill=220, width=2); d.line((cx, cy + 4, cx, cy + 14), fill=220, width=2)
    d.polygon([(cx, cy - 18), (cx - 6, cy - 4), (cx + 6, cy - 4)], outline=235)                 # the flame
    d.polygon([(cx, cy - 11), (cx - 3, cy - 4), (cx + 3, cy - 4)], fill=200)
    if o: di.rectangle((cx - 14, cy - 22, cx + 14, cy + 18), fill=ID[o])
    beacon_uv[k] = [cx / W, (cy - 6) / H]
# the Observer: a veiled head in the inlet (always there; revealed with the W.7 stones)
ox_, oz_ = L['observer']; cx, cy = px(ox_, oz_); o = owner_of("W7") or nearest_region(ox_, oz_)
d.ellipse((cx - 14, cy - 17, cx + 14, cy + 13), outline=210, width=2)
for k in range(5): d.arc((cx - 14 + k * 2, cy - 15 + k * 5, cx + 14 - k * 2, cy + 25 + k * 2), 200, 340, fill=170, width=1)
if o: di.rectangle((cx - 18, cy - 20, cx + 18, cy + 30), fill=ID[o])
labels['observer'] = place("the Observer", f_min, cx, cy + 38, o, 190) if o else None
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
t = "Chapter I · The Veiled Gate"; bb = d.textbbox((0, 0), t, font=ft)
d.text(((W - (bb[2] - bb[0])) / 2, H - 92), t, font=ft, fill=200)
for k in range(3):
    di.rectangle((0, 0, W, 40), fill=0)
img = img.filter(ImageFilter.GaussianBlur(0.45))
img.save(os.path.join(OUT, 'map_ink.png'), optimize=True)
dids.save(os.path.join(OUT, 'map_ids.png'), optimize=True)
meta = {'size': [W, H], 'world_origin': [U0, V0], 'px_per_m': S,
        'note': 'uv = ((x - world_origin.x) * px_per_m / size.x, (z - world_origin.y) * px_per_m / size.y); north (-z) up',
        'ids': ID, 'areas': {k: sorted({r['name'] for r in regs if r['area'] == k}) for k in SP}, 'labels': labels, 'beacons': beacon_uv}
json.dump(meta, open(os.path.join(OUT, 'map_meta.json'), 'w'), indent=1)
print('wrote', OUT, W, H)
