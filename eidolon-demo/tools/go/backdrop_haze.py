"""A thing painted in a backdrop seen further into its haze: within a mask, the backdrop laid back toward its clean plate
(the same painting without the thing), so what lies behind it shows through and its light and shade are a share of what
they were; nothing changes where the thing is not. The fourth level's great head (the owner, 20/11: "the statue less
intense, about as it is in the first frame", the concept, design/level4/slide/concept_solved.jpg):

  python3 -I tools/go/backdrop_haze.py design/level4/game/backdrop_head_game.jpg design/level4/game/backdrop_plate.jpg \\
      design/level4/game/head_mask.png 0.46 goglass/backdrop.jpg

usage: backdrop_haze.py <backdrop> <clean plate, same size> <mask png, white where the thing is> <share kept> <out>
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
bd, pl, mk, c, out = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), sys.argv[5]
b = np.asarray(Image.open(bd).convert('RGB')).astype(np.float32)
p = np.asarray(Image.open(pl).convert('RGB')).astype(np.float32)
m = np.asarray(Image.open(mk).convert('L').filter(ImageFilter.GaussianBlur(16))).astype(np.float32)[..., None] / 255.0
o = p + (b - p) * c
Image.fromarray(np.clip(b * (1.0 - m) + o * m, 0, 255).round().astype(np.uint8)).save(out, quality=95)
print('laid back to', c, 'within the mask:', round(float((m > 0.5).mean()), 4), 'of the picture')
