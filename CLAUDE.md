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
- **Level 1, The Waking**: intro film (the amphora; the Theme under the narrator; fades into the start screen's soft
  dawn gradient) → start screen (faded level, black thin EIDOLON logo and PLAY, the Theme) → PLAY → the Lament. Ione
  kneels facing her way, both hands on the front knee, back and head bowed; after a second of stone stillness she
  rises in moments (8 s clip: breath, hands to the knee, weight forward, push, lunge, step, back up, head last).
  She turns the winch; the stones come up out of the water with foam on the water and on them; she climbs to the
  glowing gate, steps into its light, and is lost in it in a flash (the gate alone lights) and rising motes; the
  last line holds, then the dark end screen (EIDOLON alone: no "tap to ..." words, the owner, but the film's "tap to skip"). **The story is in
  `eidolon-world/dev/EIDOLON_SCRIPT.md`: read it before writing any line.** The player is one of the statues Theron
  carved to make Ione's face again (not Ione). Lines: "Theron went looking for her face in stone. / A thousand times he carved
  it, / and a thousand times it was not hers." (clear, a little poetic: the owner) → (stones up) "Her own face lies at the bottom of the sea. / To pass over, she must see it once more." →
  (gate) "One of the thousand went to find her." Letter: Cormorant Garamond italic.
- **Start screen**: plum dark, cream EIDOLON and PLAY, a subdued veiled statue behind (`ui/start_statue.jpg`); the
  film opens and closes in the same plum.
- **Play it in a browser**: https://ndimt.github.io/game/eidolon-waking/ (the owner OK'd publishing there).
- **Sounds** (`sfx/`, `_ivw_sfx`, the owner approved them in a preview on the level video): PLAY a low note, each story
  line a woman's sigh (not the last), the stones a swell, the gate's sound peaking on the flash, a blocked swipe a low
  pluck; the music dips 4 dB under them (its own bus). `IV_SFX_LOG=1` logs their moments.
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
  page or an open tab onto the current version (the owner once played a stale copy: "old texts, no sound"). Deploy =
  the folder's files in place of the old ones (~120 MB). On the web a
  film starts by itself (the owner). Its sound is a player of its own (`intro/intro_audio.ogg`) held to the picture
  (`_ivw_film_sync_tick`), so where a browser holds sound back until the first touch it comes in at the right place. A
  touch on the film shows "tap to skip" a while; a second touch while it shows skips (`_ivw_skip_tap`). Code that reads a file raw (`FileAccess`, the `.glb` levels and props)
  needs it kept raw in the pack (`importer="keep"` or the preset's include filter); for imported pictures check with
  `ResourceLoader.exists`, never `FileAccess.file_exists`. Earlier demos were published to GitHub Pages from the branch
  `claude/solo-game-ideas-balatro-yj6hqw` (`site/<name>/` → https://ndimt.github.io/game/<name>/); pushing there needs
  the owner's explicit OK each time.
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
