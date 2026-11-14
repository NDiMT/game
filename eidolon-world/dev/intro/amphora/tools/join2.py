#!/usr/bin/env python3
# card 2 is two clips, one after the other: the statue takes colour (v/vf/c2a), then she steps down (v/vf/c2b).
# Both are made with vidprep.py (OUTDIR=...); this joins them into the frames the vase wears (v/vf/c2), with a short
# pause between in which the end of the first settles into the beginning of the second. The red that rises in her
# dress is turned to the game's red, as the paintings' red is.
import os, numpy as np
from PIL import Image
S = '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/gem/v/vf/'
RED = np.array([178, 60, 46], np.float32); pur = np.array([121, 57, 74], np.float32)
def hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]; mx = a.max(2); mn = a.min(2); d = mx - mn + 1e-6
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60.0
    return h, d / (mx + 1e-6), mx
def red(a):
    h, s, v = hsv(a); w = np.clip(np.clip((h - 262) / 14.0, 0, 1) * np.clip((s - 0.18) / 0.14, 0, 1) * (v > 40), 0, 1)[..., None]
    lum = (a * [0.3, 0.5, 0.2]).sum(2) / (pur * [0.3, 0.5, 0.2]).sum()
    return a * (1 - w) + np.clip(RED[None, None] * lum[..., None], 0, 255) * w
A = sorted(f for f in os.listdir(S + 'c2a') if f.endswith('.jpg')); B = sorted(f for f in os.listdir(S + 'c2b') if f.endswith('.jpg'))
d = S + 'c2/'; os.makedirs(d, exist_ok=True)
for f in os.listdir(d): os.remove(d + f)
k = 0
def put(arr):
    global k; Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save('%s%04d.jpg' % (d, k), quality=95); k += 1
last = None
for f in A:
    a = np.asarray(Image.open(S + 'c2a/' + f)).astype(np.float32); a[215:, 300:748] = red(a[215:, 300:748]); put(a); last = a      # (her part of the picture only)
b = np.asarray(Image.open(S + 'c2b/' + B[0])).astype(np.float32)
for j in range(1, 13):
    w = j / 13.0; w = w * w * (3 - 2 * w); put(last * (1 - w) + b * w)
for f in B: put(np.asarray(Image.open(S + 'c2b/' + f)).astype(np.float32))
open(d + 'mode.txt', 'w').write('once'); print('card 2:', len(A), '+ 12 +', len(B), '=', k, 'frames')
