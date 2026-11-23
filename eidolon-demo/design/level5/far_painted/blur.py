"""Level 5's far columns out of focus (the owner, 23/11: "make the far background better in 5", "bro I want them blurry"):
the card (its columns and their images in the water) blurred with its alpha, premultiplied, so its edges go soft into
the haze and no dark or light fringe comes in.

  python3 -I design/level5/far_painted/blur.py <card in> <card out> <sigma in the card's pixels>
"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
src, out, sg = sys.argv[1], sys.argv[2], float(sys.argv[3])
c = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255
a = c[..., 3]; pm = c[..., :3] * a[..., None]
pm = np.stack([gaussian_filter(pm[..., i], sg) for i in range(3)], -1); a = gaussian_filter(a, sg)
rgb = np.clip(pm / np.maximum(a, 1e-4)[..., None], 0, 1)
Image.fromarray(np.round(np.dstack([rgb, np.clip(a, 0, 1)]) * 255).astype(np.uint8), 'RGBA').save(out)
print('blurred', out, sg)
