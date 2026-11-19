"""The fourth level's trial: the image is stepped on. Rules, as the game will play them:

  - A wall of glass stands up the middle of the screen, on the board's diagonal gx = gy (the eye looks along it, so it
    is seen edge on). Above it on the board (gy > gx: the left of the screen) is the real side; below it (gx > gy: the
    right of the screen) is its image: the same floors turned over about the glass, (gx, gy) -> (gy, gx). The image is
    not whole: where it is missing there is only the fog (a hole).
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
  'r' a floor whose image is the ring   'X' a crack in the glass (on the diagonal gx = gy only)   ' ' nothing
Cells on the diagonal are glass unless 'X'; cells right of it (gx > gy) are left blank: the image is made from the real.
Ways join every two neighbouring floors; 'cut' lists real pairs with no way between them (and none between their
images); 'stairs' lists real pairs joined by a stair (no pushing over it).

usage: python3 -I tools/go/glass_trial.py [board] [--draw out.png step:caption ...]
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


def parse(rows):
    n = len(rows); cells = {}
    for r, row in enumerate(rows):
        gy = n - 1 - r
        for gx, ch in enumerate(row):
            if ch == ' ' or gx > gy: continue
            if gx == gy and ch != 'X': continue
            cells[(gx, gy)] = ch
    return cells


class Trial:
    def __init__(s, b, image=True):
        cells = parse(b['rows']) if 'rows' in b else dict(b['cells'])
        s.N = len(b['rows']) if 'rows' in b else b['N']
        s.kind = {}      # (gx, gy) -> 'real' | 'image' | 'crack'
        for c, ch in cells.items():
            if ch == 'X': s.kind[c] = 'crack'; continue
            s.kind[c] = 'real'; s.kind[(c[1], c[0])] = 'image'
        s.holes = set((c[1], c[0]) for c, ch in cells.items() if ch == 'h')
        rs = [tuple(b['ring_of'])] if b.get('ring_of') else [c for c, ch in cells.items() if ch == 'r']      # ('ring_of': the real cell whose image is the ring, when another mark stands on it)
        s.ring = (rs[0][1], rs[0][0]) if rs else None
        s.start = [c for c, ch in cells.items() if ch == 'S'][0]
        s.stone0 = [c for c, ch in cells.items() if ch == 'B'][0]
        cut = set()
        for a, c in b.get('cut', []):
            for p, q in ((a, c), ((a[1], a[0]), (c[1], c[0]))): cut.add((p, q)); cut.add((q, p))
        s.stairs = set()
        for a, c in b.get('stairs', []):
            for p, q in ((a, c), ((a[1], a[0]), (c[1], c[0]))): s.stairs.add((p, q)); s.stairs.add((q, p))
        s.cut = cut
        s.use_image = image
    def way(s, p, q): return p in s.kind and q in s.kind and (p, q) not in s.cut
    def side(s, c): return -1 if c[1] > c[0] else (1 if c[0] > c[1] else 0)
    def image_of(s, stone):
        if not s.use_image: return None
        m = (stone[1], stone[0]); return m if s.kind.get(m) == 'image' else None
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


def screen(t, st=None):      # (as the eye sees it: the board turned 45 degrees, the glass up the middle)
    me, stone = st if st else (t.start, t.stone0); img = t.image_of(stone)
    us = [c[0] - c[1] for c in t.kind]; vs = [c[0] + c[1] for c in t.kind]
    lines = []
    for v in range(max(vs), min(vs) - 1, -1):
        row = ''
        for u in range(min(us), max(us) + 1):
            if (u + v) % 2: row += ' |' if u == 0 else '  '; continue
            c = ((v + u) // 2, (v - u) // 2); k = t.kind.get(c)
            if k is None: ch = '|' if u == 0 else ' '
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
    'rows': ['rS.. ',
             'h.BX ',
             '     ',
             '     ',
             '     '],
    'cut': [((0, 4), (1, 4)), ((1, 4), (1, 3)), ((2, 4), (2, 3))],
}


def draw(b, out, panels):
    """the board as the eye sees it, at moments of the way: the real side warm, the image silver, the glass between"""
    from PIL import Image, ImageDraw, ImageFont
    t = Trial(b); r = t.solve(); path = r['path']
    FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    PW, PH, K = 640, 700, 62.0
    P = lambda c, cx, cy: (cx + (c[0] - c[1]) * K * 0.87, cy - (c[0] + c[1]) * K * 0.5)
    def block(dr, x, y, s, top, left, right, edge):
        dr.polygon([(x - s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x - s, y)], fill=left, outline=edge)
        dr.polygon([(x + s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x + s, y)], fill=right, outline=edge)
        dr.polygon([(x, y - 2 * s), (x + s, y - 1.45 * s), (x, y - 0.9 * s), (x - s, y - 1.45 * s)], fill=top, outline=edge)
    def panel(step, caption):
        im = Image.new('RGB', (PW, PH)); dr = ImageDraw.Draw(im, 'RGBA')
        for y in range(PH):
            k = y / PH
            for x0, x1, col in ((0, PW // 2, (232, 214, 220)), (PW // 2, PW, (214, 220, 236))):
                c = tuple(int(col[i] - 22 * k) for i in range(3)); dr.line([(x0, y), (x1, y)], fill=c)
        allp = [P(c, 0, 0) for c in t.kind]
        cx = PW / 2
        cy = PH / 2 - (min(p[1] for p in allp) + max(p[1] for p in allp)) / 2 + 70
        me, stone = path[step]; img = t.image_of(stone)
        ways = []
        for c in t.kind:
            for d in ((1, 0), (0, 1)):
                n = (c[0] + d[0], c[1] + d[1])
                if t.way(c, n): ways.append((c, n))
        for a, c in ways:      # (the ways: real ones warm, the image's silver; a way into the glass pale)
            a_, b_ = P(a, cx, cy), P(c, cx, cy); im_side = t.side(a) > 0 or t.side(c) > 0
            dr.line([a_, b_], fill=(176, 186, 214) if im_side else (214, 186, 150), width=24)
            dr.line([a_, b_], fill=(226, 232, 246) if im_side else (240, 222, 196), width=15)
        ys = [p[1] for p in allp]
        top, bot = cy + min(ys) - 110, cy + max(ys) + 60
        for k in range(7):      # (the glass: a sheet of light seen edge on)
            dr.line([(cx, top), (cx, bot)], fill=(255, 255, 255, 40 + 30 * (k == 3)), width=14 - 2 * k)
        for c, k in t.kind.items():
            if k != 'crack': continue
            x, y = P(c, cx, cy)
            dr.polygon([(x - 18, y + 8), (x - 6, y - 40), (x + 7, y - 14), (x + 16, y - 46), (x + 20, y + 8)], fill=(255, 252, 240, 210), outline=(255, 255, 255))
        for c, k in t.kind.items():
            x, y = P(c, cx, cy)
            if c in t.holes and c != img:      # (the fog where the image is missing)
                dr.polygon([(x - 36, y), (x, y - 21), (x + 36, y), (x, y + 21)], fill=(236, 240, 250, 150), outline=(170, 178, 205))
                for q in (-1, 1): dr.arc([x - 16 + q * 7, y - 6, x + 16 + q * 7, y + 6], 200, 340, fill=(160, 170, 200), width=2)
            elif k == 'crack': pass
            else:
                im_side = k == 'image'
                dr.ellipse([x - 13, y - 8, x + 13, y + 8], fill=(240, 244, 252) if im_side else (255, 248, 236), outline=(170, 180, 212) if im_side else (205, 172, 135), width=3)
        if step > 0:
            pts = [P(st[0], cx, cy) for st in path[:step + 1]]
            for a_, b_ in zip(pts, pts[1:]): dr.line([(a_[0], a_[1] - 3), (b_[0], b_[1] - 3)], fill=(150, 62, 40, 200), width=4)
        x, y = P(t.ring, cx, cy)
        dr.ellipse([x - 22, y - 14, x + 22, y + 14], outline=(255, 255, 250), width=6)
        gx_, gy_ = P((t.ring[0] + 0.55, t.ring[1]), cx, cy)      # (the gate, just beyond the ring)
        dr.rectangle([gx_ - 16, gy_ - 74, gx_ + 16, gy_ - 6], outline=(150, 156, 186), width=7); dr.rectangle([gx_ - 9, gy_ - 67, gx_ + 9, gy_ - 6], fill=(255, 255, 252))
        x, y = P(stone, cx, cy); block(dr, x, y, 20, (252, 244, 230), (236, 220, 196), (204, 182, 152), (150, 118, 90))
        if img is not None:
            x, y = P(img, cx, cy)
            if img in t.holes: y += 14      # (sunk to the way's top: a stepping stone)
            block(dr, x, y, 20, (236, 242, 255, 200), (206, 216, 240, 190), (180, 192, 226, 190), (140, 152, 196))
        x, y = P(me, cx, cy)
        dr.ellipse([x - 9, y - 4, x + 9, y + 5], fill=(0, 0, 0, 40))
        dr.polygon([(x - 7, y), (x + 7, y), (x + 4, y - 30), (x - 4, y - 30)], fill=(178, 82, 54), outline=(120, 48, 32))
        dr.ellipse([x - 5, y - 41, x + 5, y - 30], fill=(247, 234, 220), outline=(150, 110, 90))
        f1 = ImageFont.truetype(FONTB, 26); f2 = ImageFont.truetype(FONT, 21)
        num, _, text = caption.partition('|')
        dr.text((24, 20), num, font=f1, fill=(110, 46, 40))
        words = text.split(); line = ''; yy = 58
        for w in words:
            if dr.textlength(line + ' ' + w, font=f2) > PW - 48: dr.text((24, yy), line.strip(), font=f2, fill=(64, 50, 56)); yy += 28; line = ''
            line += ' ' + w
        dr.text((24, yy), line.strip(), font=f2, fill=(64, 50, 56))
        return im
    ims = [panel(int(p.split(':', 1)[0]), p.split(':', 1)[1]) for p in panels]
    o = Image.new('RGB', (PW * len(ims) + 12 * (len(ims) - 1), PH), (255, 255, 255))
    for i, im in enumerate(ims): o.paste(im, (i * (PW + 12), 0))
    o.save(out); print('saved', out, o.size)


if __name__ == '__main__':
    a = sys.argv[1:]
    name = a[0] if a and not a[0].startswith('--') else 'glass'
    report(BOARDS[name], name)
    if '--draw' in a:
        i = a.index('--draw'); draw(BOARDS[name], a[i + 1], a[i + 2:])
