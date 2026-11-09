# (Agent A, a8) grid of dev/shots/a8-<label>-<tier>-*.png -> out.  python3 dev_fx/a8_sheet.py <glob> <out> [cols] [scale]
import glob, os, sys
from PIL import Image, ImageDraw
fs = sorted(glob.glob(sys.argv[1]), key=os.path.getmtime)
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 10
sc = float(sys.argv[4]) if len(sys.argv) > 4 else 0.33
w, h = int(390 * sc), int(844 * sc)
rows = (len(fs) + cols - 1) // cols
sh = Image.new("RGB", (w * cols, h * rows), (0, 0, 0))
d = ImageDraw.Draw(sh)
for i, f in enumerate(fs):
    x, y = (i % cols) * w, (i // cols) * h
    sh.paste(Image.open(f).convert("RGB").resize((w, h)), (x, y))
    d.text((x + 4, y + 4), os.path.basename(f)[:-4].split("-")[-1], fill=(255, 60, 60))
sh.save(sys.argv[2]); print("sheet", len(fs), sh.size)
