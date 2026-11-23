Details in the water, one per level (the owner, 23/11): ch1.gd IV_WATER_DETAILS, _iv_water_details.

Levels 1, 2, 3, 5: levelN_frame.png is the game's still at her start (720 by 1280, nothing before the eye; level 1 with
IVW_SKIP=1 at 6 s, the others at 2.5 s; level 2's with the tutorial hand painted out, or the image model turns the hand
into the thing). levelN_prompt.txt gave levelN_painting.jpg (gen.py, ASPECT 9:16, SIZE 2K, the frame its reference);
levelN_green_prompt.txt gave levelN_green.jpg (the painting its reference). Lifted by tools/go/water_lift.py:
  1 amphora  water_lift.py level1_painting.jpg level1_green.jpg level1_frame.png gowake/wd_amphora.png 990,2270,1470,2640 1220,2500,250,125
  2 hand     water_lift.py level2_painting.jpg level2_green.jpg level2_frame.png goveil/wd_hand.png 290,2220,720,2660 500,2510,215,135
  3 capital  water_lift.py level3_painting.jpg level3_green.jpg level3_frame.png gomilos/wd_capital.png 930,2090,1450,2580 1180,2420,265,145 --drop 1215,2060,1370,2195 --floor 0.06
  5 mirror   water_lift.py level5_painting.jpg level5_green.jpg level5_frame.png goguard/wd_mirror.png 60,2240,560,2680 290,2520,240,130 --drop 390,2200,600,2292
Each prints its place (left, top, width, height, foot) for IV_WATER_DETAILS.

Level 4: the lilies, see level4_lilies_compose.py.
