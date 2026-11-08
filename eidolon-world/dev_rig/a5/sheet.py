# (Agent A, a5) compose dev/shots/a5-sheet.png from the a5-s-*.png frames (python3 dev_rig/a5/sheet.py)
import glob, os
from PIL import Image, ImageDraw
here = os.path.join(os.path.dirname(__file__), "..", "..", "dev", "shots")
fs = sorted(glob.glob(os.path.join(here, "a5-s-*.png")))
w, h = 195, 422
sh = Image.new("RGB", (w * 5, h * 2), (0, 0, 0))
d = ImageDraw.Draw(sh)
for i, f in enumerate(fs[:10]):
    x, y = (i % 5) * w, (i // 5) * h
    sh.paste(Image.open(f).convert("RGB").resize((w, h)), (x, y))
    d.text((x + 5, y + h - 14), os.path.basename(f)[7:-4].upper(), fill=(220, 30, 40))
sh.save(os.path.join(here, "a5-sheet.png"))
print("sheet", len(fs))
