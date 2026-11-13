#!/usr/bin/env python3
# usage: vidprep.py CARD CLIP.mp4 : a generated clip -> the frames the vase wears. The clip's colours are fitted to the
# painting; where nothing ever moves the painting itself is kept (crisp, and it cannot shimmer); the end is led
# back into the beginning so that it loops
import sys, os, subprocess, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
S = '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/gem'
c, clip = int(sys.argv[1]), sys.argv[2]
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', clip, '-vf', 'crop=1080:1080:420:0,scale=1100:1100:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, 1100, 1100, 3); N = len(F)
P = np.asarray(Image.open(S + '/v/panel%d.png' % c).convert('RGB')).astype(np.float32)
x = F[0][::4, ::4].reshape(-1, 3).astype(np.float32); y = P[::4, ::4].reshape(-1, 3)
A, *_ = np.linalg.lstsq(np.hstack([x, np.ones((len(x), 1), np.float32)]), y, rcond=None)      # the clip's colours -> the painting's
fit = lambda f: np.clip(f.reshape(-1, 3).astype(np.float32) @ A[:3] + A[3], 0, 255).reshape(1100, 1100, 3)
f0 = fit(F[0]); print('card', c, 'frames', N, 'first frame against the painting: mean diff', round(float(np.abs(f0 - P).mean()), 2))
mx = np.zeros((1100, 1100), np.float32)
for k in range(N): mx = np.maximum(mx, ndi.gaussian_filter(np.abs(fit(F[k]) - f0).sum(2), 2.0))
M = ndi.binary_dilation(mx > 42, iterations=12).astype(np.float32)
STILL = {1: [(0, 760, 250, 1100)]}      # places where the clip went wrong and the painting is kept (card 1: its waves fade away near the end)
for (x0, y0, x1, y1) in STILL.get(c, []): M[y0:y1, x0:x1] = 0
M = ndi.gaussian_filter(M, 5.0)[..., None]
print('  moving part of the picture: %.1f%%' % (100 * float((M > 0.5).mean())), ' last against first (moving part): %.2f' % float((np.abs(fit(F[N - 1]) - f0) * M).sum() / (M.sum() * 3 + 1)))
d = S + '/v/vf/c%d' % c; os.makedirs(d, exist_ok=True)
for f in os.listdir(d): os.remove(d + '/' + f)
T = 8; first = None
for k in range(N):
    v = fit(F[k]); im = Image.fromarray(v.astype(np.uint8))
    o = P * (1 - M) + np.asarray(im).astype(np.float32) * M
    if k == 0: first = o
    if k >= N - T: w = (k - (N - T) + 1) / float(T + 1); w = w * w * (3 - 2 * w); o = o * (1 - w) + first * w      # the last frames lean into the first
    Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).save('%s/%04d.jpg' % (d, k), quality=95)
Image.fromarray((M[..., 0] * 255).astype(np.uint8)).resize((275, 275)).save(S + '/vid/mask%d.png' % c)
