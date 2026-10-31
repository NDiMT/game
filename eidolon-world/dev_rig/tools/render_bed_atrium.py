"""EIDOLON v1.0 (Agent A): the Atrium of a Thousand Faces' bed: Theron's open-air workshop. Original music in the v5
score's language: D dorian, slow pad chords (Dm, C, G, Am over a soft D drone), Ione's motif A4-D5-E5-F5-E5 on a
plucked lyre (once plain, once varied, never resolved), a far bell, and the sculptor at work far off: soft
mallet-on-chisel taps in pairs, tuned to the key. A seamless 44.1 s loop (everything placed circularly, the reverb
convolved circularly), high-passed for phones (4th order 165 Hz), 8 kHz low-pass and a gentle high shelf like the
softened v0.8.1 beds, -18 LUFS, 32 kHz stereo, Vorbis q2.5 (as loop_beds.py).
  python3 render_bed_atrium.py out.ogg
"""
import numpy as np, subprocess, sys
from scipy.signal import butter, sosfilt
SR = 32000
DUR = 44.1
N = int(SR * DUR)
rng = np.random.default_rng(23)
L = np.zeros(N); R = np.zeros(N)

def hz(note):
    names = {"C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2}
    return 440.0 * 2 ** ((names[note[0]] + 12 * (int(note[-1]) - 4)) / 12)

def place(sig, at, pan=0.0, gain=1.0):
    # circular: what runs past the end comes back at the start (a seamless loop)
    i = int(at * SR) % N
    gl = np.cos((pan + 1) * np.pi / 4) * 1.414; gr = np.sin((pan + 1) * np.pi / 4) * 1.414
    idx = (i + np.arange(len(sig))) % N
    np.add.at(L, idx, sig * gain * gl); np.add.at(R, idx, sig * gain * gr)

def lyre(f, dur=2.6, bright=0.9):
    n = int(dur * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for k in range(1, 14):
        fk = f * k * (1 + 0.00025 * k * k)
        if fk > 7000: break
        a = abs(np.sin(np.pi * k * 0.18)) / k ** 1.6 * bright ** (k - 1)
        s += a * np.sin(2 * np.pi * fk * tt + rng.uniform(0, 6.28)) * np.exp(-tt / (1.6 / (1 + 0.5 * (k - 1))))
    s *= np.minimum(1.0, tt / 0.004)
    for fb, q, g in [(420, 6, 0.25), (980, 8, 0.12)]:
        s += g * sosfilt(butter(2, [fb / (1 + 1 / q), fb * (1 + 1 / q)], btype="band", fs=SR, output="sos"), s)
    return s / np.abs(s).max()

def bell(f, dur=4.0):
    n = int(dur * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for r, a, T in [(1.0, 1.0, 2.2), (1.0034, 0.6, 2.2), (2.76, 0.4, 1.0), (5.4, 0.2, 0.45)]:
        s += a * np.sin(2 * np.pi * f * r * tt + rng.uniform(0, 6.28)) * np.exp(-tt / T)
    return s * np.minimum(1.0, tt / 0.002) / np.abs(s).max()

def tap(f, dur=0.6):
    # mallet on chisel on stone, far off: a short tuned knock (the chisel's ring) and a dull thud
    n = int(dur * SR); tt = np.arange(n) / SR
    ring = sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt / T) for r, a, T in [(1.0, 1.0, 0.16), (2.71, 0.4, 0.07), (4.1, 0.2, 0.04)])
    thud = sosfilt(butter(2, [220, 1100], btype="band", fs=SR, output="sos"), rng.normal(0, 1, n)) * np.exp(-tt / 0.012) * 0.6
    s = ring * np.minimum(1.0, tt / 0.001) + thud
    return s / np.abs(s).max()

def pad(freqs, dur, a_t, r_t):
    n = int(dur * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for f in freqs:
        for d in (-0.07, 0.07):
            for k, a in [(1, 1.0), (2, 0.3), (3, 0.12)]:
                s += a * np.sin(2 * np.pi * f * k * (1 + d / 100) * tt + rng.uniform(0, 6.28))
    env = np.minimum(1.0, tt / a_t) * np.where(tt > dur - r_t, np.cos(np.clip((tt - (dur - r_t)) / r_t, 0, 1) * np.pi / 2) ** 2, 1.0)
    return s * env / np.abs(s).max()

Q = DUR / 4
# the drone under everything (D2 + A2, very soft, slowly breathing) and four chords, overlapping by 3 s
place(pad([hz("D2") * 2, hz("A2") * 2], DUR, 0.01, 0.01) * (0.85 + 0.15 * np.sin(2 * np.pi * np.arange(N) / N * 2)), 0.0, 0.0, 0.10)
for j, ch in enumerate([["D4", "A4", "F5"], ["C4", "G4", "E5"], ["G3", "D4", "B4"], ["A3", "E4", "C5"]]):
    place(pad([hz(x) for x in ch], Q + 3.0, 2.8, 3.2), j * Q - 1.5, pan=[-0.2, 0.15, -0.1, 0.2][j], gain=0.20)
# Ione's motif, plain (on the first chord) and varied (on the third, an octave lower, slower: still unresolved)
for k, (nm, dt) in enumerate(zip(["A4", "D5", "E5", "F5", "E5"], [0, 0.9, 1.8, 2.7, 4.0])):
    place(lyre(hz(nm)), 4.0 + dt, pan=-0.3 + 0.12 * k, gain=0.42)
for k, (nm, dt) in enumerate(zip(["F4", "A4", "D5", "E5"], [0, 1.2, 2.4, 3.9])):
    place(lyre(hz(nm), bright=0.8), 2 * Q + 3.5 + dt, pan=0.3 - 0.12 * k, gain=0.36)
# the far bell, once
place(bell(hz("A5")), 3 * Q + 1.0, pan=0.45, gain=0.16)
# the sculptor, far off: pairs of taps, tuned to D and A, irregular like work
for at, f, g in [(1.3, "D6", 0.12), (1.75, "D6", 0.09), (9.4, "A5", 0.10), (9.85, "A5", 0.08), (18.2, "D6", 0.11), (18.62, "D6", 0.08),
                 (27.0, "A5", 0.10), (27.5, "D6", 0.09), (35.8, "D6", 0.11), (36.25, "A5", 0.08), (41.0, "D6", 0.07)]:
    place(tap(hz(f)), at, pan=0.55, gain=g)

dry = np.stack([L, R], 1)
# baked reverb, circular (an open courtyard: RT60 ~2.4 s, 25 ms pre-delay, darker as it decays)
irn = int(2.8 * SR); it = np.arange(irn) / SR
ir = rng.normal(0, 1, (irn, 2)) * np.exp(-it * 6.91 / 2.4)[:, None]
ir = sosfilt(butter(1, 4200, fs=SR, output="sos"), ir, axis=0)
ir[: int(0.025 * SR)] = 0
ir /= np.sqrt((ir ** 2).sum(0))
irp = np.zeros((N, 2)); irp[:irn] = ir
wet = np.real(np.fft.ifft(np.fft.fft(dry, axis=0) * np.fft.fft(irp, axis=0), axis=0))
mix = dry * 0.7 + wet * 0.75
# phone-friendly and soft like the other beds: high-pass 165 Hz, 8 kHz low-pass, a gentle shelf over 3 kHz
# (filters run over two periods and the second is kept, so the loop stays seamless)
two = np.concatenate([mix, mix])
two = sosfilt(butter(4, 165, btype="high", fs=SR, output="sos"), two, axis=0)
two = sosfilt(butter(4, 8000, btype="low", fs=SR, output="sos"), two, axis=0)
hi = sosfilt(butter(2, 3000, btype="high", fs=SR, output="sos"), two, axis=0)
two = two - hi * (1 - 10 ** (-5.0 / 20))
mix = two[N:]
mix /= np.abs(mix).max()
out = sys.argv[1]
tmp = out + ".wav"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f64le", "-ar", str(SR), "-ac", "2", "-i", "-", tmp], input=mix.astype(np.float64).tobytes(), check=True)
r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", tmp, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
I = float([l for l in r.splitlines() if l.strip().startswith("I:")][-1].split()[1])
gain = -18.0 - I
pk = 20 * np.log10(np.abs(mix).max()) + gain
if pk > -1.5: gain -= pk + 1.5
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", "volume=%.2fdB" % gain, "-ar", str(SR), "-c:a", "libvorbis", "-q:a", "2.5", out], check=True)
print("I before", round(I, 2), "gain", round(gain, 2))
