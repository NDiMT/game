Level 6's far statues as its chosen concept has them (the owner, 26/11: "can ... the statues behind be as in concept 5?"):
lifted from the concept itself (c5, design/level6/back/concept/c5.jpg), which was painted on the game's own frame and lines
up with it. The crop (0,597)-(660,1536) of the concept at 1536 by 2752 (c5_statues.jpg); its sea, haze and mist made green
by the image model (green_prompt.txt -> c5_statues_green.jpg, gen.py ASPECT 2:3); the game's frame at twice its size at her
start, no card, no mist, its new backdrop (frame_crop.jpg: (0,555)-(619,1429) of 1440 by 2560); made ready by
../far/prep.py and lifted:

  python3 -I tools/go/water_lift.py lift_edit.png lift_green.png lift_base.png wd.png 0,0,660,939 300,450,420,520 \
      --min 400 --new 4 --floor 0.02 --dropt 0,800,660,939

(the concept's mist at the crop's foot taken as water), specks under 150 px out: goback/wd_statues.png, in
IV_WATER_DETAILS at 0 277.7 309.4 436.7, its foot (97, 530): behind the rocks at the island's back. They are painted as
the concept paints them, more from the front than the level is seen; the owner asked for them so.
