"""Puzzles of tools/go/trials.py drawn on paper, to show them before they are built: each board as the game's eye sees
it, the things on it, the looks, and a few moments of its proven way, side by side.

usage: python3 -I tools/go/trials_draw.py <out.png> <design>|<title>|<step>:<caption>|<step>:<caption>... [<design>|...]
"""
import importlib.util, math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import trials
from trials import *
from PIL import Image, ImageDraw, ImageFont
spec = importlib.util.spec_from_file_location('td', os.path.join(HERE, 'trials_designs.py')); td = importlib.util.module_from_spec(spec)
sys.modules['trials'] = trials; spec.loader.exec_module(td)

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
PW, PH, K = 440, 470, 62.0
BG = (240, 236, 228); TILE = (252, 250, 245); SIDE = (205, 198, 188); SIDE2 = (180, 172, 162); GROOVE = (214, 206, 194)
RED = (206, 66, 50); BRONZE = (176, 122, 58); BLUE = (64, 82, 140); IONE = (186, 86, 54); GOLD = (232, 176, 60)


KK = [K]
def iso(c, o):
    gx, gy = c
    return (o[0] + (gx - gy) * KK[0] * 0.866, o[1] - (gx + gy) * KK[0] * 0.5)


def states_along(t, path):
    st = t.init(); out = [st]
    for nb, ev in path:
        r = t.step(st, nb); st = r[0]; out.append(st)
    return out


def panel(t, st, caption, step, nsteps, prev_path=()):
    im = Image.new('RGB', (PW, PH), BG); dr = ImageDraw.Draw(im, 'RGBA')
    me, stone, alive, v, wi, wd, mir, hs, holes = st
    cs = [c for c in t.B.cells]
    xs = [(c[0] - c[1]) for c in cs]; ys = [(c[0] + c[1]) for c in cs]
    KK[0] = min(K, (PW - 36) / ((max(xs) - min(xs)) * 0.866 + 0.95), (PH - 150) / ((max(ys) - min(ys)) * 0.5 + 0.5))      # (the whole board in the panel)
    Kp = KK[0]
    o = (PW * 0.5 - (min(xs) + max(xs)) * 0.5 * Kp * 0.866, PH * 0.47 + 18 + (min(ys) + max(ys)) * 0.5 * Kp * 0.5)
    hw, hh = Kp * 0.866 * 0.46, Kp * 0.5 * 0.46      # (a tile's half breadth and half depth on the page)
    order = sorted(cs, key=lambda c: -(c[0] + c[1]))
    for c in order:      # the floors: slabs, the far ones first
        if t.hole(c, holes): continue
        x, y = iso(c, o); th = 9
        top = [(x, y - hh), (x + hw, y), (x, y + hh), (x - hw, y)]
        dr.polygon([(x - hw, y), (x, y + hh), (x, y + hh + th), (x - hw, y + th)], fill=SIDE)
        dr.polygon([(x + hw, y), (x, y + hh), (x, y + hh + th), (x + hw, y + th)], fill=SIDE2)
        dr.polygon(top, fill=(232, 222, 206) if c in t.cix else TILE, outline=(222, 214, 202))
        if c in t.cix:      # cracked floor: dark cracks across it
            for pts in (((0, 0), (-0.55, 0.1), (-0.85, 0.05)), ((0, 0), (0.25, 0.55), (0.2, 0.85)), ((0, 0), (0.5, -0.25), (0.8, -0.15)), ((0, 0), (-0.15, -0.6), (-0.05, -0.85))):
                dr.line([(x + hw * a * 0.95, y + hh * b * 0.95) for a, b in pts], fill=(92, 78, 66), width=3)
    for (a, b), lvl in t.B.level.items():      # the ways: a groove on the floors; a flight drawn as steps
        if a > b or t.hole(a, holes) or t.hole(b, holes): continue
        pa, pb = iso(a, o), iso(b, o)
        if lvl: dr.line([pa, pb], fill=GROOVE, width=4)
        else:
            dx, dy = pb[0] - pa[0], pb[1] - pa[1]; L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
            for k in range(1, 6):
                q = (pa[0] + dx * k / 6, pa[1] + dy * k / 6)
                dr.line([(q[0] - nx * 10, q[1] - ny * 10), (q[0] + nx * 10, q[1] + ny * 10)], fill=(150, 140, 128), width=3)
    for (a, b) in t.B.gap:      # a chasm: only a look goes over it
        if a > b: continue
        pa, pb = iso(a, o), iso(b, o); m = ((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2)
        dr.ellipse([m[0] - 13, m[1] - 7, m[0] + 13, m[1] + 7], fill=(60, 54, 50, 200))
    for c in cs:
        if t.hole(c, holes) or c in t.mpos or c == t.dial: continue
        x, y = iso(c, o); dr.ellipse([x - 9, y - 5, x + 9, y + 5], outline=(196, 186, 172), width=2)
    # the looks
    for k in range(len(t.faces)):
        if not alive >> k & 1: continue
        f = t.faces[k][0]; pts = [iso(f, o)]; c = f; d = t.faces[k][2] if v else t.faces[k][1]
        while True:
            q = t.B.go_look(c, d)
            if q is None or t.hole(q, holes) or q == stone or t.face_on(q, alive) >= 0 or q == t.dial:
                if q is not None and t.face_on(q, alive) >= 0 and t.faces_break: pts.append(iso(q, o))
                break
            pts.append(iso(q, o))
            if q in t.mpos: d = MIRROR[mir >> t.mpos[q] & 1][d]
            c = q
            if len(pts) > 40: break
        dr.line(pts, fill=RED + (170,), width=4)
        for p_ in pts[1:]:
            dr.ellipse([p_[0] - 8, p_[1] - 4.5, p_[0] + 8, p_[1] + 4.5], outline=RED + (200,), width=2)
    # the hunters' lines (asleep): where she must not stand unseen
    for h in hs:
        if not h or h[2]: continue
        c = h[0]; pts = [iso(c, o)]
        while True:
            c = t.B.go_look(c, h[1])
            if c is None or t.hole(c, holes) or c == stone or t.face_on(c, alive) >= 0 or c in t.mpos: break
            pts.append(iso(c, o))
        if len(pts) > 1:
            for i in range(len(pts) - 1):
                a, b = pts[i], pts[i + 1]
                for k in range(0, 10, 2):
                    dr.line([(a[0] + (b[0] - a[0]) * k / 10, a[1] + (b[1] - a[1]) * k / 10), (a[0] + (b[0] - a[0]) * (k + 1) / 10, a[1] + (b[1] - a[1]) * (k + 1) / 10)], fill=(90, 120, 200, 200), width=3)
    # the things
    things = []
    for k, (f, d0, d1) in enumerate(t.faces): things.append((f, 'face' if alive >> k & 1 else 'plinth', d1 if v else d0))
    for c, _ in t.mirrors: things.append((c, 'mirror', mir >> t.mpos[c] & 1))
    if t.dial: things.append((t.dial, 'dial', v))
    if stone: things.append((stone, 'stone', 0))
    for h in hs:
        if h: things.append((h[0], 'hunter', h[2]))
    if t.route and wi >= 0: things.append((t.route[wi], 'guard', 0))
    things.append((t.B.ring, 'ring', 0)); things.append((me, 'ione', 0))
    for c, kind, a in sorted(things, key=lambda x: -(x[0][0] + x[0][1])):
        x, y = iso(c, o)
        if kind == 'ring': dr.ellipse([x - 15, y - 8, x + 15, y + 8], outline=GOLD, width=4)
        elif kind == 'plinth': dr.rectangle([x - 9, y - 6, x + 9, y + 2], fill=(214, 208, 198), outline=(170, 160, 150))
        elif kind == 'face':
            dr.rectangle([x - 9, y - 8, x + 9, y + 2], fill=(214, 208, 198), outline=(160, 150, 140))
            dr.ellipse([x - 10, y - 30, x + 10, y - 8], fill=(246, 244, 240), outline=(120, 110, 100), width=2)
            dd = DIRS[a]; q = iso((c[0] + dd[0] * 0.32, c[1] + dd[1] * 0.32), o)
            dr.line([(x, y - 19), (q[0], q[1] - 19)], fill=RED, width=3)
        elif kind == 'mirror':      # (drawn flat on its floor: a bronze bar along the way it turns a look)
            a0, a1 = ((-0.4, -0.4), (0.4, 0.4)) if a == 0 else ((-0.4, 0.4), (0.4, -0.4))
            p0 = iso((c[0] + a0[0], c[1] + a0[1]), o); p1 = iso((c[0] + a1[0], c[1] + a1[1]), o)
            dr.ellipse([x - 12, y - 7, x + 12, y + 7], fill=(226, 206, 170), outline=BRONZE, width=2)
            dr.line([p0, p1], fill=BRONZE, width=7)
            dr.line([p0, p1], fill=(236, 200, 140), width=2)
        elif kind == 'dial':
            dr.ellipse([x - 13, y - 34, x + 13, y - 8], fill=BRONZE, outline=(110, 74, 34), width=2)
            cx_, cy_ = x, y - 21 + (-5 if a == 0 else 5)
            dr.ellipse([cx_ - 5, cy_ - 5, cx_ + 5, cy_ + 5], fill=(240, 236, 226))
            dr.rectangle([x - 4, y - 9, x + 4, y + 1], fill=(200, 190, 176))
        elif kind == 'stone':
            dr.polygon([(x - 13, y - 6), (x, y - 13), (x + 13, y - 6), (x + 13, y + 8), (x, y + 15), (x - 13, y + 8)], fill=(176, 170, 162), outline=(120, 112, 104))
            dr.polygon([(x - 13, y - 6), (x, y - 13), (x + 13, y - 6), (x, y + 1)], fill=(214, 208, 200))
        elif kind == 'hunter':
            col = (40, 56, 110) if a else BLUE
            dr.rounded_rectangle([x - 9, y - 36, x + 9, y + 2], radius=7, fill=col, outline=(24, 30, 60), width=2)
            dr.ellipse([x - 7, y - 46, x + 7, y - 32], fill=col, outline=(24, 30, 60), width=2)
            if a: dr.ellipse([x - 3, y - 42, x + 3, y - 37], fill=(255, 220, 120))
        elif kind == 'guard':
            dr.rounded_rectangle([x - 9, y - 36, x + 9, y + 2], radius=4, fill=(150, 176, 210), outline=(80, 100, 140), width=2)
        elif kind == 'ione':
            dr.polygon([(x - 8, y + 2), (x + 8, y + 2), (x + 4, y - 22), (x - 4, y - 22)], fill=IONE, outline=(110, 46, 30))
            dr.ellipse([x - 6, y - 34, x + 6, y - 22], fill=(238, 214, 196), outline=(110, 46, 30))
    f = ImageFont.truetype(FONT, 17); fb = ImageFont.truetype(FONTB, 15)
    dr.text((14, 12), '%d / %d' % (step, nsteps), font=fb, fill=(120, 110, 100))
    y0 = PH - 54
    for line in caption.split('\\n'):
        w = dr.textlength(line, font=f); dr.text(((PW - w) / 2, y0), line, font=f, fill=(60, 52, 46)); y0 += 22
    return im


def row(spec):
    parts = spec.split('|'); name, title = parts[0], parts[1]
    td.DESIGNS[name]()
    t, sol = list(trials.BUILT.values())[-1]
    sts = states_along(t, sol['path'])
    ims = []
    for p in parts[2:]:
        k, cap = p.split(':', 1); k = int(k)
        ims.append(panel(t, sts[k], cap, k, sol['len']))
    w = PW * len(ims) + 12 * (len(ims) - 1)
    out = Image.new('RGB', (w, PH + 52), (255, 255, 255)); dr = ImageDraw.Draw(out)
    dr.text((10, 12), title % dict(n=sol['len']), font=ImageFont.truetype(FONTB, 22), fill=(50, 44, 40))
    for i, im in enumerate(ims): out.paste(im, (i * (PW + 12), 52))
    return out


if __name__ == '__main__':
    outp = sys.argv[1]
    rows = [row(s) for s in sys.argv[2:]]
    W_ = max(r.width for r in rows); H_ = sum(r.height for r in rows) + 24 * (len(rows) - 1)
    out = Image.new('RGB', (W_, H_), (255, 255, 255)); y = 0
    for r in rows: out.paste(r, (0, y)); y += r.height + 24
    out.save(outp); print('saved', outp, out.size)
