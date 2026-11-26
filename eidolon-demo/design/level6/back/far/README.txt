Level 6: the far crowd of veiled statues, seen as the level is (the owner, 26/11, of the backdrop whose statues were
painted at eye level: "I want care with the background, it does not match the perspective at all").

3D first. Ten of our statues (statue_standing, statue_welcome, statue_kneeling) stood in the level's own sea at the left
for a render only (IV_STATUES_ADD="model,x,foot,z,height,turn;..." in ch1.gd, the list in CLAUDE.md's level 6 notes and
in the session's scratch), placed from the frame's pixels by IV_WD_PICK; the game rendered at twice the frame (1440 by
2560) at her start with them and without them (IV_WD=0 IV_NO_HAND=1 IV_NO_STORY=1, IV_BG_FILE the plain dusk sky that is
now goback/backdrop.jpg). The crop (0,960)-(1050,1660) of each: frame_with.jpg, frame_without.jpg.

The image model repainted only the statues, in the hazy style of the old backdrop's crowd (style_ref.jpg, cut from
backdrop_b_raw.jpg), keeping place, size and the high angle: statues_prompt.txt, the crop and the style reference ->
statues_painted.jpg (gen.py ASPECT 3:2 SIZE 2K); its water and haze made green: green_prompt.txt -> statues_green.jpg
(it kept the haze band at the top).

Made ready (prep.py <dir> with style_a.png = statues_painted, crop_without.png = frame_without, style_a_green.png =
statues_green): the motes taken out of the painting and the frame, the painting's slow drift of colour away from the
statues taken out, the band made green away from the statues; then lifted:

  python3 -I tools/go/water_lift.py lift_edit.png lift_green.png lift_base.png wd_far_a.png 0,0,2528,1696 1100,900,1900,720 \
      --min 2500 --new 4 --floor 0.02 --dropt 920,540,1050,770 --drop 1726,600,1880,1180 --drop 1940,560,2140,1060 \
      --drop 882,1436,2528,1696 --drop 2150,400,2528,1696 --drop 1512,1159,2528,1696 --drop 700,1500,2528,1696 \
      --drop 1150,1150,1530,1440

(the two statues at the right left out: they stood where the great rocks at the island's back now stand; the kneeling
one taken as water so its head in the haze band comes whole; the island dropped) and scaled to 1050 by 700:
goback/wd_statues.png, in IV_WATER_DETAILS at the frame's 0 480 525 350, its foot set at (205, 632), the farthest
statues' feet, so the card lies at their depth and the rocks at the island's back stand before it.
