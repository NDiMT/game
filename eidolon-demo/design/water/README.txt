Details in the water (the owner, 23/11): ch1.gd IV_WATER_DETAILS, _iv_water_details.

Level 2: the petals (2c), level 3: the lilies (3a), of twelve natural ones offered (options/: the sheet, the prompts),
each at its painted place. Each painted by the image model into the level's frame (levelN_frame.png: the game's still at
her start, 720 by 1280, nothing before the eye; level 2's with the tutorial hand painted out, or the model turns the hand
into the thing), gen.py ASPECT 9:16 SIZE 2K with the frame as its reference (levelNx_prompt.txt -> levelNx_painting.jpg),
then the painting with its water made green (levelNx_green_prompt.txt -> levelNx_green.jpg); lifted by lift_all.py
(tools/go/water_lift.py), which prints each card's entry.

Level 5: a fallen Ionic column at the lower right, and a drum broken off it. The column: painted into the frame after
the column of the earlier painting (level5_column_ref.png, its prompt level5_column_prompt.txt -> _painting.jpg), its
green take; made to look carved and slightly polygonal as the third level's goddess (the owner: "the column doesn't look
3D"; "how did you do the others with facets in Gemini?"): a square crop about it (718,1891, 818 a side) repainted by the
model as a finely faceted low-poly marble column (level5_column_facets_prompt.txt -> _facets_gemini.jpg), its light and
shade laid on the painting within the column's mask (from the green take, the rocks it touched cut off):
  python3 -I tools/go/figure_facets.py design/water/level5_column_painting.jpg design/water/level5_column_facets_gemini.jpg \
      <faceted.png> 1.0 design/water/level5_column_mask.png 718,1891,818,818 1.3          (-> level5_column_faceted.png)
  python3 -I tools/go/water_lift.py design/water/level5_column_faceted.png design/water/level5_column_green.jpg \
      design/water/level5_frame.png goguard/wd_column.png 685,1843,1536,2752 1168,2334,483,477 --new 25 \
      --drop 820,1940,1205,2140 --drop 1185,1940,1365,2075 --dropw 685,1843,1205,2330 --dropw 685,1843,1536,2085
  laid 20 px right and 85 px down of where it was painted ("lower right"). Then the frame with it laid there
  (level5_drum_frame.png) given to the model for "a second piece of column" (level5_drum_prompt.txt -> _painting.jpg,
  the first of two takes), its green take, and the drum lifted against that frame, so only it is new:
  python3 -I tools/go/water_lift.py design/water/level5_drum_painting.jpg design/water/level5_drum_green.jpg \
      design/water/level5_drum_frame.png goguard/wd_drum.png 512,2267,1060,2709 786,2488,274,221 --new 25 --dropw 900,2150,1536,2752

Level 4: the lilies, see level4_lilies_compose.py.
Turned down, in the history: the amphora, the marble hand, the capital and the bronze mirror (c84d7f1f); all three of
lilies, reeds and petals in levels 1-3 and the stumps of a colonnade in 5 (e9f1810c).
