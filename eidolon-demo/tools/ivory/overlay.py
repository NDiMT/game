"""the concept and a render side by side, and the render laid over the concept at half strength (same frame)"""
import sys
from PIL import Image
c = Image.open(sys.argv[1]).convert('RGB'); g = Image.open(sys.argv[2]).convert('RGB')
W = 540; H = int(W * g.height / g.width)
cH = int(W * c.height / c.width)
c2 = c.resize((W, cH)); g2 = g.resize((W, H))
off = (cH - H) // 2
cc = c2.crop((0, off, W, off + H))      # (the screen shows the picture a little cut at top and bottom)
blend = Image.blend(cc, g2, 0.5)
s = Image.new('RGB', (W * 3 + 20, H), 'white'); s.paste(cc, (0, 0)); s.paste(g2, (W + 10, 0)); s.paste(blend, (2 * W + 20, 0))
s.save(sys.argv[3], quality=86)
