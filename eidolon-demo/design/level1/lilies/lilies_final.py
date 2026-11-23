"""Level 1's lilies, as the owner chose them: cut out of the image model's green take with small open lotus flowers
(lilies3_green.jpg), whole pads only, none at the frame's edge, the left group and the lower right; each bud given its image
in the water (the owner: "I'd like a reflection on the bud"): turned over about where its stem leaves the water, going
to the water's colour and gone as it goes down, a little shaken, under the pads; the painting's water about them kept
close (from the lift of lilies3 against frame.png, under 0.8 of cover).

  python3 -I design/level1/lilies/lilies_final.py <lilies3_green> <lilies3 cut> <out 1080x1920 png>
"""
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation, gaussian_filter
green, cutp, outp = sys.argv[1:4]
c = np.asarray(Image.open(green).convert('RGB')).astype(np.float32) / 255
H, W = c.shape[:2]
lead = c[..., 1] - np.maximum(c[..., 0], c[..., 2])
bg = c[lead > 0.78].mean(0); lb = bg[1] - max(bg[0], bg[2])
a = np.clip((lb - lead) / (lb + 0.03), 0, 1)
rgb = np.clip((c - (1 - a[..., None]) * bg) / np.maximum(a[..., None], 1e-3), 0, 1)
rgb[..., 1] = np.minimum(rgb[..., 1], (rgb[..., 0] + rgb[..., 2]) * 0.5 + 4 / 255.0)
sx, sy = W / 720.0, H / 1280.0
lab, n = label(a > 0.5); s = np.bincount(lab.ravel()); s[0] = 0
keep = np.zeros(n + 1, bool); buds = []
for k in range(1, n + 1):
    if s[k] < 300: continue
    ys, xs = np.nonzero(lab == k); cx, cy = xs.mean() / sx, ys.mean() / sy
    if xs.min() < 60 or xs.max() > W - 61 or ys.max() > H - 60: continue
    if (0 <= cx <= 280 and 760 <= cy <= 930) or (530 <= cx <= 715 and 1040 <= cy <= 1210):
        keep[k] = True
        if (ys.max() - ys.min() + 1) / (xs.max() - xs.min() + 1) > 1.3: buds.append(k)
A = a * binary_dilation(keep[lab], iterations=3)
ra = np.zeros((H, W), np.float32); rc = np.zeros((H, W, 3), np.float32)
for k in buds:
    # the whole bud, its thin stem's faint foot too, so its image starts where the stem leaves the water and touches it
    # (the owner: "the reflection should touch the bud")
    near_k = binary_dilation(lab == k, iterations=8) & (a > 0.15)
    ys, xs = np.nonzero(near_k); yl = ys.max(); hob = float(yl - ys.min())
    yr = (2 * yl - ys + 1).astype(int); d = (yr - yl) / hob
    al = np.clip(a[ys, xs] * 1.4, 0, 1) * 0.85 * np.clip(1.0 - d / 1.0, 0, 1) ** 1.1
    xr = np.round(xs + 1.6 * np.sin(yr * 0.25 + 0.7) * np.clip((yr - yl) / 18.0, 0, 1)).astype(int)
    ok = (yr < H) & (xr >= 0) & (xr < W); yr, xr, al, ys2, xs2 = yr[ok], xr[ok], al[ok], ys[ok], xs[ok]
    better = al > ra[yr, xr]; ra[yr[better], xr[better]] = al[better]; rc[yr[better], xr[better]] = rgb[ys2[better], xs2[better]] * 0.85
pmr = np.stack([gaussian_filter(rc[..., i] * ra, (0.8, 0.0)) for i in range(3)], -1); ra = gaussian_filter(ra, (0.8, 0.0)); rc = pmr / np.maximum(ra, 1e-4)[..., None]      # (soft only along the up: across it, the thin stem's image would fade away and the bud's float off)
cut = np.asarray(Image.open(cutp).convert('RGBA').resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
w = gaussian_filter(binary_dilation(keep[lab], iterations=24).astype(np.float32), 6.0)
wa = np.where(cut[..., 3] < 0.8, cut[..., 3], 0.0) * w
ua = ra + wa * (1 - ra); uc = (rc * ra[..., None] + cut[..., :3] * (wa * (1 - ra))[..., None]) / np.maximum(ua, 1e-4)[..., None]
oa = A + ua * (1 - A); oc = (rgb * A[..., None] + uc * (ua * (1 - A))[..., None]) / np.maximum(oa, 1e-4)[..., None]
out = np.dstack([oc, oa])
pm = np.dstack([out[..., :3] * out[..., 3:4], out[..., 3:4]])
ch = [np.asarray(Image.fromarray(pm[..., i].astype(np.float32), 'F').resize((1080, 1920), Image.LANCZOS)) for i in range(4)]
AA = np.clip(ch[3], 0, 1); C = np.clip(np.stack(ch[:3], -1) / np.maximum(AA, 1e-4)[..., None], 0, 1)
Image.fromarray(np.round(np.dstack([C, AA]) * 255).astype(np.uint8), 'RGBA').save(outp)
print('lilies', outp, 'buds with images', len(buds))
