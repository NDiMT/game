# Project memory: EIDOLON (and how the owner works)

Read this first in every session. The deep method for levels, looks, the heroine, the intro and the music is the
project skill `.claude/skills/go-level/SKILL.md`: load it for any work on the game.

## Working with the owner
- Reply in **Greek**, short, direct, actionable. The owner judges by **images and videos**: show the result (a
  contact sheet, a short clip, a before/after), not a description of it.
- Do exactly what was asked. **Never change what was not asked for**: the heroine was once turned to a profile so
  her pose would read, and the owner answered "you turned her and I didn't tell you to". When a change of staging
  or design would help, ask first.
- When the owner names a side ("the right arm"), it may be the side **of the picture**, not hers. Check both.
- Videos only when asked; short check clips of the thing being fixed are fine.
- Game text is English. Controls are swipes. The title is plain "EIDOLON".
- Commit and push at the end of every turn (see Git below).

## Security (always)
- API keys live outside the repo (`~/.config/eidolon/`, `~/.tripo/`). Never print, log or commit them; never open
  the curl config files. Filter tool output with `grep -v -iE "key|token|secret|auth"`.
- Before every commit, after `git add`: `python3 eidolon-demo/tools/keyscan.py` must print `clean`.
- Do not add new scripts that call paid APIs to the repo without the owner's OK. Use the copies in
  `eidolon-world/dev/intro/amphora/tools/` (`gen.py` images, `genvid.py` video, `genmus.py` music, `gentts.py`
  voice); run them from a scratch directory.
- Never put the owner's email or personal details in anything sent outside.

## The game (state on 17/11/2026)
- Godot 4.5.1, Compatibility renderer. `eidolon-demo/`: `main.gd` (engine), `ch1.gd` (the chapter and the GO levels:
  Lara-Croft-GO-like, turn-based, swipes). Levels: `FLIP=gowake` (1, The Waking), `goveil` (2, The Veiled), `gosea`
  (the Drowned Sanctuary), `gomoon`, `goquarry`. Autoplay: `-- godemo`.
- **Level 1, The Waking**: intro film (the amphora; the Theme under the narrator; drawn by Godot itself, not a video:
  the owner found the video poor; see the skill) → start screen (faded level, black thin EIDOLON logo and PLAY, the Theme) → PLAY → the Lament. Ione
  kneels facing her way, both hands on the front knee, back and head bowed; after a second of stone stillness she
  rises in moments (8 s clip: breath, hands to the knee, weight forward, push, lunge, step, back up, head last).
  She turns the winch; the stones come up out of the water with foam on the water and on them; she climbs to the
  glowing gate, steps into its light, and is lost in it in a flash (the gate alone lights) and rising motes; a
  moment's hold, then the light fills the picture and level 2 begins in it (`_ivw_to_veil`: the scene reloads with
  `Engine` meta `ivw_next`; `IV_ONE=1` stops after level 1). The dark end screen (EIDOLON alone: no "tap to ..." words,
  the owner, but the film's "tap to skip") comes after level 2 (the owner, 18/11: "after level 1"). **The story is in
  `eidolon-world/dev/EIDOLON_SCRIPT.md`: read it before writing any line.** The player is one of the statues Theron
  carved to make Ione's face again (not Ione). **One line only, at the start of each level; nothing in its middle,
  nothing at its end** (the owner, 18/11). Short and clipped ("πιο κοφτά"), the levels telling the story in turn:
  level 1 "Theron searched for her / long after hope was gone." (the owner: "Theron attempted to find her", a little
  more beautiful); level 2 "He tried to find her face again, / so he carved a thousand statues, / but none was her." (the owner's own
  words, 18/11; three lines, each within a phone's width: a line wider than about 0.85 of it runs off the screen). Letter: the
  Cormorant Garamond upright (`fonts/CormorantGaramond-Variable.ttf`, weight 520, 47 px at 720 wide), high in the sky,
  its lines coming one after the other, each rising a little (`_ivw_story_write`; the owner chose it of three, 18/11).
- **The film's textures** (`intro/vase/`): three texture arrays (`strips.jpg`, `pans.jpg`, `texts.png`, sliced in
  their `.import`), the vase and the words at the film's full size. A phone gives a canvas shader 16 textures, and
  Godot takes three of them plus the six highest units for itself. With one texture per piece (17 sampled) the film
  was not drawn at all on phones, while a desktop browser (32) showed it. Keep any canvas shader to 8 textures or fewer.
  On a phone taller than 16:9 the film fills the height, enlarged up to 1.22 so the scenes' frames still show. Fitted to
  the width, the bands were drawn out in streaks above and below.
- **The Observer** (the veiled colossus in the sea at the waking) is smooth marble softly lit, as the concepts paint
  statues (the owner, 18/11: "smoother and better lit"): `smooth_k` 4, its own light from the front left (`form_key`;
  never `key_dir`, which `light()` uses to keep the sun), shade baked into its folds (`tools/go/bake_ao.py`).
- **Backdrops in one piece, without a horizon** (the owner, 18/11: "no horizon line", "in general, backdrops in one
  piece, without a horizon"): the line is taken out of the painting by an edit in Gemini (`gen.py` with the painting as
  its reference and "keep everything exactly as it is, change only one thing: there must be no horizon line ... the
  statues stay whole, bases included"); done on all three levels' backdrops. A mist laid over the band by code was
  turned down: it ate the far statues' bases ("the base of the statues is missing"). In the game the water's glints and
  small waves come in slowly over 0.22 of the screen below the haze (`far_w` in `IV_SEA_SH`), so no line marks where the
  sea begins.
- **Start screen**: plum dark, cream EIDOLON and PLAY, a subdued veiled statue behind (`ui/start_statue.jpg`); the
  film opens and closes in the same plum. **For the tests** (the owner, 19/11: "while we test it, a choice at the start
  of which level I begin from"): under PLAY, "level" and the numbers 1 2 3 in the story's letter; 1 is PLAY, 2 and 3 go
  through a warm white straight into that level (`_ivw_jump`, as a gate leads on); a touch anywhere else is PLAY.
  `IVW_LEVEL_PICK` false takes them away for the game itself. `IV_TEST_PICK=<n>` makes the autoplay touch one.
- **Play it in a browser**: https://ndimt.github.io/game/eidolon-waking/ (the owner OK'd publishing there). **Upload
  each new build there without asking** (the owner, 19/11: "don't ask me every time, upload it"); check it in a headless
  browser first (every level it can reach), and say it is up.
- **Sounds** (`sfx/`, `_ivw_sfx`): **only real sound effects** (the owner, 18/11: "cut the melodic sounds, only normal
  sound effects"). The Lyria cues (a note at PLAY, a sigh on each story line, a swell for the stones, the gate's rise, a
  pluck for a swipe where she cannot go) are no longer played and are left out of the builds (the presets' exclude
  filter); their files and notes stay in `sfx/` and `design/sfx/README.md`. The real sounds, cut from CC0 recordings
  (`tools/sfx_real.py`, sources and levels in the README): a step at each footfall of her walk (`IVW_STEP_AT`, read from
  the walk clip's place), a stone's water and foam as each breaks the sea, the winch's ratchet and clank, the block
  dragged and falling, the gate's light on the flash. No audio bus made while the game runs and no dip under the sounds:
  with one, a phone's browser played nothing in the level. `IV_SFX_LOG=1` logs their moments. A phone's speaker plays
  little under 300 Hz: give a sound its presence (2-4 kHz) and judge loudness by ebur128 beside the music, not by peak
  (on an Android phone the owner heard nothing 5-10 LU under the music). `#sfxtest` after a page's address plays each
  sound in turn every 3 s with its name (`IV_SFXTEST=1` on a desktop).
- **Smoothness** (the owner, 18/11: "it catches a little, above all where the stones come up"):
  - A phone's browser builds each new shader the moment it is first drawn, and the picture stops while it builds. Make
    one `Shader` per kind of effect (`_ivw_shader`), never `Shader.new()` per effect. Draw each kind once, unseen,
    while the plum covers the level (`_ivw_warm`: at the film's end, or behind the start screen).
  - In a browser a sound is decoded whole the first time it plays, and copied whole every time it starts. Keep every
    stream (`_ivw_stream`) and make it ready at a quiet moment (`_ivw_sounds_ready`): the film's sound and the theme on
    the film's first plum, the lament and the effects under the warm-up. Let a long piece's start pass before anything
    moves.
  - Pose nothing hidden each frame. Hidden drawn figures (`fig`/`wfig` in `main.gd`) and her hidden bodies
    (`_go_bodies_rest`) cost a phone most of its frame.
  - The 3D is always at full resolution in the GO levels (the owner: "I want it in high resolution"). The engine's own
    watch (`main.gd` `_keep_smooth`) lowered it to half, without shadow detail or MSAA, when frames came late; `ch1.gd`
    turns it off for `go_demo`.
  - `IV_HITCH=1` prints long frames, and every 3 s the frame's work, draws and triangles. Script work for the waking,
    measured without a screen: 5.9 → 1.7 ms a frame.
- **A long way at one swipe** (the owner, 19/11: "on long ways it takes ages with swipes from node to node"): a swipe
  takes her on **straight** along the way while it has only one way on and nothing beside it to work (`_ivg_run_path`),
  and stops where it turns, where there is a choice, beside a stone, a mirror or the volute, at a gap, before a shut
  gate, at the gate's ring, or where her standing changes the trial (level 3: where the light would reach the ring,
  `_ivm_open_at`); one smooth walk, each node still a move. Round the corners too, at first, it walked level 1 to the
  gate at one swipe: "if she walks the whole way by herself the game has no point" (the owner). A swipe during it along
  the same way is let be; another way stops her at the next node and is done from there (`_ivg_run_keep`). Swipes:
  level 1 four, level 2 seven, level 3 eleven (a node a swipe: 9, 9, 18). The autoplay follows its solution on by the
  nodes walked (`ivg_last_run`). `IV_RUN=0`: a node a swipe.
- **The change of level after the gate** (the owner, 19/11: "a little shorter"): the motes' hold 0.6 s (was 1.6), the
  end of the vanishing 0.3 (0.8), the light filling the picture 1.0 (1.6), the next level out of it 1.2 (1.8).
- **The old island is not built in the waking's levels** (`iv_no_old`; `IV_OLD_WORLD=1` builds it): main.gd built the
  first chapter's whole world (5,409 pieces joined into 178 meshes) under every level, far off and never seen; it was
  1.5 of the 1.7 s each level took to make on the cloud machine (a phone some seconds, at the start and at each change
  of level). Now 0.16 s. `IV_HITCH=1` prints how long a level took to make.
- **The builds leave out what no level opens** (found by tracing the files a whole play opens, film included): the old
  props and their pictures, the mirrors, the old heads (`WebWake`/`AndroidWake` exclude filter), about 10 of 69 MB.
- **The camera** holds the whole map and follows her a little, smoothly and a little behind; on larger maps it goes
  with her but shows little past the edges (`_ivr_follow` in `ch1.gd`).
- **Music per level** (`_go_level_music` in `ch1.gd`): waking Lament, sanctuary Requiem, moon Elegy, quarry Stone,
  any other Last Light; the Theme under the intro and the start screen. The owner liked the Theme, the Lament and
  its four variations. Dark orchestral, never piano, a wordless female voice only at moments. The waking's levels'
  music runs on from level to level, the piece changing as it ends (the owner, 18/11): `music_radio.gd`, a node at the
  tree's root, outlives each level's scene; its `LIST` (Lament, Last Light) does not loop: at a piece's end, after a
  breath, the next begins; a level that follows another leaves it playing (`_ivw_music_on`); it fades only at the
  game's end. The list's pieces are made ready (decoded, in a browser) in the first level's warm-up and kept; the Theme
  is let go after PLAY. `IV_MUSIC_END=<s>` starts each piece that many seconds before its end, to try the changes.
- **The heroine Ione** is the owner's own design (`eidolon-demo/design/ione5/`): marble woman in spiral terracotta
  bands. Model: multiview → smart low-poly (owner's choice), rigged and built by `tools/ione4_build.py` into
  `hero_models/ione4r*.glb`. Review her clips with `tools/go/hero_look.py` (her colours, the game's eye).
- **Level 2, The Veiled** (`goveil/`, `FLIP=goveil`; built 18/11, the owner: "the second level, again a tutorial, where
  you push a box"): a marble block on a small quay at sea; a causeway of stepping stones with one stone missing; push
  the block onto the causeway's line, go round behind it, push it twice: it falls into the gap and becomes the missing
  stone; over it, up the stair, into the gate's light. Board `tools/go/push_trial.py gap` (9 swipes, unique, no dead
  end, the block needed), plan `tools/go/veil_plan.py`. `go_veil` rides the waking's sea, light, sounds and gate
  (`go_wake` is true for it too); what is the waking's own (film, menu, kneel and rise, winch) asks `not go_veil`.
  It begins by itself out of a warm light (`_ivv_begin`), she standing; its piece is Last Light; its one line "So he
  tried to find her face again, / so he carved a thousand statues, / but none was her." The hole (`holes` in the puzzle; `gaps` is the quarry's chasms): no
  walking into it; the block pushed into it falls in, its top flush with the way (`_ivv_push_in`), foam thrown out round
  it and kept round it after (the owner; its place in the shore map by `tools/go/shore_hole.py`: run it again after
  rebuilding the level), and the way's line and disc over it come up out of the water (`_ivv_way_parent`). Five statues, each different (the owner): kneeling,
  standing hand on breast, half out of an uncut block, seated, arms open (`props/statue_*.glb`: painted designs, Tripo
  P1 without texture, 40 credits each, welded and shaded by `tools/go/bake_ao.py --weld`); each model faces its own +x
  (the plan's turn sets that face toward the eye). Its backdrop is its own (`goveil/backdrop.jpg`: the golden morning,
  far veiled statues at the horizon, horizon 0.362). Concept: `design/level2/concept.jpg`. Its block is a sandier
  marble than the slabs, a little uneven, with a few discreet veins a little darker than it, its own so they go with it
  when pushed (`vein_local`; the owner, 18/11, after a grey-blue with white veins was tried in levels 2 and 3 and turned
  down: "leave it yellowish as it was, with a few discreet marble veins"); its meander cut unevenly by hand, a darker
  shade of the same stone, not terracotta (the owner) (`props/block_meander.glb`, `tools/go/block_meander.py`). In the empty sea at the bottom right, a
  rock and a smaller one beside it (the owner, 18/11), and the brown rock under the quay where she starts made stronger
  (its tops near the slab's, two more toward the eye; the owner): `rocks_after` in its plan, made after all the rest so
  nothing else of the level changes; it is built `ivory_level.py -- goveil/level.glb goveil/level.json 11 48 goveil/plan.json`, then
  `shore_hole.py goveil`. No leaves above it (the owner, 18/11). Bare branches at the top right were tried and turned
  down ("I don't like the branches, put something else, blurred"); the top right is narrow (the story's lines reach
  0.92 of the width). In their place a veiled statue stands before the eye at the lower right, blurred, dark against the
  light, one of the thousand (the owner: "fantastic, the blurred statue"; `goveil/statue_fg.png`: painted alone by Gemini
  on white, keyed, blurred into the picture (sigma 0.008 of the width), under the leaves' plum (0.55, 0.42, 0.58, 0.95);
  clear of the way, the gate and the rocks in the sea). A veil, a temple's corner and a rock ledge at the top right
  were tried first: too small there to read.
- **Both levels** (the owner, 18/11): the whole opening of each gate is white, and she stops just before it so she is
  seen until the flash. The way's line stays as it was: a pink and a neon terracotta glow were tried and turned down.
- **Level 3, The Mirror, built 18/11** (`gomilos/`, `FLIP=gomilos`; the owner: "a level 3, the script's third line, a matching map, a
  puzzle with no tutorial"): the sanctuary of Aphrodite on Milos in a pale blue and lilac sea; no busts by the way or the
  gate (the owner found them "staged"). Line (the script's next truth, the mirror): "He stole the goddess's mirror. / She
  let him." Puzzle, the owner's own rule ("the gate closed; moving the stone sends the light to the circle and the gate
  opens"): a beam of light, seen, leaves a statue (the owner: "the beam should leave from a statue, and be blocked by a
  stone"): a veiled marble woman standing in the water at the channel's lower end, a light in her hands (no plinth: the
  busts on plinths looked staged); it runs up the channel to the goddess's bronze mirror; a swipe into the mirror turns
  it; the stone and she herself (where she stands she casts a shadow) stop the light; the ring before the gate is unlit
  and the gate's door shut until the light reaches the ring (the owner: "the mirror lights the circle, which is off, and
  it lights and the door opens"), and then it stays open; the ring is entered only open. Laid on the concept's own map
  (the owner: "the same general map, the puzzle as it should be"): board `milos()` in `tools/go/light_trial.py` (18
  swipes, one way, no dead end, 60 states). The stair up beside the channel to the mirror (its only side on land) and
  turn it: the light goes onto the stone at the bridge's head; back down, over the crossing at the channel's mouth (her
  body cuts the light at its root there), up the other side; push the stone north into its niche under the highest rock;
  she stands in the light herself: one step back, the ring lights and the door opens; over the bridge over the chasm to
  the ring. The first design, `mirror_holster` in `tools/go/trials_designs.py`, made no sense to the owner. Concept
  `design/level3/concept.jpg` (the first, `concept_first.jpg`; the first concepts `concept_c/d/e` gave the rock its
  grey-blue), the light step by step `board.png`. Plan `tools/go/milos_plan.py` (asserts the plan is the solver's board).
  `go_milos` rides `go_veil` (its start, block, statues), and level 2's gate leads on into it (`_ivw_next_level`); the end
  screen comes after the last. The light (`_ivm_*` in `ch1.gd`): traced on the board as the solver has it, drawn live each
  frame and cut where her body or the stone stands; past the mirror it goes out while the mirror turns; the ring is a
  light lilac grey, unlit (`b6b1cc`; the owner: "darker", then "lighter"), until the light reaches it, then turns to the
  ochre of every level's ring (`_ivm_ring_tick`); the gate keeps its veil, its two leaves hung behind
  it swing open inward (the cloth never goes through them). The statue in the sea is still level 2's `standing` model (a
  placeholder); the sea's foam hugs her (`shore_statues` in the plan). No dark shapes before the eye here.
  **Its look, as the owner settled it (18/11, after many rounds)**: its own map and board as above ("I liked the base we
  had"), in the colours of a concept he chose (`design/level3/concept_colours.jpg`: the old map's blockout through the
  game's eye, repainted by Gemini in the colours of a concept made for a stepped redesign he did not keep,
  `tools/go/terraces_plan.py`, board `light_trial.py terraces`). Built like the other levels by `tools/ivory_level.py`
  (`-- gomilos/level.glb gomilos/level.json 731 24 gomilos/plan.json`): white slabs with chamfered, broken edges on
  slate grey-blue rock cut sharper and more aslant than the other levels' (`rock_style`), a few round white rocks like
  salt in the water (`salt_rocks`, `salt_rock()`), all coloured from the concept (`IV_MILOS_PAL`); no leaves above
  (the owner: "no blurry leaves above"), only rocks before the eye at the bottom corners, the concept's own dark slate
  cut out of it with their soft edges (`gomilos/rock_bl.png`, `rock_br.png`; the owner: "like the second picture"); the
  stone she pushes level 2's own sandy block with its few discreet veins (a grey-blue was asked for, tried and turned
  down); its backdrop the concept's own sky and sea
  painted alone by Gemini (no horizon line; a band of bright haze at 0.30, `horizon` 0.33 so the sea's glints come in
  below it). The light leaves the statue at the height of her eyes (the owner). The goddess a colossus (the owner: "a
  big statue of Aphrodite"),
  painted far off in the level's backdrop, which Gemini painted whole, in one piece (the owner, 19/11: "make Aphrodite in
  Gemini, further back, like low poly but big"; "no, the low poly is better"; "strange rocks in the depth"; "Aphrodite as
  she is, I liked her; the rocks behind"; "Aphrodite must be in front of the rocks, the rocks much further back; make the
  whole image in Gemini", not cut and sewn): `gomilos/backdrop.jpg` (source `design/level3/backdrop_whole.jpg`) is
  Gemini's edit of the backdrop he liked (the low-poly goddess, `goddess_lowpoly.png`, laid into the plain backdrop by
  `tools/go/backdrop_figure.py`: at the left, her head at 0.085 of its height, her hips into the bright haze band at
  about 0.33), with only the prompt he asked for, "Add a few strange rock formations far in the distance, behind the
  statue, subdued and faded into the haze. Keep everything else exactly as it is." (`design/level3/backdrop_prompt.txt`;
  the owner: "send the sky with the Aphrodite I liked as a picture and just tell it to add strange rocks, subdued, far
  behind"); the level's `horizon` stays 0.33.
  Turned down on the way: the goddess smooth and polished or softly painted, darker, a whole backdrop with her big and the
  haze low, rocks laid in by us (`tools/go/far_rocks.py`) or painted too near, too many or below her. No birds over this level (the owner: "take
  those stupid birds out of the third level"). The 3D goddess is out of the plan
  (`GODDESS` kept in `milos_plan.py` for the record). Her 3D models, all turned down: a painted picture of her on a card
  in the world ("it's bad"), the Tripo P1 model smooth (11,660 faces) and flat with her light baked into its faces (4,200
  and 11,660: `props/statue_goddess.glb`, `tools/go/bake_painted_vc.py`), a Tripo P2 model with her light baked into its
  texture (a texture read raw from a .glb needs mipmaps, `_iv_mipped`, or it sparkles in dark specks far off). The story's line crosses her neck at the level's start; the camera's follow lifts the whole
  picture about 0.085 of the screen there, so her head is kept under the top by that. Turned down on the way: a smooth
  white island of marching cubes (`tools/go/milos_island.py`, still in the repo), a way of separate crooked stones
  (`node_slabs`), a deep blue-violet sky, a crisp sky with 25 grey rocks in the sea, the white island round slabs on a
  grey-blue course, and the stepped redesign's map. No rock tip comes through a slab (the owner: "grey stone passes
  through the white"): the builder sinks every rock vertex a little over a floor, in it or at its edge, under it
  (`rock_clamp` [below, above, margin] in the plan). Its rock and slabs are built with smooth normals (`smooth_normals`)
  for painted light and shade, a trial not yet on by default (the owner asked for "the actual light and shade painted, not
  a texture on the rock"): `IV_PAINT_LIGHT=1 IV_PAINT_AO=0.5` (`paint_light`: the light on smoothed normals in soft
  bands); levels 1 and 2 would need their own rebuild with `smooth_normals`.
- **The ring before every gate** is a soft white light (`fbf9f4`, `emit` 0.3, a soft white glow; the owner, 19/11: "the
  ring white light", after a bright yellowish ochre read as lemon and a very soft ochre); level 3's unlit ring a light
  grey-lilac (`d2cee0`; the owner asked twice for it lighter) that lights to the white.
- **The levels are painted in brushstrokes** (the owner, 19/11: "softly, as with a brush", "the brushstrokes on the
  other maps too"; before, "I want the light and shade painted, not a texture on the rock"): in the waking's levels the
  rock and the slabs (`rock2`, `marble2`) take `paint_light` 1 (the smooth form's light mixed into the facets', its steps
  soft; the levels are built with `smooth_normals` for it) and `brush_k` (1, the slabs 0.6): strokes laid on the canvas,
  held to the world (the screen's own axes at each place: the eye never turns), long and near upright, a little aslant,
  some over others, some ground left bare, their edges soft; each stroke shifts the light where it lies (so the light's
  steps break in strokes) and has its own tone, the darker a little cooler. The rock's hollows shaded (`ao_k` 0.5).
  `IV_BRUSH=0` shows the levels as before; `IV_BRUSH=<k>` another strength. Turned down on the way: soft gradients alone
  ("not like that"), small noisy strokes (they read as a grainy texture), strokes per face (cut at every facet).
- **No rock through things** (the owner, 18/11: "make sure the rocks are clean, none through objects, one in another"):
  the builder's `rock_clamp` [below, above, margin, clear, edge] sinks rock tips under the floors (the stones that rise
  too: in level 1 their rock lay level with their slabs' tops), cuts tall rock reaching in over a floor back to its edge,
  or lifts it clear deeper in; `rock_carve` boxes are cut out of the rock (level 3: the niche for the block, the space
  over the gate's landing). Check a level with the audits kept in the scratchpad's way: rock over each floor's outline,
  in each stair, in each statue, and through the block's place where it comes to rest (all clear on 18/11; level 2
  needed nothing). A 6th value of `rock_clamp` keeps a slab's white side whole where it faces the eye: no rock before it
  over its foot that far out, except at a floor in the sea (level 3: the rock that rose before the side of the gate's
  landing; the owner: "the rock goes strangely into the slab"). Rebuilds: level 1 `ivory_level.py -- gowake/level.glb
  gowake/level.json 7 32 gowake/plan.json` (keep its old level.json: the new build writes null keys it lacked), level 2
  `-- goveil/level.glb goveil/level.json 11 48 goveil/plan.json` then `shore_hole.py goveil`; their plans regenerate
  exactly from `wake_plan.py`, `veil_plan.py`. The grey star on level 3's bridge (the owner, 19/11: "remove the smudge"; it was there before the brushstrokes): a
  slab's corner buried under another stone (a bridge's end on its floor, a pillar's foot) bakes black in the shade of
  corners, and the faces round it on the white top drew a star; the builder now gives such a corner its face's other
  corners' shade (all levels rebuilt). `IV_BG_FILE=<png>` tries another backdrop without importing it.
- **Level 4, the glass (`goglass/`, `FLIP=goglass`, in the game since 19/11)**: the owner's puzzle (19/11: "she does not
  cross; the block must go somewhere in the reflection and the gate opens in the real view"): a wall of glass stands
  across the screen in the still sea; before it the real place (a corridor low over the water from her start to the
  shut gate; a terrace a step above it with the block), beyond it its exact image (only the real side is
  built: `_ivgl_setup` turns the level over about the glass, x + z + k = 0 in the level's axes, gives it to the air the
  further it lies behind the glass, `img_k`/`img_fade` in IV_SH, and draws it only through the pane, `img_clip`; every
  moving thing's image follows it, `_ivgl_pair`/`_ivgl_tick`). In the image alone a bright outline of a square (the
  owner) hangs still; the ring and the gate are unlit and shut until the block's image stands in it (level 3's
  `_ivm_gate_shut`/`_ivm_open`, shared; `_ivgl_check`). **As the owner settled it (19/11): the glass stands still and
  there is no winch** ("take the winch out"; a glass slid or hauled by a winch was not understood: "why should the glass
  need pulling? I don't understand"; before it, a sliding block stopped by low thresholds was turned down): the square
  lies on the image of the terrace's corner by the glass; push the block there (four pushes, two ways; the block from
  the terrace's back, down the stair's head, then along the front row) and its image stands in it. **The same square of
  light lies at her start** (the owner: "the same bright square at the start too, and if you step on it, it resets the
  block"): stepping back onto it, the block sinks into the stone where it stands and rises where it began
  (`_ivgl_reset`; on the white stone it is a bright line inlaid in a darker bed, `IVGL_PAD_SH`; its image in the glass a
  dim blue). Five places the block cannot come out of (the corners), and no true dead end with the square
  (`tools/go/still_glass_trial.py`, plan `tools/go/still_plan.py`; the level.glb of the moving glass is the same, its
  floors unchanged). **The real place and its image stand a little apart** (the owner: "let the two sections have a
  little distance between them"): the glass 2.4 m past the terrace's nearest row (`GAP`, plane 11.4; 0.8 before), the
  eye a little lower (`bottom_room` 0.12). The moving glass (`move_glass_trial.py`, `move_plan.py`, `_ivgl_slide`) is
  kept for the record. For pictures: `IV_BLOCK_AT=<node>`, `IV_GATE_OPEN=1`; `IV_SOL="<nodes>"` plays another way
  through (a block into a corner, back to the square at the start, and on); `IV_FAST_TO=<step>` plays the way to that
  step four times faster (a short check clip of one move), `IV_SFX_ONLY=1` keeps the sounds with `IV_NO_MUSIC`.
  **The block tumbles** here (the owner, 19/11: "would it not be better to tumble it than drag it?"): shoved, it tips
  over its leading edge onto the next place, turned a quarter, and lands with a knock (`_ivt_tumble`, `IVT_ON`; the
  edge's grind, the fall's thud without its water, a heel's tap lowered); the square at the start sinks it straight
  down and raises it where and as it began (`ivt_home`). Levels 2 and 3 still slide it. **The squares' line is thin and
  sharp but bright** (the owner: "a thinner line, sharp but bright"): a centimetre or so, never under a pixel and a
  third, its edges a pixel wide, a breath of light at its rim (`IVGL_SQUARE_SH`, `IVGL_PAD_SH`). Three rocks in the empty
  sea at the picture's foot (the owner, 19/11: "two, three rocks down in the empty space"; `rocks_after` in
  `still_plan.py`, made after the rest; rebuilt `ivory_level.py -- goglass/level.glb goglass/level.json 406 24
  goglass/plan.json`, which also makes its shore map); the mist sheets at the lower corners lie just over the water, so
  the rocks stand through them at their foot. The glass shows no image of them (in it they stood in the sky, beyond the
  sea's end): a `rocks_after` entry with `{'noimg': True}` is built with its vertices' alpha 0, and the image's shader
  leaves out what has it (`COLOR.a`). The sea's gradient (the owner: "can we play a little with the sea's
  gradient?"): tints over the painted sea in `IVS_GRADS` (`deep`, `sun`, `mist`), the level's own in `IVS_GRAD_GLASS`;
  `IV_SEA_GRAD=<name>` tries one; `deep` is the level's own until the owner picks. Her image in the glass is a black blurred
  shadow of her (the owner, 19/11: "if Ione's reflection shows, let it be like a black blurred shadow"; `IVGL_SHADE_SH`).
  **The image is pale and airy, as its concept has it** (the owner, 19/11: "I don't like this dark after all", after
  asking for a darker blue): cooled toward a light blue (`img_tint`, `img_tint_k` 0.6, `img_dark` 0.92) and given to the
  painting's own haze, one colour (`img_mist` 0.76, 0.78, 0.9: never the painting itself, whose face showed through the
  stones), a third at the glass and more for each metre behind it (`IVGL_IMG_FADE`); her shadow stays a dark blue.
  The sea mirrors the level and has its foam and its gradient as every other sea (the owner, 19/11: "the sea, the
  gradient, the foam and the reflections are not like the other seas we made"): the level's image in the water is back,
  the foam is read about the glass too for the image's stones (`shore_mir`), and its backdrop's sea was painted again in
  the other levels' style (`design/level4/game/backdrop_sea.jpg`); its sea reads the painting where the painting lies
  (`bg_off`, `world_uv` 0), so the face is never seen twice at the sea's far edge. The sliding trial (`plate_trial.py`
  `slide`, `slide_plan.py`) is kept for the record. The sea mirrored nothing for a while (the owner, earlier: "with what you
  set up we have two reflections"). **It is built in the game in its Gemini concept's style** (the owner, 19/11: "we had a
  nice blue atmosphere with a statue", "why did you ruin it?", "I want it set up in Gemini's style"; a version in level
  1's pink dawn was "ruined"): the concepts' (`design/level4/concept.jpg`, `slide/concept_start.jpg`) blue-lilac haze,
  their backdrop painted alone by Gemini from the concept (the sky, the soft sun at the upper right, the great face
  lying in the sea; `goglass/backdrop.jpg`, source `design/level4/game/backdrop_sea.jpg`, its sea repainted as the other
  levels' from `backdrop_concept.jpg`; horizon 0.38), its palette sampled from it (`IV_GLASS_PAL`: slabs of a lilac white, dark plum-grey
  rock; a blue-lilac shade), the glass a pane whose left edge and top are seen (`IVGL_PANE`; the image is drawn only
  through it, `img_clip`), a bank of mist at the left over the pane's edge (`goglass/mist_l.png`), no rocks before the
  eye. **More atmospheric** (the owner, 19/11): soft banks of mist standing on the water before the glass and two sheets
  lying on the open sea at the picture's lower corners (`IVGL_MISTS`, `IVGL_MIST_SH`: drifting billows, thinning to
  nothing at the water; a mist painted on the glass itself ended on a hard line at its foot), the glass's light in wide
  slanting sheens (its thin upright streaks read as lines over the story's words), no birds (they stood by the line as
  specks). But never the painting itself as the level: Gemini paints a mirror freely, so its concepts broke the puzzle's
  logic (the owner: "what you sent makes no sense"); the game's exact image is the mirror. Its line, still to be settled
  with the owner: "But a mirror gives no souls, / only images." A pearl-white backdrop
  (`design/level4/game/backdrop_painted.jpg`) was tried and is not the one.
  Earlier designs kept for the record: `tools/go/glass_trial.py` (cracks to cross), `plate_plan.py`,
  `design/level4/` (the concepts, the face in the sea, `face_ref.png`).
- Open: puzzles "The Mirror" and "The Thousand Gazes"; the quarry restyle; faster recordings (below).

## Tools and where they are
- Images: Gemini image model, 2K by default, 4K for hero art. Video: Gemini Omni Flash (image to video, 6–15 s).
  Music: Lyria 3.5 (prompts in `eidolon-demo/design/music/`; never name an artist or a game). Voice: Gemini TTS.
  Sound effects: melodic cues from Lyria, melancholic (the owner turned down the first set and asked for sadder ones);
  Lyria ignores keys, so retune each cut onto A C D E F G (`eidolon-demo/design/sfx/README.md`). Physical sounds:
  recordings (Sonniss GDC bundle) when we can reach them.
- 3D: Tripo CLI `/opt/node22/bin/tripo` (multiview-to-model, `anim rig --spec mixamo`, `anim retarget`). Try
  parameters with `tripo make ... --dry-run` first: `-p` values are charged unchecked.
- Blender 5.0 as a Python module (`python3.11 -I script.py -- args`) for builds, data pictures, review renders.
- Recording the game: `xvfb-run ... godot --rendering-driver opengl3 --fixed-fps 30 --write-movie out.avi
  res://chapter1.tscn -- godemo`, then ffmpeg to MP4. Env: `IV_ZOOM` close-up (`IV_ZOOM_AT=dx,dz` aims it that far
  from her start), `IVW_SNAPS=1` + `SHOT_DIR` + `IVW_QUIT_AT=<snap>` stills, `IVW_SKIP=1` start awake,
  `IV_NO_MUSIC=1`, `HAND=1` tutorial hand; `--quit-after <frames>` for a short check clip.
- Browser build: export preset `WebWake` (feature `gowake`; other levels and unused music left out) into an empty
  folder as `eidolon-<v>.html` (`<v>` the commit's short hash), then `python3 eidolon-demo/tools/web_stamp.py <folder> <v>`:
  every file carries the version in its name, and `index.html` checks `version.txt` past all caches and moves an old
  page or an open tab onto the current version; it also resumes the page's sound at every touch and plays it as media
  on iPhone (not muted by the silent switch); it also gives the game `window.eidolonSound()` ("on" once the browser has
  let sound go). Deploy = the folder's files in place of the old ones (~120 MB). On the web a
  film starts by itself (the owner). Its sound is a player of its own (`intro/intro_audio.ogg`) held to the picture
  (`_ivw_film_sync_tick`): in a browser it is put where the picture is once, when sound is let go. Never seek a
  sample over and over: a browser reports a sample's place a second late, and each start copies the whole sound (the
  old sync restarted it every half second, stopping the film each time). A
  touch on the film shows "tap to skip" a while; a second touch while it shows skips (`_ivw_skip_tap`). Code that reads a file raw (`FileAccess`, the `.glb` levels and props)
  needs it kept raw in the pack (`importer="keep"` or the preset's include filter); for imported pictures check with
  `ResourceLoader.exists`, never `FileAccess.file_exists`. A level's `level.glb` must be `importer="keep"` in its
  `.import`: `godot --import` imports a new one as a scene, and then its raw file is left out of the pack even though
  the include filter names it (level 3 did not load in the browser, a blue screen, 19/11). Check a build's pack with
  `tools/pck_list.py <pck> | grep -E "go[a-z]+/level"`: each level's `level.glb` must be listed. An imported font's raw `.ttf` is not packed even when the
  include filter names it: load fonts with `load()` (`_ivw_font_file`); read raw, the Cormorant letters were missing on
  the web and the story fell back to another font (found 18/11). Earlier demos were published to GitHub Pages from the branch
  `claude/solo-game-ideas-balatro-yj6hqw` (`site/<name>/` → https://ndimt.github.io/game/<name>/); the owner (19/11)
  lets new builds of the game go up there without asking each time (only the game's own folder, `site/eidolon-waking/`).
- APK: preset `AndroidWake` (arm64, the browser build's filters, `com.eidolon.waking`) →
  `godot --headless --path eidolon-demo --export-debug "AndroidWake" build/android/eidolon-waking.apk` (~92 MB). A new
  machine needs: the 4.5.1 templates' `android_debug.apk`/`android_release.apk` (from `export_templates.tpz` at
  downloads.godotengine.org) in `~/.local/share/godot/export_templates/4.5.1.stable/`; `build-tools_r35.0.1_linux.zip`
  and `platform-tools` from dl.google.com in `/root/Android/Sdk/`; a debug keystore made with `keytool` at
  `~/.local/share/godot/keystores/debug.keystore`. Google Drive takes only 10 MB from here: the owner gets the APK from
  the site, https://ndimt.github.io/game/eidolon-waking/EIDOLON-waking.apk (it goes up with the web build, without asking).
- The cloud machine has 4 cores and no GPU: about 1 s per 720x1280 frame, so a 50 s level video takes ~35 min.
  Drive every motion by the game's time (`iv_t`, shader `TIME`), never the wall clock, or it races in recordings.
  Faster options: cheaper render settings for recordings; splitting a video over parallel cloud sessions; a machine
  with a GPU (the owner's computer via Remote Control, or a self-hosted GPU environment).

## Costs (to 18/11/2026)
- Gemini, 10–16/11/2026: about $95–100 (video ~$60, images ~$32, music ~$1.5, voice <$0.5). Tripo: 70 credits left (18/11: five statues at 40, the goddess at 40, then her P2 model and its texture at 110).
- Cheaper: draft videos at 720p and only finals at 1080p; non-urgent images through the batch API (about half).

## Git
- Work on branch `claude/arrow-pro-3d-game-2tki08` (draft PR #2). Never push elsewhere without permission.
- End commit messages with the trailer the session gives. Large binaries (models, music, intro) are committed as
  the game needs them; never commit scratch renders or videos.
