extends Node
## (Agent A, dev) v2.0 landmark dressing IN THE GAME: each Dress recipe built on a bare test floor out in the game's own
## world (its camera, fog, light, mood and tier), the heroine standing at the landmark's south-west quarter, one shot each.
##   xvfb-run godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/dress_ingame.tscn -- --shots=/abs/dir [--low] [--only=a,b] [--zoom=10]
## [id, size (x, z m), mood, darkness, keep-clear lane (as a fraction rect of the landmark, or null)]
const SPACES := [
	["prologue", Vector2(7, 2.2), "prologue", 0.0, null],
	["stub_gateway", Vector2(6, 5), "act1", 0.0, Rect2(0.42, 0.25, 0.16, 0.75)],
	["glass_niche", Vector2(5, 4), "act1", 0.0, Rect2(0.35, 0.3, 0.3, 0.7)],
	["crypt", Vector2(6.5, 5), "act1", 0.55, Rect2(0.3, 0.35, 0.3, 0.65)],
	["atrium", Vector2(16, 13), "act1", 0.0, Rect2(0.42, 0.8, 0.16, 0.2)],
	["stair_breath", Vector2(5, 6), "w_glass", 0.0, Rect2(0.35, 0.15, 0.3, 0.85)],
	["hall_glass", Vector2(9, 8), "w_glass", 0.0, Rect2(0.3, 0.3, 0.4, 0.4)],
	["shadow_chamber", Vector2(8, 7), "w_glass", 0.0, Rect2(0.25, 0.25, 0.5, 0.5)],
	["hidden_way", Vector2(4, 8), "w_glass", 0.0, Rect2(0.3, 0.15, 0.4, 0.85)],
	["colossus", Vector2(9, 7), "w_glass", 0.0, Rect2(0.3, 0.3, 0.45, 0.45)],
	["colonnade", Vector2(10, 5), "n_garden", 0.0, Rect2(0.0, 0.3, 1.0, 0.25)],
	["turned_ones", Vector2(8, 6), "n_garden", 0.0, Rect2(0.3, 0.35, 0.4, 0.65)],
	["votive", Vector2(5, 4), "n_garden", 0.0, Rect2(0.3, 0.4, 0.4, 0.6)],
	["tree_shards", Vector2(6, 5), "n_garden", 0.0, Rect2(0.3, 0.3, 0.4, 0.5)],
	["mist_maze", Vector2(9, 9), "n_garden", 0.0, Rect2(0.2, 0.2, 0.6, 0.6)],
	["balcony", Vector2(10, 4), "e_high", 0.0, Rect2(0.0, 0.35, 1.0, 0.45)],
	["singing_stones", Vector2(7, 6), "e_high", 0.0, Rect2(0.2, 0.25, 0.6, 0.6)],
	["mirror_walk", Vector2(10, 4), "e_high", 0.0, Rect2(0.0, 0.3, 1.0, 0.5)],
	["spring", Vector2(6, 6), "e_high", 0.0, Rect2(0.25, 0.25, 0.5, 0.5)],
	["scales", Vector2(7, 7), "e_high", 0.0, Rect2(0.25, 0.25, 0.5, 0.6)],
	["pool_halves", Vector2(8, 7), "act3", 0.0, Rect2(0.15, 0.2, 0.7, 0.8)],
	["bridge", Vector2(4, 9), "act3", 0.0, Rect2(0.3, 0.1, 0.4, 0.9)],
	["gate_four", Vector2(9, 7), "act3", 0.0, Rect2(0.25, 0.25, 0.5, 0.75)],
	["shrine", Vector2(8, 8), "act3", 0.0, Rect2(0.25, 0.25, 0.5, 0.75)],
]
const ORIGIN := Vector3(120.0, 0.0, 120.0)
var game: Node
var shots := ""
var only: PackedStringArray = []
var zoom := 0.0
var i := -1
var t := 0.0
var built := false
var _report := []
var _begun := false

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		if a.begins_with("--only="): only = a.get_slice("=", 1).split(",")
		if a.begins_with("--zoom="): zoom = float(a.get_slice("=", 1))
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _next() -> void:
	i += 1; t = 0.0; built = false
	while i < SPACES.size() and only.size() > 0 and not only.has(SPACES[i][0]): i += 1

func _process(dt: float) -> void:
	t += dt
	if i == -1:
		if t > 2.0 and not _begun:
			_begun = true
			game.cmd("begin")
			if OS.get_cmdline_user_args().has("--low"): game.set_quality("low")
		if _begun and t > 3.0 and t < 3.5: game.cmd("skip")         # (the intro cards / prologue: past them)
		if _begun and t > 5.0 and t < 5.5: game.cmd("skip")
		if t > 7.0: _next()
		return
	if i >= SPACES.size():
		for r in _report: print(r)
		get_tree().quit(); return
	var s: Array = SPACES[i]
	if not built:
		built = true; t = 0.0
		_build(i, s)
		return
	if t > 3.2:
		var nm := "dress-%s" % s[0]
		if shots != "": get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, nm])
		print("shot ", nm)
		_next()

func _build(k: int, s: Array) -> void:
	var lv: Level = game.level
	var size: Vector2 = s[1]
	var c := ORIGIN + Vector3((k % 6) * 30.0, 0.0, (k / 6) * 30.0)
	var rect := Rect2(c.x - size.x * 0.5, c.z - size.y * 0.5, size.x, size.y)
	# a bare marble floor for the landmark, a margin round it, walkable
	var fl := MeshInstance3D.new()
	var bm := BoxMesh.new(); bm.size = Vector3(size.x + 3.0, 0.6, size.y + 3.0)
	fl.mesh = AmbientLife._tinted(bm, 0.0)
	fl.material_override = lv.marble_mat
	game.juice.add_child(fl)
	fl.global_position = c + Vector3(0, -0.3, 0)
	lv.walk(rect.grow(1.5), 0.0)
	var keep := []
	if s[4] != null:
		var f: Rect2 = s[4]
		keep.append(Rect2(rect.position + f.position * rect.size, f.size * rect.size))
	var d: Dress
	if s[0] == "prologue":
		d = Dress.prologue_set(lv, game.juice, c + Vector3(0, 0, 3.0), c + Vector3(1.5, 0, -11.0), 9.0)
	else:
		d = Dress.build(lv, game.juice, s[0], rect, 0.0, keep)
	for b in d.beacons: b.ignite() if b != d.beacons[1] else b.set_lit(true)
	game.world.set_mood(s[2], 0.0)
	game.world.set_darkness(s[3])
	var at := Vector3(rect.position.x + rect.size.x * 0.4, 0.0, rect.position.y + rect.size.y * 0.62)
	if s[0] == "prologue": at = c + Vector3(-0.5, 0, 3.4)
	game.cmd("tp:%f:%f" % [at.x, at.z])
	if zoom > 0.0: game.cmd("zoom:%f" % zoom)
	_report.append("%s: skipped %s" % [s[0], str(d.skipped)])
