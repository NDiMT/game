#!/usr/bin/env python3
"""Bake the intro film's pieces for the game to draw it itself (the owner: the film inside Godot, not a video).
The film was made by eidolon-world/dev/intro/amphora/tools/vase.py: a painted amphora turning, seven scenes on it, the
words under each. Here its still parts become pictures and its moving pictures short clips; the game's shader (IVF_SH
in ch1.gd) turns the vase, lights it and writes the words, sharp at any size.
usage: python3 eidolon-demo/tools/intro_vase_bake.py   (needs vase.py's sources in its scratch folder 'gem/v')
Writes eidolon-demo/intro/vase/: film.json (the timeline, 24 a second), strip0-4.jpg (the aged ornament bands, one per
place round the vase), pan{i}a/b.jpg (each scene's first and last picture in its frame, aged), clip{i}.ogv (the scene
moving, played once, slowing to rest), text{i}.png (the words of each card, its pages one under another), lut.png
(the dawn grade, 33 blue slices side by side)."""
import sys, os, json, math, subprocess
import numpy as np
from PIL import Image
sys.path.insert(0, '/home/user/game/eidolon-world/dev/intro/amphora/tools')
import vase as V
OUT = '/home/user/game/eidolon-demo/intro/vase'
os.makedirs(OUT, exist_ok=True)
K = V.K
def down(a, w, h): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
ev = V.timeline()
x_pan = int(V.tx(-V.PANEL * 0.5)); y_pan = int(V.ty(V.PAN_H0)); y_t0 = int(V.ty(V.TXT_H0)); bh = int(V.ty(V.TXT_H1) - V.ty(V.TXT_H0))
SWD, THD = int(round(V.SW / K)), int(round(V.TH / K))          # (one texture pixel to a screen pixel of the 1080-wide film)
PD = 864                                                    # (a scene's picture, in its frame)
what = sys.argv[1:] or ['film', 'strips', 'scenes', 'text', 'lut']
# ---- the timeline: per frame the vase's turn (in places), the scene in front, the fade, the page shown, each line's ink
if 'film' in what:
    pages = [[len(pg) for pg in card] for card in V.TEXTS]
    def page_of(i, wr):
        b = 0; last = 0
        for p, n in enumerate(pages[i]):
            if any(w > 0.001 for w in wr[b:b + n]): last = p
            b += n
        return last
    fr = []
    for (phi, front, wr, fade) in ev:
        f = min(max(int(front), 0), 6)
        fr.append([round(float(phi), 5), int(front), round(float(fade), 4), page_of(f, wr)] + [round(float(w), 4) for w in wr])
    T0 = [next(j for j, e in enumerate(ev) if e[1] == i and e[0] == float(i)) / V.FPS + 0.9 for i in range(7)]
    prof_h = np.linspace(-130.0, 2100.0, 64); prof_v = V.prof(prof_h)
    json.dump(dict(fps=V.FPS, frames=fr, T0=T0, pages=pages, NL=V.NL,
                   geo=dict(W=V.W, H=V.Hh, R0=V.R0, K=K, SLOT=V.SLOT, PXD=V.PXD, H_TOP=V.H_TOP, SW=V.SW, TH=V.TH, TILT=V.TILT, FAC=V.FAC,
                            pan=[x_pan - 9, y_pan - 6, V.PW + 18, V.PH + 12], txt=[y_t0, bh], LH=V.LH,
                            prof_h0=-130.0, prof_h1=2100.0, prof=[round(float(v), 6) for v in prof_v],
                            facj=[round(float(v), 6) for v in V.FACJ], sun=V.SUN.tolist(), shade=V.SHADE.tolist(), lift=V.LIFT.tolist(),
                            rim=V.RIM.tolist(), ink=V.INK.tolist())), open(OUT + '/film.json', 'w'), separators=(',', ':'))
    print('film', len(fr), 'frames; T0', [round(t, 2) for t in T0])
need_age = any(w in what for w in ('strips', 'scenes'))
if need_age: orn = V.ornaments(); ag = V.aging()
# ---- the ornament bands, aged, for the five places round the vase
if 'strips' in what:
    for ph in range(5):
        down(V.age(orn, ag, ph, 0, 0), SWD, THD).save(OUT + '/strip%d.jpg' % ph, quality=92)
    print('strips', SWD, 'x', THD)
# ---- the scenes: the first and last picture in the frame, and the clip between, aged as their place is
if 'scenes' in what:
    sc = V.scenes()
    def panel(i, t):
        pan = np.empty((V.PH + 12, V.PW + 18, 3), np.uint8); pan[:] = V.BLACK.astype(np.uint8)
        pan[6:6 + V.PH, 9:9 + V.PW] = sc[i].frame(t)
        pan[16:V.PH - 4, 16:19] = V.BLACK.astype(np.uint8); pan[16:V.PH - 4, V.PW - 1:V.PW + 2] = V.BLACK.astype(np.uint8)
        return np.asarray(down(V.age(pan, ag, i % 5, x_pan - 9, y_pan - 6), PD, PD))
    only = [int(a[1:]) for a in what if a.startswith('c') and a[1:].isdigit()]
    for i in (only or range(7)):
        N = sc[i].vn; L = (N - 1) / float(V.FPS); n = int(round((L + 1.0) * V.FPS)) + 1      # (it plays once, slows over its last second, rests)
        Image.fromarray(panel(i, 0.0)).save(OUT + '/pan%da.jpg' % i, quality=92)
        Image.fromarray(panel(i, L + 2.0)).save(OUT + '/pan%db.jpg' % i, quality=92)
        enc = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (PD, PD), '-r', str(V.FPS), '-i', '-',
                                '-c:v', 'libtheora', '-q:v', os.environ.get('CLIP_Q', '8'), '-pix_fmt', 'yuv420p', OUT + '/clip%d.ogv' % i], stdin=subprocess.PIPE)
        for k in range(n): enc.stdin.write(panel(i, k / float(V.FPS)).tobytes())
        enc.stdin.close(); enc.wait()
        print('scene', i, N, 'frames ->', n, '%.1f MB' % (os.path.getsize(OUT + '/clip%d.ogv' % i) / 1e6))
# ---- the words: each card's pages one under another (white on black: the ink's strength)
if 'text' in what:
    from PIL import ImageDraw
    for i, card in enumerate(V.TEXTS):
        im = Image.new('L', (V.SW, bh * len(card)), 0); dr = ImageDraw.Draw(im)
        for p, pg in enumerate(card):
            n = len(pg); top = (bh - n * V.LH) * 0.5 - 8
            for j, ln in enumerate(pg):
                w = dr.textlength(ln, font=V.FONT); dr.text(((V.SW - w) * 0.5, p * bh + top + j * V.LH), ln, font=V.FONT, fill=255)
        im.resize((SWD, int(round(bh * len(card) / K))), Image.LANCZOS).save(OUT + '/text%d.png' % i)
    print('text done')
# ---- the dawn grade: the 33x33x33 table as 33 slices side by side (x = blue*33 + red, y = green)
if 'lut' in what:
    rows = [l.split() for l in open('/home/user/game/eidolon-demo/design/intro_dawn.cube') if l.strip() and l.strip()[0] in '0123456789.-']
    a = np.array(rows, np.float32).reshape(33, 33, 33, 3)      # (blue, green, red): red runs fastest
    img = np.zeros((33, 33 * 33, 3), np.float32)
    for b in range(33): img[:, b * 33:(b + 1) * 33] = a[b]
    Image.fromarray(np.clip(img * 255.0 + 0.5, 0, 255).astype(np.uint8)).save(OUT + '/lut.png')
    print('lut done')
