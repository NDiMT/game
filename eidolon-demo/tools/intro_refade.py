"""The intro film fades in from, and out to, a light blue. Here those fades go to the start screen's soft dawn instead
(lilac, peach, rose, lilac from top to bottom): each faded frame is moved by how far it is faded (measured against the
clean frame next to the fade), from the blue toward the dawn at that row. The film opens on, and closes into, the
pure dawn, so it meets the start screen without a seam.
usage: python3 -I tools/intro_refade.py <in.mp4> <out.mp4> [unused]"""
import subprocess, sys, numpy as np
from PIL import Image
from scipy import ndimage
src, out, backdrop = sys.argv[1], sys.argv[2], sys.argv[3]
W, H, FPS = 720, 1280, 24.0
FADE = np.array([177.0, 187.0, 217.0])
ST = [(0.0, (0xe3, 0xd2, 0xe6)), (0.3, (0xf8, 0xe3, 0xdc)), (0.55, (0xf6, 0xd9, 0xd6)), (0.8, (0xec, 0xd3, 0xdf)), (1.0, (0xdc, 0xc8, 0xe0))]      # (the soft dawn of the start screen: the film fades out into it)
vv = np.arange(H) / float(H - 1); lv = np.array([v for v, _ in ST]); lc = np.array([c for _, c in ST], float)
prof = np.stack([np.interp(vv, lv, lc[:, i]) for i in range(3)], -1)
G = np.broadcast_to(prof[:, None, :], (H, W, 3)).astype(np.float32)
L = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout)
N = int(round(L * FPS))
def frame_at(t):
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', str(t), '-i', src, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True)
    return np.frombuffer(r.stdout[:W * H * 3], np.uint8).reshape(H, W, 3).astype(np.float32)
clean_a = frame_at(2.0).reshape(-1, 3).mean(axis=0); clean_b = frame_at(L - 2.6).reshape(-1, 3).mean(axis=0)
dec = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-i', src, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
enc = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-r', '24', '-i', '-',
                        '-i', src, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-c:a', 'copy', '-movflags', '+faststart', out], stdin=subprocess.PIPE)
n = 0; changed = 0
while True:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3: break
    t = n / FPS
    if t < 2.0 or t > L - 2.6:
        f = np.frombuffer(buf, np.uint8).reshape(H, W, 3).astype(np.float32)
        clean = clean_a if t < 2.0 else clean_b
        m = f.reshape(-1, 3).mean(axis=0)
        a = float(np.clip(np.mean((m - clean) / (FADE - clean)), 0.0, 1.0))
        sm = lambda x: float(np.clip(x, 0.0, 1.0)) ** 2 * (3.0 - 2.0 * float(np.clip(x, 0.0, 1.0)))
        a2 = max(a, 1.0 - sm(t / 0.6)) if t < 2.0 else max(a, sm((t - (L - 1.5)) / 1.3))      # (it opens on, and closes into, the pure dawn: the start screen's own ground)
        if a2 > 0.004:
            k = (1.0 - a2) / max(1.0 - a, 1e-3)
            f = k * (f - a * FADE[None, None, :].astype(np.float32)) + a2 * G; changed += 1
            buf = np.clip(f, 0, 255).astype(np.uint8).tobytes()
    enc.stdin.write(buf); n += 1
enc.stdin.close(); enc.wait(); print('frames', n, 'changed', changed)
