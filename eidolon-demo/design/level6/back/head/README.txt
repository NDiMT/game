Level 6's foot of the screen: the colossal veiled head fallen and half sunk at the lower right, as its chosen concept
(c5) has it (the owner, 26/11: "I also want something to adorn the bottom part of the screen"; then of the concepts, "5").
Painted by the image model into the level's own frame at her start in its new look (frame.png, no story or hand), with
the concept's head as the reference (c5_head.jpg): head_prompt.txt -> head_painting.jpg (gen.py ASPECT 9:16 SIZE 2K,
the first of two takes); its water made green: head_green_prompt.txt -> head_green.jpg; lifted:

  python3 -I tools/go/water_lift.py head_painting head_green frame.png goback/wd_head.png 850,1880,1536,2700 1190,2260,470,400 --new 25

in IV_WATER_DETAILS at 398.4 874.4 321.6 381.4, foot 613.3 1109.3.

Then carved in facets (the owner, 26/11: "can the head have facets?"): the painting edited by the image model with the
fifth level's fallen column for the style (head_facets_prompt.txt, design/level5/columns_facets/style_ref.png ->
head_facets.jpg, the second of two takes), its water made green (head_green_prompt.txt -> head_facets_green.jpg), lifted
with the same box and ellipse: goback/wd_head.png, its place as before.
Then the facets less marked (the owner, 27/11: "less visible facets"): the smooth painting edited again for a subtle,
gentle faceting (head_facets_soft_prompt.txt, the second of three takes -> head_facets_soft.jpg), its water made green
(head_facets_soft_green.jpg), lifted with the same box: goback/wd_head.png. A blend of the smooth and the faceted takes was
tried first: their features lie a little apart, and they doubled.
