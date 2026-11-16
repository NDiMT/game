"""The intro film's background (the light behind the vase, at the top corners) becomes the first level's own sky:
lilac at the top melting into peach at the vase's shoulders. Each pixel near the background colour is moved by how
much of the background is in it (so the vase's anti-aliased edge keeps no lilac fringe)."""
import subprocess, sys, numpy as np
from PIL import Image
from scipy import ndimage
src, out, mask_png = sys.argv[1], sys.argv[2], sys.argv[3]
W, H = 720, 1280
BG = np.array([218, 197, 224.0])
lev = [(0.0, (219, 188, 222)), (0.05, (221, 190, 227)), (0.1, (231, 196, 223)), (0.15, (247, 208, 208)), (0.2, (254, 213, 196)), (0.25, (253, 214, 199)), (0.3, (252, 218, 209))]
m0 = np.asarray(Image.open(mask_png)) > 127
rows = np.nonzero(m0.any(axis=1))[0]; y1 = int(rows.max()) + 4
region = ndimage.binary_dilation(m0, iterations=3)[:y1]
vv = 0.13 + (np.arange(y1) / float(rows.max())) * 0.17      # (the level's sky from lilac-pink down to peach, over the visible corners)
lv = np.array([v for v, _ in lev]); lc = np.array([c for _, c in lev], float)
grad = np.stack([np.interp(vv, lv, lc[:, i]) for i in range(3)], -1)[:, None, :]
dec = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
enc = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', '24', '-i', '-',
                        '-i', src, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-c:a', 'copy', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
n = 0
while True:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3: break
    f = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32)
    top = f[:y1]
    d = np.linalg.norm(top - BG, axis=2)
    al = np.clip(1.0 - d / 46.0, 0.0, 1.0) * region
    top += al[..., None] * (grad - BG)
    f[:y1] = top
    enc.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes()); n += 1
enc.stdin.close(); enc.wait(); print('frames', n)
