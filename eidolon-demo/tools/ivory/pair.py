"""the concept and a render side by side, one half of the frame (top or bottom), large enough to judge"""
import sys
from PIL import Image
c = Image.open(sys.argv[1]).convert('RGB'); g = Image.open(sys.argv[2]).convert('RGB'); half = sys.argv[4]
k = g.width / c.width; off = (c.height * k - g.height) / 2
cc = c.resize((g.width, int(c.height * k))).crop((0, int(off), g.width, int(off) + g.height))
y0, y1 = (0, g.height // 2 + 40) if half == 'top' else (g.height // 2 - 40, g.height)
a = cc.crop((0, y0, g.width, y1)); b = g.crop((0, y0, g.width, y1))
o = Image.new('RGB', (g.width * 2 + 10, y1 - y0), 'white'); o.paste(a, (0, 0)); o.paste(b, (g.width + 10, 0))
o.save(sys.argv[3], quality=88)
