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

# the mist maze: 4 columns x 5 rows of 2 m cells; open passages between cells (row, col)
const MZ_ORIGIN := Vector2(9.0 + Map2.GN.x, -29.0 + Map2.GN.z)          # (v2: the maze stands at Map2.GN)      # x of column 0's west edge, z of row 0's north edge
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
const MZ_MIRROR_X := 8.8 + Map2.GN.x                    # her pool is the maze mirrored across this line

static func mz_cell(rc: Vector2i) -> Vector3:
	return Vector3(MZ_ORIGIN.x + rc.y * 2.0 + 1.0, 2.0, MZ_ORIGIN.y - rc.x * 2.0 - 1.0)

static func R(x0: float, z0: float, x1: float, z1: float) -> Rect2:
	return Level.R(x0, z0, x1, z1)

static func build(lv: Level) -> void:
	_aqueduct(lv)

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

# ------------------------------------------------------------------ 4. the shadow chamber (v0.8.1)
## The old narrow Shard Gallery is a readable chamber now: "Where Her Shadow Fell". It opens off the Hall's
## east door; the true arch on its east side (seen through the shard) leads into the Garden. The walls
## toward the camera (east and south) are low parapets, so the whole floor reads from the iso view.
const SC_ROOM := Rect2(5.0, -16.9, 5.0, 7.3)          # x 5..10, z -16.9..-9.6 (+ the way in from the Hall, x 5..7 to z -18.4)
# ------------------------------------------------------------------ v0.9 the wonder spaces (no puzzles)
## the Sunken Colossus: from the shadow chamber's south gate, down the garden's west court and out over
## still black water on stepping stones that run along the cheek of a giant veiled head, up into the
## Garden of the Veiled from the south
const CO_HEAD := Vector3(19.3, 0.0, 0.0)          # the head's centre at the water line
const CO_WATER_Y := 0.15
## (the head stands EAST of the whole way: from the one fixed view it never hides the stones)
const CO_STONES := [Vector2(8.5, -0.9), Vector2(8.7, 0.2), Vector2(9.0, 1.3), Vector2(9.6, 2.3), Vector2(10.5, 3.0),
	Vector2(11.6, 3.4), Vector2(12.7, 3.3), Vector2(13.6, 2.7), Vector2(14.4, 1.9), Vector2(14.95, 1.0), Vector2(15.3, 0.0),
	Vector2(15.5, -1.0), Vector2(15.55, -2.0), Vector2(15.55, -3.0), Vector2(15.55, -3.7)]
## the Tree of Shards: in a nook beside the way from the Court of Light into the Mist Maze
const TS_TREE := Map2.GN + Vector3(15.9, 2.0, -28.15)
## the Upward Spring: a balcony off the high walkway, over the void where a fountain falls upward
const SP_BASIN := Map2.GE + Vector3(37.2, 0.6, -32.0)          # (v2: beside the Mirror Walk, Map2.GE)
static func _edge_key(a: Vector2i, b: Vector2i) -> String:
	if a.x > b.x or (a.x == b.x and a.y > b.y):
		var t := a; a = b; b = t
	return "%d,%d-%d,%d" % [a.x, a.y, b.x, b.y]

## for chapter.gd: is the passage between two cells open?
static func mz_is_open(a: Vector2i, b: Vector2i) -> bool:
	for e in MZ_OPEN:
		if _edge_key(e[0], e[1]) == _edge_key(a, b): return true
	return false
