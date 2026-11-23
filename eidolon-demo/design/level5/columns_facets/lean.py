"""The column by the island leaning a little (the owner, 23/11: "can the near one be a little slanted?"): its cut (made
as README.txt says) turned about its foot where it meets the water, the column one way and its image in the water the
other, as a leaning column and its reflection are; then scaled, weighted by its cover, to the game's card.

  python3 -I design/level5/columns_facets/lean.py <isle cut.png> goguard/wd_isle.png [degrees, + leans its top left]
"""
import sys
import numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
deg = float(sys.argv[3]) if len(sys.argv) > 3 else 7.0
FX, FY = 745.8, 1633.2      # (its foot in the cut: the lift's foot, 175.9 385.2 of the 400 by 600 crop, times 4.24)
a = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255.0
L = a[..., :3] @ np.array([0.3, 0.55, 0.15], np.float32)
a[:720, 925:, 3] = np.where(L[:720, 925:] < 0.42, 0.0, a[:720, 925:, 3])      # (the sliver of the island's rock the cut kept by the capital: it stays where it is, it does not lean)
pm = np.dstack([a[..., :3] * a[..., 3:4], a[..., 3:4]])
H, W = pm.shape[:2]
def turn(img, ang):      # (each channel turned about the foot; PIL turns counter-clockwise on the screen for a positive angle)
    return np.stack([np.asarray(Image.fromarray(img[..., i], 'F').rotate(ang, resample=Image.BICUBIC, center=(FX, FY))) for i in range(4)], -1)
up = pm.copy(); up[int(FY):] = 0.0      # (the column, over the water)
dn = pm.copy(); dn[:int(FY)] = 0.0      # (its image in it)
out = turn(up, deg) + turn(dn, -deg)
A = np.clip(out[..., 3], 0.0, 1.0); C = np.clip(out[..., :3] / np.maximum(A, 1e-4)[..., None], 0.0, 1.0)
out = np.dstack([C * A[..., None], A])
ch = [np.asarray(Image.fromarray(out[..., i].astype(np.float32), 'F').resize((400, 600), Image.LANCZOS)) for i in range(4)]
A = np.clip(ch[3], 0.0, 1.0); C = np.stack(ch[:3], -1) / np.maximum(A, 1e-4)[..., None]
Image.fromarray(np.round(np.dstack([np.clip(C, 0.0, 1.0), A]) * 255).astype(np.uint8), 'RGBA').save(dst)
print('leant', deg, '->', dst)
