The first level's water, after its lilies were turned down (23/11): three more things offered at the lower right (the
first three, a head, a column and a boat, are kept for another map in design/fg_spare/level1_water/):
  stele   a marble grave stele, a veiled woman seated and a girl before her, standing aslant, a third sunk
  lamps   four clay oil lamps floating, lit (lamp_glints.py: each flame's glint in the water under its lamp)
  under   a veiled marble statue lying in the water (the prompt asked for it under the surface; the model laid it on it)
Each painted into the level's frame (design/level1/lilies/frame.png) with the fifth level's faceted column as the style
(<name>_prompt.txt -> <name>_painting.jpg), its water made green (<name>_green_prompt.txt -> <name>_green.jpg; the
stele's first take left the lower water grey, the second names the bottom edge), lifted by tools/go/water_lift.py, the
small solid bits dropped (painted flame images, specks), and its image in the water made by tools/go/card_reflect.py
--soft (the owner: "you mess up the reflections a bit, it comes out like a bad mirror"): shaken across by small waves,
soft, less contrast, broken by short level dashes, gone toward the bottom:
  water_lift.py stele_painting stele_green frame.png <card> 1000,1880,1500,2700 1246,2380,320,330 --new 25 --drop 1000,1880,1500,1946
  water_lift.py lamps_painting lamps_green frame.png <card> 800,1900,1500,2650 1144,2250,420,380 --new 25
  water_lift.py under_painting under_green frame.png <card> 740,1930,1536,2600 1130,2205,460,320 --new 25
  card_reflect.py <card> <out> 131 --k 0.85 --wave 1.6 --contact 16 --fade 0.8 --soft             (stele)
  card_reflect.py <card> <out> 131 --k 0.95 --wave 1.4 --contact 14 --fade 0.6 --contour --soft    (lamps, then lamp_glints.py)
  card_reflect.py <card> <out> 131 --k 0.95 --wave 1.6 --contact 14 --fade 0.35 --contour --soft   (under)
131 is the painting's pixels to a metre of height (1536 over the level's 9.6 m eye, by cos 35).
Places in the frame (left, top, width, height): stele 468.8 874.4 234.4 381.4, lamps 375.0 883.7 328.1 348.8, under
346.9 897.7 373.1 311.6.
