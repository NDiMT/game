Level 6's far crowd in its chosen concept's mist (the owner chose c5, 26/11: design/level6/back/concept/c5.jpg), seen from
above as the level is (the rule of 26/11: what stands in a backdrop is seen as the level is).

The concept's statues stand at the upper left, small groups in the mist; their feet read off it at 720 wide (60,465),
(120,400), (170,490), (97,530), (250,465), (210,420) and taken down to the sea by IV_WD_PICK; six of our statues stood
there in 3D for a render, at the concept's sizes (2 to 3 m):

  IV_STATUES_ADD="standing,-13.73,-0.45,-5.18,3.1,-0.8;standing,-14.45,-0.45,-7.51,2.7,-0.6;welcome,-11.66,-0.45,-6.07,3.1,-0.9;
                  standing,-11.71,-0.45,-4.15,2.3,-0.7;kneeling,-11.17,-0.45,-7.74,1.8,-0.9;standing,-12.77,-0.45,-8.25,2.4,-0.75"

rendered at twice the frame at her start with them and without them (IV_WD=0 IV_MISTS=0 IV_NO_HAND=1 IV_NO_STORY=1, the
new silver backdrop), the crop (0,480)-(940,1232) of each: frame_with.jpg, frame_without.jpg. The image model repainted
only them in the concept's mist (statues_prompt.txt with the crop and the concept's statues, style_ref.jpg; gen.py ASPECT
5:4 SIZE 2K -> statues_painted.jpg; it added a faint seventh at the back, left out), the water made green
(green_prompt.txt -> statues_green.jpg); made ready by ../far/prep.py and lifted:

  python3 -I tools/go/water_lift.py lift_edit.png lift_green.png lift_base.png wd_a.png 0,0,2304,1856 650,1000,850,950 \
      --min 2500 --new 4 --floor 0.02 --drop 740,120,920,600 --drop 1950,1250,2304,1856 --drop 1650,1600,2304,1856

specks under 600 px taken out, scaled to 940 by 752: goback/wd_statues.png, in IV_WATER_DETAILS at 0 240 470 376, its foot
(97, 530), the nearest statue's: the card lies behind the rocks at the island's back. The game's mist band lies over them.
