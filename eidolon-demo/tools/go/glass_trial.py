"""The fourth level's trial: the image is stepped on. Rules, as the game will play them:

  - A wall of glass stands across the screen, on the board's anti-diagonal gx + gy = k (the board's 'glass'), facing
    the eye. Before it (gx + gy < k: near the eye, the lower half of the screen) is the real side; beyond it (gx + gy > k:
    the upper half) is its image, as a mirror shows it: the same floors turned over about the glass,
    (gx, gy) -> (k - gy, k - gx). The image is not whole: where it is missing there is only the fog (a hole).
    (The owner, 19/11: "the map below and the reflection above, we'd have more space": a phone's screen is tall, and
    the halves side by side each had half its width. A board without 'glass' has the glass up the middle of the
    screen, on the diagonal gx = gy, seen edge on: the real side (gy > gx) on the left, the image (gy, gx) on the right.)
  - The stone stands on the real side, and its image stands on the image side, turned over about the glass.
  - She is an image herself, so an image holds her: the stone's image over a hole is a stepping stone. Over a floor of
    the image side it stands in the way, as a stone does. It cannot be pushed: only the real stone moves it.
  - She crosses the glass only where it is cracked (the script's law: only still water and cracked glass let things
    pass between the worlds). The stone never goes through.
  - She moves one node per swipe; the stone is pushed one node straight on along a level way, if the node beyond is
    free (never onto the ring, never up or down a stair, never into the glass).
  - Reach the ring of light, on the image side.

It proves a board by a breadth-first search over the whole state (where she is, where the stone is): the shortest way
and whether it is the only one of its length, every state from which the ring can no longer be reached (a dead end),
and whether the image is needed.

A board gives the real side only, as rows of the board from the top (gy high) down, a character per gx:
  '.' a floor   'S' her start   'B' the stone   'h' a floor whose image is missing (a hole on the image side)
  'r' a floor whose image is the ring   'X' a crack in the glass (on the glass's line only)   ' ' nothing
Cells on the glass's line are glass unless 'X'; cells beyond it are left blank: the image is made from the real.
Ways join every two neighbouring floors; 'cut' lists real pairs with no way between them (and none between their
images); 'stairs' lists real pairs joined by a stair (no pushing over it).

usage: python3 -I tools/go/glass_trial.py [board] [--draw out.png [board@]step:caption ...]
"""
import sys
from collections import deque

BOARDS = {}


def from_screen(lines):
    """A board drawn as the eye sees it: the real side's half, a character a column, the glass the last column (u = 0);
    a node where u + v is even. Returns the board's rows (gy from the top), as parse() reads them."""
    lines = [l.rstrip('\n') for l in lines]
    W = max(len(l) for l in lines); H = len(lines)
    cells = {}
    for r, l in enumerate(lines):
        v = H - 1 - r
        for c, ch in enumerate(l.ljust(W)):
            u = c - (W - 1)
            if ch in ' |': continue
            if (u + v) % 2: raise ValueError('a node off the grid at line %d col %d (%r)' % (r, c, ch))
            gx, gy = (v + u) // 2, (v - u) // 2
            cells[(gx, gy)] = ch
    N = max(max(c) for c in cells) + 1
    rows = []
    for gy in range(N - 1, -1, -1): rows.append(''.join(cells.get((gx, gy), ' ') for gx in range(N)))
    return rows


def parse(rows, k=None):
    n = len(rows); cells = {}
    for r, row in enumerate(rows):
        gy = n - 1 - r
        for gx, ch in enumerate(row):
            d = gx - gy if k is None else gx + gy - k      # (how far beyond the glass: the real side is below 0)
            if ch == ' ' or d > 0: continue
            if d == 0 and ch != 'X': continue
            cells[(gx, gy)] = ch
    return cells


class Trial:
    def __init__(s, b, image=True):
        s.k = b.get('glass')      # (the glass across the screen, gx + gy = k; None: up the middle, gx = gy)
        cells = parse(b['rows'], s.k) if 'rows' in b else dict(b['cells'])
        s.N = len(b['rows']) if 'rows' in b else b['N']
        s.kind = {}      # (gx, gy) -> 'real' | 'image' | 'crack'
        for c, ch in cells.items():
            if ch == 'X': s.kind[c] = 'crack'; continue
            s.kind[c] = 'real'; s.kind[s.m(c)] = 'image'
        s.holes = set(s.m(c) for c, ch in cells.items() if ch == 'h')
        rs = [tuple(b['ring_of'])] if b.get('ring_of') else [c for c, ch in cells.items() if ch == 'r']      # ('ring_of': the real cell whose image is the ring, when another mark stands on it)
        s.ring = s.m(rs[0]) if rs else None
        s.start = [c for c, ch in cells.items() if ch == 'S'][0]
        s.stone0 = [c for c, ch in cells.items() if ch == 'B'][0]
        cut = set()
        for a, c in b.get('cut', []):
            for p, q in ((a, c), (s.m(a), s.m(c))): cut.add((p, q)); cut.add((q, p))
        s.stairs = set()
        for a, c in b.get('stairs', []):
            for p, q in ((a, c), (s.m(a), s.m(c))): s.stairs.add((p, q)); s.stairs.add((q, p))
        s.cut = cut
        s.use_image = image
    def m(s, c):      # (a cell turned over about the glass)
        c = tuple(c); return (c[1], c[0]) if s.k is None else (s.k - c[1], s.k - c[0])
    def way(s, p, q): return p in s.kind and q in s.kind and (p, q) not in s.cut
    def side(s, c):
        d = c[0] - c[1] if s.k is None else c[0] + c[1] - s.k
        return -1 if d < 0 else (1 if d > 0 else 0)
    def image_of(s, stone):
        if not s.use_image: return None
        m = s.m(stone); return m if s.kind.get(m) == 'image' else None
    def init(s): return (s.start, s.stone0)
    def moves(s, st):
        me, stone = st; img = s.image_of(stone)
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            j = (me[0] + d[0], me[1] + d[1])
            if not s.way(me, j): continue
            if j == stone:
                if (me, j) in s.stairs: continue
                k = (j[0] + d[0], j[1] + d[1])
                if not s.way(j, k) or (j, k) in s.stairs or k == s.ring or s.kind[k] != 'real': continue
                yield (j, k), d, 'push'
                continue
            if j in s.holes and j != img: continue      # (the fog: no way, unless the stone's image stands there)
            if j == img and j not in s.holes: continue      # (the image stands in the way)
            yield (j, stone), d, 'walk'
    def solve(s):
        st0 = s.init(); dist = {st0: 0}; ways = {st0: 1}; prev = {st0: None}; q = deque([st0])
        while q:
            st = q.popleft()
            if st[0] == s.ring: continue
            for nx, d, kind in s.moves(st):
                if nx not in dist: dist[nx] = dist[st] + 1; ways[nx] = ways[st]; prev[nx] = (st, kind); q.append(nx)
                elif dist[nx] == dist[st] + 1: ways[nx] += ways[st]
        ends = [st for st in dist if st[0] == s.ring]
        if not ends: return {'ok': False, 'states': len(dist)}
        best = min(dist[e] for e in ends); n_best = sum(ways[e] for e in ends if dist[e] == best)
        e = min((x for x in ends if dist[x] == best), key=lambda x: x)
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
    def crossings(s, path):
        n = 0; last = s.side(path[0][0])
        for st in path[1:]:
            sd = s.side(st[0])
            if sd != 0 and sd != last: n += 1; last = sd
        return n


def ascii(t, st=None):
    me, stone = st if st else (t.start, t.stone0); img = t.image_of(stone)
    out = []
    for gy in range(t.N - 1, -1, -1):
        row = ''
        for gx in range(t.N):
            c = (gx, gy); k = t.kind.get(c)
            if k is None: row += ('/' if gx == gy else ' ') + ' '; continue
            if c == me: ch = '@'
            elif c == stone: ch = 'B'
            elif c == img: ch = 'b' if c not in t.holes else 'o'
            elif c in t.holes: ch = '~'
            elif c == t.ring: ch = 'R'
            elif k == 'crack': ch = 'X'
            else: ch = '.'
            row += ch + ' '
        out.append(row)
    return '\n'.join(out)


def screen(t, st=None):      # (as the eye sees it: the board turned 45 degrees, the glass across it or up the middle)
    me, stone = st if st else (t.start, t.stone0); img = t.image_of(stone)
    us = [c[0] - c[1] for c in t.kind]; vs = [c[0] + c[1] for c in t.kind]
    on_glass = (lambda u, v: u == 0) if t.k is None else (lambda u, v: v == t.k)
    gl = '|' if t.k is None else '-'
    lines = []
    for v in range(max(vs), min(vs) - 1, -1):
        row = ''
        for u in range(min(us), max(us) + 1):
            if (u + v) % 2: row += (' ' + gl) if on_glass(u, v) else '  '; continue
            c = ((v + u) // 2, (v - u) // 2); k = t.kind.get(c)
            if k is None: ch = gl if on_glass(u, v) else ' '
            elif c == me: ch = '@'
            elif c == stone: ch = 'B'
            elif c == img: ch = 'b' if c not in t.holes else 'o'
            elif c in t.holes: ch = '~'
            elif c == t.ring: ch = 'R'
            elif k == 'crack': ch = 'X'
            else: ch = '.'
            row += ' ' + ch
        lines.append(row)
    return '\n'.join(lines)


def report(b, name='board', quiet=False):
    t = Trial(b); r = t.solve()
    if not quiet: print(screen(t)); print()
    if not r['ok']: print(name, 'NO WAY to the ring', r['states'], 'states'); return t, r
    nm = lambda c: '%d,%d' % c
    print('%s: %d moves, %s (%d of that length), %d states, %d dead ends, %d pushes, %d crossings' % (
        name, r['len'], 'unique' if r['unique'] else 'NOT unique', r['n_best'], r['states'], len(r['dead']),
        sum(1 for k in r['kinds'] if k == 'push'), t.crossings(r['path'])))
    print('  way:', ' '.join('%s%s' % (nm(st[0]), {'push': '*', 'walk': ''}[k]) for st, k in zip(r['path'][1:], r['kinds'])))
    r0 = Trial(b, image=False).solve()
    print('  without the image:', 'NO WAY (the image is needed)' if not r0['ok'] else 'a way of %d (the image is NOT needed)' % r0['len'])
    return t, r


BOARDS['glass'] = {      # (the fourth level: step into the cracked glass, push the stone away; its image leaves the crack's way and fills the gap by the ring)
    'glass': 4,      # (across the screen: the real side below, the image above)
    'rows': ['     ',
             '     ',
             '     ',
             'h.BX ',
             'rS.. '],
    'cut': [((0, 0), (1, 0)), ((1, 0), (1, 1)), ((2, 0), (2, 1))],
}
BOARDS['glass_lr'] = {      # (the same trial with the glass up the middle, side by side: turned to 'glass' by (gx, gy) -> (gx, 4 - gy))
    'rows': ['rS.. ',
             'h.BX ',
             '     ',
             '     ',
             '     '],
    'cut': [((0, 4), (1, 4)), ((1, 4), (1, 3)), ((2, 4), (2, 3))],
}


def draw(specs, out, PW=540, PH=960):
    """panels shaped as a phone's screen, each (board, step, caption): the board as the eye sees it at that moment of its
    way, fitted to the screen's width as the game's eye is; the real side warm, the image silver, the glass between"""
    from PIL import Image, ImageDraw, ImageFont
    FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    def block(dr, x, y, s, top, left, right, edge):
        dr.polygon([(x - s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x - s, y)], fill=left, outline=edge)
        dr.polygon([(x + s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x + s, y)], fill=right, outline=edge)
        dr.polygon([(x, y - 2 * s), (x + s, y - 1.45 * s), (x, y - 0.9 * s), (x - s, y - 1.45 * s)], fill=top, outline=edge)
    def panel(b, step, caption):
        t = Trial(b); r = t.solve(); path = r['path']
        im = Image.new('RGB', (PW, PH)); dr = ImageDraw.Draw(im, 'RGBA')
        us = [c[0] - c[1] for c in t.kind]; ws = [c[0] + c[1] for c in t.kind]
        K = PW / ((max(us) - min(us)) * 0.87 + 2.6)      # (fitted to the width: the nodes, their slabs and a margin)
        q = K / 62.0      # (the marks' size)
        ox = PW / 2 - (min(us) + max(us)) / 2 * K * 0.87
        top_, bot_ = -max(ws) * 0.5 * K - 1.6 * K, -min(ws) * 0.5 * K + 0.5 * K      # (the board's height, its gate on top)
        oy = (190 + PH - 40) / 2 - (top_ + bot_) / 2
        P = lambda c: (ox + (c[0] - c[1]) * K * 0.87, oy - (c[0] + c[1]) * K * 0.5)
        across = t.k is not None
        gy_ = oy - (t.k if across else 0) * K * 0.5      # (the glass's line on the screen, when it runs across)
        warm, cool = (232, 214, 220), (214, 220, 236)
        for y in range(PH):
            f = y / PH
            if across:
                col = cool if y < gy_ else warm; dr.line([(0, y), (PW, y)], fill=tuple(int(col[i] - 22 * f) for i in range(3)))
            else:
                for x0, x1, col in ((0, ox, warm), (ox, PW, cool)):
                    dr.line([(x0, y), (x1, y)], fill=tuple(int(col[i] - 22 * f) for i in range(3)))
        me, stone = path[step]; img = t.image_of(stone)
        for c in t.kind:      # (the ways: real ones warm, the image's silver)
            for d in ((1, 0), (0, 1)):
                n = (c[0] + d[0], c[1] + d[1])
                if not t.way(c, n): continue
                a_, b_ = P(c), P(n); im_side = t.side(c) > 0 or t.side(n) > 0
                dr.line([a_, b_], fill=(176, 186, 214) if im_side else (214, 186, 150), width=int(24 * q))
                dr.line([a_, b_], fill=(226, 232, 246) if im_side else (240, 222, 196), width=int(15 * q))
        for c, k in t.kind.items():
            x, y = P(c)
            if c in t.holes and c != img:      # (the fog where the image is missing)
                dr.polygon([(x - 36 * q, y), (x, y - 21 * q), (x + 36 * q, y), (x, y + 21 * q)], fill=(236, 240, 250, 150), outline=(170, 178, 205))
                for z in (-1, 1): dr.arc([x + (-16 + z * 7) * q, y - 6 * q, x + (16 + z * 7) * q, y + 6 * q], 200, 340, fill=(160, 170, 200), width=max(2, int(2 * q)))
            elif k != 'crack':
                im_side = k == 'image'
                dr.ellipse([x - 13 * q, y - 8 * q, x + 13 * q, y + 8 * q], fill=(240, 244, 252) if im_side else (255, 248, 236),
                           outline=(170, 180, 212) if im_side else (205, 172, 135), width=max(2, int(3 * q)))
        if across:      # (the glass: a sheet of light standing across the level, facing the eye; the image is seen through it)
            hs = 1.25 * K
            for i in range(int(hs)):
                dr.line([(0, gy_ - i), (PW, gy_ - i)], fill=(255, 255, 255, int(70 * (1 - i / hs) ** 1.5)))
            for k in range(5): dr.line([(0, gy_), (PW, gy_)], fill=(255, 255, 255, 40 + 40 * (k == 4)), width=int((12 - 2.4 * k) * q))
        else:
            ys = [P(c)[1] for c in t.kind]; top, bot = min(ys) - 110 * q, max(ys) + 60 * q
            for k in range(7): dr.line([(ox, top), (ox, bot)], fill=(255, 255, 255, 40 + 30 * (k == 3)), width=int((14 - 2 * k) * q))
        for c, k in t.kind.items():      # (the crack: an opening of light in the glass)
            if k != 'crack': continue
            x, y = P(c); hh = 1.25 * K if across else 46 * q
            dr.polygon([(x - 18 * q, y + 8 * q), (x - 7 * q, y - 0.85 * hh), (x + 6 * q, y - 0.3 * hh), (x + 15 * q, y - hh), (x + 20 * q, y + 8 * q)],
                       fill=(255, 252, 240, 225), outline=(255, 255, 255))
        if step > 0:
            pts = [P(st[0]) for st in path[:step + 1]]
            for a_, b_ in zip(pts, pts[1:]): dr.line([(a_[0], a_[1] - 3 * q), (b_[0], b_[1] - 3 * q)], fill=(150, 62, 40, 200), width=max(3, int(4 * q)))
        x, y = P(t.ring)
        dr.ellipse([x - 22 * q, y - 14 * q, x + 22 * q, y + 14 * q], outline=(255, 255, 250), width=int(6 * q))
        last = path[-2][0]; d = (t.ring[0] - last[0], t.ring[1] - last[1])      # (the gate: just beyond the ring, along her last step)
        gx_, gy2 = P((t.ring[0] + 0.55 * d[0], t.ring[1] + 0.55 * d[1]))
        dr.rectangle([gx_ - 16 * q, gy2 - 74 * q, gx_ + 16 * q, gy2 - 6 * q], outline=(150, 156, 186), width=int(7 * q))
        dr.rectangle([gx_ - 9 * q, gy2 - 67 * q, gx_ + 9 * q, gy2 - 6 * q], fill=(255, 255, 252))
        x, y = P(stone); block(dr, x, y, 20 * q, (252, 244, 230), (236, 220, 196), (204, 182, 152), (150, 118, 90))
        if img is not None:
            x, y = P(img)
            if img in t.holes: y += 14 * q      # (sunk to the way's top: a stepping stone)
            block(dr, x, y, 20 * q, (236, 242, 255, 200), (206, 216, 240, 190), (180, 192, 226, 190), (140, 152, 196))
        x, y = P(me)
        dr.ellipse([x - 9 * q, y - 4 * q, x + 9 * q, y + 5 * q], fill=(0, 0, 0, 40))
        dr.polygon([(x - 7 * q, y), (x + 7 * q, y), (x + 4 * q, y - 30 * q), (x - 4 * q, y - 30 * q)], fill=(178, 82, 54), outline=(120, 48, 32))
        dr.ellipse([x - 5 * q, y - 41 * q, x + 5 * q, y - 30 * q], fill=(247, 234, 220), outline=(150, 110, 90))
        f1 = ImageFont.truetype(FONTB, 27); f2 = ImageFont.truetype(FONT, 21)
        num, _, text = caption.partition('|')
        yy = 22
        for txt, f, col, lh in ((num, f1, (110, 46, 40), 36), (text, f2, (64, 50, 56), 28)):      # (each wrapped to the panel)
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
    name = a[0] if a and not a[0].startswith('--') else 'glass'
    report(BOARDS[name], name)
    if '--draw' in a:      # (each panel 'step:caption', or 'board@step:caption' for another board)
        i = a.index('--draw'); specs = []
        for p in a[i + 2:]:
            st, _, cap = p.partition(':'); bn = name
            if '@' in st: bn, st = st.split('@')
            specs.append((BOARDS[bn], int(st), cap))
        draw(specs, a[i + 1])
