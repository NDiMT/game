#!/usr/bin/env python3
# card 2 is two clips that run on as one: the statue takes colour (a), then she steps down (b). Clip b was made to
# begin on the very last frame of clip a (FIRSTIMG= in genvid.py), so there is no join to hide.
#   join2.py join A.mp4 B.mp4 OUT.mp4 : the two clips end to end. Inside a movement the video model pauses for a frame
#       every eight or so, which reads as a stutter: those held frames are taken out, so the movement runs evenly.
#   join2.py red : after vidprep.py, the red that rises in her dress is turned to the game's red, as the paintings' is.
import sys, os, subprocess, numpy as np
from PIL import Image
S = '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/gem'
def load(n):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', n, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    return np.frombuffer(r, np.uint8).reshape(-1, 1080, 1920, 3)
def even(F, tag):
    g = F[:, 196:932:2, 714:1166:2].astype(np.int16).mean(3)      # her part of the picture (elsewhere the model only redraws its lines)
    m = np.array([float((np.abs(g[k + 1] - g[k]) > 25).mean() * 100) for k in range(len(F) - 1)])
    mv = np.where(m > 0.3 * m.max())[0]
    if not len(mv): return F
    a, b = mv[0], mv[-1]; med = float(np.median(m[a:b + 1])); keep = np.ones(len(F), bool)
    for k in range(a, b + 1):
        if m[k] < 0.33 * med: keep[k + 1] = False      # this frame hardly differs from the one before it: a held frame inside the movement
    print(' ', tag, 'movement from frame', a, 'to', b, '(median change %.1f):' % med, int((~keep).sum()), 'held frames taken out of', len(F))
    return F[keep]
if sys.argv[1] == 'join':
    A = even(load(sys.argv[2]), 'a'); B = even(load(sys.argv[3]), 'b')[1:]
    last = A[-1].astype(np.float32); B = B.copy()
    for j in range(4):      # b's first frames are redrawn a hair differently from a's last: led in over four frames (the pose is the same, so nothing doubles)
        w = (j + 1) / 5.0; B[j] = (last * (1 - w) + B[j].astype(np.float32) * w).astype(np.uint8)
    F = np.concatenate([A, B])
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1920x1080', '-r', '24', '-i', '-', '-c:v', 'libx264', '-crf', '8', '-pix_fmt', 'yuv420p', sys.argv[4]], stdin=subprocess.PIPE)
    p.stdin.write(F.tobytes()); p.stdin.close(); p.wait(); print('  joined:', len(A), '+', len(B), '=', len(F), 'frames')
else:
    RED = np.array([178, 60, 46], np.float32); pur = np.array([121, 57, 74], np.float32); d = S + '/v/vf/c2/'
    for f in sorted(os.listdir(d)):
        if not f.endswith('.jpg'): continue
        im = np.asarray(Image.open(d + f)).astype(np.float32); a = im[215:, 300:748]      # (her part of the picture only)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]; mx = a.max(2); mn = a.min(2); dd = mx - mn + 1e-6
        h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60.0
        w = np.clip(np.clip((h - 262) / 14.0, 0, 1) * np.clip((dd / (mx + 1e-6) - 0.18) / 0.14, 0, 1) * (mx > 40), 0, 1)[..., None]
        lum = (a * [0.3, 0.5, 0.2]).sum(2) / (pur * [0.3, 0.5, 0.2]).sum()
        im[215:, 300:748] = a * (1 - w) + np.clip(RED[None, None] * lum[..., None], 0, 255) * w
        Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)).save(d + f, quality=95)
    print('  card 2: red turned')
