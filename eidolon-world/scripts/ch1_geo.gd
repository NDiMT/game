class_name Ch1Geo
extends RefCounted
## Chapter I's puzzle data shared by chapter.gd and the tests: the Pool of Halves' grid (I.20, at Map2.GP), the Mist
## Maze (N.7, at Map2.GN), the Tree of Shards and the Upward Spring. (v2: the geometry is Map2's and WingsGeo's.)

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

## (v2: the grid lies in the Pool of Halves, at Map2.GP)
static func cell_pos(c: Vector2i) -> Vector2:
	return Vector2(Map2.GP.x + POOL_X0 + POOL_DX * c.x, Map2.GP.z + POOL_Z0 + POOL_DZ * c.y)

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

# ------------------------------------------------------------------ v0.9 the wonder spaces (no puzzles)
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
