"""Animates the first intro card (Theron and the marble woman) from its painted layers.

usage: python3 animate_card1.py <layers dir> <out.mp4> [seconds] [font.ttf | notext]
Layers (all 941x1672, in place): bg, theron (no arm), arm, statue, tools, branch, waves.
The card's words form letter by letter in the empty clay under the ground line.
"""
import sys, math, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
DUR = float(sys.argv[3]) if len(sys.argv) > 3 else 12.5
FONT = sys.argv[4] if len(sys.argv) > 4 else '../../assets/fonts/LiberationSerif-Regular.ttf'
LINES = [("On Kythira there lived a sculptor named Theron.", 1.3),      # (text, the second its first letter appears)
         ("From white marble he carved a woman,", 4.0),
         ("and loved her more than stone should be loved.", 7.1)]
PER_CHAR, CHAR_FADE = 0.05, 0.55
FPS = 30
OW, OH = 1080, 1920

def load(n): return Image.open('%s/%s.png' % (src, n)).convert('RGBA')
bg = load('bg'); W, H = bg.size
theron, arm, statue, tools, branch, waves = [load(n) for n in ('theron', 'arm', 'statue', 'tools', 'branch', 'waves')]

rng = np.random.default_rng(7)
def smooth_noise(cell):
    small = Image.fromarray((rng.random((H // cell + 2, W // cell + 2)) * 255).astype(np.uint8))
    return np.asarray(small.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(cell * 0.3)), dtype=np.float32) / 255.0
NOISE = smooth_noise(22)
NOISE2 = smooth_noise(9)
YY = np.arange(H, dtype=np.float32)[:, None]

def ease(x): x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)
def seg(t, a, b): return min(max((t - a) / (b - a), 0.0), 1.0)

def with_alpha(layer, mul):
    a = np.asarray(layer).copy(); a[..., 3] = (a[..., 3].astype(np.float32) * mul).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')

def ink_in(layer, p):
    """paint soaks in unevenly, the way slip takes on clay"""
    if p >= 1.0: return layer
    if p <= 0.0: return None
    return with_alpha(layer, np.clip((p * 1.35 - NOISE) * 5.0, 0.0, 1.0))

def carve_in(layer, p, top, bottom):
    """revealed from the head down, with a ragged edge"""
    if p >= 1.0: return layer, bottom + 99
    front = top - 30 + (bottom - top + 70) * p
    return with_alpha(layer, np.clip((front + (NOISE2 - 0.5) * 70.0 - YY) / 16.0, 0.0, 1.0)), front

def shifted(layer, dx, dy):
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.paste(layer, (int(round(dx)), int(round(dy)))); return c

# the words: one painted layer, and for every pixel the moment its letter begins to appear
TEXT = None
if FONT != 'notext':
    size = 50
    while True:
        font = ImageFont.truetype(FONT, size)
        if max(font.getlength(l) for l, _ in LINES) <= W - 100 or size <= 24: break
        size -= 1
    txt = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(txt)
    TMAP = np.full((H, W), 1e9, dtype=np.float32)
    y = 1262
    for line, t0 in LINES:
        x = (W - font.getlength(line)) / 2.0
        dr.text((x, y), line, font=font, fill=255)
        for k in range(len(line)):
            x0 = int(x + font.getlength(line[:k])); x1 = int(math.ceil(x + font.getlength(line[:k + 1])))
            TMAP[y - 6:y + int(size * 1.35), x0:x1] = t0 + k * PER_CHAR
        y += int(size * 1.5)
    worn = 0.84 + 0.16 * smooth_noise(7)   # a little uneven, like slip on clay, but never so worn that a letter is lost
    TEXT_A = np.asarray(txt, dtype=np.float32) / 255.0 * worn
    TEXT_RGB = np.array([58.0, 34.0, 23.0], dtype=np.float32)
    TEXT = True
    FINE = smooth_noise(4)

# the shoulder: centre of the arm's blunt end
A = np.asarray(arm)[..., 3] > 40
ys, xs = np.where(A & (np.arange(W)[None, :] < 392))
PIVOT = (float(xs.mean()), float(ys.mean()))
BR_PIVOT = (W - 1.0, 380.0)
ST_TOP, ST_BOT, ST_X0, ST_X1 = 594, 1159, 503, 645

# timeline (seconds)
T_BG, T_MAN, T_TOOLS, T_CARVE0, T_CARVE1, T_REACH0, T_REACH1 = 1.0, 1.1, 2.3, 3.0, 6.4, 6.7, 8.2

dust = []   # [x, y, vx, vy, born, life, size]
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (OW, OH), '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', out], stdin=subprocess.PIPE)
N = int(DUR * FPS)
for f in range(N):
    t = f / FPS
    frame = bg.copy()
    # the sea and the olive never stop
    frame.alpha_composite(shifted(waves, 7.0 * math.sin(t * 1.5) , 2.0 * math.sin(t * 3.0 + 0.6)))
    frame.alpha_composite(branch.rotate(2.6 * math.sin(t * 1.25) + 1.0 * math.sin(t * 2.9 + 1.0), resample=Image.BICUBIC, center=BR_PIVOT))
    # the marble woman, carved from the head down
    pc = seg(t, T_CARVE0, T_CARVE1)
    front = None
    if pc > 0.0:
        st, front = carve_in(statue, pc, ST_TOP, ST_BOT)
        if t > T_REACH1:   # once he touches her, the stone warms a little
            g = 0.5 - 0.5 * math.cos(min((t - T_REACH1) / 1.6, 1.0) * math.pi)
            a = np.asarray(st).astype(np.float32); a[..., :3] = np.clip(a[..., :3] * (1.0 + 0.07 * g) + np.array([6.0, 3.0, 0.0]) * g, 0, 255)
            st = Image.fromarray(a.astype(np.uint8), 'RGBA')
        frame.alpha_composite(st)
    # the sculptor
    pm = ease(seg(t, T_MAN, T_MAN + 1.3))
    man = ink_in(theron, pm)
    if man is not None:
        frame.alpha_composite(man)
        # his arm: at rest, then working, then reaching for her shoulder
        ang = -62.0
        if t > T_CARVE0 - 0.5:
            lift = ease(seg(t, T_CARVE0 - 0.5, T_CARVE0 + 0.3))
            work = 0.0 if t > T_CARVE1 else 1.0
            tap = (abs(math.sin((t - T_CARVE0) * 5.2)) ** 3) * 9.0 * ease(seg(t, T_CARVE0, T_CARVE0 + 0.4)) * ease(seg(T_CARVE1 - t, 0.0, 0.5))
            ang = -62.0 + 32.0 * lift + tap
        if t > T_REACH0: ang = -30.0 * (1.0 - ease(seg(t, T_REACH0, T_REACH1)))
        a_img = arm.rotate(ang, resample=Image.BICUBIC, center=PIVOT)
        frame.alpha_composite(ink_in(a_img, pm) if pm < 1.0 else a_img)
    tl = ink_in(tools, ease(seg(t, T_TOOLS, T_TOOLS + 0.8)))
    if tl is not None: frame.alpha_composite(tl)
    # marble dust falls from wherever the stone is being cut
    if front is not None and pc < 1.0:
        for _ in range(3):
            x = rng.uniform(ST_X0 - 4, ST_X1 + 4)
            dust.append([x, min(front, ST_BOT) + rng.uniform(-10, 10), rng.uniform(-14, 14), rng.uniform(25, 70), t, rng.uniform(0.6, 1.3), rng.choice([1, 1, 2])])
    if dust:
        px = frame.load()
        keep = []
        for d in dust:
            age = t - d[4]
            if age > d[5]: continue
            keep.append(d)
            x = d[0] + d[2] * age; y = d[1] + d[3] * age + 60.0 * age * age
            if y > 1152: y = 1152 - (y - 1152) * 0.15
            al = (1.0 - age / d[5]) * 0.85
            for ox in range(d[6]):
                for oy in range(d[6]):
                    xi, yi = int(x) + ox, int(y) + oy
                    if 0 <= xi < W and 0 <= yi < H:
                        r, g, b, _ = px[xi, yi]
                        px[xi, yi] = (int(r + (238 - r) * al), int(g + (214 - g) * al), int(b + (184 - b) * al), 255)
        dust = keep
    # the words soak into the clay, letter after letter
    if TEXT:
        al = TEXT_A * np.clip(((t - TMAP) / CHAR_FADE * 1.3 - FINE) * 4.0, 0.0, 1.0)
        if al.max() > 0.0:
            a = np.asarray(frame).astype(np.float32)
            a[..., :3] = a[..., :3] * (1.0 - al[..., None]) + TEXT_RGB * al[..., None]
            frame = Image.fromarray(a.astype(np.uint8), 'RGBA')
    # a slow push in, and the opening out of black
    z = 1.0 + 0.04 * ease(t / DUR)
    cw, ch = W / z, H / z; cx = W * 0.5; cy = min(max(H * 0.53, ch / 2), H - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    o = frame.convert('RGB').resize((OW, OH), Image.LANCZOS, box=box)
    k = ease(seg(t, 0.0, T_BG))
    if k < 1.0: o = Image.fromarray((np.asarray(o).astype(np.float32) * k).astype(np.uint8))
    ff.stdin.write(o.tobytes())
ff.stdin.close(); ff.wait()
print('wrote', out, N, 'frames', 'pivot', PIVOT)
