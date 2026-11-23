Level 1: water lilies all round the island (the owner, 23/11: "impress me with level 1; all around I want water lilies").

frame.png: the game at her start, nothing in the water, no hand. The image model painted lilies all round the island, the
statue and her slab, the water over the sunken stones kept clear (lilies_prompt.txt -> lilies_gemini.jpg), then its open
water green (lilies_green_prompt.txt -> lilies_green.jpg), and the clean frame's open water green (frame_green_prompt.txt
-> frame_green.jpg). Lifted as one layer over the whole frame:

  python3 -I tools/go/water_lift.py <lilies_gemini> <lilies_green> design/level1/lilies/frame.png <layer> \
      0,0,1536,2752 768,1376,1100,1700 --min 200 --new 25 --pix 22

the water about them kept only within 40 px of them, nothing at the frame's foot (70 px), and the whole kept to the clean
frame's open water (its green take, opened 2, grown 4, soft 2.5) and, on the far water behind the statue and at the left
edge which that take left in haze, to what the painting changed (more than 28: boxes 320,903-853,1204 and 0,1010-171,1419);
scaled, weighted by its cover, to 1080x1920: gowake/wd_lily_ring.png, laid on the water's plane by the game
(IV_WATER_DECALS).

Then far fewer and discreet (the owner: "you overdid it, I want much fewer, and discreet"): of the layer's pads, buds and
flowers (its solid parts, cover over 0.8) only eight kept with their ripples about them (grown 18, soft 3): a pad at the
statue's feet, a pad at the island's right, a pad, a bud and one small flower at the lower right, two pads and a bud at
the lower left; given 0.22 to the water under them, cover 0.9. The flower at the statue's feet lay against the rock
there, and on the water's plane the rock hid half of it: a thing that rises out of the water against a rock or a figure
does not lie on the decal well; keep such things away from them.
