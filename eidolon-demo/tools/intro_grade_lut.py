"""usage: python3 -I tools/intro_grade_lut.py <out.cube>; then
ffmpeg -i ../eidolon-world/dev/intro/amphora/intro_amphora_720.mp4 -vf lut3d=<out.cube> ... (the graded film), and
ffmpeg -i <graded.mp4> -c:v libtheora -b:v 1100k -c:a libvorbis -q:a 3 intro/intro.ogv (the game's).

A 3D LUT that carries the intro's black-figure palette onto the first level's dawn: each key colour to its target,
everything between moved with the nearest keys (Gaussian weights in Lab), so the shading of each colour is kept."""
import numpy as np, sys
def srgb2lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lin2srgb(c): return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055)
M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]); Mi = np.linalg.inv(M)
WP = np.array([0.95047, 1.0, 1.08883])
def f(t): return np.where(t > (6 / 29) ** 3, np.cbrt(t), t / (3 * (6 / 29) ** 2) + 4 / 29)
def fi(t): return np.where(t > 6 / 29, t ** 3, 3 * (6 / 29) ** 2 * (t - 4 / 29))
def rgb2lab(rgb):
    xyz = srgb2lin(rgb) @ M.T / WP; fx, fy, fz = f(xyz[..., 0]), f(xyz[..., 1]), f(xyz[..., 2])
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], -1)
def lab2rgb(lab):
    fy = (lab[..., 0] + 16) / 116; fx = fy + lab[..., 1] / 500; fz = fy - lab[..., 2] / 200
    xyz = np.stack([fi(fx), fi(fy), fi(fz)], -1) * WP
    return np.clip(lin2srgb(xyz @ Mi.T), 0, 1)
keys = [  # source (the film), target (the dawn of the first level)
    ((220, 222, 235), (218, 197, 224)),   # the sky behind the vase -> lilac
    ((48, 34, 49), (56, 36, 56)),         # the vase's black -> deep plum
    ((220, 141, 93), (234, 170, 160)),    # the clay -> rose-peach
    ((229, 147, 96), (240, 176, 166)),
    ((252, 242, 227), (252, 241, 240)),   # added white -> pearl
    ((171, 64, 64), (176, 66, 74)),       # her red -> her dress's red, a touch rosier
    ((63, 75, 90), (104, 84, 124)),       # the sea -> a muted violet
    ((114, 76, 68), (124, 82, 88)),       # the darker clay of the bands
    ((0, 0, 0), (12, 6, 12)), ((255, 255, 255), (255, 255, 255)),
]
src = rgb2lab(np.array([k[0] for k in keys], float) / 255.0); dst = rgb2lab(np.array([k[1] for k in keys], float) / 255.0)
N = 33; g = np.linspace(0, 1, N)
B, G, R = np.meshgrid(g, g, g, indexing='ij'); rgb = np.stack([R, G, B], -1).reshape(-1, 3)
lab = rgb2lab(rgb)
d = np.linalg.norm(lab[:, None, :] - src[None, :, :], axis=-1)
w = np.exp(-(d / 22.0) ** 2) + 1e-9; w /= w.sum(1, keepdims=True)
out = lab2rgb(lab + w @ (dst - src))
with open(sys.argv[1], 'w') as fo:
    fo.write('TITLE "eidolon dawn"\nLUT_3D_SIZE %d\n' % N)
    for r in out: fo.write('%.6f %.6f %.6f\n' % tuple(r))
print('LUT', sys.argv[1])
