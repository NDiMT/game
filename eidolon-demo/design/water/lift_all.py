"""The details in the water of levels 1, 2, 3 and 5 (23/11), lifted from the image model's paintings in this folder and
written into the levels, then their places for ch1.gd's IV_WATER_DETAILS printed (each moved from where it was painted
by place.json's dx, dy, in the frame's pixels at 720 by 1280: the three of a level were each painted at one place).

  python3 -I design/water/lift_all.py [job ...]      (from eidolon-demo/)

Each job: its painting, the take with the water made green, the frame it was painted on, the region in the painting
where the thing is (its box and its water's ellipse come from where the painting differs from the frame there), boxes
of the level to leave out, the water's floor, and where the cut goes.
"""
import json, subprocess, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, binary_opening
W = 'design/water/'
JOBS = {
    '1a': ('1', (900, 2080, 1536, 2700), [], 0.05, 'gowake/wd_lilies.png'),
    '1b': ('1', (1000, 2000, 1536, 2752), [], 0.05, 'gowake/wd_reeds.png'),
    '1c': ('1', (850, 2150, 1536, 2700), [], 0.05, 'gowake/wd_petals.png'),
    '2c': ('2', (100, 2250, 780, 2700), [], 0.05, 'goveil/wd_petals.png'),
    '3a': ('3', (760, 2120, 1420, 2650), [], 0.06, 'gomilos/wd_lilies.png'),
}
PLACE = {j: (dx, dy) for items in json.load(open(W + 'place.json')).values() for j, dx, dy in items}
for j in (sys.argv[1:] or list(JOBS)):
    lv, (x0, y0, x1, y1), drops, floor, dst = JOBS[j]
    paint, green, frame = W + 'level%s_painting.jpg' % j, W + 'level%s_green.jpg' % j, W + 'level%s_frame.png' % lv
    e = np.asarray(Image.open(paint).convert('RGB')).astype(np.float32)
    B = np.asarray(Image.open(frame).convert('RGB').resize((1536, 2752), Image.BICUBIC)).astype(np.float32)
    d = gaussian_filter(np.abs(e - B).max(2), 2.0)[y0:y1, x0:x1]
    for (a, b, c, dd) in drops: d[max(b - y0, 0):max(dd - y0, 0), max(a - x0, 0):max(c - x0, 0)] = 0
    ys, xs = np.nonzero(binary_opening(d > 14, iterations=2))
    bx0, by0, bx1, by1 = xs.min() + x0, ys.min() + y0, xs.max() + x0, ys.max() + y0
    cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2; rx, ry = (bx1 - bx0) / 2 * 1.45 + 30, (by1 - by0) / 2 * 1.45 + 30
    box = (max(int(cx - rx), 0), max(int(cy - ry), 0), min(int(cx + rx), 1536), min(int(cy + ry), 2752))
    args = ['python3', '-I', 'tools/go/water_lift.py', paint, green, frame, dst, '%d,%d,%d,%d' % box, '%.0f,%.0f,%.0f,%.0f' % (cx, cy, rx, ry), '--floor', str(floor), '--new', '25']
    for dr in drops: args += ['--drop', '%d,%d,%d,%d' % dr]
    out = subprocess.run(args, capture_output=True, text=True).stdout.strip().splitlines()
    v = [float(t) for t in out[-1].replace('place:', '').replace('left', '').replace('top', '').replace('width', '').replace('height', '').replace('foot', '').split()]
    dx, dy = PLACE.get(j, (0, 0))
    print('%s ["res://%s", %.1f, %.1f, %.1f, %.1f, %.1f, %.1f]' % (j, dst, v[0] + dx, v[1] + dy, v[2], v[3], v[4] + dx, v[5] + dy))
