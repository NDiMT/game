"""The second level's trial, a tutorial: the stone pushed into the gap of a causeway. Rules, as the game will play them:

  - She moves one node per swipe, along a way.
  - The stone is pushed one node straight on along a level way, if the node beyond is free (never onto the ring, never
    up or down a stair).
  - A gap in the way (a fallen slab: still water) cannot be walked into. The stone pushed into it falls in and fills
    it, its top flush with the way: from then on it is the way.
  - Reach the ring of light.

It proves a hand-laid board by a breadth-first search over the whole state (where she is, where the stone is, which
gaps are filled): the shortest way and whether it is the only one of its length, every state from which the ring can
no longer be reached (a dead end), and whether the stone is needed. Then it can draw the board and moments of the way.

The board's cells: gx runs up and to the right on the screen (the world's -z), gy up and to the left (the world's -x).

usage: python3 -I tools/go/push_trial.py [board] [--draw out.png step:caption ...]
"""
import os, sys
from collections import deque

BOARDS = {
    # the missing slab: she starts beside the stone, pushes it onto the causeway's line, goes round behind it, and pushes
    # it along into the gap; then over it, and up the island's stair to the ring
    'gap': {
        'nodes': {'S': (0, -1), 'K': (0, 0), 'L': (0, 1), 'N': (-1, 0), 'M': (-1, 1), 'C': (1, 1), 'H': (2, 1),
                  'D': (3, 1), 'E': (4, 1), 'R': (5, 1)},
        'ways': [('S', 'K'), ('K', 'L'), ('K', 'N'), ('N', 'M'), ('M', 'L'), ('L', 'C'), ('C', 'H'), ('H', 'D'),
                 ('D', 'E', 'stair'), ('E', 'R')],
        'start': 'S', 'ring': 'R', 'stone': 'K', 'gaps': ['H'],
    },
}


class Trial:
    def __init__(s, b, stone=True):
        s.b = b; s.names = list(b['nodes']); s.ix = {n: i for i, n in enumerate(s.names)}
        s.at = {s.ix[n]: tuple(c) for n, c in b['nodes'].items()}; s.cell = {c: i for i, c in s.at.items()}
        s.ways = {}
        for w in b['ways']:
            p, q = s.ix[w[0]], s.ix[w[1]]; lv = len(w) < 3
            s.ways[(p, q)] = lv; s.ways[(q, p)] = lv
        s.start, s.ring = s.ix[b['start']], s.ix[b['ring']]
        s.stone0 = s.ix[b['stone']] if stone and b.get('stone') else -1
        s.gaps = [s.ix[g] for g in b.get('gaps', [])]
    def gap_bit(s, i): return (1 << s.gaps.index(i)) if i in s.gaps else 0
    def init(s): return (s.start, s.stone0, 0)
    def moves(s, st):
        me, stone, filled = st; c = s.at[me]
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            j = s.cell.get((c[0] + d[0], c[1] + d[1]))
            if j is None or (me, j) not in s.ways: continue
            if s.gap_bit(j) and not filled & s.gap_bit(j): continue      # (still water: no way yet)
            if j == stone:
                if not s.ways[(me, j)]: continue      # (pushed only along a level way)
                k = s.cell.get((s.at[j][0] + d[0], s.at[j][1] + d[1]))
                if k is None or (j, k) not in s.ways or not s.ways[(j, k)] or k == s.ring: continue
                if s.gap_bit(k) and not filled & s.gap_bit(k): yield (j, -1, filled | s.gap_bit(k)), d, 'fall'      # (it falls in and fills the gap)
                else: yield (j, k, filled), d, 'push'
                continue
            yield (j, stone, filled), d, 'walk'
    def solve(s):
        st0 = s.init(); dist = {st0: 0}; ways = {st0: 1}; prev = {st0: None}; q = deque([st0]); order = []
        while q:
            st = q.popleft(); order.append(st)
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
        back = {}      # (which states can still reach the ring)
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


def report(name):
    b = BOARDS[name]; t = Trial(b); r = t.solve()
    if not r['ok']: print(name, 'NO WAY to the ring'); return t, r
    nm = lambda st: '%s%s' % (t.names[st[0]], '' if st[1] < 0 else '(stone %s)' % t.names[st[1]])
    print('%s: %d swipes, %s (%d of that length), %d states, %d dead ends' % (name, r['len'], 'unique' if r['unique'] else 'NOT unique', r['n_best'], r['states'], len(r['dead'])))
    print('  way:', ' '.join('%s%s' % (t.names[st[0]], {'push': '*', 'fall': '!', 'walk': ''}[k]) for st, k in zip(r['path'][1:], r['kinds'])))
    for st in r['dead'][:8]: print('  dead end:', nm(st), 'filled', st[2])
    r0 = Trial(b, stone=False).solve()
    print('  without the stone:', 'NO WAY (the stone is needed)' if not r0['ok'] else 'a way of %d (the stone is NOT needed)' % r0['len'])
    print('  pushes:', sum(1 for k in r['kinds'] if k != 'walk'))
    return t, r


def draw(name, out, panels):
    from PIL import Image, ImageDraw, ImageFont
    t, r = Trial(BOARDS[name]), None; r = t.solve(); path = r['path']
    FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    PW, PH, K = 560, 700, 74.0
    P = lambda c, cx, cy: (cx + (c[0] - c[1]) * K * 0.87, cy - (c[0] + c[1]) * K * 0.5)
    def panel(step, caption):
        im = Image.new('RGB', (PW, PH)); dr = ImageDraw.Draw(im, 'RGBA')
        for y in range(PH):
            k = y / PH; dr.line([(0, y), (PW, y)], fill=(int(250 - 18 * k), int(240 - 26 * k), int(222 - 20 * k)))
        allp = [P(c, 0, 0) for c in t.at.values()]
        cx = PW / 2 - (min(p[0] for p in allp) + max(p[0] for p in allp)) / 2
        cy = PH / 2 - (min(p[1] for p in allp) + max(p[1] for p in allp)) / 2 + 60
        me, stone, filled = path[step]
        for (p, q), lv in t.ways.items():      # (the ways: grooves in the stone; a stair drawn as steps)
            if p > q: continue
            a_, b_ = P(t.at[p], cx, cy), P(t.at[q], cx, cy)
            dr.line([a_, b_], fill=(214, 186, 150), width=22); dr.line([a_, b_], fill=(240, 222, 196), width=14)
            if not lv:
                for k in range(1, 6):
                    m = (a_[0] + (b_[0] - a_[0]) * k / 6, a_[1] + (b_[1] - a_[1]) * k / 6)
                    dr.line([(m[0] - 11, m[1] - 6), (m[0] + 11, m[1] + 6)], fill=(190, 160, 125), width=3)
        for i, c in t.at.items():
            x, y = P(c, cx, cy)
            if i in t.gaps and not filled & t.gap_bit(i):      # (the gap: still water where a slab fell)
                dr.polygon([(x - 34, y), (x, y - 20), (x + 34, y), (x, y + 20)], fill=(120, 168, 178), outline=(80, 120, 132))
                for k in (-1, 1): dr.arc([x - 16 + k * 6, y - 6, x + 16 + k * 6, y + 6], 200, 340, fill=(220, 238, 240), width=2)
            elif i in t.gaps:      # (filled: the stone's top flush with the way)
                dr.polygon([(x - 30, y), (x, y - 17), (x + 30, y), (x, y + 17)], fill=(246, 236, 220), outline=(170, 135, 100), width=2)
                dr.ellipse([x - 13, y - 8, x + 13, y + 8], fill=(255, 248, 236), outline=(205, 172, 135), width=3)
            else:
                dr.ellipse([x - 13, y - 8, x + 13, y + 8], fill=(255, 248, 236), outline=(205, 172, 135), width=3)
        if step > 0:      # (the way she has gone so far)
            pts = [P(t.at[s[0]], cx, cy) for s in path[:step + 1]]
            for a_, b_ in zip(pts, pts[1:]): dr.line([(a_[0], a_[1] - 3), (b_[0], b_[1] - 3)], fill=(150, 62, 40, 200), width=4)
        x, y = P(t.at[t.ring], cx, cy)
        dr.ellipse([x - 22, y - 14, x + 22, y + 14], outline=(255, 255, 250), width=6); dr.ellipse([x - 26, y - 17, x + 26, y + 17], outline=(250, 226, 190), width=2)
        if step + 1 < len(path) and path[step + 1][1] != stone:      # (the next swipe pushes: an arrow from the stone the way it goes)
            d = (t.at[path[step + 1][0]][0] - t.at[me][0], t.at[path[step + 1][0]][1] - t.at[me][1])
            s0 = t.at[stone]; a_ = P(s0, cx, cy); b_ = P((s0[0] + d[0] * 0.8, s0[1] + d[1] * 0.8), cx, cy)
            dr.line([(a_[0], a_[1] - 26), (b_[0], b_[1] - 26)], fill=(196, 72, 46, 230), width=6)
            vx, vy = b_[0] - a_[0], b_[1] - a_[1]; L = (vx * vx + vy * vy) ** 0.5; vx, vy = vx / L, vy / L
            tip = (b_[0], b_[1] - 26)
            dr.polygon([tip, (tip[0] - vx * 16 - vy * 9, tip[1] - vy * 16 + vx * 9), (tip[0] - vx * 16 + vy * 9, tip[1] - vy * 16 - vx * 9)], fill=(196, 72, 46, 230))
        if stone >= 0:      # (the stone: a squared block of marble)
            x, y = P(t.at[stone], cx, cy); s = 19
            dr.polygon([(x - s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x - s, y)], fill=(236, 220, 196), outline=(150, 118, 90))
            dr.polygon([(x + s, y - 1.45 * s), (x, y - 0.9 * s), (x, y + 0.55 * s), (x + s, y)], fill=(204, 182, 152), outline=(150, 118, 90))
            dr.polygon([(x, y - 2 * s), (x + s, y - 1.45 * s), (x, y - 0.9 * s), (x - s, y - 1.45 * s)], fill=(252, 244, 230), outline=(150, 118, 90))
        x, y = P(t.at[me], cx, cy)      # (she: a slender figure in her red bands)
        dr.ellipse([x - 9, y - 4, x + 9, y + 5], fill=(0, 0, 0, 40))
        dr.polygon([(x - 7, y), (x + 7, y), (x + 4, y - 30), (x - 4, y - 30)], fill=(178, 82, 54), outline=(120, 48, 32))
        dr.ellipse([x - 5, y - 41, x + 5, y - 30], fill=(247, 234, 220), outline=(150, 110, 90))
        f1 = ImageFont.truetype(FONTB, 26); f2 = ImageFont.truetype(FONT, 21)
        num, _, text = caption.partition('|')
        dr.text((24, 20), num, font=f1, fill=(120, 48, 32))
        words = text.split(); line = ''; yy = 58
        for w in words:
            if dr.textlength(line + ' ' + w, font=f2) > PW - 48: dr.text((24, yy), line.strip(), font=f2, fill=(70, 52, 40)); yy += 28; line = ''
            line += ' ' + w
        dr.text((24, yy), line.strip(), font=f2, fill=(70, 52, 40))
        return im
    ims = [panel(int(p.split(':', 1)[0]), p.split(':', 1)[1]) for p in panels]
    o = Image.new('RGB', (PW * len(ims) + 12 * (len(ims) - 1), PH), (255, 255, 255))
    for i, im in enumerate(ims): o.paste(im, (i * (PW + 12), 0))
    o.save(out); print('saved', out, o.size)


if __name__ == '__main__':
    a = sys.argv[1:]
    name = a[0] if a and not a[0].startswith('--') else 'gap'
    report(name)
    if '--draw' in a:
        i = a.index('--draw'); draw(name, a[i + 1], a[i + 2:])
