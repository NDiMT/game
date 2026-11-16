"""Review sheets from a recorded run: frames every 1/fps s, laid 6 to a row with their times.
usage: python3 sheets.py <video> <outdir> [fps=2] [per_sheet=24] [width=240]"""
import os, subprocess, sys, glob
from PIL import Image, ImageDraw
vid, out = sys.argv[1], sys.argv[2]
fps = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
per = int(sys.argv[4]) if len(sys.argv) > 4 else 24
w = int(sys.argv[5]) if len(sys.argv) > 5 else 240
fr = os.path.join(out, 'frames'); os.makedirs(fr, exist_ok=True)
for f in glob.glob(os.path.join(fr, '*.png')): os.remove(f)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', vid, '-vf', 'fps=%g,scale=%d:-1' % (fps, w), os.path.join(fr, 'f%04d.png')], check=True)
fs = sorted(glob.glob(os.path.join(fr, 'f*.png')))
cols = 6
for s0 in range(0, len(fs), per):
    chunk = fs[s0:s0 + per]; ims = [Image.open(f).convert('RGB') for f in chunk]
    h = ims[0].height; rows = (len(ims) + cols - 1) // cols
    sh = Image.new('RGB', (cols * (w + 6), rows * (h + 22)), 'white'); d = ImageDraw.Draw(sh)
    for i, im in enumerate(ims):
        x = (i % cols) * (w + 6); y = (i // cols) * (h + 22)
        sh.paste(im, (x, y + 20)); d.text((x + 4, y + 4), '%.1fs' % ((s0 + i) / fps), fill=(0, 0, 0))
    sh.save(os.path.join(out, 'sheet_%02d.jpg' % (s0 // per)), quality=88)
print(len(fs), 'frames,', (len(fs) + per - 1) // per, 'sheets')
