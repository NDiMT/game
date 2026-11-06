class_name Map2
## EIDOLON v2 (rebuild from the script, dev/V2_MAP.md): Chapter I's NEW world, laid out beat by beat from
## dev/EIDOLON_SCRIPT.md §5-6. This file is the one source of truth for the layout: every space (with its script
## beat), its walk regions, water, walls with their doorways, the doors and gates (Tripo), the play route (the flow
## test walks it) and the landmark rects A dresses (scripts/fx/dress.gd recipes).
##
## Coordinates below are LOCAL metres (the Atrium's centre is 0,0; -z is north, up the screen; the camera looks from
## the south-west). The world sits at O while the old Chapter I still stands at the origin (phase 1); O goes to zero
## when the old world is taken out.
##
## The puzzle rooms that come back from v1 keep their v1 shape and orientation and are only TRANSLATED: their v1
## coordinates + the module offset below (W_HALL, W_GL, N_MOD, E_MOD, POOL) give their place here.

const O := Vector3.ZERO                # (phase 4: the old world is gone: the new one stands at the origin; everything follows O)
## (phase 1-3 the new world stood beside the old one at (0, 0, 200) and was switched by --v2 / EIDOLON_V2)
static var enabled := true
const ZP := "V2_"                       # zone / region name prefix

## the beats' anchors (local = world now, O is zero)
const OBSERVER := Vector3(-26.6, 0.0, -8.0)    # the Observer's sunk face (W.7; the prologue opens on it)
const POOL_WATER := [-12.75, 17.0, -4.0, 20.7]   # the Pool of Halves (where she wakes)
## (phase 4) Act 3. I.23 the First Shrine: its round pool (where her hand meets yours), the crystal over it; you kneel
## at STAND on its south side, facing north. I.21 the bridge: BRIDGE_N spans that settle and break as you cross.
## I.22 the Gate of the Four: three veiled ones on plinths and an empty fourth (FOUR_PLINTH), facing the gate.
const SHRINE_C := Vector3(-45.0, 0.0, 6.8)
const SHRINE_POOL := SHRINE_C + Vector3(0.0, 0.155, 0.2)
const SHRINE_STAND := SHRINE_C + Vector3(0.0, 0.0, 1.8)
const BRIDGE := [-40.0, 17.6, -16.15, 20.1]
const BRIDGE_N := 12
const FOUR_PLINTHS := [[-48.6, 15.5], [-48.6, 21.0], [-41.6, 15.5], [-41.6, 21.0]]      # the last is empty: yours
const PLINTH_H := 0.25
## N.1 the Flooded Colonnade: stones under murky water, all alike (their tops just under it); only the true ones hold
## you, and in the water's reflection SHE walks on them ahead of you (hub.gd). The decoys are broken shafts.
const N1_Y := -0.05
const N1_WATER_Y := 0.0
const N1_STONES := [[2.5, -9.45], [1.7, -10.25], [1.9, -11.25], [2.8, -11.9], [3.2, -12.75]]
const N1_DECOYS := [[3.65, -10.0], [0.85, -11.95], [3.95, -11.35], [1.55, -13.05]]

## v1 room -> here (translation only)
const W_HALL := Vector3(-23.0, 0.0, -4.0)   # Stair of Breath, W_top, W_corr, Hall of Glass
const W_GL := Vector3(-19.0, 0.0, -4.0)     # the Shadow Chamber (a corridor, W.4, now runs between Hall and chamber)
const N_MOD := Vector3(-12.0, 0.0, -10.0)   # Turned Ones, Our Steps, Court of Light, Tree, Mist Maze
const E_MOD := Vector3(-4.0, 0.0, -6.0)     # Ledge, Mirror Walk, Spring, Scales
const POOL := Vector3(-3.35, 0.0, 17.15)    # the Pool of Halves (v1 waking pool's slab grid)
## (phase 3) the v1 rooms' WORLD offsets: a v1 coordinate + this = where it stands now (v1 code keeps its numbers,
## written as `Map2.GW + Vector3(v1 ...)`; O goes to zero later and these follow)
const GW := O + W_HALL                      # Stair of Breath, the Offering, W_corr, Hall of Glass
const GG := O + W_GL                        # the Shadow Chamber
const GN := O + N_MOD                       # Turned Ones, Our Steps, the Wind Ramp, Court of Light, Tree, Mist Maze
const GE := O + E_MOD                       # Singing Stones (the v1 Ledge), Veil Stair, Mirror Walk, Spring, Scales
const GX := O + Vector3(1.0, 4.0, -43.0)    # E.6 the Eidolon Plate: the v1 Ledge's glass and plates, up on the High terrace (EB)
const GP := O + POOL
const GWI := Vector2i(Vector2(GW.x, GW.z))
const GXI := Vector2i(Vector2(GX.x, GX.z))             # (E.6's cells too)             # (the Hall's cells are whole metres: so is its offset)
const GN2 := Vector2(GN.x, GN.z)
const GE2 := Vector2(GE.x, GE.z)
const GX2 := Vector2(GX.x, GX.z)
static func g2(off: Vector3) -> Vector2: return Vector2(off.x, off.z)
static func gr(off: Vector3, r: Rect2) -> Rect2: return Rect2(r.position + Vector2(off.x, off.z), r.size)

## kinds (the script's symbols): puzzle 🧩, breath 🌫, traversal 🚶, spectacle ✨, hub, between (an in-between point)
## [id, beat, name, kind, rect (x0, z0, x1, z1), floor y, dress recipe ("" none)]
const SPACES := [
	# ---- prologue + Act 1: the awakening (linear)
	["WS", "P / I.20", "The Waking Shore", "spectacle", [-4.0, 15.0, 0.0, 22.0], 0.0, ""],
	["I1", "I.1", "The Plate She Treads", "puzzle", [0.0, 15.0, 8.0, 24.0], 0.0, ""],
	["I2", "I.2", "The Bell", "breath", [2.0, 10.0, 8.0, 15.0], 0.0, ""],
	["I3", "I.3", "The First Glass", "puzzle", [8.0, 10.5, 17.0, 14.5], 0.0, "glass_niche"],
	["IB1", "between", "The Reed Bank", "between", [17.0, 6.0, 21.0, 14.5], 0.0, ""],
	["I4", "I.4", "The One Slab", "puzzle", [14.6, -1.0, 21.0, 6.0], 0.0, ""],
	["I5", "I.5", "The Crypt (Lamp)", "traversal", [10.0, -1.0, 14.6, 7.0], 0.0, "crypt"],
	["A", "I.6", "The Atrium of a Thousand Faces", "hub", [-10.0, -8.0, 10.0, 8.0], 0.0, "atrium"],
	# ---- Act 2, WEST: the Glass wing
	["WR", "W", "The Inlet Road", "traversal", [-34.0, -1.5, -10.0, 1.5], 0.0, ""],
	["W1", "W.1", "The Stair of Breath", "puzzle", [-35.8, -14.6, -32.4, -0.4], 0.0, "stair_breath"],
	["W2", "W.2", "The Offering", "breath", [-35.4, -18.4, -33.2, -14.6], 1.0, ""],
	["W3", "W.3", "The Hall of Glass (Shard)", "puzzle", [-27.6, -24.6, -18.4, -15.0], 1.0, "hall_glass"],
	["W4", "W.4", "The Corridor (the star)", "traversal", [-18.4, -22.3, -14.0, -20.7], 1.0, ""],
	["W5", "W.5", "Where Her Shadow Fell", "puzzle", [-14.0, -22.4, -9.0, -13.6], 1.0, "shadow_chamber"],
	["IBW", "between", "The Ash Landing", "between", [-14.0, -13.6, -9.0, -10.0], 1.0, "hidden_way"],
	["W6", "W.6", "The Hidden Way", "puzzle", [-18.0, -12.5, -14.0, -10.5], 1.0, ""],
	["WB", "W beacon", "The Glass Beacon", "spectacle", [-21.0, -13.0, -18.0, -7.0], 1.0, "colossus"],
	["W7", "W.7", "The Sunken Colossus", "spectacle", [-20.5, -7.0, -18.5, -1.5], 0.0, ""],
	# ---- Act 2, NORTH: the Garden wing
	["N1", "N.1", "The Flooded Colonnade", "traversal", [-0.5, -15.0, 5.5, -8.0], 0.5, ""],          # ("colonnade": off for good, phase 6: the rect is ramp and water, no dry floor for it)
	["N2", "N.2", "The Turned Ones", "puzzle", [-1.7, -25.0, 5.0, -15.0], 1.0, "turned_ones"],
	["N3", "N.3", "The Votive Lamp", "breath", [2.2, -24.6, 5.0, -21.6], 1.0, "votive"],
	["N4", "N.4", "Our Steps", "puzzle", [5.5, -25.0, 13.45, -16.0], 1.0, ""],
	["IBN", "between", "The Wind Ramp", "between", [3.4, -28.4, 7.5, -25.0], 1.5, ""],
	["N5", "N.5", "The Court of Light", "puzzle", [-5.0, -37.0, 5.0, -27.0], 2.0, ""],
	["N6", "N.6", "The Tree of Shards", "spectacle", [1.1, -39.0, 4.9, -37.0], 2.0, "tree_shards"],
	["N7", "N.7", "The Mist Maze", "puzzle", [-3.0, -49.0, 5.0, -39.0], 2.0, "mist_maze"],
	["NB", "N beacon", "The Garden Beacon", "spectacle", [-8.0, -60.0, 1.0, -54.4], 2.0, ""],
	["NS", "shortcut", "The Cloister Stair (back to the Atrium)", "traversal", [-8.0, -54.4, -6.0, -8.0], 1.0, ""],
	# ---- Act 2, EAST: the High wing
	["ER", "E", "The Climbing Road", "traversal", [10.0, -6.0, 17.0, -3.0], 1.0, ""],
	["E1", "E.1", "The Balcony", "traversal", [17.0, -25.0, 21.0, -3.0], 2.0, "balcony"],
	["E2", "E.2", "The Singing Stones", "puzzle", [17.0, -31.0, 25.0, -25.0], 2.0, "singing_stones"],
	["IBE", "between", "The Veil Stair", "between", [25.0, -29.4, 26.4, -27.4], 3.0, ""],
	["E3", "E.3", "The Mirror Walk", "puzzle", [26.4, -50.6, 28.4, -27.2], 4.0, ""],
	["E4", "E.4", "The Upward Spring", "spectacle", [28.4, -39.35, 30.4, -36.65], 4.0, "spring"],
	["E5", "E.5", "The Scales", "puzzle", [22.0, -58.0, 29.4, -50.6], 2.0, "scales"],
	["EB", "E beacon + E.6", "The High Beacon, the Eidolon Plate", "puzzle", [22.0, -68.0, 30.0, -62.0], 6.0, ""],
	["EH", "shortcut", "The High Stair (back down)", "traversal", [18.5, -66.0, 22.0, -31.0], 4.0, ""],
	# ---- Act 3: the convergence
	["VW", "Act 3", "The Veiled Way (opens: 3 Beacons)", "traversal", [-4.0, 8.0, -1.0, 15.0], 0.0, ""],
	["P", "I.20", "The Pool of Halves", "puzzle", [-12.75, 15.0, -4.0, 22.0], 0.0, ""],          # ("pool_halves": off until A refits it to the rims)
	["PW", "I.20", "The Far Shore", "traversal", [-16.15, 16.95, -12.75, 20.75], 0.0, ""],
	["I21", "I.21", "The Bridge that Gives Way", "traversal", [-40.0, 17.6, -16.15, 20.1], 0.0, "bridge"],
	["I22", "I.22", "The Gate of the Four", "puzzle", [-50.0, 13.0, -40.0, 24.0], 0.0, "gate_four"],
	["I23", "I.23", "The First Shrine: \"The Hand in the Water\"", "spectacle", [-51.0, 3.0, -39.0, 13.0], 0.0, "shrine"],
]

## walk regions: [space, x0, z0, x1, z1, y0, y1 (NAN flat), axis (0 x, 1 z: y0 at the low end)]
const WALK := [
	["A", -10.0, -8.0, 10.0, 8.0, 0.0, NAN, -1],
	# Act 1
	["WS", -4.0, 15.0, 0.0, 22.0, 0.0, NAN, -1],
	["I1", 0.0, 15.0, 8.0, 24.0, 0.0, NAN, -1],
	["I2", 2.0, 10.0, 8.0, 15.0, 0.0, NAN, -1],
	["I3", 8.0, 10.5, 17.0, 14.5, 0.0, NAN, -1],
	["IB1", 17.0, 6.0, 21.0, 14.5, 0.0, NAN, -1],
	["I4", 16.4, -1.0, 21.0, 6.0, 0.0, NAN, -1],
	["I4s", 14.6, 2.75, 16.4, 3.75, 0.0, NAN, -1],           # the one slab (block-out: in place)
	["I5", 10.0, -1.0, 14.6, 7.0, 0.0, NAN, -1],
	# West
	["WR", -34.0, -1.5, -10.0, 1.5, 0.0, NAN, -1],
	# (W1 the Stair of Breath, W2 the Offering, W2c its corridor, W3 the Hall, W5 the Shadow Chamber: the v1 rooms, WingsGeo)
	["W4", -18.0, -22.2, -14.0, -20.8, 1.0, NAN, -1],          # between the Hall's remembered door and the chamber's way in
	["IBW", -14.0, -13.6, -9.0, -10.0, 1.0, NAN, -1],
	["W6", -18.0, -12.5, -14.0, -10.5, 1.0, NAN, -1],
	["WB", -21.0, -13.0, -18.0, -7.0, 1.0, NAN, -1],
	# (W7: stepping stones over the inlet, beside the Observer's face: W7_STONES)
	# North
	# (N1, the Flooded Colonnade: a landing off the Atrium, the hidden stones (N1_STONES), worn steps up into the garden)
	["N1", 1.6, -9.0, 3.4, -8.0, 0.0, NAN, -1],
	["N1", 2.6, -15.0, 3.8, -13.0, 1.0, N1_Y, 1],
	["N1l", -0.5, -9.0, 0.5, -8.0, 0.0, NAN, -1],        # flat ledges either side of its low end (for its columns)
	["N1l", 4.5, -9.0, 5.5, -8.0, 0.0, NAN, -1],
	# (N2 the Turned Ones, N3 their door, N4 Our Steps, IBN the Wind Ramp, N5 the Court, N6 the Tree, N7d / N7 the Maze: the v1 rooms)
	["N7x", -3.0, -54.4, -1.0, -49.0, 2.0, NAN, -1],
	["NB", -8.0, -60.0, 1.0, -54.4, 2.0, NAN, -1],
	["NS", -8.0, -54.4, -6.0, -27.0, 2.0, NAN, -1],
	["NS", -8.0, -27.0, -6.0, -8.0, 2.0, 0.0, 1],
	# East
	["ER", 10.0, -6.0, 17.0, -3.0, 0.0, 2.0, 0],
	["E1", 17.0, -25.0, 21.0, -3.0, 2.0, NAN, -1],
	# (E2 the Singing Stones, IBE the Veil Stair, E3 the Mirror Walk, E4 the Spring, E3l the lift, E5 the Scales: the v1 rooms)
	["E5u", 22.0, -62.0, 25.0, -58.0, 6.0, 2.0, 1],          # the scales' platform rises (block-out: a ramp)
	# (EB: the v1 Ledge again, its great glass and plates: E.6)
	["EH", 18.5, -66.0, 22.0, -62.0, 6.0, NAN, -1],
	["EH", 18.5, -62.0, 20.7, -31.0, 6.0, 2.0, 1],          # (phase 4: 30 cm narrower: its flank no longer hides the foot of the Scales' way up)
	# Act 3
	["VW", -4.0, 8.0, -1.0, 15.0, 0.0, NAN, -1],
	# (I.20: the road is the pool's own stones, chapter.gd's; you turn yours from the shore and the two rims)
	["Pr", -9.4, 15.0, -4.0, 17.0, 0.0, NAN, -1],          # (flush with the shore's ends: their kerbs run on in one line)
	["Pr", -9.6, 20.7, -4.0, 22.0, 0.0, NAN, -1],
	["PW", -16.15, 16.95, -12.75, 20.75, 0.0, NAN, -1],
	# (I.21: its spans are walk regions of their own, built below: they settle as you cross)
	["I22", -50.0, 13.0, -40.0, 24.0, 0.0, NAN, -1],
	["I23", -51.0, 3.0, -39.0, 13.0, 0.0, NAN, -1],
]

## (phase 3) the v1 rooms' walk regions keep their v1 names: the key of each in WALK's terms (its space, part, area)
const V1_KEY := {"W_land": "W1", "W_stair1": "W1", "W_breath": "W1", "W_stair2": "W1", "W_top": "W2", "W_corr": "W2c",
	"H": "W3", "hdoor": "W3", "GL": "W5",
	"E": "E2", "WK_down": "IBE", "WK": "E3", "SPB": "E4", "lift": "E3l", "SC": "E5", "E6": "EB",
	"G": "N2", "g_door": "N3", "HW": "N4", "HW_ramp": "IBN", "L_ramp": "IBN", "L": "N5", "TS": "N6", "MZ_door": "N7d", "MZ": "N7"}
static func key_of_region(name: String) -> String:
	if name.begins_with(ZP): return name.substr(ZP.length())
	return str(V1_KEY.get(name, ""))

## W.7 the Sunken Colossus: drums of marble standing out of the inlet, stepping down from the Beacon's rock to the road,
## the Observer's 8 m face beside them: [x, z, top y]
const W7_STONES := [[-19.45, -6.45, 0.84], [-19.7, -5.35, 0.68], [-19.5, -4.25, 0.52], [-19.3, -3.15, 0.36], [-19.5, -2.05, 0.2]]
const STONE_R := 0.62

## walk regions whose floor a beat builds itself (the one slab, the Pool of Halves' road), shut until it is made
const NO_FLOOR := ["I4s"]

## still water and sea: [x0, z0, x1, z1, y, rim] (rim: the design's own water edge: no kerb along it)
const WATER := [
	[-12.75, 17.0, -4.0, 20.7, -0.42, true],          # the Pool of Halves (where she wakes)
	[-32.4, -14.6, -14.0, -1.5, -0.42, true],         # the inlet of the Sunken Colossus
	[-0.5, -15.0, 5.5, -9.0, N1_WATER_Y, true],       # N.1 the Flooded Colonnade
	[14.6, -1.5, 16.4, 8.0, -0.55, true],             # I.4's stream
	[-56.0, 2.5, -16.15, 30.0, -0.42, false],         # the open sea of Act 3 (the bridge, the Gate, the Shrine)
	[-16.15, 22.0, 0.0, 30.0, -0.42, false],
	[-16.15, 13.0, -12.75, 16.95, -0.42, false],
]

## walls: [x0, z0, x1, z1, height] (from the floor of the space they stand in), with their doorways left open
const WALLS := [
	# I.1 -> I.2: the closed door (door_temple stands in the gap)
	[2.0, 14.85, 3.9, 15.15, 1.1], [6.1, 14.85, 8.0, 15.15, 1.1],
	# the crypt: its east wall (the slab's gap) and its west wall onto the Atrium (its door)
	[14.45, -1.0, 14.75, 2.75, 2.6], [14.45, 3.75, 14.75, 7.0, 1.0],
	[9.85, -1.0, 10.15, 2.0, 1.0], [9.85, 4.0, 10.15, 7.0, 1.0],          # (phase 4: low, as the south half: the cot shows over it)
	# the Gate of the Four: its gate in the north wall, the Shrine beyond (gate_veiled in the gap)
	[-50.0, 12.85, -46.85, 13.15, 1.2], [-43.15, 12.85, -40.0, 13.15, 1.2],
]

## Tripo doors and gates in their doorways: [asset, x, z, y, yaw (deg), scale, note]. Phase 1 (block-out): open (no
## footprint); phases 2-4 give each its mechanism.
const DOORS := [
	["door_temple", 5.0, 15.0, 0.003, 0.0, 1.0, "I.1 the closed door"],
	["door_temple", 10.0, 3.0, 0.0, 90.0, 0.8, "I.5 the crypt's way out into the Atrium"],
	["gate_veiled", -2.5, 8.0, 0.0, 0.0, 0.85, "the Veiled Way (Act 3: opens when the 3 Beacons burn)"],
	["gate_veiled", -45.0, 13.0, 0.003, 0.0, 1.0, "I.22 the Gate of the Four (onto the Shrine)"],
]

## other Tripo pieces of the block-out (the landmark statues of each beat): [asset, x, y, z, yaw, scale, note]
const PIECES := [
	["colossus_head_veiled", -26.6, -3.6, -8.0, 90.0, 11.0, "W.7 the Sunken Colossus (the Observer)"],
	["statue_veiled_mourning", -48.6, PLINTH_H, 15.5, 180.0, 0.95, "I.22 veiled one, on her plinth, facing the gate"],
	["statue_veiled_praying", -48.6, PLINTH_H, 21.0, 180.0, 0.95, "I.22 veiled one"],
	["statue_veiled_kneeling", -41.6, PLINTH_H, 15.5, 180.0, 0.95, "I.22 veiled one"],
	["brazier", -19.5, 1.0, -12.2, 0.0, 1.0, "W beacon"],
	["brazier", -3.0, 2.0, -59.2, 0.0, 1.0, "N beacon"],
	["brazier", 28.8, 6.0, -67.2, 0.0, 1.0, "E beacon"],
	["kit_urns", 4.0, 0.0, 10.4, 0.0, 1.0, "I.2 the bell's yard"],
	["statue_veiled_bust", 20.4, 0.0, 6.6, -45.0, 0.9, "the reed bank"],
]

## the play route, in script order: [x, z, space] (the flow test walks it with the real movement)
const ROUTE := [
	# prologue: she wakes on the pool's shore; Act 1
	[-2.5, 18.85, "WS"], [-0.5, 18.85, "WS"], [3.0, 19.5, "I1"], [5.0, 19.5, "I1"], [5.0, 15.0, "I1"], [5.0, 11.2, "I2"],
	[8.5, 11.2, "I3"], [12.5, 12.8, "I3"], [16.5, 12.8, "I3"], [19.0, 12.0, "IB1"], [19.0, 7.0, "IB1"], [19.0, 3.25, "I4"],
	[15.5, 3.25, "I4s"], [12.3, 3.0, "I5"], [9.5, 3.0, "A"], [5.0, 3.0, "A"],
	# West wing
	[-5.0, 3.0, "A"], [-5.0, 0.0, "A"], [-9.5, 0.0, "A"], [-22.0, 0.0, "WR"], [-33.4, 0.0, "WR"], [-33.4, -1.0, "W1"], [-34.3, -2.5, "W1"], [-34.3, -9.3, "W1"],
	[-34.3, -16.5, "W2"], [-30.4, -17.5, "W2c"], [-26.5, -17.5, "W3"], [-23.0, -21.5, "W3"], [-18.9, -21.5, "W3"],
	[-16.2, -21.5, "W4"], [-13.0, -21.6, "W5"], [-11.5, -18.0, "W5"], [-10.9, -14.6, "W5"], [-10.9, -12.0, "IBW"],
	[-13.5, -11.5, "IBW"], [-16.0, -11.5, "W6"], [-19.0, -11.4, "WB"], [-19.5, -7.5, "WB"], [-19.5, -5.0, "W7"],
	[-19.5, -2.5, "W7"], [-19.5, 0.0, "WR"], [-9.5, 0.0, "A"], [-5.0, 0.0, "A"], [-5.0, -4.5, "A"],
	# North wing
	[2.5, -4.5, "A"], [2.5, -7.0, "A"], [2.5, -8.6, "N1"], [2.5, -9.45, "N1"], [1.7, -10.25, "N1"], [1.9, -11.25, "N1"],
	[2.8, -11.9, "N1"], [3.2, -12.75, "N1"], [3.2, -14.4, "N1"], [2.5, -16.5, "N2"], [3.6, -20.0, "N2"], [3.6, -21.8, "N2"], [5.25, -21.8, "N3"],
	[5.9, -21.8, "N4"], [6.9, -23.0, "N4"], [6.9, -26.2, "IBN"], [5.5, -27.8, "IBN"], [2.5, -30.0, "N5"],
	[0.0, -34.5, "N5"], [0.0, -38.2, "N7d"], [2.5, -38.2, "N6"], [0.0, -38.2, "N7d"],
	# (the Mist Maze: her way through it, cell by cell: Ch1Geo.MZ_PATH)
	[0.0, -40.0, "N7"], [2.0, -40.0, "N7"], [2.0, -42.0, "N7"], [4.0, -42.0, "N7"], [4.0, -46.0, "N7"], [0.0, -46.0, "N7"],
	[0.0, -44.0, "N7"], [-2.0, -44.0, "N7"], [-2.0, -48.5, "N7"], [-2.0, -51.5, "N7x"],
	[-3.0, -57.0, "NB"], [-7.0, -56.0, "NB"], [-7.0, -40.0, "NS"], [-7.0, -20.0, "NS"], [-7.0, -9.0, "NS"], [-7.0, -4.5, "A"],
	# East wing
	[6.0, -4.5, "A"], [9.5, -4.5, "A"], [13.5, -4.5, "ER"], [19.0, -4.5, "E1"], [19.0, -17.0, "E1"], [19.0, -27.0, "E2"],
	[22.0, -28.4, "E2"], [24.6, -28.4, "E2"], [25.7, -28.4, "IBE"], [27.4, -29.0, "E3"], [27.4, -38.0, "E3"],
	[29.4, -38.0, "E4"], [27.4, -38.0, "E3"], [27.4, -50.0, "E3"], [27.4, -51.6, "E3l"], [26.6, -51.9, "E5"], [24.0, -51.9, "E5"],
	[23.5, -57.0, "E5"], [23.5, -60.0, "E5u"], [26.0, -65.0, "EB"], [23.0, -64.0, "EB"], [20.0, -64.0, "EH"],
	[19.75, -48.0, "EH"], [19.75, -32.0, "EH"], [19.75, -28.0, "E2"], [19.0, -20.0, "E1"], [19.0, -5.0, "E1"],
	[13.5, -4.5, "ER"], [9.0, -4.5, "A"], [-3.0, -4.5, "A"],
	# Act 3: back to the pool where she woke, over its road, the bridge, the Gate, the Shrine
	[-3.0, 5.0, "A"], [-2.5, 7.5, "A"], [-2.5, 11.5, "VW"], [-2.5, 17.0, "WS"], [-2.5, 18.85, "WS"],
	# (the halves' road, stone by stone: Ch1Geo's grid at GP)
	[-4.625, 18.85, "P"], [-5.875, 18.85, "P"], [-5.875, 17.65, "P"], [-8.375, 17.65, "P"], [-8.375, 20.05, "P"],
	[-12.125, 20.05, "P"], [-13.6, 20.05, "PW"], [-14.6, 18.85, "PW"], [-28.0, 18.85, "I21"], [-41.5, 18.85, "I22"],
	[-45.0, 18.85, "I22"], [-45.0, 14.0, "I22"], [-45.0, 11.0, "I23"], [-45.0, 8.6, "I23"],
]

## which part of the chapter a space belongs to (one merged zone mesh per part: the marble's per-instance
## uniforms are a scarce buffer on the web's GL)
const PART := {"WS": "south", "I1": "south", "I2": "south", "I3": "south", "IB1": "south", "I4": "south", "I4s": "south",
	"I5": "south", "A": "hub", "VW": "south", "P": "act3", "Pp": "act3", "Pr": "act3", "PW": "act3", "I21": "act3", "I22": "act3", "I22f": "act3", "I23": "act3",
	"WR": "west", "W1": "west", "W2": "west", "W2c": "west", "W3": "west", "W4": "west", "W5": "west", "IBW": "west", "W6": "west",
	"WB": "west", "W7": "west", "N1": "north", "N1l": "north", "N2": "north", "N3": "north", "N4": "north", "IBN": "north", "N5": "north",
	"N6": "north", "N7d": "north", "N7": "north", "N7x": "north", "NB": "north", "NS": "north", "ER": "east", "E1": "east",
	"E2": "east", "IBE": "east", "E3": "east", "E4": "east", "E3l": "east", "E5": "east", "E5u": "east", "EB": "east", "EH": "east"}

## the mood of each part (world.set_mood, Agent A)
const MOOD := {"south": "act1", "hub": "act1", "west": "w_glass", "north": "n_garden", "east": "e_high", "act3": "act3"}
## each space's area (the game's area keys: its title, its music, its hints)
const AREA := {"WS": "waking_pool", "P": "waking_pool", "Pp": "waking_pool", "Pr": "waking_pool", "PW": "waking_pool", "I1": "waking_pool", "I2": "waking_pool",
	"I3": "waking_pool", "IB1": "waking_pool", "I4": "waking_pool", "I4s": "waking_pool", "I5": "waking_pool", "VW": "waking_pool",
	"A": "atrium", "WR": "stair_breath", "W1": "stair_breath", "W2": "stair_breath", "W2c": "stair_breath", "W3": "hall_glass",
	"W4": "hall_glass", "W5": "shard_gallery", "IBW": "shard_gallery", "W6": "shard_gallery", "WB": "shard_gallery", "W7": "shard_gallery",
	"N1": "garden_veiled", "N1l": "garden_veiled", "N2": "garden_veiled", "N3": "garden_veiled", "N4": "hollow_walk", "IBN": "court_light", "N5": "court_light",
	"N6": "court_light", "N7d": "mist_maze", "N7": "mist_maze", "N7x": "mist_maze", "NB": "mist_maze", "NS": "garden_veiled",
	"ER": "eidolon_ledge", "E1": "eidolon_ledge", "E2": "eidolon_ledge", "IBE": "eidolon_ledge", "E3": "eidolon_ledge", "E4": "eidolon_ledge",
	"E3l": "scales", "E5": "scales", "E5u": "scales", "EB": "scales", "EH": "eidolon_ledge",
	"I21": "gate_four", "I22": "gate_four", "I22f": "gate_four", "I23": "first_shrine"}
static func area_of_region(name: String) -> String:
	return str(AREA.get(key_of_region(name), ""))

static func mood_of_region(name: String) -> String:
	return MOOD.get(PART.get(key_of_region(name), ""), "")

static func w(x: float, z: float, y := 0.0) -> Vector3:
	return O + Vector3(x, y, z)

static func wr(x0: float, z0: float, x1: float, z1: float) -> Rect2:
	return Rect2(O.x + minf(x0, x1), O.z + minf(z0, z1), absf(x1 - x0), absf(z1 - z0))

static func space(id: String) -> Array:
	for s in SPACES:
		if s[0] == id: return s
	return []

static func space_rect(id: String) -> Rect2:
	var r: Array = space(id)[4]
	return wr(r[0], r[1], r[2], r[3])

## the space id a walk region belongs to (regions are named V2_<space>)
static func space_of_region(name: String) -> String:
	var id := key_of_region(name)
	if id == "": return ""
	if id in ["Pp", "Pr"]: return "P"
	if id == "I22f": return "I22"
	if id in ["I4s"]: return "I4"
	if id in ["W2c"]: return "W2"
	if id in ["N7d", "N7x"]: return "N7"
	if id in ["E3l"]: return "E3"
	if id in ["E5u"]: return "E5"
	if id in ["N1l"]: return "N1"
	return id

# ============================================================================================ build (geometry)
static func build(lv: Level) -> void:
	for e in WALK:
		var r := wr(e[1], e[2], e[3], e[4])
		var y0: float = e[5]
		var y1: float = e[6]
		var axis: int = e[7]
		lv.walk(r, y0 + O.y, (y1 + O.y) if not is_nan(y1) else NAN, axis, ZP + str(e[0]), not (str(e[0]) in NO_FLOOR))
	# (phase 4) I.21: the bridge's spans, one walk region each (Act3 builds them and lets them settle; before the kerbs,
	# so none is built across its ends)
	bridge_regions = []
	var bl: float = (BRIDGE[2] - BRIDGE[0]) / BRIDGE_N
	for k in BRIDGE_N:
		bridge_regions.append(lv.walk(wr(BRIDGE[0] + bl * k, BRIDGE[1], BRIDGE[0] + bl * (k + 1), BRIDGE[3]), O.y, NAN, -1, ZP + "I21"))
	for e in WALK:
		if str(e[0]) in NO_FLOOR: continue
		var r := wr(e[1], e[2], e[3], e[4])
		var zone := ZP + str(PART.get(str(e[0]), "misc"))
		var y0: float = e[5]
		var y1: float = e[6]
		var axis: int = e[7]
		if is_nan(y1) or axis < 0:
			lv.slab(zone, r, y0)
			_kerbs(lv, zone, r, y0)
		else:
			# a ramp: stairs over it (y0 at the low end of its axis)
			lv.steps(zone, r, axis, minf(y0, y1), maxf(y0, y1), y1 > y0, str(e[0]) == "EH")          # (the High Stair stands 3-4 m over the Scales' way up: its flank fades)
	for k in W7_STONES.size():
		var s: Array = W7_STONES[k]
		lv.walk(wr(s[0] - STONE_R, s[1] - STONE_R, s[0] + STONE_R, s[1] + STONE_R), float(s[2]) + O.y, NAN, -1, ZP + "W7")
		var rr := 0.5 + 0.04 * sin(k * 2.3)
		var bot := -1.2
		lv.mb(ZP + "west").cyl(w(s[0], s[1], (float(s[2]) + bot) * 0.5), rr, rr + 0.1, float(s[2]) - bot, lv.C(0.25), 12, Basis(Vector3.UP, k * 0.7))
	for k in N1_STONES.size():
		var s: Array = N1_STONES[k]
		lv.walk(wr(s[0] - 0.48, s[1] - 0.48, s[0] + 0.48, s[1] + 0.48), N1_Y + O.y, NAN, -1, ZP + "N1")
		lv.mb(ZP + "north").tag = "floor"
		lv.box(ZP + "north", w(s[0], s[1], N1_Y - 0.45 - 0.004 * (k % 2)), Vector3(0.9, 0.9, 0.9), 0.25, false, Basis(Vector3.UP, 0.2 * k))          # (phase 6: neighbours' tops 4 mm apart)
		lv.mb(ZP + "north").tag = ""
		if k + 1 < N1_STONES.size():
			var nx: Array = N1_STONES[k + 1]
			var m2 := Vector2((s[0] + nx[0]) * 0.5, (s[1] + nx[1]) * 0.5)
			lv.walk(wr(m2.x - 0.4, m2.y - 0.4, m2.x + 0.4, m2.y + 0.4), N1_Y + O.y, NAN, -1, ZP + "N1")
	lv.walk(wr(2.1, -9.25, 2.9, -8.9), N1_Y + O.y, NAN, -1, ZP + "N1")          # (off the landing onto the first stone)
	# (phase 4) I.21: the bridge's spans, one walk region each (Act3 builds them and lets them settle); I.22: the plinths
	for i in FOUR_PLINTHS.size():
		var q: Array = FOUR_PLINTHS[i]
		lv.box(ZP + "act3", w(q[0], q[1], PLINTH_H * 0.5), Vector3(1.0, PLINTH_H, 1.0), 0.25)
		lv.box(ZP + "act3", w(q[0], q[1], PLINTH_H + 0.015), Vector3(1.08, 0.03, 1.08), 0.25)
		if i == FOUR_PLINTHS.size() - 1:
			lv.walk(wr(q[0] - 0.5, q[1] - 0.5, q[0] + 0.5, q[1] + 0.5), PLINTH_H + 0.03 + O.y, NAN, -1, ZP + "I22f")
		else:
			lv.ob_rect(wr(q[0] - 0.56, q[1] - 0.56, q[0] + 0.56, q[1] + 0.56), "v2plinth%d" % i)
	for d in N1_DECOYS: lv.stump(w(d[0], d[1], -0.9), 1.1, true, 0.04)
	for e in WALLS:
		var r := wr(e[0], e[1], e[2], e[3])
		var y := _floor_near(lv, r)
		lv.wall(ZP + "walls", r, y, y + float(e[4]), true)
		lv.ob_rect(r, ZP + "wall")

static var bridge_regions: Array = []

## the floor height beside a wall (the highest walk region touching it)
static func _floor_near(lv: Level, r: Rect2) -> float:
	var best := -INF
	for g in lv.regions:
		if g.r.grow(0.2).intersects(r): best = maxf(best, g.height(r.get_center()))
	return 0.0 if best == -INF else best

## a low kerb with a balustrade along every open edge of a flat walk rect (outside it: you never walk into it)
static func _kerbs(lv: Level, zone: String, r: Rect2, y: float) -> void:
	const STEP := 0.25
	const K := 0.32
	for side in 4:
		var a: Vector2
		var b: Vector2
		var out: Vector2
		match side:
			0: a = r.position; b = Vector2(r.end.x, r.position.y); out = Vector2(0, -1)
			1: a = Vector2(r.end.x, r.position.y); b = r.end; out = Vector2(1, 0)
			2: a = Vector2(r.position.x, r.end.y); b = r.end; out = Vector2(0, 1)
			_: a = r.position; b = Vector2(r.position.x, r.end.y); out = Vector2(-1, 0)
		var L := a.distance_to(b)
		var n := maxi(1, int(round(L / STEP)))
		var run_start := -1
		for i in n + 1:
			var open := false
			if i < n:
				var p := a.lerp(b, (i + 0.5) / n) + out * 0.12
				open = not _on_any(lv, p) and not _water_at(p)
			if open and run_start < 0: run_start = i
			if (not open or i == n) and run_start >= 0:
				var k0 := float(run_start) / n
				var k1 := float(i) / n
				if (k1 - k0) * L >= 0.4:
					var p0 := a.lerp(b, k0)
					var p1 := a.lerp(b, k1)
					# (phase 6, the flicker sweep) an end that runs into another space's floor (or its kerb) stops a few
					# millimetres short, a different few for each side: never in the plane of the kerb it meets there.
					# Ends where the line runs on into nothing (two kerbs in one line) stay put: their posts are shared.
					var dirv := (b - a) / L
					var e := 0.003 * (side + 1)
					var q0 := p0 - dirv * 0.12 + out * 0.12
					var q1 := p1 + dirv * 0.12 + out * 0.12
					if _on_any(lv, q0) or _water_at(q0): p0 += dirv * e
					if _on_any(lv, q1) or _water_at(q1): p1 -= dirv * e
					var kr := Rect2(p0, Vector2.ZERO).expand(p1).expand(p1 + out * K).expand(p0 + out * K)
					# (each side's kerb a few millimetres under the floor, and under the other sides': where the kerbs of two
					# spaces meet at a corner they are never coplanar, so they cannot flicker)
					lv.slab(zone, kr, y - 0.004 * (side + 1), 0.5, 0.25, false)
					lv.balustrade(zone, p0 + out * K * 0.5, p1 + out * K * 0.5, y - 0.004 * (side + 1))
				run_start = -1

static func _on_any(lv: Level, p: Vector2) -> bool:
	for g in lv.regions:
		if g.has(p): return true
	return false

## (a kerb is not built along water that is part of the design: the pool's own rim is the puzzle's)
## the still water's surface under a world point (the designed waters: the pool, the inlet, the colonnade), NAN if none
static func water_y_at(p: Vector2) -> float:
	for e in WATER:
		if e[5] and wr(e[0], e[1], e[2], e[3]).has_point(p): return float(e[4]) + O.y
	return NAN

static func _water_at(p: Vector2) -> bool:
	for e in WATER:
		if e[5] and wr(e[0], e[1], e[2], e[3]).has_point(p): return true
	return false

# ============================================================================================ the Tripo pieces
## the beats' Tripo pieces (PIECES), merged into ONE marble mesh (the web's buffer of per-instance marble values holds
## 256 instances in all); each keeps its own footprint. `piece_xfs` [asset, Transform3D] for the tests.
static var piece_xfs: Array = []
static func pieces(lv: Level, parent: Node3D) -> MeshInstance3D:
	piece_xfs = []
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 0
	for e in PIECES:
		if str(e[0]) == "colossus_head_veiled":          # (A: the veiled Observer, its own model and dressing)
			Dress.observer(parent, w(e[1], e[3], -0.42), 135.0, 22.0, -0.42 + O.y, 0.7)
			continue
		var a := Props._mesh(e[0])
		if a.is_empty(): continue
		var xf := Transform3D(Basis(Vector3.UP, deg_to_rad(float(e[4]))) * Basis.from_scale(Vector3.ONE * float(e[5])), w(e[1], e[3], e[2]))
		var m: ArrayMesh = a[0]
		for si in m.get_surface_count(): st.append_from(m, si, xf)
		piece_xfs.append([e[0], xf])
		n += 1
		var bb: AABB = xf * (a[1] as AABB)
		if str(e[0]) == "colossus_head_veiled": continue          # (in the water: nothing walks there)
		var fr := Rect2(bb.position.x, bb.position.z, bb.size.x, bb.size.z)
		if str(e[0]).begins_with("statue") or str(e[0]) == "column_stump" or str(e[0]) == "brazier":
			lv.ob_circle(fr.get_center(), minf(fr.size.x, fr.size.y) * 0.5 + 0.03, "v2piece:" + str(e[0]))
		else:
			lv.ob_rect(fr, "v2piece:" + str(e[0]))
	var mi := MeshInstance3D.new()
	mi.name = "V2Pieces"
	if n > 0: mi.mesh = st.commit()
	mi.material_override = lv.marble_mat
	mi.layers = PlanarMirror.LAYER_MAIN_FX
	parent.add_child(mi)
	return mi

## the doors: no footprint of their own (each beat closes its doorway with an obstacle and opens it)
static var door_nodes: Array = []
static func doors(lv: Level, parent: Node3D) -> Array:
	var out := []
	door_nodes = out
	for e in DOORS:
		var a := Props._mesh(e[0])
		if a.is_empty(): continue
		var mi := MeshInstance3D.new()
		mi.name = "V2Door_%s_%d" % [e[0], out.size()]
		mi.mesh = _occ_copy(a[0])          # (a doorway stands in the way of the view as you pass: it fades, as walls do)
		mi.material_override = lv.marble_occ_mat
		mi.transform = Transform3D(Basis(Vector3.UP, deg_to_rad(float(e[4]))) * Basis.from_scale(Vector3.ONE * float(e[5])), w(e[1], e[2], e[3]))
		mi.layers = PlanarMirror.LAYER_MAIN_FX
		parent.add_child(mi)
		lv.occluders.append(mi.transform * (a[1] as AABB))
		out.append(mi)
	return out

## a prop mesh re-coloured as a see-through occluder (vertex colour b = 1: marble_occ fades it)
static var _occ_cache := {}
static func _occ_copy(m: ArrayMesh) -> ArrayMesh:
	if _occ_cache.has(m): return _occ_cache[m]
	var out := ArrayMesh.new()
	for si in m.get_surface_count():
		var arr := m.surface_get_arrays(si)
		var cols: PackedColorArray = arr[Mesh.ARRAY_COLOR]
		for i in cols.size(): cols[i].b = 1.0
		arr[Mesh.ARRAY_COLOR] = cols
		out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	_occ_cache[m] = out
	return out

## the pool's water material (the prologue clouds it; its WaterFX ripples it)
static var _pool_mat: ShaderMaterial
static func pool_mat(lv: Level) -> ShaderMaterial:
	if _pool_mat == null:
		_pool_mat = ShaderMaterial.new()
		_pool_mat.shader = preload("res://shaders/water.gdshader")
		_pool_mat.set_shader_parameter("noise_tex", lv.noise_tex)
	return _pool_mat

## the water sheets (the game's water shader)
static func water(lv: Level, parent: Node3D) -> void:
	for e in WATER:
		var m := ShaderMaterial.new()
		if e == WATER[0]: m = pool_mat(lv)
		m.shader = preload("res://shaders/water.gdshader")
		m.set_shader_parameter("noise_tex", lv.noise_tex)
		var mi := MeshInstance3D.new()
		mi.name = "V2Water"
		var pm := PlaneMesh.new()
		pm.size = Vector2(absf(e[2] - e[0]), absf(e[3] - e[1]))
		mi.mesh = pm
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.position = w((e[0] + e[2]) * 0.5, (e[1] + e[3]) * 0.5, e[4])
		parent.add_child(mi)

## A's landmark dressing (scripts/fx/dress.gd) for every space that has a recipe; the route through it is kept clear
static func dress(lv: Level, parent: Node3D) -> Array:
	var keep := route_keep()
	for k in KEEP_EXTRA:
		keep.append(wr(k[0], k[1], k[2], k[3]))
	var out := []
	for s in SPACES:
		if str(s[6]) == "": continue
		var d := Dress.build(lv, parent, s[6], space_rect(s[0]), float(s[5]) + O.y, keep)
		out.append(d)
		for sk in d.skipped: print("[v2 dress] %s %s: %s" % [s[0], sk[0], sk[1]])
	return out

## kept clear besides the route: the Atrium's road mouths, the crypt door, the Veiled Way, the Cloister Stair's foot,
## the Shadow Chamber's NE corner (the Cloister Stair runs behind it), and no Beacon pillars in the Atrium (the
## Beacons are the wings')
const KEEP_EXTRA := [[-10.0, -1.6, -8.0, 1.6], [0.5, -8.0, 4.5, -6.0], [8.0, -6.1, 10.0, -2.9], [8.0, 1.8, 10.0, 4.2], [-4.2, 6.0, -0.8, 8.0], [-8.1, -8.0, -5.9, -6.0], [-10.6, -22.5, -9.0, -20.9],
			[-9.7, -0.7, -8.5, 0.7], [-0.7, -8.0, 0.7, -6.8], [8.5, -0.7, 9.7, 0.7],
			[10.5, 4.6, 12.6, 6.6], [12.1, 0.8, 14.0, 3.4],          # (the crypt: Theron's tablet and her lamp's rim, and the ways to them)
			# (phase 3) the wings' puzzle floors, whole: the Hall, the Shadow Chamber, the Turned Ones and her glass, Our Steps,
			# the Court, the Maze, the Singing Stones, the Scales, the Eidolon Plate's terrace
			[-27.6, -24.6, -18.4, -15.0], [-14.0, -20.9, -9.0, -13.6], [-1.7, -25.0, 5.0, -20.5], [5.5, -25.0, 13.45, -16.0],
			[-5.0, -37.0, 5.0, -27.0], [-3.0, -49.0, 5.0, -39.0], [20.5, -30.7, 25.0, -28.6], [22.0, -58.0, 29.4, -50.4], [22.0, -68.0, 30.0, -62.0]]

## the route as kept-clear rects (1.6 m wide along each leg)
static func route_keep() -> Array:
	var out := []
	for i in ROUTE.size() - 1:
		var a := Vector2(ROUTE[i][0], ROUTE[i][1])
		var b := Vector2(ROUTE[i + 1][0], ROUTE[i + 1][1])
		out.append(wr(minf(a.x, b.x) - 0.8, minf(a.y, b.y) - 0.8, maxf(a.x, b.x) + 0.8, maxf(a.y, b.y) + 0.8))
	return out

## a flat label of each space on its floor (block-out review; Map2.labels_on = false hides them)
static var labels_on := OS.get_environment("EIDOLON_LABELS") == "1"          # (review shots only: the live game has none)
static func labels(parent: Node3D) -> void:
	if not labels_on: return
	for s in SPACES:
		var r := space_rect(s[0])
		var l := Label3D.new()
		l.name = "V2Label_" + str(s[0])
		l.text = "%s\n%s" % [s[1], s[2]]
		l.font_size = 64
		l.pixel_size = 0.006
		l.modulate = Color(0.55, 0.06, 0.1, 0.85)
		l.outline_modulate = Color(1, 1, 1, 0.5)
		l.outline_size = 8
		l.rotation = Vector3(-PI * 0.5, -PI * 0.25, 0.0)
		l.layers = PlanarMirror.LAYER_MAIN_FX
		l.shaded = false
		l.double_sided = false
		var c := r.get_center()
		l.position = Vector3(c.x, float(s[5]) + O.y + 0.03, c.y)
		l.visible = labels_on
		parent.add_child(l)

# ============================================================================================ tools
## (for A's satchel map, scripts/fx/map_view.gd) every space as drawn on the map: [id, beat, name, kind, Rect2 (world
## x, z), floor y, part (south / hub / west / north / east / act3)]. The walk regions in a space: Level.regions whose
## Map2.space_of_region(name) is that id (the v1 rooms keep their v1 region names, mapped by V1_KEY).
static func map_spaces() -> Array:
	var out := []
	for s in SPACES:
		out.append([s[0], s[1], s[2], s[3], space_rect(s[0]), float(s[5]) + O.y, str(PART.get(s[0], ""))])
	return out

## the layout as JSON (tests/map2_dump.gd -> tests/render_map2.py -> dev/shots/v2-map.png)
static func to_json(extra: Array = []) -> String:
	var sp := []
	for s in SPACES: sp.append({"id": s[0], "beat": s[1], "name": s[2], "kind": s[3], "rect": s[4], "y": s[5], "dress": s[6]})
	var wk := []
	for e in WALK: wk.append({"space": e[0], "rect": [e[1], e[2], e[3], e[4]], "y0": e[5], "y1": e[5] if is_nan(e[6]) else e[6], "axis": e[7]})
	wk.append({"space": "I21", "rect": BRIDGE, "y0": 0.0, "y1": 0.0, "axis": -1})          # (its spans, Map2.build)
	# (phase 3: the v1 rooms' own regions, from a built Level: [key, Rect2 (world), y0, y1, axis])
	for e in extra:
		var r: Rect2 = e[1]
		wk.append({"space": e[0], "rect": [r.position.x - O.x, r.position.y - O.z, r.end.x - O.x, r.end.y - O.z], "y0": float(e[2]) - O.y, "y1": float(e[3]) - O.y, "axis": e[4]})
	var rt := []
	for e in ROUTE: rt.append([e[0], e[1], e[2]])
	var pcs := []
	for e in PIECES: pcs.append({"asset": e[0], "x": e[1], "z": e[3], "note": e[6]})
	for e in DOORS: pcs.append({"asset": e[0], "x": e[1], "z": e[2], "note": e[6]})
	var lm := []
	var keep := route_keep()
	for k in KEEP_EXTRA: keep.append(wr(k[0], k[1], k[2], k[3]))
	for s in SPACES:
		var r := space_rect(s[0])
		var ks := []
		for k: Rect2 in keep:
			var c := k.intersection(r)
			if c.has_area(): ks.append([snappedf(c.position.x, 0.01), snappedf(c.position.y, 0.01), snappedf(c.end.x, 0.01), snappedf(c.end.y, 0.01)])
		lm.append({"id": s[0], "recipe": s[6], "rect_world": [r.position.x, r.position.y, r.end.x, r.end.y], "y": float(s[5]) + O.y, "keep_world": ks})
	return JSON.stringify({"landmarks": lm, "spaces": sp, "walk": wk, "water": WATER, "origin": [O.x, O.z], "walls": WALLS, "route": rt, "pieces": pcs})
