---
name: go-level
description: The system for making an Eidolon GO level (Lara-Croft-GO-like, played by swipes) from a concept picture. It covers laying the level square on a grid, building it as real 3D in Blender, shading it in the picture's style with mist below, and designing a turn-based puzzle proven by a solver. It also covers wiring the puzzle to swipe play and reviewing pass by pass. Use for any new level, and for any change to a level's look, puzzle or controls.
---

# Making a GO level

A level is **real 3D in the picture's style**, never the picture shown. The user judges by images and videos, notices every crooked joint and every floating thing, and wants it "perfect". Do many passes before showing anything.

Everything is in `eidolon-demo/`. The first level, ivory (`goiv/`), is the worked example. Its numbers below are starting values, not laws.

## 0. A new level: from the puzzle to a concept to 3D

The levels are many, in one system. A new level is made in this order (the second level, `gosea/`, "The Drowned Sanctuary", is the worked example):
- **The puzzle first**, proven by a solver on a board of its own (`tools/go/first_trial.py`).
- **The plan from the board**: the board's cells laid square in world metres, with room for the flights between floors (`tools/go/shield_plan.py` writes `<level>/plan.json` and `<level>/puzzle.json`, and asserts that the plan's way is the board's).
- **Build it** with `tools/ivory_level.py` (it runs without trees, columns, arches or a relief).
- **A concept from our own blockout**: render the built level through the game's eye (`tools/go/preview.py -- <glb> <json> <png> [px] [sea y]`, with placeholders for far scenery from the plan's `scenery`), and have the image model repaint it in our style with a new setting, keeping the layout. Then refine its light and sky in a second pass. Store it as `<level>/concept.jpg` (the model returns JPEG data even for .png names).
- **The game loads the level's own folder** (`go_dir`, chosen by `FLIP=<level>`): its own palettes and sky sampled from its concept (tone bands and warm/cool balance by region, not single pixels), its own key light, its own far scenery.
- **A level entirely of our own** (the third, `gomoon/`, "The Moon Dial", is the worked example):
  - Search for the board (`tools/go/moon_search.py`, then `moon_local.py` about a hand-laid one), prove it (`moon_design.py`: unique, every element needed), and lay it out with `moon_plan.py`.
  - The setting comes first in the prompt: a place, a time of day, one strong light, one warm accent, falling weather, a framing thing in a corner.
  - The image model paints its own props (it turned the moon dial into the ivory scroll). Take the concept's light, palette, sky and atmosphere; the layout and the props stay ours.
- **Frame the eye from the level's extent on the screen.** Put every node, floor corner, arch top and the stair's foot on the screen: `sx = p·b.x`, `sy = p·b.y` (b from `_ivp_basis()`: yaw 45°, pitch 35°).
  - The width is the extent plus margins; the height is the width × 16/9.
  - Place the centre so the sky's great thing (the moon, the sun) has room above the level and the mist has room below. The centre is any point `sx·b.x + sy·b.y + t·b.z`; choose t so that y is about 0.5.
  - To fill the bottom, let the first stair come up out of the mist from low on the screen.
- **A new level must be new in its layout and setting, never in its material language.**
  - A reskin is rejected ("this map is the previous one just with snow"), and so is a new way of building: the quarry as a white heightfield of benches had "nothing to do visually with the other levels"; the user wants "the same bulky design" everywhere.
  - Every level is thick carved slabs with chamfered, broken edges on chunky faceted rock, in mist. Colours may change freely (blue slabs are fine).
  - What is new: the layout, the setting, the props, the light, the sky.
  - Design it yourself first, with a blockout through the game's eye (`tools/go/preview.py`); the image model may only paint its look later.
- **The quarry's lessons** (`goquarry/`, scene `quarry`):
  - Every edge on one lattice (0.45 m), so the level is cut as blocks.
    - Benches step down from the walkways into the pit; where two meet, none rises within a hand of the lower floor.
    - The quarry's faces rise behind in steps, like an amphitheatre.
    - Stairs are cut solid down to the bench they rise from (`flight(..., solid=True)`).
  - Sawn faces carry the drill's vertical grooves and horizontal beds in the shader (`drill`), not in the mesh.
  - Walkways must read apart from the benches beside them: darken the benches by their depth under the way (`dk`).
- **The eye's middle line**: the camera looks along the grid's diagonal, so cells (g, g) stand one above another on the screen. Never put two things on that line (the dial behind a face, the start below both).
- **Doors and gates face her way to them**, and must be seen whole.
  - A gate she walks through stands square to the last stretch of her way. The user called a gate 90° off "wrong" three times.
  - Cut low any rock between the eye and a door; a door half behind a face of rock reads as nothing.
- **The builder's dice are its own**: never seed from Python's `hash()`. It is salted per run, so each build would be another level. Seed from the name's characters.
- **Backdrops come from the kit** (`bgkit/`: twenty elements painted in greys and keyed to their own alpha).
  - `tools/bg/compose.py <recipe> <out>` lays them on a sky by a palette (`night`, `dawn`, `day`, `dusk`, `storm`): each element coloured by its depth, hazed toward the sky behind it, its foot fading into the mist.
  - The same recipe in another palette is another place. Write a recipe per level (`tools/bg/recipes/`), and save its output as `<level>/backdrop.jpg`.
  - The level's mist samples the backdrop at each point of the screen (`bg_tex`), so nothing ends on a line.
  - Feather each element's edges widely (12% of its size): clouds painted to the picture's border otherwise end on a straight cut.
- **The campaign** (the ladder of levels, easy to hard):
  - Know the story first: `eidolon-world/dev/EIDOLON_SCRIPT.md`. In these levels she is Ione's soul, faceless, in the real ruin, climbing to the still water where she can see her face again; Theron's carved faces watch for her, and being seen sends her back to the start.
  - Each level opens with two lines of the story and ends with one (`lines`, `end` in its puzzle), telling the truth in order: the sculptor, the condition, the face life carved, the veil and the hidden mirrors, her secret life, the day without a wave, the thousand faces, the mirror, the Guardian. Her only spoken line is the last level's end.
  - The first three levels teach. A mechanism appears first alone with a one-step solution, then at normal difficulty, then combined with others.
  - Even a tutorial has one visible cause and effect, never only a walk: "how is the puzzle solved?" was the user's question to a level that was only a path.
  - **Fully logical, nothing pointless in the way**: every column, rock and prop on or beside the way has a reason the player can read (a chain from a winch to the stones it lifts). Never a stray column she must walk round.
  - An image model's concept is for light, colour and atmosphere only. Its layout and props are random (stones out of line, rings that lead nowhere, an exit beside the gate) and must never become the board.
  - The tutorial hand (`<level>/hand.png`, `tutorial: true` in the puzzle): after a moment of waiting it strokes the next swipe below her, with a fading trail; a mechanism already worked is passed over.
- **Things that move in a level** (the first level, `gowake/`, is the worked example):
  - Floors named in the plan's `risers` are kept as their own objects (`riser_<name>_marble`, `riser_<name>_rock`); the game moves them and their images in the water together.
  - A thing under still water is drawn and fades into the sea by its depth (`under_k`, the water at `clip_y`), so sunken stones show as pale shapes; the rest of the level is clipped at the water (`clip_k`).
  - A volute may be a winch that raises them: kind `winch`, `once: true` (it turns no more), `toggles.bridge` (the ways over the sunken stones are no ways until they are up).
  - The way's discs and lines over the sunken stones sink and rise with them (they are clipped at the water, so no way shows over the water until the stones are up).
  - Never `await a_tween.finished` after other waits: if it has already ended, the signal never comes again and the level hangs (the autoplay stopped after the winch). Guard it: `if t.is_running(): await t.finished`.
  - **Stones rising out of the water, made beautiful** (`_ivw_risers_set`, `_ivw_emerge`; the user: "the winch needs no chain, but I'd like the stones to come up out of the water beautifully"):
    - No chain: the winch is a capstan, and the stones rise by themselves as it turns.
    - Each stone rises in its turn, the one nearest the threshold first. The riders over the water go between them.
    - Each overshoots its place a little and settles back (`_ivw_back`), so it reads as a heavy stone come up.
    - As its top breaks the surface: two rings go out, and drops leap from its edges (`CPUParticles3D`, ring emitter).
    - It comes up wet: darker and cooler, with water running down its sides. A dry line sinks down it as it drains (`wet_k`, `dry_y` in IV_SH; its slab and its rock alike).
    - Foam where it breaks the water, on the water round it and a little on it (the user: "foam where they come out, so the way out of the water reads smoother", "not only round them, a little on them too"):
      - On the water: one plane per stone a hair over the sea (`_ivw_churn_make`, `IVW_CHURN_SH`), drawn from the sea's own shore map (`shore_tex`: the distance to the stone), so it follows the stone's real outline. While its top is still 0.35 m under, a faint ring of bubbles traces its edge (`boil`). As it breaks the water, a burst spreads 0.45 m out, thick at the stone and more broken outward (`churn`, `spread`; `_ivw_churn_burst`), thins and goes in about 3.5 s, and the plane is freed.
      - Foam is round bubbles of many sizes (`bub`: a circle per cell, some cells empty) cut by a slow drifting lace. Angular noise flecks read as snow, and broad soft patches as white blotches: the user saw both in the first takes. Keep it sparse.
      - On the stone: a few white patches on its top and short runs down its sides (`foam_k`, `foam_y` in IV_SH) slide down to the water as it drains (2.6 s) and fade (3.6 s).
    - The shore foam around the stones comes in once the last is up.
  - To judge one moment without playing the whole level, take snapshots (`IVW_SNAPS=1`) and quit at a named one (`IVW_QUIT_AT=w8_risen`). To watch a spot other than her up close: `IV_ZOOM=3.2 IV_ZOOM_AT=0.2,-2.6` (metres from her start), `IVW_SKIP=1` and `--quit-after <frames>`.
- **Her waking** (a level that opens on her), as the user wants it:
  - She starts on one knee: the front foot planted with its knee up, the back knee on the stone. That is the `rise` clip's first frame, `a_rise = 0`.
    - Both hands rest on the front knee from the first, close together, the near elbow a little out: the user chose the arms as they are 2.25 s into the clip ("the arm as at 3.9 s" of the video). The arms hold that shape on her chest (they move with her breath) until the clip reaches that moment (`RISE_RARM_T`). Crossed forearms, asked for earlier, read badly from the game's eye behind her: the left forearm lying across the knee stuck out bent on the right of the picture ("the right arm is too bent"). When the user names a side, it may be the side of the picture, not hers.
    - The back foot is on its toes, the heel up, the knee down a little closer behind the front foot (`RISE_FLAT` 84, `RISE_BACK` 0.8 of a thigh). The top of the foot flat on the floor showed its sole to the game's eye from behind and reached past the edge of her stone: "the leg behind still breaks".
    - The slivers under her were the seam of the hem and the toes: faces a few millimetres across, one side weighted to the foot, the other to the leg, which stretched 50-70x as the foot rolled or the leg lifted. The build takes away only those (a jump in the foot's share of the weights across the face, within 6% of the floor: 22 faces). Never cut faces by how far they stretch: that cut big faces of the skirt's front and left a black hole there when she stands.
    - Spread the skirt's left-right weights wide (`SK_LAT` 0.1, not 0.06): its stretch between the parted knees is then shared by many faces, not torn on a few. The hem follows the legs 86% (`SK_HEM`): the skirt lies along the back shin when she kneels, and still swings a little calmer than the legs in the walk.
    - Her wrapped head is drawn in to 0.88 about its joint (`HEAD_SCALE`): as made, it weighed on the silhouette, above all bowed.
    - She kneels facing the way's own heading, her back to the eye. Never turn her from it unasked: turned to a profile so the pose would read, the user answered "you turned her and I didn't tell you to". Ask first when a change of staging would help.
    - The bow is mostly in the upper back (`RISE_SPD` 0.3/0.35/0.35 over Spine, Spine1, Spine2; 60°), the neck 34° and the head 46°: her head hangs over the crossed arms. Bowed at the waist with little neck, the wrapped head stuck out forward like a snout.
    - Make it in moments, each in its own time, never one blend of every joint from the first pose to the last (the user: "you sent me a transition"). In 8 s (`RISE_SECONDS`): a breath, the statue stirring (0.15-1.35 s); her crossed arms open and her hands go to the knee (1.1-2.1); her weight comes forward and a little down, gathering herself (2.0-2.9); the push, the hips rising until the back leg holds them in a lunge (2.8-5.6); the back foot drawn in on its toes (3.6-4.4) and stepped through (4.4-5.5); her hands off the knee (4.2-5.1); her back up (3.6-6.2) with a small sway back; her head last (5.6-7.2), looking out a little up and settling (6.4-7.8).
    - The game plays the clip at its own pace, a linear tween of `a_rise` over its length (`IVW_RISE_S`), after a second of stone stillness. An eased tween on top smoothed the moments back into one blend. Her hands, once off the knee, hang by their weight (`arm_ik` to a point below each shoulder), and come to the idle's arms only at the very end. Keeping the standing arms' lie on a bowed body flung them out behind her.
    - Review her clips in her own colours from the game's eye, turned as she is in the level: `tools/go/hero_look.py` (`PHI`, `EYES=game,side,front`).
    - Her head is bowed and her whole back is bowed over the knee (the user: "the body bowed too", then "more bowed": 62° down the spine, neck 24°, head 34°). The game's eye sees her from behind and above, which hides a bow: 20–34° did not read at all. It takes about 54° spread down the spine (`RISE_LEAN`: 40/30/30% over Spine, Spine1, Spine2), the shoulders drawn in (`RISE_SHO` 14°), the neck 18° and the head 30° (`RISE_NECK`, `RISE_HEAD`), so the head drops to the line of the shoulders. Judge it from the game's own quarter (`clip_views.py` view `game4`), not only in profile.
    - Both hands rest on the front knee (`arm_ik` in the build, the elbows out).
    - The top of the back foot lies flat on the floor (`RISE_FLAT` 145°): no bent ankle, no bent toes ("the ankle bends strangely").
  - After a short pause (about 1.5 s) she rises slowly with the `rise` clip (`a_rise` 0 to 1 over about 4.6 s, eased), her head lifting last (`a_headp`).
    - The clip is made in `tools/ione4_build.py`, in this order:
      1. Her weight comes forward over the front foot.
      2. The back foot rolls from flat onto its toes as that knee lifts. The ball of the foot stays planted, and the ankle is placed from it.
      3. She pushes up from the knee with her hands into a lunge as far as the back leg reaches; the hips are clamped to the leg's reach.
      4. The back foot is drawn in on its toes, and her hands leave the knee (the arm bones are blended to a hands-free pose).
      5. The back foot steps through and she stands, her head and back lifting last.
    - Never run the kneel clip backwards to rise: it swings the back leg forward while she is still low ("the leg bends strangely").
    - Rebuild her with the inputs of the installed model: the retarget model and its data picture (now the smart low-poly one, `ione5s_data.png`; see "The heroine" below). Check a clip in Blender from the side and the front before the game (`tools/go/clip_views.py`).
  - No turning to look about, and no lying curled with her palms on the stone ("it should not turn, just rise slowly").
  - No close-up and no draw-back ("no stupid zoom"): the eye holds the whole level from the start screen on (`ivw_close` stays 0).
  - **The eye goes a little with her** (`_ivr_follow`; the user: "it may follow her a little; some maps will be larger, but it should not go much past their edges", "smooth, with a slight delay"):
    - It aims at a share of her way from the level's own middle (`IVR_FOLLOW` 0.22) and gets there as a damped spring on the game's time (`IVR_FOLLOW_T` 0.9 s): it sets off gently, a little behind her, and stops without overshooting.
    - Held to the map (its floors, and 2 m over them for her and the gates): a map that fits the screen stays whole on it; on a larger one the eye goes with her as far as keeps her in the middle part of the screen (`IVR_BOX`), and shows no more than `IVR_EDGE` (0.45 m) past its edges. The level's own eye is always allowed.
    - The start screen holds the level's own eye; the drift starts at PLAY.
    - Where the sea and the mist are held to the world (the waking), the painted backdrop goes with them (`bg_off`), and so does the sea's horizon line (`hz_v`); elsewhere the backdrop stays on the screen, behind the level, as a far sky.
    - To tune it without rendering: `IVR_FOLLOW_LOG=1` prints her place, the aim and the drift in a headless run.
  - The painted sea must be held to the world (`world_uv` in the sea shader: the backdrop's place under the level's own eye), or a moving eye shows the painted sky on the water.
  - An image in the water dims toward the sea's own colour (`sea_c`): left at its default it dims toward blue and muddies a warm sea.
- **The look of a level at sea** (`gowake/`, after the user's notes):
  - **The painted backdrop** (what the user finally liked, after many tries):
    - **Gradients only, no clouds** ("forget the clouds, only gradients, and far off rocks and columns"). A soft sun low near the horizon.
    - **Sky and sea in one**: no horizon line ("can we make the sky one with the horizon?"). The sea melts into the sky through a bright haze, and the far stacks rise out of it.
    - **Far things small and far**: sea stacks and a colonnade islet at the horizon. Big columns in front read as "far too close". Nothing near the level.
    - **The camera reference is our own map**: a game frame with a neutral sky (`IV_NO_BACKDROP=1`, and no statue), its horizon where the sea should end. The style reference is the sea concept (`gosea/concept.jpg`) next to the rose one: far scenery as soft silhouettes in haze, paler the farther. Three variants at once; keep the one whose horizon lands where asked. Then fix by editing ("keep everything exactly, change only ...").
    - **What failed**:
      - Clouds the user disliked.
      - Ruins painted from a grey blockout guide (`tools/bg/iso_guide.py`): the model still drew lintels converging to a point, at eye level ("doesn't match the perspective at all").
      - A backdrop drawn in code (gradients and flat iso silhouettes): "bad".
      - 3D far ruins: thin and ghostly.
    - Measure the horizon and the sun on the chosen image and put them in the plan (`horizon`, `sun`). Nothing is drawn on the sea near the horizon (`hz_v` in the sea shader), so its far edge never shows as a seam.
  - **The colossus in the water: 3D, smooth, in soft clean bands of light.**
    - The user settled on the standing veiled figure (`props/observer_veiled.glb`), after trying the veiled head and shoulders (`props/observer.glb`) again.
    - Its hues are the lighter stone's (the white marble's palette).
    - No shadow on the water: a soft cast shadow was tried and the user had it taken off.
  - **White marble is lit from above**: the top tone is the brightest, and the sides that face the light are a step darker. Never let the lit side be the brightest: the user saw "the lower left of the whites burnt out; it should be darker, as if lit from above". The key light for the waking is high (`iv_key` -0.45, 0.8, 0.38).
  - **Coloured sunlight on the stone** (`sun_k` in IV_SH, off by default): the faces the key light falls on take the sun's colour, warmest high up and toward the sun on the screen (`sun_scr`).
    - The user tried gold ("too strong"), lilac, then pinkish yellow, and in the end had it taken off: the stone keeps its own light.
  - **Small waves where the water meets the stone** (the user: "a light ripple where the rocks meet the water"):
    - With `'shore': True` in the plan, the builder writes `<level>/shore.png` and its rect and reach (`shore`) into level.json.
    - It cuts every body at the sea level, island by island. Weld split vertices first: a flat-shaded GLB has every face its own island. It fills each outline even-odd; an open body is filled by its outline, closed and hole-filled. The colossus is imported as the game places it (foot, height, turn).
    - A distance transform, out to 1.6 m: red for what stands for good, green for the stones that rise.
    - The sea's surface draws a faint lip hugging each stone, and two faint rings drifting out, in drifting patches: discreet and scattered (the user: strong ones were "too intense"). The rising stones' waves come in as their tops break the water (`riser_up`, set in `_ivw_risers_set`).
  - **The sea**: the painted sea's colour, held to the world (`world_uv`).
    - Never long lines across it: the user called those "stupid slanted lines".
    - Instead, small soft waves aslant, here and there: short white strokes that come and go slowly (`wave_k`). They are on the surface only, never near the horizon, and white with no dark line ("white, the little wave").
    - A few points of light twinkle in the sun's path, and a fine line of light runs where stone meets the water (`wline_k`).
  - **Images in the water** fade into the sea as they go down (`mirror_fade`, about 2 m for rocks) and waver a little (`mirror_wob`, a vertex sway that grows with depth).
  - **Rock that is richer** (`rich_k`): each break its own tone, beds across the upright faces, lichen on what faces the sky, a fine speckle.
- **Lara Croft GO's atmosphere** (the user: "study Lara Croft GO's whole style and get the same atmosphere"). Its makers describe big plain-colour surfaces rather than visible triangles, a custom lighting system, fog, vistas and foreground silhouettes, and a distinct palette per chapter. In our levels that means:
  - **Light and shadow that read**: a key light high at the side, so tops are bright and the faces toward the eye fall into shade. Cast shadows a deep tint of the place (`shade_tint`; lilac at dawn), on the rock too (`shadow_k` about 0.8). Pale shadows make a place flat.
  - **Big plain surfaces**: no surface noise on the rock (`rich_k` 0): each face one even, clean tone. Beds, lichen and speckle read as "something strange" to the user. Keep the marble's veins faint (about 0.25).
  - **Foreground silhouettes**: dark, soft-edged shapes before the eye at the frame's corners (rocks at the lower corners, a branch above), tinted toward the place's shade (`modulate`), never over the way or the threshold. Add a soft darkening at the edges.
  - **Fog and vistas**: the hazy backdrop, paler the farther.
  - **Life**: motes of light drifting slowly (`CPUParticles3D`, additive glow, world space), a few far birds paled by the haze (a V mesh whose wings beat now and then in the vertex shader), a ripple now and then in the open water (`_ivw_life`).
  - **Review in motion**, not by stills alone. Record a 540x960 run (`--write-movie`) and lay it out in sheets of frames every half second (`tools/go/sheets.py`: ffmpeg at 2 fps, six to a row, the time on each), then read them. That found:
    - the eye jumping out and back at the first tap;
    - the line written over the title;
    - the statue's image as a pale blot while the eye was close;
    - the gate hiding her at the end;
    - the ring's glow cut by the gate's pillars.
  - **The ring is set whole before a gate, never in its opening**: the opening is narrower than its glow, and the gate's depth hides her from the eye.
  - **The way's line stops at the ring's rim** (`_ivr_way`): a line running into the ring "looks ugly".
  - **The gate holds light** (`_ivw_gate_light`): a soft warm light fills its opening, brightest low in the middle and stirring. Around it: a glow, its light lying on the stone before it, motes rising.
  - **The end: she goes into the light** (`_ivw_exit`; the user: "she steps into the gate, a flash comes, and she is lost in the light"): from the ring she walks slowly into the gate's doorway as its light grows, warming as she nears it (`iv_lux` in her shader; kept low, or she is white in white and gone before the flash). In it the gate's light alone bursts (`_ivw_flash`: a white core in the doorway and a bloom about it; never the whole screen, the user: "only the door, more strongly"), and she is gone in sparks from the head down (`iv_gone`, `iv_gone_y`), motes of light rising where she stood (`_ivw_motes`). Then the fade and the level's last line.
- **The story's lines follow the script** (`eidolon-world/dev/EIDOLON_SCRIPT.md`, read it before writing any line; the user: "you play one of the statues Theron carved trying to make Ione's face again, don't you remember the script?"). The player is not Ione: she is one of the statues Theron carved from outside after the sea took Ione, given life by the goddess (the image of Ione as he wanted her). Ione's own soul has no face: the sea floor kept it, the dead are known by their faces, so she cannot pass over until she sees it again in still water. The waking's lines (`gowake/puzzle.json`): as she wakes, `lines` "Theron went looking for her face in stone. / A thousand times he carved it, / and a thousand times it was not hers." (the user: it must say that he tried to find her face again and make it; "clear, but a little more poetic"); as the stones come up, `mid` "Her own face lies at the bottom of the sea. / To pass over, she must see it once more."; as she goes into the gate's light, `end` "One of the thousand went to find her." The last line comes as she goes into the light and stays about six seconds (the user: it went too fast); then the picture goes down into the film's dark and EIDOLON comes over it, alone (`_ivw_end_screen`; the user called the "tap to ..." words stupid: none, but the film's own "tap to skip", which the user asked for). An earlier try that made the player Ione ("the sea gave her back, as stone") was wrong.
- **A swipe made while she moves is kept** (`ivg_queued`, `_ivg_queue_tick`; the user: "a swipe while she is still moving counts as the next move", "up to one"): one move only, the last swipe made, done as soon as her whole turn is over (walk, settle, the statue's step: `ivg_turning`), read from where she then stands; dropped if she falls. Test: `IV_TEST_QUEUE=1` swipes the first two moves at once.
- **The story's letter**: Cormorant Garamond italic (`fonts/`, OFL; semibold over the picture, medium for small lines), deep plum with a soft light about it (`_ivw_font`, `_ivw_text_style`). Read raw as a FontFile, so the web pack keeps the `.ttf` (include filter).
- **The rocks before the eye at the lower corners are low-poly rocks** (`gowake/rock_bl_lp.png`, `rock_br_lp.png`; the user: "low poly rocks, not just shapes", "a little blurred", "darker", "darker still"): made by the level's own boulder builder (`boulder` from `tools/ivory_level.py`, gathered as its ledges: the greatest at the corner, lesser ones about it), seen from the game's eye, dark plum (halved), softened by a 5 px blur on premultiplied alpha. Invented shapes failed: pebble-like lumps, and pillars ("what is this"); the user wants them to "remind of the map's rocks".
- **The start of the game** (`_ivw_menu_make`, `_ivw_intro`, `_ivw_play`):
  - **The intro film first**: the amphora film, graded into the first level's dawn by a 3D LUT (`tools/intro_grade_lut.py`).
    - Its background, the light at the top corners behind the vase, is then repainted with the first level's sky, lilac-pink down to peach (`tools/intro_peach_bg.py`).
    - That region is the same in every frame. Each pixel moves by how much of the old background is in it, so the vase's edge keeps no fringe. The LUT carries each key colour of the black-figure palette to the dawn's: clay to rose-peach, the black to deep plum, the sea to muted violet, the sky to lilac, the white to pearl. Everything between moves with its nearest keys (Gaussian weights in Lab), so the shading holds.
    - The film's own fades (to a light blue) are moved to the start screen's soft dawn, the same five stops as the start screen's gradient (`tools/intro_refade.py`): each faded frame by how far it is faded. It opens on, and closes into, the pure gradient, so it meets the start screen without a seam (the user: "a softer gradient, like the first level").
    - **The game draws it itself** (the owner: "the film inside Godot", the Theora video at 1.1 Mb/s was too poor). `tools/intro_vase_bake.py` takes vase.py's own pieces (its sources in the scratch `gem/v`) into `intro/vase/`: the timeline (`film.json`, 24 a second: the turn, the scene in front, the fade, the page, each line's ink), the aged ornament bands for the five places round the vase (`strip0-4.jpg`), each scene's first and last picture in its frame (`pan{i}a/b.jpg`) and its clip played once and slowed to rest (`clip{i}.ogv`, 864x864 Theora, about 24 MB in all), the words of each card (`text{i}.png`), the dawn grade (`lut.png`). `intro/vase/vase.gdshader` does vase.py's per-pixel work: the surface of revolution tilted 9 degrees, the five places of 72 degrees, the panel, the words with their ink, the flat facets' light, the LUT, the first level's sky behind, the plum fades. `_ivf_apply` in ch1.gd feeds it from the timeline; the scene in front plays in a hidden `VideoStreamPlayer` from 0.9 s after it has come round. Its sound (`intro/intro_audio.ogg`) follows the film's clock. `IVF_AT=<seconds>` starts it there, to look at one moment.
    - The autoplay skips it unless `IV_INTRO=1`; `IV_NO_INTRO=1` skips it always.
  - **Then the start screen**, in the end screen's colours (the user liked them): the film's plum dark (`#211421`), the name and PLAY in pale cream, and behind them, subdued, the veiled statue of the sea (the level's own `props/observer_veiled.glb`, rendered alone from the front in Blender, sunk into the plum at about a third of its contrast, its foot fading into the dark: `ui/start_statue.jpg`). PLAY breathes slowly. (Before: the faded level under the dawn gradient, the name in black.)
    - The film opens on and closes into the same plum (`tools/intro_refade.py <in> <out> "#211421"`, from `intro_theme_720.mp4`), so the begin screen, the film and the start screen meet without a seam.
    - **The music runs on without a seam** (the user: "the music from the film into the first level, seamless"): the film's own score (not the game's theme) fades out in its last seconds; the theme comes in under it 8 s before the film's end (at 6 s a breath of silence was left after the last spoken line) (`IVW_THEME_AT`, from `_ivw_tick` on the film's position), and is never begun again at the start screen. PLAY hands it to the level's piece over 5 s. A film skipped by a tap starts the theme at once.
    - The level is not drawn while the film covers it (`get_viewport().disable_3d` during the film): a phone's battery, and a recording of the film runs at about 18 frames a second here instead of one.
    - The film begins by itself, in a browser too. A touch on it shows "tap to skip" (small, cream, in the dark between its words and its border) for about 2.5 s; a second touch while it shows skips (`_ivw_skip_tap`; `IV_TEST_SKIP=1` checks it in a recording). A phone's browser can deliver one touch twice (as itself and again as an emulated touch from the mouse it stands in for, `device == -1`): `_unhandled_input` drops an emulated touch within 1.5 s of a real one, and the skip wants 0.35 s between its two touches. Before this, a first touch on a plum screen started the film, whose opening is the same plum, so a second touch "to make it go" skipped it.
    - The film's sound is a player of its own (`intro/intro_audio.ogg`; the `.ogv` holds the picture alone), held to the picture every 0.5 s (`_ivw_film_sync_tick`): a browser holds all sound back until the first touch, and then the sound must come in where the picture is. Once it runs it stays about 0.15 s behind and is never moved again.
    - To record the film too: `IV_INTRO=1` with `-- godemo` (the autoplay lets it run to its end and holds the name 4 s before PLAY).
    - The eye holds the whole level here. PLAY takes the eye down to her where she lies (`ivw_close` 0 to 1), and only then does she wake.
  - **The logo**: from the image model, a very thin wordmark, black on white. The user chose the ultra-thin geometric one, with a hairline and a small diamond under it (`design/logo/`, its prompts beside it). Have the model set PLAY in the same typeface, with the logo as its reference.
    - Key both to alpha (alpha from darkness, crop, resize; `ui/logo.png`, `ui/play.png`), so the game can colour them.
    - Check the spelling of every variant: one wrote a word that was never asked for under the name.
  - **Music** (`music/`, `_ivw_music`): made with the music model (`lyria-3.5`, the intro's own `eidolon-world/dev/intro/amphora/tools/genmus.py <prompt> <out>`) from written descriptions (`design/music/`).
    - **Never piano**, and nothing that could sound cheerful. The user found the first, piano-led pieces "almost happy" and wants the field music of a dark fantasy game ("more like Elden Ring in game").
    - Ask for: dark, sorrowful, solemn, grand orchestral music; solo cello and violin in long mournful phrases; a harp; low strings; deep horns; a distant wordless choir hum; at most one or two soft timpani rolls; a dark minor or Phrygian mode; a vast reverberant space.
    - A wordless female voice comes in only at a few moments, as in the intro.
    - Give a line of the form for each stretch of the piece.
    - Never name an artist or a game. A request can be blocked as "recitation": reword the description and try again.
    - What the user liked most: the lament (`design/music/prompt_lament.txt`). A solo cello over a low drone, the strings and a harp joining, the wordless female voice once before the climax and once softly at the end, one great climax (full strings, horns, trombones, choir "ah", timpani rolls), falling back into silence, unresolved. Variations on it are in `design/music/prompt_l*.txt`.
    - Loudness-normalize to -18 LUFS, encode to Ogg Vorbis, and set `loop=true` in the `.import`.
    - The theme plays under the start screen. PLAY crossfades into the level's piece, quieter (-5 dB), which loops; it fades out at the end.
    - Each level has its own piece (`_go_level_music`): the waking the lament, the drowned sanctuary the requiem, the moon the elegy, the quarry the stone, any other the last light. The other levels start theirs at the first tap.
    - Check the recording (`--write-movie` takes the sound too): measure it with ebur128 (about -24 LUFS in the game).
  - **Sounds** (`sfx/`, `_ivw_sfx`): melodic cues cut from the music model's pieces (`design/sfx/`: the prompts and the table of cuts). The user turned down a first set and asked for sadder ones.
    - The model returns about 60 s of music whatever is asked: it ignores silences, keys and named notes. Cut the cue out of a take, then retune it (ffmpeg `rubberband`, pitch only; a voice with `formant=preserved`) onto the notes the lament shares with its D-minor turns (A C D E F G). A cue meets the music wherever the player is, so it must not hold B or Bb.
    - Where: PLAY a low E-minor note; each story line a woman's sigh F-E-D-C-D (not the last line); the stones a swell; the gate's sound peaks on the flash (`IVW_GATE_PEAK` 1.15 s after it starts, timed from her walk into the doorway, `IVW_GATE_WALK_EXTRA` for her start and stop); a blocked swipe a soft low pluck.
    - No bus of its own and no dip under the cues: a bus made while the game runs left a phone's browser silent in the level. So a cue must be about as loud as the music to be heard (by ebur128 beside it): 5-10 LU under it, the owner heard none of them on an Android phone.
    - Real sounds beside the cues (`tools/sfx_real.py`, from CC0 recordings: `design/sfx/README.md`): her steps at each footfall of the walk clip (`IVW_STEP_AT`: where in the clip each heel comes down, measured on the model by sampling the foot bones), a stone's water and foam as each breaks the sea, the winch's ratchet laid on its turn (a click per tooth, slow-quick-slow as the tween eases) and a clank as it holds, the gate's light with its swell on the flash. Lift each sound's presence (2-4 kHz): a phone's speaker plays little under 300 Hz, and a step's thud or a splash's plunge is lost there.
    - `#sfxtest` after the page's address (or `IV_SFXTEST=1`) plays every sound in turn, every 3 s, with its name on the screen: a check on the owner's own phone. It turns the 3D off: a browser on the software renderer draws the level at one frame in ten seconds.
    - Show a set before wiring it: lay the cues on a recorded level video at the moments the game will play them, so the user hears them in place.
    - `IV_SFX_LOG=1` in a headless run (`--headless --fixed-fps 30 -- godemo`) logs each sound's moment and the flash in the game's own time, in about a minute.
  - **Mist held to the world** (`mist_world` in IV_SH): what fades into the mist samples the painting as the sea does (`world_uv`), not by its place on the screen. Otherwise an eye moved off the level's own frame (the close-up at the waking) shows faded images in the water as pale blots.
- **The words** (titles and the lines of the story): at the waking, and wherever the ground is light, black letters with no shadow at all (the user: "take those stupid shadows away, better black"), as the start screen has them. On a dark ground (the night of the moon level) they stay white, with a soft black shadow all round made of the old haze in thin black outline steps. Never an offset shadow, a warm glow, or a red rule or lozenge over them.
- **Check what the eye sees of a thing before blaming the renderer**: a chain laid "up the screen" from a winch hid wholly behind its drum. Paint the thing plain red with an unshaded material to see where it is, and route it on the eye's side.
- **A hero prop from an image** (the Observer, a colossal veiled bust): paint it alone on a plain background, `tripo make <png> --for game-mobile` (it returns FBX), then decimate to about 7k triangles with flat faces and export GLB to `props/` (`tools/go/fbx2glb.py`). Keep the FBX: decimate again from it, never from a decimated GLB. Place it by its foot, height and turn, give it a palette of its own and haze, clip it at the water, and mirror it.
- **Rendering is slow** (about 1.5 s a frame at 720x1280 on the software renderer): iterate at 540x960; capture moments with your own snapshot hooks (`IVW_SNAPS`); skip the clean-frame wait (`IV_CLEAN`) when the line does not matter.
- **Corner overlays** (pine, leaves): have the image model paint them on flat magenta, then key them out.
  - The key is the magenta-ness, `min(R, B) − G`. Despill with the key's alpha, then fade with a separate mask, and fade out before anything the model bled in below.
  - Run `godot --headless --path . --import` before the game can `load()` a new PNG.

## 1. The plan: square on a grid, from the picture

- **Calibrate the eye on the picture.** Orthographic, yaw 45°, pitch 35°, pixels per metre, and the origin pixel at height 0. `tools/ivory/trace.py` has `at(px, py, h)` to turn a picture point at a height into a world point.
- **Lay the level square on the plan's axes in world metres** (`DESIGN` in `trace.py`).
  - Floors are rectangles or Ls, at the heights the picture shows.
  - Each flight runs straight from one floor's edge to the next, across its whole breadth, with the number of steps counted on the picture.
  - Hand-traced outlines come out on a slant, and the user calls them "crooked".
- **Things stand on floors, never over an edge**: columns, arches, trees and props. Leave about 0.45 m between nodes and floor edges or things.
- **Ledges ("rocks")** are rock without marble that binds the floors into one mountain. Each is `[centre, radius, top]`.

## 2. The build (Blender, `tools/ivory_level.py`)

`python3.11 -I tools/ivory_level.py -- <out.glb> <out.json> <seed> <ao samples> <plan.json>`, then `godot --headless --path . --import`.

- **Slabs**: about 0.46 m thick, cut as a mason cuts them (the user: "corners as if carved, cut off").
  - Every corner that stands out is cut off aslant, each cut its own size (0.14–0.3 m), not quite square to the corner.
  - The top edge is a broad chamfer (0.09–0.17 m) whose breadth wanders along the edge; it dies away before a flight.
  - The outline runs in a few flat lengths (0.5–0.95 m), each turned a little its own way, so each face takes the light differently.
  - Pieces hang lower under the edge here and there; chips take the edge only, never the top, which is dead level.
  - Fill the top with `bmesh.ops.triangle_fill`, never an inner ring (it folds at notches) or `EAR_CLIP` (it bridges an L's notch when the face runs the other way). The builder reports any cap triangle outside its outline: it must report none.
  - Where a flight meets a floor, the edge runs square across it (`square_to_flights`), with no chamfer and no chip.
- **Flights**: one piece of marble each (the user: separate step blocks look like "separate pieces"; they want the stair whole), carved by hand and slightly uneven, the flight itself straight and square on the grid.
  - Each step a little higher or lower (±1 cm) and deeper or shallower (±1.6 cm), all still summing to the flight; each tread a few mm out of level; each nosing rounded its own way (bevel 0.016–0.03 m, 2 segments). The sides stay clean and continuous.
  - A channel cut down the middle (0.07 m wide, 0.03 m deep) through every nosing and riser: the profile shifted in and down by its depth. The way is drawn in it by the steps as cut (`flights[i][4]` and `stair_groove` in the level's JSON).
  - The last step is flush with the floor above and runs on under it. Under the steps, the flight's body: a deep white band (0.42 m).
  - The last tread sits a few mm under the floor and runs on under it. Coplanar faces z-fight into grey hatching.
  - The rock under a flight is flush with its sides: the stair continues the rock.
- **The marble is in thick chunks set into the brown rock** (the user: "the white parts are thicker chunks bound inside the brown stone").
  - Under a slab the rock is mostly flush with its side: white above, brown below, no recess (a recess makes a floating table).
  - Here and there a broad block of rock beside the floor, its top 0.1–0.3 m under the floor's, most often on the sides the eye sees.
  - Beside each flight, chunks of rock (as broad as long, never planks) stepping up with it; a deep white band under its steps.
- **Rock under a floor** (`blocks`): soft low-poly, as the picture's.
  - A few broad blocks along each edge (1.6–2.8 m), each turned its own way (up to ±20°), so each takes the light its own way. Pieces stop where a flight's end or a hanging thing begins; they are never dropped whole.
  - Some are set back under the slab (a dark recess beneath it); some stand out a step lower with a lit top (ledges), their faces leaning back above the step.
  - Every block steps out partway down: never one straight pillar. Rows of upright prisms read as organ pipes, which the user hates.
  - Every edge is eased in two facets (bevel, 2 segments): soft, not sharp. Outer corners are cut off.
  - A core of rock behind them all.
- **Ledges** are clusters of soft boulders: a few broad faces, a top leaning one way, a side or a corner cut off, the top smaller than the body.
- **Small things set in the rock** (the relief stone) are placed by a ray cast onto the face the eye sees, half sunk in it.
- **Props**:
  - Cut by hand, never perfect: a block's faces a little uneven, its edges eased unevenly, chips, ornament **cut in**.
  - Trees are simple carved-stone shapes in the level's colours.
- **Baked into the vertex colours**: AO into R, and **each rock's depth under the floor it bears** into G. The mist uses G.

## 3. The look (`IV_SH` in `ch1.gd`)

- **Palettes are sampled from the picture**, each as 4 tones: top, lit, mid, dark.
  - Measure hue and saturation, not only value.
  - Rock is **brown**, not grey: about h 20–28°, s 0.3–0.4.
- **Light is simple and sharp**: one tone per face, crisp edges between faces (the user: "the light in the original is much simpler and sharper").
  - A face-normal ramp with narrow smoothsteps; only the level's one sun (filter the other lights in `light()`); MSAA 4x.
  - No AO, no darkening, no veil, no mist noise and no cast shadow on rock: soft shadows and wisps read as smudges (the user: "lit strangely, like smudges"). Shadows stay on the marble floors (her shadow, the cube's).
- **The bottom dissolves into mist, in one smooth fade.** The user has said it a hundred times.
  - Every rock fades under **its own** floor, by its depth under the slab (vertex colour G): one clean smoothstep from about 0.5 m down over about 1.9 m. Measure the fade on the picture (a column of pixels down a dark face) and match it.
  - Fog colour is the sky gradient at that height on the screen. Hide sea-world vignettes, rays and any screen vignette: the picture's sky and mist are clear to the edges.
  - Keep the sun's glow on the sky warm; a bright glow clips to green-yellow.
- **Palettes are sampled per thing from the picture** (the fallen face near white with grey-brown shade, the cypress a khaki olive, the far rock warm once the haze is over it), and checked with `vstats.py`.
- **The far off is shapes and gradation, not detail.**
  - Place each far thing where the picture has it: a pixel of the picture at a depth, `P(X, Y, depth)`.
  - Flat silhouettes (`sil`), no shadows on them, each band paler with distance, each fading into the mist from its top down.
  - Far rock as towers (upright walls, a step partway, a broken top) or broad soft hills deep in the haze; a row of columns on one sloped ridge, never a table or a row of pillars.
  - Leave open mist between groups: the picture has more air than things.
- **The heroine (Ione)**:
  - She is the owner's own design (a marble woman in spiral terracotta bands; `design/ione5/ione_new_vs_design.jpg`). Make her again only from that design, never from a new concept.
  - The model: the generator's multiview from four T-pose views of the design (front, left, back, right), with `smart_low_poly=true`, `face_limit=16000` (v3.1). The owner chose it over the P1 low-poly model (crisper bands, but a round blob of a head) and the default (soft tube bands).
    - `tripo generate multiview-to-model front.png left.png back.png right.png --model tripo-v3.1 -p smart_low_poly=true -p face_limit=16000`. The `-p` values go to the server unchecked and are charged even when absurd: a test with `face_limit=1` ran and cost 30 credits. Check with `tripo make ... --dry-run` first.
    - Then `tripo anim rig <task> --spec mixamo --rig-type biped`, `tripo anim retarget <rig task> --animation preset:idle preset:walk --animate-in-place`, `tools/ione4_tex.py` (the data picture), `tools/ione4_build.py` (her clips, her weights, three weights of mesh).
  - The hero shader's level branch: smooth normals, two ramps (skin and cloth) in the picture's colours, the level's sun only.
    - As the design draws her, the low-poly cut must show: the facets and fold ridges of the data picture's R (`iv_tone_c` 1.0 on the cloth, `iv_tone_m` 0.55 on the marble) and a shade under each band's edge from its B (`iv_ao_c` 0.56). Without them the bands melt into one plain red robe.
  - No grain, no extra lights, or her white burns out.

- **The mist is what lies behind.** Its colour at each point of the screen is the backdrop there (the sky above the horizon, the sea's own colour below it), so whatever goes into it is gone without an edge. Never let a far thing end on a line (the sea's edge, a box's bottom): the user sees "stones floating", "cut abruptly".
- **Far things**: rock that is solid under whatever stands on it (columns, a statue) and fades only further down (from about 40% of its height); never a box or a colonnade hanging in the haze. Compose them as the concept does (one great mass in the middle, a tall stack beside it, smaller ones, paler layers behind), not scattered.
- **A level at sea** (the eye has no perspective):
  - A sea without end would climb the whole screen. The sea is a sheet whose far edge is a straight line across the screen at the concept's horizon; the sky shows above it.
  - Far things stand just behind the level (in this eye "far" is only paler, never smaller), each set by its top in the concept and by where it has wholly gone into the mist; below that the sea lies in front of it, and no edge shows.
  - Mist is a band by height just over the water, not by depth under each floor; the sea's own colour lies between the haze far off and the mist below.
  - Nothing under the water is drawn. The surface lets a little through (alpha 0.7) over a deep floor of the same colours, and what stands in the water has its image there: a copy turned over about the sea level, shaded with its own faces' light, dimming as it goes down (`_ivs_mirror`).
  - A great thing in the water (the colossal face) is solid, with its own light and shade, a shadow and its image in the water; the user did not want it faded.
  - A sky with four stops (high, a warm band at the horizon, the haze under it, the mist at the bottom), and a low sun drawn on it.
- **A level in the snow at night** (`gomoon/`):
  - Snow is the top tone of everything outside, rock included.
  - Each floor's edge carries a soft roll of snow (`snow_lip` in the builder, scene `moon`), with its own palette: white, its shade a soft blue.
    - It stands a little proud of the top, rolls over the chamfer, and hangs lower here and there.
    - It dies away where a flight meets the floor.
  - Every warm tint must turn cool: the close corners' darkening (`ao_tint`), the marble's veins (`vein_tint`), and the cast shadow (`shade_tint`). A warm tint greys the snow.
  - The moon is a disc on the sky shader (`moon_k`, `moon_r`, at `sun`), with soft seas and a halo.
  - Far peaks are faceted pyramids (`_ivm_peak`), broader than high, their lit sides snow and their shaded sides blue. Each fades from about 40% of its height.
  - Fire on snow is never added: added light burns white on a bright ground.
    - The flame is an upright billboard (fixed Y) in `blend_mix`.
    - Its glow and its pool of light on the floor are drawn over the snow, golden.
  - Snow falls in two layers of `CPUParticles2D` on the overlay canvas: near flakes larger and slower, far ones small.
  - Value classes: the concept's are about 11/20/32/25/12. A first pass has too much mid (sky and mist), so darken the rock and the top of the sky and brighten the snow.

## 4. The puzzle: Lara Croft GO rules, proven before it is built

- **Turn-based on a node graph.** One swipe is one step; then the world takes its turn.
  - A move that cannot be made costs no turn.
  - Death means a quick restart.
  - Every rule must be readable on screen.
- **Vocabulary** (combine, invent, keep each rule one sentence):
  - **watcher**: strikes whoever ends a step on the node it watches; breaks when stepped on from the side.
  - **gazer**: looks along a line until a stone or another face stands in the way; whoever ends a step in its look is struck; walked into from beside or behind, it breaks, and its plinth stays.
  - **wanderer**: paces a route one step per turn; caught from the front, broken from behind; watchers strike it too.
  - **stone**: pushed one node straight on along level ways, never onto a plinth or the ring; blocks wanderers and stops a gazer's look (behind it is shade, so it can be pushed ahead as a shield).
  - **lever**: turned from beside it, it turns watchers, raises a stair, and so on.
  - **exit ring**.
- **Write the solver first**, a Python breadth-first search over the full state (`tools/ivory/puzzle_design.py` → `<level>/puzzle.json`; for a level of its own, `tools/go/first_trial.py`: a generator, boards laid by hand in `HAND`, and `--hand` to prove them).
  - Good first trials are laid by hand around one clear idea and proven by the search; random boards are mostly unsolvable or too short.
  - Draw it before building it: `tools/go/draw_trial.py <design> <out.png> <step>:<caption> ...` shows the board and key moments of its solution side by side.
  - Aim for a solution of 14–30 swipes (a first level about 15), unique at its length, with no dead ends (states from which the ring cannot be reached; list them and remove their cause, e.g. a face's plinth stays when it breaks and the stone is never pushed onto it) and a forced order.
  - Give it 2–4 insights, each provable: the solution must get longer without that element.
  - Check node margins and clearances, and that the edges leaving a node differ on screen by 50° or more.
  - Write the solution and its state trace into the JSON.
- **The game mirrors the solver's `step()` one to one** (`_ivg_turn` and `_ivg_w_step`).
  - **Swipe**: a drag of more than 26 px picks the neighbour nearest in screen direction, within 50°.
  - **Tap**: a tap on a neighbour is a step there.
- **Autoplay** plays the solution as real swipes and snaps every step.
  - The log's `IV step` lines must equal the solver's trace.
  - Then record a video: `--write-movie`, then ffmpeg to mp4.

- **New things in the game's trial** (as `tools/go/trials.py` proves them; `goquarry/puzzle.json`):
  - Faces that look a way (`dirs`) rather than at a node, along the board's ways (`grid`: E, S, W, N in the world), over chasms (`gaps`).
  - Bronze mirrors (`mirrors`) turn a look a quarter, and a swipe into one turns it.
  - `faces_break`: a face that another face's look reaches breaks (`_ivg_settle`, after each move of hers).
  - A trial may have no stone (`block: ""`), and its dial may be a capstan.
  - A mirror at 45° is seen edge on by this eye in one of its two states, so a bronze bar on its floor shows the way it turns a look.

## 5. Review loop (before showing anything)

- Render a clean frame: `tools/ivory/render.sh <dir>` (`RES=1080x1920 TMO=1700` for a large one; `IV_DBG=4` shows how much mist each pixel has).
  - A 720×1280 frame takes 5–6 minutes on the software renderer, so use `TMO` 700 or more.
  - Run one Godot at a time: there are 4 cores.
- Compare large side-by-sides of top and bottom with the concept (`pair.py`), and the same region of both enlarged (`zoom.py <concept> <render> <out> x0 y0 x1 y1`). Also run `overlay.py`, and `vstats.py` (value classes; the concept's are about 25/28/17/16/14).
- Zoom on every junction: stairs to floors, the feet of columns and arches, rock corners, the mist line, the far shapes, the heroine.
- Drive every motion by the game's own time (`iv_t`, shader `TIME`), never the wall clock (`Time.get_ticks_msec`): a recording takes a second or more of wall time for each frame it shows, so the gate's cloth and the birds' bob, driven by the wall clock, moved about thirty times too fast in the video ("the cloth and the birds move far too fast").
- Hunt for these faults and fix each one:
  - crooked or slanted edges;
  - floating things or overhangs;
  - hatching;
  - striations;
  - grey rock;
  - fog cutting off sharply;
  - detailed backgrounds;
  - things too pale or too flat.
- Do **at least 10 passes**. Then send one full frame with a one-line Greek caption, and later a video. Reply in Greek, short.
- **Smooth on a phone** (a catch in the picture is a fault like any other):
  - Make one shader per kind of effect, never `Shader.new()` per instance. A phone's browser builds a shader when it
    is first drawn and stops the picture while it builds.
  - Draw each kind once behind a still screen (`_ivw_warm`). Keep alive one material of each `StandardMaterial3D`
    kind: the engine frees a kind's shader when its last user goes.
  - Keep sound streams loaded and ready them on the web (`_ivw_sounds_ready`).
  - Pose and animate nothing hidden.
  - Check with `FLIP=<level> IV_HITCH=1 godot --headless ... -- godemo`: frame work under ~2 ms here.

## 6. Commit

- Stage, then run `python3 <scratchpad>/keyscan.py`. It must print `clean`, because API keys must never be committed.
- No model names anywhere but the trailer.
- Push to the session branch; the draft PR is open.
