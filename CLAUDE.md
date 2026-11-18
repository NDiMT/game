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
  Lara-Croft-GO-like, turn-based, swipes). Levels: `FLIP=gowake` (1, The Waking), `gosea` (2, the Drowned
  Sanctuary), `gomoon` (3), `goquarry` (4). Autoplay: `-- godemo`.
- **Level 1, The Waking**: intro film (the amphora; the Theme under the narrator; drawn by Godot itself, not a video:
  the owner found the video poor; see the skill) → start screen (faded level, black thin EIDOLON logo and PLAY, the Theme) → PLAY → the Lament. Ione
  kneels facing her way, both hands on the front knee, back and head bowed; after a second of stone stillness she
  rises in moments (8 s clip: breath, hands to the knee, weight forward, push, lunge, step, back up, head last).
  She turns the winch; the stones come up out of the water with foam on the water and on them; she climbs to the
  glowing gate, steps into its light, and is lost in it in a flash (the gate alone lights) and rising motes; the
  last line holds, then the dark end screen (EIDOLON alone: no "tap to ..." words, the owner, but the film's "tap to skip"). **The story is in
  `eidolon-world/dev/EIDOLON_SCRIPT.md`: read it before writing any line.** The player is one of the statues Theron
  carved to make Ione's face again (not Ione). Lines, short and clipped (the owner: "πιο κοφτά", and tied to the script: first that Theron searched for a
  way to bring her back, last "he carved her face a thousand times"): "Theron searched for a way / to bring her back."
  → (stones up) "Her face lies under the sea. / She must see it to pass over." → (gate) "He carved her face a
  thousand times." Letter: Cormorant Garamond italic.
- **The film's textures** (`intro/vase/`): three texture arrays (`strips.jpg`, `pans.jpg`, `texts.png`, sliced in
  their `.import`), the vase and the words at the film's full size. A phone gives a canvas shader 16 textures, and
  Godot takes three of them plus the six highest units for itself. With one texture per piece (17 sampled) the film
  was not drawn at all on phones, while a desktop browser (32) showed it. Keep any canvas shader to 8 textures or fewer.
- **Start screen**: plum dark, cream EIDOLON and PLAY, a subdued veiled statue behind (`ui/start_statue.jpg`); the
  film opens and closes in the same plum.
- **Play it in a browser**: https://ndimt.github.io/game/eidolon-waking/ (the owner OK'd publishing there).
- **Sounds** (`sfx/`, `_ivw_sfx`, the owner approved them in a preview on the level video): PLAY a low note, each story
  line a woman's sigh (not the last), the stones a swell, the gate's sound peaking on the flash, a blocked swipe a low
  pluck. No audio bus made while the game runs and no dip under the sounds: with one, a phone's browser played nothing in
  the level. `IV_SFX_LOG=1` logs their moments.
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
- **The camera** holds the whole map and follows her a little, smoothly and a little behind; on larger maps it goes
  with her but shows little past the edges (`_ivr_follow` in `ch1.gd`).
- **Music per level** (`_go_level_music` in `ch1.gd`): waking Lament, sanctuary Requiem, moon Elegy, quarry Stone,
  any other Last Light; the Theme under the intro and the start screen. The owner liked the Theme, the Lament and
  its four variations. Dark orchestral, never piano, a wordless female voice only at moments.
- **The heroine Ione** is the owner's own design (`eidolon-demo/design/ione5/`): marble woman in spiral terracotta
  bands. Model: multiview → smart low-poly (owner's choice), rigged and built by `tools/ione4_build.py` into
  `hero_models/ione4r*.glb`. Review her clips with `tools/go/hero_look.py` (her colours, the game's eye).
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
  `ResourceLoader.exists`, never `FileAccess.file_exists`. Earlier demos were published to GitHub Pages from the branch
  `claude/solo-game-ideas-balatro-yj6hqw` (`site/<name>/` → https://ndimt.github.io/game/<name>/); pushing there needs
  the owner's explicit OK each time.
- APK: preset `AndroidWake` (arm64, the browser build's filters, `com.eidolon.waking`) →
  `godot --headless --path eidolon-demo --export-debug "AndroidWake" build/android/eidolon-waking.apk` (~92 MB). A new
  machine needs: the 4.5.1 templates' `android_debug.apk`/`android_release.apk` (from `export_templates.tpz` at
  downloads.godotengine.org) in `~/.local/share/godot/export_templates/4.5.1.stable/`; `build-tools_r35.0.1_linux.zip`
  and `platform-tools` from dl.google.com in `/root/Android/Sdk/`; a debug keystore made with `keytool` at
  `~/.local/share/godot/keystores/debug.keystore`. Google Drive takes only 10 MB from here: the owner gets the APK from
  the site, https://ndimt.github.io/game/eidolon-waking/EIDOLON-waking.apk (pushing there still needs the owner's OK).
- The cloud machine has 4 cores and no GPU: about 1 s per 720x1280 frame, so a 50 s level video takes ~35 min.
  Drive every motion by the game's time (`iv_t`, shader `TIME`), never the wall clock, or it races in recordings.
  Faster options: cheaper render settings for recordings; splitting a video over parallel cloud sessions; a machine
  with a GPU (the owner's computer via Remote Control, or a self-hosted GPU environment).

## Costs (to 17/11/2026)
- Gemini, 10–16/11/2026: about $95–100 (video ~$60, images ~$32, music ~$1.5, voice <$0.5). Tripo: 420 credits left.
- Cheaper: draft videos at 720p and only finals at 1080p; non-urgent images through the batch API (about half).

## Git
- Work on branch `claude/arrow-pro-3d-game-2tki08` (draft PR #2). Never push elsewhere without permission.
- End commit messages with the trailer the session gives. Large binaries (models, music, intro) are committed as
  the game needs them; never commit scratch renders or videos.
