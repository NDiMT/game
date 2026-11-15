# the levels as GDScript data, each with its way through (from the solver)
import json, sys
from mw import MW
LEVELS = [
    ([".....", ".a...", "...*.", "~~~~~", "...*.", ".A...", ".@..."], "What you move\nmoves in the water."),
    ([".....", ".a.#.", "..*..", "~~~~~", "...*.", ".A...", ".@..."], "Over there, a wall\nholds only the image."),
    ([".....", ".a.b.", ".*#.*", "~~~~~", ".*.*.", ".A.B.", "..@.."], "Two stones,\ntwo images."),
    ([".....", "..a.*", ".b...", "~~~~~", ".B.#.", "..A*.", "..@.."], "A thing and its image\nbecome one."),
    ([" ..... ", "*.a.b.*", ".....c.", "~~~~~~~", ".....C.", "#.A.B.#", " *.@.* "], "Over there,\nthe stones follow."),
    ([" .*.*. ", ".a...b.", "...c...", "~~~~~~~", "..C.#..", ".A...B.", " .*@*. "], "Both worlds\nat once."),
]
if len(sys.argv) > 1: LEVELS += [(json.loads(a), "Both worlds.") for a in sys.argv[1:]]
out = []
for rows, line in LEVELS:
    L = MW(rows); path, n = L.solve()
    assert path, rows
    sol = []
    for d, k, ns in path:
        kind = 'p' if k in ('push', 'slip', 'merge') else ('g' if k == 'gate' else 'w')
        sol.append([ns[0][0], ns[0][1], kind])
    rr = ', '.join('"%s"' % r for r in rows)
    ss = ', '.join('[%d, %d, "%s"]' % tuple(s) for s in sol)
    out.append('\t{"map": [%s], "line": "%s",\n\t\t"sol": [%s]},' % (rr, line.replace('\n', '\\n'), ss))
    print(len(path), 'moves', file=sys.stderr)
open('levels.gdtxt', 'w').write('\n'.join(out))
