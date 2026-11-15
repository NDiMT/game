"""A trial drawn on paper, to show it before it is built: the board seen as the game's eye sees it (from above, at
an angle), the faces and the line each looks along, the stone, Ione and the ring; and the way she goes, in a few
moments of its solution, side by side.

usage: python3 -I tools/go/draw_trial.py <design name in first_trial.HAND> <out.png> <step>:<caption> ...
  each <step> is how many swipes into the solution that panel stands (0 is the start)
"""
import importlib.util, os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys_argv = sys.argv; sys.argv = [sys.argv[0], '--none']
spec = importlib.util.spec_from_file_location('ft', os.path.join(HERE, 'first_trial.py')); ft = importlib.util.module_from_spec(spec)
try: spec.loader.exec_module(ft)
except SystemExit: pass
sys.argv = sys_argv
name, out = sys.argv[1], sys.argv[2]
panels = [(int(p.split(':', 1)[0]), p.split(':', 1)[1]) for p in sys.argv[3:]]
d = ft.HAND[name]
xs = [c[0] for c in d['nodes']]; ys = [c[1] for c in d['nodes']]; ox, oy = min(xs), min(ys)
sh = lambda c: (c[0] - ox, c[1] - oy)
nodes = sorted(sh(c) for c in d['nodes']); E = ft.edges_of([(sh(p), sh(q)) for p, q in d['pairs']])
ft.W, ft.H = max(c[0] for c in nodes) + 1, max(c[1] for c in nodes) + 1
t = ft.Trial(nodes, E, sh(d['start']), sh(d['ring']), sh(d['stone']) if d['stone'] else None, [(sh(c), dd) for c, dd in d['faces']])
sol = ft.solve(t)
path = sol['path']

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
PW, PH = 560, 640
K = 84.0      # (pixels a step of the board)


def P(c, cx, cy):      # a node of the board to the panel (the eye looks from the front, a little above)
    gx, gy = c
    return (cx + (gx - gy) * K * 0.87, cy - (gx + gy) * K * 0.5)


def panel(step, caption):
    im = Image.new('RGB', (PW, PH), (251, 236, 212)); dr = ImageDraw.Draw(im, 'RGBA')
    for y in range(PH):      # (the mist: lighter above)
        k = y / PH
        dr.line([(0, y), (PW, y)], fill=(int(253 - 10 * k), int(241 - 22 * k), int(218 - 30 * k)))
    allp = [P(c, 0, 0) for c in nodes]
    mx = (min(p[0] for p in allp) + max(p[0] for p in allp)) / 2; my = (min(p[1] for p in allp) + max(p[1] for p in allp)) / 2
    cx, cy = PW / 2 - mx, PH / 2 - my + 30
    st = path[step]; me, stone, alive = st
    # the paths: grooves in the stone
    for (p, q) in E:
        a_, b_ = P(p, cx, cy), P(q, cx, cy)
        dr.line([a_, b_], fill=(214, 186, 150), width=22); dr.line([a_, b_], fill=(240, 222, 196), width=14)
    # the looks: a red line from each standing face along what it sees; shade after the stone
    watched = t.watched(stone, alive)
    for k, (f, dd) in enumerate(t.faces):
        if not alive >> k & 1: continue
        j = t.step_to(f, dd); last = f
        while j >= 0 and j in watched: last = j; j = t.step_to(j, dd)
        if last != f: dr.line([P(t.nodes[f], cx, cy), P(t.nodes[last], cx, cy)], fill=(196, 72, 46, 170), width=7)
    for i, c in enumerate(nodes):      # the nodes: pale discs in a darker ring; a watched one ringed red
        x, y = P(c, cx, cy)
        dr.ellipse([x - 13, y - 8, x + 13, y + 8], fill=(255, 248, 236), outline=(196, 72, 46) if i in watched else (205, 172, 135), width=3)
    # the way she has gone so far
    if step > 0:
        pts = [P(t.nodes[s[0]], cx, cy) for s in path[:step + 1]]
        for a_, b_ in zip(pts, pts[1:]):
            dr.line([(a_[0], a_[1] - 3), (b_[0], b_[1] - 3)], fill=(150, 62, 40, 200), width=4)
    # the ring
    x, y = P(t.nodes[t.ring], cx, cy)
    dr.ellipse([x - 22, y - 14, x + 22, y + 14], outline=(255, 255, 250), width=6); dr.ellipse([x - 26, y - 17, x + 26, y + 17], outline=(250, 226, 190), width=2)
    # the faces: a carved head on its plinth, looking its way; a broken one as rubble
    for k, (f, dd) in enumerate(t.faces):
        x, y = P(t.nodes[f], cx, cy)
        dr.polygon([(x - 18, y), (x, y - 10), (x + 18, y), (x, y + 10)], fill=(214, 190, 160), outline=(170, 135, 100))
        if alive >> k & 1:
            dr.ellipse([x - 13, y - 44, x + 13, y - 8], fill=(246, 230, 206), outline=(150, 118, 90), width=2)
            tx, ty = P((t.nodes[f][0] + dd[0], t.nodes[f][1] + dd[1]), cx, cy)
            vx, vy = tx - x, ty - y; L = (vx * vx + vy * vy) ** 0.5; vx, vy = vx / L, vy / L
            ex, ey = x + vx * 7, y - 28 + vy * 4
            dr.line([(ex - 5, ey), (ex - 1, ey)], fill=(90, 66, 50), width=2); dr.line([(ex + 2, ey), (ex + 6, ey)], fill=(90, 66, 50), width=2)
            dr.line([(ex, ey + 9), (ex + 3, ey + 9)], fill=(120, 90, 70), width=2)
        else:
            for (dx, dy, r) in ((-9, -6, 6), (6, -9, 5), (2, -2, 7)):
                dr.polygon([(x + dx - r, y + dy), (x + dx, y + dy - r), (x + dx + r, y + dy + 1), (x + dx, y + dy + r * 0.6)], fill=(232, 214, 190), outline=(160, 128, 98))
    # the stone: a block
    if stone >= 0:
        x, y = P(t.nodes[stone], cx, cy); s = 17
        top = [(x, y - 2 * s), (x + s, y - 1.45 * s), (x, y - 0.9 * s), (x - s, y - 1.45 * s)]
        dr.polygon([(x - s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x - s, y)], fill=(236, 214, 182), outline=(150, 118, 90))
        dr.polygon([(x + s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x + s, y)], fill=(204, 176, 140), outline=(150, 118, 90))
        dr.polygon(top, fill=(252, 240, 220), outline=(150, 118, 90))
        dr.rectangle([x - 5, y - 1.5 * s - 3, x + 5, y - 1.5 * s + 3], outline=(170, 135, 100))
    # Ione: a slender figure in her red cloth
    x, y = P(t.nodes[me], cx, cy)
    dr.ellipse([x - 9, y - 4, x + 9, y + 5], fill=(0, 0, 0, 40))
    dr.polygon([(x - 7, y), (x + 7, y), (x + 4, y - 30), (x - 4, y - 30)], fill=(178, 82, 54), outline=(120, 48, 32))
    dr.ellipse([x - 5, y - 41, x + 5, y - 30], fill=(247, 234, 220), outline=(150, 110, 90))
    # caption
    f1 = ImageFont.truetype(FONTB, 26); f2 = ImageFont.truetype(FONT, 21)
    num, _, text = caption.partition('|')
    dr.text((24, 20), num, font=f1, fill=(120, 48, 32))
    words = text.split(); line = ''; yy = 58
    for w in words:
        if dr.textlength(line + ' ' + w, font=f2) > PW - 48:
            dr.text((24, yy), line.strip(), font=f2, fill=(70, 52, 40)); yy += 28; line = ''
        line += ' ' + w
    dr.text((24, yy), line.strip(), font=f2, fill=(70, 52, 40))
    return im


ims = [panel(s, c) for (s, c) in panels]
o = Image.new('RGB', (PW * len(ims) + 12 * (len(ims) - 1), PH), (255, 255, 255))
for i, im in enumerate(ims): o.paste(im, (i * (PW + 12), 0))
o.save(out); print('saved', out, o.size)
