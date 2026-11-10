"""Animates the third intro card (Ione, and the face life carves her) from its painted layers.

usage: python3 animate_card3.py <layers dir> <out.mp4> [seconds] [notext]
Layers (all 941x1672, in place): bg, waves, theron (in the doorway), ione (short hair, straight dress), hair and skirt
(the parts the wind carries). Her hair and the hem of her dress stream in the wind off the sea, chips of marble leave
her face, and the sculptor appears in his doorway for the last sentence. The words form in the open clay above her.
"""
import sys, math, subprocess, os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
DUR = float(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] != 'notext' else 15.5
NOTEXT = 'notext' in sys.argv
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../assets/fonts/LiberationSerif-Regular.ttf')
# blocks of words: (first line's y, the second the block fades away or None, [(line, the second its first letter appears)])
BLOCKS = [(372, 9.3, [("They called her Ione.", 1.6), ("And life began to carve", 3.4), ("her a face, a face the", 4.6),
                      ("sculptor had never", 5.75), ("imagined.", 6.7)]),
          (430, None, [("He could not bear a face", 10.6), ("he had not carved himself.", 11.9)])]
SIZE, LEAD = 48, 58
PER_CHAR, CHAR_FADE = 0.05, 0.55
FPS = 30
OW, OH = 1080, 1920

def load(n): return Image.open('%s/%s.png' % (src, n)).convert('RGBA')
bg = load('bg'); W, H = bg.size
waves, theron, ione, hair, skirt = [load(n) for n in ('waves', 'theron', 'ione', 'hair', 'skirt')]
# the loose piece of the dress is a little wider than the figure under it: at its top that showed as a step on her
# hip, so its left edge is drawn in to meet her there and let out again lower down
sk = np.asarray(skirt).astype(np.float32)
_y = np.arange(sk.shape[0], dtype=np.float32)[:, None]; _x = np.arange(sk.shape[1], dtype=np.float32)[None, :]
_s = np.clip((_y - 1014.0) / 100.0, 0.0, 1.0); _lim = 355.5 - 12.0 * _s * _s * (3 - 2 * _s)
sk[..., 3] *= np.clip((_x - _lim) / 1.5 + 1.0, 0.0, 1.0)
skirt = Image.fromarray(sk.astype(np.uint8), 'RGBA')

rng = np.random.default_rng(23)
def smooth_noise(cell):
    small = Image.fromarray((rng.random((H // cell + 2, W // cell + 2)) * 255).astype(np.uint8))
    return np.asarray(small.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(cell * 0.3)), dtype=np.float32) / 255.0
NOISE = smooth_noise(22)
YY = np.arange(H, dtype=np.float32)[:, None]
XX = np.arange(W, dtype=np.float32)[None, :]

def ease(x): x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)
def seg(t, a, b): return min(max((t - a) / (b - a), 0.0), 1.0)
def sstep(a, b, x): x = np.clip((x - a) / (b - a), 0.0, 1.0); return x * x * (3 - 2 * x)
def img(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
def shifted(layer, dx, dy):
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.paste(layer, (int(round(dx)), int(round(dy)))); return c

def ink_in(layer, p):
    """paint soaks in unevenly, the way slip takes on clay"""
    if p >= 1.0: return layer
    if p <= 0.0: return None
    a = np.asarray(layer).astype(np.float32); a[..., 3] *= np.clip((p * 1.35 - NOISE) * 5.0, 0.0, 1.0)
    return img(a)

class Cloth:
    """a painted piece that the wind moves: every pixel is fetched from a little way off, and how far depends on
    where it is (nothing at the root, most at the free end) and on a wave that travels downwind"""
    def __init__(self, layer, pad=22):
        a = np.asarray(layer).astype(np.float32)
        ys, xs = np.where(a[..., 3] > 0)
        self.x0, self.x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, W)
        self.y0, self.y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, H)
        c = a[self.y0:self.y1, self.x0:self.x1]
        self.pm = c.copy(); self.pm[..., :3] *= c[..., 3:4] / 255.0          # premultiplied, so no dark fringe when resampled
        self.X = np.arange(self.x0, self.x1, dtype=np.float32)[None, :] + np.zeros((self.y1 - self.y0, 1), dtype=np.float32)
        self.Y = np.arange(self.y0, self.y1, dtype=np.float32)[:, None] + np.zeros((1, self.x1 - self.x0), dtype=np.float32)
    def draw(self, dx, dy):
        sx = np.clip(self.X - dx - self.x0, 0.0, self.pm.shape[1] - 1.001); sy = np.clip(self.Y - dy - self.y0, 0.0, self.pm.shape[0] - 1.001)
        ix, iy = sx.astype(np.int32), sy.astype(np.int32); fx, fy = (sx - ix)[..., None], (sy - iy)[..., None]
        p = self.pm
        o = (p[iy, ix] * (1 - fx) + p[iy, ix + 1] * fx) * (1 - fy) + (p[iy + 1, ix] * (1 - fx) + p[iy + 1, ix + 1] * fx) * fy
        al = np.maximum(o[..., 3:4], 1e-3); o[..., :3] = o[..., :3] * 255.0 / al
        full = np.zeros((H, W, 4), dtype=np.float32); full[self.y0:self.y1, self.x0:self.x1] = o
        return img(full)

HAIR, SKIRT = Cloth(hair), Cloth(skirt)
HAIR_W = sstep(405.0, 590.0, HAIR.X) ** 1.2                                             # loose towards the tips
SKIRT_W = sstep(440.0, 660.0, SKIRT.X) * (0.25 + 0.75 * sstep(1090.0, 1260.0, SKIRT.Y))   # loose towards the flying hem
SKIRT_H = sstep(1180.0, 1300.0, SKIRT.Y) * (1.0 - sstep(440.0, 660.0, SKIRT.X)) * 0.35     # the hanging hem stirs a little too

# the words
TEXT = []
if not NOTEXT:
    font = ImageFont.truetype(FONT, SIZE)
    FINE = smooth_noise(4); worn = 0.84 + 0.16 * smooth_noise(7)
    for y, t_out, lines in BLOCKS:
        txt = Image.new('L', (W, H), 0); dr = ImageDraw.Draw(txt)
        tmap = np.full((H, W), 1e9, dtype=np.float32)
        for line, t0 in lines:
            x = (W - font.getlength(line)) / 2.0
            dr.text((x, y), line, font=font, fill=255)
            for k in range(len(line)):
                x0 = int(x + font.getlength(line[:k])); x1 = int(math.ceil(x + font.getlength(line[:k + 1]))) + 2
                tmap[y - 6:y + int(SIZE * 1.35), x0:x1] = np.minimum(tmap[y - 6:y + int(SIZE * 1.35), x0:x1], t0 + k * PER_CHAR)
            y += LEAD
        TEXT.append((np.asarray(txt, dtype=np.float32) / 255.0 * worn, tmap, t_out))
    TEXT_RGB = np.array([58.0, 34.0, 23.0], dtype=np.float32)

# timeline (seconds)
T_BG, T_IONE, T_CHIPS0, T_CHIPS1, T_MAN = 1.0, 0.6, 3.4, 9.0, 9.7
SUN = (116.0, 1056.0)
FACE = (352.0, 372.0, 752.0, 800.0)      # x0, x1, y0, y1: where the chips leave her
STREAKS = [(2.2, 560.0, 742.0), (5.1, 470.0, 905.0), (7.6, 600.0, 760.0), (10.4, 440.0, 1010.0), (12.6, 580.0, 745.0)]   # start, x, y

chips = []   # [x, y, vx, vy, born, life, size]
ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (OW, OH), '-r', str(FPS), '-i', '-',
                       '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', out], stdin=subprocess.PIPE)
N = int(DUR * FPS)
for f in range(N):
    t = f / FPS
    frame = bg.copy()
    # the low sun breathes on the horizon
    gl = np.exp(-(((XX - SUN[0]) / 120.0) ** 2 + ((YY - SUN[1]) / 70.0) ** 2)) * (0.13 + 0.035 * math.sin(t * 1.1)) * (YY < 1074.0)
    a = np.asarray(frame).astype(np.float32); a[..., :3] += (np.array([255.0, 222.0, 170.0]) - a[..., :3]) * gl[..., None]; frame = img(a)
    frame.alpha_composite(shifted(waves, 7.0 * math.sin(t * 1.5), 2.0 * math.sin(t * 3.0 + 0.6)))
    # the sculptor comes to his door
    man = ink_in(theron, ease(seg(t, T_MAN, T_MAN + 1.6)))
    if man is not None: frame.alpha_composite(man)
    # Ione, and the wind off the sea in her hair and her dress
    gust = 0.75 + 0.25 * math.sin(t * 0.7) + 0.12 * math.sin(t * 1.9 + 1.0)
    hd = HAIR_W * gust * (8.5 * np.sin(HAIR.X * 0.034 - t * 4.4) + 3.5 * np.sin(HAIR.X * 0.071 - t * 7.1 + HAIR.Y * 0.05))
    hx = HAIR_W * gust * 3.0 * np.sin(HAIR.X * 0.02 - t * 2.6)
    sd = SKIRT_W * gust * (9.0 * np.sin(SKIRT.X * 0.026 - t * 3.6) + 3.0 * np.sin(SKIRT.X * 0.06 - t * 6.0)) + SKIRT_H * 5.0 * np.sin(SKIRT.X * 0.045 - t * 3.0)
    sx_ = SKIRT_W * gust * 5.0 * np.sin(SKIRT.Y * 0.03 - t * 2.9) + SKIRT_H * 6.0 * np.sin(SKIRT.Y * 0.05 - t * 2.4)
    fig = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    fig.alpha_composite(ione); fig.alpha_composite(SKIRT.draw(sx_, sd)); fig.alpha_composite(HAIR.draw(hx, hd))
    pi = ease(seg(t, T_IONE, T_IONE + 1.6))
    fig = ink_in(fig, pi)
    if fig is not None: frame.alpha_composite(fig)
    # strokes of wind
    dr = None
    for t0, x, y in STREAKS:
        p = seg(t, t0, t0 + 1.5)
        if 0.0 < p < 1.0:
            if dr is None: ov = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dr = ImageDraw.Draw(ov)
            head = x + 190.0 * ease(p); tail = x + 190.0 * ease(max(p * 1.5 - 0.5, 0.0)) - 6.0
            pts = [(xx, y - 14.0 * math.sin((xx - x) / 190.0 * math.pi * 0.9) + 2.5 * math.sin(xx * 0.09)) for xx in np.linspace(tail, head, 24)]
            dr.line(pts, fill=(74, 44, 28, int(190 * math.sin(p * math.pi) ** 0.7)), width=2)
    if dr is not None: frame.alpha_composite(ov)
    # life carves her a face: chips of marble leave it, and the wind takes them
    if T_CHIPS0 < t < T_CHIPS1 and f % 3 == 0:
        chips.append([rng.uniform(FACE[0], FACE[1]), rng.uniform(FACE[2], FACE[3]), rng.uniform(34, 84), rng.uniform(-10, 16), t, rng.uniform(1.4, 2.6), rng.choice([1, 2, 2])])
    if chips:
        frame = frame.copy(); px = frame.load(); keep = []
        for d in chips:
            age = t - d[4]
            if age > d[5]: continue
            keep.append(d)
            x = d[0] + d[2] * age * (0.5 + age * 0.5); y = d[1] + d[3] * age + 22.0 * age * age + 4.0 * math.sin(age * 5.0 + d[0])
            al = math.sin(min(age / d[5], 1.0) * math.pi) ** 0.6 * 0.9
            for ox in range(d[6]):
                for oy in range(d[6]):
                    xi, yi = int(x) + ox, int(y) + oy
                    if 0 <= xi < W and 0 <= yi < H:
                        r, g, b, _ = px[xi, yi]
                        px[xi, yi] = (int(r + (246 - r) * al), int(g + (226 - g) * al), int(b + (196 - b) * al), 255)
        chips = keep
    # the words soak into the clay, letter after letter
    for ta, tmap, t_out in TEXT:
        gone = 1.0 if t_out is None else 1.0 - ease(seg(t, t_out, t_out + 0.9))
        if gone <= 0.0: continue
        al = ta * np.clip(((t - tmap) / CHAR_FADE * 1.3 - FINE) * 4.0, 0.0, 1.0) * gone
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
