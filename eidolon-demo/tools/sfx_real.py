# the waking's real sounds, cut and mixed from CC0 recordings (OpenGameArt; the packs are named in design/sfx/README.md):
# steps on stone, a stone breaking the sea, the winch's ratchet and clank, the gate's light.
# The packs' files first made mono 48 kHz WAV under their own names (ffmpeg -i <f> -ac 1 -ar 48000 <wav dir>/<name>.wav,
# spaces and # as _), then: python3 -I tools/sfx_real.py <wav dir> <out dir>, and each out WAV to sfx/<name>.ogg
# (ffmpeg -i <w> -c:a libvorbis -q:a 5 -ac 1 -ar 48000)
import sys, numpy as np, scipy.io.wavfile as w, scipy.signal as sg
SR = 48000
src, out = sys.argv[1], sys.argv[2]
rng = np.random.default_rng(7)
def rd(n):
    sr, x = w.read(f"{src}/{n}.wav"); assert sr == SR; return x.astype(np.float64) / 32768
def biquad(x, b, a): return sg.lfilter(b, a, x)
def peq(x, f0, g, q):
    A = 10 ** (g / 40); w0 = 2 * np.pi * f0 / SR; al = np.sin(w0) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w0), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w0), 1 - al / A]
    return biquad(x, np.array(b) / a[0], np.array(a) / a[0])
def hp(x, f0, o=2): return sg.sosfilt(sg.butter(o, f0, "hp", fs=SR, output="sos"), x)
def lp(x, f0, o=2): return sg.sosfilt(sg.butter(o, f0, "lp", fs=SR, output="sos"), x)
def fade(x, fin, fout):
    x = x.copy(); n1, n2 = int(fin * SR), int(fout * SR)
    if n1: x[:n1] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n1))
    if n2: x[-n2:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, n2))
    return x
def pitch(x, f):      # (played faster by f: higher and shorter, as a slower or quicker tape)
    if abs(f - 1) < 1e-6: return x
    up = 1000; down = int(round(1000 * f)); return sg.resample_poly(x, up, down)
def place(dst, s, t, g=1.0):
    i = int(t * SR); n = min(len(s), len(dst) - i)
    if n > 0: dst[i:i + n] += s[:n] * g
def peak_to(x, db=-1.0): return x * (10 ** (db / 20) / np.max(np.abs(x)))
def db(v): return 10 ** (v / 20)
from scipy.ndimage import maximum_filter1d
def limit(x, thr_db, rel=0.08):      # (a soft hold on the loudest moments, so the body of a sound can be heard)
    thr = db(thr_db) * np.max(np.abs(x)); pk = maximum_filter1d(np.abs(x), size=int(0.003 * SR) * 2 + 1)
    g = np.minimum(1.0, thr / np.maximum(pk, 1e-9)); g = sg.lfilter([1 - np.exp(-1 / (0.002 * SR))], [1, -np.exp(-1 / (0.002 * SR))], g, zi=[g[0] * np.exp(-1 / (0.002 * SR))])[0]
    out = np.empty_like(g); cur = 1.0; r = np.exp(-1 / (rel * SR))
    for i in range(len(g)):
        cur = g[i] if g[i] < cur else r * cur + (1 - r) * g[i]; out[i] = cur
    return x * out
def save(name, x):
    w.write(f"{out}/{name}.wav", SR, (np.clip(x, -1, 1) * 32767).astype(np.int16)); print(name, f"{len(x)/SR:.2f}s")

# steps: one bare step on stone, its heel's tap made clearer (a phone's speaker plays little under 300 Hz), four pitches
st = rd("stone01")[int(0.035 * SR):int(0.30 * SR)]
st = hp(st, 70); st = peq(st, 2600, 6, 0.9); st = peq(st, 160, -3, 1.0); st = fade(st, 0.002, 0.07)
for i, f in enumerate([0.90, 0.96, 1.03, 1.09]): save(f"step_{i+1}", peak_to(limit(pitch(st, f), -4.0, 0.04), -1.0))

# a stone breaks the surface: the water thrown up off it, then running off its sides, and the foam fizzing round it
sp = rd("splash_04"); wa = rd("loop_water_02"); bu = rd("loop_bubbles_02")
def env(n, a, hold, tau):      # (rise over a, hold, then fall away by tau)
    t = np.arange(n) / SR; e = np.minimum(t / a, 1.0); e *= np.where(t > hold, np.exp(-(t - hold) / tau), 1.0); return e
for i, (sf, wo, bo) in enumerate([(1.0, 0.3, 0.2), (0.93, 2.6, 2.7), (1.07, 4.6, 5.0)]):
    L = int(2.9 * SR); o = np.zeros(L)
    a = pitch(sp[int(0.15 * SR):], sf); a = hp(a, 120); a = peq(a, 3000, 4, 0.8); a = fade(a, 0.03, 0.25)
    place(o, a, 0.0, db(-7))
    ws = wa[int(wo * SR):int(wo * SR) + int(2.75 * SR)]; ws = hp(ws, 150) * env(len(ws), 0.22, 0.55, 0.55)
    place(o, ws, 0.08, db(2))
    bs = bu[int(bo * SR):int(bo * SR) + int(2.55 * SR)]; bs = bs * env(len(bs), 0.35, 0.9, 0.6)
    place(o, bs, 0.3, db(0))
    save(f"stone_surface_{i+1}", peak_to(limit(fade(o, 0.0, 0.3), -9.0), -1.0))

# the winch: a ratchet that clicks at each tooth of the wheel as it passes, the wheel turning once in 1.6 s, slow at
# first, quickest halfway, slowing to a stop (as the game turns it), the marble drum grinding under, a clank as it holds
wi = rd("winch_-_Marker__8")
ons = [0.170, 0.215, 0.285, 0.365, 0.490, 0.545, 0.660, 0.755, 0.820, 0.925, 1.075, 1.160, 1.235, 1.315, 1.410, 1.535, 1.580, 1.640, 1.715, 1.785]
clicks = [fade(wi[int((t - 0.003) * SR):int((t + 0.07) * SR)], 0.002, 0.03) for t in ons]
clicks = [peak_to(hp(c, 300), -1.0) for c in clicks]
T, N = 1.6, 18
L = int((T + 0.75) * SR); o = np.zeros(L)
for k in range(1, N):
    t = T / np.pi * np.arccos(1 - 2 * k / N); v = np.sin(np.pi * t / T)
    place(o, clicks[k % len(clicks)], t, db(-9 + 6 * v + rng.uniform(-1.5, 1.5)))
gr = rd("stone_rock_or_wood_moved_no_tick"); gr = lp(pitch(gr, 0.72), 900)
for t0 in (0.05, 0.42, 0.8, 1.15):
    place(o, fade(peak_to(gr, -1.0), 0.04, 0.12), t0, db(-14 + 4 * np.sin(np.pi * (t0 + 0.25) / T)))
ck = hp(rd("clank1"), 150); ck = peq(ck, 2500, -2, 1.0)
place(o, peak_to(ck, -1.0), T - 0.17, db(-4))
save("winch_turn", peak_to(fade(o, 0.0, 0.2), -1.0))

# the gate: a swell of light, its height near 0.3 s
tp = rd("teleport"); tp = hp(tp, 80); tp = peq(tp, 2500, 3, 0.9)
save("gate_light", peak_to(fade(tp, 0.0, 0.25), -1.0))
