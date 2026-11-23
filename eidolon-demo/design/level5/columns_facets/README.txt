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

Then (the owner: "random columns where I marked", "in general more massive", "the triptych slightly fainter", "the lower
and the upper ones should match the colours of the rest of the map", "why not Gemini directly?"): the painting above
laid on the game's frame (direct_frame.png: the 2x frame without the 3D columns, crop (0,660)-(920,1580), with the card
on it), edited by the image model directly (direct_prompt.txt -> direct_gemini.jpg: stouter, two broken columns and a
drum in the open water he marked, the colonnade fainter, all in the colours of the island's marble); then (the owner:
"remove these", the lone column at the far left with its drum and the column by the island; "and remake the columns a
little more random") edited again (direct2_prompt.txt; the lone column at the right, which it took away unasked, set back
from the painting before it, rows 520-900, columns 1500-1740, feathered) -> direct2_gemini.jpg; its water made green
(direct_green_prompt.txt -> direct2_green.jpg; the model kept the haze band at the top, so above row 480 all but the
colonnade where the card had it (dilated 10) is made green before the lift); lifted against direct_base.png:

  python3 -I tools/go/water_lift.py <direct2_gemini> <green, band cleared> design/level5/columns_facets/direct_base.png <cut> \
      0,0,2048,2048 1024,1100,1300,900 --min 3000 --drop 0,1140,640,2048 --drop 0,1820,1000,2048 \
      --drop 1440,1530,2048,2048 --drop 1740,900,2048,1320 --drop 1365,1610,1660,1890 --drop 1500,380,2048,540

scaled to 920x920 (goguard/wd_cols.png), the colonnade (rows 125-515, columns 245-605 of it) a quarter of the way to the
haze behind it; in IV_WATER_DETAILS at 0 330 460 460, foot 215.9 694.8. The column by the island is out. The fallen
column and its drum at the lower right brought into the same marble (grade.py, k 0.85, the reference the two new
columns of wd_cols.png: rows 520-820, columns 440-760, where solid).

Then (the owner: "make the lower ones a little random, they are straight like cucumbers"): edited again from
direct2_gemini.jpg (direct3_prompt.txt -> direct3_gemini.jpg: the two broken columns of offset, chipped drums, jagged tops,
the drum battered), its green take direct3_green.jpg, the band cleared as before, lifted with the same drops and two
more for strips of haze under the band (1712,380,2048,570; 1500,380,1712,556; 0,470,520,560), the colonnade faded as
before; foot 215.0 694.3. The fallen column and drum at the lower right 0.85 of their size about the column's foot ("the
fallen ones at the lower right a little smaller still").

Then its image in the water made from the card itself (the owner: "the reflection in the water is tragic"): the card
with the painted water (wd_cols_painted_water.png) through

  python3 -I tools/go/card_reflect.py design/level5/columns_facets/wd_cols_painted_water.png goguard/wd_cols.png 107.8 \
      --k 0.7 --wave 1.6

(107.8: pixels a metre of height in the card at twice the frame's size; the row turned over about the line through its
legs' feet, every other thing about its own foot).
