"""The fourth level's trial, as the owner put it (19/11: "wouldn't it make more sense that the cube must go somewhere in
the reflection and the gate open in the normal view?"): she never crosses the glass.

  - A wall of glass stands across the screen on the board's anti-diagonal gx + gy = k, facing the eye. Before it is the
    real place; beyond it its reflection, the same floors turned over about the glass, (gx, gy) -> (k - gy, k - gx):
    on the screen straight above, as far behind the glass as the thing is before it.
  - In the reflection lies a plate that is not in the real place. The block's reflection moves as the block is pushed
    (along the glass the same way, toward the glass toward it). When the block's reflection stands on the plate (the
    block on the real cell whose reflection the plate is), the gate in the real place opens, and stays open.
  - She moves one node per swipe on the real side only; the block is pushed one node straight on along a level way, if
    the node beyond is free (never onto the gate's ring, never up or down a stair, never into the glass).
  - Reach the gate's ring, open.

A board gives the real side, rows from the top (gy high) down, a character per gx:
  '.' a floor   'S' her start   'B' the block   'T' the floor whose reflection is the plate   'G' the gate's ring
  ' ' nothing; cells on or beyond the glass's line are left blank.
'cut' lists pairs of neighbouring floors with no way between them; 'stairs' pairs joined by a stair.

usage: python3 -I tools/go/plate_trial.py [board] [--draw out.png [board@]step:caption ...]
"""
import sys
from collections import deque

BOARDS = {}


class Trial:
    def __init__(s, b):
        s.k = b['glass']; rows = b['rows']; n = len(rows)
        s.cells = {}
        for r, row in enumerate(rows):
            gy = n - 1 - r
            for gx, ch in enumerate(row):
                if ch != ' ' and gx + gy < s.k: s.cells[(gx, gy)] = ch
        one = lambda ch: [c for c, x in s.cells.items() if x == ch][0]
        s.start, s.stone0, s.target, s.gate = one('S'), one('B'), one('T'), one('G')
        s.cut = set(); s.stairs = set()
        for a, c in b.get('cut', []): s.cut |= {(tuple(a), tuple(c)), (tuple(c), tuple(a))}
        for a, c in b.get('stairs', []): s.stairs |= {(tuple(a), tuple(c)), (tuple(c), tuple(a))}
    def m(s, c): return (s.k - c[1], s.k - c[0])
    def way(s, p, q): return p in s.cells and q in s.cells and (p, q) not in s.cut
    def moves(s, st):
        me, stone, op = st
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            j = (me[0] + d[0], me[1] + d[1])
            if not s.way(me, j): continue
            if j == s.gate and not op: continue      # (the gate shut)
            if j == stone:
                if (me, j) in s.stairs: continue
                k = (j[0] + d[0], j[1] + d[1])
                if not s.way(j, k) or (j, k) in s.stairs or k == s.gate: continue
                yield (j, k, op or k == s.target), d, 'push'
                continue
            yield (j, stone, op), d, 'walk'
    def solve(s):
        st0 = (s.start, s.stone0, s.stone0 == s.target); dist = {st0: 0}; ways = {st0: 1}; prev = {st0: None}; q = deque([st0])
        while q:
            st = q.popleft()
            if st[0] == s.gate: continue
            for nx, d, kind in s.moves(st):
                if nx not in dist: dist[nx] = dist[st] + 1; ways[nx] = ways[st]; prev[nx] = (st, kind); q.append(nx)
                elif dist[nx] == dist[st] + 1: ways[nx] += ways[st]
        ends = [st for st in dist if st[0] == s.gate]
        if not ends: return {'ok': False, 'states': len(dist)}
        best = min(dist[e] for e in ends); n_best = sum(ways[e] for e in ends if dist[e] == best)
        e = min((x for x in ends if dist[x] == best))
        path = []; kinds = []
        while e is not None:
            path.append(e); p = prev[e]
            if p is None: break
            kinds.append(p[1]); e = p[0]
        path.reverse(); kinds.reverse()
        back = {}
        for st in dist:
            for nx, d, kind in s.moves(st): back.setdefault(nx, []).append(st)
        good = set(ends); q = deque(ends)
        while q:
            x = q.popleft()
            for p in back.get(x, []):
                if p not in good: good.add(p); q.append(p)
        dead = [st for st in dist if st not in good]
        return {'ok': True, 'len': best, 'unique': n_best == 1, 'n_best': n_best, 'path': path, 'kinds': kinds,
                'dead': dead, 'states': len(dist)}


def screen(t, st=None):      # (as the eye sees it: the reflection above the glass, the real place below)
    me, stone, op = st if st else (t.start, t.stone0, False)
    img = t.m(stone); plate = t.m(t.target)
    cells = set(t.cells) | {t.m(c) for c in t.cells}
    us = [c[0] - c[1] for c in cells]; vs = [c[0] + c[1] for c in cells]
    lines = []
    for v in range(max(vs), min(vs) - 1, -1):
        row = ''
        for u in range(min(us), max(us) + 1):
            if (u + v) % 2: row += ' -' if v == t.k else '  '; continue
            c = ((v + u) // 2, (v - u) // 2)
            if v == t.k: ch = '-'
            elif c in t.cells:
                ch = '@' if c == me else 'B' if c == stone else ('G' if not op else 'g') if c == t.gate else '.'
            elif c in cells:
                ch = 'b' if c == img else 'P' if c == plate else ':'
            else: ch = ' '
            row += ' ' + ch
        lines.append(row)
    return '\n'.join(lines)


def report(b, name='board', quiet=False):
    t = Trial(b); r = t.solve()
    if not quiet: print(screen(t)); print()
    if not r['ok']: print(name, 'NO WAY', r['states'], 'states'); return t, r
    nm = lambda c: '%d,%d' % c
    print('%s: %d moves, %s (%d of that length), %d states, %d dead ends, %d pushes' % (
        name, r['len'], 'unique' if r['unique'] else 'NOT unique', r['n_best'], r['states'], len(r['dead']),
        sum(1 for k in r['kinds'] if k == 'push')))
    print('  way:', ' '.join('%s%s' % (nm(st[0]), {'push': '*', 'walk': ''}[k]) for st, k in zip(r['path'][1:], r['kinds'])))
    return t, r


BOARDS['plate'] = {      # (the block up, round it by the left, the block on: its reflection on the plate, the gate opens at the corridor's end)
    'glass': 5,
    'rows': ['     ',
             '     ',
             '..T  ',
             '.B   ',
             'S...G'],
    'cut': [((0, 0), (0, 1))],
}
BOARDS['plate_b'] = {      # (the block on, then up twice along its column; 3 pushes)
    'glass': 6,
    'rows': ['      ',
             '      ',
             '  T   ',
             '  .   ',
             '.B.   ',
             'S....G'],
    'cut': [((0, 0), (1, 0))],
}


def draw(specs, out, PW=540, PH=960):
    """panels shaped as a phone's screen, each (board, step, caption): the real place below the glass, warm; its
    reflection above it, silver, with the plate that is only there; the block and its reflection; the gate"""
    from PIL import Image, ImageDraw, ImageFont
    FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    def block(dr, x, y, s, top, left, right, edge):
        dr.polygon([(x - s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x - s, y)], fill=left, outline=edge)
        dr.polygon([(x + s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x + s, y)], fill=right, outline=edge)
        dr.polygon([(x, y - 2 * s), (x + s, y - 1.45 * s), (x, y - 0.9 * s), (x - s, y - 1.45 * s)], fill=top, outline=edge)
    def gate(dr, x, y, q, door, frame):
        dr.rectangle([x - 16 * q, y - 74 * q, x + 16 * q, y - 6 * q], outline=frame, width=int(7 * q))
        dr.rectangle([x - 9 * q, y - 67 * q, x + 9 * q, y - 6 * q], fill=door)
    def panel(b, step, caption):
        t = Trial(b); r = t.solve(); path = r['path']
        im = Image.new('RGB', (PW, PH)); dr = ImageDraw.Draw(im, 'RGBA')
        allc = set(t.cells) | {t.m(c) for c in t.cells}
        us = [c[0] - c[1] for c in allc]; ws = [c[0] + c[1] for c in allc]
        K = PW / ((max(us) - min(us)) * 0.87 + 2.6); q = K / 62.0
        ox = PW / 2 - (min(us) + max(us)) / 2 * K * 0.87
        top_, bot_ = -max(ws) * 0.5 * K - 0.6 * K, -min(ws) * 0.5 * K + 0.5 * K
        oy = (200 + PH - 40) / 2 - (top_ + bot_) / 2
        P = lambda c: (ox + (c[0] - c[1]) * K * 0.87, oy - (c[0] + c[1]) * K * 0.5)
        gy_ = oy - t.k * K * 0.5
        for y in range(PH):
            f = y / PH; col = (214, 220, 236) if y < gy_ else (232, 214, 220)
            dr.line([(0, y), (PW, y)], fill=tuple(int(col[i] - 22 * f) for i in range(3)))
        me, stone, op = path[step]
        for c in t.cells:      # (the ways, real and reflected)
            for d in ((1, 0), (0, 1)):
                n = (c[0] + d[0], c[1] + d[1])
                if not t.way(c, n): continue
                for a_, b_, real in ((c, n, True), (t.m(c), t.m(n), False)):
                    dr.line([P(a_), P(b_)], fill=(214, 186, 150) if real else (176, 186, 214), width=int(24 * q))
                    dr.line([P(a_), P(b_)], fill=(240, 222, 196) if real else (226, 232, 246), width=int(15 * q))
        for c in t.cells:
            for cc, real in ((c, True), (t.m(c), False)):
                x, y = P(cc)
                dr.ellipse([x - 13 * q, y - 8 * q, x + 13 * q, y + 8 * q], fill=(255, 248, 236) if real else (240, 244, 252),
                           outline=(205, 172, 135) if real else (170, 180, 212), width=max(2, int(3 * q)))
        x, y = P(t.m(t.target)); lit = t.m(stone) == t.m(t.target)      # (the plate, only in the reflection)
        for k_ in range(3): dr.ellipse([x - (26 + 6 * k_) * q, y - (15 + 4 * k_) * q, x + (26 + 6 * k_) * q, y + (15 + 4 * k_) * q], outline=(255, 214, 140, 150 - 40 * k_ if lit else 60 - 18 * k_), width=int(3 * q))
        dr.ellipse([x - 24 * q, y - 14 * q, x + 24 * q, y + 14 * q], fill=(255, 226, 160, 230 if lit else 130), outline=(212, 160, 90), width=int(3 * q))
        hs = 1.1 * K      # (the glass: a sheet of light across the level)
        for i in range(int(hs)): dr.line([(0, gy_ - i), (PW, gy_ - i)], fill=(255, 255, 255, int(55 * (1 - i / hs) ** 1.5)))
        for k_ in range(5): dr.line([(0, gy_), (PW, gy_)], fill=(255, 255, 255, 40 + 40 * (k_ == 4)), width=int((12 - 2.4 * k_) * q))
        prev_ = path[-2][0]; d = (t.gate[0] - prev_[0], t.gate[1] - prev_[1])      # (the gate, beyond its ring along her last step; and its reflection)
        gp = (t.gate[0] + 0.55 * d[0], t.gate[1] + 0.55 * d[1])
        x, y = P(t.m(gp)); gate(dr, x, y, q, (238, 242, 252, 150) if op else (150, 156, 186, 150), (170, 180, 210, 160))
        x, y = P(t.gate); dr.ellipse([x - 22 * q, y - 14 * q, x + 22 * q, y + 14 * q], outline=(255, 255, 250) if op else (190, 180, 200), width=int(6 * q))
        if step > 0:
            pts = [P(st[0]) for st in path[:step + 1]]
            for a_, b_ in zip(pts, pts[1:]): dr.line([(a_[0], a_[1] - 3 * q), (b_[0], b_[1] - 3 * q)], fill=(150, 62, 40, 200), width=max(3, int(4 * q)))
        x, y = P(t.m(stone)); block(dr, x, y, 20 * q, (236, 242, 255, 200), (206, 216, 240, 190), (180, 192, 226, 190), (140, 152, 196))
        x, y = P(stone); block(dr, x, y, 20 * q, (252, 244, 230), (236, 220, 196), (204, 182, 152), (150, 118, 90))
        x, y = P(gp); gate(dr, x, y, q, (255, 255, 252) if op else (120, 108, 120), (196, 178, 160))
        x, y = P(me)
        dr.ellipse([x - 9 * q, y - 4 * q, x + 9 * q, y + 5 * q], fill=(0, 0, 0, 40))
        dr.polygon([(x - 7 * q, y), (x + 7 * q, y), (x + 4 * q, y - 30 * q), (x - 4 * q, y - 30 * q)], fill=(178, 82, 54), outline=(120, 48, 32))
        dr.ellipse([x - 5 * q, y - 41 * q, x + 5 * q, y - 30 * q], fill=(247, 234, 220), outline=(150, 110, 90))
        f1 = ImageFont.truetype(FONTB, 27); f2 = ImageFont.truetype(FONT, 21)
        num, _, text = caption.partition('|'); yy = 22
        for txt, f, col, lh in ((num, f1, (110, 46, 40), 36), (text, f2, (64, 50, 56), 28)):
            line = ''
            for w in txt.split():
                if line and dr.textlength(line + ' ' + w, font=f) > PW - 48: dr.text((24, yy), line.strip(), font=f, fill=col); yy += lh; line = ''
                line += ' ' + w
            dr.text((24, yy), line.strip(), font=f, fill=col); yy += lh + 6
        return im
    ims = [panel(*sp) for sp in specs]
    o = Image.new('RGB', (PW * len(ims) + 12 * (len(ims) - 1), PH), (255, 255, 255))
    for i, im in enumerate(ims): o.paste(im, (i * (PW + 12), 0))
    o.save(out); print('saved', out, o.size)


if __name__ == '__main__':
    a = sys.argv[1:]
    name = a[0] if a and not a[0].startswith('--') else 'plate'
    report(BOARDS[name], name)
    if '--draw' in a:      # (each panel 'step:caption', or 'board@step:caption' for another board)
        i = a.index('--draw'); specs = []
        for p in a[i + 2:]:
            st, _, cap = p.partition(':'); bn = name
            if '@' in st: bn, st = st.split('@')
            specs.append((BOARDS[bn], int(st), cap))
        draw(specs, a[i + 1])
