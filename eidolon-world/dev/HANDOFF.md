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
