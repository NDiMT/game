"""compose the anim_sheet cells into one labelled contact sheet (or a strip).
  python3 dev_rig/anim/compose.py <cells_dir> <out.png> [cols] [scale]"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
d, outp = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
sc = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
labels = {}
for ln in open(os.path.join(d, 'labels.txt')):
    i, n = ln.rstrip('\n').split('\t'); labels[int(i)] = n
ims = []
for i in sorted(labels):
    p = os.path.join(d, 'cell_%02d.png' % i)
    if os.path.exists(p): ims.append((Image.open(p).convert('RGB'), labels[i]))
w, h = ims[0][0].size
w, h = int(w * sc), int(h * sc)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), (20, 20, 22))
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', max(11, int(15 * sc)))
except Exception: font = ImageFont.load_default()
for k, (im, lab) in enumerate(ims):
    im = im.resize((w, h))
    x, y = (k % cols) * w, (k // cols) * h
    sheet.paste(im, (x, y))
    dr = ImageDraw.Draw(sheet)
    dr.rectangle([x, y, x + w - 1, y + int(22 * sc)], fill=(0, 0, 0))
    dr.text((x + 5, y + 3), lab, fill=(235, 225, 225), font=font)
    dr.rectangle([x, y, x + w - 1, y + h - 1], outline=(60, 60, 64))
sheet.save(outp)
print(outp, sheet.size)
