Level 5: the colonnade at the upper left and the column standing by the island, painted (the owner, 23/11: "I liked
it more from Gemini"; "just a little more intense, with facets"; "make it like the ones below, they came out very well,
but standing, with a capital"; of the result: "the last one I liked").

Built first in 3D (tools/go/guard_far_plan.py near / isle, Ionic columns in detail: goguard/near_cols.glb,
goguard/isle_col.glb, off in the game now), then rendered from the game at her start at twice the size (1440 by 2560,
IV_WD=0 IV_NO_HAND=1) with them (group_frame.png, isle_frame.png: crops at (0,690)-(880,1276) and (20,1680)-(420,2280)
of that frame) and without them (IV_NEAR=0 IV_ISLE=0: group_base.png, isle_base.png). The image model repainted each
crop's columns in the style of the fallen column at the lower right (style_ref.png, cut from
design/water/level5_column_faceted.png): *_style_prompt.txt -> *_style_gemini.jpg (a first take with facets only,
*_facets_prompt.txt -> *_facets_gemini.jpg, read as too pale in the haze); then the same with the open water green
(*_green_prompt.txt -> *_style_green.jpg). Lifted:

  python3 -I tools/go/water_lift.py <group_style> <group_style_green> design/level5/columns_facets/group_base.png <cut> \
      0,0,2528,1696 1264,1250,1450,700 --min 3000 --drop 2260,1090,2528,1696 --drop 0,1395,810,1696
  python3 -I tools/go/water_lift.py <isle_style> <isle_style_green> design/level5/columns_facets/isle_base.png <cut> \
      0,0,1696,2528 760,1900,700,900 --min 3000 --dropt 0,1640,1696,2528 --drop 0,0,1696,440 --drop 950,0,1696,800 \
      --drop 1380,800,1696,1650

each scaled (weighted by its cover) to twice the frame's size: goguard/wd_cols.png 880x586, goguard/wd_isle.png
400x600; in IV_WATER_DETAILS at the frame's (left, top, width, height, foot): 0 345 440 293 146.9 580.5 and
10 840 200 300 98.0 1032.6 (the crops' places, halved).
