import sys, os, math
sys.path.insert(0, '/tmp/claude-0/-home-user-game/9db9e6f7-f322-58a8-a673-ecffb8a05976/scratchpad/l6')
from twin import analyse, solve, step
from PIL import Image, ImageDraw, ImageFont
OUT = sys.argv[1]
W, H = 4, 3
full = [(x, y) for x in range(W) for y in range(1, H + 1)]
col, gap = (0, 2), (1, 1)
A = frozenset(set(full) - {col}); B = frozenset(set(full) - {gap})
sa = (0, 1); ga = (3, 3); gb = (3, 1)
print('check', analyse(A, B, sa, sa, ga, gb))
path = solve(A, B, sa, sa, ga, gb)
names = {(1,0):'→',(-1,0):'←',(0,1):'απομακρύνσου από το νερό',(0,-1):'προς το νερό'}
S = 150; X0 = 150; IW, IH = 900, 1350
WY = 625                         # the water's middle on the picture
def cell(side, p):               # side 0 you (below the water), 1 she (above, mirrored)
    x = X0 + p[0] * S + S // 2
    y = WY + 70 + (p[1] - 1) * S + S // 2 if side == 0 else WY - 70 - (p[1] - 1) * S - S // 2
    return x, y
fb = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 34)
fn = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 30)
fs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
SKY, WAT, SLAB, EDGE, ROCK = (233,226,236), (178,186,214), (246,242,244), (190,180,196), (92,80,98)
def board(d, lit_g=0.0, lit_p=0.0):
    d.rectangle([0, 0, IW, IH], fill=SKY)
    d.rectangle([0, WY - 52, IW, WY + 52], fill=WAT)
    for k in range(9): d.line([(60 + k * 95, WY - 8 + (k % 3) * 8), (110 + k * 95, WY - 8 + (k % 3) * 8)], fill=(214,220,236), width=3)
    d.text((IW // 2, WY), 'ακίνητο νερό', font=fs, fill=(90,96,128), anchor='mm')
    for side, nodes in ((0, A), (1, B)):
        for p in full:
            cx, cy = cell(side, p)
            if p in nodes:
                d.rounded_rectangle([cx - 66, cy - 66, cx + 66, cy + 66], 18, fill=SLAB, outline=EDGE, width=3)
            elif side == 1:      # her fallen slab: dark water in the ruin
                d.rounded_rectangle([cx - 62, cy - 62, cx + 62, cy + 62], 18, fill=(126,132,164))
                d.text((cx, cy), 'κενό', font=fs, fill=(235,235,245), anchor='mm')
            if side == 0 and p == col:
                d.rounded_rectangle([cx - 66, cy - 66, cx + 66, cy + 66], 18, fill=SLAB, outline=EDGE, width=3)
                d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill=ROCK); d.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(150,138,156))
                d.text((cx, cy + 50), 'κολόνα', font=fs, fill=ROCK, anchor='mm')
            if side == 1 and p == col:      # the same column fallen in her ruin: rubble she walks over
                d.line([(cx - 40, cy + 34), (cx + 30, cy + 10)], fill=(200,190,206), width=10)
    gx, gy = cell(0, ga); a = int(150 + 105 * lit_g)
    d.ellipse([gx - 46, gy - 46, gx + 46, gy + 46], outline=(a, a - 10, a - 30), width=9); d.ellipse([gx - 30, gy - 30, gx + 30, gy + 30], fill=(150,128,118))
    d.rectangle([gx + 76, gy - 70, gx + 96, gy + 50], fill=(220,214,226)); d.text((gx + 86, gy + 78), 'πύλη', font=fs, fill=ROCK, anchor='mm')
    px, py = cell(1, gb); b = int(120 + 120 * lit_p)
    d.ellipse([px - 46, py - 46, px + 46, py + 46], fill=(b - 40, b, 255), outline=(90,110,170), width=4)
    d.text((px, py - 70), 'η λίμνη της', font=fs, fill=(70,80,130), anchor='mm')
def figs(d, pa, pb, labels=False):
    ax, ay = pa; bx, by = pb
    d.ellipse([ax - 28, ay - 28, ax + 28, ay + 28], fill=(250,248,246), outline=(70,58,74), width=5)
    for k in (-10, 2, 14): d.line([(ax - 18, ay + k - 6), (ax + 18, ay + k + 2)], fill=(186,96,64), width=5)
    d.ellipse([bx - 28, by - 28, bx + 28, by + 28], fill=(200,40,44), outline=(120,20,24), width=4)
    if labels:
        d.text((ax, ay + 46), 'εσύ', font=fs, fill=(70,58,74), anchor='mm'); d.text((bx, by - 46), 'η Ιόνη', font=fs, fill=(150,24,30), anchor='mm')
frames = []; fps = 30
def put(img, n=1):
    for _ in range(n): frames.append(img.copy())
def caption(d, t1, t2=''):
    d.rectangle([0, IH - 170, IW, IH], fill=(40,34,44))
    d.text((IW // 2, IH - 118), t1, font=fb, fill=(245,240,244), anchor='mm')
    if t2: d.text((IW // 2, IH - 64), t2, font=fn, fill=(222,212,224), anchor='mm')
def title(d, n):
    d.text((40, 30), 'Πίστα 6: εσύ και η αντανάκλασή σου (η Ιόνη, στα κόκκινα)', font=fs, fill=ROCK)
    d.text((40, 64), 'κίνηση %d / %d' % (n, len(path)), font=fs, fill=(120,110,126))
pa, pb = sa, sa
img = Image.new('RGB', (IW, IH)); d = ImageDraw.Draw(img); board(d); figs(d, cell(0, pa), cell(1, pb), True); title(d, 0)
caption(d, 'Κάθε σάρωση κινεί και τις δύο σας.', 'Η κολόνα σταματά μόνο εσένα, το κενό μόνο εκείνη.'); put(img, 90)
for i, (dd, (na, nb)) in enumerate(path):
    ma, mb = na != pa, nb != pb
    why = ''
    if not ma: why = 'Η κολόνα σε σταματά, εκείνη προχωρά.' if step(set(full), pa, dd) == col else 'Η άκρη σε σταματά, εκείνη προχωρά.'
    if not mb: why = 'Το κενό τη σταματά, εσύ προχωράς.' if step(set(full), pb, dd) == gap else 'Η άκρη τη σταματά, εσύ προχωράς.'
    arrow = {(1,0):'σάρωση →',(-1,0):'σάρωση ←',(0,1):'σάρωση μακριά από το νερό',(0,-1):'σάρωση προς το νερό'}[dd]
    a0, a1 = cell(0, pa), cell(0, na); b0, b1 = cell(1, pb), cell(1, nb)
    for f in range(18):
        t = f / 17.0; t = t * t * (3 - 2 * t)
        img = Image.new('RGB', (IW, IH)); d = ImageDraw.Draw(img); board(d)
        A_ = (a0[0] + (a1[0] - a0[0]) * t, a0[1] + (a1[1] - a0[1]) * t); B_ = (b0[0] + (b1[0] - b0[0]) * t, b0[1] + (b1[1] - b0[1]) * t)
        if not ma: A_ = (a0[0] + 8 * math.sin(t * math.pi * 3) * (dd[0] != 0), a0[1] + 8 * math.sin(t * math.pi * 3) * (dd[1] != 0))
        if not mb: B_ = (b0[0] + 8 * math.sin(t * math.pi * 3) * (dd[0] != 0), b0[1] + 8 * math.sin(t * math.pi * 3) * (dd[1] != 0))
        figs(d, A_, B_); title(d, i + 1); caption(d, arrow, why); put(img)
    pa, pb = na, nb
    put(img, 22 if why else 8)
for f in range(30):
    img = Image.new('RGB', (IW, IH)); d = ImageDraw.Draw(img); board(d, f / 29, f / 29); figs(d, cell(0, pa), cell(1, pb)); title(d, len(path))
    caption(d, 'Εσύ στον κύκλο, εκείνη στη λίμνη της:', 'η πύλη ανοίγει.'); put(img)
put(img, 75)
os.makedirs(OUT, exist_ok=True)
for i, fr in enumerate(frames): fr.save('%s/f%04d.png' % (OUT, i))
print('frames', len(frames))
