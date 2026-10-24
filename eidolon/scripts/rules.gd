class_name Rules
extends RefCounted
## Pure, deterministic puzzle rules (no nodes). Mirrors tools/solver.py exactly.
##
## One swipe = one turn in direction d:
##  1. CUBE rolls one tile if the target is floor, free of bodies and not across a mirror panel.
##  2. Each EIDOLON (mirror order) gets d reflected across its own mirror (the component perpendicular
##     to the mirror is negated) and steps one tile under the same test. Blocked bodies stay put.
##  3. Each COUNTER-MIRROR whose rail runs along d slides one line OPPOSITE to d, if the rail continues
##     and the line of tiles it would sweep holds no body and no column.
##  4. Each Eidolon whose mirror slid is carried 2 more tiles in the slide direction, tile by tile,
##     stopping at the first blocked tile (a reflection moves twice as far as its mirror).
## A swipe that changes nothing is not a move. Goal: cube on its glyph and every Eidolon on its glyph.

const DIRS: Array[Vector2i] = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
const DNAME := {"R": Vector2i(1, 0), "L": Vector2i(-1, 0), "D": Vector2i(0, 1), "U": Vector2i(0, -1)}

var id := 0
var chapter := 1
var title := ""
var line := ""
var par := -1
var solution := ""
var w := 0
var h := 0
var floor_tiles := {}            # Vector2i -> true
var walls := {}                  # Vector2i -> true
var goal := Vector2i.ZERO
var egoals: Array[Vector2i] = []
var mirrors: Array = []          # [{axis:"x"/"z", pos:int, rail:Vector2i or null}]
var start: Dictionary            # state

# state = {cube: Vector2i, eids: Array[Vector2i], mpos: Array[int]}

static func from_json(text: String) -> Rules:
	var d: Dictionary = JSON.parse_string(text)
	var r := Rules.new()
	r.id = int(d.get("id", 0))
	r.chapter = int(d.get("chapter", 1))
	r.title = str(d.get("title", ""))
	r.line = str(d.get("line", ""))
	r.par = int(d.get("par", -1))
	r.solution = str(d.get("solution", ""))
	var rows: Array = d["map"]
	r.h = rows.size()
	var cube := Vector2i(-1, -1)
	var eids := {}
	var eg := {}
	for z in rows.size():
		var row: String = rows[z]
		r.w = maxi(r.w, row.length())
		for x in row.length():
			var ch := row[x]
			var p := Vector2i(x, z)
			if ch == "~" or ch == " ": continue
			if ch == "#":
				r.walls[p] = true
				continue
			r.floor_tiles[p] = true
			match ch:
				"P": cube = p
				"G": r.goal = p
				"A": eids[0] = p
				"B": eids[1] = p
				"a": eg[0] = p
				"b": eg[1] = p
	for m: Dictionary in d["mirrors"]:
		var mm := {"axis": str(m["axis"]), "pos": int(m["pos"]), "rail": null}
		if m.has("rail"): mm["rail"] = Vector2i(int(m["rail"][0]), int(m["rail"][1]))
		r.mirrors.append(mm)
	var e0: Array[Vector2i] = []
	var mp: Array[int] = []
	for i in r.mirrors.size():
		e0.append(eids[i]); r.egoals.append(eg[i]); mp.append(r.mirrors[i]["pos"])
	r.start = {"cube": cube, "eids": e0, "mpos": mp}
	return r

static func copy_state(s: Dictionary) -> Dictionary:
	return {"cube": s["cube"], "eids": (s["eids"] as Array[Vector2i]).duplicate(), "mpos": (s["mpos"] as Array[int]).duplicate()}

static func key(s: Dictionary) -> String:
	return "%s|%s|%s" % [s["cube"], s["eids"], s["mpos"]]

func is_static_rail(i: int) -> bool:
	return mirrors[i]["rail"] == null

func passable(p: Vector2i) -> bool:
	return floor_tiles.has(p)

func axis_k(i: int) -> int:
	return 0 if mirrors[i]["axis"] == "x" else 1

func crosses(mpos: Array[int], a: Vector2i, b: Vector2i) -> bool:
	for i in mirrors.size():
		var k := axis_k(i)
		if (a[k] < mpos[i]) != (b[k] < mpos[i]): return true
	return false

## Applies one swipe. Returns {state, cube_moved, eid_step:[bool], eid_carry:[[Vector2i...]], slid:[int], changed}
func step(s: Dictionary, d: Vector2i) -> Dictionary:
	var cube: Vector2i = s["cube"]
	var eids: Array[Vector2i] = (s["eids"] as Array[Vector2i]).duplicate()
	var mpos: Array[int] = (s["mpos"] as Array[int]).duplicate()
	var n := mirrors.size()
	var bodies: Array[Vector2i] = [cube]
	bodies.append_array(eids)
	var ev := {"cube_from": cube, "cube_moved": false, "eid_from": eids.duplicate(), "eid_step": [], "eid_dir": [],
		"eid_carry": [], "slid": [], "changed": false}
	var _free := func(i: int, a: Vector2i, b: Vector2i) -> bool:
		if not floor_tiles.has(b): return false
		if crosses(mpos, a, b): return false
		for j in bodies.size():
			if j != i and bodies[j] == b: return false
		return true
	# 1. cube
	var t := cube + d
	if _free.call(0, cube, t):
		cube = t; bodies[0] = t; ev["cube_moved"] = true
	# 2. eidolons: mirrored input
	for i in n:
		var dd := Vector2i(-d.x, d.y) if mirrors[i]["axis"] == "x" else Vector2i(d.x, -d.y)
		ev["eid_dir"].append(dd)
		var e := eids[i]
		var te := e + dd
		var ok: bool = _free.call(i + 1, e, te)
		if ok:
			eids[i] = te; bodies[i + 1] = te
		ev["eid_step"].append(ok)
		ev["eid_carry"].append([])
		ev["slid"].append(0)
	# 3. counter-mirrors slide against the swipe
	for i in n:
		var rail = mirrors[i]["rail"]
		if rail == null: continue
		var k := axis_k(i)
		if d[k] == 0: continue
		var sgn := -d[k]
		var np := mpos[i] + sgn
		if np < rail.x or np > rail.y: continue
		var swept := mpos[i] - 1 if sgn < 0 else mpos[i]
		var blocked := false
		for q in bodies:
			if q[k] == swept: blocked = true
		for wq: Vector2i in walls:
			if wq[k] == swept: blocked = true
		if blocked: continue
		mpos[i] = np
		ev["slid"][i] = sgn
	# 4. carried by the moving reflection
	for i in n:
		var sgn: int = ev["slid"][i]
		if sgn == 0: continue
		var v := Vector2i(sgn, 0) if axis_k(i) == 0 else Vector2i(0, sgn)
		for _k in 2:
			var e := eids[i]
			var te := e + v
			if not _free.call(i + 1, e, te): break
			eids[i] = te; bodies[i + 1] = te
			ev["eid_carry"][i].append(te)
	var ns := {"cube": cube, "eids": eids, "mpos": mpos}
	ev["state"] = ns
	ev["changed"] = key(ns) != key(s)
	return ev

func won(s: Dictionary) -> bool:
	if s["cube"] != goal: return false
	for i in egoals.size():
		if s["eids"][i] != egoals[i]: return false
	return true

## Which glyphs are currently occupied: [cube_on, eid0_on, ...]
func lit(s: Dictionary) -> Array:
	var out := [s["cube"] == goal]
	for i in egoals.size(): out.append(s["eids"][i] == egoals[i])
	return out

## BFS. Returns {par:int (-1 unsolvable), path:String, states:int}
func solve(limit := 500000, from: Dictionary = {}) -> Dictionary:
	var s0: Dictionary = start if from.is_empty() else from
	if won(s0): return {"par": 0, "path": "", "states": 1}
	var names := ["R", "L", "D", "U"]
	var prev := {key(s0): null}
	var q: Array = [s0]
	var qi := 0
	while qi < q.size():
		var s: Dictionary = q[qi]; qi += 1
		var sk := key(s)
		for di in 4:
			var ev := step(s, DIRS[di])
			if not ev["changed"]: continue
			var ns: Dictionary = ev["state"]
			var nk := key(ns)
			if prev.has(nk): continue
			prev[nk] = [sk, names[di]]
			if won(ns):
				var path := ""
				var c := nk
				while prev[c] != null:
					path = prev[c][1] + path
					c = prev[c][0]
				return {"par": path.length(), "path": path, "states": prev.size()}
			q.append(ns)
			if prev.size() > limit: return {"par": -1, "path": "", "states": prev.size()}
	return {"par": -1, "path": "", "states": prev.size()}

static func load_all() -> Array:
	var out := []
	for i in range(1, 100):
		var p := "res://levels/%02d.json" % i
		if not FileAccess.file_exists(p): break
		out.append(Rules.from_json(FileAccess.get_file_as_string(p)))
	return out
