class_name Ch1Geo
extends RefCounted
## v0.5 Chapter I: the geometry of the new spaces, built with the Level kit (slabs, walls,
## balustrades, columns, statues, stairs). Puzzle objects live in chapter.gd.
##
##   Waking Pool      the Veiled Gate island; the pool now runs west as a wide aqueduct basin
##   Stair of Breath  x[-12.8,-9.4]  z[-14.4,3.6]  y 0 -> 0.5 -> 1, corridor into the Hall
##   Shard Gallery    x[5,7]         z[-18.4,-5.6] y 1   (behind the Hall's remembered door)
##   Hollow Walk      x[17.4,25.6]   z[-15,-6]     y 1   (8 x 9 cells of 1 m), ramp up to the Court
##   Mist Maze        x[9,17]        z[-39,-29]    y 2   (4 x 5 cells of 2 m), her pool x[0.6,8.6]
##   Echo Corridor    x[9,26.2]      z[-46.4,-39]  y 2   (hidden room x[16.4,20.2] z[-50.2,-46.4])
##   The Scales       x[26,33.4]     z[-52,-44.6]  y 2   (the lift rises to the high walkway, y 4)
##   High walkway     x[30.4,32.4]   z[-44.6,-23.4] y 4, stair down to the Eidolon Ledge

# v0.7 "The Pool of Halves": a broken path of stone beams across the pool, a 7 x 3 grid of cells (col
# grows WEST from the island, row grows south). Some pieces stand in YOUR world and turn on pivots (L and
# straight); the others exist only in the reflection (hers) until the path is whole.
# Connectors: N (row - 1), S (row + 1), E (col - 1), W (col + 1).
const POOL_X0 := -1.275
const POOL_DX := -1.25
const POOL_Z0 := 0.5
const POOL_DZ := 1.2
const POOL_COLS := 7
const POOL_ROWS := 3
const POOL_GHOSTS := {Vector2i(1, 0): "SW", Vector2i(3, 0): "ES", Vector2i(3, 1): "NS", Vector2i(4, 2): "EW", Vector2i(5, 2): "EW",
	Vector2i(6, 2): "EW", Vector2i(1, 2): "NW"}       # (v0.8 QA P0-1: no (2,2): the south row visibly stops short)
const POOL_REALS := [[Vector2i(0, 1), "NS"], [Vector2i(1, 1), "ES"], [Vector2i(2, 0), "NS"], [Vector2i(3, 2), "NE"]]   # base shapes
const POOL_START := [0, 0, 0, 0]            # quarter turns from the base shape
const POOL_IN := Vector2i(0, 1)             # entered from its E edge (the island)
const POOL_OUT := Vector2i(6, 2)            # left by its W edge (the far landing)
const BEAM_W := 0.82                        # a beam's width
const WATER_Y := -0.42

static func cell_pos(c: Vector2i) -> Vector2:
	return Vector2(POOL_X0 + POOL_DX * c.x, POOL_Z0 + POOL_DZ * c.y)

## a quarter turn (clockwise seen from above): N -> E -> S -> W
static func rot_conn(conn: String, k: int) -> String:
	var m := {"N": "E", "E": "S", "S": "W", "W": "N"}
	var out := conn
	for i in posmod(k, 4):
		var t := ""
		for ch in out: t += m[ch]
		out = t
	return out

static func dir_v(d: String) -> Vector2i:
	return {"N": Vector2i(0, -1), "S": Vector2i(0, 1), "E": Vector2i(-1, 0), "W": Vector2i(1, 0)}[d]

## is there one unbroken path from the island to the far landing, given the real pieces' turns?
static func pool_path(turns: Array) -> bool:
	var pieces := {}
	for c in POOL_GHOSTS: pieces[c] = POOL_GHOSTS[c]
	for i in POOL_REALS.size(): pieces[POOL_REALS[i][0]] = rot_conn(POOL_REALS[i][1], int(turns[i]))
	if not pieces.has(POOL_IN) or not ("E" in pieces[POOL_IN]): return false
	var opp := {"N": "S", "S": "N", "E": "W", "W": "E"}
	var seen := {POOL_IN: true}
	var stack: Array = [POOL_IN]
	while not stack.is_empty():
		var c: Vector2i = stack.pop_back()
		for d in pieces[c]:
			if c == POOL_OUT and d == "W": return true
			var n: Vector2i = c + dir_v(d)
			if pieces.has(n) and opp[d] in pieces[n] and not seen.has(n):
				seen[n] = true
				stack.append(n)
	return false

# hollow walk grid (cell (i, j) centre = (17.5 + i + 0.5, -15 + j + 0.5))
const HW_ORIGIN := Vector2(17.5, -15.0)
const HW_PILLARS := [Vector2i(2, 7), Vector2i(2, 6), Vector2i(5, 6), Vector2i(2, 5), Vector2i(5, 5), Vector2i(3, 3), Vector2i(4, 3)]
const HW_PLATES := [Vector2i(1, 6), Vector2i(6, 0)]
const HW_HOLLOWS := [Vector2i(5, 2), Vector2i(1, 1)]

# the mist maze: 4 columns x 5 rows of 2 m cells; open passages between cells (row, col)
const MZ_ORIGIN := Vector2(9.0, -29.0)      # x of column 0's west edge, z of row 0's north edge
const MZ_OPEN := [
	[Vector2i(0, 1), Vector2i(0, 2)], [Vector2i(0, 2), Vector2i(1, 2)], [Vector2i(1, 2), Vector2i(1, 3)],
	[Vector2i(1, 3), Vector2i(2, 3)], [Vector2i(2, 3), Vector2i(3, 3)], [Vector2i(3, 3), Vector2i(3, 2)],
	[Vector2i(3, 2), Vector2i(3, 1)], [Vector2i(3, 1), Vector2i(2, 1)], [Vector2i(2, 1), Vector2i(2, 0)],
	[Vector2i(2, 0), Vector2i(3, 0)], [Vector2i(3, 0), Vector2i(4, 0)],
	# dead ends
	[Vector2i(0, 1), Vector2i(0, 0)], [Vector2i(0, 0), Vector2i(1, 0)], [Vector2i(1, 0), Vector2i(1, 1)],
	[Vector2i(0, 3), Vector2i(1, 3)], [Vector2i(2, 2), Vector2i(2, 1)],
	[Vector2i(4, 3), Vector2i(3, 3)], [Vector2i(4, 3), Vector2i(4, 2)], [Vector2i(4, 2), Vector2i(4, 1)]]
const MZ_PATH := [Vector2i(0, 1), Vector2i(0, 2), Vector2i(1, 2), Vector2i(1, 3), Vector2i(2, 3), Vector2i(3, 3),
	Vector2i(3, 2), Vector2i(3, 1), Vector2i(2, 1), Vector2i(2, 0), Vector2i(3, 0), Vector2i(4, 0)]
const MZ_MIRROR_X := 8.8                    # her pool is the maze mirrored across this line

static func hw_cell(c: Vector2i) -> Vector3:
	return Vector3(HW_ORIGIN.x + c.x + 0.5, 1.0, HW_ORIGIN.y + c.y + 0.5)

static func mz_cell(rc: Vector2i) -> Vector3:
	return Vector3(MZ_ORIGIN.x + rc.y * 2.0 + 1.0, 2.0, MZ_ORIGIN.y - rc.x * 2.0 - 1.0)

static func R(x0: float, z0: float, x1: float, z1: float) -> Rect2:
	return Level.R(x0, z0, x1, z1)

static func build(lv: Level) -> void:
	_aqueduct(lv)
	_stair_of_breath(lv)
	_gallery(lv)
	_hollow_walk(lv)
	_maze(lv)
	_echo(lv)
	_scales(lv)

# ------------------------------------------------------------------ 1. the waking pool's aqueduct
static func _aqueduct(lv: Level) -> void:
	var z := "T"
	# the basin continues west off the island as a wide stone channel full of still water
	lv.box(z, Vector3(-7.3, -0.75, 1.7), Vector3(4.7, 0.3, 3.75), 0.5)
	lv.box(z, Vector3(-7.3, -1.15, 1.7), Vector3(4.7, 0.6, 4.4), 0.0)
	lv.underside(z, R(-9.6, -0.45, -5.0, 3.85), -1.25)
	for zz in [-0.3, 3.7]:
		lv.box(z, Vector3(-7.3, -0.2, zz), Vector3(4.7, 0.5, 0.32), 0.25)
		lv.box(z, Vector3(-7.3, 0.08, zz), Vector3(4.8, 0.08, 0.38), 0.25)
	# the inner west strip of the old island is water now too (no floor there)

# ------------------------------------------------------------------ 2. the stair of breath
static func _stair_of_breath(lv: Level) -> void:
	var z := "W"
	# landing where the stones come ashore
	lv.slab(z, R(-12.8, -0.2, -9.4, 3.6), 0.0, 0.7, 0.0)
	lv.walk(R(-12.8, -0.2, -9.4, 3.6), 0.0, NAN, -1, "W_land")
	lv.balustrade(z, Vector2(-12.75, 3.55), Vector2(-9.5, 3.55), 0.0)
	lv.balustrade(z, Vector2(-12.75, 3.4), Vector2(-12.75, 0.0), 0.0)
	lv.statue(z, Vector3(-12.0, 0.0, 2.9), PI * 0.75, 0.85)
	# first flight up to the breath landing
	lv.steps(z, R(-12.4, -4.0, -10.2, -0.2), 1, 0.0, 0.5, false)     # (v0.7: high at the landing end, as you walk it)
	lv.walk(R(-12.4, -4.0, -10.2, -0.2), 0.5, 0.0, 1, "W_stair1")
	lv.slab(z, R(-12.4, -6.6, -10.2, -4.0), 0.5, 0.7, 0.0)
	lv.walk(R(-12.4, -6.6, -10.2, -4.0), 0.5, NAN, -1, "W_breath")
	# the cliff wall on the east (between the stair and the water), the small glass set into it facing
	# west; the open side of the stair is the west, over the void
	lv.wall(z, R(-10.2, -12.6, -9.7, -0.2), -0.6, 3.9, true)
	# bronze frame: proud of the wall by 12 cm (its back is buried in the wall: no coplanar faces)
	lv.box(z, Vector3(-10.22, 1.75, -5.3), Vector3(0.2, 1.75, 1.35), 1.0)
	lv.box(z, Vector3(-10.36, 0.93, -5.3), Vector3(0.36, 0.12, 1.3), 0.25)
	# second flight to the top (sealed by a veil of mist until she answers)
	lv.steps(z, R(-12.4, -10.6, -10.2, -6.6), 1, 0.5, 1.0, false)
	lv.walk(R(-12.4, -10.6, -10.2, -6.6), 1.0, 0.5, 1, "W_stair2")
	lv.slab(z, R(-12.4, -14.4, -10.2, -10.6), 1.0, 0.7, 0.0)
	lv.walk(R(-12.4, -14.4, -10.2, -10.6), 1.0, NAN, -1, "W_top")
	lv.ob_rect(R(-12.4, -6.95, -10.2, -6.65), "breath_gate")
	lv.column(Vector3(-12.15, 0.5, -6.8), 3.4)
	lv.column(Vector3(-10.45, 0.5, -6.8), 3.4)
	lv.box(z, Vector3(-11.3, 4.05, -6.8), Vector3(2.2, 0.4, 0.6), 0.25, true)
	for x in [-12.35]:
		lv.balustrade(z, Vector2(x, -0.3), Vector2(x, -3.9), 0.25)
		lv.balustrade(z, Vector2(x, -4.1), Vector2(x, -6.5), 0.5)
		lv.balustrade(z, Vector2(x, -7.2), Vector2(x, -10.5), 0.75)
		lv.balustrade(z, Vector2(x, -10.7), Vector2(x, -14.3), 1.0)
	lv.balustrade(z, Vector2(-12.35, -14.35), Vector2(-10.3, -14.35), 1.0)
	# the corridor east into the Hall of Glass, between its west columns
	lv.slab(z, R(-10.2, -14.2, -4.6, -12.8), 1.0, 0.6, 0.0)
	lv.walk(R(-10.2, -14.2, -4.6, -12.8), 1.0, NAN, -1, "W_corr")
	lv.balustrade(z, Vector2(-10.1, -14.25), Vector2(-5.2, -14.25), 1.0)
	lv.balustrade(z, Vector2(-10.1, -12.75), Vector2(-5.2, -12.75), 1.0)
	lv.rubble(Vector3(-12.1, 1.0, -14.1), 0.3, 3)

# ------------------------------------------------------------------ 4. the shard gallery
static func _gallery(lv: Level) -> void:
	var z := "GL"
	lv.slab(z, R(5.0, -18.4, 7.0, -5.6), 1.0, 0.7, 0.0)
	lv.walk(R(5.0, -18.4, 7.0, -5.6), 1.0, NAN, -1, "GL")
	# east wall (garden side) with the hidden passage; the illusory stretch is a separate zone
	lv.wall(z, R(6.85, -18.6, 7.2, -9.2), 1.0, 4.0, true)
	lv.wall(z, R(6.85, -7.8, 7.2, -5.4), 1.0, 4.0, true)
	lv.wall("GLs", R(6.85, -9.2, 7.2, -7.8), 1.0, 4.0, true)
	lv.box(z, Vector3(7.02, 4.3, -8.5), Vector3(0.4, 0.5, 1.8), 0.25, true)
	lv.ob_rect(R(6.85, -18.6, 7.25, -9.2))
	lv.ob_rect(R(6.85, -7.8, 7.25, -5.4))
	lv.ob_rect(R(6.85, -9.2, 7.25, -7.8), "gallery_secret")
	# west wall where the hall ends, and the dead end to the south
	lv.wall(z, R(4.6, -11.0, 5.0, -5.4), 1.0, 4.0, true)
	lv.wall(z, R(5.0, -5.9, 6.85, -5.5), 1.0, 4.0, true)
	# arches overhead every few metres, cracked mirror panes on the walls (the panes are puzzle objects)
	for zz in [-17.0, -14.2, -12.0, -6.4]:
		lv.box(z, Vector3(6.0, 4.15, zz), Vector3(2.4, 0.3, 0.4), 0.25, true)
	# two false doorways painted in relief on the east wall (only the shard shows which way is real)
	for zz in [-15.6, -12.6]:
		lv.box(z, Vector3(6.82, 2.4, zz - 0.75), Vector3(0.08, 2.8, 0.16), 0.25)
		lv.box(z, Vector3(6.82, 2.4, zz + 0.75), Vector3(0.08, 2.8, 0.16), 0.25)
		lv.box(z, Vector3(6.82, 3.85, zz), Vector3(0.08, 0.18, 1.66), 0.25)
	lv.statue(z, Vector3(5.55, 1.0, -6.4), PI * 0.5, 0.75, 0.5)

# ------------------------------------------------------------------ 6. the hollow walk
static func _hollow_walk(lv: Level) -> void:
	var z := "HW"
	lv.slab(z, R(17.4, -15.0, 25.6, -6.0), 1.0, 0.8, 0.0)
	lv.walk(R(17.5, -15.0, 25.5, -6.0), 1.0, NAN, -1, "HW")
	# low walls round the walk; the entrance from the garden is on the west, the exit south-west
	lv.wall(z, R(25.5, -15.1, 25.8, -5.9), 1.0, 2.2, true)
	lv.wall(z, R(17.3, -6.12, 25.6, -5.82), 1.0, 2.2, true)     # (v0.7: clear of the last row of cells, now that walls are solid)
	lv.wall(z, R(17.3, -10.9, 17.55, -6.0), 1.0, 2.2, true)
	lv.wall(z, R(17.3, -15.0, 17.55, -12.7), 1.0, 2.2, true)
	lv.wall(z, R(19.6, -15.25, 25.6, -15.0), 1.0, 2.2, true)
	# the doorway from the garden (its door is a puzzle object in the garden)
	lv.slab(z, R(16.8, -12.6, 17.6, -11.0), 1.0, 0.6, 0.0)
	lv.walk(R(16.8, -12.5, 17.6, -11.1), 1.0, NAN, -1, "g_door", false)
	# broken pillars on the grid (obstacles fill their cells)
	for c in HW_PILLARS:
		var p := hw_cell(c)
		lv.stump(p, 1.4 + 0.5 * fmod(float(c.x * 7 + c.y * 3), 3.0) / 3.0, false)
		lv.ob_circle(Vector2(p.x, p.z), 0.46)
	# the exit: a gated ramp up to the Court of Light
	lv.steps(z, R(17.5, -17.2, 19.5, -15.0), 1, 1.0, 2.0, false)
	lv.walk(R(17.5, -17.2, 19.5, -15.0), 2.0, 1.0, 1, "HW_ramp")
	lv.ob_rect(R(17.5, -15.3, 19.5, -15.0), "hw_gate")
	lv.column(Vector3(17.3, 1.0, -15.15), 3.2, false)
	lv.column(Vector3(19.7, 1.0, -15.15), 3.2, false)
	lv.slab("L", R(15.4, -18.4, 19.5, -17.2), 2.0, 0.8, 0.0)
	lv.walk(R(15.4, -18.4, 19.5, -17.2), 2.0, NAN, -1, "L_ramp")
	lv.balustrade(z, Vector2(19.55, -15.3), Vector2(19.55, -17.1), 1.0)
	lv.balustrade("L", Vector2(19.45, -17.3), Vector2(19.45, -18.3), 2.0)
	lv.statue(z, Vector3(24.8, 1.0, -6.7), PI * 0.75, 0.8, 0.5)
	lv.rubble(Vector3(24.6, 1.0, -14.3), 0.5, 4)

# ------------------------------------------------------------------ 8. the mist maze (+ her pool)
static func _maze(lv: Level) -> void:
	var z := "MZ"
	# the doorway from the Court's mural wall, and a landing
	lv.slab(z, R(10.9, -29.2, 13.1, -26.9), 2.0, 0.7, 0.0)
	lv.walk(R(10.9, -29.2, 13.1, -26.9), 2.0, NAN, -1, "MZ_door", false)
	lv.slab(z, R(9.0, -39.0, 17.0, -29.0), 2.0, 0.9, 0.0)
	lv.walk(R(9.0, -39.0, 17.0, -29.0), 2.0, NAN, -1, "MZ")
	# the maze walls are invisible: obstacles along the closed edges between cells
	var open := {}
	for e in MZ_OPEN:
		open[_edge_key(e[0], e[1])] = true
	for r in 5:
		for c in 4:
			var a := Vector2i(r, c)
			for nb in [Vector2i(r, c + 1), Vector2i(r + 1, c)]:
				if nb.x > 4 or nb.y > 3: continue
				if open.has(_edge_key(a, nb)): continue
				var x0 := MZ_ORIGIN.x + c * 2.0
				var zt := MZ_ORIGIN.y - r * 2.0
				if nb.y == c + 1:       # wall on the east edge of (r, c)
					lv.ob_rect(R(x0 + 1.92, zt - 2.0, x0 + 2.08, zt), "mzw_%d_%d_e" % [r, c])
				else:                   # wall on the south edge
					lv.ob_rect(R(x0, zt - 2.08, x0 + 2.0, zt - 1.92), "mzw_%d_%d_s" % [r, c])
	# the rim of the maze, low and broken; the outer edge is the edge of the slab
	lv.balustrade(z, Vector2(17.05, -29.1), Vector2(17.05, -38.9), 2.0)
	lv.balustrade(z, Vector2(11.0, -39.05), Vector2(16.9, -39.05), 2.0)
	for k in 6:
		lv.stump(Vector3(9.4 + k * 1.45, 2.0, -29.25 - (k % 2) * 9.5), 0.5 + 0.3 * (k % 3), false)
	# her pool: the maze mirrored across x = 8.8; she walks in it
	lv.box(z, Vector3(4.6, 1.45, -34.0), Vector3(8.0, 0.3, 10.0), 0.5)
	lv.box(z, Vector3(4.6, 1.05, -34.0), Vector3(8.6, 0.6, 10.6), 0.0)
	lv.underside(z, R(0.3, -39.3, 8.9, -28.7), 0.75)
	for e in [[Vector3(4.6, 1.9, -28.85), Vector3(8.6, 0.3, 0.3)], [Vector3(4.6, 1.9, -39.15), Vector3(8.6, 0.3, 0.3)],
			[Vector3(0.45, 1.9, -34.0), Vector3(0.3, 0.3, 10.6)], [Vector3(8.75, 1.9, -34.0), Vector3(0.3, 0.3, 10.6)]]:
		lv.box(z, e[0], e[1], 0.25)
	lv.statue(z, Vector3(1.4, 2.0, -28.2), PI, 0.7, 0.4, false)

static func _edge_key(a: Vector2i, b: Vector2i) -> String:
	if a.x > b.x or (a.x == b.x and a.y > b.y):
		var t := a; a = b; b = t
	return "%d,%d-%d,%d" % [a.x, a.y, b.x, b.y]

## for chapter.gd: is the passage between two cells open?
static func mz_is_open(a: Vector2i, b: Vector2i) -> bool:
	for e in MZ_OPEN:
		if _edge_key(e[0], e[1]) == _edge_key(a, b): return true
	return false

# ------------------------------------------------------------------ 9. the echo corridor
static func _echo(lv: Level) -> void:
	var z := "EC"
	lv.slab(z, R(9.0, -44.4, 11.0, -39.0), 2.0, 0.7, 0.0)
	lv.walk(R(9.0, -44.4, 11.0, -39.0), 2.0, NAN, -1, "EC_a")
	lv.slab(z, R(9.0, -46.4, 26.2, -44.4), 2.0, 0.8, 0.0)
	lv.walk(R(9.0, -46.4, 26.2, -44.4), 2.0, NAN, -1, "EC")
	# tall walls: the corridor rings with every step
	lv.wall(z, R(8.7, -46.7, 9.0, -39.0), 2.0, 5.2, true)
	lv.wall(z, R(11.0, -44.1, 11.3, -39.0), 2.0, 5.2, true)
	lv.wall(z, R(11.0, -44.4, 26.2, -44.1), 2.0, 3.2, true)      # (v0.8 QA P1-2: the near wall a parapet: the singing stones show)
	lv.wall(z, R(8.7, -46.7, 17.4, -46.4), 2.0, 5.2, true)
	lv.wall(z, R(19.2, -46.7, 26.2, -46.4), 2.0, 5.2, true)
	lv.wall("ECs", R(17.4, -46.7, 19.2, -46.4), 2.0, 5.2, true)
	lv.box(z, Vector3(18.3, 5.35, -46.55), Vector3(2.2, 0.3, 0.5), 0.25, true)
	lv.ob_rect(R(17.4, -46.8, 19.2, -46.3), "echo_secret")
	for xx in [12.0, 15.2, 21.4, 24.6]:
		lv.box(z, Vector3(xx, 5.4, -45.4), Vector3(0.4, 0.35, 2.6), 0.25, true)
	# the hidden room (a memory of the sea is kept there)
	lv.slab(z, R(16.4, -50.2, 20.2, -46.4), 2.0, 0.7, 0.0)
	lv.walk(R(17.5, -50.2, 19.1, -46.3), 2.0, NAN, -1, "EC_room_door", false)
	lv.walk(R(16.4, -50.2, 20.2, -46.9), 2.0, NAN, -1, "EC_room", false)
	lv.wall(z, R(16.1, -50.5, 16.4, -46.6), 2.0, 4.6, true)
	lv.wall(z, R(20.2, -50.5, 20.5, -46.6), 2.0, 4.6, true)
	lv.wall(z, R(16.1, -50.5, 20.5, -50.2), 2.0, 4.6, true)
	lv.rubble(Vector3(19.6, 2.0, -49.6), 0.35, 3)

# ------------------------------------------------------------------ 10. the scales + walkway
static func _scales(lv: Level) -> void:
	var z := "SC"
	lv.slab(z, R(26.0, -52.0, 33.4, -44.4), 2.0, 0.9, 0.0)
	lv.walk(R(26.0, -52.0, 33.4, -44.6), 2.0, NAN, -1, "SC")
	lv.balustrade(z, Vector2(26.1, -51.95), Vector2(33.3, -51.95), 2.0)
	lv.balustrade(z, Vector2(33.35, -51.8), Vector2(33.35, -44.7), 2.0)
	lv.balustrade(z, Vector2(26.2, -44.45), Vector2(30.3, -44.45), 2.0)
	lv.column(Vector3(26.5, 2.0, -51.5), 4.4)
	lv.column(Vector3(32.9, 2.0, -51.5), 4.4)
	# (v0.6: the balance, its pivot glass and its pans are puzzle objects: chapter.gd)
	# the lift (pan A) and the high walkway it rises to
	lv.walk(R(30.4, -46.6, 32.4, -44.6), 2.0, NAN, -1, "lift")
	lv.slab("WK", R(30.4, -44.6, 32.4, -21.2), 4.0, 0.5, 0.0, false)
	lv.walk(R(30.4, -44.6, 32.4, -21.2), 4.0, NAN, -1, "WK")
	lv.balustrade("WK", Vector2(32.45, -44.4), Vector2(32.45, -21.3), 4.0)
	lv.balustrade("WK", Vector2(30.35, -44.4), Vector2(30.35, -23.5), 4.0)
	lv.balustrade("WK", Vector2(30.45, -21.15), Vector2(32.4, -21.15), 4.0)
	for zz in [-41.0, -33.0, -26.0]:
		var m := lv.mb("WK")
		m.cyl(Vector3(31.4, 1.0, zz), 0.55, 0.42, 6.0, lv.C(0.25), 12)
	lv.steps("WK", R(29.0, -23.4, 30.4, -21.4), 0, 2.0, 4.0, true)
	lv.walk(R(29.0, -23.4, 30.4, -21.4), 2.0, 4.0, 0, "WK_down")
	lv.balustrade("WK", Vector2(29.05, -23.45), Vector2(30.3, -23.45), 3.0)
	lv.balustrade("WK", Vector2(29.05, -21.35), Vector2(30.3, -21.35), 3.0)
