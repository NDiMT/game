"""Designs for tools/go/trials.py: each a board laid by hand around one idea, proven by the search."""
from trials import *

def grid_cut(cells, ways):
    """the level ways between cells side by side that a design does not have"""
    cs = set(cells); have = {frozenset(w) for w in ways}; out = []
    for c in cs:
        for d in ((1, 0), (0, 1)):
            q = (c[0] + d[0], c[1] + d[1])
            if q in cs and frozenset((c, q)) not in have: out.append((c, q))
    return out

@design
def moon():      # the moon dial (gomoon/): the same rules must give the same proof as tools/go/moon_trial.py
    cells = [(-1, 1), (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (1, 0), (1, 2), (2, 2), (3, 2), (4, 2), (1, 3), (2, 3), (0, 4), (1, 4), (2, 4),
             (0, 5), (1, 5), (2, 5), (3, 5), (3, 6)]
    lv = [((0, 1), (1, 1)), ((1, 1), (2, 1)), ((2, 1), (3, 1)), ((3, 1), (4, 1)), ((1, 0), (1, 1)), ((3, 1), (3, 2)), ((4, 1), (4, 2)), ((1, 2), (2, 2)),
          ((2, 2), (3, 2)), ((3, 2), (4, 2)), ((1, 3), (2, 3)), ((1, 3), (1, 4)), ((1, 4), (2, 4)), ((0, 4), (0, 5)), ((0, 5), (1, 5)), ((1, 5), (2, 5)), ((2, 5), (3, 5))]
    fl = [((-1, 1), (0, 1)), ((2, 2), (2, 3)), ((2, 4), (2, 5)), ((3, 5), (3, 6))]
    B = Board(cells, (-1, 1), (3, 6), cut=grid_cut(cells, lv + fl), flights=fl)
    t = Trial(B, faces=[((0, 5), S_, E), ((3, 2), S_, W)], dial=(1, 0), stone=(1, 1), route=[(1, 5), (2, 5), (3, 5)])
    return report('the moon dial (regression)', t)

@design
def mirror1():      # the bronze mirror: blind the face with the stone, set the mirror, then open its eyes on the other face
    cells = [(0, 0), (1, 0), (2, 0), (3, 0), (2, 1), (2, 2), (2, 3), (2, 4), (1, 1), (1, 2), (1, 3), (1, 4), (0, 2), (3, 1), (3, 2), (3, 3), (3, 4), (4, 3)]
    lv = [((0, 0), (1, 0)), ((1, 0), (2, 0)), ((2, 0), (3, 0)), ((2, 0), (2, 1)), ((2, 1), (2, 2)), ((2, 2), (2, 3)), ((2, 3), (2, 4)),
          ((1, 1), (1, 2)), ((1, 2), (1, 3)), ((1, 3), (1, 4)), ((1, 4), (2, 4)), ((2, 4), (3, 4)), ((0, 2), (1, 2)), ((1, 2), (2, 2)),
          ((3, 0), (3, 1)), ((3, 1), (3, 2)), ((3, 2), (3, 3)), ((3, 3), (3, 4)), ((3, 3), (4, 3))]
    lv = [w for w in lv if w != ((2, 4), (3, 4))]
    B = Board(cells, (0, 0), (4, 3), cut=grid_cut(cells, lv), gaps=[((2, 4), (3, 4))])      # (a chasm before the face that guards the way: only a look crosses it)
    t = Trial(B, faces=[((1, 1), N, N), ((3, 4), S_, S_)], stone=(1, 2), mirrors=[((1, 4), 1)], faces_break=True)
    return report('the bronze mirror', t)

@design
def mirror_aim():      # aim, then fire: set the mirror while the face looks away; turn the dial and its look, bent, breaks the face at the gate
    cells = [(0, 0), (1, 0), (2, 0), (3, 0), (0, 1), (0, 2), (0, 3), (0, 4), (1, 1), (1, 2), (1, 3), (1, 4), (2, 4), (3, 4), (2, 2), (3, 2), (3, 1),
             (4, 0), (4, 1), (4, 2), (4, 3), (4, 4), (4, 5)]
    lv = [((0, 0), (1, 0)), ((1, 0), (2, 0)), ((2, 0), (3, 0)), ((3, 0), (4, 0)), ((0, 0), (0, 1)), ((0, 1), (0, 2)), ((0, 2), (0, 3)), ((0, 3), (0, 4)),
          ((0, 4), (1, 4)), ((1, 1), (1, 2)), ((1, 2), (1, 3)), ((1, 3), (1, 4)), ((1, 4), (2, 4)), ((2, 4), (3, 4)), ((1, 2), (2, 2)), ((2, 2), (3, 2)),
          ((3, 2), (3, 1)), ((3, 1), (3, 0)), ((4, 0), (4, 1)), ((4, 1), (4, 2)), ((4, 2), (4, 3)), ((4, 3), (4, 4)), ((4, 4), (4, 5))]
    B = Board(cells, (0, 0), (4, 5), cut=grid_cut(cells, lv), gaps=[((3, 4), (4, 4))])      # (a chasm before the face at the gate: only a look crosses it)
    t = Trial(B, faces=[((1, 1), E, N), ((4, 4), S_, S_)], dial=(2, 2), mirrors=[((1, 4), 1)], faces_break=True)
    return report('aim, then fire', t)

@design
def hunter_crack():      # the cracked floor: wake the hunter from the head of a flight it cannot climb; step down, and it comes the level way, over the crack
    cells = [(1, 1), (2, 1), (2, 2), (3, 2), (3, 3), (2, 3), (1, 3), (1, 4), (2, 4), (3, 4), (4, 4)]
    lv = [((1, 1), (2, 1)), ((2, 1), (2, 2)), ((2, 2), (3, 2)), ((3, 2), (3, 3)), ((3, 3), (2, 3)), ((2, 3), (1, 3)), ((1, 3), (1, 4)),
          ((2, 4), (3, 4)), ((3, 4), (4, 4)), ((3, 4), (3, 3))]
    fl = [((2, 3), (2, 4))]
    B = Board(cells, (1, 1), (4, 4), cut=grid_cut(cells, lv + fl), flights=fl)
    t = Trial(B, hunters=[((3, 4), W)], cracks=[(3, 3)])
    return report('the cracked floor', t)

@design
def lure():      # the lure: wake the hunter that sleeps on the way, and lead it down through the face's look
    cells = [(0, 1), (0, 2), (0, 3), (0, 4), (0, 5), (1, 0), (1, 1), (1, 2), (1, 3), (1, 5), (2, 0), (2, 3), (2, 5), (3, 0), (3, 1), (3, 2), (3, 3), (3, 5),
             (4, 0), (4, 1), (4, 2), (4, 3), (4, 5)]
    fl = [((3, 2), (3, 3))]
    B = Board(cells, (2, 3), (4, 5), flights=fl)
    t = Trial(B, faces=[((0, 1), E, E)], hunters=[((1, 3), S_)])
    return report('the lure', t)

QUARRY = dict(      # aim, then fire, laid in the quarry: its cells, their heights, the flights between benches, the trench a look crosses
    H={(0, 0): 0.0, (1, 0): 0.0, (2, 0): 0.0, (3, 0): 0.0, (3, 1): 0.0, (3, 2): 0.0, (2, 1): 0.0,
       (0, 1): 0.65, (0, 2): 0.65,
       (0, 3): 1.3, (0, 4): 1.3, (1, 1): 1.3, (1, 2): 1.3, (1, 3): 1.3, (1, 4): 1.3, (2, 4): 1.3, (3, 4): 1.3,
       (4, 0): 1.3, (4, 1): 1.3, (4, 2): 1.3, (4, 3): 1.3, (4, 4): 1.3, (4, 5): 1.3},
    level=[((1, 0), (0, 0)), ((1, 0), (2, 0)), ((2, 0), (3, 0)), ((3, 0), (3, 1)), ((3, 1), (3, 2)), ((3, 1), (2, 1)), ((0, 1), (0, 2)), ((0, 3), (0, 4)),
           ((0, 4), (1, 4)), ((1, 1), (1, 2)), ((1, 2), (1, 3)), ((1, 3), (1, 4)), ((1, 4), (2, 4)), ((2, 4), (3, 4)),
           ((4, 0), (4, 1)), ((4, 1), (4, 2)), ((4, 2), (4, 3)), ((4, 3), (4, 4)), ((4, 4), (4, 5))],
    flights=[((0, 0), (0, 1)), ((0, 2), (0, 3)), ((3, 0), (4, 0))],
    gaps=[((3, 4), (4, 4))],
    start=(0, 0), ring=(4, 5), faces=[((1, 1), E, N), ((4, 4), S_, S_)], dial=(2, 1), mirrors=[((1, 4), 1)])      # (the capstan beside the bench, off the eye's middle line)

@design
def quarry():      # the quarry: aim, then fire, on benches of cut marble at three heights
    Q = QUARRY; cells = list(Q['H'])
    B = Board(cells, Q['start'], Q['ring'], cut=grid_cut(cells, Q['level'] + Q['flights']), flights=Q['flights'], gaps=Q['gaps'])
    t = Trial(B, faces=Q['faces'], dial=Q['dial'], mirrors=Q['mirrors'], faces_break=True)
    return report('the quarry (aim, then fire)', t)
