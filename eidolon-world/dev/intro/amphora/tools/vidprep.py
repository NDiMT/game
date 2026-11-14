#!/usr/bin/env python3
# usage: vidprep.py CARD CLIP.mp4 : a generated clip -> the frames the vase wears. The clip's colours are fitted to the
# painting; where nothing ever moves the painting itself is kept (crisp, and it cannot shimmer); the end is led
# back into the beginning so that it loops
import sys, os, subprocess, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
S = '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/gem'
c, clip = int(sys.argv[1]), sys.argv[2]
ONCE = os.environ.get('ONCE') == '1'      # a clip that plays once and comes to rest (no loop)
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', clip, '-vf', 'crop=1080:1080:420:0,scale=1100:1100:flags=lanczos', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, 1100, 1100, 3)
if os.environ.get('END'):      # END=a,b (seconds): the clip is cut at its stillest frame between a and b
    a_, b_ = [int(float(v) * 24) for v in os.environ['END'].split(',')]
    mv = [float(np.abs(F[k + 1][::4, ::4].astype(np.int16) - F[k - 1][::4, ::4]).mean()) for k in range(a_, b_)]
    e = a_ + int(np.argmin(mv)); print('  cut at frame', e, '(%.2f s)' % (e / 24.0)); F = F[:e + 1]
N = len(F)
pim = lambda n: np.asarray(Image.open(S + '/v/big/panel%s.png' % n).convert('RGB').resize((1100, 1100), Image.LANCZOS)).astype(np.float32) if int(n) > 7 else np.asarray(Image.open(S + '/v/panel%s.png' % n).convert('RGB')).astype(np.float32)
P = pim(os.environ.get('FITPANEL', c))      # FITPANEL=n: the painting the clip begins on, when that is not the card's own (its colours are fitted to this one)
dk = [float(np.abs(F[k][::4, ::4].astype(np.float32) - P[::4, ::4]).mean()) for k in range(12)]      # a clip may open on a frame or two that are off-colour: begin at the first true one
st = next(k for k in range(12) if dk[k] < 1.15 * min(dk)); F = F[st:]; N = len(F); print('  begins at frame', st, [round(v, 1) for v in dk[:6]])
# the colours are fitted on flat places only (inside a colour, away from every line): there a small shift of the
# drawing between clip and painting does not matter
fl = lambda im: (ndi.maximum_filter(im.mean(2), 11) - ndi.minimum_filter(im.mean(2), 11)) < 14
flat = fl(P) & fl(F[0].astype(np.float32)); flat[::2] = False; flat[:, ::2] = False
x = F[0][flat].astype(np.float32); y = P[flat]
G = np.array([np.polyfit(x[:, ch], y[:, ch], 1) for ch in range(3)], np.float32)      # the clip's colours -> the painting's: each channel its own gain and offset (no channel leaks into another)
fit = lambda f: np.clip(f.astype(np.float32) * G[:, 0] + G[:, 1], 0, 255)
f0 = fit(F[0]); print('card', c, 'frames', N, 'first frame against the painting: mean diff', round(float(np.abs(f0 - P).mean()), 2))
mx = np.zeros((1100, 1100), np.float32)
for k in range(N): mx = np.maximum(mx, ndi.gaussian_filter(np.abs(fit(F[k]) - f0).sum(2), 2.0))
M = ndi.binary_dilation(mx > 42, iterations=12).astype(np.float32)
STILL = {} if ONCE else {1: [(0, 760, 250, 1100)]}      # places where the clip went wrong and the painting is kept (card 1: its waves fade away near the end)
if os.environ.get('STILLBOX'): STILL[c] = STILL.get(c, []) + [tuple(int(v) for v in b.split(',')) for b in os.environ['STILLBOX'].split(';')]      # STILLBOX=x0,y0,x1,y1;... : more places kept as painted
for (x0, y0, x1, y1) in STILL.get(c, []): M[y0:y1, x0:x1] = 0
M = ndi.gaussian_filter(M, 5.0)[..., None]
print('  moving part of the picture: %.1f%%' % (100 * float((M > 0.5).mean())), ' last against first (moving part): %.2f' % float((np.abs(fit(F[N - 1]) - f0) * M).sum() / (M.sum() * 3 + 1)))
if os.environ.get('PANEL'): P = pim(os.environ['PANEL'])      # PANEL=n: the painting that is kept where nothing moves
d = os.environ.get('OUTDIR') or S + '/v/vf/c%d' % c; os.makedirs(d, exist_ok=True)
for f in os.listdir(d): os.remove(d + '/' + f)
T = 8; first = None
PING = () if ONCE else (5, 6, 7)      # clips whose end does not meet their beginning: they are played forward and then back, so there is no join at all
for k in range(N):
    v = fit(F[k]); im = Image.fromarray(v.astype(np.uint8))
    o = P * (1 - M) + np.asarray(im).astype(np.float32) * M
    if k == 0: first = o
    if k >= N - T and c not in PING and not ONCE: w = (k - (N - T) + 1) / float(T + 1); w = w * w * (3 - 2 * w); o = o * (1 - w) + first * w      # the last frames lean into the first
    Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).save('%s/%04d.jpg' % (d, k), quality=95)
Image.fromarray((M[..., 0] * 255).astype(np.uint8)).resize((275, 275)).save(S + '/vid/mask%d.png' % c)
if c in PING:
    import shutil
    for j, k in enumerate(range(N - 2, 0, -1)): shutil.copy('%s/%04d.jpg' % (d, k), '%s/%04d.jpg' % (d, N + j))
    print('  forward and back:', 2 * N - 2, 'frames')
open(d + '/mode.txt', 'w').write('once' if ONCE else 'loop')
