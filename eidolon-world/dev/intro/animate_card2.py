"""Animates the second intro card (Aphrodite's condition) from its painted layers.

usage: python3 animate_card2.py <layers dir> <out.mp4> [seconds] [notext]
Layers (all 941x1672, in place): bg, theron (kneeling), statue (hands already flushed), aphrodite, mirror (with her hands), rays.
The light comes down, life runs through the marble from the head to the feet, her hands flush, and she shifts her weight
for the first time. The goddess lifts the mirror as she names her condition. The words form under the ground line.
"""
import sys, math, subprocess, os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
DUR = float(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] != 'notext' else 13.0
NOTEXT = 'notext' in sys.argv
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../assets/fonts/')
LINES = [("Aphrodite gave her life, on one condition:", 1.5, 'LiberationSerif-Regular.ttf'),     # (text, when its first letter appears, face)
         ("“Leave her face smooth.", 5.7, 'LiberationSerif-Italic.ttf'),
         ("A face is carved by living, from within.”", 7.7, 'LiberationSerif-Italic.ttf')]
PER_CHAR, CHAR_FADE = 0.05, 0.55
FPS = 30
OW, OH = 1080, 1920

def load(n): return Image.open('%s/%s.png' % (src, n)).convert('RGBA')
bg = load('bg'); W, H = bg.size
theron, statue, aphrodite, mirror, rays = [load(n) for n in ('theron', 'statue', 'aphrodite', 'mirror', 'rays')]

rng = np.random.default_rng(11)
def smooth_noise(cell):
    small = Image.fromarray((rng.random((H // cell + 2, W // cell + 2)) * 255).astype(np.uint8))
    return np.asarray(small.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(cell * 0.3)), dtype=np.float32) / 255.0
NOISE = smooth_noise(22)
YY = np.arange(H, dtype=np.float32)[:, None]
XX = np.arange(W, dtype=np.float32)[None, :]

def ease(x): x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)
def seg(t, a, b): return min(max((t - a) / (b - a), 0.0), 1.0)
def img(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')

def darken(frame, layer):
    """lays a figure on the clay keeping only what is darker than the clay: its pale lines and pale edge take the
    colour of the vase itself, so no white line shows anywhere on it"""
    f = np.asarray(frame).astype(np.float32); l = np.asarray(layer).astype(np.float32)
    al = l[..., 3:4] / 255.0
    f[..., :3] = f[..., :3] * (1.0 - al) + np.minimum(f[..., :3], l[..., :3]) * al
    return img(f)

def ink_in(layer, p):
    """paint soaks in unevenly, the way slip takes on clay"""
    if p >= 1.0: return layer
    if p <= 0.0: return None
    a = np.asarray(layer).astype(np.float32); a[..., 3] *= np.clip((p * 1.35 - NOISE) * 5.0, 0.0, 1.0)
    return img(a)

# the marble woman before the goddess touches her: duller, and her hands are stone like the rest of her
ST = np.asarray(statue).astype(np.float32)
solid = ST[..., 3] > 200
HANDS = (ST[..., 3] > 0) & ((ST[..., 1] < 138) | (ST[..., 0] - ST[..., 2] > 118)) & (YY > 985) & (YY < 1060)
HANDS_SOFT = np.asarray(Image.fromarray((HANDS * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)), dtype=np.float32) / 255.0
body = ST[solid & ~HANDS][:, :3].mean(0)
STONE = ST.copy()
lum = ST[..., :3].mean(2, keepdims=True)
HAND_STONE = body * np.clip(lum / ST[HANDS & solid][:, :3].mean(), 0.78, 1.18)   # the same hands, painted in the colour of the rest of her
STONE[..., :3] = ST[..., :3] * (1.0 - HANDS_SOFT[..., None]) + HAND_STONE * HANDS_SOFT[..., None]
grey = STONE[..., :3].mean(2, keepdims=True)
STONE[..., :3] = (STONE[..., :3] * 0.8 + grey * 0.2) * 0.93
ALIVE = ST.copy(); ALIVE[..., :3] = np.clip(ALIVE[..., :3] * 1.05 + np.array([6.0, 4.0, 2.0]), 0, 255)
ST_TOP, ST_BOT = 769.0, 1239.0
FOOT = (505.0, 1236.0)            # her leading foot: she rocks about it when she first moves

# the rays, each drawn from the pediment downwards
RA = np.asarray(rays.filter(ImageFilter.MaxFilter(3))).astype(np.float32)      # a touch broader and brighter than painted, so they read as light
RA[..., :3] = np.clip(RA[..., :3] * np.array([1.26, 1.24, 1.2]) + 6.0, 0, 255)
RA[..., 3] = np.clip(RA[..., 3] * 1.5, 0, 255)
RAYS = [(0, 395, 445.0, 520.0, 3.2), (395, 455, 445.0, 602.0, 3.45), (455, W, 445.0, 543.0, 3.7)]   # x0, x1, top, bottom, start
RAY_T = 0.9

DISC = (640.0, 640.0, 66.0)       # the mirror's face
DISC_M = np.clip((DISC[2] - np.hypot(XX - DISC[0], YY - DISC[1])) / 3.0, 0.0, 1.0)
ELBOW = (792.0, 735.0)            # the mirror turns a little about her right elbow
HIP = (175.0, 1150.0)             # the sculptor bows from here

# the words: one painted layer, and for every pixel the moment its letter begins to appear
TEXT = not NOTEXT
if TEXT:
    size = 50
    while True:
        fonts = [ImageFont.truetype(FONTS + f, size) for _, _, f in LINES]
        if max(fn.getlength(l[0]) for fn, l in zip(fonts, LINES)) <= W - 100 or size <= 24: break
        size -= 1
    txt = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(txt)
    TMAP = np.full((H, W), 1e9, dtype=np.float32)
    y = 1262
    for (line, t0, _), font in zip(LINES, fonts):
        x = (W - font.getlength(line)) / 2.0
        dr.text((x, y), line, font=font, fill=255)
        for k in range(len(line)):
            x0 = int(x + font.getlength(line[:k])); x1 = int(math.ceil(x + font.getlength(line[:k + 1]))) + 2
            TMAP[y - 6:y + int(size * 1.35), x0:x1] = np.minimum(TMAP[y - 6:y + int(size * 1.35), x0:x1], t0 + k * PER_CHAR)
        y += int(size * 1.5)
    worn = 0.84 + 0.16 * smooth_noise(7)
    TEXT_A = np.asarray(txt, dtype=np.float32) / 255.0 * worn
    TEXT_RGB = np.array([58.0, 34.0, 23.0], dtype=np.float32)
    FINE = smooth_noise(4)

# timeline (seconds)
T_BG, T_MAN, T_STATUE, T_GOD = 1.0, 0.5, 0.9, 1.5
T_LIFE0, T_LIFE1 = 4.5, 6.0        # life runs down her
T_HANDS0, T_HANDS1 = 5.6, 6.8      # her hands flush
T_MOVE = 6.2                       # she shifts her weight
T_LIFT0, T_LIFT1 = 5.3, 6.3        # the goddess lifts the mirror
GLINTS = (5.9, 9.9)
T_BOW0, T_BOW1 = 6.6, 8.2

motes = []   # [x, y, vx, vy, born, life]
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (OW, OH), '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', out], stdin=subprocess.PIPE)
N = int(DUR * FPS)
for f in range(N):
    t = f / FPS
    frame = bg.copy()
    # the light from above
    ra = RA.copy(); vis = np.zeros((H, W), dtype=np.float32); lit = 0.0
    for i, (x0, x1, top, bot, t0) in enumerate(RAYS):
        p = ease(seg(t, t0, t0 + RAY_T)); lit = max(lit, p)
        if p <= 0.0: continue
        front = top + (bot - top + 12.0) * p
        tw = 0.86 + 0.14 * math.sin(t * 2.6 + i * 2.1)
        vis[:, x0:x1] = np.clip((front - YY) / 8.0, 0.0, 1.0) * tw
    if lit > 0.0:
        ra[..., 3] *= vis; frame.alpha_composite(img(ra))
        # a soft warmth where the rays fall
        gl = np.exp(-(((XX - 420.0) / 150.0) ** 2 + ((YY - 640.0) / 260.0) ** 2)) * 0.10 * lit * (0.9 + 0.1 * math.sin(t * 1.9))
        a = np.asarray(frame).astype(np.float32); a[..., :3] += (np.array([255.0, 226.0, 170.0]) - a[..., :3]) * gl[..., None]; frame = img(a)
    # the sculptor on his knee; he bows when he hears the condition
    pm = ease(seg(t, T_MAN, T_MAN + 1.3))
    man = ink_in(theron, pm)
    if man is not None:
        bow = -3.2 * ease(seg(t, T_BOW0, T_BOW1)) - 0.5 * math.sin(t * 1.3) * ease(seg(t, 2.0, 3.0))
        frame = darken(frame, man.rotate(bow, resample=Image.BICUBIC, center=HIP))
    # the marble woman: stone, then life from the head down, then her hands, then her first movement
    ps = ease(seg(t, T_STATUE, T_STATUE + 1.3))
    if ps > 0.0:
        pl = seg(t, T_LIFE0, T_LIFE1)
        front = ST_TOP - 40.0 + (ST_BOT - ST_TOP + 90.0) * pl
        k = np.clip((front + (NOISE - 0.5) * 60.0 - YY) / 26.0, 0.0, 1.0)[..., None] if pl > 0.0 else 0.0
        ph = ease(seg(t, T_HANDS0, T_HANDS1))
        alive = ALIVE.copy()
        if ph < 1.0:   # until they flush, her hands are the colour of the rest of her
            hs = (HANDS_SOFT * (1.0 - ph))[..., None]
            alive[..., :3] = alive[..., :3] * (1.0 - hs) + np.clip(HAND_STONE * 1.05 + np.array([6.0, 4.0, 2.0]), 0, 255) * hs
        a = STONE * (1.0 - k) + alive * k
        if 0.0 < pl < 1.0:   # the bright edge of it
            band = np.exp(-((YY - front) / 20.0) ** 2) * 0.55
            a[..., :3] += (255.0 - a[..., :3]) * band[..., None]
        st = img(a)
        if ps < 1.0: st = ink_in(st, ps)
        mv = ease(seg(t, T_MOVE, T_MOVE + 1.6))
        rock = -1.6 * mv + 0.55 * math.sin((t - T_MOVE) * 1.15) * mv
        frame.alpha_composite(st.rotate(rock, resample=Image.BICUBIC, center=FOOT) if mv > 0.0 else st)
    # the goddess and her mirror
    pg = ease(seg(t, T_GOD, T_GOD + 1.6))
    god = ink_in(aphrodite, pg)
    if god is not None:
        frame.alpha_composite(god)
        lift = ease(seg(t, T_LIFT0, T_LIFT1))
        m = mirror.rotate(-2.6 * lift + 0.35 * math.sin(t * 0.9) * lift, resample=Image.BICUBIC, center=ELBOW)
        frame.alpha_composite(ink_in(m, pg) if pg < 1.0 else m)
        for g0 in GLINTS:   # light crossing the bronze
            pgl = seg(t, g0, g0 + 1.1)
            if 0.0 < pgl < 1.0:
                d = (XX - DISC[0]) * 0.8 + (YY - DISC[1]) * 0.6 - (pgl * 2.0 - 1.0) * (DISC[2] + 30.0)
                gl = np.exp(-(d / 13.0) ** 2) * DISC_M * 0.5 * math.sin(pgl * math.pi)
                a = np.asarray(frame).astype(np.float32); a[..., :3] += (np.array([255.0, 240.0, 205.0]) - a[..., :3]) * gl[..., None]; frame = img(a)
    # motes of light drift down the rays onto her
    if lit > 0.3 and t < DUR - 1.0 and f % 2 == 0:
        motes.append([rng.uniform(350, 490), rng.uniform(450, 560), rng.uniform(-5, 5), rng.uniform(26, 52), t, rng.uniform(2.2, 4.2)])
    if motes:
        frame = frame.copy(); px = frame.load(); keep = []
        for d in motes:
            age = t - d[4]
            if age > d[5]: continue
            keep.append(d)
            x = d[0] + d[2] * age + 5.0 * math.sin(age * 2.0 + d[0]); y = d[1] + d[3] * age
            al = math.sin(min(age / d[5], 1.0) * math.pi) * 0.8
            for ox, oy in ((0, 0), (1, 0), (0, 1), (1, 1)):
                xi, yi = int(x) + ox, int(y) + oy
                if 0 <= xi < W and 0 <= yi < H:
                    r, g, b, _ = px[xi, yi]
                    px[xi, yi] = (int(r + (255 - r) * al), int(g + (232 - g) * al), int(b + (180 - b) * al), 255)
        motes = keep
    # the words soak into the clay, letter after letter
    if TEXT:
        al = TEXT_A * np.clip(((t - TMAP) / CHAR_FADE * 1.3 - FINE) * 4.0, 0.0, 1.0)
        if al.max() > 0.0:
            a = np.asarray(frame).astype(np.float32)
            a[..., :3] = a[..., :3] * (1.0 - al[..., None]) + TEXT_RGB * al[..., None]
            frame = img(a)
    # a slow push in, and the opening out of black
    z = 1.0 + 0.04 * ease(t / DUR)
    cw, ch = W / z, H / z; cx = W * 0.5; cy = min(max(H * 0.53, ch / 2), H - ch / 2)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    o = frame.convert('RGB').resize((OW, OH), Image.LANCZOS, box=box)
    kf = ease(seg(t, 0.0, T_BG))
    if kf < 1.0: o = Image.fromarray((np.asarray(o).astype(np.float32) * kf).astype(np.uint8))
    ff.stdin.write(o.tobytes())
ff.stdin.close(); ff.wait()
print('wrote', out, N, 'frames')
