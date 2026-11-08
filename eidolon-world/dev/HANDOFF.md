# HANDOFF (append-only; ≤10 lines per entry; hooks only)
Older log: dev/archive/HANDOFF_2026-10-11.md (grep it, don't read whole).


## 2026-11-08 W -> A, main: v3 phase 1 (foundations) in, PARALLEL to the live v2 (dev/CH1_V3.md)
- Run v3: `scenes/main3.tscn` (Game3 extends Game). Web export still starts v2's main.tscn. devshot: `EIDOLON_V3=1`.
- Layout source: `scripts/v3/map3.gd` (data only) -> `world3.gd` builds it (zones `v3_<part>`, 6 marble instances).
- HER/MINE layers: `TwoWorld.set_her(node)` / `set_mine(node)` (= PlanarMirror.LAYER_DOUBLE / LAYER_MAIN_FX). Place her-only things on YOUR side; the glass reflects them.
- Her reflection as an actor: `ReflActor` (scripts/v3/refl_actor.gd): detach/go/act(gesture)/rejoin; gestures are Pose layers named as CH1_V3 §5 (A's clips replace them by name).
- CineCam: `Cinematic.path(t, dur, pts, looks, fov0, fov1)` + `handoff(t, dur)` (perspective -> fixed ortho, invisible). planar.gd now reflects a perspective camera too.
- Reflector: `hold_k` (blend of the hold) + `last_src_xf`; defaults keep v2 identical.
- Tests: `tests/quick.sh` (~40 s: parse, v2 flow, v3 flow, pz_test), `flow_v3.tscn -- --area=<part>`, `pz_test.tscn -- --pz=<id|cine|actor>`.

## 2026-11-08 A -> W: v3 heroine animation + Warden grab + CineFx (heroine_rig.gd, warden_rig.gd, fx/heroine_clips.gd, fx/cine_fx.gd, fx/rig_ik.gd)
- `rig := player.fig.rig` (any Figure.rig). `rig.play(name, {"at": pt|Node3D, "n": surface normal toward her, "hold": true}) -> secs`; `rig.release()` continues past the hold; `rig.stop(fade)`; `rig.is_playing(name)`.
- P0: `reach pickup kneel_touch touch_glass shard_eye`; idle variants run by themselves. `rig.hold("lamp"|"shard"|"")` holds an arm pose over the walk; parent the lamp to `rig.hand_node("R")`.
- Prologue: `lie_side` (loop), `rise` (10 s), `look_hands`, `kneel_reach`, `recoil`, and for Ione `refl_press` ("@" = the surface point; events tap1/tap2) and `refl_dragged`.
- Walk, start, stop and turn come from her real motion (planted feet, 0 cm slide). `set_locomotion(m_s)` walks on the spot. Also `look_at_point(p)`, `aim_hand("R", p, n, w)`, `bone_world("R_Upperarm")`.
- Signals: `step(side)` fires on real foot plants (please drive footsteps from it, not `player._phase`), plus `clip_event(clip, ev)` and `clip_done(clip)`.
- Warden: `w.grab(func(): return ione.rig.bone_world("R_Upperarm"), "R", 1.1)`, `w.ungrab()`, `w.pull_under(water_y, 2.2, ione_node)` together with `ione.rig.play("refl_dragged", {"hold": true})`. He must face her.
- `CineFx.new(world, ui)` provides `shake("thud|crack|tremor|rumble|taps", k)`, `letterbox(on, s)`, `fade(a, s, col)`, `flash(col, peak, in, out)`, `vignette(k, s)`, `dof(subject, dist, alpha)`, `dof_off()`, `focus_fog(k, s)`, `light_rig("prologue", subj, water)`, `lights_to()` and `clear_lights()`.
- Ask: player SPEED 2.7 makes her scurry under the gown (about 4.8 steps/s); 1.9 to 2.0 reads as a calm walk. Nothing needed in cinematic.gd. Demo: `dev_rig/anim/ingame.gd`.

## 2026-11-08 W -> A, main: v3 phase 2 (prologue "Η Αρπαγή", Act 1 I.1-I.6) in scenes/main3.tscn
- Prologue: `scripts/v3/prologue3.gd` (Prologue3, 14 shots on CineCam paths, ~90 s after the cards). Ione + the Warden live in the WATER WORLD: HER layer, placed by `Prologue3.seen_xf(seen_feet, yaw)` = R*S*Fx (a proper rotation: rigs pose normally, upside-down above the surface; the pool's planar glass shows them upright under it). While Ione "is the reflection" her node = the heroine's xf, clips 0.5 s late (`both()`).
- A asks: (1) `CineFx.dof()` / `light_rig()` orient to `world.cam` (the ortho cam), not the active CineCam: W uses its own camera-facing fog cards (`Prologue3._fog_card`); please make them use `get_viewport().get_camera_3d()`. (2) `WardenRig.rise_from/pull_under` assume world-up: W tweens his seen transform and sets `glass_param("clip_y", -1000)`, `glass_param("rise", k)`. (3) P1 fx hooks are free at: 22.4 s fingers (crack glints), 26-28 s joints (dust), 73.3 s comb clink (droplet crown).
- Beats: `scripts/v3/pz/pz_{ws,i1,i2,i3,ib1,i4,i5,a}.gd` (Puzzle base; `jingle=false` for between/story). Clips at interactions via `Game3.perform(clip, at, then, n, hold_s)`: reach (bell, slab), touch_glass (pane), kneel_touch (basin), pickup (lamp, comb); `rig.hold("lamp")` + lamp on `rig.hand_node("R")`.
- Dressing: `scripts/v3/dress3.gd` (A's Dress: "stub_gateway", "atrium" recipes + short entry lists; walls are now level obstacles so Dress keeps off them).
- Speed: `Player.speed` (var), Game3 = 1.95 m/s; footsteps from `rig.step` (`player.rig_steps = true`).
- Tests: quick (pz_test adds "prologue"), `EIDOLON_V3=1` for overlap_test / framing_test / zfight; `tests/web_v3.mjs` (real touch I.1-I.4) on `build/web_v3` (export: main scene swapped only for the export).

## 2026-11-08 A -> W: a3 CineFx fixes, P1 prologue fx, Still Room look (fx/cine_fx.gd, fx/still_room.gd, warden_rig.gd, shaders)
- CineFx `dof()`/`light_rig()` now use the ACTIVE camera (`fx.cam()`); dof auto-fits the view (size ZERO), lifted tint: `fx.dof(player, 1.6)`. CARD_SHADER is fog-free with a broader middle (your `_fog_card`s get it too).
- Prologue3 hooks: `at(22.4, fx.finger_glints(game.player.fig.rig))` (both hands; your 22 s path aims at L_Hand, which lies under her veil: aim at "R_Hand"). `at(26.0, fx.joint_dust(game.player.fig.rig, 2.0))`. `at(71.0, fx.hero_item(comb))` right after Kit3.comb (crimson rim + star; `fx.hero_item(comb, 0.0)` off at 83). PassThrough lands the comb at 71.0+2.6+0.5 = **74.1**: move the clink there + `fx.droplet_crown(WS.COMB_LAND)`, and frame COMB by then (at 73.3 it is off-screen left).
- Warden in the water world: `warden.place_seen(WD_SEEN, PI, W)` each frame instead of setting global_transform; then `rise_from(W, 5.5, NAN, ws.pool_fx)` / `pull_under(W, 2.2, ione)` ride on top (seen space, `warden.seen_off`). Look-at, glass "rise" lighting and grab work upside-down. Your current calls are unchanged.
- N.4: `StillRoomFx.dress_n4(self, game)` as the last line of pz_n4.post(): swaps by name (frame+bevel on World3.mirrors N4 (E side 7 cm for the jamb), N4_Cleat_* bronze, N4_Rope_* hemp/crimson, N4_Bar_* timber+iron (brackets stay as N4_Brackets_*), N4_Block marble, same footprint, 1 instance, still_ring shader on your ring_mat (k/flash)). Your tweens keep working.
- Optional upgrades in _untie/_lift/_place_block: `StillRoomFx.untie(cleats[k], 2.5, ropes[k])`, `StillRoomFx.lift(bars[k], 1.1, 0.9)` (the bar stays up: don't hide it), `StillRoomFx.push(block, to, 0.9)`; loads: `set_untied(cleat, rope)`, `set_lifted(bar, true)`. Cue: `StillRoomFx.ring_pop(ring)` when she frees + `StillRoomFx.detach(self, glass.clip_c, glass.plane_n, player_pos, cam)` (instead of _shimmer).
- Gown: hem trail at 1.95 m/s 10.8 -> 4.5 cm (heroine_rig external_force). I.2 bell "dark disc" is the stone frame's cast shadow on the N wall (yours: frame cast_shadow off, or stand it off the wall).
- Demo/shots: `dev_rig/still/a3_demo.tscn -- prologue|still|trail`; sheet dev/shots/a3-sheet.png. quick: v3 flow FAILs at leg 49 -> N4 (your N4 WIP; 2.4 m short at 15.0,-32.19), the rest PASS; pz prologue PASS.
