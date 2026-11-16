"""The plan of "The Moon Dial" (the third level, gomoon/): a sanctuary in the snow on a mountain at night. Its board is
the one tools/go/moon_design.py proves (MOON); here its cells are laid square in world metres, with room for the flights
between heights, and the trial is written out for the game (gomoon/puzzle.json).

  the court (height 0): the stone in it, the moon dial on a balcony south of it; the row above the court (height 0), its
  face at the east looking down at the court's end (dial 0) or along its row (dial 1); the middle terraces (0.65); the
  upper terrace (1.3) where the frozen guardian walks, its face at the west end looking down to its balcony (dial 0) or
  along the terrace (dial 1); the ring on a dais above the terrace's east end (1.95). She comes up out of the snow.

grid (gx, gy) -> world: x = -ROW[gy] (the eye's upper left), z = -gx (the eye's upper right)

usage: python3 -I tools/go/moon_plan.py <out plan.json>      (writes puzzle.json beside it)
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROW = {0: -1.2, 1: 0.0, 2: 1.5, 3: 3.4, 4: 4.8, 5: 6.6, 6: 8.6}
H0, HM, HT, HR, HS = 0.0, 0.65, 1.3, 1.95, -1.3
HEIGHT = {1: H0, 2: H0, 0: H0, 3: HM, 4: HM, 5: HT, 6: HR}


def W(gx, gy, h=None):
    return [round(-ROW[gy], 3), HEIGHT[gy] if h is None else h, round(-float(gx), 3)]


def plan():
    sv = sys.argv; sys.argv = [sv[0], '--none']
    spec = importlib.util.spec_from_file_location('md', os.path.join(HERE, 'moon_design.py')); md = importlib.util.module_from_spec(spec)
    try: spec.loader.exec_module(md)
    except SystemExit: pass
    sys.argv = sv
    M = md.MOON
    nodes = {}
    for c in M['cells']:
        if c in ('S', 'R'): continue
        n = '%d%d' % c
        nodes[n] = W(c[0], c[1], HT if n == '04' else None)
    nodes['R'] = W(3, 6)
    # the flights, each from one floor's edge to the next, square to the axes: foot, head, width, steps
    E = 0.45
    fl = {
        ('22', '23'): [[-(ROW[2] + E), H0, -2.0], [-(ROW[3] - E), HM, -2.0], 0.9, 5],
        ('24', '25'): [[-(ROW[4] + E), HM, -2.0], [-(ROW[5] - E), HT, -2.0], 0.9, 5],
        ('35', 'R'): [[-(ROW[5] + E), HT, -3.0], [-(ROW[6] - 0.7), HR, -3.0], 0.9, 5],
    }
    intro = [[0.0, -2.6, 4.65], [0.0, H0, E], 0.9, 18]      # (out of the snow and the mist, a long way up to the court)
    flights = list(fl.values()) + [intro]
    edges = []
    for p_, q_, k in M['ways']:
        a = p_ if isinstance(p_, str) else '%d%d' % p_; b = q_ if isinstance(q_, str) else '%d%d' % q_
        if 'S' in (a, b): continue
        if k == 'flight':
            f = fl.get((a, b)) or fl.get((b, a))
            lo, hi = f[0], f[1]
            edges.append([a, b, [lo, hi] if nodes[a][1] < nodes[b][1] else [hi, lo]])
        else: edges.append([a, b, []])
    floors = {
        'C': {'h': H0, 'xz': [[E, E], [-E, E], [-E, -2.6], [-(ROW[2] - E), -2.6], [-(ROW[2] - E), -0.55], [-(ROW[2] + E), -0.55],
                              [-(ROW[2] + E), -4.45], [-0.6, -4.45], [-0.6, -5.5], [E, -5.5], [E, -1.85], [2.0, -1.85], [2.0, -0.5], [E, -0.5]]},      # (the dial's balcony south of the court, room on it for a brazier)
        'M': {'h': HM, 'xz': [[-(ROW[3] - E), -0.55], [-(ROW[3] - E), -2.45], [-(ROW[3] + E), -2.45], [-(ROW[3] + E), -1.45],
                              [-(ROW[4] - E), -1.45], [-(ROW[4] - E), -2.45], [-(ROW[4] + E), -2.45], [-(ROW[4] + E), -1.6], [-(ROW[4] + 1.3), -1.6],
                              [-(ROW[4] + 1.3), -0.55]]},      # (a bay at the west, for a broken column; its north edge on the floor's, so no jog)
        'T': {'h': HT, 'xz': [[-(ROW[5] - E), E], [-(ROW[5] + E), E], [-(ROW[5] + E), -1.0], [-(ROW[5] + 1.35), -1.0], [-(ROW[5] + 1.35), -2.3],
                              [-(ROW[5] + E), -2.3], [-(ROW[5] + E), -3.45], [-(ROW[5] - E), -3.45],
                              [-(ROW[5] - E), -E], [-(ROW[4] - E), -E], [-(ROW[4] - E), E]]},      # (a bay behind the terrace, for columns)
        'D': {'h': HR, 'xz': [[-(ROW[6] - 0.7), -2.0], [-(ROW[6] - 0.7), -4.0], [-(ROW[6] + 0.9), -4.0], [-(ROW[6] + 0.9), -2.0]]},
    }
    puzzle = {
        'nodes': nodes, 'edges': edges, 'start': '01', 'exit': 'R', 'block': M['stone'],
        'watchers': [{'node': '05', 'facing': '04', 'gaze': True}, {'node': '32', 'facing': '31', 'gaze': True}],
        'volute': {'node': M['dial'], 'toggles': {'watchers': {'05': ['04', '15'], '32': ['31', '22']}}},
        'wanderers': [{'route': list(M['route'])}],
        'plinths': True, 'intro': [intro[0], intro[1]],
        'solution': ['11', '10', '21', '31', '32', '31', '21', '11', '10', '21', '31', '32', '22', '23', '13', '14', '24', '25', '35', 'R'],
        'lines': ['The moon keeps two faces.', 'Turn it, and they turn with it.'], 'end': 'Neither of them saw her go.',
    }
    pl = {
        'scene': 'moon', 'heights': {'H0': H0, 'HM': HM, 'HT': HT, 'HR': HR}, 'floors': floors, 'flights': flights,
        'nodes': nodes, 'edges': edges, 'ring': nodes['R'], 'stone': nodes[M['stone']],
        'faces': [[nodes['05'], [0, 0, 1]], [nodes['32'], [1, 0, 0]]],
        'columns': [[[-5.75, HM, -0.95], 0.8], [[-7.55, HT, -1.35], 1.25], [[-7.55, HT, -1.95], 0.7]],
        'braziers': [[-0.05, H0, -5.15], [1.68, H0, -1.48], [-8.15, HR, -2.25], [-8.15, HR, -3.75]],      # (warm lights: past the court, beside the dial (to the eye's right of its face), at the dais)
        'arches': [[[-(ROW[6] + 0.55), HR, -3.0], 'z']],      # (its way through along x: she comes up the last flight along x, through the light, into the gate)
        'rocks': [[[1.2, -0.7, -3.4], 1.0, -0.6], [[-2.4, -0.4, 0.6], 0.9, -0.3], [[-3.9, 0.1, -3.6], 1.1, 0.0], [[-6.2, 0.6, 1.5], 1.0, 0.7],
                  [[-8.3, 1.0, -0.6], 1.1, 1.1], [[-5.6, 0.3, -4.4], 1.0, 0.3], [[2.0, -1.0, 0.8], 0.9, -1.0]],
        'volute': None, 'head': None, 'relief': None, 'cypress': None,
        'eye': {'pitch': 35.0, 'centre': [-4.49, 0.5, -3.72], 'width': 10.8},      # (the whole level, the arch's top 4.1 m under the frame's: the moon's sky above it; the long stair up out of the mist below)
        'scenery': [['face', [-14.0, 9.0, -14.0], [5.0, 5.0, 5.0], [0.95, 0.96, 1.0]]],      # (for the concept's layout only: the moon)
    }
    return pl, puzzle


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'gomoon/plan.json'
    pl, pz = plan()
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    json.dump(pl, open(out, 'w'), indent=1); json.dump(pz, open(os.path.join(os.path.dirname(out), 'puzzle.json'), 'w'), indent=1)
    print('wrote', out, 'and puzzle.json:', len(pz['nodes']), 'nodes', len(pz['edges']), 'ways', len(pz['solution']), 'swipes')
