"""The Faithful's board, played as a short film (24/11, for the owner's "how would we make 2?"): her moves, the statue's
two steps after each, the cracked slab it sinks into, the gate. Drawn from above in the game's colours.

usage: python3 -I board_anim.py <board.json> <out_dir>
board.json: rows, cuts, "try" (moves that get her caught, played first), "way" (the way through), "captions" (by move
number, and "start"), "try_captions", "caught", "end", "title", "subtitle". Writes f00000.png ... into out_dir; then
ffmpeg -framerate 30 -i f%05d.png -c:v libx264 -pix_fmt yuv420p faithful.mp4"""
import sys, os, json, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'tools', 'go'))
from faithful_trial import Board, statue
from PIL import Image, ImageDraw, ImageFont, ImageFilter

cfg = json.load(open(sys.argv[1])); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
b = Board(cfg['rows'], [tuple(map(tuple, c)) for c in cfg.get('cuts', [])])
DIRS = {'R': (1, 0), 'L': (-1, 0), 'D': (0, 1), 'U': (0, -1)}
K = 2      # (drawn at twice the size, then made smaller: smooth edges)
IW, IH = 900, 1200
C = min(132, int(780 / max(b.W, b.H))); X0 = (IW - b.W * C) // 2; Y0 = 215 + max(0, (6 - b.H) * C // 2)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf'
_fc = {}
def F(sz, bold=False):
    k = (sz, bold)
    if k not in _fc: _fc[k] = ImageFont.truetype(FONT % ('-Bold' if bold else ''), sz * K)
    return _fc[k]
SKY0 = (240, 232, 238); SKY1 = (226, 220, 236); WAT = (186, 190, 216); WAT_D = (168, 172, 204); SHIM = (204, 206, 228)
SLAB = (250, 246, 244); SLAB_E = (214, 204, 210); ROCK = (110, 95, 112); WAY = (196, 150, 128)
INK = (56, 44, 62); TERRA = (186, 96, 64); STONE = (214, 208, 220); STONE_D = (150, 140, 160); STONE_E = (104, 92, 116)
RED = (196, 52, 48)
FPS = 30; nframe = [0]


def cxy(p): return (X0 + p[0] * C + C / 2) * K, (Y0 + p[1] * C + C / 2) * K
def S(v): return v * K
def lerp(a, c, t): return (a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t)
def ease(t): return t * t * (3 - 2 * t)
def mix(a, c, t): return tuple(int(a[i] + (c[i] - a[i]) * t) for i in range(3))


def background():
    img = Image.new('RGB', (IW * K, IH * K)); d = ImageDraw.Draw(img)
    for y in range(0, IH * K, 4):
        d.rectangle([0, y, IW * K, y + 4], fill=mix(SKY0, SKY1, y / (IH * K)))
    x0, y0, x1, y1 = S(X0 - 34), S(Y0 - 34), S(X0 + b.W * C + 34), S(Y0 + b.H * C + 34)
    d.rounded_rectangle([x0, y0, x1, y1], S(26), fill=WAT)
    for i in range(int((y1 - y0) / S(22))):      # (the still water's faint shimmer)
        y = y0 + S(14) + i * S(22); w = (x1 - x0) * (0.25 + 0.5 * ((i * 37) % 11) / 11)
        xs = x0 + S(30) + ((i * 53) % 7) / 7 * (x1 - x0 - w - S(60))
        d.line([(xs, y), (xs + w, y)], fill=SHIM, width=S(2))
    return img


BG = background()


def slab(d, p, cracked=False, head=False):
    cx, cy = cxy(p); r = S(C / 2 - 9)
    d.rounded_rectangle([cx - r + S(3), cy - r + S(9), cx + r + S(3), cy + r + S(11)], S(12), fill=ROCK)
    d.rounded_rectangle([cx - r, cy - r, cx + r, cy + r], S(12), fill=SLAB, outline=SLAB_E, width=S(3))
    if cracked:      # (the cracked slab: it holds her, a soul; not the statue)
        for pts in (((-0.42, -0.1), (-0.12, -0.02), (0.05, 0.16), (0.42, 0.22)), ((-0.12, -0.02), (0.02, -0.4)),
                    ((0.05, 0.16), (-0.08, 0.42)), ((0.18, 0.19), (0.3, -0.18))):
            d.line([(cx + x * r * 2, cy + y * r * 2) for x, y in pts], fill=(120, 104, 120), width=S(4), joint='curve')
    if head:      # (the statue sunk into it: its veiled head is the stone now, flush)
        d.ellipse([cx - r * 0.62, cy - r * 0.62, cx + r * 0.62, cy + r * 0.62], fill=(226, 221, 232), outline=STONE_E, width=S(3))
        d.arc([cx - r * 0.4, cy - r * 0.45, cx + r * 0.4, cy + r * 0.35], 200, 340, fill=STONE_E, width=S(3))


def ways(d, sunk):
    for (x, y) in b.slab:
        for q in ((x + 1, y), (x, y + 1)):
            if b.open((x, y), q):
                a, c = cxy((x, y)), cxy(q)
                d.line([a, c], fill=WAY, width=S(5))
    for p in b.slab:
        if p == b.G: continue
        cx, cy = cxy(p); r = S(9)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WAY)


def gate(d):
    gx, gy = cxy(b.G)
    out = [(b.G[0] + dx, b.G[1] + dy) for dx, dy in DIRS.values() if not b.open(b.G, (b.G[0] + dx, b.G[1] + dy))]
    # (the gate stands on the ring's far side, away from the way to it)
    inn = next((dx, dy) for dx, dy in DIRS.values() if b.open(b.G, (b.G[0] + dx, b.G[1] + dy)))
    ox, oy = -inn[0], -inn[1]
    r = S(31); d.ellipse([gx - r, gy - r, gx + r, gy + r], fill=(150, 118, 104))
    r = S(29); d.ellipse([gx - r, gy - r, gx + r, gy + r], outline=(255, 252, 244), width=S(8))
    ex, ey = gx + ox * S(C * 0.5), gy + oy * S(C * 0.5)
    L = S(C * 0.44); T = S(10)
    if ox: d.rectangle([ex - T, ey - L, ex + T, ey + L], fill=(255, 252, 240), outline=(176, 160, 170), width=S(2))
    else: d.rectangle([ex - L, ey - T, ex + L, ey + T], fill=(255, 252, 240), outline=(176, 160, 170), width=S(2))
    for s_ in (-1, 1):      # (its two jambs)
        if ox: d.rectangle([ex - T * 1.6, ey + s_ * L - T * 1.6, ex + T * 1.6, ey + s_ * L + T * 1.6], fill=(236, 230, 232), outline=(150, 136, 150), width=S(2))
        else: d.rectangle([ex + s_ * L - T * 1.6, ey - T * 1.6, ex + s_ * L + T * 1.6, ey + T * 1.6], fill=(236, 230, 232), outline=(150, 136, 150), width=S(2))


def her(d, xy, k=1.0, red=0.0, a=1.0):
    x, y = xy; r = S(25) * k
    d.ellipse([x - r * 1.1 + S(4), y - r * 0.5 + S(16) * k, x + r * 1.1 + S(4), y + r * 0.7 + S(16) * k], fill=mix(WAT_D, ROCK, 0.25))
    body = mix((252, 250, 248), RED, red)
    d.ellipse([x - r, y - r, x + r, y + r], fill=body, outline=mix((70, 58, 74), (110, 20, 20), red), width=S(4))
    band = mix(TERRA, (120, 20, 20), red)
    for o in (-10, 1, 12):
        d.line([(x - r * 0.72, y + (o - 6) * k * K), (x + r * 0.72, y + (o + 3) * k * K)], fill=band, width=S(5))


def stat(d, xy, sink=0.0):
    """the veiled statue from above: its pedestal, its veil, its head; sink 0..1 takes it under"""
    x, y = xy; k = 1 - 0.55 * sink
    if sink < 1:
        d.ellipse([x - S(40) * k + S(6), y + S(12), x + S(40) * k + S(6), y + S(40) * k + S(10)], fill=mix(WAT_D, ROCK, 0.35))
        p = S(34) * k
        d.rectangle([x - p, y - p + S(14) * k, x + p, y + p + S(14) * k], fill=STONE_D, outline=STONE_E, width=S(3))
        d.polygon([(x, y - S(50) * k), (x + S(30) * k, y + S(28) * k), (x - S(30) * k, y + S(28) * k)], fill=STONE, outline=STONE_E)
        d.ellipse([x - S(17) * k, y - S(46) * k, x + S(17) * k, y - S(12) * k], fill=(232, 227, 236), outline=STONE_E, width=S(3))


def ripples(d, xy, t):
    x, y = xy
    for i in range(3):
        u = t - i * 0.18
        if 0 < u < 1:
            r = S(30 + 70 * u); a = 1 - u
            d.ellipse([x - r, y - r * 0.8, x + r, y + r * 0.8], outline=mix(WAT, (255, 255, 255), a), width=S(4))


def puff(d, xy, t):
    x, y = xy
    for i in range(9):
        ang = i * 2.4; dist = S(12 + 60 * t); r = S(14 + 22 * t)
        cx, cy = x + math.cos(ang) * dist, y + math.sin(ang) * dist * 0.8
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=mix((206, 70, 64), WAT, min(1.0, t * t * 1.1)))


def caption(d, t1, t2=''):
    d.rectangle([0, S(IH - 178), S(IW), S(IH)], fill=(44, 34, 50))
    def fit(t, sz, bold):
        for s_ in range(sz, 14, -1):
            f = F(s_, bold)
            if d.textlength(t, font=f) <= S(IW - 64): return f
        return f
    d.text((S(IW / 2), S(IH - 122)), t1, font=fit(t1, 34, True), fill=(248, 240, 232), anchor='mm')
    if t2: d.text((S(IW / 2), S(IH - 68)), t2, font=fit(t2, 26, False), fill=(216, 202, 214), anchor='mm')


def title(d):
    d.text((S(IW / 2), S(78)), cfg.get('title', 'Ο Πιστός'), font=F(46, True), fill=INK, anchor='mm')
    if cfg.get('subtitle'): d.text((S(IW / 2), S(132)), cfg['subtitle'], font=F(24), fill=(110, 96, 114), anchor='mm')


def draw(h, m, cap, hk=1.0, red=0.0, sunk=False, sink=0.0, mpos=None, hpos=None, flash=0.0, rip=None, puff_t=None, show_her=True):
    img = BG.copy(); d = ImageDraw.Draw(img)
    title(d)
    for p in sorted(b.slab, key=lambda p: (p[1], p[0])):
        slab(d, p, cracked=(p == b.C and not sunk and sink == 0), head=(p == b.C and (sunk or sink >= 1)))
    ways(d, sunk)
    if b.C is not None and 0 < sink < 1: slab(d, b.C, cracked=True)
    gate(d)
    if rip is not None: ripples(d, cxy(b.C), rip)
    if m is not None and not sunk: stat(d, mpos or cxy(m), sink)
    if show_her: her(d, hpos or cxy(h), hk, red)
    if puff_t is not None: puff(d, hpos or cxy(h), puff_t)
    caption(d, *cap)
    img = img.resize((IW, IH), Image.LANCZOS)
    if flash > 0:      # (the gate's light fills the picture, the caption stays)
        top = img.crop((0, 0, IW, IH - 178)); top = Image.blend(top, Image.new('RGB', top.size, (255, 252, 244)), flash)
        img.paste(top, (0, 0))
    img.save(os.path.join(OUT, 'f%05d.png' % nframe[0])); nframe[0] += 1


def hold(sec, *a, **k):
    for _ in range(int(sec * FPS)): draw(*a, **k)


def play(moves, caps, end_cap, caught_cap):
    h, m = b.S, b.F; sunk = False; cap = caps.get('start', ('', ''))
    hold(3.2, h, m, cap)
    for i, ch in enumerate(moves):
        dd = DIRS[ch]; q = (h[0] + dd[0], h[1] + dd[1]); cap = caps.get(str(i + 1), cap)      # (a caption stays until the next)
        n = int(0.32 * FPS)
        for k in range(n):
            draw(h, m, cap, sunk=sunk, hpos=lerp(cxy(h), cxy(q), ease((k + 1) / n)))
        if q == b.G:
            for k in range(int(1.3 * FPS)):
                t = k / (1.3 * FPS)
                draw(q, m, end_cap, sunk=sunk, hk=max(0.15, 1 - t), flash=min(0.85, t * 1.1))
            hold(2.2, q, m, end_cap, sunk=sunk, hk=0.15, flash=0.85, show_her=False)
            return
        if not sunk:
            prev = m
            for s in statue(b, m, q):
                if s is None:      # (it stepped onto the cracked slab: it breaks, the statue goes under)
                    n = int(1.4 * FPS)
                    for k in range(n):
                        t = (k + 1) / n
                        draw(q, prev, cap, sink=min(1.0, t * 1.25), rip=t)
                    sunk = True; m = None
                    break
                n = int(0.24 * FPS)
                for k in range(n):
                    draw(q, prev, cap, mpos=lerp(cxy(prev), cxy(s), ease((k + 1) / n)))
                prev = s
                if s == q: break
            if not sunk: m = prev
        h = q
        if m is not None and m == h:      # (caught: a red shadow, gone in a red puff)
            for k in range(int(0.5 * FPS)): draw(h, m, caught_cap, red=(k + 1) / (0.5 * FPS))
            for k in range(int(0.7 * FPS)): draw(h, m, caught_cap, show_her=False, puff_t=(k + 1) / (0.7 * FPS))
            hold(1.4, h, m, caught_cap, show_her=False)
            return
        hold(0.45 if str(i + 1) not in caps else 2.2, h, m, cap, sunk=sunk)


T = lambda v: tuple(v)
if cfg.get('try'):
    play(cfg['try'], {k: T(v) for k, v in cfg.get('try_captions', {}).items()}, ('', ''), T(cfg.get('caught', ['Την έπιασε.', 'Ξανά από την αρχή.'])))
play(cfg['way'], {k: T(v) for k, v in cfg.get('captions', {}).items()}, T(cfg.get('end', ['Περνά στο φως.', ''])), T(cfg.get('caught', ['Την έπιασε.', ''])))
print('frames', nframe[0])
