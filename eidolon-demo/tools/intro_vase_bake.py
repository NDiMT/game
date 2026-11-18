#!/usr/bin/env python3
"""Bake the intro film's pieces for the game to draw it itself (the owner: the film inside Godot, not a video).
The film was made by eidolon-world/dev/intro/amphora/tools/vase.py: a painted amphora turning, seven scenes on it, the
words under each. Here its still parts become pictures and its moving pictures short clips; the game's shader (IVF_SH
in ch1.gd) turns the vase, lights it and writes the words, sharp at any size.
usage: python3 eidolon-demo/tools/intro_vase_bake.py   (needs vase.py's sources in its scratch folder 'gem/v')
Writes eidolon-demo/intro/vase/: film.json (the timeline, 24 a second), strips.jpg (the aged ornament bands, one per
place round the vase, at the film's full size, five side by side), pans.jpg (each scene's first picture in its frame,
aged, the seven in a row, and its last picture in the row under), clip{i}.ogv (the scene moving, played once, slowing
to rest), texts.png (the words of each card at full size, its pages one under another, the seven cards side by side),
lut.png (the dawn grade, 33 blue slices side by side).
strips, pans and texts are each imported as one Texture2DArray (their slices in their .import files): a phone's
graphics give a picture-drawing shader 16 textures at most, and Godot keeps three of them for itself and six more of
the highest for its own; one texture per piece (14) passed that, and on a phone the film was not drawn at all.
`pans` alone rebuilds pans.jpg from pan{i}a/b.jpg files, if they are there."""
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
PD = 864                                                    # (a scene's picture, in its frame: the clips' size, so a still and its clip match)
NPG = 3                                                     # (pages in a card at most: each card's words take this many pages' room)
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
if 'strips' in what:      # (at the film's full size, SW x TH: on a phone's screen, wider than 1080, a texture pixel to a screen pixel or more)
    atlas = Image.new('RGB', (V.SW * 5, V.TH))
    for ph in range(5): atlas.paste(Image.fromarray(np.clip(V.age(orn, ag, ph, 0, 0), 0, 255).astype(np.uint8)), (V.SW * ph, 0))
    atlas.save(OUT + '/strips.jpg', quality=93)
    print('strips', V.SW, 'x', V.TH, 'x 5')
# ---- the scenes: the first and last picture in the frame, and the clip between, aged as their place is
if 'scenes' in what:
    sc = V.scenes()
    def panel(i, t):
        pan = np.empty((V.PH + 12, V.PW + 18, 3), np.uint8); pan[:] = V.BLACK.astype(np.uint8)
        pan[6:6 + V.PH, 9:9 + V.PW] = sc[i].frame(t)
        pan[16:V.PH - 4, 16:19] = V.BLACK.astype(np.uint8); pan[16:V.PH - 4, V.PW - 1:V.PW + 2] = V.BLACK.astype(np.uint8)
        return np.asarray(down(V.age(pan, ag, i % 5, x_pan - 9, y_pan - 6), PD, PD))
    only = [int(a[1:]) for a in what if a.startswith('c') and a[1:].isdigit()]
    pans = Image.open(OUT + '/pans.jpg').convert('RGB') if os.path.exists(OUT + '/pans.jpg') else Image.new('RGB', (PD * 7, PD * 2))
    for i in (only or range(7)):
        N = sc[i].vn; L = (N - 1) / float(V.FPS); n = int(round((L + 1.0) * V.FPS)) + 1      # (it plays once, slows over its last second, rests)
        pans.paste(Image.fromarray(panel(i, 0.0)), (PD * i, 0)); pans.paste(Image.fromarray(panel(i, L + 2.0)), (PD * i, PD))
        enc = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (PD, PD), '-r', str(V.FPS), '-i', '-',
                                '-c:v', 'libtheora', '-q:v', os.environ.get('CLIP_Q', '8'), '-pix_fmt', 'yuv420p', OUT + '/clip%d.ogv' % i], stdin=subprocess.PIPE)
        for k in range(n): enc.stdin.write(panel(i, k / float(V.FPS)).tobytes())
        enc.stdin.close(); enc.wait()
        print('scene', i, N, 'frames ->', n, '%.1f MB' % (os.path.getsize(OUT + '/clip%d.ogv' % i) / 1e6))
    pans.save(OUT + '/pans.jpg', quality=95)
if 'pans' in what:
    pans = Image.new('RGB', (PD * 7, PD * 2))
    for i in range(7):
        for r, v in enumerate('ab'): pans.paste(Image.open(OUT + '/pan%d%s.jpg' % (i, v)).convert('RGB'), (PD * i, PD * r))
    pans.save(OUT + '/pans.jpg', quality=95); print('pans', PD, 'x', PD, '7 x 2')
# ---- the words: each card's pages one under another (white on black: the ink's strength)
if 'text' in what:
    from PIL import ImageDraw
    atlas = Image.new('L', (V.SW * 7, bh * NPG), 0)
    for i, card in enumerate(V.TEXTS):
        assert len(card) <= NPG
        im = Image.new('L', (V.SW, bh * NPG), 0); dr = ImageDraw.Draw(im)
        for p, pg in enumerate(card):
            n = len(pg); top = (bh - n * V.LH) * 0.5 - 8
            for j, ln in enumerate(pg):
                w = dr.textlength(ln, font=V.FONT); dr.text(((V.SW - w) * 0.5, p * bh + top + j * V.LH), ln, font=V.FONT, fill=255)
        atlas.paste(im, (V.SW * i, 0))
    atlas.save(OUT + '/texts.png')
    print('text', V.SW, 'x', bh * NPG, 'x 7')
# ---- the dawn grade: the 33x33x33 table as 33 slices side by side (x = blue*33 + red, y = green)
if 'lut' in what:
    rows = [l.split() for l in open('/home/user/game/eidolon-demo/design/intro_dawn.cube') if l.strip() and l.strip()[0] in '0123456789.-']
    a = np.array(rows, np.float32).reshape(33, 33, 33, 3)      # (blue, green, red): red runs fastest
    img = np.zeros((33, 33 * 33, 3), np.float32)
    for b in range(33): img[:, b * 33:(b + 1) * 33] = a[b]
    Image.fromarray(np.clip(img * 255.0 + 0.5, 0, 255).astype(np.uint8)).save(OUT + '/lut.png')
    print('lut done')
