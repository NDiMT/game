# EIDOLON v2: Chapter I rebuilt from the script (Agent W, 2026-11-05)

Source of truth: `dev/EIDOLON_SCRIPT.md` §5-6. The owner rejected the retrofit (new beats squeezed into the old rooms).
This is a NEW layout, designed beat by beat. Every space exists for one beat, or is an in-between point between
two puzzles (the pacing rule: never two puzzles back to back). No leftover rooms.

- **The map:** `dev/shots/v2-map.png`, labelled with every beat id.
  - The one source of truth for it is `scripts/v2/map2.gd` (class `Map2`).
  - Re-render the map with `tests/map2_dump.gd` and then `tests/render_map2.py`.
- **Coordinates:** local metres, with the Atrium's centre at 0,0, -z north (up the screen) and the camera in the south-west.
  - In phase 1 the new world stands beside the live chapter at `Map2.O = (0, 0, 200)`. World coordinates = local + O, so world z = local z + 200.
  - O goes to zero when the old world is taken out in phase 2.
  - The new world is only built on request: run with `--v2` (after `--`) or `EIDOLON_V2=1`. The live game is unchanged until phase 2.
- **Tests of the new world:**
  - `tests/flow_v2.tscn`: walks the play route end to end with the real movement. It is required in `tests/smoke.sh`.
  - With `EIDOLON_V2=1`: `overlap_test` (now also covers A's dressing and the doors), `framing_test` (new "V2 WORLD" section: every metre of the route and every space centre in sight) and `zfight` (spots over every space).

## 1. The shape of it

```
                         N wing (Garden) climbs north ........ N Beacon (the maze's end) ─┐
   W wing (Glass): its rooms                │                                              │ Cloister Stair (shortcut down)
   round an inlet, the Observer's           │                    E wing (High) climbs north on the east cliff ... Scales ─▶ E Beacon + E.6 (y 6)
   8 m face sunk in it; W Beacon on         │                     ▲                                                 │ High Stair (shortcut down)
   a rock beside the face; W.7 stones  ─────┤  N.1 colonnade     │ E.1 Balcony                                      ▼
   back to the Inlet Road ───────────── I.6 ATRIUM (hub: three roads W, N, E; the Veiled Way south, shut until 3 Beacons)
                                            ▲ crypt door         │
   Act 3: the Pool's road west ─ I.21 bridge ─ I.22 Gate of the Four ─(north)─ I.23 First Shrine
          ▲                                  (in the fog over the sea, south-west)
   WAKING POOL = I.20 ─ I.1 plate door ─ I.2 bell ─ I.3 glass road ─ (reed bank) ─ I.4 slab ─ I.5 crypt ─▶ Atrium
   (prologue)        (Act 1 spirals round the Atrium's south-east corner; the Veiled Way above the pool is the promise)
```

- She wakes on the pool's east shore. The pool is fogged and closed until Act 3. Act 1 spirals east and north around the Atrium's south-east corner, and the crypt opens into the Atrium.
- From the shore you can climb the Veiled Way to its gate below the Atrium. It is shut: the promise.
- Each wing goes from soft to hard and ends at its Beacon, then comes back:
  - West: the W.7 stones.
  - North: the Cloister Stair.
  - East: the High Stair.
- When the three Beacons burn, the Veiled Way opens. You go down to the pool where you woke, cross it on the road the halves raise (I.20), then the bridge that gives way (I.21), the Gate of the Four (I.22), and the Shrine (I.23).
- **The order contradiction:** the old plan had the bridge before the pool. This is resolved in favour of the script: pool, then bridge, then gate, then shrine.
- **The Observer:**
  - The prologue opens on it.
  - W.7's stones pass beside its face.
  - The E.1 bench's glance pans to it.
  - The ending turns it toward land.

## 2. Spaces, beats, reuse

**Puzzles come back from v1 by translation only** (same shape and orientation, v1 coordinates + offset):

| Group | Rooms | Offset |
|---|---|---|
| W wing | Stair, W_top, W_corr, Hall | `W_HALL` (-23, 0, -4) |
| W wing | Shadow Chamber | `W_GL` (-19, 0, -4) (a real corridor, W.4, now runs between Hall and Chamber) |
| N wing | Turned Ones, Our Steps, Court, Tree, Maze | `N_MOD` (-12, 0, -10) |
| E wing | Ledge (Singing Stones), Walk, Spring, Scales | `E_MOD` (-4, 0, -6) |
| Act 3 | the pool's slab grid | `POOL` (-3.35, 0, 17.15) |

**New:**
- Every Act 1 space.
- The Atrium.
- The Inlet Road.
- The Ash Landing, Hidden Way and W Beacon rock.
- The W.7 stones.
- The colonnade.
- The beacon terraces.
- The shortcuts.
- The Balcony.
- The bridge.
- The Gate and the Shrine.

The Tripo pieces are kept and placed:
- The doors and gates stand in their doorways (W's, with mechanisms later).
- A's `Dress` recipes dress the landmarks.
- Statues, braziers, the colossus head and the kit go to their beats.

## 3. Landmarks for A: rect, floor, keep rects (WORLD coordinates, x and z; keep = the play route 1.6 m wide, the doorways, the road mouths)

Puzzle floors join `keep` as each puzzle is ported in phases 2-4; this table is regenerated then.

**Notes for A:**
- **Doors and gates are W's:**
  - the I.1 door;
  - the crypt door;
  - the Veiled Way gate;
  - the Shadow Chamber's gate;
  - the Gate of the Four, in I.22's NORTH edge with the Shrine beyond.
- Doorways are in `keep`, so a recipe's door or gate there is skipped.
- **The Atrium has NO Beacon pillars:** the script puts the Beacons in the wings. Their spots are kept clear. Please drop them from the recipe.
- **Ramps:** N1 (y 1 to 0), NS (2 to 0), W1 (stairs, 0 to 1), ER (0 to 2), EH (6 to 2), E5u (2 to 6). Dress has one floor height per rect, so these need a flat-only rule, or edge pieces only.

| id | beat, name | recipe | rect (world x, z) | floor y | keep (x / z, world) |
|---|---|---|---|---|---|
| WS | P / I.20 The Waking Shore | `-` | x -4..0, z 215..222 (4x7 m) | 0 | -3.3..0 / 218.05..219.65; -1.3..0 / 218.05..220.3; -3.3..-1.7 / 215..217.8; -3.3..-1.7 / 216.2..219.65; -4..-1.7 / 218.05..219.65 |
| I1 | I.1 The Plate She Treads | `-` | x 0..8, z 215..224 (8x9 m) | 0 | 0..3.8 / 218.05..220.3; 2.2..5.8 / 218.7..220.3; 4.2..5.8 / 215..220.3 |
| I2 | I.2 The Bell | `-` | x 2..8, z 210..215 (6x5 m) | 0 | 4.2..5.8 / 210.4..215; 4.2..8 / 210.4..212; 7.7..8 / 210.4..213.6 |
| I3 | I.3 The First Glass | `glass_niche` | x 8..17, z 210.5..214.5 (9x4 m) | 0 | 8..13.3 / 210.5..213.6; 11.7..17 / 212..213.6; 15.7..17 / 211.2..213.6 |
| IB1 | between The Reed Bank | `-` | x 17..21, z 206..214.5 (4x8.5 m) | 0 | 17..19.8 / 211.2..213.6; 18.2..19.8 / 206.2..212.8; 18.2..19.8 / 206..207.8 |
| I4 | I.4 The One Slab | `-` | x 14.6..21, z 199..206 (6.4x7 m) | 0 | 18.2..19.8 / 202.45..206; 14.7..19.8 / 202.45..204.05; 14.6..16.3 / 202.2..204.05 |
| I5 | I.5 The Crypt (Lamp) | `crypt` (off until the bench overlap is fixed) | x 10..14.6, z 199..207 (4.6x8 m) | 0 | 11.5..14.6 / 202.2..204.05; 10..13.1 / 202.2..203.8 |
| A | I.6 The Atrium of a Thousand Faces | `atrium` | x -10..10, z 192..208 (20x16 m) | 0 | 4.2..10 / 202.2..203.8; -5.8..5.8 / 202.2..203.8; -5.8..-4.2 / 199.2..203.8; -10..-4.2 / 199.2..200.8; -5.8..-4.2 / 194.7..200.8; 1.7..3.3 / 192.2..196.3; -7.8..-6.2 / 192..196.3; -7.8..6.8 / 194.7..196.3; 5.2..10 / 194.7..196.3; -3.8..9.8 / 194.7..196.3; -3.8..-2.2 / 194.7..205.8; -3.8..-1.7 / 204.2..208; -10..-8 / 198.4..201.6; 0.5..4.5 / 192..194; 8..10 / 193.9..197.1; 8..10 / 201.8..204.2; -4.2..-0.8 / 206..208; -8.1..-5.9 / 192..194; -0.7..0.7 / 192..193.2; 8.5..9.7 / 199.3..200.7 |
| WR | W The Inlet Road | `-` | x -34..-10, z 198.5..201.5 (24x3 m) | 0 | -22.8..-10 / 199.2..200.8; -34..-21.2 / 199.2..200.8; -34..-32.6 / 198.5..200.8; -20.3..-18.7 / 198.5..200.8 |
| W1 | W.1 The Stair of Breath | `-` | x -35.8..-32.4, z 185.4..199.6 (3.4x14.2 m) | 0 | -34.2..-32.4 / 199.2..199.6; -35.1..-32.6 / 196.7..199.6; -35.1..-33.5 / 189.9..198.3; -35.1..-33.5 / 185.4..191.5 |
| W2 | W.2 The Offering | `-` | x -35.4..-33.2, z 181.6..185.4 (2.2x3.8 m) | 1 | -35.1..-33.5 / 182.7..185.4; -35.1..-33.2 / 181.7..184.3 |
| W3 | W.3 The Hall of Glass (Shard) | `hall_glass` | x -27.6..-18.4, z 175.4..185 (9.2x9.60001 m) | 1 | -27.6..-25.7 / 181.7..183.3; -27.3..-22.2 / 177.7..183.3; -23.8..-18.4 / 177.7..179.3 |
| W4 | W.4 The Corridor (the star) | `-` | x -18.4..-14, z 177.7..179.3 (4.4x1.60001 m) | 1 | -18.4..-15.4 / 177.7..179.3; -17..-14 / 177.7..179.3 |
| W5 | W.5 Where Her Shadow Fell | `shadow_chamber` | x -14..-9, z 177.6..186.4 (5x8.8 m) | 1 | -14..-12.2 / 177.6..179.3; -13.8..-10.7 / 177.6..182.8; -12.3..-10.1 / 181.2..186.2; -11.7..-10.1 / 184.6..186.4; -10.6..-9 / 177.6..179.1 |
| IBW | between The Ash Landing | `-` | x -14..-9, z 186.4..190 (5x3.60001 m) | 1 | -11.7..-10.1 / 186.4..188.8; -14..-10.1 / 187.2..189.3 |
| W6 | W.6 The Hidden Way | `-` | x -18..-14, z 187.5..189.5 (4x2 m) | 1 | -14.3..-14 / 187.5..189.3; -16.8..-14 / 187.7..189.3; -18..-15.2 / 187.7..189.3 |
| WB | W beacon The Glass Beacon | `-` | x -21..-18, z 187..193 (3x6 m) | 1 | -20.3..-18 / 187.7..189.3; -20.3..-18.7 / 187.7..193 |
| W7 | W.7 The Sunken Colossus | `-` | x -20.5..-18.5, z 193..198.5 (2x5.5 m) | 0 | -20.3..-18.7 / 193..195.8; -20.3..-18.7 / 194.2..198.3; -20.3..-18.7 / 196.7..198.5 |
| N1 | N.1 The Flooded Colonnade | `-` | x 0.5..4.5, z 185..192 (4x7 m) | 0.5 | 1.7..3.3 / 187.7..192; 1.7..3.3 / 185..189.3 |
| N2 | N.2 The Turned Ones | `turned_ones` | x -1.7..5, z 175..185 (6.7x10 m) | 1 | 1.7..3.3 / 182.7..185; 1.7..4.4 / 179.2..184.3; 2.8..4.4 / 177.4..180.8; 2.8..5 / 177.4..179 |
| N3 | N.3 The Votive Lamp | `votive` | x 2.2..5, z 175.4..178.4 (2.8x3 m) | 1 | 2.8..5 / 177.4..178.4 |
| N4 | N.4 Our Steps | `-` | x 5.5..13.45, z 175..184 (7.95x9 m) | 1 | 5.5..8.8 / 177.4..179; 7.2..10.3 / 175.7..179; 5.7..10.3 / 175..177.3 |
| IBN | between The Wind Ramp | `-` | x 3.4..7.5, z 171.6..175 (4.1x3.39999 m) | 1.5 | 5.7..7.5 / 174.6..175; 5.7..7.3 / 173..175; 4.7..7.3 / 171.6..174.6; 3.4..6.3 / 171.6..173 |
| N5 | N.5 The Court of Light | `-` | x -5..5, z 163..173 (10x10 m) | 2 | 1.7..5 / 169.2..173; -0.8..3.3 / 164.7..170.8; -0.8..3.8 / 164.7..166.3; 2.2..3.8 / 163..166.3 |
| N6 | N.6 The Tree of Shards | `-` | x 1.1..4.9, z 161..163 (3.8x2 m) | 2 | 2.2..3.8 / 161..163; 1.1..3.8 / 161..162.6 |
| N7 | N.7 The Mist Maze | `mist_maze` | x -3..5, z 151..161 (8x10 m) | 2 | -0.8..0.8 / 155.2..161; -2.8..0.8 / 151..156.8 |
| NB | N beacon The Garden Beacon | `-` | x -8..1, z 140..145.6 (9x5.60001 m) | 2 | -3.8..-1.2 / 142.2..145.6; -7.8..-2.2 / 142.2..144.8; -7.8..-6.2 / 143.2..145.6 |
| NS | shortcut The Cloister Stair (back to the Atrium) | `-` | x -8..-6, z 145.6..192 (2x46.4 m) | 1 | -7.8..-6.2 / 145.6..160.8; -7.8..-6.2 / 159.2..180.8; -7.8..-6.2 / 179.2..191.8; -7.8..-6.2 / 190.2..192 |
| ER | E The Climbing Road | `-` | x 10..17, z 194..197 (7x3 m) | 1 | 10..14.3 / 194.7..196.3; 12.7..17 / 194.2..196.3 |
| E1 | E.1 The Balcony | `balcony` | x 17..21, z 175..197 (4x22 m) | 2 | 18.2..19.8 / 182.2..196.3; 18.2..19.8 / 175..183.8; 18.2..20.55 / 175..180.8; 18.2..19.8 / 179.2..195.8; 17..19.8 / 194.2..196.3 |
| E2 | E.2 The Singing Stones | `singing_stones` | x 17..25, z 169..175 (8x6 m) | 2 | 18.2..22.8 / 170.8..173.8; 21.2..25 / 170.8..172.4; 24.9..25 / 170.2..172.4; 18.95..20.55 / 169..172.8; 18.2..20.55 / 171.2..175 |
| IBE | between The Veil Stair | `-` | x 25..26.4, z 170.6..172.6 (1.4x2 m) | 3 | 25..26.4 / 170.6..172.4 |
| E3 | E.3 The Mirror Walk | `-` | x 26.4..28.4, z 149.4..172.8 (2x23.4 m) | 4 | 26.4..28.2 / 170.2..172.4; 26.6..28.2 / 161.2..171.8; 26.6..28.4 / 161.2..162.8; 26.6..28.2 / 149.4..162.8 |
| E4 | E.4 The Upward Spring | `-` | x 28.4..30.4, z 160.65..163.35 (2x2.7 m) | 4 | 28.4..30.2 / 161.2..162.8 |
| E5 | E.5 The Scales | `scales` | x 22..29.4, z 142..149.4 (7.4x7.39999 m) | 2 | 26.6..28.2 / 147.6..149.4; 24.9..28.2 / 145.2..149.2; 22.7..26.5 / 142.2..146.8; 22.7..24.3 / 142..143.8 |
| EB | E beacon + E.6 The High Beacon, the Eidolon Plate | `-` | x 22..30, z 132..138 (8x6 m) | 6 | 22.7..26.8 / 134.2..138; 22.2..26.8 / 134.2..136.8; 22..23.8 / 135.2..136.8 |
| EH | shortcut The High Stair (back down) | `-` | x 18.5..22, z 134..169 (3.5x35 m) | 4 | 19.2..22 / 135.2..136.8; 18.95..20.8 / 135.2..152.8; 18.95..20.55 / 151.2..168.8; 18.95..20.55 / 167.2..169 |
| VW | Act 3 The Veiled Way (opens: 3 Beacons) | `-` | x -4..-1, z 208..215 (3x7 m) | 0 | -3.8..-1.7 / 208..208.3; -3.3..-1.7 / 208..212.3; -3.3..-1.7 / 210.7..215 |
| P | I.20 The Pool of Halves | `-` | x -12.95..-4, z 217..220.7 (8.95x3.7 m) | 0 | -5.8..-4 / 218.05..219.65; -12.8..-4.2 / 218.05..219.65; -12.95..-11.2 / 218.05..219.65 |
| PW | I.20 The Far Shore | `-` | x -16.15..-12.95, z 216.95..220.75 (3.2x3.8 m) | 0 | -15.3..-12.95 / 218.05..219.65; -16.15..-13.7 / 218.05..219.65 |
| I21 | I.21 The Bridge that Gives Way | `bridge` | x -40..-16.15, z 217.6..220.1 (23.85x2.5 m) | 0 | -28.8..-16.15 / 218.05..219.65; -40..-27.2 / 218.05..219.65 |
| I22 | I.22 The Gate of the Four | `gate_four` | x -50..-40, z 213..224 (10x11 m) | 0 | -42.3..-40 / 218.05..219.65; -45.8..-40.7 / 218.05..219.65; -45.8..-44.2 / 213.2..219.65; -45.8..-44.2 / 213..214.8 |
| I23 | I.23 The First Shrine: "The Hand in the Water" | `shrine` | x -51..-39, z 203..213 (12x10 m) | 0 | -45.8..-44.2 / 210.2..213; -45.8..-44.2 / 205.7..211.8 |

## 4. Pacing (in-between points)

The script's order already alternates for most beats. Where it puts two puzzles together, an in-between point sits between them:

| Between | In-between point |
|---|---|
| I.3 and I.4 | the Reed Bank |
| W.5 and W.6 | the Ash Landing |
| N.4 and N.5 | the Wind Ramp |
| E.2 and E.3 | the Veil Stair |
| E.5 and E.6 | the Beacon itself (a spectacle) |

## 5. Save

- Save v5: a clean reset. Old progress is not migrated (owner).

## 5b. Phase 3 (W2): the wings in the new world

- **How the v1 rooms are placed:** `scripts/v2/wings_geo.gd` holds the v1 geometry builders, unchanged in their numbers, drawn through `scripts/v2/lv_off.gd` (the Level kit seen through a translation). The runtime code (chapter.gd, puzzles.gd, our_steps.gd, warden.gd, items.gd, ...) writes every v1 position as `Map2.G? + Vector3(v1 ...)`.
- **Module offsets (world):** `Map2.GW` (Stair, Offering, Hall), `GG` (Shadow Chamber), `GN` (Turned Ones, Our Steps, Court, Tree, Maze), `GE` (Singing Stones = the v1 Ledge, Veil Stair, Mirror Walk, Spring, Scales), `GX` (E.6: the v1 Ledge's glass and plates on the High terrace, EB). Integer cells: `GWI`, `GXI`.
- **Region names:** the v1 rooms keep their v1 region names; `Map2.V1_KEY` maps them to their space (area, mood, flow test, framing).
- **New beats:** W.4 the star (lens-only roof + star), W.6 the Shadow Chamber's gate (seen through the Shard, its parapet sinks), the Beacons on the Tripo braziers at WB / NB / EB, W.7 stepping drums, N.1 hidden stones (her reflection walks them ahead of you), N.7 her footprints shown only in the lamp's light, E.1 the bench (the gaze turns to the Observer), E.2 the stones moved to the ledge's middle, E.5 bars on the way up to EB (the balance opens them), E.6 the Eidolon Plate on EB (its answer raises the bars of the High Stair down: the circle closes).
- **Gone with the old wings:** the Echo Corridor, the drawbridge, the old colonnade's hub code (now N.1), the old Colossus stones.
- **Save:** v6, a clean reset (the wings' positions moved).

## 5c. Phase 4 (W3): Act 3, and the old world gone

- **O is zero.** The old world (WorldGeo, level's `_veiled_gate` / `_bridge_b1` / `_shortcut` / `_shrine_platform` / `_sealed_way`, `Ch1Geo._aqueduct`, the old pool, Gate and Shrine, the old Atrium's hub parts, the old props) is deleted. `scripts/world_geo.gd` is gone (WOOD / BRONZE are `Props.WOOD` / `Props.BRONZE`, the lamp's spot is `Act1.LAMP_POS`). World coordinates = the local ones above. `tests/old_world_scan.tscn` lists anything built outside the new spaces (it finds nothing but the Eidolon Plate's reflected plate, which is designed).
- **Save v7**, a clean reset.
- **`scripts/v2/act3.gd` (class `Act3`, `chapter.act3`)**:
  - the Veiled Way's gate (`Map2.door_nodes[2]`, obstacle `vw_gate`): shut, with a "locked" prompt on each side, until the third Beacon burns; then it sinks (wherever you are, with a line: "Far off, something heavy gives way.");
  - the Pool of Halves' fog: until then the water is murky (`OmenFx.murk` 0.85) with A's mist over it, and your four stones lie sunk under it (no turning, no walking). The prologue plays on clear water; the fog settles once you are yours to move. When the fires burn, the fog lifts and the four stones rise (`chapter.pool_unveil`, the heavy rise `chapter._rise`: bubbles and a bulge first, a slow break through the surface with water sheeting off, a small overshoot and settle, a list that rights itself, the wet top drying). Her stones rise the same way when the road is whole;
  - I.21 the bridge: `Map2.BRIDGE_N` = 12 spans, one walk region each (`Map2.bridge_regions`). Each settles with dust and grit as you first step on it; span 6 lurches 14 cm down under you and stays (walkable); three pieces of parapet break off and fall into the sea (splash, ring). The way never closes behind you. Saved as `state.a3.bridge`;
  - I.23's ruined ring of four columns (open south, A's altar on the north) round the brimming round pool (`Map2.SHRINE_POOL`), on a worn marble disc.
- **I.20** (chapter.gd): v1's grid at `Map2.GP` (`Ch1Geo.cell_pos` adds it). You turn your stones from the shore, the north rim (`Pr`, z 15.8..17) and the south rim (`Pr`, z 20.7..21.9); her stones' regions are `V2_Pp`. The far shore `PW` meets the out stone.
- **I.22** (chapter.gd): three Tripo veiled ones on 1 m plinths (`Map2.FOUR_PLINTHS`, `PIECES`), the fourth plinth empty (its walk region `V2_I22f`, 0.28 m up). With the three Beacons burning, stand on it and stay still 3.6 s: she turns to the gate as the others do, the plinths' runes light one by one, the Tripo gate (`Map2.door_nodes[3]`, obstacle `four_gate`) sinks. No sockets. A "wait" button holds you still for touch.
- **I.23** (chapter.gd `hand_in_the_water`): the camera keeps the one fixed view (yaw -45 deg, pitch 36 deg: no turning even here), centred on the pool; she writes ΒΡΕΣ ΜΕ (A's `OmenFx.write_in_water`, the camera's own yaw passed) at P+23, and a glass eye opens deep in the water at P+29.6 (`OmenFx.glass_eye`, same yaw); her veil lifts at P+34; the memory is the script's ("The veil was his, not mine.").
- **The route** (Map2.ROUTE) crosses the pool stone by stone; `flow_v2` walks it with the pool and the Gate answered.

## 6. Phases

1. **Layout:** this file, the map, the whole chapter blocked out and walkable end to end, the flow test.
2. **Act 1:** playable and dressed; the old world comes out and O goes to 0.
3. **Act 2:** the three wings and their Beacons. (done, phase 3)
4. **Act 3** and the shrine cinematic. (done, phase 4: §5c)
5. **Intro cards, the prologue,** and the tablet and memory text.
6. **Feel and polish,** then the full smoke.

Every phase ends green on smoke, playthrough, flow, overlap, occlusion and z-fight, with build/web exported.
