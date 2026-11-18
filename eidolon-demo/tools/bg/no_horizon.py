"""A painted backdrop without a horizon (the owner, 18/11: "no horizon line", "in general, backdrops in one piece,
without a horizon"): the band where the painted sea meets the sky is lost in a soft mist, so sky and sea run into each
other with no line; what stands at the horizon (far rocks, statues) rises out of the mist, its foot and its image in the
water lost in it. The rest of the painting is left as it was.

The mist is the painting's own light there, blurred far in both ways (a field with no line and no shape in it: blurred
up and down only, the things at the horizon were smeared into streaks), laid over the band by a bell centred on the
horizon, and lifted a little toward its own light, so it reads as haze.

usage: python3 -I tools/bg/no_horizon.py <in.jpg> <out.jpg> <horizon, of the height from the top> [width] [peak] [lift]
       width: the bell's half width, of the height (default 0.035); peak: how much mist at the horizon (0.92);
       lift: how much it is lightened toward the haze at its middle (0.1)
"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

src, out, hz = sys.argv[1], sys.argv[2], float(sys.argv[3])
width = float(sys.argv[4]) if len(sys.argv) > 4 else 0.035
peak = float(sys.argv[5]) if len(sys.argv) > 5 else 0.92
lift = float(sys.argv[6]) if len(sys.argv) > 6 else 0.1
a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W = a.shape[:2]
y = (np.arange(H) + 0.5) / H
w = (peak * np.exp(-0.5 * ((y - hz) / width) ** 2))[:, None, None]      # (the bell: thickest at the horizon, nothing far from it)
field = gaussian_filter(a, sigma=(0.045 * H, 0.12 * W, 0), mode='nearest')      # (the mist: the painting's light there, with no line and no shape)
band = (y > hz - 2.5 * width) & (y < hz + 2.5 * width)
haze = a[band].reshape(-1, 3).mean(0)
haze = haze + (255.0 - haze) * 0.35      # (its own light, a little brighter)
o = a * (1.0 - w) + field * w
o = o + (haze[None, None, :] - o) * (w * lift)
Image.fromarray(np.clip(o + 0.5, 0, 255).astype(np.uint8)).save(out, quality=93)
print('no horizon at', hz, 'width', width, 'peak', peak, 'lift', lift, '->', out)
