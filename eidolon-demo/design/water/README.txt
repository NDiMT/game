Details in the water (the owner, 23/11): ch1.gd IV_WATER_DETAILS, _iv_water_details.

Levels 1, 2, 3: lilies (a), reeds (b), petals (c), all three, each moved to its own place in the open water (place.json);
level 5: the stumps of a drowned colonnade; level 4: the lilies, below. Each painted by the image model into the level's
frame (levelN_frame.png: the game's still at her start, 720 by 1280, nothing before the eye; level 1 with IVW_SKIP=1 at
6 s, the others at 2.5 s; level 2's with the tutorial hand painted out, or the model turns the hand into the thing),
gen.py ASPECT 9:16 SIZE 2K with the frame as its reference (levelNx_prompt.txt -> levelNx_painting.jpg), then the
painting with its water made green (levelNx_green_prompt.txt -> levelNx_green.jpg). Lifted and written into the levels
by lift_all.py (tools/go/water_lift.py), which prints each card's entry for IV_WATER_DETAILS. options/: the twelve
offered (the sheet, the prompts); 5c etc. not used. The amphora, the marble hand, the capital and the bronze mirror
before them (turned down: "I don't like these") are in the history at c84d7f1f.

Level 4: the lilies, see level4_lilies_compose.py.
