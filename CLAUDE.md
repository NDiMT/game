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
- Show the **whole level**, its full frame, not only a crop of what changed (the owner, 23/11: "and show me the whole
  level"); a close-up may go beside it.
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
  She turns the winch; the stones come up out of the water with foam on the water and on them (the owner, 20/11: "when
  the rocks come out of the water they make a strange flash": foam round each stone's own slab was tried, and he liked
  the first, the foam drawn from the shore map, better; the flash was "a white flash passing over the whole stone": now
  the stones are wet already under the water, so nothing about them changes at once as they break the surface, they dry
  softly from the top down, their sheen and foam fainter, the foam coming in over a moment, its blobs from a hash with no
  `sin` in it, which a phone's graphics can take so loosely that every cell comes out foam; and then, still "a strange
  flash like a glint": the shore map holds all the rising stones' outlines as one, so as the first broke the water its
  foam ran out as a white line round the stones still under; now each stone's foam keeps to the water nearer it than the
  others' middles, `others` in `IVW_CHURN_SH`, `_ivw_riser_middles`; and then "they start dark and make a strange
  flash": wet, darker and cooler, they came up grey-blue and whitened all at once as they dried; now they are never wet,
  `wet_k` 0, and come up in their own colours, only the foam on the water and a little on them; and then (21/11) "this
  ridiculous flash": the fine line of light where stone meets water (`wline_k`, a band 5 cm over it) lay on each flat top
  as it came through the water, so the whole top went white for a frame: off on the rising stones while they move, back
  once still (`_ivw_wline`); and the foam that boiled over each stone as it neared (from the winch's first turn, their
  tops lying 0.32 under) and the burst read the shore map's green, all their outlines as one, so white lines ran round
  the stones still under: no boiling now, and each stone's foam reads its own outline, `gowake/shore_risers.png` (a
  channel each, `tools/go/shore_risers.py`; run it again after a rebuild), coming in over 0.5 s a breath (0.3 s) after its
  top breaks the water, when its rock has come up to where it meets the water; its drops fewer and softer; no `sin` in
  the foam's hashes); she climbs to the
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
  its lines coming one after the other, each rising a little (`_ivw_story_write`; the owner chose it of three, 18/11);
  at the screen's foot was tried (`IVW_STORY_AT`) and he kept it high ("leave the texts at the top", 20/11).
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
- **Sounds: none since 20/11, only the music** (the owner: "I don't like the sounds at all; what if you left only
  music?"): `IVW_SFX_ON` false in `ch1.gd` (the film keeps its own sound); the effects are left out of the builds
  (`sfx/*` in the presets' exclude filter), not made ready in the warm-up, her steps not followed; `IV_SFX=1` plays
  them again on a desktop. How they were made and played, kept for the record:
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
  A prop a level comes to open must come out of that filter: level 5's veiled bust (`props/observer.glb`) was in it,
  and its page crashed in the browser check (21/11); check the pack with `tools/pck_list.py` for each new prop.
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
  (the plan's turn sets that face toward the eye). **The three in the sea, since 20/11** (the owner: "the three statues on
  the left a little bigger, a little further out and a little more random, lit like the statue of the first"): about
  15% larger, 0.75 to 1.3 m further out, not in a row, on their pedestals still; then a little bigger still (2.2, 3.1,
  3.05 m) and each turned a little its own way from facing the eye (13, -17, 9 degrees; the owner: "a little bigger still,
  and turned at random, but slightly"), their pedestals grown with them (0.47; the kneeling one's 0.57, a little wider than its own base) and turned with them
  (the owner: "I want the statues turned together with their base": a pedestal's fifth value in the plan turns it about the
  up as the game turns its statue; the statues' own bases are square to their models) (`veil_plan.py` `sea_statues`, `turn`; the eye framed as before, on where they first stood, `sea_statues_first`); lit as the Observer is
  (`IVV_LIT_AS_OBSERVER`: its far haze, no shadow of their own, the low sun a little stronger on their edges). Its backdrop is its own (`goveil/backdrop.jpg`: the golden morning,
  far veiled statues at the horizon, horizon 0.362). Concept: `design/level2/concept.jpg`. Its block is a sandier
  marble than the slabs, a little uneven, with a few discreet veins a little darker than it, its own so they go with it
  when pushed (`vein_local`; the owner, 18/11, after a grey-blue with white veins was tried in levels 2 and 3 and turned
  down: "leave it yellowish as it was, with a few discreet marble veins"); its meander cut unevenly by hand, a darker
  shade of the same stone, not terracotta (the owner) (`props/block_meander.glb`, `tools/go/block_meander.py`, kept for
  the record). **Since 20/11 a true cube that tumbles, as level 4's** (the owner: "this holds for maps 2 and 3 with the
  cube too"): `props/block_cube.glb`, 0.92 m, its own colours, beige since 20/11 in every level (the owner: "not gold but beige"; then, of an outline of a smaller
  square in place of the meander, made and turned down the same day: "leave it with the meander, just make it beige";
  then "a more brown beige", "and the meander a little lighter"; and "in all levels the cube with the meander like the
  first": the fourth level's own lighter, softer colours for it are gone, it is the second level's; since 21/11 a light brown, `d6b18a` lit, in every level: "the stone with the meander in
  all levels light brown"; then a little lighter and greyer, `d2baa0` lit: "the cube with the meander a little lighter
  brown and greyer"; on 22/11 a lilac grey, `bfb4c9` lit, its meander white, `f6f1ef`, of ten offered: "the lilac
  grey with white, I liked it", see level 5; later on 22/11 in each level's own slabs' colours, its meander the colour
  of the way's line, drawn flat as the line is (the owner: "make the cube in the slab's colours, and the meander the
  colour of the path's line"), and then not liked ("I don't like the colour of the cube with the meander"); **since 23/11
  the lilac grey again, its meander plum, shaded as the stone is** (`bfb4c9` lit, `5e4a66`; of eight offered with a
  meander of its own colour, the owner: "make others, I don't want the meander white", then "lilac grey", m1 in
  `design/cube/options.txt`; `block`, `meander` in `IV_WAKE_PAL`, every level), its veins as discreet as before;
  its single great key cut in each face (`tools/go/block_cube.py ... one`; four small square keys on each face, two by
  two, as the fifth level's concept has them, were tried on 21/11, `four`, and the same day the owner: "put back the
  previous cube you push"); it tumbles over onto the next place, and into the gap
  too, as at every push (the owner, 20/11: "the same movement as the basic push"): shoved to its stone's edge, it rises
  onto that edge and goes over, out and down into the water (`_ivt_over_into`), a small splash as it breaks the water
  (`_ivv_splash`; the owner: "a small splash"), its top flush with the way (`_ivv_bside`); its foam is laid round the
  gap's own middle, where it comes to rest (`_ivv_plunge`), never round its origin (the owner: "the foam should be at the
  centre of the cube": round its origin it stood half a cube off). Once it has tumbled its origin (the middle of the face
  it was made standing on) is on a side, so every move that is not a tumble goes by the middle of its foot (`_ivb_off`;
  the owner, 20/11: "the cube falling into the water looks very strange, half of it goes into the stone"). In the empty sea at the bottom right, a
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
  busts on plinths looked staged); it runs up the channel to the goddess's bronze mirror (on its square marble plinth,
  its light a light sky blue since 22/11 (`IVM_LIGHT_COL` 0.55, 0.82, 1.0, its core `IVM_CORE_COL` a white touched with
  the blue; the owner: "in the third map can you make the beam of light light blue?"; white the same day before it, "in 3
  make the light's colour white", and a white tried on 21/11 was turned down then, "the yellow beam was better";
  `IV_L3_GOLD=1` shows the warm gold);
  the bronze under its stand a round foot since 21/11, `_ivq_mirror`: the owner, "the metal part below round"; the
  plinth made round instead was turned down: "I didn't ask you to raise anything and break something else"; the
  fifth level uses the same mirror); a swipe into the mirror turns
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
  down), since 20/11 the cube, here 1.06 m on every side (`_ivv_bscale`): as high as the light runs over its floor (the
  mirror's disc 1.02 m up), so it still stops it; its one push, into the niche under the rock, slides (the niche's roof is
  too low for it to go over: its corner would rise 1.5 m); its backdrop the concept's own sky and sea
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
  behind"); the level's `horizon` stays 0.33. **Since 20/11 the goddess in it is the painted one, a little bigger and
  lower** (the owner: "in map 3 and map 4 the statue not low poly, but painted"; "Aphrodite a little bigger and a little
  lower"): `python3 -I tools/go/backdrop_figure.py design/level3/goddess_painted.png design/level3/backdrop_plain.jpg
  gomilos/backdrop.jpg 0.25 0.105 0.395 0.3 1 --onto design/level3/backdrop_whole.jpg 70,130,458,1240` (laid on the plain
  backdrop, then only the box about her, its edge feathered, set into the whole one, so its far rocks stay as they are);
  a little more haze over her (0.3, was 0.2; the owner: "the statue here a little more subdued"). On 22/11 (the owner: "can the backgrounds in 3 and 4 look more 3D? In 3 Aphrodite, in 4 the head") her
  light and shade were drawn out and she was shaded as a turning form (`tools/go/figure_volume.py round`), and turned
  down at once: "you didn't make them like 3D, you just made them more intense, I didn't want that"; the backdrop is back
  as it was. Then he said what he meant (22/11: "the 3D ones, make them slightly more intense, not much, and look more
  3D, slightly polygonal"): Gemini repainted her alone on green as a finely faceted low-poly marble statue, the same in
  all else (`design/level3/goddess_facets_gemini.jpg`, `goddess_facets_prompt.txt`); it kept her drawing and place (no
  shift, no change of scale) but not her colours, so only its light and shade are laid over hers within her, at 0.75,
  a little stronger than hers about their mean (1.18: at 1 she read paler than before), her colours kept (`tools/go/figure_facets.py` → `goddess_facets.png`), and she is laid in as before with a little
  less haze (0.25, was 0.3): `backdrop_figure.py design/level3/goddess_facets.png ... 0.25 1 --onto ...`
  (`figure_facets.py ... goddess_facets.png 0.75 green - 1.18`). A triangulation
  of our own (each triangle the mean of the painting in it) read as a filter over a picture: not used.
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
- **Nothing before the eye; details in the water instead** (the owner, 23/11: "take the blurred things in front out of
  all the levels, but I'd like details in the water, like the ones you made at some point in between, in all the
  levels"; "the water lilies in 4 I liked"; "and they needn't all be striking"): the things before the eye at the
  corners (the leaves above, the rocks below, level 2's veiled statue, level 4's lilies with leaves, level 5's fallen
  column, the last two made dark and blurred as the second level's statue just before) are all hidden (`IV_FG_ON` false
  in `ch1.gd`; `IV_FG=1` shows them again). In their place things in each level's water, part of the scene
  (`IV_WATER_DETAILS`, `_iv_water_details`). First one each (an amphora, a statue's marble hand, a fallen capital, a
  bronze hand mirror: "I don't like these"); then twelve natural ones offered, lilies with a bud, reeds, petals and
  leaves, three a level (`design/water/options/`), all three a level for a while; **he chose one a level: level 2 the
  petals (2c), level 3 the lilies (3a), level 4 keeps the lilies he liked, level 5 a fallen Ionic column at the lower
  right with a drum broken off it beside it** ("the column doesn't look 3D": made to look carved and slightly polygonal
  as the third level's goddess, see `design/water/README.txt`; "lower right"; "and a second piece of column"); **level
  1 is being settled, one level at a time from it** (the owner: "let's go to 5, then we'll start from 1 again and do them
  one by one"; things that fit, "surprise me", looking 3D as the others we made). Each was painted by the image
  model into the level's own frame (the game's still at her start, 720 by 1280, with nothing before the eye: "keep the
  whole picture exactly as it is ... add only one thing, in the open water ... a quiet, natural detail of the scene, not
  a striking one ... small, about a sixth of the frame's width"), then the same painting with its open water made flat
  green; `tools/go/water_lift.py` lifts the thing from the green take (whole where the take has it whole, even a green
  bronze; with `--new` only what the painting added, never the level's own rocks and slabs the take kept) and, about it,
  what it does to the water (its ripples, its image, its part under the water) from the painting against the game's
  frame, its colours always the painting's own, so laid over the game's water it gives back the painting; it prints the
  cut's place in the frame and its foot. `design/water/lift_all.py` does them all and prints their entries (the three of
  a level were each painted at one place: `place.json` moves them apart). The game stands each in the world as a card
  facing the eye (`StandardMaterial3D` unshaded, its texture imported with mipmaps), placed from those pixels by the
  level's own eye and its follow at her start on a 9:16 screen (`_ivr_follow_tg`), its foot on the sea along the eye's
  ray: it goes with the level as the eye follows her, and the level's rocks nearer the eye than its foot hide it. Drawn
  after the sea and its foam (7), level 4's after its mist sheets (22), as painted. The lilies of level 4 were cut from
  the very take he liked (`tools/go/water_cut.py`: its dark rock behind the bud, its half-green pad given back its colour
  from the painting), their pads cut by the frame's edges completed by the model in a green margin, so a taller screen
  never shows a straight cut. A thing painted into a frame where the tutorial hand shows takes the hand's place: paint
  the hand out of the frame first. Sources: `design/water/` (each level's frame, prompts, painting, green take; the
  lilies' canvas and completion). `IV_WD=0` leaves them out; `IV_WD_ADD="file,left,top,width,height,x,y[,after]"` tries
  one.
- **Water lilies all round the first level's island** (the owner, 23/11: "impress me with level 1; all around I want
  water lilies"): painted by the image model into its frame at her start, lifted as one layer over the whole frame and
  laid on the water's own plane (`IV_WATER_DECALS` in `ch1.gd`, `gowake/wd_lily_ring.png`; `design/level1/lilies/`):
  the frame's corners taken down to the sea along the eye's rays, so it lies where it was painted, goes with the level
  as the eye follows her, and the island hides what lies behind it. Kept to the clean frame's open water, or the model's
  small repaints of the text and the figures come back as ghosts on the water. The three details of before are out.
  Then far fewer and discreet ("you overdid it, I want much fewer, and discreet"); then "not near the statue, and I want
  better water lilies": three small groups in the fourth level's style he liked (pale, softly faceted pads, closed lotus
  buds on curved stems), at the left, at the island's right and at the lower right; then without the tall buds ("the
  lily is pointless") and the group at the island's right, and of the takes he chose the one with small open pink lotus
  flowers on the pads ("this I liked, only one lily is cut abruptly"): cut out of that green take itself, whole pads
  only, none at the frame's edge, at the left and the lower right.
  **Then turned down** (23/11, after their buds were given images in the water: "bro I don't like them, do something
  else in 1"): `IV_WATER_DECALS` is empty, `gowake/wd_lily_ring.png` gone (its making in `design/level1/lilies/`). Three
  things painted at the lower right in their place (a fallen veiled head, a fallen column, an empty boat) he liked but
  kept for another map ("make others too; I liked these, but keep them for elsewhere"): `design/fg_spare/level1_water/`.
  A take that names the place by the start slab may move the slab and her: name all that must stay ("nothing moves").
  **The lilies of level 4 out too** (24/11: "bro why do I still see water lilies?", then "in 2 and in 3 leave them, from
  4 take them out"): level 2's petals and level 3's lilies stay; level 4's picture and entry in `design/fg_spare/water/`.
  The rules he has given for painted things are in the skill (`go-level`, "Things painted into a level").
- **The ring before every gate stands clear of its door** (the owner, 22/11: "the bright circles should never be right at
  the door"; and of the first level: "no second-to-last dot: the stair's path takes you straight to the last bright
  circle"): each ring set back along the way to 1.15 m from its arch's middle (level 4's 1.1; 0.6 to 0.9 before, its
  stone band all but touching the door), and in the first two levels the dot at the stair's head, 0.9 m short of the
  ring, taken out (the second's was the same, and the ring set back would have lain on it): one swipe takes her up the
  stair and to the ring (levels 1 and 2 are 8 swipes). `tools/go/ring_clear.py` does it to a level's puzzle.json (the
  game reads its nodes there; the built level is untouched): run it again whenever a plan script makes a puzzle.json anew.
- **The way's line never runs onto a ring or a square** (the owner, 22/11: "the path's line should never fall on a
  bright circle, ever: it should stop as soon as the bright circle's frame begins"): it stops where the frame's outer
  stone begins, the ring's low brown ring (`IV_RING_OUT` + its tube) and the start square's brown square (`IVGL_PAD_OUT`
  + its tube), a centimetre short (`_ivr_way_gap`); on stairs too (over the stair's last stretch it ran on into the first
  two levels' rings, to their middles).
- **The ring before every gate** is a soft white light (`fbf9f4`, `emit` 0.3, a soft white glow; the owner, 19/11: "the
  ring white light", after a bright yellowish ochre read as lemon and a very soft ochre); level 3's unlit ring a light
  grey-lilac (`d2cee0`; the owner asked twice for it lighter) that lights to the white; the brown stone within it, and
  since 22/11 a low ring of the same brown stone round its white (`IV_RING_OUT` 0.495, tube 0.055, its inner edge under
  the white; the owner: "on the round rings at the gate another small outer layer in the colour of the inside, round the
  white", then "the darker outer circle a little further in": at 0.52 a line of the floor showed between them), flat
  (squashed to 0.16) so its top is lit as the stone within and reads its colour (squashed to 0.3, as the squares'
  stone, it read darker). A
  terracotta disc within and a terracotta ring round it were tried for a day (20/11) and the owner had it back "exactly
  as it was".
- **The levels are painted in brushstrokes** (the owner, 19/11: "softly, as with a brush", "the brushstrokes on the
  other maps too"; before, "I want the light and shade painted, not a texture on the rock"): in the waking's levels the
  rock and the slabs (`rock2`, `marble2`) take `paint_light` 1 (the smooth form's light mixed into the facets', its steps
  soft; the levels are built with `smooth_normals` for it) and `brush_k` (1, the slabs 0.6): strokes laid on the canvas,
  held to the world (the screen's own axes at each place: the eye never turns), long and near upright, a little aslant,
  some over others, some ground left bare, their edges soft; each stroke shifts the light where it lies (so the light's
  steps break in strokes) and has its own tone, the darker a little cooler. The rock's hollows shaded (`ao_k` 0.5).
  `IV_BRUSH=0` shows the levels as before; `IV_BRUSH=<k>` another strength. Turned down on the way: soft gradients alone
  ("not like that"), small noisy strokes (they read as a grainy texture), strokes per face (cut at every facet).
- **No bloom** (the owner, 25/11, a few hours after it went up: "I didn't like the bloom after all"): `IV_BLOOM_ON`
  false; `IV_BLOOM=<k>` shows it again on a desktop. As it was made, kept for the record:
- **A cheap bloom over the levels** (the owner, 25/11: "can we give the other maps a cheap bloom effect?"): one canvas
  pass over the 3D, under the corners and the story (`IV_BLOOM_SH`, a CanvasLayer at -1 made in `_ivr_build`, so in
  all five levels): the picture's copy and its mip levels read at twelve places about each point at two widths, and the
  part over a soft threshold of lightness (`IV_BLOOM_TH` 0.905, by luminance, so a warm sky stays as it is) added back a
  little warm (`IV_BLOOM_K` 0.28); no extra copies or passes. The sun, the gate's light, the rings, the light beam and
  the brightest marble glow softly. A threshold on the brightest channel at 0.86 washed the whole sky out.
  `IV_BLOOM=<k>` and `IV_BLOOM_TH=<t>` try it.
- **No stain where two slabs meet** (the owner, 22/11, of the fourth level's terrace by her start: "here there's a stain
  from the brown slab behind, try not to let it happen"; then of pieces of marble laid in the joint at runtime: "don't
  add nonsense, I just want it not to show"): where two floors of one height meet edge to edge, their eased edges (9 to
  17 cm across, as much as 16 cm down) make a groove, and the rock the clamp holds 4 cm under the floors showed in it
  dark. The builder now sinks the rock under such a meeting below the groove, 24 cm under the floors (`joint_lines`, in
  the rock clamp); nothing is added. Levels 3, 4 and 5 rebuilt with it (their own seeds as below; only those rock
  vertices moved, 14, 11 and 36, everything else the same to the vertex; their level.json the same); levels 1 and 2 have
  no such meetings.
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
- **Level 4, the glass (`goglass/`, `FLIP=goglass`, in the game since 19/11)**: **now an opposite island, not a glass**
  (the owner, 19/11: "could it be not a glass with a reflection, just an opposite island?"): `IVGL_ISLAND` hides the
  pane, its sheens and its clip; the image is drawn in the level's own colours, only a little given to a grey-blue haze
  with its distance. **In the concept's colours and blurred** (the owner, 20/11: "I don't like the reflection's colours at
  all; I want it blurred, but colour-wise we're a bit off our style"; before, the great face's pink-to-light-blue
  gradient was laid over it, `IVGL_ISLE_GRAD` 0.88, now 0): its colours drawn to the concept's image beyond the glass
  (about `bfbece`, `b4b9cc`, sampled region by region): a cool grey duotone (`IVGL_ISLE_TINT` 0.6, `IVGL_ISLE_LO`,
  `IVGL_ISLE_HI`, `IVGL_ISLE_DARK` 0.9) given to a pale grey-lilac haze (`IVGL_ISLE_HAZE`, `IVGL_ISLE_FADE`; `IV_ISLE_TINT`,
  `_LO`, `_HI`, `_DARK`, `_MIST`, `_FADE`, `_GRAD` try others); and seen as through frosted glass (`_ivgl_veil`,
  `IVGL_VEIL_SH`, `IVGL_VEIL_PX` 6 px at 720 wide, `IV_ISLE_BLUR=<px>`, 0 none): a pane on the glass's plane, as tall as the
  island reaches up the screen, reads the screen and the depth and blurs only what lies behind the plane near the island
  (its edges soften into the sky), never what stands before it (the real place) nor the painting away from it (the great
  head stays sharp). The screen copy holds only what was drawn opaque (the transparent sea is not in it), so it is drawn
  after the sea (priority 5) and under her shadow, the square and the lights (6), which stay clear over it. **Then in
  mist, not blurred** (the owner, 20/11: "the blurred back is too grey"; "I said mist, not blurred; look here, I want such
  colours", showing `design/level4/slide/concept_solved.jpg`; "just a little more intense, the reflection and the statue,
  with better, more spread-out mist"): no blur (`IVGL_VEIL_PX` 0) and no duotone (`IVGL_ISLE_TINT` 0): the island in its
  own colours given to the concept's white-lavender mist (`IVGL_ISLE_HAZE`, `IVGL_ISLE_FADE`), its foot dissolving into
  it (`IVGL_ISLE_FOOT`: from the sea up 1.9 m, 0.82 of it at the water; `img_foot` in IV_SH), a little stronger than the
  concept's image; the near mists (`IVGL_MISTS`) larger and denser (`IV_MIST_DBG=1` draws each in its own colour: sheets
  lying on the water behind the glass are under the island, unseen). The glass may
  be implied, but the island must never lie over the face (the owner: "what I don't want is the second island falling on
  the statue"); her twin over there stays a blurred shadow, grey-blue; the glass's
  notes below still hold for all else (the turn about x + z + k = 0, the pairs, the square, the gate's light). **Its
  colours brought back to its concept's** (the owner: "fix the colours, you have strayed far from the style"; sampled
  from `design/level4/slide/concept_start.jpg`: a pale grey-blue sea, lum about 0.66, saturation 0.2, where it had
  become a dark saturated indigo): the painted sea graded to it in the sea's shader (`grade_k` 0.88, `grade_far`,
  `grade_near`, its light and dark kept about them, nothing at the far rim; `IV_SEA_GRADE=0` shows the painting as it
  is), no tint gradient (`IVS_GRAD_GLASS` empty). The owner's puzzle (19/11: "she does not
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
  (`_ivgl_reset`). It is made as the ring before the gate is, square, so it stands out at the game's eye (the owner:
  "the square that resets doesn't stand out"; a bold flat square was "awful"; "brown inside and bright outside, as the
  circle is"): a frame of the ring's own lit white (`_iv_mat("ring")`, `fbf9f4`, emit 0.3; four round bars and round
  corners, squashed to 0.62 as the ring's torus is), brown stone within (`rock2`), the ring's soft glow over it
  (`IVGL_PAD_HALF` 0.39, `IVGL_PAD_TUBE` 0.075); no disc of the way in it, the way's lines stopping at its rim; it flares
  as it resets. **Since 20/11 both squares, the one at her start and the one in the image, have a square of the same
  brown stone round their light too** (the owner asked for a golden light with terracotta in and round it, then kept the
  form and not its colours: "I like the square as it became; make it with white light and replace the terracotta with the
  colour you had"): the white frame, `rock2` within, a low square of `rock2` round it (`IVGL_PAD_OUT` 0.53); the square in
  the image built the same (`_ivgl_pad`; the owner: "the start's square differs from the target's in the reflection; I
  want it as the real one"), its stone given a little to the island's haze, its light flaring and staying brighter as the
  block's image stands in it; it has no twin on the island (the owner, 19/11: "the shadow doesn't need a start square"). Five places the block cannot come out of (the corners), and no true dead end with the square
  (`tools/go/still_glass_trial.py`, plan `tools/go/still_plan.py`; the level.glb of the moving glass is the same, its
  floors unchanged). **The real place and its image stand a little apart** (the owner: "let the two sections have a
  little distance between them"): the glass 2.4 m past the terrace's nearest row (`GAP`, plane 11.4; 0.8 before), the
  eye a little lower (`bottom_room` 0.12). The moving glass (`move_glass_trial.py`, `move_plan.py`, `_ivgl_slide`) is
  kept for the record. For pictures: `IV_BLOCK_AT=<node>`, `IV_GATE_OPEN=1`; `IV_SOL="<nodes>"` plays another way
  through (a block into a corner, back to the square at the start, and on); `IV_FAST_TO=<step>` plays the way to that
  step four times faster (a short check clip of one move), `IV_SFX_ONLY=1` keeps the sounds with `IV_NO_MUSIC`.
  **The block tumbles** here (the owner, 19/11: "would it not be better to tumble it than drag it?"), **a true cube**
  (20/11: "the cube looks rectangular rather than square, not the same height on every side"): `props/block_cube.glb`
  (`python3.11 -I tools/go/block_cube.py -- props/block_cube.glb 0.92 11`), 0.92 m on every side, the same uneven carved
  sandy marble as level 2's block, its square-spiral meander cut into all six faces, so it looks the same however it
  lands, a few corners broken; a little lighter and warmer here, as the concept's `e7ccb8` (`block` in `IV_GLASS_PAL`); its meander softer than the
  second level's, a little over half way to the cube's own stone (`meander` in `IV_GLASS_PAL`; the owner, 20/11: "can we
  make the meander on the cube less intense?").
  Levels 2 and 3 have it too since 20/11 (see them). **It goes over as a heavy stone shoved** (20/11: "a little more natural when it rolls", "and a
  little dust"; `_ivt_tumble`, `IVT_ON`): it slides first what the step (1.5 m) is longer than the cube (`IVT_SLIDE`,
  her hands with it), rises slowly onto its leading edge, slowing as it comes to balance (`IVT_RISE`), falls faster and
  faster onto its next face (`IVT_FALL`), never lifted off that edge, lands with a knock (the fall's thud without its
  water, a heel's tap lowered), rocks back a hair (`IVT_ROCK`) and is still; a little dust where its edge scrapes, and a
  puff out from under it all round as it lands (`_ivt_dust`: soft puffs of `goiv/glow.png`, `IVT_DUST_COL`, after the
  sea). The square at the start sinks it straight down and raises it where and as it began (`ivt_home`). **Its meander
  lights white** while it stands where its image is in the square, on the block and on its image, the ring's own soft
  white light (`_ivgl_meander`, `IVGL_MEA_EMIT`; the owner, 20/11: "when the cube reaches the square, the meander lights
  up white"); pushed off, it goes out. **The squares' line is thin and
  sharp but bright** (the owner: "a thinner line, sharp but bright"): a centimetre or so, never under a pixel and a
  third, its edges a pixel wide, a breath of light at its rim (`IVGL_SQUARE_SH`). Three rocks in the empty
  sea at the picture's foot (the owner, 19/11: "two, three rocks down in the empty space"; `rocks_after` in
  `still_plan.py`, made after the rest; rebuilt `ivory_level.py -- goglass/level.glb goglass/level.json 406 24
  goglass/plan.json`, which also makes its shore map); the mist sheets at the lower corners lie just over the water, so
  the rocks stand through them at their foot. The glass shows no image of them (in it they stood in the sky, beyond the
  sea's end): a `rocks_after` entry with `{'noimg': True}` is built with its vertices' alpha 0, and the image's shader
  leaves out what has it (`COLOR.a`). Brown rocks pass through her start (the owner, 19/11: "brown rocks passing
  through the starting point"; **meant about it, never through the slab**: the owner, 20/11, "I've told you a hundred
  times, no brown rocks through the slab"; for a day they stood up through its edges, let through by `noclamp`, which is
  never to be used): three more in `rocks_after` about it, sunk under the slab by the builder's `rock_clamp` as every
  rock is. The sea's gradient (the owner: "can we play a little with the sea's
  gradient?"): tints over the painted sea in `IVS_GRADS` (`deep`, `sun`, `mist`), the level's own in `IVS_GRAD_GLASS`;
  `IV_SEA_GRAD=<name>` tries one; `deep` is the level's own until the owner picks. Her image in the glass is a blurred
  shadow of her (the owner, 19/11: "if Ione's reflection shows, let it be like a black blurred shadow"; `IVGL_SHADE_SH`),
  grey-blue since (the owner, 19/11: "the reflection's shadow more grey-blue, not black": `IVGL_SHADE_COL` 0.42, 0.48,
  0.62; a lighter 0.52, 0.58, 0.72 read too faint; `IV_SHADE_COL="r,g,b"` tries another). When the puzzle is solved it
  goes in a puff and does not come back (the owner, 20/11: "when the puzzle is solved the shadow goes poof and
  disappears"; `_ivgl_shade_poof`, a breath after the square flares): it swells a little as it fades, and a cloud of
  large soft puffs in its grey-blue, lighter (`IVGL_POOF_COL`, the dust's own material), bursts out of it and thins in
  about a second; small puffs read as dots. It is drawn after the sea
  (`render_priority` 6, as the foam and the lights; so are the island's square and the start square's glow): drawn
  without depth at 0, the transparent sea was laid over it wherever only sky and sea lay behind it, and as she walked
  to the gate her shadow was cut off along the island's edge (the owner, 20/11: "the shadow passes under the
  background").
  **The image is pale and airy, as its concept has it** (the owner, 19/11: "I don't like this dark after all", after
  asking for a darker blue), **in the great face's own blue-pink** ("the reflection too, this blue-pink of the
  statue"): a duotone, its shade the face's blue-lilac (`img_lo`), its light its rose (`img_hi`), `img_tint_k` 0.72,
  given to a lilac haze of one colour (`img_mist` 0.84, 0.8, 0.9: never the painting itself, whose face showed through
  the stones), a third at the glass and more for each metre behind it (`IVGL_IMG_FADE`); her shadow is grey-blue.
  **Since 20/11 the image has no gate** (the owner: "in 4 the reflection without a gate"): the arch is in the level's
  marble, so a box about it is cut out of the marble's image and of its image in the image's water (`img_cut_lo`,
  `img_cut_hi` in IV_SH, in the mesh's own axes; `_ivgl_cut_gate`), the floor under it kept; its leaves and its light have
  no image; its ring's image stays and lights. Before, the gate's light and its ring lit in the glass too as it opened
  (the owner: "when the gate opens, light in the reflection too"): the white opening, the light before it, its motes and glow paired with their own materials
  (`_ivgl_gate_images`, made after the gate), the ring's image lit with it (`ivgl_ring_img_mat`). **The great face is
  painted in the backdrop** (the owner asked "is the statue like a picture?": yes), a little further back since 19/11
  ("the statue a liiittle further back"): Gemini's edit of the backdrop, the face about 85% of its size, lower and paler,
  nothing else changed (`design/level4/game/backdrop_far.jpg`, its prompt beside it); then moved up and to the right,
  under the sun, so the opposite island never lies over it (`backdrop_moved.jpg`); then further back again (the owner:
  "the statue further back"): about two thirds of that size and a little higher, its chin clear of the island's top at
  her start, where the camera's follow sets the island highest on the screen (`backdrop_farther.jpg`; each with its
  prompt beside it). **Then much better, bigger and more solid** (the owner, 20/11: "a much better statue head in the
  background, more visible and bigger"; "can the head look a bit more 3D?"): a new painting in five steps
  (`design/level4/game/backdrop_head_prompt.txt`, source `backdrop_head.jpg`): a beautifully carved colossal head of a
  young goddess, grey-white marble, modelled strongly in light and shade (warm light on its brow, nose and hair from the
  sun behind it at the upper right, cool blue-lilac shadow in the eye sockets and on its far side), high at the right,
  its waterline just above the opposite island's top (it moves with the level, so that holds as the eye follows her); the
  story's line crosses its hair at the start and fades. Gemini made the head huge and low when asked to repaint freely;
  so: the painting with the head, the same without it, the head laid on that plate at its size and place by hand, then
  Gemini asked only to make it one seamless painting, and to model it more strongly, each step checked by a
  cross-correlation that the head had not moved. In the game's file the pinks of its haze are pulled toward the
  concept's lavender. A low-poly look for it was asked and then turned down the same day ("in map 3 and map 4 the
  statue not low poly, 3D but painted"): it stays painted. **Then laid back into its haze** (the owner, 20/11: "the
  statue less intense, about as it is in the first frame", the concept; of three strengths, "10% more intense than the
  third and we're done"): `tools/go/backdrop_haze.py` lays the painting back toward its clean plate within the head's
  mask, keeping 0.46 of its own light and shade (`design/level4/game/`: `backdrop_head_game.jpg` the strong one as it
  was in the game, `backdrop_plate.jpg` the plate without the head, `head_mask.png`).
  On 22/11 the head was modelled more strongly by Gemini and kept stronger in its haze (`backdrop_head_3d*.jpg`,
  `figure_volume.py relief`, 0.58), and turned down with the goddess's: "just more intense"; the backdrop is back as it
  was (0.46). **Then slightly polygonal and a little more intense**, as the goddess (the owner, 22/11, of both): Gemini
  repainted a crop of the head (430,180, 650 square) finely faceted (`backdrop_head_facets_gemini.jpg`,
  `head_facets_prompt.txt`); its light and shade at 0.85 within the head (`head_tight.png`: where the head painting
  differs from the plate), the colours kept (`figure_facets.py` → `backdrop_head_facets.jpg`), and laid into its haze at
  0.52 (was 0.46). **The sky's fine horizontal lines taken out** (the owner, 22/11: "in 4 it makes some strange lines
  behind, in the sky, in the background": the image model had painted its haze in long faint horizontal strokes, in the
  plate and in the head painting alike): `tools/go/backdrop_destreak.py` (a row's residue against the rows about it, held
  along the row, taken out in three passes; the sky down to 0.40 of the height, fading out by 0.47, never within the
  head) → `backdrop_plate_clean.jpg`, `backdrop_head_game_clean.jpg`, from which the game's is made. The fifth level's sky
  was cleaned the same way when the owner saw its lines too, and the third's when he said yes to it (22/11): its
  finished backdrop through `backdrop_destreak.py gomilos/backdrop.jpg gomilos/backdrop.jpg 0.40 0.47
  design/level3/goddess_mask.png` (her mask: where the backdrop differs from the plain one within her box), the far
  rocks keeping their shapes.
  **No darkening at the screen's edges here** (`vr` hidden for `go_glass`): its concept is clear to
  the corners, and the waking's plum vignette turned its sky pink there. The slabs a touch warmer (`marble2`, the
  concept's `ddcfd4` lit) and the near sea a little lighter (`grade_near`, its `99a6bb`), measured against the concept
  region by region (sky, sea, the image's stones, slabs, rock, block, mist).
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
  eye. **The back of a statue's head before the eye at the lower right, blurred** (the owner, 23/11: "at the lower right
  in 4 put the back of a statue's head, blurred"): `goglass/fg_head.png` by `tools/go/fg_head.py` (our goddess's model
  rendered from behind in Blender, turned 28 degrees and seen 14 from above, lit from the upper right, then brought into
  the level's blue-lilac, `4f4a64` to `aeabc6`, and blurred); laid on at `IVGL_FG_HEAD` (left 430, top 215 over the
  picture's foot, 380 wide, at 720 wide): only the head shows, its neck and shoulder below the edge (the owner, 23/11:
  "less of the statue, only the head"; its top was 400, its shoulder in the picture); `IV_FG4=head` shows it. **Since
  23/11 short reeds instead** (the owner: "I want other blurred things in front, in 4 and in 5"; of grasses: "lower, not
  half the screen", "lower and more horizontal", "more monochrome", "maybe like reeds?"): `goglass/fg_grass.png`, short
  reeds with a few cattail heads painted alone by the image model as a flat grey silhouette
  (`design/level4/fg_edit/reeds_a.png`, its prompt beside it), cut out by its lightness and laid in one tone of the
  level's blue-lilac (`60627c`, 0.88), at `IVGL_FG_GRASS` (`IVGL_FG` "grass"; `IV_FG4=0` leaves it out). **Then two
  pale lily buds with ordinary long leaves** in the same `goglass/fg_grass.png` (the owner: "I liked the lily", of a lotus
  bud the model painted into the level's frame among lily pads; "without the pads", "more leaves and another lily",
  "normal leaves", "lower"): painted alone by the image model on green after its own (`design/level4/fg_edit/
  lilies3_b.png`, `lilies3_alone_prompt.txt`), keyed against its measured green with the green unmixed out of its soft
  edges, 300 px high, low at the lower left. Things lifted
  out of the image model's edit of a level's frame (`tools/go/fg_from_edit.py`) carry ghosts of what it repainted near
  them (her, a second time, beside her): paint a thing alone, or cut it against a green the model makes of the water.
  **Kept for another map** (the owner, 23/11, of three painted into level 4's frame at the lower right, where he had not
  asked for anything: "keep the objects you made in the sea for another map, I liked them"): a fallen Corinthian capital,
  an ancient bronze hand mirror and a statue's marble hand rising from the water, each half sunk; `design/fg_spare/`
  (the painting, its prompt, the water made green, the thing cut out by `tools/go/fg_from_edit.py`). Level 4's thing
  before the eye stays at the lower left.
  **More atmospheric** (the owner, 19/11): soft banks of mist standing on the water before the glass and two sheets
  lying on the open sea at the picture's lower corners (`IVGL_MISTS`, `IVGL_MIST_SH`: drifting billows, thinning to
  nothing at the water; a mist painted on the glass itself ended on a hard line at its foot), the glass's light in wide
  slanting sheens (its thin upright streaks read as lines over the story's words), no birds (they stood by the line as
  specks). But never the painting itself as the level: Gemini paints a mirror freely, so its concepts broke the puzzle's
  logic (the owner: "what you sent makes no sense"); the game's exact image is the mirror. Its line, still to be settled
  with the owner: "But a mirror gives no souls, / only images." A pearl-white backdrop
  (`design/level4/game/backdrop_painted.jpg`) was tried and is not the one.
  Earlier designs kept for the record: `tools/go/glass_trial.py` (cracks to cross), `plate_plan.py`,
  `design/level4/` (the concepts, the face in the sea, `face_ref.png`).
- **Level 5, the Guardian (`goguard/`, `FLIP=goguard`, being built since 21/11)**: the script's tenth truth ("He looked
  into the mirror with longing, / and it kept him."). The Guardian of the Glass, a hooded man of cracked glass
  (`props/statue_guardian.glb`, Tripo P1 from `design/level5/guardian_design.jpg`, the owner's OK for 40 credits), 2.6 m
  tall (the owner, 21/11: "smaller", then "even shorter"; 4.0, then 3.2 before; `height` in `guard_plan.py`); his model faces its own +x, as every statue made from a picture (`IVGD_YAW0` 0; π/2 had him a quarter off: the owner,
  21/11, "you have the guardian turned wrong by 90 degrees"); a dark smoky plum glass with pale cracks since 21/11
  (`IVGD_GLASS`; the owner: "I'd like him in another colour", and only his: "I didn't tell you to change the level's
  colours, only the guardian's"; of smoke, amethyst and honey he chose "the first"; a pale blue-white glass first; amber and jade tried too;
  `IV_GUARD_COL="tint;deep;cracks"` tries another). **Since 22/11 he stands in the pool's water** at the island's
  middle, no pedestal, his eyes 0.62 m over the walk, within the cube's 0.92, so the stone stops his gaze where it
  stands (the owner: "what if the guardian were just a head at the height of the cube?", then "maybe not on a pedestal
  but in the water, so his gaze is at the cube's height"; `IVGD_IN_WATER`, `IVGD_EYE_OVER`; `IV_GUARD_PED=1` sets him on
  his round pedestal again, `IV_GUARD_EYE` tries another height): nothing of him under the water is drawn (`water_y` in
  `IVGD_GLASS_SH`), his image lies in it and turns as he turns (`img_k`, `ivgd_img`), the still water's thin foam round
  him (`_ivv_churn_box`), and his gaze runs level at his eyes' height (to the mirror it rises to its disc). He turns a
  quarter clockwise at each of her moves; his gaze, a line of red light from his eyes (red since the owner, 21/11; bright, its own
  shader `IVGD_BEAM_SH`, `IVGD_BEAM_K` 1.7 and 1.35, going out softly over its last part from `IVGD_BEAM_FADE` 0.55 of
  its length: the owner, "the main laser brighter and ending in a fade out"), runs along the ways and over the water
  until the stone, she or the mirror stops it, and the discs of the way it falls on go a little red (`IVGD_DISC_A`,
  laid over each disc, `ivp_disc`), and under it whatever it passes over glows a soft red, the walk, the brown rock and the water alike (the owner,
  21/11: "the laser should light whatever surface it passes over, even the brown rocks, a little fainter and blurry"):
  the level's shader and the sea's take his line from two global uniforms (`iv_gaze`: its two ends in x and z;
  `iv_gaze2`: its breadth and strength; added in `main.gd` `_ready`, set each frame by `_ivgd_draw`, 0 in every other
  level) and light what lies within it, soft as a gaussian across, its ends fading, only on faces turned up
  (`gaze_light` in IV_SH; `IVGD_LINE_W` 0.3 m, 0.42 before: "the laser's light on the floor a little thinner and
  slightly less blurry"; `IVGD_LINE_A` 0.26). Before: strips laid over the walk and the sea
  (`IVGD_LINE_SH`, still made, kept hidden), which stopped at the rock (the owner: "along the circles that light, the
  laser should show as a blurry shadow", "the laser below, over the whole surface it passes over", "a little more
  subdued"); over the lit discs alone, and a thinner line with a bright middle, before that. Before, a broad band of light on the floor from his pedestal along it was "a
  pointless laser blur" and a ring on each place "an extra circle" (the owner, 21/11); where he will look next, a fainter
  band then, is no longer shown; where he looks now or
  next she may not end a move: seen, back to the start (`_ivg_fail`). **Seen, she goes into a red shadow and is gone
  in a red puff** (the owner, 22/11: "if the laser finds you, fade to a red shadow and then black, and go poof like the
  black shadow does"; then the same day "when it goes poof, a red shadow -> poof": no black; `_ivgd_seen_out`): the
  fourth level's shadow (`IVGL_SHADE_SH`, its three passes, denser) laid over her as it reddens, her image in the water
  going with it (0.5 s); then only the shadow, her own look and her cast shadow gone, a breath (0.2 s); the puff as the
  fourth level's (`_iv_puff`), in red smoke a little lighter than the shadow (`IVGD_POOF_COL`); his look runs
  on past where she stood; then a shorter fade back to the start, she herself again (`_ivgd_her_back`). Stepped into his
  look as it lies, she is seen there before he turns (unless his turn now brings his look back off the mirror). **Smoother**
  (the owner, 22/11: "improve the gameplay in the fifth map a little, everything a little smoother"): at each turn his old
  look goes out where it lies, he comes round slowly (`IVGD_TURN_T` 0.5 s, in and out of it), and the new look comes in
  as he arrives (before, it dimmed and jumped at once to its new way while he turned), and her next move waits till he
  is round; his look is cut where she and the stone really are as they move (`_ivgd_cut`: before, at the node they were
  going to, ahead of them). She hides behind the stone on the pier, turns the
  goddess's mirror (level 3's, flat here, a quarter a swipe) to face him, pushes the stone off the walk into the deep
  water (it sinks), steps off his line; he looks into the mirror, sees himself, frosts over, and the gate opens. Board
  `gaze_trial.py guardian()` (19 swipes, one way, the stone needed), plan `tools/go/guard_plan.py`, build
  `ivory_level.py -- goguard/level.glb goguard/level.json 505 32 goguard/plan.json`; `_ivgd_*` in `ch1.gd`; concept
  `design/level5/concept.jpg`, board `board.png`. **Its backdrop**, since 21/11 a colossal seated sculptor in marble far
  off at the left, gazing into a hand mirror, painted as level 3's goddess is (Gemini's edit of the plain backdrop, with
  level 3's backdrop for its style and a screenshot of the level for its colours: `backdrop_sculptor_prompt.txt`,
  `backdrop_sculptor.jpg`), of four offered (2 a veiled maiden with a mirror, 3 Narcissus over his reflection, their
  prompts and paintings beside it; 4 none), the owner to choose; then of these, "another background": three more, not
  statues (5 tall rocks far off, 6 a temple on a steep island, 7 an ancient lighthouse: `backdrop_rocks`, `_temple`,
  `_lighthouse`, each with its prompt), offered 21/11; a sky of great clouds was made too and not shown (it painted a
  second sun). Then the owner: "put something else in the background, and let it be 3D": three of our own 3D statues
  standing far out in the sea at the left, as level 1's Observer stands (`observer` in the level's json, built by
  `_ivw_observer`, its image in the water; `IV_OBS="x,foot,z,height,turn,model[,haze]"` tries one: about
  -10,-1.6,-5.8 for a whole statue 6.8 m tall, its head under the story's lines; the veiled bust -11.3,-3.2,-7.1, 6.5 m),
  offered 21/11: 8 the bearded colossus (`iv_colossus`), 9 the goddess (`statue_goddess`), 10 the veiled bust
  (`observer`), on the plain backdrop; 10 in the game (`observer` in `guard_plan.py` and the level's json, no rebuild
  needed) and the plain backdrop back (`goguard/backdrop.jpg`), until the owner chooses; then he said "another
  background", and of the ways put to him chose "a 3D island with ruins": **since 21/11 a far island of ruins in the sea
  at the upper left**, built as the level is by `tools/ivory_level.py` from its own plan (`tools/go/guard_far_plan.py` →
  `goguard/far_plan.json`, built in a scratch folder so no json or shore map of the level's is touched, then
  `goguard/far.glb`, `importer="keep"`): an upper terrace of slabs with a broken colonnade at its back, a lower terrace,
  its rock, two columns half sunk beside it; the game sets it down (`_ivgd_far`) a little nearer than built
  (`IVGD_FAR_AT` 1.2, 0, 1.2, so its columns stay under the story's lines), in the level's materials given to the haze
  (`IVGD_FAR_K` 0.3), its image in the water; `IV_FAR=0` leaves it out, `IV_FAR_AT="dx,dz[,scale]"`, `IV_FAR_K` try others.
  **Then painted into the backdrop** (the owner, 21/11: "can't you make the island as a picture?"): Gemini's edit of
  the plain backdrop, given a screenshot of the level with the 3D island and the island close up
  (`design/level5/backdrop_isle_prompt.txt`, its raw edit `backdrop_isle_edit.jpg`); the island cut out of it by its
  difference from the plain one (the edit lies on it exactly), made 0.85 its size about its top's middle and lowered
  0.07 of the height, so it stays under the story's lines, and laid on the plain backdrop (`backdrop_isle.jpg`, then
  cropped to 1080x1920 as `goguard/backdrop.jpg`). The 3D island is off (`IVGD_FAR_ON` false; `IV_FAR=1` brings it
  back; `goguard/far.glb` is left out of the builds).
  **Then a more surreal island, five offered** (the owner, 21/11: "shall we try another background? an island again,
  but more surreal"): each Gemini's edit of the plain backdrop, given a screenshot of the level for the island's place,
  size and look (`design/level5/surreal/`: its prompt and its raw edit), laid in smaller and lower by
  `tools/go/backdrop_place.py` so it stays under the story's lines and clear of the level (scale, x, top): 1 a floating
  island, a thread of water falling from it (0.68, 0.25, 0.225); 2 an island on a slender stem of rock, a round temple
  on it and a stair winding up (0.62, 0.24, 0.235); 3 an island coming apart upward, its stones drifting into the sky
  (0.6, 0.25, 0.146, faded out above 0.17 to 0.24); 4 an island held up in a colossal marble hand (0.6, 0.25, 0.23); 5 an
  island and its upside-down twin in the sky (0.5, 0.25, 0.215). None was liked (22/11: "I don't like the background").
  **Since 22/11 the 3D island in the air, on the plain sky** (the owner, of it: "I liked this background"): the far
  island built again by `python3 -I tools/go/guard_far_plan.py goguard/far_plan.json float` (then `ivory_level.py --
  <scratch>/far.glb <scratch>/far.json 77 24 goguard/far_plan.json`, copied to `goguard/far.glb`): no rocks or columns in
  the sea about it, the back row's middle column gone, every column turned and leaning a little its own way (a column's
  third value in a plan, [turn, lean, lean's way] in degrees, `turn_column` in the builder; the owner, of the first 3D
  one: "shadows, more detail, a column less, randomly slightly turned"), its rock under the old water line drawn into
  one jagged point under it (`hang` in a plan); the game lifts it 2 m off the water (`IVGD_FAR_LIFT`) and sets it
  nearer than built (`IVGD_FAR_AT` 3.98, 0, 2.9 since 22/11, "the island a little more to the right and lower": about
  0.07 of the screen's width right and 0.035 of its height down from 2.6, 0, 2.6, the picture the owner chose; then
  "lower and more to the right" again, 5.72, 0, 3.56, and the owner: "the floating island, leave it where it was"), its
  image in the water, and it casts its shadows (`IVGD_FAR_ON` true; `IV_FAR_FILE`,
  `IV_FAR_LIFT`, `IV_FAR_AT="dx,dz[,scale about its own middle]"` try others). **More detail on it** (the owner, 22/11:
  "on the island let's put more detail, and the short column in the trio a little more to the left"): its upper terrace
  paved in four slabs a little out of level, meeting edge to edge so the joints are thin steps (0.14 m apart the rock
  showed between them and it fell into pieces); drums of fallen columns on their sides and cut blocks lying about, an
  architrave fallen before the colonnade (the builder's `drums` [x, y, z, length, radius, yaw] and `stones` [x, y, z,
  length, depth, height, yaw] in a plan); the back row's short column a little to the left on the screen (-10.2, -7.95,
  was -9.95, -8.2). `goguard/backdrop.jpg` is the plain sky
  again (`backdrop_source.jpg` at 1080 wide, its middle 1920); `goguard/far.glb` is packed again.
  **Columns standing out of the water far behind the level** (the owner, 22/11: "in the background, in the depth, add
  columns that stick up out of the water"; then "a little crooked, and more random"): seven, one whole and six broken,
  each turned and leaning 5 to 14 degrees its own way, of other heights and girths, scattered in depth, not in a row, a
  drowned colonnade in the haze under the sun at the upper right, clear of the island and the level (`FAR_COLS` in
  `tools/go/guard_far_plan.py`, `cols` → `goguard/far_cols_plan.json`; built `ivory_level.py -- <scratch>/far_cols.glb
  <scratch>/far_cols.json 91 24 goguard/far_cols_plan.json`, copied to `goguard/far_cols.glb`, packed; a sea column's
  seventh value turns and leans it as a column's third does), laid further in the haze than the island (`IVGD_COLS_K`
  0.6; at 0.45 they stood as white as the slabs), their image in the water (`_ivgd_far_cols`; `IV_COLS=0` leaves them
  out, `IV_COLS_K` tries another haze). **Then further back still** (the owner, 22/11: "the crooked columns in 5 even
  further back"): the game sets them 1.4 m back along both ways, up the picture toward the haze, at 0.6 their size about
  their middle at the water, as farther things are smaller and closer together (`IVGD_COLS_AT`, `IVGD_COLS_C`;
  `IV_COLS_AT="dx,dz[,scale]"` tries others), and further in the haze (`IVGD_COLS_K` 0.72): their feet about 0.33 to 0.37
  of the screen's height at the start, their tops under 0.29. **Then more of them, most whole with Ionic capitals, as
  faint** (the owner, 23/11: "can we put here, faint as they are, but more columns with capitals?"): fourteen, seven
  whole with their capitals, made as the near ones are but lighter (`FAR_LOD`: a sea column's `{'lod': 1}`, twelve
  flutes, no spirals), scattered further out; then "actually not more: more massive": the same seven again, much
  stouter (0.38 to 0.42 before the game's 0.6), three whole with their capitals (`FAR_COLS`; 10.6k triangles). **The sky without its horizontal lines** (the owner,
  22/11: "the sky there has lines too", as the fourth level's): `goguard/backdrop.jpg` through
  `tools/go/backdrop_destreak.py ... 0.40 0.47` (no mask: nothing painted in it).
  **Blurred columns before the eye** (the owner, 22/11: "can we have blurred columns at the front of the screen?"): two
  broken fluted columns of our own, at the left and the right edges, their feet behind the rocks before the eye
  (`goguard/col_l.png`, `col_r.png` by `tools/go/fg_columns.py`: rendered from the game's eye, lit from behind, darkened
  toward the rocks' plum and blurred, lit from the right so their flutes read; laid on in `ch1.gd` for `go_guard`); no
  rocks before the eye in this level (the owner: "you've left blurred rocks in front too"), so each shaft runs on below
  the picture's edge (`below` in the tool: a drum of its own dice, the rest as it was). **Then figures of the story in
  their place** (the owner, 22/11: "in the fifth I don't like the blurred columns below, put something else"): painted
  alone by Gemini, then on flat green (`design/level5/fg/`, their prompts beside them), cut out, brought into the plum of
  the things before the eye and blurred by `tools/go/fg_figure.py` → `goguard/fg_youth.png` (a marble youth seen from
  behind, gazing into a hand mirror, at the lower left, facing in) and `goguard/fg_hand.png` (a marble hand holding a
  mirror up, at the lower right); `IVGD_FG` "both" (`IVGD_FG_YOUTH`, `IVGD_FG_HAND`: left, top over the foot, width at
  720 wide; `IV_FG5=youth|hand|both|cols` tries others); offered as three, the owner to choose. Then more discreet
  (23/11: "and in 5 something more discreet"): `IVGD_FG_K` scales them about their outer foot, `IVGD_FG_A` fades them
  (`IV_FG5_K`, `IV_FG5_A` try others); offered: both at 0.75 and 0.75, the hand alone or the youth alone at 0.8 and
  0.85, the owner to choose; then "put something else for the blurred one in 5", and "it needn't be 3D, it can be
  something from Gemini": one thing alone at a corner, our own statues rendered by `tools/go/fg_head.py` (a veiled
  woman from behind, the statue half out of its block, an amphora; `IVGD_FG_MORE`, `IV_FG5=veiled|amphora|mask`),
  turned down ("they don't look natural and don't match the colours"). **Since 23/11 a fallen Ionic column at the lower
  right** (`IVGD_FG` "column", `goguard/fg_column.png`): the image model added things into the level's own frame (rocks,
  reeds, a fallen column; the owner: "the column is fantastic"), then painted the column anew at the lower right, lying
  in the water with no rock under it (the owner: "make it anew from the right", "not on stupid rocks", "and blurred";
  `design/level5/fg_edit/column_water*.png`), turned the water about it green (`water_green_prompt.txt`), and it is cut
  out of the painting itself (the first of two takes, "put the first column"): its cover from how much it differs from the
  level's frame, so its own soft out-of-focus edge is kept, its colour unmixed from the frame, its inside solid, only
  the light marble where it meets the level's rocks; laid 40 px lower than painted ("just a liiittle lower"). Cut
  against the green the model made of the water, it came out harder ("here it looked very good, what did you do, it's
  badly cut again"); darkened and blurred by us, "blurred too much, I liked it as it was". Lifted out by difference or mirrored, it looked "badly cut".
  **The island in the air
  painted by Gemini, a trial** (the owner, 22/11: "try making the floating island in Gemini"): the 3D island cut from a
  still of the level (with it, without it) and laid into the clean plain backdrop where it lies in the game (the screen
  to the painting: uv = screen + `bg_off`, the painting 1.5 times the 720 screen; the follow at that moment from
  `IVR_FOLLOW_LOG`), then Gemini asked to repaint only it in the painting's style (it made the back row a colonnade with
  its architrave, and drew its rock down into a longer point); only the island's region of its picture set into the
  plain backdrop: `design/level5/isle_painted/` (backdrop.jpg, its prompt, what Gemini was given and gave); offered
  beside the 3D one (`IV_FAR=0 IV_BG_FILE=design/level5/isle_painted/backdrop.jpg` shows it). **He chose the painted
  one, a little to the right** (22/11: "the new floating island!! but a little more to the right"): `goguard/backdrop.jpg`
  is the plain sky with it laid in 40 px (27 on a 720 screen) to the right, as a difference from the sky it was painted
  on, so its soft edge leaves no seam (`python3 -I design/level5/isle_painted/lay_in.py 40 goguard/backdrop.jpg`): as far
  as it goes clear of the far columns, which are drawn over the painting (at 76, 0.07 of the width, the leftmost broken
  one stood before the island's rock; further right, move the columns with it; the
  plain sky kept as `design/level5/backdrop_plain_clean.jpg`, the 3D island's place as `island3d_mask.png`); the 3D island
  is off (`IVGD_FAR_ON` false) and `goguard/far.glb` out of the builds (`IV_FAR=1
  IV_BG_FILE=design/level5/backdrop_plain_clean.jpg` shows it on a desktop). **The painted island's image in the
  water** (the owner, 23/11: "shouldn't the floating island in 5 show a reflection below too?"): tried with the 3D
  island it was painted from, drawn only as its image (`IVGD_FAR_IMG`, `IVGD_FAR_IMG_AT`; `IV_FAR_IMG_AT="dx,dy,dz"`):
  where the 3D one stood its image fell over the painted island's own rock (the painting draws the rock's point longer),
  and raised 5.2 m so it falls under the point it lies wholly behind the walk and the gate: from the game's eye it does
  not show. Off (`IVGD_FAR_IMG` false). **Painted into the backdrop instead** (the owner: "yes" to a faint one just
  under the point; then "fix the damn reflection", "the reflection is too dark"): `design/level5/isle_painted/reflect.py`
  turns the painted island over about a line a little under its point, faint, rippled, given half to the sky's colour,
  and lays it into `goguard/backdrop.jpg` (from `backdrop_noreflect.jpg`, the backdrop without it); the sea lets the
  backdrop through where it lies open, so it shows between the island's point and the walk, and the level hides the
  rest. **Since 23/11 no island: the island's colonnade stands in the sea in its place** (the owner: "instead of the
  island, can we put the triptych of the island's columns in the water, and another 2 random columns?"; "3D with
  facets"; of the faceted repaint taken as it is beside its light laid on the painting: "make them again and not so
  subdued", "the second one I liked"): `goguard/backdrop.jpg` is the plain sky with the three columns and their
  architrave standing in the water at the left, where the island was (then 180 backdrop pixels higher, further off: "it
  looks a little out of place, I would like it higher"), and two lone broken columns, one leaning, each
  with its image in the water; painted by the image model after the island's own colonnade, then repainted by it as
  finely faceted low-poly marble and laid in as it is (`design/level5/columns_painted/`, `lay_in.py`), the two lone
  ones moved clear of the gate and the rock before them; the backdrop with the island kept as
  `design/level5/backdrop_island.jpg`. **Then real 3D columns there, on the plain sky** (the owner: "a little lower
  the upper one, but make other columns"; of three painted Ionic ones, "I don't like them"; "make columns again so they
  fit the place better"): built as the far columns are (`python3 -I tools/go/guard_far_plan.py
  goguard/near_cols_plan.json near`, then `ivory_level.py -- <scratch>/near_cols.glb <scratch>/near_cols.json 93 24
  goguard/near_cols_plan.json`, copied to `goguard/near_cols.glb`, `importer="keep"`, packed): three whole columns 2.7 m
  in a row going away to the right, an architrave across them, and two lone broken ones leaning, their feet at the
  frame's pixels in `NEAR_COLS` (a little lower than the painted one raised 120 px); the game lays them in the haze at
  0.48 with their image in the water (`_ivgd_near_cols`, `IVGD_NEAR_K`; `IV_NEAR=0` leaves them out, `IV_NEAR_K` tries
  another); `goguard/backdrop.jpg` is the plain sky again (`design/level5/backdrop_plain_clean.jpg`). A frame's pixel
  to the sea: `IV_WD_PICK="x,y;x,y"` prints the level-local point. Then in detail (the owner: "not bad, but with more
  detail, and another one near the island"): Ionic columns of drums, fluted, their capitals' volutes and spirals, the
  architrave in three fasciae in two blocks, a piece fallen (`column_fine`, `ionic_capital`, `architrave` in the
  builder, a sea column's eighth value `{'style': 'ionic'}`, a plan's `architraves`), and one whole column by the
  island (`guard_far_plan.py isle` → `goguard/isle_col.glb`, set by `IVGD_ISLE_COL`). **Then painted, as the fallen
  column below** (the owner: "I liked it more from Gemini", "a little more intense, with facets", "make it like the ones
  below, they came out very well, but standing, with a capital"; of the result, "the last one I liked"): the 3D ones
  rendered from the game at twice the size, repainted by the image model in the lower column's style and lifted as
  water details (`goguard/wd_cols.png`; `design/level5/columns_facets/README.txt`); the 3D ones are off
  (`IVGD_NEAR_ON`, `IVGD_ISLE_ON` false; `IV_NEAR=1`, `IV_ISLE=1` show them) and out of the builds. **Then edited by
  the image model directly** (the owner: "why not Gemini directly?"; "random columns where I marked", "more massive",
  "the triptych slightly fainter", "the lower and the upper ones should match the colours of the rest of the map",
  "remove these" (the lone column at the far left and the column by the island), "a little more random"): the card on
  the game's frame repainted by it (stouter, two broken columns, one leaning, and a drum in the open water between the
  row, the gate and the island), lifted again, the row a quarter into the haze behind it; the fallen column and drum at
  the lower right graded into the same marble (`design/level5/columns_facets/grade.py`); then the two broken columns
  made irregular, of offset, chipped drums with jagged tops ("they are straight like cucumbers"), and the fallen column
  and drum at the lower right at 0.85 of their size ("a little smaller still"). Tried and taken back the same day (23/11): the far
  columns out of focus ("I want them blurry"; `design/level5/far_painted/blur.py`) and the fallen column as painted, at
  its full size and place, alone (he sent the painting itself: "this here is fantastic, can you put it in 5 actually?");
  seen in the game: "bring 5 back as it was before these two changes". `IV_WD_SUB="res://a.png=res://b.png"` tries
  another picture in a card's place. **Then the painted island in the air back, higher, and of the columns only the far
  ones** (the owner, 23/11: "in 5 bring only the columns, not the lower ones, only the upper ones, and the new
  background", the floating island, of two put to him; then "keep the floating island, but higher" and "leave the text
  at the top, move only the island"): `goguard/backdrop.jpg` is `lay_in.py 40 <noreflect> -150` (150 px higher, 100 on
  the screen; its columns now reach behind the story's first line) then `reflect.py <noreflect> goguard/backdrop.jpg 24
  0.8 700 0.5 1.0 1227` (its image turned over about the same water as before, so it goes as far down as the island
  went up, behind the walk); `IV_WATER_DETAILS` holds only `wd_far`; the colonnade in the water at the upper left (it
  lay over the island) and the fallen column and its drum at the lower right are kept in `design/fg_spare/level5/`
  with their entries. He asked whether the story's lines should come at the foot, where there is more room, and then:
  "leave the text at the top". **Then (24/11) the old far columns and the island's image at a distance** ("can we have a blurred
  reflection under the island, at a distance, fading? and I want the old background", of two put to him: the old far
  columns): `goguard/far_cols.glb` is again the crooked seven of 22/11 (from 22644707; `IVGD_COLS_ON` true, packed
  again), the painted far columns (`wd_far`) kept in `design/fg_spare/level5/`; the island's image turned over about a
  water line 50 px under its point (so it starts 100 px under it), soft (9 up, 3.5 across) and fading over 320 px:
  `reflect.py <noreflect, the island 150 px higher> goguard/backdrop.jpg 24 0.75 320 0.5 1.0 1115 9 3.5`; it shows in the
  open water between the island and the walk. **Their image in the water is made
  from the card itself** (the owner: "the reflection in the water is tragic": the model's painted one was faint,
  broken and cut short): `tools/go/card_reflect.py` takes the painted water away and turns each thing over about where
  it meets the water, as the game's own images are (a column about its foot; the row and its architrave about the line
  through its legs' feet), going toward the sea's colour as it goes down as `img_k` does, never whole, a little shaken;
  about where each really meets the water at each x, the painted water kept in a band where it goes in (turned over
  about its lowest point, with no painted water left, they looked as if they flew: "they look like they're flying");
  touching things split apart (`--part` where two overlap), leaning ones about their foot, every image gone by 0.85 of its
  thing's height ("they should fade toward the bottom"). **The far columns painted the same way** (the owner, of the 3D
  ones made stouter: "you made them shit, I want them about like the ones at the left"): `goguard/wd_far.png`,
  `design/level5/far_painted/README.txt`; the 3D ones off (`IVGD_COLS_ON` false, out of the builds; `IV_COLS=1`). Made
  from the stout 3D ones they read squat ("why do you make the far ones so stubby?"): painted again from slender ones (the
  whole ones about six and a half times as tall as wide). The model will not change a thing's proportions in an edit:
  change them in the 3D it paints from. A model's green take may keep
  the haze band at a crop's top: make it green there, all but the things, before the lift. **The Guardian casts his
  shadow** on his pedestal and the way (22/11: "the guardian looks as if he stands in the air": his glass cast none).
  **Frosted, his shade is a soft lilac grey** (`frost_fill` in `IVGD_GLASS_SH`, as the slabs' shade): lit by the sun
  alone, the side away from it and his own shadow on him stayed near black as he whitened (the owner, 22/11: "when he
  whitens some spots look black"); `IV_FROST=1` frosts him from the start, for a picture.
  **The cube, four offered** (22/11: "for the square with the meander I want something else, try something yourself,
  to match in colour, and in style if you want"; `IV_CUBE_PAL="block:h,h,h,h;meander:h,h,h,h"` tries one): 1 white
  marble, its meander the rock's dark plum (`f2ebe3`; `6e5f6e`), 2 dark plum stone, its meander ivory (`857684`;
  `f1eae2`), 3 lavender grey, ivory (`bfb4c9`; `f6f1ef`), 4 terracotta, cream (`c98d76`; `f2e4d6`); then six more (the
  owner: "give a few more options for the cube"): 5 pale blue-grey, ivory (`c3cad6`; `f5f6f9`), 6 dusty rose, ivory
  (`d4aeb0`; `f8f0ef`), 7 rose-white marble, lilac-grey meander (`f3e6e6`; `9d93ad`), 8 dark slate blue-grey, ivory
  (`7b8499`; `f2f1f4`), 9 warm grey, dark meander (`cfc6bd`; `6b6160`), 10 amethyst, ivory (`a38fb3`; `f4eef6`); every
  option's four tones, lit to shade, in `IV_CUBE_PAL` form in `design/cube/options.txt`. He chose 3, the lilac grey
  with white ("the lilac grey with white, I liked it"): `block`, `meander` in `IV_WAKE_PAL`, every level. Then, the
  same day, "I want another colour and style for the cube with the meander, suggest something": four offered, its key
  kept, its stone and finish new (`design/cube/options.txt` s1-s4; `IV_CUBE_EX="block:k=v,...;meander:k=v"` sets its
  materials' own values, emit, flat_mode, veins): 1 bronze, its meander a green patina; 2 terracotta, its meander a
  black glaze, as a black-figure vase; 3 white marble, its meander gold; 4 dark veined stone, its meander a white light
  as the rings'; then eight bodies with the meander in the way's line colour (k1-k8), and eight with a meander of its own
  colour, shaded (m1-m8, 23/11: lilac grey/plum, beige/terracotta, white marble/terracotta, dusty rose/burgundy,
  blue-grey/dark blue, ochre/dark bronze, dark plum/gold, sage/dark green); he chose m1 (see level 2). Then (23/11: "is
  there something other than one big meander in the middle we can try?") six other carvings, each cut on every face by
  `tools/go/block_cube.py -- <out.glb> 0.92 11 <rosette|sun|spiral|eye|zigzag|mirror>` (a rosette of eight petals, the
  Vergina sun, a volute, the eye of ships and cups, three geometric zigzags as the film's amphora, a hand mirror), tried
  in the game with `IV_CUBE_GLB=<path>`; then patterns over the whole face (23/11: "can you try other designs too? as
  patterns?"): `checker`, `scales`, `diamonds`, `teeth`, `rings`, `waves`, `keyband` (two bands of a running meander),
  `spirals` (four small ones; 36k faces, too heavy for the game as it is); and eight more (23/11: "try other designs
  too"): `frame` (a running meander round the face's edge), `wreath`, `palmette`, `eggdart`, `basket`, `flutes`,
  `scroll`, `herringbone`. He liked `frame` ("I liked 1; can we do something around it with softer lines?"): `frame_thin`
  (finer, less deep) and `frame_calm` (two larger keys a side), each also with a lighter plum, offered. **Its lines
  light when the cube is set right, in every level** (the owner: "and they light up when the cube is activated
  correctly"; `_ivgl_meander`, the fourth level's white light on its meander, IVGL_MEA_EMIT): the second's as it comes to
  rest in its gap, the third's as it comes into its niche (`IVM_BLOCK_HOME` "NI"), the fourth's as before while its image
  stands in the square, the fifth's as it comes to rest in the deep water, before it sinks (dark again if the level
  starts over). In the water too (the owner, 23/11: "in the water I WANT it to light, just no line should come out;
  that's all I asked": it was put out there for a moment on a misreading); `IV_MEA_LIT=1` lights it from the first,
  for a picture. Of the frame cut true he said "it's too much relief, does it need so much?":
  `block_cube.py` takes a depth (its 5th value, in the source block's units, 0.726 a side; the frames were 0.026, 3.3 cm
  at 0.92 m), and the frame was offered at 0.006 (0.8 cm); then (23/11: "what if the design on the cube had lines and
  circles in the middle, like the path's?") `path4` (a ring where four ways meet, its lines running on over the edges to
  the next face's), `path2`, `path3`, `pathsq`, each line stopping at a ring's rim as the way's does, cut 0.006, subdued;
  and eight colours on `path4` ("I'd like to see other colours too"; `design/cube/options.txt` p1-p8, its lines a soft
  tone of its own colour). **He chose 1, `path4` in the lilac grey** (23/11: "I like 1; when it activates, the path and
  the circle at its centre should light"): `props/block_cube.glb` is `block_cube.py -- props/block_cube.glb 0.92 11
  path4` (cut 0.6 cm), its colours `block` `bfb4c9`, `meander` (its lines and ring) `8a7a93` in `IV_WAKE_PAL`, every
  level (the meander cube kept in the scratchpad's way only; `one` rebuilds it); lit, its lines and ring take the
  rings' white, **and the whole circle with them, never more** ("the whole inside of the circle should turn white when it
  activates"; "I asked only the inside of the circle to become white, besides the lines"): the stone within each ring is
  its own part, `disc` (`DISCS` in the builder), the block's stone with its own material, lit with the lines. A face is
  the disc only if every corner of it lies within the ring: at first the builder took a face's middle by its corners,
  which lay within the ring for the four fields round it too (their many corners run along its arc), so they were the
  disc, and lit, the whole cube went white (the owner, 23/11: "why did you make it all white"). **Since 24/11 a rose quartz, its lines a
  plum** (`dcbfc4`, `8e6878`; the owner, of six more colours on the path design, n1-n6 in `design/cube/options.txt`:
  "of the cubes I want the one that says pink"), `block`, `meander` in `IV_WAKE_PAL`, every level. Check the parts' areas
  after a build (the discs about 0.19 m2 in all). **Level 2: it lights in its gap, and no mark of the way over it or
  to it**
  ("in the first level no extra path should come out on the square, it should just activate"; "no path line should
  come out at all in 2"): the hole's node has no disc and no line of the way runs to it (their lines once rose out of the
  water as it filled). **The stone hewn** ("can we make the cube more crooked, cut and hewn? it's too straight";
  `HEWN` for the way's designs): its faces out of true 1.45 times the first cube's, seven corners broken (4.4 to 10 cm
  along the cut's normal, more along an edge), five chips (2 to 3.8 cm) running out along its edges; its marks cut
  true. Softer cuts (five corners of 1.5 to 3.3 cm, three small chips) were made when the owner said "make the cuts
  less intense", and seen beside these he kept these (23/11: "I liked this cut more after all").
  The veiled bust is out again (`observer` None). Before it (the owner, 21/11: "make something else for the
  background, whatever you like, but matching the perspective and the colours"; then of it: "I don't like the new
  background"): the ruins of a drowned sanctuary far
  off in the still sea, two rows of white columns going away into the haze, seen from above as the island is: Gemini's
  edit of the plain backdrop (`backdrop_source.jpg`) with a screenshot of the level given for its perspective
  (`design/level5/backdrop_drowned_prompt.txt`, the painting `backdrop_drowned.jpg`), laid back toward the plain one,
  0.3 of its own kept down to 0.27 of its height (under the story's lines), 0.75 from 0.36 to 0.42, 0.3 again at 0.56, where
  the ruins come near the island's top (the
  edit is aligned with the plain backdrop, so the blend leaves no ghost). Turned down: a glass colossus and the
  Colossus of Rhodes (painted from below, not as the island is seen); tried and not used: islets with a ruined temple
  (`backdrop_isles_prompt.txt`: they read as part of the level). Level 4's gate leads on into it; the end screen
  after it.
- **Level 6, being chosen (24/11)**: the twin across the water (`tools/go/twin_trial.py level6`, `design/level6/twin/`)
  kept for later ("not something with reflection, keep it for later"); the ruin's columns toppled into bridges
  (`tools/go/topple_trial.py level6`, `design/level6/columns/`) built as a scene and turned down ("no, I don't like it, I
  want something else"; its code kept in `scene_code.gd.txt`, out of the game). Ideas offered after it: the boat gliding
  on still water, the lamp at night, a turning disc ("the boat was a good direction"); a tide, shallow and deep water, a
  harbour of moored boats ("other, more open minded"); her echoes, a reclining colossus, the living Mourners, walking on
  shadows ("other?"); eight more, islands in the sky on pulleys, her boat on a sea of clouds with a weather vane, a ship
  that sails by itself, a flooding temple, the seabed, the surface of an amphora, a sea turtle, a raft on a current
  ("something out of the box?"); then walking on the still sea between the rings of the Mourners' tears, the
  sculptor's maquette that moves the real things, what looks joined is joined, her image passing from statue to statue,
  carved words that rewrite the level's rules ("give me 10 completely out of the box and clever"); then ten: the island
  that tilts under her weight, the great block she rolls by stepping off its edges (its smooth face up at the gate), the
  veil showing the temple then and now, the masks (stone, wind, sea: the water a floor, the islands walls), the mosaic of
  her face in sliding islands, leaps over statues that crumble (peg solitaire), her trail hardening into marble to carve
  the gate's pattern in one stroke, turning to stone at will, the sea that wraps round, ropes between columns that may
  not cross ("no, come on, you can do better, do a big research"). **Then a large research** (puzzle-game mechanics
  2008-2026, puzzle-design theory and classic puzzles, Greek myths and ancient machines) and ten ideas from it, each
  painted in the game's style and shown as a page (https://claude.ai/artifact/Mnp2XUPGTunAEDFvhK6Sny):
  `design/level6/ideas/` (README with rules, catches, sources and what was kept for later; the paintings and prompts).
  **The owner asked how 2 would be made ("To 2 πως θα το καναμε;")**: The Faithful, a veiled statue that takes two
  steps toward her for each of hers, sideways (the board's x) first, never a step away (water between them holds it);
  reaching her is level 5's red puff and the start again; the cracked slab holds her (a soul), not it: stepping onto it,
  it sinks and becomes stone (the script's Mourner "that she never go to the sea"; "when one is quieted it becomes
  stone"). A plate held by the statue before the gate was tried first: almost no puzzles on islet boards. Solver
  `tools/go/faithful_trial.py` (`LEVEL6`: 13 swipes, one way, 6 dead states that all end caught, no limbo; found by a
  search scored by the real decisions along the way), its film `design/level6/faithful/board_anim.py board.json <dir>`
  (a try caught at the second swipe, then the way, Greek captions); sent to the owner as a video, the build not begun.
  He: "it doesn't look very hard" (a player looking two moves ahead for danger, else heading for the ring or the crack,
  solved it 93 in 100: `tools/go/faithful_hard.py`). Now `LEVEL6` is a hard board found by a search scored by how rarely
  that player solves it (0 in 200 looking 2 to 4 ahead), 5x6, 22 swipes, one way: send it away to shut it in at the
  pier's end first, then on the crack a step up and back down brings it above her, and stepping off it she makes it
  step onto the crack; the first board is `LEVEL6_FIRST` (`board_first.json`). Then "is there no way to make it harder
  with one Faithful?": three harder boards, one statue, found by `tools/go/faithful_anneal.py` (simulated annealing,
  pruned of slabs that changed nothing; `LADDER` in the solver: 33, 37 and 44 swipes, one way each, no limbo), and all
  five made playable on a page for his phone (`design/level6/faithful/play.html`, published as
  https://claude.ai/artifact/QooUd2rD6gT39Sjr9nUfcW: swipes or arrows, the statue's rules checked against the solver on
  2,000 random move strings, the solution played on request): a solution watched looks easier than it is.
  Then "find another ten, completely original, research well, with multi-mechanism steps and cleverness": four research
  passes (chained mechanisms in games, ancient machines and automata, multi-step mechanical puzzles, myths that hide a
  mechanism) and ten ideas, each chaining three to five mechanisms, painted and shown as a page
  (https://claude.ai/artifact/2yP7BimHGKAoAJtbtgcx2Z): `design/level6/ideas2/` (README with the chains, the catches and
  the sources; the paintings, the prompts, the page). The owner: "what the hell are these, I want something very
  clever". His "πολυμήχανα" was Odysseus' word, cunning, not many machines; the ten read as contraptions. In their place
  one idea of cunning, playable: **the gaze that turns to stone** (`tools/go/stone_gaze_trial.py`): the Faithful and the
  Guardian, both already known, and one new rule: his gaze turns to stone the first statue it falls on, and the stone
  stops his gaze and her. She lures the Faithful to where, as he turns, it turns to stone at the foot of the corridor
  to the gate and shields her climb; sunk in the crack (level 6's trick), it shields no one. `LEVEL` (27 swipes) and
  `LEVEL_B` (24, a column), each one way, no limbo, the stone needed; found by `tools/go/stone_gaze_anneal.py`; both
  playable at https://claude.ai/artifact/JPUtgawNumdfmgEtrPJvDH (`design/level6/stone_gaze/play.html`, its rules
  checked against the solver on 3,000 move strings).
  The owner: "nice but a bit complicated, we keep it for future levels, can you think of something else?" **Then the
  balance** (`tools/go/lever_trial.py`): one new rule, a long marble beam on a rock in the water that tips toward the
  heavier side (weight times distance from the pivot; she weighs 1, the stone 2, so with a 5-place beam the stone's side
  always goes down; nothing on the pivot counts; empty, it stays as it was). Its ends meet the low quay (down) or the
  high terrace (up), the pivot the pier's height; stairs join heights; the stone never goes up a stair. Three boards,
  each one way, the stone needed: the counterweight (7), down to go up (18, no dead end: tip the beam with your own
  weight, push the stone onto the raised end so it rides down, come back onto the pivot by the stair and walk out to the
  end it holds up), around the stone (13, it can stick: push it past the pivot, slip out by the pier, come round onto
  the far end and push it back). Playable at https://claude.ai/artifact/N11635EHuhBfvD4A3g5Xki
  (`design/level6/balance/play.html`, its rules checked against the solver on 4,500 move strings; `boards.png`).
  Annealing (`ann2.py`-style, in the scratchpad's way) only found variants of the hand-made boards; good lever boards
  were designed by hand and proven.
  The owner, of the balance: "let's go with 2, show me", then "actually I didn't like it, something else". In its place
  the obedient ones (`tools/go/obedient_trial.py`: veiled statues take every step she takes, at once and front first,
  even when she cannot move; into the sea they sink and become stones flush with the way, so the second walks out over
  the first; off the board the open sea takes them; boards by an annealer in a frame, the gate's islet on top, a strait,
  the shore; `design/level6/obedient/play.html`, its first board only), laid aside for later when he came back: "the
  balance wasn't bad, a little smarter if we made it". **Then the scale** (`tools/go/scale_trial.py`): the same beam,
  one rule changed: when both sides weigh the same (weight times distance) it lies level, and level every place on it
  is at the pier's height and meets the piers beside it (empty, it lies level; the old rule kept it as it was). So the
  stone, twice her weight, holds her end level only at half the distance; it is loaded from a pier only while the beam
  lies level; and at the far end it raises her past a ring standing at the pier's height. Three boards, each one way,
  the stone and the level needed: the balance (7), high (16, no dead end), at half the distance (19). Playable at
  https://claude.ai/artifact/2LJpgX1E2ki1r9mWFPVpTJ (`design/level6/scale/play.html`, its rules checked against the
  solver on 4,500 move strings; `boards.png`). Found by annealing about the hand-made first board (rewarding the three
  heights used and the level at an end with the stone on the beam), then pruned of cells that changed nothing.
  The owner: "something better with a scale"; a two-pan scale was begun (`pans.py` in the scratchpad's way: the heavier
  pan sinks, she rises by throwing ballast out of hers) and stopped: "damn it, think of something clever in general",
  "not something different: completely, clever, out of the box". **Then the eye** (`tools/go/eye_trial.py`): inside the
  glass only what is seen is real, so the game's own eye is a rule: sea hidden behind something tall is not there and she
  walks over it. The eye looks down the board's diagonal from the front (the game's camera is near isometric); a pier or
  the stone one place high hides the place right behind it (in a true isometric eye its top covers that place exactly),
  a tall pier two. She pushes the stone (onto slabs only) to hide the gap she needs, then walks behind it. Four boards,
  each one way, no dead end: behind the pier (4), the stone hides (13), two stones (17), the piers (20); playable at
  https://claude.ai/artifact/NBZMKpSm3dck7Uw1eAz4KU (`design/level6/eye/play.html`, drawn isometric so the stone truly
  hides the sea, "look behind" shows what it hides; its rules checked against the solver on 6,000 move strings;
  `boards.png`). In the game it would want an orthographic camera at the isometric angle for this level.
  The owner: "not again with stones you push". **Then the island that turns** (`tools/go/turn_trial.py`): the eye's
  rule with no stones: piers hide the sea behind them as the eye sees it, and stepping onto a round disc turns the whole
  island a quarter on the sea (clockwise), so the eye sees it from the next corner and other gaps are hidden. Four
  boards, each one way: the disc (3), round and round (14, no dead end), four corners (16), the great turn (18); found
  by annealing (rewarding the views used, the turns and the crossings over hidden sea; punishing a step back and forth
  on a disc, which the first boards needed to cycle the views); playable at
  https://claude.ai/artifact/BrGTV9f9fF4oZmXtHnDK5b (`design/level6/turn/play.html`, drawn isometric and turning, its
  rules checked against the solver on 6,000 move strings; `boards.png`).
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
- **Build and check in one go**: `bash eidolon-demo/tools/web_build.sh <v> [work dir]` (the web build, stamped, its pack
  listed, the APK, then every level in a headless browser by `tools/web_check.js`: the film skipped, PLAY or the level's
  number touched, the level run 45 s; it waits on the game's logs "IV the start screen", "IV play", "IV start at the
  level"; a line "LEVEL n logs .. bad 0 reached play|true" each). Then deploy (below) and check `version.txt` on the site.
- **A fresh container** (the cloud machine is replaced now and then: the scratchpad, `/opt/godot`, the templates, the
  Android SDK, the Python packages and the API keys in `~/.config/eidolon/`, `~/.tripo/` are all gone; 23/11): Godot
  4.5.1 from github.com/godotengine/godot/releases (`Godot_v4.5.1-stable_linux.x86_64.zip` → `/opt/godot/godot`); from
  its `..._export_templates.tpz` only `web_nothreads_release/debug.zip`, `web_release/debug.zip`, `android_debug.apk`,
  `android_release.apk`, `android_source.zip`, `version.txt` into `~/.local/share/godot/export_templates/4.5.1.stable/`;
  `python3 -m pip install numpy scipy` and `--ignore-installed pillow` (the system's Pillow is another Python's);
  `python3.11 -m pip install bpy` (5.0.1); the APK's needs below, and in `~/.config/godot/editor_settings-4.5.tres` (made
  by a first `godot --headless --path eidolon-demo --import`) `export/android/android_sdk_path`, `java_sdk_path`
  (`/usr/lib/jvm/java-21-openjdk-amd64`), `debug_keystore`, `debug_keystore_user` (androiddebugkey), `debug_keystore_pass`
  (android); the site's branch as a worktree (`git fetch --depth 1 origin claude/solo-game-ideas-balatro-yj6hqw`, then
  `git worktree add --detach <dir> FETCH_HEAD`). The API keys must come from the owner again (on 23/11 he pasted the
  Gemini key in the chat; it was stored, never shown, in `~/.config/eidolon/gemini_curl` and `gemini_key` with umask 077).
- Browser build: export preset `WebWake` (feature `gowake`; other levels and unused music left out) into an empty
  folder as `eidolon-<v>.html` (`<v>` the commit's short hash), then `python3 eidolon-demo/tools/web_stamp.py <folder> <v>`:
  every file carries the version in its name, and `index.html` checks `version.txt` past all caches and moves an old
  page or an open tab onto the current version; it also resumes the page's sound at every touch and plays it as media
  on iPhone (not muted by the silent switch); it also gives the game `window.eidolonSound()` ("on" once the browser has
  let sound go). Deploy = the folder's files in place of the old ones (~120 MB). The site's Pages workflow (`.github/workflows/pages.yml` on the site's branch)
  builds and deploys in two jobs since 24/11 (the owner's OK): in one job `deploy-pages` looked for the artifact right
  after its upload and did not find it ("Found 0 artifact(s)", five runs in a row). On the web a
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
