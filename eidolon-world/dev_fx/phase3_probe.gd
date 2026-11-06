extends Node
## (Agent A, dev) phase 3 in place (v2 world): the wing spaces, the W.4 star through the Shard, N.1's water, the three
## Beacons igniting, the Hall's Shard passing out of the great mirror. Real camera, real game.
##   EIDOLON_V2=1 xvfb-run godot --path . --rendering-driver opengl3 --resolution 780x1688 res://dev_fx/phase3_probe.tscn -- --shots=/abs [--only=a,b] [--tag=x]
## [name, space id or "", tp world xz (or null: the space's walkable centre), what, [shot times after it]]
const STEPS := [
	["W3", "W3", null, "", [0.5]],
	["W5", "W5", null, "", [0.5]],
	["N2", "N2", null, "", [0.5]],
	["N7", "N7", null, "", [0.5]],
	["E2", "E2", null, "", [0.5]],
	["E5", "E5", null, "", [0.5]],
	["E1", "E1", null, "", [0.5]],
	["N1", "N1", null, "", [0.5]],
	["star", "W4", null, "star", [1.5]],
	["shard", "W3", null, "shard", [0.4, 0.9, 3.0]],
	["beacon-W", "WB", null, "beacon:W", [0.3, 1.0, 4.0]],
	["beacon-N", "NB", null, "beacon:N", [0.3, 1.0, 4.0]],
	["beacon-E", "EB", null, "beacon:E", [0.3, 1.0, 4.0]],
]
var game: Node
var shots := ""
var tag := "now"
var only: PackedStringArray = []
var i := -1
var t := 0.0
var fired := false
var k := 0
var _begun := false

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shots="): shots = a.get_slice("=", 1)
		if a.begins_with("--only="): only = a.get_slice("=", 1).split(",")
		if a.begins_with("--tag="): tag = a.get_slice("=", 1)
	Map2.labels_on = false
	Game.autotest = true
	game = load("res://scenes/main.tscn").instantiate()
	add_child(game)

func _process(dt: float) -> void:
	t += dt
	if i == -1:
		if t > 2.0 and not _begun:
			_begun = true
			game.cmd("begin")
		if _begun and t > 3.0 and t < 3.5: game.cmd("skip")
		if _begun and t > 5.0 and t < 5.5: game.cmd("skip")
		if t > 7.0:
			if tag != "before": WaterLook.flooded_n1(game.level)      # (until W wires it: one line after Map2.water)
			_next()
		return
	if i >= STEPS.size():
		get_tree().quit(); return
	var s: Array = STEPS[i]
	if t > 3.0 and not fired:
		fired = true; t = 0.0; k = 0
		_fire(s[3])
		return
	if fired and k < (s[4] as Array).size() and t > float(s[4][k]):
		var nm := "p3-%s-%s-%d" % [tag, s[0], k]
		if shots != "": get_viewport().get_texture().get_image().save_png("%s/%s.png" % [shots, nm])
		print("shot ", nm)
		k += 1
		if k >= (s[4] as Array).size(): _next()

func _next() -> void:
	i += 1; t = 0.0; fired = false
	while i < STEPS.size() and only.size() > 0 and not only.has(str(STEPS[i][0])): i += 1
	if i < STEPS.size():
		var s: Array = STEPS[i]
		var p: Vector2 = s[2] if s[2] != null else _stand(s[1])
		game.cmd("tp:%f:%f" % [p.x, p.y])

func _stand(id: String) -> Vector2:
	var lv: Level = game.level
	var r := Map2.space_rect(id)
	var c := r.get_center()
	if lv.on_ground(c) and not lv.blocked(c, 0.2): return c
	var best := c
	var bd := INF
	for gx in 21:
		for gz in 21:
			var q := r.position + r.size * Vector2(gx / 20.0, gz / 20.0)
			if lv.on_ground(q) and not lv.blocked(q, 0.2) and q.distance_to(c) < bd:
				bd = q.distance_to(c); best = q
	return best

func _fire(what: String) -> void:
	var ch: Node = game.chapter
	match what:
		"star":
			ch.state["shard"] = true
			game.cmd("tp:%f:%f" % [Chapter.STAR.x + 0.4, Chapter.STAR.z + 0.6])
			game.cmd("lens:1")
			if tag != "before" and ch.get("star_mat"): (ch.star_mat as ShaderMaterial).set_shader_parameter("kind", 3.0)   # (A's carved star)
		"shard":
			game.cmd("lens:0")
			var mp := Map2.GW + Vector3(-1.9, 0.0, -18.2)
			game.cmd("tp:%f:%f" % [mp.x, mp.z])
			var sh: Node3D = (load("res://assets/models/items/item_shard.glb") as PackedScene).instantiate()
			sh.scale = Vector3.ONE * 2.5
			ch.add_child(sh)
			var at := Map2.GW + (Vector3(0.6, 2.5, -20.46) if tag != "before" else Vector3(-1.9, 2.0, -20.46))   # (A: a spot no column hides)
			sh.global_position = at + Vector3(0, -0.4, 0.5)
			PassThrough.mirror(ch, at, Vector3.BACK, sh, 1.6, true)
		_:
			game.cmd("lens:0")
			if what.begins_with("beacon:"):
				var key := what.get_slice(":", 1)
				var hub: Node = game.get("hub")
				if hub == null: hub = ch.get("hub")
				var fires: Dictionary = hub.get("beacon_fires") if hub else {}
				for kk in fires:
					if str(kk).to_upper().begins_with(key):
						var bf: BeaconFire = fires[kk]
						bf.set_lit(false)
						bf.ignite()
						print("ignite ", kk, " at ", bf.global_position)
