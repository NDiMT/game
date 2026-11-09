# (Agent A, a6) compose the before/after anatomy sheet: python3 dev_rig/a6/sheet.py <frames dir> <out png> [tags...]
import sys, os
from PIL import Image, ImageDraw
D, OUT = sys.argv[1], sys.argv[2]
tags = sys.argv[3:] or ["before", "after"]
names = ["touch_glass", "statue_still", "look_hands", "hold_lamp", "shard_eye", "aim_hand R chest", "flinch_seen", "kneel_touch"]
w, h = 240, 320
sh = Image.new("RGB", (w * 2 * 4, (h + 18) * len(tags) * 2), (0, 0, 0))
d = ImageDraw.Draw(sh)
for ti, tg in enumerate(tags):
    for ci in range(8):
        col, row = ci % 4, ci // 4
        for k in range(2):
            f = os.path.join(D, "%s-%d-%d.png" % (tg, ci, k))
            if not os.path.exists(f): continue
            x, y = (col * 2 + k) * w, (row * len(tags) + ti) * (h + 18)
            sh.paste(Image.open(f).convert("RGB"), (x, y + 18))
            d.text((x + 4, y + 3), "%s %s %s" % (tg.upper(), names[ci], "front" if k == 0 else "side"),
                   fill=(230, 60, 60) if tg == "before" else (90, 220, 120))
sh.save(OUT)
print("sheet", OUT, sh.size)
