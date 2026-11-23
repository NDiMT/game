"""The fourth level's lilies, as the owner liked them (design/level4/fg_edit/L4c_lilies.png, its green take
level4_lilies_green.jpg), their pads cut by the frame's edges completed by the image model in a green margin
(level4_lilies_complete.jpg, from the take's lower left laid at 252,0 on a 1252 by 939 green canvas, its prompt beside it):

  python3 -I design/water/level4_lilies_compose.py <scratch dir>
  python3 -I tools/go/water_cut.py <scratch>/comp.png goglass/wd_lilies.png --drop 330,0,705,72 --drop 555,0,705,92
      --drop 700,0,1252,178 --drop 690,160,810,280 --dark 405,75,652,252,60 --solid 515,340,832,548
      --orig <scratch>/orig.png --fade 40
  placed in ch1.gd at -118.1, 1067.0, 586.9 x 369.8, foot 78.8, 1286.0 (the canvas to the frame: x (cx - 252) * 720/1536,
  y (cy + 2150) * 1280/2752)
"""
import sys
import numpy as np
from PIL import Image
d = sys.argv[1]
take = Image.open('design/water/level4_lilies_green.jpg').convert('RGB').crop((0, 2150, 1000, 2752))
paint = Image.open('design/level4/fg_edit/L4c_lilies.png').convert('RGB').crop((0, 2150, 1000, 2752))
cv = Image.new('RGB', (1252, 939), (0, 255, 0)); cv.paste(take, (252, 0))
og = Image.new('RGB', (1252, 939), (0, 255, 0)); og.paste(paint, (252, 0)); og.save(d + '/orig.png')
c0 = np.asarray(cv).astype(np.float32)
g1 = np.asarray(Image.open('design/water/level4_lilies_complete.jpg').convert('RGB').resize((1252, 939), Image.LANCZOS)).astype(np.float32)
yy, xx = np.mgrid[0:939, 0:1252].astype(np.float32)
wx = np.clip((xx - 252) / 24.0, 0, 1); wy = np.clip((602 - yy) / 24.0, 0, 1)
tri = np.clip((480 - xx) / 20.0, 0, 1) * np.clip((yy - 470) / 20.0, 0, 1)      # (the old frame's lower left: a half-green pad cut by its edges; there the completion's clean green and its stem)
w0 = (wx * wy * (1 - tri))[..., None]
Image.fromarray(np.clip(c0 * w0 + g1 * (1 - w0), 0, 255).astype(np.uint8)).save(d + '/comp.png')
print('saved', d + '/comp.png', d + '/orig.png')
