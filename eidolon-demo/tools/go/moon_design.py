"""Boards for "The Moon Dial" laid by hand and proven by the same search as tools/go/moon_trial.py (the game's rules).

usage: python3 -I tools/go/moon_design.py [design]
"""
import importlib.util, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
_argv = sys.argv; sys.argv = [sys.argv[0], '0']
spec = importlib.util.spec_from_file_location('mt', os.path.join(HERE, 'moon_trial.py')); mt = importlib.util.module_from_spec(spec); spec.loader.exec_module(mt)
sys.argv = _argv
E, S_, W, N = 0, 1, 2, 3


def show(name, cells, ways, faces, lever, stone, route, named=None):
    mt.NAMED_POS = dict(named or {})
    mt.set_board(cells, ways)
    t = mt.Trial(faces, lever, stone, route)
    sol = mt.solve(t)
    print('\n######', name)
    xs = [p[0] for p in mt.P]; ys = [p[1] for p in mt.P]
    for y in range(max(ys), min(ys) - 1, -1):
        row = ''
        for x in range(min(xs), max(xs) + 1):
            here = [i for i in range(len(mt.P)) if mt.P[i] == (x, y)]
            if not here: row += '  .  '; continue
            n = mt.NAMES[here[0]]
            tag = n
            if n == lever: tag = 'DIAL'
            elif n == stone: tag = '#' + n
            elif n in [f for f, _, _ in faces]:
                f = [f for f in faces if f[0] == n][0]; tag = 'F' + 'ESWN'[f[1]] + 'ESWN'[f[2]]
            elif route and n in route: tag = 'g' + n
            row += '%-5s' % tag
        print(row)
    if not sol: print('NO WAY'); return None
    print('shortest %d, %d way(s) of that length, %d states, %d dead ends' % (sol['len'], sol['ways'], sol['states'], sol['traps']))
    print(' '.join('%s%s' % (n, '(' + e + ')' if e else '') for n, e in sol['path']))
    for k in range(len(faces)):
        s2 = mt.solve(mt.Trial([f for i, f in enumerate(faces) if i != k], lever, stone, route), traps=False)
        print('  without face %s:' % faces[k][0], 'no way' if s2 is None else '%d' % s2['len'])
    s3 = mt.solve(mt.Trial(faces, None, stone, route), traps=False); print('  without the dial:', 'no way' if s3 is None else '%d' % s3['len'])
    s4 = mt.solve(mt.Trial(faces, lever, mt.NAMES[[i for i in range(len(mt.NAMES)) if mt.NAMES[i] not in [stone, lever, 'S', 'R'] + [f for f, _, _ in faces] + list(route or [])][-1]], route), traps=False)
    s5 = mt.solve(mt.Trial(faces, lever, stone, []), traps=False); print('  without the guardian:', 'no way' if s5 is None else '%d' % s5['len'])
    return sol


D = {}
# v1: the court below with the dial and the face that guards it; the bridge up; the terrace above where the guardian walks;
# the face at the terrace's corner looks down the bridge (dial 0) or along the terrace (dial 1)
def v1():
    cells = ['S', (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (4, 2), (1, 0), (0, 2), (0, 3), (0, 4), (0, 5), (1, 5), (2, 5), (3, 5), (4, 5), 'R']
    named = {'S': (-1, 1), 'R': (4, 6)}
    ways = mt.grid_ways(cells, flights=[('S', (0, 1)), ((4, 5), 'R')], cut=[((1, 0), (1, 1))])
    ways = [w for w in ways if not (w[0] == (0, 1) and w[1] == (0, 2))]
    ways.append(((0, 1), (0, 2), 'level'))
    faces = [('05', S_, E), ('41', N, W)]
    return show('v1', cells, ways, faces, '10', '21', ['15', '25', '35'], named)
D['v1'] = v1

# v2: the bridge rises from the court by a flight (the face's look down it stops there); the stone waits in a nook
# above the court and is pushed down into the court row, to shade the dial from the second face
def v2():
    cells = ['S', (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (1, 0), (2, 2), (2, 3), (3, 2), (3, 3), (4, 2),
             (0, 2), (0, 3), (0, 4), (0, 5), (1, 5), (2, 5), (3, 5), (4, 5), 'R']
    named = {'S': (-1, 1), 'R': (4, 6)}
    ways = mt.grid_ways(cells, flights=[('S', (0, 1)), ((4, 5), 'R'), ((0, 1), (0, 2))], cut=[((3, 2), (4, 2)), ((2, 2), (3, 2))])
    faces = [('05', S_, E), ('41', N, W)]
    return show('v2', cells, ways, faces, '10', '22', ['15', '25', '35'], named)
D['v2'] = v2

# v4: the dial in the court below; the second face, at the court's east end, swings its look along the court when
# the dial turns, so the stone is first brought down from the nook into the court to shade the dial; the first face, at
# the top of the west stair, looks down it until the dial swings its look along the terrace and the guardian there
# shatters; then the stair is free, and the first face is broken from its side
def v4():
    cells = ['S', (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (4, 2), (1, 0), (1, 2), (2, 2), (2, 3), (3, 2), (3, 3),
             (0, 2), (0, 3), (0, 4), (0, 5), (1, 5), (2, 5), (3, 5), 'R']
    named = {'S': (-1, 1), 'R': (3, 6)}
    ways = mt.grid_ways(cells, flights=[('S', (0, 1)), ((3, 5), 'R'), ((0, 1), (0, 2))],
                        cut=[((3, 2), (4, 2)), ((1, 2), (0, 2)), ((2, 3), (3, 3)) if False else ((9, 9), (9, 9))])
    faces = [('05', S_, E), ('41', N, W)]
    return show('v4', cells, ways, faces, '10', '22', ['15', '25', '35'], named)
D['v4'] = v4

def from_local(path):
    import json
    g = json.load(open(os.path.join(HERE, path)))
    fixed = ['S', (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (0, 2), (0, 3), (0, 4), (0, 5), (1, 5), (2, 5), (3, 5), 'R']
    cells = list(dict.fromkeys(fixed + [tuple(c) for c in g['mid_on']] + [tuple(g['dial'])]))
    cut = [tuple(map(tuple, c)) for c in g['cut']]
    ways = mt.grid_ways(cells, flights=[('S', (0, 1)), ((3, 5), 'R'), ((0, 1), (0, 2))], cut=cut)
    named = {'S': (-1, 1), 'R': (3, 6)}
    dial = '%d%d' % tuple(g['dial'])
    return show(path, ['S'] + [c for c in cells if c not in ('S', 'R')] + ['R'], ways, [('05', S_, E), tuple(g['B'])], dial, g['stone'], ['15', '25', '35'], named)
for sd in '1234': D['L' + sd] = (lambda sd=sd: from_local('moon_best_%s.json' % sd))

# THE MOON DIAL (from the local search, seed 1, with its unreached cells taken out): the court below, the stone in it;
# the dial south of the court; the second face on the row above the court, looking down at the court's east end (dial
# 0) or along its own row (dial 1); the middle terraces; the first face at the upper terrace's west end, looking down
# to its balcony (dial 0) or along the terrace where the guardian walks (dial 1); the ring above the terrace's east end
MOON = dict(
    cells=['S', (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (1, 0), (1, 2), (2, 2), (3, 2), (4, 2), (1, 3), (2, 3), (0, 4), (1, 4), (2, 4),
           (0, 5), (1, 5), (2, 5), (3, 5), 'R'],
    ways=[('S', (0, 1), 'flight'), ((0, 1), (1, 1), 'level'), ((1, 1), (2, 1), 'level'), ((2, 1), (3, 1), 'level'), ((3, 1), (4, 1), 'level'),
          ((1, 0), (1, 1), 'level'), ((3, 1), (3, 2), 'level'), ((4, 1), (4, 2), 'level'), ((1, 2), (2, 2), 'level'), ((2, 2), (3, 2), 'level'),
          ((3, 2), (4, 2), 'level'), ((2, 2), (2, 3), 'flight'), ((1, 3), (2, 3), 'level'), ((1, 3), (1, 4), 'level'), ((1, 4), (2, 4), 'level'),
          ((2, 4), (2, 5), 'flight'), ((0, 4), (0, 5), 'level'), ((0, 5), (1, 5), 'level'), ((1, 5), (2, 5), 'level'), ((2, 5), (3, 5), 'level'),
          ((3, 5), 'R', 'flight')],
    named={'S': (-1, 1), 'R': (3, 6)},
    faces=[('05', S_, E), ('32', S_, W)], dial='10', stone='11', route=['15', '25', '35'])
def moon(): return show('THE MOON DIAL', MOON['cells'], MOON['ways'], MOON['faces'], MOON['dial'], MOON['stone'], MOON['route'], MOON['named'])
D['moon'] = moon

if __name__ == '__main__':
    names = sys.argv[1:] or list(D)
    for n in names: D[n]()
