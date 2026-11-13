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
CREAM = (244, 220, 178)
TILT = math.radians(9.0)

def ty(h): return (h - H_TOP) * K
def tx(u): return (u + SLOT * 0.5) * PXD

TEXTS = [
 ["On Kythira there lived", "a sculptor named Theron.", "From white marble", "he carved a woman,", "and loved her more", "than stone should be loved."],
 ["After Theron's prayers,", "Aphrodite gave her life,", "on one condition:", "“Leave her face smooth.", "A face is carved by living,", "from within.”"],
 ["They called her Ione.", "And life began to carve her", "a face, a face the sculptor", "had never imagined.", "He could not bear a face", "he had not carved himself."],
 ["So he covered her face", "with a veil, so that", "he need not see it.", "And he hid every mirror,", "so that she never would.", "For as long as she had not", "seen her own face, she was", "still only what he had made."],
 ["But there was one mirror", "he could not hide: the sea.", "One morning the Aegean", "lay still as glass,", "and at the water's edge", "Ione saw a veiled woman", "looking up at her.", "She had never seen her before."],
 ["She wanted to see her closer.", "So that morning Ione", "rowed out alone, to where", "the water lay stillest,", "and leaned over the side to look."],
 ["The sea took her.", "There was no wave to blame."],
]

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
        teal = (a[..., 0] < 75) & (a[..., 2] > a[..., 0] + 6) & (a[..., 1] > a[..., 0] + 4) & (self.dg > 60)
        teal = ndi.binary_opening(teal, iterations=2)
        self.sea = np.zeros(teal.shape, bool); self.seacol = np.array([10, 38, 46], np.float32)
        lab, n = ndi.label(ndi.binary_dilation(teal, iterations=3))
        if n:
            sz = ndi.sum(teal, lab, range(1, n + 1)); big = 1 + int(np.argmax(sz))
            if sz[big - 1] > 20000:
                m = lab == big
                for y in np.where(m.any(1))[0]:
                    xx = np.where(m[y])[0]; self.sea[y, xx.min():xx.max() + 1] = True
                self.seacol = np.median(a[teal & m], axis=0)
        self.ds = np.sqrt(((a - self.seacol) ** 2).sum(2))
        gt = a[5:95]; self.gfill = np.concatenate([gt, gt[::-1]] * 7, 0)[:PH]          # plain ground, to lay where something is lifted off
        self.base = a.copy(); self.els = []; self.fx = []
        rng = np.random.default_rng(100 + c)
        self.strokes = [(rng.uniform(0, 1), rng.uniform(0.08, 0.92), rng.uniform(60, 150), rng.uniform(0.4, 1.0), rng.uniform(0, 6.28)) for _ in range(7)]
    def lift(self, name, box, kind, only=None, thick=0, **kw):
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
        inb = np.zeros_like(al); inb[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = 1; al = al * inb
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
                ax, ay = e['anchor'][0] - X0, e['anchor'][1] - Y0
                if e.get('dir', 'x') == 'x':
                    far = np.clip((xx - ax) * e.get('sign', 1.0) / e.get('reach', 200.0), 0, 1.4)
                    dy = e.get('amp', 5.0) * far * np.sin(xx / e.get('lam', 55.0) * e.get('sign', 1.0) - t * e.get('w', 2.2) + yy / 90.0); dx = 0.35 * dy
                else:
                    far = np.clip((yy - ay) / e.get('reach', 400.0), 0, 1.3)
                    dx = e.get('amp', 3.0) * far * np.sin(yy / e.get('lam', 120.0) - t * e.get('w', 1.1) + e.get('ph', 0.0)); dy = np.zeros_like(dx)
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
                    for oy in (0, 1): out[np.clip(py + oy, 0, PH - 1), px] = out[np.clip(py + oy, 0, PH - 1), px] * (1 - a) + np.array([40, 26, 22], np.float32) * a
        return np.clip(out, 0, 255).astype(np.uint8)

def scenes():
    sc = [Scene(c) for c in range(1, 8)]
    s = sc[0]      # 1: a light passes over the marble; the olive branch stirs; the sea runs
    s.lift('marble', (556, 200, 752, 880), 'still', only='bright', sheen=6.0, sheen_k=26.0)
    s.lift('branch', (598, 52, 1008, 482), 'flutter', dir='y', anchor=(900, 60), reach=420.0, amp=5.0, lam=170.0, w=1.2)
    s.lift('waves', (40, 696, 330, 872), 'rock', pivot=(185, 870), amp=0.0, bob=2.6, bw=1.3, drift=5.0, dw=0.65)
    s = sc[1]      # 2: he bows as he prays; she sways on her first step; the mirror catches the light
    s.lift('sculptor', (172, 448, 468, 902), 'rock', thick=4, pivot=(330, 892), amp=1.3, w=0.7)
    s.lift('woman', (478, 310, 678, 902), 'rock', thick=4, pivot=(565, 892), amp=0.6, w=0.9, ph=1.0)
    s.fx.append(dict(kind='glint', at=(679, 392), r=24, w=1.1))
    s = sc[2]      # 3: her hair and her dress in the wind; the sea runs
    s.lift('hair', (585, 200, 845, 352), 'flutter', anchor=(600, 270), sign=1.0, reach=200.0, amp=5.5, lam=60.0, w=2.5)
    s.lift('dress', (590, 352, 850, 800), 'flutter', only='colour', anchor=(600, 560), sign=1.0, reach=230.0, amp=5.0, lam=70.0, w=2.2)
    s.lift('waves', (98, 508, 486, 700), 'rock', pivot=(290, 700), amp=0.0, bob=2.6, bw=1.3, drift=5.0, dw=0.65)
    s = sc[3]      # 4: the one bare mirror still shines; the cloth that waits for it stirs; a spark on the small mirror
    s.lift('mirror', (890, 262, 1040, 538), 'still', only='bright', sheen=4.5, sheen_k=24.0)
    s.lift('cloth', (880, 588, 1010, 898), 'flutter', dir='y', only='colour', anchor=(945, 590), reach=300.0, amp=3.6, lam=140.0, w=1.0)
    s.fx.append(dict(kind='glint', at=(792, 682), r=18, w=0.9, ph=2.0))
    s = sc[4]      # 5: the gulls hang; the sun's road and the woman in the water tremble
    s.lift('gull1', (212, 270, 322, 330), 'rock', pivot=(267, 300), amp=4.0, w=1.6, bob=4.0, bw=0.7, drift=6.0)
    s.lift('gull2', (452, 252, 556, 304), 'rock', pivot=(504, 278), amp=4.0, w=1.5, ph=1.3, bob=4.0, bw=0.6, drift=6.0)
    s.fx.append(dict(kind='waver', box=(368, 442, 508, 818), amp=3.2, lam=11.0, w=1.6))
    s.fx.append(dict(kind='waver', box=(606, 588, 792, 862), amp=2.8, lam=13.0, w=1.4))
    s = sc[5]      # 6: the boat rides; what the water shows of it trembles
    s.fx.append(dict(kind='waver', box=(128, 642, 892, 948), amp=2.8, lam=14.0, w=1.5))
    s.lift('boat', (236, 300, 882, 640), 'rock', pivot=(560, 632), amp=0.7, w=1.0, bob=1.6, bw=1.0)
    s = sc[6]      # 7: the veil lies on the water and moves with it; rings widen where she went down
    s.fx.append(dict(kind='waver', box=(140, 640, 404, 752), amp=2.2, lam=12.0, w=1.3))
    s.fx.append(dict(kind='rings', at=(770, 772)))
    s.lift('veil', (640, 560, 900, 760), 'flutter', only='colour', anchor=(645, 640), sign=1.0, reach=260.0, amp=3.4, lam=52.0, w=1.6)
    return sc

# ---------------------------------------------------------------- the words, written under the panel
FONT = ImageFont.truetype(S + '/fonts/IMFeENsc28P.ttf', 50)
def text_layer(lines):
    n = len(lines); lh = 62; top = ty(TXT_H0) + (ty(TXT_H1) - ty(TXT_H0) - n * lh) * 0.5 - 4
    layers = []
    for i, ln in enumerate(lines):
        im = Image.new('L', (SW, int(ty(TXT_H1) - ty(TXT_H0))), 0); dr = ImageDraw.Draw(im)
        w = dr.textlength(ln, font=FONT)
        dr.text(((SW - w) * 0.5, top - ty(TXT_H0) + i * lh), ln, font=FONT, fill=255)
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

def background():
    ys, xs = np.mgrid[0:Hh, 0:W].astype(np.float32)
    v = ys / Hh; r = np.hypot((xs - W * 0.5) / W, (ys - Hh * 0.42) / Hh)
    top = np.array([16, 52, 60], np.float32); bot = np.array([6, 18, 24], np.float32)
    bg = top[None, None] * (1 - v[..., None]) + bot[None, None] * v[..., None]
    bg *= np.clip(1.15 - r[..., None] * 1.1, 0.35, 1.2)
    return bg

def sample(strip, hx, hy):      # bilinear
    x0 = np.floor(hx).astype(np.int32); y0 = np.floor(hy).astype(np.int32); fx = (hx - x0)[..., None]; fy = (hy - y0)[..., None]
    x0 = np.clip(x0, 0, strip.shape[1] - 2); y0 = np.clip(y0, 0, strip.shape[0] - 2)
    a = strip[y0, x0].astype(np.float32); b = strip[y0, x0 + 1].astype(np.float32); c = strip[y0 + 1, x0].astype(np.float32); d = strip[y0 + 1, x0 + 1].astype(np.float32)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

# ---------------------------------------------------------------- the film
def timeline():
    # (phi in slots, scene shown in front, how far each of its lines is written, global fade)
    ev = []; t = 0.0
    def seg(d, f): 
        nonlocal t
        n = int(round(d * FPS))
        for i in range(n): ev.append(f(i / max(n - 1, 1)))
        t += d
    ease = lambda u: u * u * (3 - 2 * u)
    seg(1.2, lambda u: (-1.0, 0, [0.0] * 8, u))                               # the vase comes out of the dark, its plain side to us
    for i in range(7):
        lines = TEXTS[i]; n = len(lines)
        seg(2.6 if i else 3.0, lambda u, i=i: (i - 1 + ease(u), i, [0.0] * 8, 1.0))            # it turns: the next picture comes round
        seg(1.0, lambda u, i=i: (float(i), i, [0.0] * 8, 1.0))
        for j in range(n):
            d = 1.25 + 0.03 * len(lines[j])
            seg(d, lambda u, i=i, j=j, n=n, d=d: (float(i), i, [1.0] * j + [min(1.0, u * d / 0.9)] + [0.0] * (8 - j - 1), 1.0))
        seg(3.2 if i < 6 else 4.5, lambda u, i=i, n=n: (float(i), i, [1.0] * n + [0.0] * (8 - n), 1.0))
    seg(2.8, lambda u: (6.0 + ease(u) * 1.0, 6, [1.0] * 8, 1.0 - u * u))                       # it turns away, into the dark
    return ev

def render(f0, f1, out):
    ev = timeline(); f1 = min(f1, len(ev))
    h, th, cov, light, spec, rim = geometry(); bg = background()
    orn = ornaments(); sc = scenes(); txt = [text_layer(l) for l in TEXTS]
    hy = ty(h); cov3 = cov[..., None]
    y_pan = int(ty(PAN_H0)); x_pan = int(tx(-PANEL * 0.5)); y_t0 = int(ty(TXT_H0)); y_t1 = y_t0 + txt[0][0].shape[0]
    def slot_tex(i, t, wr):      # the strip of the vase that carries scene i (None: a plain side)
        s = orn.copy()
        if i is None or i < 0 or i > 6: return s
        s[y_pan - 6:y_pan + PH + 6, x_pan - 9:x_pan + PW + 9] = BLACK.astype(np.uint8)       # the panel's frame
        s[y_pan:y_pan + PH, x_pan:x_pan + PW] = sc[i].frame(t)
        s[y_pan + 10:y_pan + PH - 10, x_pan + 7:x_pan + 10] = BLACK.astype(np.uint8); s[y_pan + 10:y_pan + PH - 10, x_pan + PW - 10:x_pan + PW - 7] = BLACK.astype(np.uint8)
        band = s[y_t0:y_t1].astype(np.float32)
        for j, ly in enumerate(txt[i]):
            if wr[j] > 0.0: band = band * (1 - ly[..., None] * wr[j]) + np.array(CREAM, np.float32) * ly[..., None] * wr[j]
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
            elif int(k) == front - 1: tex = slot_tex(int(k), t, [1.0] * 8)      # the picture that is turning away goes on moving
            else:
                if int(k) not in cache: cache[int(k)] = slot_tex(int(k), 0.0, [1.0] * 8 if int(k) < front else [0.0] * 8)
                tex = cache[int(k)]
            m = sl == k
            img[m] = sample(tex, hx[m], hy[m])
        img = img * light[..., None] + 255.0 * spec[..., None] + np.array([255, 190, 120], np.float32) * rim[..., None]
        frame = (img * cov3 + bg * (1 - cov3)) * fade
        ff.stdin.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())
        if os.environ.get('STILL'): Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8)).save(os.environ['STILL'] % fi)
    ff.stdin.close(); ff.wait()

if __name__ == '__main__':
    if sys.argv[1] == 'len': print(len(timeline()))
    elif sys.argv[1] == 'stills':
        ev = timeline(); os.environ['STILL'] = S + '/v/still_%05d.png'
        for f in [int(x) for x in sys.argv[2].split(',')]: render(f, f + 1, S + '/v/_tmp.mp4')
    else: render(int(sys.argv[1]), int(sys.argv[2]), sys.argv[3])
