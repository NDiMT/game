"""The fifth level's trial drawn on paper (as draw_trial.py draws the first ones): the board as the game's eye sees it,
the Guardian on his pedestal in the pool, his gaze now (bright) and where he will look after her next move (faint),
the stone, the goddess's mirror, the ring, Ione, and the way she has gone; a few moments of the solution side by side.

usage: python3 -I tools/go/draw_gaze.py <out.png> <step>:<title>|<caption> ...
"""
import os, sys, math
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gaze_trial import guardian, solve, replay, DIRS

out = sys.argv[1]
panels = [(int(p.split(':', 1)[0]), p.split(':', 1)[1]) for p in sys.argv[2:]]
t = guardian(); res = solve(t); states = replay(t, res)

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
PW, PH = 560, 700
K = 70.0
WAYS = sorted({tuple(sorted(w)) for w in t.level})
NODES = sorted(t.cells)

def P(c, cx, cy):      # a place of the board to the panel (the eye looks from the south-west, a little above)
    gx, gy = c
    return (cx + (gx - gy) * K * 0.87, cy - (gx + gy) * K * 0.5)

def quad(dr, c, cx, cy, half, fill, outline=None):
    pts = [P((c[0] + a * half, c[1] + b * half), cx, cy) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    dr.polygon(pts, fill=fill, outline=outline)

def gaze_line(dr, st, phase, cx, cy, col, width):
    me, stone, mf, _, kept = st
    if kept: return []
    lit, back = t.beam(me, stone, mf, phase)
    d = t.look(phase); a = P(t.guard, cx, cy)
    end = lit[-1] if lit else None
    if end is None: b = P((t.guard[0] + DIRS[d][0] * 0.45, t.guard[1] + DIRS[d][1] * 0.45), cx, cy)
    else: b = P(end, cx, cy)
    # where it stops: at the stone or the mirror, the line ends at its face
    nxt = (end if end else t.guard); q = (nxt[0] + DIRS[d][0], nxt[1] + DIRS[d][1])
    if q == stone or q == t.mirror: b = P((nxt[0] + DIRS[d][0] * 0.62, nxt[1] + DIRS[d][1] * 0.62), cx, cy)
    elif t.nxt(nxt, d, True) is not None and end is not None and end != me: b = P((end[0] + DIRS[d][0] * 0.5, end[1] + DIRS[d][1] * 0.5), cx, cy)
    a = (a[0], a[1] - 46); b = (b[0], b[1] - 8)
    dr.line([a, b], fill=col, width=width)
    return lit

def panel(step, caption):
    im = Image.new('RGB', (PW, PH)); dr = ImageDraw.Draw(im, 'RGBA')
    for y in range(PH):      # (a silver dusk: pale lilac above, a warmer haze low)
        k = y / PH
        dr.line([(0, y), (PW, y)], fill=(int(226 + 12 * k), int(226 + 2 * k), int(236 - 14 * k)))
    allp = [P(c, 0, 0) for c in NODES + [t.mirror, (-1, 3)]]
    mx = (min(p[0] for p in allp) + max(p[0] for p in allp)) / 2; my = (min(p[1] for p in allp) + max(p[1] for p in allp)) / 2
    cx, cy = PW / 2 - mx, PH / 2 - my + 70
    st = states[step]; me, stone, mf, ph, kept = st
    # the pool round his pedestal, and the deep water at its back corner
    quad(dr, t.guard, cx, cy, 0.62, (176, 192, 214), (150, 166, 192))
    for s_ in t.sinks: quad(dr, s_, cx, cy, 0.5, (132, 150, 182), (120, 138, 172))
    # the ways: grooves in the stone
    for (p, q) in WAYS:
        a_, b_ = P(p, cx, cy), P(q, cx, cy)
        dr.line([a_, b_], fill=(196, 186, 190), width=24); dr.line([a_, b_], fill=(236, 230, 232), width=16)
    # his gaze now (bright) and after her next move (faint)
    nxt_lit = gaze_line(dr, st, ph + 1, cx, cy, (190, 214, 245, 90), 5) if not kept else []
    lit = gaze_line(dr, st, ph, cx, cy, (236, 246, 255, 235), 9) if not kept else []
    if not kept: gaze_line(dr, st, ph, cx, cy, (150, 186, 236, 255), 3)
    for c in NODES:
        x, y = P(c, cx, cy)
        o = (110, 156, 226) if c in lit else (166, 190, 230) if c in nxt_lit else (196, 180, 176)
        dr.ellipse([x - 13, y - 8, x + 13, y + 8], fill=(255, 252, 248), outline=o, width=3)
    # the way she has gone so far
    if step > 0:
        pts = [P(s_[0], cx, cy) for s_ in states[:step + 1]]
        for a_, b_ in zip(pts, pts[1:]):
            if a_ != b_: dr.line([(a_[0], a_[1] - 3), (b_[0], b_[1] - 3)], fill=(150, 62, 40, 200), width=4)
    # the ring, and the gate behind it (shut until he is kept)
    x, y = P(t.ring, cx, cy)
    dr.ellipse([x - 22, y - 14, x + 22, y + 14], outline=(255, 255, 250) if kept else (190, 184, 204), width=6)
    gx, gy = P((t.ring[0], t.ring[1] + 0.75), cx, cy)
    dr.rectangle([gx - 22, gy - 74, gx + 22, gy], fill=(150, 146, 170))
    dr.rectangle([gx - 13, gy - 64, gx + 13, gy], fill=(255, 255, 252) if kept else (118, 112, 140))
    # the goddess's mirror: a bronze disc on a stand, its face turned its way
    x, y = P(t.mirror, cx, cy)
    dr.polygon([(x - 14, y), (x, y - 7), (x + 14, y), (x, y + 7)], fill=(170, 146, 120), outline=(120, 96, 76))
    dr.line([(x, y - 2), (x, y - 26)], fill=(120, 92, 60), width=4)
    fx, fy = DIRS[mf]; vx = (fx - fy) * 0.87; vy = -(fx + fy) * 0.5
    sq = abs(vx) / math.hypot(vx, vy) if (vx or vy) else 1
    w = 6 + 14 * (1 - sq)
    face_seen = (vx < 0 or vy > 0)      # (its face toward the eye: bright bronze; its back: dark)
    dr.ellipse([x - w, y - 52, x + w, y - 24], fill=(226, 180, 104) if face_seen else (128, 96, 66), outline=(110, 80, 50), width=2)
    ax, ay = x + vx * 26, y - 38 + vy * 26
    dr.line([(x, y - 38), (ax, ay)], fill=(176, 120, 60), width=3)
    # the stone: a block
    if stone is not None:
        x, y = P(stone, cx, cy); s = 17
        top = [(x, y - 2 * s), (x + s, y - 1.45 * s), (x, y - 0.9 * s), (x - s, y - 1.45 * s)]
        dr.polygon([(x - s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x - s, y)], fill=(222, 204, 178), outline=(150, 118, 90))
        dr.polygon([(x + s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x + s, y)], fill=(190, 166, 136), outline=(150, 118, 90))
        dr.polygon(top, fill=(240, 226, 204), outline=(150, 118, 90))
    # the Guardian: a hooded figure of glass on his pedestal (frosted white once the mirror has kept him)
    x, y = P(t.guard, cx, cy)
    dr.ellipse([x - 20, y - 8, x + 20, y + 10], fill=(214, 206, 210), outline=(160, 150, 160))
    body = (240, 246, 252, 235) if kept else (198, 222, 246, 200)
    edge = (200, 206, 216) if kept else (120, 160, 214)
    dr.polygon([(x - 15, y), (x + 15, y), (x + 9, y - 46), (x - 9, y - 46)], fill=body, outline=edge)
    dr.ellipse([x - 11, y - 66, x + 11, y - 42], fill=body, outline=edge, width=2)
    if not kept:
        d = t.look(ph); vx = (DIRS[d][0] - DIRS[d][1]) * 0.87; vy = -(DIRS[d][0] + DIRS[d][1]) * 0.5
        dr.ellipse([x + vx * 7 - 3, y - 55 + vy * 4 - 3, x + vx * 7 + 3, y - 55 + vy * 4 + 3], fill=(255, 255, 255))
    else:
        for k in range(5):      # (cracks of frost)
            a = k * 1.3
            dr.line([(x, y - 30), (x + 12 * math.cos(a), y - 30 + 18 * math.sin(a))], fill=(170, 180, 196), width=1)
    # Ione: a slender figure in her terracotta
    x, y = P(me, cx, cy)
    dr.ellipse([x - 9, y - 4, x + 9, y + 5], fill=(0, 0, 0, 40))
    dr.polygon([(x - 7, y), (x + 7, y), (x + 4, y - 30), (x - 4, y - 30)], fill=(178, 82, 54), outline=(120, 48, 32))
    dr.ellipse([x - 5, y - 41, x + 5, y - 30], fill=(247, 234, 220), outline=(150, 110, 90))
    # caption
    f1 = ImageFont.truetype(FONTB, 26); f2 = ImageFont.truetype(FONT, 20)
    num, _, text = caption.partition('|')
    dr.text((24, 20), num, font=f1, fill=(96, 52, 60))
    words = text.split(); line = ''; yy = 58
    for w_ in words:
        if dr.textlength(line + ' ' + w_, font=f2) > PW - 48:
            dr.text((24, yy), line.strip(), font=f2, fill=(64, 54, 66)); yy += 27; line = ''
        line += ' ' + w_
    dr.text((24, yy), line.strip(), font=f2, fill=(64, 54, 66))
    return im

ims = [panel(s, c) for (s, c) in panels]
o = Image.new('RGB', (PW * len(ims) + 12 * (len(ims) - 1), PH), (255, 255, 255))
for i, im in enumerate(ims): o.paste(im, (i * (PW + 12), 0))
o.save(out); print('saved', out, o.size)
