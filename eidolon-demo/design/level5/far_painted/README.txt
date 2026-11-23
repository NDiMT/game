Level 5: the far columns in the haze at the upper right, painted as the row at the left (the owner, 23/11, of the 3D ones
made stouter with capitals: "you made the ones in the background shit, I want them about like the ones we put at the
left"; "the reflections are shit"; "and they should fade toward the bottom").

The game at her start rendered at twice the size (1440 by 2560, IV_WD=0 IV_NO_HAND=1) with the 3D far columns and without
them (IV_COLS=0), cropped at (760,560)-(1440,1240): far_frame.png, far_base.png. The image model repainted them in the
style of the row at the left (style_ref.png: the row's card on its frame), far, faint, their feet going into the haze
(far_prompt.txt -> far_gemini.jpg), then the water green (far_green_prompt.txt -> far_green.jpg). Lifted:

  python3 -I tools/go/water_lift.py <far_gemini> <far_green> design/level5/far_painted/far_base.png <cut> 0,0,2048,2048 \
      1024,900,1100,800 --min 3000 --drop 0,1500,760,2048 --drop 960,1760,1600,2048 --drop 1700,1990,1880,2048

scaled to 680x680 and laid 0.35 into the haze behind it (far_painted_water.png), then its images in the water made from it:

  python3 -I tools/go/card_reflect.py design/level5/far_painted/far_painted_water.png goguard/wd_far.png 107.8 --k 0.5 \
      --wave 1.2 --contact 16 --fade 0.8 --contour

In IV_WATER_DETAILS at 380 280 340 340, foot 651.0 476.8. The 3D far columns are off (IVGD_COLS_ON false; IV_COLS=1).
