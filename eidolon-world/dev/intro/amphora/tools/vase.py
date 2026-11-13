#!/usr/bin/env python3
# EIDOLON intro: seven scenes painted on a turning amphora. A stylised vase (a surface of revolution drawn by this
# script), the camera close on its picture panel, the words written on the black band under it.
import sys, os, math, pickle, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage as ndi
from scipy.interpolate import PchipInterpolator

S = '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/gem'
W, Hh, FPS = 1080, 1920, 24
R0 = 830.0                      # the vase's radius at the panel, in screen pixels
K = 1100.0 / 855.0              # texture pixels per screen pixel on the surface
SLOT = 72.0                     # degrees from one scene to the next
PANEL = 62.0                    # degrees the panel takes
PXD = 1100.0 / PANEL            # texture pixels per degree
SW = int(round(SLOT * PXD))     # a slot's width in texture pixels
H_TOP, H_BOT = -120.0, 2080.0   # the stretch of the vase that is drawn (screen pixels down the surface)
TH = int((H_BOT - H_TOP) * K)   # texture height
PAN_H0 = 335.0                  # where the panel begins
PW, PH = 1100, 1100
TXT_H0, TXT_H1 = 1206.0, 1700.0
CLAY = np.load(S + '/v/clay.npy').astype(np.float32); BLACK = np.array([24, 19, 20], np.float32); DRED = np.array([122, 30, 22], np.float32)
CREAM = (244, 220, 178); SEACOL = np.array([20, 54, 68], np.float32)
TILT = math.radians(9.0)
FAC = 6.0; SUN = np.array([1.05, 1.0, 0.93], np.float32); SHADE = np.array([0.66, 0.62, 0.80], np.float32)
LIFT = np.array([24, 17, 42], np.float32); FACJ = (np.random.default_rng(5).uniform(-1, 1, 60) * 0.05).astype(np.float32); RIM = np.array([236, 228, 250], np.float32)

def ty(h): return (h - H_TOP) * K
def tx(u): return (u + SLOT * 0.5) * PXD

PAGES = [      # each card: its sentences, shown one page at a time
 ["On Kythira there lived a sculptor named Theron.", "From white marble he carved a woman, and loved her more than stone should be loved."],
 ["After Theron's prayers, Aphrodite gave her life, on one condition:", "“Leave her face smooth. A face is carved by living, from within.”"],
 ["They called her Ione. And life began to carve her a face, a face the sculptor had never imagined.", "He could not bear a face he had not carved himself."],
 ["So he covered her face with a veil, so that he need not see it.", "And he hid every mirror, so that she never would.", "For as long as she had not seen her own face, she was still only what he had made."],
 ["But there was one mirror he could not hide: the sea.", "One morning the Aegean lay still as glass, and at the water's edge Ione saw a veiled woman looking up at her.", "She had never seen her before."],
 ["She wanted to see her closer.", "So that morning Ione rowed out alone, to where the water lay stillest, and leaned over the side to look."],
 ["The sea took her. There was no wave to blame."],
]
FONT = ImageFont.truetype('/home/user/game/eidolon-demo/fonts/EBGaramond-Italic.ttf', 86)      # the game's own letter
try: FONT.set_variation_by_axes([620])
except Exception as e: print('font weight:', e)
LH = 104; TXT_W = 1010.0; INK = np.array([252, 243, 222], np.float32)
def wrap(text):      # the fewest lines that fit, and of those the most even
    words = text.split(); wl = lambda i, j: FONT.getlength(' '.join(words[i:j]))
    if text.count('. ') == 1 and len(text) < 60:      # two short sentences: one to a line
        a, b2 = text.split('. '); return [a + '.', b2]
    n = len(words); best = None
    for k in range(1, 9):
        INF = 1e18; cost = [[INF] * (n + 1) for _ in range(k + 1)]; prev = [[0] * (n + 1) for _ in range(k + 1)]; cost[0][0] = 0
        for l in range(1, k + 1):
            for j in range(1, n + 1):
                for i in range(j):
                    w = wl(i, j)
                    if w > TXT_W or cost[l - 1][i] >= INF: continue
                    c = cost[l - 1][i] + (TXT_W - w) ** 2
                    if j < n and words[j - 1].lower() in ('a', 'the', 'of', 'to', 'and', 'her', 'he', 'so'): c += 3e5      # no little word left hanging at a line's end
                    if c < cost[l][j]: cost[l][j] = c; prev[l][j] = i
        if cost[k][n] < INF:
            out = []; j = n
            for l in range(k, 0, -1): i = prev[l][j]; out.insert(0, ' '.join(words[i:j])); j = i
            return out
    return [text]
TEXTS = [[wrap(t) for t in card] for card in PAGES]      # card -> pages -> lines
NL = max(sum(len(pg) for pg in card) for card in TEXTS)
def final_wr(i):      # the card's last page, fully written
    card = TEXTS[i]; n = sum(len(pg) for pg in card); k = len(card[-1])
    return [0.0] * (n - k) + [1.0] * k + [0.0] * (NL - n)

# ---------------------------------------------------------------- the ornament bands, the same all round
def palmette(dr, cx, base_y, h, col, up=True):
    s = 1 if up else -1
    for a in (-66, -44, -22, 0, 22, 44, 66):
        L = h * (0.98 if a == 0 else 0.9 - 0.0022 * abs(a) * 1.2)
        ex = cx + math.sin(math.radians(a)) * L; ey = base_y - s * math.cos(math.radians(a)) * L
        wdt = h * 0.085
        nx, ny = (ey - base_y), -(ex - cx); n = math.hypot(nx, ny) or 1; nx, ny = nx / n * wdt, ny / n * wdt
        mx, my = cx + (ex - cx) * 0.62, base_y + (ey - base_y) * 0.62
        dr.polygon([(cx, base_y - s * h * 0.1), (mx + nx, my + ny), (ex, ey), (mx - nx, my - ny)], fill=col)
        dr.ellipse((ex - wdt, ey - wdt, ex + wdt, ey + wdt), fill=col)
    r = h * 0.14
    dr.ellipse((cx - r, base_y - s * h * 0.1 - r, cx + r, base_y - s * h * 0.1 + r), fill=col)
    for e in (-1, 1):
        dr.arc((cx + e * h * 0.42 - h * 0.2, base_y - s * h * 0.2 - h * 0.2, cx + e * h * 0.42 + h * 0.2, base_y - s * h * 0.2 + h * 0.2), 0, 360, fill=col, width=max(3, int(h * 0.06)))

def ornaments():
    im = Image.new('RGB', (SW, TH), tuple(BLACK.astype(int))); dr = ImageDraw.Draw(im)
    clay = tuple(CLAY.astype(int)); blk = tuple(BLACK.astype(int)); red = tuple(DRED.astype(int))
    # the neck: palmettes in clay on the black
    n = 6; p = SW / n
    for i in range(n): palmette(dr, (i + 0.5) * p, ty(118), ty(118) - ty(28), clay)
    dr.rectangle((0, ty(126), SW, ty(132)), fill=clay); dr.rectangle((0, ty(18), SW, ty(23)), fill=clay)
    dr.rectangle((0, ty(150), SW, ty(160)), fill=clay)                       # the ridge where the neck meets the shoulder
    # the shoulder: tongues
    dr.rectangle((0, ty(170), SW, ty(332)), fill=clay)
    n = 30; p = SW / n
    for i in range(n):
        x0 = i * p + p * 0.14; x1 = (i + 1) * p - p * 0.14
        dr.rounded_rectangle((x0, ty(174), x1, ty(250)), radius=int(p * 0.36), fill=blk if i % 2 == 0 else red)
        dr.rectangle((x0, ty(174), x1, ty(200)), fill=blk if i % 2 == 0 else red)
    dr.rectangle((0, ty(170), SW, ty(175)), fill=blk); dr.rectangle((0, ty(256), SW, ty(261)), fill=blk)
    # the chain of palmettes over the panel
    n = 9; p = SW / n
    for i in range(n):
        palmette(dr, (i + 0.5) * p, ty(322), ty(322) - ty(270), blk)
        dr.arc(((i + 1) * p - p * 0.2, ty(296), (i + 1) * p + p * 0.2, ty(330)), 180, 360, fill=blk, width=5)
    dr.rectangle((0, ty(325), SW, ty(331)), fill=blk)
    # under the text band: the meander, and the rays
    dr.rectangle((0, ty(1706), SW, ty(1992)), fill=clay)
    dr.rectangle((0, ty(1706), SW, ty(1712)), fill=blk); dr.rectangle((0, ty(1790), SW, ty(1797)), fill=blk)
    n = 18; p = SW / n; y0 = ty(1722); y1 = ty(1782); t = 9
    for i in range(n):
        x = i * p
        dr.line([(x, y1), (x, y0), (x + p * 0.78, y0), (x + p * 0.78, y1 - (y1 - y0) * 0.3), (x + p * 0.34, y1 - (y1 - y0) * 0.3), (x + p * 0.34, y0 + (y1 - y0) * 0.36), (x + p * 0.56, y0 + (y1 - y0) * 0.36)], fill=blk, width=t, joint='curve')
        dr.line([(x, y1), (x + p, y1)], fill=blk, width=t)
    n = 18; p = SW / n
    for i in range(n): dr.polygon([(i * p + p * 0.12, ty(1992)), ((i + 0.5) * p, ty(1806)), ((i + 1) * p - p * 0.12, ty(1992))], fill=blk)
    a = np.asarray(im).astype(np.float32)
    rng = np.random.default_rng(7)
    g = ndi.gaussian_filter(rng.normal(0, 1, (TH, SW)), 1.2) * 5.0 + ndi.gaussian_filter(rng.normal(0, 1, (TH, SW)), 14) * 26.0   # the grain of fired clay
    isclay = (np.abs(a - CLAY).sum(2) < 60)[..., None]
    a = np.clip(a + g[..., None] * np.where(isclay, 1.0, 0.25), 0, 255)
    return a.astype(np.uint8)

# ---------------------------------------------------------------- the scenes, and what moves in them
class Scene:
    def __init__(self, c):
        self.c = c
        self.img = np.asarray(Image.open(S + '/v/panel%d.png' % c).convert('RGB')).astype(np.float32)
        a = self.img
        self.g = np.median(a[5:60].reshape(-1, 3), axis=0)
        self.dg = np.sqrt(((a - self.g) ** 2).sum(2))
        self.sea = np.zeros(a.shape[:2], bool); self.seacol = SEACOL.copy()
        rows = np.where((np.abs(a - SEACOL).sum(2) < 45).mean(1) > 0.5)[0]
        if len(rows) > 100: self.sea[rows.min():] = np.abs(a[rows.min():] - SEACOL).sum(2) < 45
        self.ds = np.sqrt(((a - self.seacol) ** 2).sum(2))
        gt = a[5:95]; self.gfill = np.concatenate([gt, gt[::-1]] * 7, 0)[:PH]          # plain ground, to lay where something is lifted off
        self.base = a.copy(); self.els = []; self.fx = []
        rng = np.random.default_rng(100 + c)
        self.strokes = [(rng.uniform(0, 1), rng.uniform(0.08, 0.92), rng.uniform(60, 150), rng.uniform(0.4, 1.0), rng.uniform(0, 6.28)) for _ in range(7)]
    def lift(self, name, box, kind, only=None, thick=0, cut=(), seed=None, **kw):
        # an element is cut out of the picture: what is not ground inside its box (only='colour': not the black
        # either; only='bright': the pale parts alone). What lay under it is filled from what lies round it
        x0, y0, x1, y1 = box; pad = 16
        X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(PW, x1 + pad), min(PH, y1 + pad)
        sub0 = self.img[Y0:Y1, X0:X1]
        al = np.clip((self.dg[Y0:Y1, X0:X1] - 55) / 40.0, 0, 1)
        lum = sub0.mean(2); sat = sub0.max(2) - sub0.min(2)
        if only == 'colour': al = al * np.clip((np.maximum(sat - 28, lum - 95)) / 20.0, 0, 1)
        if only == 'bright': al = al * np.clip((lum - 150) / 30.0, 0, 1)
        if only == 'dark': al = al * np.clip((80 - lum) / 25.0, 0, 1)
        if only == 'notbright': al = al * np.clip((165 - lum) / 25.0, 0, 1)
        if only == 'red': al = al * np.clip((sub0[..., 0] - sub0[..., 1] * 1.6) / 20.0, 0, 1)
        inb = np.zeros_like(al); inb[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = 1
        for (cx0, cy0, cx1, cy1) in cut: inb[max(0, cy0 - Y0):max(0, cy1 - Y0), max(0, cx0 - X0):max(0, cx1 - X0)] = 0      # parts of the box that belong to something else
        al = al * inb
        if seed:      # only the thing that holds this point
            lab, n = ndi.label(al > 0.3); k = lab[seed[1] - Y0, seed[0] - X0]; assert k > 0, (name, 'seed on ground')
            al = al * ndi.binary_dilation(lab == k, iterations=2)
        if thick:      # thin lines that happen to cross its box (a column behind a figure) stay where they are
            al = al * ndi.binary_dilation(ndi.binary_opening(al > 0.3, iterations=thick), iterations=thick + 1)
        patch = np.dstack([sub0, al * 255.0]).astype(np.uint8)
        hole = ndi.binary_dilation(al > 0.03, iterations=3)
        sub = self.base[Y0:Y1, X0:X1]
        if hole.any() and not hole.all():
            idx = ndi.distance_transform_edt(hole, return_distances=False, return_indices=True)
            fill = sub[idx[0], idx[1]]
            soft = ndi.gaussian_filter(hole.astype(np.float32), 1.0)[..., None]
            self.base[Y0:Y1, X0:X1] = sub * (1 - soft) + fill * soft
        self.els.append(dict(name=name, org=(X0, Y0), patch=patch, kind=kind, **kw))
    def frame(self, t):
        out = self.base.copy()
        if self.sea.any():      # the still sea: a few thin lights that come and go
            ys, xs = np.where(self.sea); sy0, sy1, sx0, sx1 = ys.min(), ys.max(), xs.min(), xs.max()
            for (px, py, ln, sp, ph) in self.strokes:
                a = 0.5 + 0.5 * math.sin(t * 0.5 * sp + ph)
                if a < 0.15: continue
                y = int(sy0 + 14 + (sy1 - sy0 - 60) * py); x = int(sx0 + 20 + ((px + t * 0.006 * sp) % 1.0) * (sx1 - sx0 - ln - 40))
                seg = out[y:y + 2, x:x + int(ln)]; m = self.sea[y:y + 2, x:x + int(ln)][..., None]
                out[y:y + 2, x:x + int(ln)] = seg + m * np.array([26, 44, 46], np.float32) * (a - 0.15) * np.hanning(seg.shape[1])[None, :, None]
        for f in self.fx:
            if f['kind'] == 'waver':      # what the water shows trembles a little
                x0, y0, x1, y1 = f['box']; reg = out[y0:y1, x0:x1]
                yy, xx = np.mgrid[0:y1 - y0, 0:x1 - x0].astype(np.float32)
                win = np.clip(np.minimum(np.minimum(yy, (y1 - y0) - 1 - yy), np.minimum(xx, (x1 - x0) - 1 - xx)) / 26.0, 0, 1)      # it dies away toward the edge of its place
                dx = f.get('amp', 2.2) * np.sin(yy / f.get('lam', 15.0) + t * f.get('w', 1.5)) * win
                dy = f.get('bob', 0.0) * math.sin(t * f.get('bw', 0.9))
                for ch in range(3): reg[..., ch] = ndi.map_coordinates(reg[..., ch], [yy + dy, xx + dx], order=1, mode='nearest')
                out[y0:y1, x0:x1] = reg
        for e in self.els:
            p = e['patch']; X0, Y0 = e['org']; k = e['kind']
            if k == 'rock':      # it rocks about a point, and may rise and fall
                ang = e.get('amp', 0.8) * math.sin(t * e.get('w', 0.9) + e.get('ph', 0.0)); dy = e.get('bob', 0.0) * math.sin(t * e.get('bw', 0.9) + e.get('ph', 0.0)); dx = e.get('drift', 0.0) * math.sin(t * e.get('dw', 0.35))
                im = Image.fromarray(p, 'RGBA').rotate(ang, resample=Image.BICUBIC, center=(e['pivot'][0] - X0, e['pivot'][1] - Y0), translate=(dx, dy))
                q = np.asarray(im).astype(np.float32)
            elif k == 'flutter':      # cloth or hair in the wind: it moves more the farther it is from where it is held
                hh, ww = p.shape[:2]; yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
                gy, gx = yy + Y0, xx + X0; ax, ay = e['anchor']
                if e.get('dir', 'x') == 'x':
                    far = np.clip((gx - ax) * e.get('sign', 1.0) / e.get('reach', 200.0), 0, 1.4)
                    dy = e.get('amp', 5.0) * far * np.sin(gx / e.get('lam', 55.0) * e.get('sign', 1.0) - t * e.get('w', 2.2) + gy / 90.0); dx = 0.35 * dy
                else:
                    far = np.clip((gy - ay) / e.get('reach', 400.0), 0, 1.3)
                    dx = e.get('amp', 3.0) * far * np.sin(gy / e.get('lam', 120.0) - t * e.get('w', 1.1) + e.get('ph', 0.0)); dy = np.zeros_like(dx)
                q = np.dstack([ndi.map_coordinates(p[..., ch].astype(np.float32), [yy + dy, xx + dx], order=1, mode='constant') for ch in range(4)])
            else:
                q = p.astype(np.float32)
            if e.get('sheen'):      # a light passes over it
                hh, ww = q.shape[:2]; yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
                per = e['sheen']; pos = ((t % per) / per) * (hh + ww) * 1.5 - 0.25 * (hh + ww)
                band = np.exp(-((xx * 0.5 + yy - pos) / 34.0) ** 2) * e.get('sheen_k', 26.0) * np.clip((q[..., :3].mean(2) - 140) / 40.0, 0, 1)
                q[..., :3] = np.clip(q[..., :3] + band[..., None], 0, 255)
            if e.get('pulse'): q[..., :3] = np.clip(q[..., :3] * (1.0 + e['pulse'] * math.sin(t * 0.8)), 0, 255)
            hh, ww = q.shape[:2]; al = q[..., 3:4] / 255.0
            reg = out[Y0:Y0 + hh, X0:X0 + ww]; out[Y0:Y0 + hh, X0:X0 + ww] = reg * (1 - al) + q[..., :3] * al
        for f in self.fx:
            if f['kind'] == 'glint':      # a spark on bronze
                a = max(0.0, math.sin(t * f.get('w', 1.3) + f.get('ph', 0.0))) ** 6
                if a > 0.02:
                    x, y = f['at']; r = int(f.get('r', 16)); yy, xx = np.mgrid[-r:r + 1, -r:r + 1].astype(np.float32)
                    star = np.clip(np.exp(-(xx ** 2 + (yy * 4.5) ** 2) / (r * r * 0.5)) + np.exp(-((xx * 4.5) ** 2 + yy ** 2) / (r * r * 0.5)), 0, 1)[..., None] * a
                    reg = out[y - r:y + r + 1, x - r:x + r + 1]; out[y - r:y + r + 1, x - r:x + r + 1] = reg * (1 - star) + np.array([255, 236, 190], np.float32) * star
            if f['kind'] == 'rings':      # rings widen on the water where something went under
                x, y = f['at']
                for j in range(3):
                    ph = ((t * 0.22 + j / 3.0) % 1.0); rx = 18 + 95 * ph; ry = rx * 0.2; a = math.sin(math.pi * ph) ** 0.7 * 0.5 * (1 - 0.5 * ph)
                    th = np.linspace(0, 6.283, 200); px = (x + rx * np.cos(th)).astype(int); py = (y + ry * np.sin(th)).astype(int)
                    ok = (px >= 0) & (px < PW) & (py >= 0) & (py < PH); px, py = px[ok], py[ok]
                    for oy in (0, 1): out[np.clip(py + oy, 0, PH - 1), px] = out[np.clip(py + oy, 0, PH - 1), px] * (1 - a) + np.array([214, 196, 170], np.float32) * a
        return np.clip(out, 0, 255).astype(np.uint8)

def scenes():
    sc = [Scene(c) for c in range(1, 8)]
    s = sc[0]      # 1: a light passes over the marble; the olive branch stirs; the sea runs
    s.lift('marble', (630, 215, 828, 990), 'still', only='bright', sheen=6.0, sheen_k=22.0)
    br = dict(dir='y', anchor=(900, 0), reach=430.0, amp=5.0, lam=170.0, w=1.2)
    s.lift('branch_a', (545, 0, 1100, 215), 'flutter', only='dark', **br)
    s.lift('branch_b', (770, 215, 1100, 475), 'flutter', only='dark', **br)
    s.lift('waves', (0, 905, 242, 1056), 'rock', pivot=(120, 1056), amp=0.0, bob=2.4, bw=1.3, drift=4.5, dw=0.65)
    s = sc[1]      # 2: he bows as he prays; she sways on her first step; the mirror catches the light
    s.lift('sculptor', (55, 420, 405, 1008), 'rock', only='notbright', thick=4, cut=[(372, 860, 405, 1008)], pivot=(230, 1005), amp=1.2, w=0.7)
    s.lift('woman', (378, 200, 652, 952), 'rock', thick=4, cut=[(630, 200, 652, 440), (378, 500, 406, 640)], pivot=(500, 950), amp=0.5, w=0.9, ph=1.0)
    s.fx.append(dict(kind='glint', at=(673, 315), r=26, w=1.1))
    s = sc[2]      # 3: her hair, her shawl and her dress in the wind; the sea runs
    s.lift('woman', (438, 140, 885, 872), 'flutter', seed=(600, 600), anchor=(610, 0), sign=1.0, reach=250.0, amp=6.0, lam=66.0, w=2.3)
    s.lift('waves', (0, 708, 437, 876), 'rock', pivot=(210, 876), amp=0.0, bob=2.4, bw=1.3, drift=4.5, dw=0.65)
    s = sc[3]      # 4: the one bare mirror still shines; the cloth that waits for it stirs; a spark on the small mirror
    s.lift('mirror', (885, 75, 1045, 232), 'still', only='bright', sheen=4.5, sheen_k=22.0)
    s.lift('cloth', (858, 503, 980, 858), 'flutter', dir='y', anchor=(918, 503), reach=330.0, amp=3.4, lam=140.0, w=1.0)
    s.fx.append(dict(kind='glint', at=(1020, 585), r=18, w=0.9, ph=2.0))
    s = sc[4]      # 5: the gulls hang; the sun's road and the woman in the water tremble
    s.lift('gull1', (556, 26, 654, 94), 'rock', pivot=(605, 60), amp=4.0, w=1.6, bob=4.0, bw=0.7, drift=6.0)
    s.lift('gull2', (958, 226, 1058, 298), 'rock', pivot=(1008, 262), amp=4.0, w=1.5, ph=1.3, bob=4.0, bw=0.6, drift=6.0)
    s.fx.append(dict(kind='waver', box=(776, 614, 914, 1096), amp=3.2, lam=11.0, w=1.6))
    s.fx.append(dict(kind='waver', box=(166, 614, 424, 1060), amp=2.8, lam=13.0, w=1.4))
    s = sc[5]      # 6: the boat rides; what the water shows of it trembles
    s.fx.append(dict(kind='waver', box=(100, 682, 960, 1096), amp=2.8, lam=14.0, w=1.5))
    s.lift('boat', (100, 230, 945, 675), 'rock', pivot=(520, 662), amp=0.6, w=1.0, bob=1.5, bw=1.0)
    s = sc[6]      # 7: the veil lies on the water and moves with it; rings widen where she went down
    s.fx.append(dict(kind='waver', box=(300, 748, 770, 892), amp=2.2, lam=12.0, w=1.3))
    s.fx.append(dict(kind='rings', at=(900, 774)))
    s.lift('veil', (776, 738, 1022, 804), 'flutter', only='red', anchor=(790, 0), sign=1.0, reach=240.0, amp=2.6, lam=52.0, w=1.6)
    return sc

# ---------------------------------------------------------------- old age: the vase has been in the ground a long time
def aging():
    # five slots' worth (the whole way round), so that no two neighbouring pictures wear the same marks
    from scipy.spatial import Voronoi
    Wd = SW * 5; rng = np.random.default_rng(31)
    cr = Image.new('L', (Wd, TH), 0); dr = ImageDraw.Draw(cr)
    pts = rng.uniform(0, 1, (1100, 2)) * [Wd, TH]
    vor = Voronoi(np.vstack([pts, pts + [Wd, 0], pts - [Wd, 0]]))
    for a, b in vor.ridge_vertices:      # the fine net of cracks in the glaze: most of it faint, some of it missing
        if a < 0 or b < 0 or rng.uniform() < 0.42: continue
        p, q = vor.vertices[a], vor.vertices[b]
        if not (-50 < p[0] < Wd + 50 and -50 < p[1] < TH + 50): continue
        m = (p + q) * 0.5 + rng.normal(0, 3.0, 2)
        dr.line([tuple(p), tuple(m), tuple(q)], fill=int(rng.uniform(60, 150)), width=1)
    chips = Image.new('L', (Wd, TH), 0); dc = ImageDraw.Draw(chips)
    def flake(x, y, r):      # an angular flake, never a round dot
        n = int(rng.integers(5, 9)); a0 = rng.uniform(0, 6.28); sq = rng.uniform(0.45, 1.0); rot = rng.uniform(0, 3.14)
        pts2 = []
        for i in range(n):
            a = a0 + 6.283 * i / n + rng.normal(0, 0.25); rr = r * rng.uniform(0.45, 1.15)
            px, py = math.cos(a) * rr, math.sin(a) * rr * sq
            pts2.append((x + px * math.cos(rot) - py * math.sin(rot), y + px * math.sin(rot) + py * math.cos(rot)))
        dc.polygon(pts2, fill=255)
    for k in range(11):      # the breaks where it was put together again, with chips lost along them
        x, y = rng.uniform(0, Wd), rng.uniform(0, TH); ang = rng.uniform(0, 6.28); pl = [(x, y)]
        for st in range(int(rng.uniform(22, 60))):
            ang += rng.normal(0, 0.22); x += math.cos(ang) * 42; y += math.sin(ang) * 42; pl.append((x, y))
            if rng.uniform() < 0.3: flake(x + rng.normal(0, 5), y + rng.normal(0, 5), rng.uniform(4, 16))
        for ox in (-Wd, 0, Wd): dr.line([(px + ox, py) for px, py in pl], fill=235, width=3)
    for k in range(520):      # flakes lost from the glaze: many small, a few large; more toward the lip and the foot
        flake(rng.uniform(0, Wd), TH * rng.beta(0.5, 0.5), rng.uniform(1.5, 6.0) if rng.uniform() < 0.95 else rng.uniform(9, 30))
    for k in range(260):      # scratches
        x, y = rng.uniform(0, Wd), rng.uniform(0, TH); a = rng.uniform(0, 3.14); l = rng.uniform(15, 120)
        dr.line([(x, y), (x + math.cos(a) * l, y + math.sin(a) * l)], fill=int(rng.uniform(50, 130)), width=1)
    crack = np.asarray(cr.filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255.0
    nz = lambda sg: ndi.gaussian_filter(rng.normal(0, 1, (TH // 4, Wd // 4)), sg / 4.0, mode='wrap')
    up = lambda a: np.asarray(Image.fromarray(a.astype(np.float32)).resize((Wd, TH), Image.BILINEAR))
    n1 = nz(70); n1 = (n1 - n1.min()) / (n1.max() - n1.min())
    chip = np.clip(np.asarray(chips.filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255.0 * 1.4 - 0.2, 0, 1)
    n2 = up(nz(8)); n2 = n2 / (np.abs(n2).max() + 1e-6)
    wear = np.clip((up(n1) - 0.3) * 1.6 + 0.5 * n2, 0, 1) * 0.5            # where the black slip has gone thin and brown, in patches
    n3 = nz(150); stain = 1.0 - 0.2 * np.clip((up((n3 - n3.min()) / (n3.max() - n3.min())) - 0.45) * 2.2, 0, 1)      # where it has darkened
    n4 = up(nz(22)); dep = np.clip((n4 / (np.abs(n4).max() + 1e-6) - 0.42) * 2.4, 0, 1) * 0.2          # pale crust from the earth
    speck = rng.normal(0, 4.0, (TH, Wd)).astype(np.float32)
    return dict(crack=crack, chip=chip, wear=wear.astype(np.float32), stain=stain.astype(np.float32), dep=dep.astype(np.float32), speck=speck, W=Wd)

def age(arr, ag, slot, x0, y0, k=1.0):
    # the marks of age laid on a piece of a slot's strip (arr: uint8, at x0, y0 in the strip)
    h, w = arr.shape[:2]; X = (slot % 5) * SW + x0
    sl = (slice(y0, y0 + h), slice(X, X + w))
    t = arr.astype(np.float32); lum = t.mean(2, keepdims=True); dark = (lum < 85).astype(np.float32)
    t *= ag['stain'][sl][..., None]
    t += (ag['wear'][sl][..., None] * k * 0.5) * dark * (CLAY * 0.6 - t)
    c = ag['crack'][sl][..., None] * k
    t = t * (1 - 0.5 * c * (1 - dark)) + 62.0 * c * dark
    ch = ag['chip'][sl][..., None] * k
    t = t * (1 - ch) + ((CLAY * 0.9) * dark + np.array([240, 190, 140], np.float32) * (1 - dark) + ag['speck'][sl][..., None] * 2) * ch      # bare clay where the black is gone; paler where the clay itself is chipped
    d = ag['dep'][sl][..., None] * k
    t = t * (1 - d) + np.array([232, 220, 200], np.float32) * d
    return np.clip(t + ag['speck'][sl][..., None], 0, 255).astype(np.uint8)

# ---------------------------------------------------------------- the words, written under the panel
def text_layer(card):
    bh = int(ty(TXT_H1) - ty(TXT_H0)); layers = []
    for pg in card:
        n = len(pg); top = (bh - n * LH) * 0.5 - 8
        for i, ln in enumerate(pg):
            im = Image.new('L', (SW, bh), 0); dr = ImageDraw.Draw(im)
            w = dr.textlength(ln, font=FONT)
            dr.text(((SW - w) * 0.5, top + i * LH), ln, font=FONT, fill=255)
            layers.append(np.asarray(im).astype(np.float32) / 255.0)
    return layers

# ---------------------------------------------------------------- the vase
prof = PchipInterpolator([-130, 30, 120, 200, 300, 430, 800, 1260, 1700, 1930, 2100], [0.455, 0.45, 0.49, 0.71, 0.93, 1.0, 1.035, 0.985, 0.865, 0.745, 0.64])
def geometry():
    ys, xs = np.mgrid[0:Hh, 0:W].astype(np.float32); x = xs - W * 0.5 + 0.5; sy = ys + 0.5
    h = sy / math.cos(TILT)
    for _ in range(5):
        R = prof(h) * R0; s = np.clip(x / R, -1, 1); c = np.sqrt(1 - s * s)
        h = (sy + R * (c - 1.0) * math.sin(TILT)) / math.cos(TILT)
    R = prof(h) * R0; s = np.clip(x / R, -1, 1)
    th = np.degrees(np.arcsin(s)); cov = np.clip((R - np.abs(x)) * 0.9 + 0.5, 0, 1)
    c = np.sqrt(1 - s * s)
    light = 0.50 + 0.50 * np.clip(c * 0.92 + s * (-0.30) + 0.10, 0, 1)                     # light from the upper left
    spec = np.exp(-((th + 24.0) / 5.5) ** 2) * 0.16 + np.exp(-((th - 33.0) / 3.0) ** 2) * 0.05
    rim = np.clip(1.0 - c * 2.6, 0, 1) ** 2 * 0.22                                           # a thin warm light on its edge
    return h.astype(np.float32), th.astype(np.float32), cov, light, spec, rim

def background():      # the pale haze over the sea, as in the game
    ys, xs = np.mgrid[0:Hh, 0:W].astype(np.float32)
    v = np.clip(ys / (Hh * 0.55), 0, 1)[..., None]
    top = np.array([222, 222, 236], np.float32); bot = np.array([170, 204, 214], np.float32)
    bg = top * (1 - v) + bot * v
    d = (xs * 0.82 + ys * 0.57)      # soft shafts of light, slanting
    sh = 0.5 + 0.5 * np.sin(d / 97.0 + 0.6) * np.sin(d / 41.0 + 2.0)
    bg += (ndi.gaussian_filter(sh, 9.0)[..., None] - 0.5) * 12.0
    return np.clip(bg, 0, 255)

def sample(strip, hx, hy):      # bilinear
    x0 = np.floor(hx).astype(np.int32); y0 = np.floor(hy).astype(np.int32); fx = (hx - x0)[..., None]; fy = (hy - y0)[..., None]
    x0 = np.clip(x0, 0, strip.shape[1] - 2); y0 = np.clip(y0, 0, strip.shape[0] - 2)
    a = strip[y0, x0].astype(np.float32); b = strip[y0, x0 + 1].astype(np.float32); c = strip[y0 + 1, x0].astype(np.float32); d = strip[y0 + 1, x0 + 1].astype(np.float32)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

# ---------------------------------------------------------------- the film
def timeline():
    # (phi in slots, scene shown in front, how far each of its lines is written, global fade)
    ev = []
    def seg(d, f):
        n = int(round(d * FPS))
        for i in range(n): ev.append(f(i / max(n - 1, 1)))
    ease = lambda u: u * u * (3 - 2 * u)
    Z = [0.0] * NL
    seg(1.2, lambda u: (-1.0, 0, Z, u))                               # the vase comes out of the haze, its plain side to us
    for i in range(7):
        card = TEXTS[i]
        seg(2.6 if i else 3.0, lambda u, i=i: (i - 1 + ease(u), i, Z, 1.0))            # it turns: the next picture comes round
        seg(0.8, lambda u, i=i: (float(i), i, Z, 1.0))
        base = 0
        for p, pg in enumerate(card):
            n = len(pg)
            def st(vals, base=base, n=n): return [0.0] * base + vals + [0.0] * (NL - base - n)
            for j in range(n):
                d = 0.75 + 0.03 * len(pg[j])
                seg(d, lambda u, i=i, j=j, n=n, d=d, st=st: (float(i), i, st([1.0] * j + [ease(min(1.0, u * d / 0.8))] + [0.0] * (n - j - 1)), 1.0))
            last = p == len(card) - 1
            seg((3.0 if i < 6 else 4.5) if last else 1.5, lambda u, i=i, n=n, st=st: (float(i), i, st([1.0] * n), 1.0))
            if not last: seg(0.6, lambda u, i=i, n=n, st=st: (float(i), i, st([1.0 - ease(u)] * n), 1.0)); seg(0.25, lambda u, i=i: (float(i), i, Z, 1.0))
            base += n
    seg(2.8, lambda u: (6.0 + ease(u) * 1.0, 6, final_wr(6), 1.0 - u * u))                       # it turns away, into the haze
    return ev

def render(f0, f1, out):
    ev = timeline(); f1 = min(f1, len(ev))
    h, th, cov, light, spec, rim = geometry(); bg = background()
    orn = ornaments(); sc = scenes(); txt = [text_layer(l) for l in TEXTS]; ag = aging(); haze = bg.mean((0, 1))
    orn_aged = {}      # the ornament bands with their marks of age, for each of the five places round the vase
    hy = ty(h); cov3 = cov[..., None]
    y_pan = int(ty(PAN_H0)); x_pan = int(tx(-PANEL * 0.5)); y_t0 = int(ty(TXT_H0)); y_t1 = y_t0 + txt[0][0].shape[0]
    def slot_tex(i, t, wr):      # the strip of the vase that carries scene i (None: a plain side)
        ph = (i if i is not None else -1) % 5
        if ph not in orn_aged: orn_aged[ph] = age(orn, ag, ph, 0, 0)
        s = orn_aged[ph].copy()
        if i is None or i < 0 or i > 6: return s
        pan = np.empty((PH + 12, PW + 18, 3), np.uint8); pan[:] = BLACK.astype(np.uint8)       # the panel in its frame
        pan[6:6 + PH, 9:9 + PW] = sc[i].frame(t)
        pan[16:PH - 4, 16:19] = BLACK.astype(np.uint8); pan[16:PH - 4, PW - 1:PW + 2] = BLACK.astype(np.uint8)
        s[y_pan - 6:y_pan + PH + 6, x_pan - 9:x_pan + PW + 9] = age(pan, ag, ph, x_pan - 9, y_pan - 6)
        band = s[y_t0:y_t1].astype(np.float32)      # the words lie clean over the old glaze
        for j, ly in enumerate(txt[i]):
            if wr[j] > 0.0: band = band * (1 - ly[..., None] * wr[j]) + INK * ly[..., None] * wr[j]
        s[y_t0:y_t1] = band.astype(np.uint8)
        return s
    ff = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, Hh), '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', out], stdin=subprocess.PIPE)
    cache = {}
    for fi in range(f0, f1):
        phi, front, wr, fade = ev[fi]; t = fi / FPS
        u = th + phi * SLOT; sl = np.floor((u + SLOT * 0.5) / SLOT).astype(np.int32); ul = u - sl * SLOT
        hx = tx(ul); img = np.zeros((Hh, W, 3), np.float32)
        for k in np.unique(sl):
            key = (int(k), fi if int(k) == front else -1)
            if int(k) == front: tex = slot_tex(int(k), t, wr)
            elif int(k) == front - 1: tex = slot_tex(int(k), t, final_wr(int(k)) if 0 <= int(k) <= 6 else [0.0] * NL)      # the picture that is turning away goes on moving
            else:
                if int(k) not in cache: cache[int(k)] = slot_tex(int(k), 0.0, final_wr(int(k)) if 0 <= int(k) < front else [0.0] * NL)
                tex = cache[int(k)]
            m = sl == k
            img[m] = sample(tex, hx[m], hy[m])
        # the game's light: flat facets (they turn with the vase), warm where the sun falls, lilac in the shade
        thq = np.clip(np.round(u / FAC) * FAC - phi * SLOT, -88.0, 88.0) * (math.pi / 180.0)
        fi_ = np.round(u / FAC).astype(np.int32)
        L = np.clip(np.cos(thq) * 0.95 - np.sin(thq) * 0.34 + 0.08 + FACJ[fi_ % 60], 0, 1)[..., None]      # each facet a shade of its own, as low-poly things are
        img = img + (1.0 - img / 255.0) ** 2 * LIFT                      # no dead black: the slip is a deep plum
        img = img * (L * SUN + (1 - L) * SHADE) + RIM * rim[..., None]
        frame = img * cov3 + bg * (1 - cov3)
        frame = haze * (1 - fade) + frame * fade
        ff.stdin.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())
        if os.environ.get('STILL'): Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8)).save(os.environ['STILL'] % fi)
    ff.stdin.close(); ff.wait()

if __name__ == '__main__':
    if sys.argv[1] == 'len': print(len(timeline()))
    elif sys.argv[1] == 'stills':
        ev = timeline(); os.environ['STILL'] = S + '/v/still_%05d.png'
        for f in [int(x) for x in sys.argv[2].split(',')]: render(f, f + 1, S + '/v/_tmp.mp4')
    else: render(int(sys.argv[1]), int(sys.argv[2]), sys.argv[3])
