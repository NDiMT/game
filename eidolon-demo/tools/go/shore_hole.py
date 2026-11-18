"""The shore map's green for a level whose block falls into a hole (goveil/): where the block will stand once it is in,
so the still water keeps its thin foam and small waves round it too, as round every other stone (the owner: "when the
stone falls in, foam"). The game raises the sea's 'riser_up' as the block lands; until then the hole is open water.
Red, what stands in the water for good, is left as it is.

usage: python3 -I tools/go/shore_hole.py <level dir> [the block's side in metres]
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

d = sys.argv[1]; side = float(sys.argv[2]) if len(sys.argv) > 2 else 0.92
j = json.load(open(os.path.join(d, 'level.json')))
x0, z0, x1, z1 = j['shore']['rect']; D = float(j['shore']['D'])
im = np.asarray(Image.open(os.path.join(d, 'shore.png')).convert('RGB')).copy()
nz, nx = im.shape[:2]; rx = (x1 - x0) / nx; rz = (z1 - z0) / nz
xc = x0 + (np.arange(nx) + 0.5) * rx; zc = z0 + (np.arange(nz) + 0.5) * rz
mk = np.zeros((nz, nx), dtype=bool)
for h in j.get('holes', []):
    p = j['nodes'][h]; hx, hz = float(p[0]), float(p[2])
    mk |= (np.abs(zc[:, None] - hz) <= side / 2) & (np.abs(xc[None, :] - hx) <= side / 2)
dist = ndimage.distance_transform_edt(~mk, sampling=(rz, rx))
g = (np.clip(1.0 - dist / D, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)
im[..., 1] = np.maximum(im[..., 1], g)
Image.fromarray(im, 'RGB').save(os.path.join(d, 'shore.png'))
print('shore green: holes', j.get('holes'), 'cells under the block', int(mk.sum()), 'of', nx * nz)
