# EIDOLON: brief for agents (read this first, and only this, plus your task)

**Game:** Godot 4.5.1, Compatibility renderer, single-threaded WEB export, portrait 390×844, mobile touch. Live at https://ndimt.github.io/game/eidolon-world/.

**The owner:** Greek, impatient, cost-conscious. Wants everything SOLID, smart and beautiful, and hates dumb puzzles.

**Story source of truth:** `dev/EIDOLON_SCRIPT.md`. Read only the sections your task names: §1 truth, §5 intro/prologue, §6 storyboard (Chapter I), §10 consistency.

Old docs are in `dev/archive/` (history only; don't read them unless told). The old HANDOFF is `dev/archive/HANDOFF_2026-10-11.md`; grep it, never read it whole.

## Token discipline (mandatory)
- **Logs and searches:** never dump logs or whole files. Use `grep`/`tail`/`sed -n`, and read only the functions you need.
- **Screenshots:** take as few as possible. Look at them at 1× and only when judging visuals. At most ONE contact sheet per report.
- **Tests:** use `tests/quick.sh` while iterating. Run full `tests/smoke.sh` ONLY at the end of a phase (wrap it in `timeout 1800`).
- **Reports to main:** at most about 15 lines: what changed, test results, shot paths, blockers. No narration.
- **HANDOFF:** `dev/HANDOFF.md` is append-only. Keep each entry at most about 10 lines with code hooks only, and read only the last entries addressed to you.

## Roles and ownership (strict; never edit the other agent's files, ask through HANDOFF)
- **W (world / gameplay / INTEGRATOR):**
  - Owns `scripts/` (except the A-owned files below), `tests/`, layout, puzzles, UI, save and story text.
  - Is the only agent who exports `build/web` and runs `smoke.sh`.
- **A (art / tech-art / fx / animation):**
  - Owns `shaders/`, `assets/`, `scripts/fx/*`, `scripts/world.gd` (look, moods, tiers), `scripts/flame.gd`, the rigs (`heroine_rig.gd`, `warden_rig.gd`, `wanderer_*`), and Tripo.
  - Tripo: tripo-cli is logged in. Ask main before spending more than the cap you were given.
- Nobody commits, pushes or deploys. Main does that.

## Owner's standing rules (non-negotiable)
- **Camera (gameplay):** fixed. No rotation, no zoom. 7.5 m view width. It follows her. Rooms need not fit on one screen.
- **Cinematics:** the camera MAY move freely.
- **Placement:** nothing blocks the view or the path, no overlaps, no floating.
- **Pacing:** never two puzzles back to back; put landmarks or in-between moments between them.
- **Structure:** the hub has three wings. Chapter I goes from soft to hard.
- **Items:** Chapter I has only the Lamp and the Shard, plus the shell comb (a story item). Items must make story sense.
- **Heroine "A":** porcelain mirror-oval face, grey dress, dark veil, marble skin.
- **Her reflections:** they wear a crimson dress.
- **Accent colour:** crimson everywhere. The occluded x-ray outline uses the accent colour.
- **Mirrors:** they look like REAL reflections (planar).
- **Fog glass:** the SMALL side glass is fogged. HER hand, behind the glass, writes with realistic finger strokes.
- **Shadow chamber:** bold red eyes, aligned to the faces. No brazier may cover an eye.
- **Audio:**
  - Footsteps are subtle.
  - Music is soft but audible.
  - There is a solve jingle.
- **Quality:** default is High, and it must be very smooth (no frame over 4 ms of script, no hitch on entering a room).
- **Assets:** keep ALL the Tripo models (heroine, Warden, kit_*, statues, items, comb, Observer, braziers, doors, gate).

## Web pitfalls
- **Shaders:** no `DEPTH_TEXTURE`, no screen texture, no dual-paraboloid omni shadows.
- **Textures:** Basis textures fail on the web.
  - GLB `embedded_image_handling=0` DISCARDS textures. Use 3 for any GLB drawn with its own material.
  - Marble GLBs are fine at 0.
- **Marble instances:** the per-instance GL buffer allows at most 256 marble MeshInstances, and the flow test fails above 250. Merge meshes.
- **Audio:** static bus layout, Sample playback, short loops.

## Architecture (current v2; check before you change)
- **World:** `scripts/v2/map2.gd` (Map2) is the layout source of truth: spaces, beats, walk regions, water, walls, doors, pieces, route, moods.
- **Act and chapter logic:**
  - `scripts/act1.gd`, `scripts/v2/act3.gd`, `scripts/chapter.gd` (wings, pool, Gate, Shrine), `scripts/prologue.gd`.
  - `scripts/v2/wings_geo.gd` and `lv_off.gd`: the v1 rooms, shown at offsets.
  - `scripts/our_steps.gd`: the mirror board puzzle.
- **Systems:** `main.gd`, `player.gd`, `controls.gd`, `cinematic.gd`, `items.gd`, `satchel.gd`, `ui.gd`, `audio.gd`, `juice.gd`, `life.gd`, `warden.gd`, `planar.gd` / `reflector.gd` (mirrors).
- **A's fx:** `scripts/fx/`, including `dress.gd` (landmark dressing), `omen_fx.gd`, `pass_through.gd`, `beacon_fire.gd`, `intro_card.gd`, `fog_bank.gd` and `map_view.gd`.

## Tests
- **`tests/quick.sh`:** parse check plus targeted checks, about 2 min. Use it while iterating.
- **`tests/smoke.sh`:** the full suite, about 13–20 min. It covers:
  - the headless playthrough;
  - the web smoke;
  - the Our Steps real-touch test (`web_oursteps.mjs`);
  - `flow_v2`.
- **Also before a phase ends:**
  - `tests/overlap_test.tscn`
  - `tests/framing_test.tscn` (occlusion)
  - `tests/zfight.tscn -- x,y,z …`
- **Browser jobs:** `flock /home/user/game/realms/dev/.shotlock timeout 600 node …`. Playwright is at `/opt/node22/lib/node_modules/playwright/index.mjs`. Godot is at `/opt/godot/godot`.
- **HTTP server:** `cd /home/user/game && (setsid nohup python3 -m http.server 8123 >/dev/null 2>&1 </dev/null &)`.
- **Stale class cache** ("X not declared"): run `/opt/godot/godot --headless --import`.
- **Known flake:** "Caller thread can't call this function". Retry once.
