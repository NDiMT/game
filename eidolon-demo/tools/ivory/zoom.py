"""the same region of the concept and a render side by side, enlarged: to judge rock facets, joints, the mist line.
usage: python3 -I tools/ivory/zoom.py <concept.png> <render.png> <out.jpg> x0 y0 x1 y1   (box in the render's 720x1280 frame)"""
import sys
from PIL import Image
c = Image.open(sys.argv[1]).convert('RGB'); g = Image.open(sys.argv[2]).convert('RGB')
x0, y0, x1, y1 = [float(v) for v in sys.argv[4:8]]
s = g.width / 720.0                                     # the render may be larger than 720 wide
k = c.width / 720.0; off = (c.height - 1280 * k) / 2    # the concept, fitted to the same frame (as pair.py)
a = c.crop((int(x0 * k), int(y0 * k + off), int(x1 * k), int(y1 * k + off)))
b = g.crop((int(x0 * s), int(y0 * s), int(x1 * s), int(y1 * s)))
W = 700; H = int(W * (y1 - y0) / (x1 - x0))
a = a.resize((W, H), Image.LANCZOS); b = b.resize((W, H), Image.LANCZOS)
o = Image.new('RGB', (W * 2 + 10, H), 'white'); o.paste(a, (0, 0)); o.paste(b, (W + 10, 0))
o.save(sys.argv[3], quality=90)
