"""A statue painted in a backdrop made to read a little more as a carved solid, slightly polygonal (the owner, 22/11, of
the third level's Aphrodite and the fourth level's head: "the 3D ones, make them slightly more intense, not much, and
look more 3D, slightly polygonal"; before, its light and shade only drawn out was "just more intense").

The image model repaints the statue as a finely faceted low-poly marble sculpture, the same in every other way (the
prompts beside the results: design/level3/goddess_facets_prompt.txt, design/level4/game/head_facets_prompt.txt); it
keeps the drawing and the place (checked: no shift, no change of scale) but not the colours. So only its light and shade
are taken, within the statue: its luminance, brought to the painting's own mean and spread there, laid over the
painting's luminance at a share; the painting's colour is kept as it was. A triangulation of our own (each triangle the
mean of the painting in it) was tried first and read as a filter laid over a picture, not as a carved form.

  python3 -I tools/go/figure_facets.py <painting> <faceted repaint> <out> <share> <mask png | green> [x,y,w,h] [contrast]

  mask png: white where the statue is (the size of <painting>); green: the statue painted alone on flat green, as
            backdrop_figure.py takes it, the green left as it is
  x,y,w,h:  a repaint of a crop of the painting: where the crop was (its top left and size, in the painting's pixels;
            - for none)
  contrast: its light and shade this much stronger than the painting's about their mean (1 the same)

The fourth level's head (its painting and plate with the sky's streaks taken out, backdrop_destreak.py; then
backdrop_haze.py with it and the plate at 0.52, 0.46 before: a little more intense):
  python3 -I tools/go/figure_facets.py design/level4/game/backdrop_head_game_clean.jpg \\
      design/level4/game/backdrop_head_facets_gemini.jpg design/level4/game/backdrop_head_facets.jpg 0.85 \\
      design/level4/game/head_tight.png 430,180,650,650
The third level's goddess (then backdrop_figure.py with it, its haze 0.25, 0.3 before: a little more intense):
  python3 -I tools/go/figure_facets.py design/level3/goddess_painted.png design/level3/goddess_facets_gemini.jpg \\
      design/level3/goddess_facets.png 0.75 green - 1.18
"""
import sys
import numpy as np
from PIL import Image, ImageFilter


def figure_alpha(a, mask):
    if mask == 'green':
        sp = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
        return 1.0 - np.clip((sp - 12.0) / 50.0, 0.0, 1.0)
    m = Image.open(mask).convert('L').resize((a.shape[1], a.shape[0]))
    return np.asarray(m).astype(np.float32) / 255.0


if __name__ == '__main__':
    if len(sys.argv) < 6: print(__doc__); sys.exit(1)
    src, rep, out, share, mask = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), sys.argv[5]
    P = Image.open(src).convert('RGB'); a = np.asarray(P).astype(np.float32)
    R = Image.open(rep).convert('RGB')
    ctr = float(sys.argv[7]) if len(sys.argv) > 7 else 1.0
    if len(sys.argv) > 6 and sys.argv[6] != '-':      # (a repaint of a crop: laid where the crop was, at the crop's size)
        x0, y0, cw, ch = [int(v) for v in sys.argv[6].split(',')]
        canvas = P.copy(); canvas.paste(R.resize((cw, ch), Image.LANCZOS), (x0, y0)); R = canvas
    else:
        R = R.resize(P.size, Image.LANCZOS)
    al = figure_alpha(a, mask)
    yo = np.asarray(P.convert('YCbCr')).astype(np.float32)
    yr = np.asarray(R.convert('YCbCr')).astype(np.float32)[..., 0]
    f = al > 0.5
    Yo, Yr = yo[..., 0], yr
    Yr = (Yr - Yr[f].mean()) * (ctr * Yo[f].std() / max(Yr[f].std(), 1e-6)) + Yo[f].mean()      # (its light and shade at the painting's own mean and spread, or a little stronger)
    k = share * np.asarray(Image.fromarray((np.clip(al, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255.0
    o = yo.copy(); o[..., 0] = Yo + (Yr - Yo) * k
    im = Image.fromarray(np.clip(o, 0, 255).round().astype(np.uint8), 'YCbCr').convert('RGB')
    im.save(out, quality=95) if out.lower().endswith(('.jpg', '.jpeg')) else im.save(out)
    print('facets from', rep, 'laid on', src, '->', out, 'share', share)
