# EIDOLON v3: Chapter I "The Veiled Gate", design (single source for Chapter I)
Built from `EIDOLON_SCRIPT.md` §1, §5, §6 (Ch I) and §10. Map: `dev/shots/v3-map.png` (made by `tests/render_map3.py`, which holds the draft layout data).
**Status: DESIGN, waiting for the owner's approval. Nothing is built yet.**

## 0. Principles
- **One world law, taught three ways.** *What shows in the water or glass counts, and it isn't quite you* (I.1). *She is a separate person* (the delay, the strokes). *Stillness lets her act* (N.4 → I.22 → the rune **Stillness**).
- **Two-World layers (new core tech).** Objects that exist only in HER world render only in the planar/water camera (cull layer `HER`). Objects only in yours are hidden from it (`MINE`). One system serves I.1, I.4, N.1, N.4, W.3, W.6 and I.20, with no per-puzzle hacks.
- **Touch first.** Every input is one of four: walk (stick or tap-to-walk), tap interact, hold (lamp, Shard, breath), or trace on a fog pane. No grids that need exact steps, no step counting, no timing windows under 1 s.
- **Puzzle contract.** Each puzzle has 0 fail states or a soft return of 2 s or less. It gives a hint at 45 s (she knocks twice in the glass where to look). It has a solve jingle, latched progress, and saves to one key.
- **Pacing.** Puzzle → in-between/landmark → puzzle, with no exceptions. Each wing goes from ★★ to ★★★★. Act 1 is ★ only.

## 1. Spaces (route order; sizes in metres; see map)
| # | id | beat | kind | size | sees / does |
|---|---|---|---|---|---|
| 1 | WS | P | story | 12×4 shore + pool | Prologue cinematic. She wakes by the pool. Comb. The path lights. |
| 2 | I1 | I.1 | puzzle ★ | 8×9 | A still water sheet. A plate glows only in the water. The door opens. |
| 3 | I2 | I.2 | between | 5×6 | The Bell: tap, and far bells answer. This teaches interact without pressure. |
| 4 | I3 | I.3 | puzzle ★ | 5×14 corridor | A fog pane mid-path. Breathe; her finger writes 1 stroke; trace it; a low gate rises. |
| 5 | IB1 | – | between | 7×6 | Reed Bank: reeds, lapping water, her reflection lingers a beat. |
| 6 | I4 | I.4 | puzzle ★ | 10×7, stream | The One Slab: turn it until it meets its half in the water, and a bridge forms. |
| 7 | I5 | I.5 | story | 7×9, dark | The Crypt. Her hand pushes the lit Lamp up through the basin, and the Warden turns. Theron's bed. Wax tablet. |
| 8 | A | I.6 | hub | 20×20 | Atrium: faces on plinths, a dry fountain, 3 dead Beacons. The map opens. She looks West. |
| 9 | WR | – | between | 8×3 | Inlet Road along the Lagoon. The Observer head is seen. |
| 10 | W1 | W.1 | puzzle ★★ | 4×14 stair | Stair of Breath: a 2–3 stroke rune on the pane, the wall rune lights, the stair rises. |
| 11 | W2 | W.2 | between | 4×4 | The Offering: touch a flower, a small flame lights. |
| 12 | W3 | W.3 | puzzle ★★★ | 10×11, N mirror 8 m | Hall of Glass: the mirror shows the room as it WAS. Push 3 things back. Crack. **Shard**. |
| 13 | W4 | W.4 | story | 6×3 | Star Corridor: raise the Shard, and a star carved in HER ceiling shows. (This teaches the Shard.) |
| 14 | W5 | W.5 | puzzle ★★★★ | 10×11 | Where Her Shadow Fell: 5 braziers, 3 red-eye pairs, 1 wrong brazier lit. |
| 15 | IBW | – | between | 6×5 | Ash Landing: a wax tablet, the wind, the view. |
| 16 | W6 | W.6 | between (reveal) | 6×6 | Hidden Way: through the Shard, a door exists only in her world. Walk through. |
| 17 | WB / W7 | W★ / W.7 | landmark | 10×8 + 21×3 | Light the Glass Beacon. Return over stones past the 8 m Observer face. |
| 18 | N1 | N.1 | puzzle ★★ | 6×10, water | Flooded Colonnade: all the stones look alike. In the water she walks the true ones. Follow her. |
| 19 | NG | – | between | 10×4 | Garden Landing: a fig tree, bees, a bench. |
| 20 | N2 | N.2 | puzzle ★★ | 12×12, N mirror | The Turned Ones: turn 3 statues so the MIRROR shows her 3 symbols. |
| 21 | N3 | N.3 | between | 4×6 | The Votive: light it with the Lamp. |
| 22 | N4 | N.4 | puzzle ★★→★★★ | 10×10, N mirror 8×3.5 | **The Still Room (new, §3).** |
| 23 | IBN | – | between | 5×6 ramp | Wind Ramp: torn veils stream uphill. |
| 24 | N5 | N.5 | puzzle ★★★ | 14×12 | Court of Light: turn mirrors so the beam reaches her fresco. YOU are its last piece. |
| 25 | N6 | N.6 | landmark | 6×6 | Tree of Shards: 300 hanging shards chime. |
| 26 | N7 / NB | N.7 / N★ | puzzle ★★★★ / landmark | 12×12 / 10×8 | Mist Maze, then the Garden Beacon. The Cloister Stair shortcut leads home. |
| 27 | ER / E1 | – / E.1 | between / landmark | 8×3 / 5×20 | Climbing Road, then the Balcony: sit on the bench, and the view pans to the Observer. |
| 28 | E2 | E.2 | puzzle ★★ | 10×10 | Singing Stones: she plays the melody once. Step it on 4 stones. |
| 29 | IBE | – | between | 3×6 stair | Veil Stair. |
| 30 | E3 | E.3 | puzzle ★★★ | 4×35, E mirror | Mirror Walk: the Warden patrols IN the glass. Hide behind columns when the glass mists. |
| 31 | E4 | E.4 | landmark | 4×6 | Upward Spring: water rising toward a hanging temple. |
| 32 | E5 | E.5 | puzzle ★★★★ | 12×12 | The Scales: the balance counts your reflection. |
| 33 | EB / EH | E.6 / E★ | landmark (+★ payoff) | 10×10 / 4×48 | High terrace: I.1's plate again (15 s), the High Beacon, the stair down. |
| 34 | VW | – | between | 4×14 | Veiled Way: the Atrium's south gate sinks once 3 Beacons burn. |
| 35 | P / PW | I.20 | puzzle ★★★★ | 9×7 pool | Pool of Halves (the waking pool, now unfogged): 4 slabs, I.4's rule. A road rises. |
| 36 | I21 | I.21 | story set-piece | 20×3 | Bridge that Gives Way over the Lagoon. Spans settle and fall behind you. |
| 37 | I22 | I.22 | puzzle ★★★ | 12×11 | Gate of the Four: 3 veiled statues and an empty plinth. Stand on it and be still. |
| 38 | I23 | I.23 | story | 12×12 | First Shrine (cinematic): palm to palm, ΒΡΕΣ ΜΕ, a glass eye opens. Rune **Stillness**. |

## 2. Puzzles
| beat | rule (1 sentence) | learned without text: teach → test → twist | solve | feedback / juice | fail / reset |
|---|---|---|---|---|---|
| I.1 | The door opens while your *reflection* stands on the plate that exists only in the water. | The plate glows only in the water (HER layer). Walking over it, the door groans **0.5 s after you**. Stand there, and she arrives late and it opens. | 20–40 s | Plate ring pulses crimson, low stone groan, door dust, jingle | None. It latches after 1 s. |
| I.3 | Trace the stroke her finger writes. | Breathe (hold), the pane fogs, her finger writes 1 stroke. Trace it (direction-free, 40 px tolerance). | 30–60 s | Squeak, drips run, glass glows, gate rises | A wrong trace fades and she rewrites it slower. |
| I.4 | The slab is whole only when its real half meets its reflected half. | Tap turns it 90°. The other half lies only in the water. When it aligns, the seam glows and the stone "grows" a real bridge. | 20–40 s | Crimson seam, stone thunk, bridge grows | 4 states, cycles. |
| W.1 | As I.3, but a 2–3 stroke rune in order. | Teach: I.3. Test: 2 strokes. Twist: her strokes come mirror-reversed (you are inside the glass). Trace what you SEE. | 45–90 s | Each stroke lights on the wall rune, the stair rises step by step | Per stroke. After 2 misses she dots the start points. |
| W.3 | Put the drum, the brazier and the bust where the mirror remembers them. | Teach: the bust already matches (its real and reflected images fuse, with a chime). Test: push the drum (1 m slides on rails). Twist: the brazier's remembered spot is hidden behind a column in the glass. Move yourself; real planar parallax reveals it. | 2–4 min | A ghost double-image converges then fuses, chime, crack, she pushes the **Shard** through | Rails only (nothing jams). A rope by the door resets all. |
| W.5 | A shadow falls away from the fire. Light the braziers whose head-shadow "wears" each red-eye pair. | Teach: 1 wrong brazier is lit and its shadow misses. Test: the first pair. Twist: one pair needs 2 braziers at once. | 3–5 min | Shadow lands, eyes blaze, hum per pair | Toggles are free. The urn snuffs all. |
| N.1 | Only the stones she treads in the water hold you. | She walks ahead in the reflection. Every stone looks alike from above. | 30–60 s | Her crimson ripples per step | A false stone sinks slowly and returns you to the last true one (2 s). |
| N.2 | Turn each statue so the MIRROR shows the symbol she wrote. | Teach: a symmetric symbol. Test: a 2nd one. Twist: an asymmetric symbol reads flipped in the glass. Pick the face whose mirror image matches. | 2–3 min | The symbol glints crimson in the glass, then locks | Tap = 90°, cycles. |
| **N.4** | **When you are still, she is free. She acts in her world, in the bay where you stopped.** | See §3. | 2–3.5 min | Stillness ring, her detach shimmer, muffled through-glass sounds | No fail. Progress latches. |
| N.5 | Turn mirrors so the beam reaches her fresco. Your veil's shadow is the missing piece. | Teach: 1 mirror. Test: 3 mirrors. Twist: the beam stops at a gap, so stand in it. | 3–5 min | Beam sparkle along its path, the fresco lights up section by section | Tap = 45°, free. |
| N.7 | The Lamp shows her red footprints, only inside its light. | Teach: a straight run. Test: turns. Twist: a fork where one set is the Warden's (large, glassy, not crimson). | 2–4 min | Prints bloom in the lamp circle | Mist walls push softly. The Warden whispers. No reset. |
| E.2 | Step the 4 stones in the order of her melody. | Teach: 2 notes. Test: 4 notes. Ring the small bell to replay. | 1–2 min | Each stone sings and glows | A wrong note dims all softly. Start over. |
| E.3 | When the glass mists at a spot, the Warden will look there. Be behind a column. | Teach: 1 column, slow patrol. Test: 3. Twist: 2 mist warnings at once. | 2–3 min | Mist creeps on the glass about 1.5 s before he turns, plus a heartbeat | Seen: fade to white, back to the last column (checkpoints). |
| E.5 | The balance counts your reflection, which stands on the far pan. | Teach: you alone tip it slightly. Test: hang weights. Twist: the weights can't win alone, so stand on a tile (×2 on the mirrored side). | 3–5 min | Arm creaks, a level chime, the lift rises | Weights re-hang freely. |
| I.20 | I.4's rule ×4: every slab must meet its half. | It's the waking pool, now unfogged. The player already knows the rule. | 3–5 min | Slabs rise out of the water and the road forms | Cycles. |
| I.22 | The gate counts four statues. Be the fourth: stand on the plinth and stay still. | It foreshadows N.4 (stillness). The 3 Beacons burn. | 30–90 s | Veils stir, a stone pose creeps up her limbs | Moving resets the 3 s count. |

## 3. The mirror puzzle redesign (replaces "Our Steps")
| | candidate | pros | cons |
|---|---|---|---|
| **A ✔** | **"When You Are Still" (Όταν σταματάς).** A big planar mirror (8×3.5 m) on the room's N wall. While you move, the crimson reflection copies you (0.5 s late). When you **stop for 1 s**, she breaks off and acts on her own in HER world, in the bay where you stopped. The mirror shows things that exist only on her side, near the glass. | One rule, easy to discover (everyone stops in front of a mirror). Zero precision: a bay is about 3 m wide. Pure story ("she helps when he isn't looking"), and it teaches the chapter's rune **Stillness** before I.22. | New tech: the reflection becomes an autonomous actor (paths and anims in her world). It needs the HER cull layer. |
| B | **"Two Doors."** Her room has doorways where yours has walls. She copies you and is blocked by HER walls, so you walk into your wall to steer her through her doorway. | Very literal "different world". | Steering is precise input with collision confusion. It's the same family as Our Steps, which the owner hated. |
| C | **"Look Away."** She moves only while your back is to the glass (weeping-angel style). | Spooky, and good Warden synergy. | Facing is ambiguous at a fixed ortho camera on touch, and you can't watch her while she acts. That's frustrating. |

**Recommended: A, "The Still Room" (N.4).** Room 10×10. Three floor bays (W, C, E) are marked by mosaic rugs and split by 2 low planters, not columns. The exit is on the E wall and shows in the glass. Your exit is a glass-sealed door: it opens when its reflection shows it unbarred (I.1's law).

| stage | in HER world (mirror only) | you do | she does | result |
|---|---|---|---|---|
| Teach | 1 bar on the door's reflection; its rope runs to a cleat by the glass in bay C | walk in (she copies, late), stop anywhere in C | a 1 s ring closes at your feet, her figure shimmers free, she unties the C cleat (2.5 s) | the bar lifts in the glass; the antechamber door opens ("when I'm still, she's free") |
| Test | 2 bars; cleats in bays W and E | stop in W, then in E (any order) | unties each | 2 bars up |
| Twist | the 3rd cleat hangs HIGH in bay E. She reaches, can't, and shakes her oval at you | push the stone block (it is real, so it exists in BOTH worlds) along its 3-slot rail into bay E (tap = 1 slot), then stop in E | climbs the block's reflection and unties | door clear in the glass → your door opens, jingle |
| Flourish (P1) | glass mists and the Warden's reflection crosses her room | nothing (wait) | she snaps back to copying you exactly, pretending | story beat only, never a fail |

**Fixes for every old complaint.**
- The reflection is always present; it is a mirror.
- No columns, no grid, no step counting.
- An action, once started, always finishes. If you move mid-action, she finishes first and then rejoins you, so no input is lost.
- Bars latch, so the puzzle can't break.
- The hint at 45 s: she knocks twice on the glass in the bay to try.
- Tests: headless `pz N4` autosolve, plus `web_still.mjs` (real touch: walk, stop, tap the block).

## 4. Intro cinematic "Η Αρπαγή" (perspective CineCam; ≈24 s cards + 95 s prologue)
- **Tech.**
  - A separate perspective `Camera3D` with Catmull-Rom position/target/fov keys (an extension of `cinematic.gd`). Hand-off: the last shot lands on the gameplay framing while fov narrows to ≈8°, then cuts to ortho, invisibly.
  - **DOF is not available in Compatibility.** Rack focus is faked with depth fog cards, a vignette and exposure on the subject.
  - The planar water must render from the active CineCam.
- **Skipping.** The first view is unskippable (save flag `seen.prologue`). After that, a long press skips it.

| # | shot | camera | s | character anim | fx | audio |
|---|---|---|---|---|---|---|
| 0 | Text cards (§5), each first mirrored, then turned | — | 24 | — | card flip (intro_card, exists) | sea |
| 1 | Fog to black water; the back of the Observer's veiled head | crane down 30→3 m through fog, slow push | 10 | — | fog-card descent, black swell water, veil ripple | drone, distant bell |
| 2 | Across the water to a marble threshold | low lateral dolly 0.4 m over water | 7 | — | mist wisps, water specular glints | water |
| 3 | Her lying on her side, porcelain hands, mirror-oval face | overhead, slow 15° rotate + descend | 6 | H lying_side | crack glints on hands, dust motes | water lap |
| 4 | Fingers twitch | macro on hand, static | 4 | H finger_twitch | — | tiny stone tick |
| 5 | She rises unnaturally | low angle, crane up with her | 9 | H rise_unnatural | marble dust at joints | stone grinding |
| 6 | In the pool her reflection rises 0.5 s late, in crimson | over-pool 3/4, slow push | 7 | R rise_delayed | planar water, crimson rim | one lyre note |
| 7 | A crimson palm presses up and knocks twice | top-down on the surface | 6 | R palm_up_knock | 2 ripple rings, surface bulge | 2 glass knocks |
| 8 | She kneels and reaches | side medium, push-in | 7 | H kneel_reach | — | Ione's 4 notes |
| 9 | Behind the red figure, the Warden rises in the water | through-surface view, faked rack focus R→W | 9 | W rise_from_depth | cracks race over the water, light dims, cold shimmer | deep crack, sub boom |
| 10 | A glass hand on her shoulder; she turns her oval to us | close 2-shot, still | 6 | W grab_shoulder, R turn_oval | glass glint | melody cuts |
| 11 | He drags her into the water's mist | whip push-in, then pull back | 6 | W drag_away, R being_dragged | suction vortex, mist inrush | suction |
| 12 | The comb falls up through the surface and clinks on marble | tilt following the comb, slow-mo | 6 | R drop_comb | droplet crown, comb glint | clink |
| 13 | The pool shows only her, still 0.5 s late | wide, static | 6 | H stand_look, R delayed copy | water calms | sea |
| 14 | She takes the comb; it glows; the first path lights | crane back to the gameplay framing → ortho | 6 | H pick_up | lanterns ignite in sequence, comb glow | Chapter I theme |

## 5. Animation list for Agent A
- **Constraint.** The reflection copies the heroine's pose 0.5 s late, so every H clip must be sampleable by time. Deliver clips on the rig (an AnimationLibrary); W layers lean and cloth over them.
- **Who:** H = heroine (grey dress), R = reflection (same rig, crimson), W = Warden.
- **Type:** G = gameplay, C = cinematic.

| P0 (blocks phase 2–3) | P1 | P2 |
|---|---|---|
| H/R idle_breathe, walk (heavier hips), walk_start, walk_stop (dress overshoot) G | H idle_look_around (after 6 s) G | H idle_veil_adjust, idle_cold G |
| H interact_reach (mid) G | H reach_low, reach_high, turn_in_place (>120°) G | H sit_bench (E.1) G |
| H push (loop), pick_up, kneel_touch_water (hold loop) G | H step_up, step_down (0.25–0.5 m), stairs lean G | H flinch_seen (E.3) G |
| H touch_glass, breathe_on_glass G; trace_glass arm follow G (P1) | H ring_bell, hide_column (back to column) G | H false_stone_stumble G |
| H hold_lamp, raise_shard (upper-body layers over walk/idle), light_with_lamp G | H statue_still (stone creep pose, I.22) G | R write_in_water "ΒΡΕΣ ΜΕ" C |
| R untie_cleat, reach_fail_shake, climb_block (N.4) G | R gaze_turn (I.6), finger_write (pane, exists: upgrade) G | W sighting_stand (behind you in glass) G |
| R knock_glass_twice G+C, push_through (lamp/Shard) C, palm_to_palm (I.23) C | W look_turn (E.3) G | H finger_twitch C |
| W patrol_walk G; rise_from_depth, grab_shoulder, drag_away, whip_turn (I.5) C | H stand_look, pick_comb C; R drop_comb C | |
| H lying_side, rise_unnatural (joints lock/pop out of order), kneel_reach, turn_oval C; R rise_delayed, palm_up_knock, turn_oval, being_dragged C | | |

## 6. Effects list (A; new = ●, upgrade = ○)
| where | P0 | P1 / P2 |
|---|---|---|
| global | ● HER/MINE cull layers (W+A), ● stillness ring, ● solve burst (crimson motes), ○ door/gate dust + rumble | ● her detach shimmer (P1), ○ mood dust motes (P1), ● touch ripples on all water (P1) |
| prologue | ● fog-card crane descent, ● black swell water, ● cracks racing over water, ● suction vortex, ● path lanterns igniting | ● crack glints on porcelain (P1), ● joint dust (P1), ● comb glint/crown splash (P1), fake rack-focus card (P1) |
| Act 1 | ● I.1 plate in water only, ● I.4 crimson seam + bridge grow, ● I.5 lamp breaching the surface (meniscus pop), ● lamp light circle | ○ I.3 condensation drips (P1), ● I.6 sun shafts and dead Beacons (P1) |
| West | ● W.3 ghost-image fuse + corner crack, ● Shard lens (circle into HER world), ● W.5 eyes blaze, ○ Beacon ignite | ● W.6 hidden-door shimmer (P1), ● Observer caustics (P1) |
| North | ● N.1 crimson step ripples, ● N.4 bars/cleats/ropes in HER layer, ● N.5 beam, ● N.7 lamp-revealed prints | ● N.4 Warden mist on glass (P1), ● N.6 300 shards (MultiMesh) sparkle (P1), ● N.5 fresco reveal (P1) |
| East | ● E.2 stone note rings, ● E.3 mist-on-glass warning | ● E.4 upward water shader (P1), ● E.1 petals/veils wind (P1) |
| Act 3 | ● I.20 fog lift and slabs rising, ● I.21 spans settle and crumble, ● I.23 palm ripple + water writing + glass eye | ● I.22 veils stir + stone creep (P1), ● rune card (P2) |

## 7. Build phases (≈ = new or rewritten GDScript lines)
| phase | content | gate | size |
|---|---|---|---|
| 1 Foundations | `map3.gd` (data only, from `render_map3.py`), a native geometry builder per part (merged meshes), `Puzzle` base class (state, hint, latch, save key, `autosolve()`), HER/MINE layers, reflection Actor mode, CineCam + spline keys + ortho hand-off; `flow_v3`, `tests/pz_test.tscn -- --pz=ID`, quick.sh areas; delete the v2 translation layers | quick green, map render | M ≈1.5k |
| 2 Prologue + Act 1 + Atrium | the cinematic (A: P0 C anims), I.1–I.6 | quick + 1 contact sheet + web touch I.1–I.4 | L ≈2.5k |
| 3 West + North | W.1–W.7, N.1–N.7 incl. **N.4 Still Room** | quick + `web_still.mjs` | L ≈3.5k |
| 4 East + Act 3 | E.1–E.6, I.20–I.23, Beacons, ending | quick all + full smoke | L ≈2.5k |
| 5 Polish | A's P1 fx/anims, audio pass, perf (≤4 ms script, no room-enter hitch), overlap/framing/zfight, export | full smoke, live check | M ≈0.8k |

## 8. Kept and replaced (v2 → v3)
| keep (systems; small edits only) | rewrite / remove | why |
|---|---|---|
| player, controls, items, satchel, ui, juice, audio, save (in main), highlight, palette, flame, mesh_builder, props, life (presence), warden.gd sightings | `map2.gd` → `map3.gd` | clean native coordinates, no module offsets |
| `planar.gd`, `reflector.gd` (+ Actor mode, + HER layer, + follows CineCam) | `wings_geo.gd`, `lv_off.gd`, `ch1_geo.gd` → **deleted** | geometry is authored in place, not translated from v1 |
| `cinematic.gd` (+ perspective cam, splines), `glass_talk.gd` (fog panes), `points.gd` (bell, votive, offering) | `chapter.gd` (3.2k lines), `act1.gd`, `v2/act3.gd`, `puzzles.gd` → one `scripts/v3/pz_<beat>.gd` per puzzle (≤300 lines) on a `Puzzle` base | each puzzle readable and testable alone, which cuts tokens per change |
| `hub.gd` lamp light (beacons rewritten), `names.gd` (updated), `framing.gd` (new piece list) | `our_steps.gd` + `web_oursteps.mjs` → **deleted**; replaced by `pz_n4_still.gd` + `web_still.mjs` | the owner rejected Our Steps |
| `main.gd` (strip the v1/v2 branches) | `level.gd`: keep only the region/walk/obstacle core; drop the v1 island builders. `wonders.gd` → A's `dress.gd` recipes. `prologue.gd` → new shot list | v1 leftovers |
| all Tripo assets, all A files | `playthrough.gd` (1.7k lines, v1) → `flow_v3` + per-puzzle `pz_test` | fast, targeted tests |

**How v3 saves tokens.**
- One data file for the layout, and one small file per puzzle (read only what you touch).
- `quick.sh` takes about 30 s, and a `pz_test` takes about 10 s per puzzle.
- No translation math.
- One contact sheet per phase.
- A builds the anims and fx from §5–6 in parallel, with no back-and-forth.
