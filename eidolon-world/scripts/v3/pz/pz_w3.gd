extends Puzzle
## W.3 "The Hall of Glass" (CH1_V3 §2, ★★★): the great glass on the north wall shows this hall as it WAS. Three of his
## things stand where they were left; the glass remembers them elsewhere (pale doubles in HER world, only the glass
## shows them). Push each back along its rail (tap = one slot, away from you) until its real image and its memory
## meet in the glass: the double image converges and fuses, with a chime.
##   Teach   the bust: it already matches (its two images are one, a soft glow round it)
##   Test    the drum: two slots west
##   Twist   the brazier: the glass remembers it LIT; two slots east, and when it fuses it catches
## All three: the glass cracks at the corner and she pushes the Shard through to you (take it). A rope by the door
## sets everything back. Nothing jams (rails only); no fail.

const Y := 1.0
const GZ := -26.73                       # the glass (World3: the N wall + GLASS_OFF)
## thing -> [rail z, slot xs, start slot, remembered slot]
const THINGS := {
	"bust": [-25.7, [-29.6], 0, 0],
	"drum": [-25.35, [-27.8, -26.8, -25.8, -24.8], 3, 1],
	"brazier": [-24.15, [-30.4, -29.4, -28.4, -27.4], 0, 2],
}
const SHARD := Vector3(-27.0, Y + 0.05, -26.35)
const ROPE := Vector3(-22.75, Y, -14.45)
var nodes := {}                  # thing -> Node3D (real: both worlds)
var ghosts := {}                 # thing -> Node3D (her world)
var obs := {}                    # thing -> Level.Obstacle
var slots := {}                  # thing -> slot index
var fused := {}                  # thing -> bool
var glows := {}                  # thing -> halo material
var shard: Node3D
var brazier_flame: Flame
var ghost_flame: Flame
var _auto: Array = []
var _auto_t := 0.0

func build() -> void:
	test_s = 60.0
	gate("W3", "W4")
	var lv := game.level
	for k in THINGS:
		var t: Array = THINGS[k]
		var n := _thing(k)
		nodes[k] = n
		obs[k] = lv.ob_rect(Rect2(), "w3_" + k)
		if k != "bust":
			lv.add_interact("w3_" + k, n.position, "push", func() -> void: push(k), 1.2, func() -> bool: return not done)
	# the rope by the door (it resets the hall)
	var m := MB.new()
	m.cyl(ROPE + Vector3(0, 0.7, 0), 0.06, 0.08, 1.4, Color(0.5, 0.9, 0.0), 8)
	Kit3.marble(game, m.commit(), self).name = "W3_RopePost"
	lv.ob_circle(Vector2(ROPE.x, ROPE.z), 0.14)
	lv.add_interact("w3_rope", ROPE + Vector3(-0.6, 0, 0.0), "reset", reset_hall, 1.0, func() -> bool: return not done and _moved())

## a thing as a node (its own mesh), placed later on its rail
func _thing(k: String) -> Node3D:
	var n := Node3D.new()
	n.name = "W3_" + k.capitalize()
	add_child(n)
	match k:
		"bust":
			var m := MB.new()
			m.box(Vector3(0, 0.45, 0), Vector3(0.5, 0.9, 0.5), Color(0.5, 0.25, 0.0))
			Kit3.marble(game, m.commit(), n)
			Kit3.prop(n, "statue_veiled_bust", Vector3(0, 0.9, 0), 0.75, 0.0)
		"drum":
			var m := MB.new()
			m.cyl(Vector3(0, 0.36, 0), 0.34, 0.34, 0.72, Color(0.5, 0.5, 0.0), 16)
			m.cyl(Vector3(0, 0.73, 0), 0.36, 0.36, 0.04, Color(0.5, 0.25, 0.0), 16)
			Kit3.marble(game, m.commit(), n)
		"brazier":
			Kit3.prop(n, "brazier", Vector3.ZERO, 1.05, 0.0)
	return n

func post() -> void:
	for k in THINGS:
		var t: Array = THINGS[k]
		var g := _ghost(k)
		var xs: Array = t[1]
		g.position = Vector3(xs[t[3]], Y, t[0])
		ghosts[k] = g
		TwoWorld.set_her(g)
		glows[k] = Kit3.glow(self, g.position + Vector3(0, 0.6, 0), 1.6, Palette.HER, 0.0)
	brazier_flame = Kit3.flame(game, nodes["brazier"], Vector3(0, 1.08, 0), 0.26, false)
	ghost_flame = Kit3.flame(game, ghosts["brazier"], Vector3(0, 1.08, 0), 0.26, true)
	TwoWorld.set_her(ghost_flame)
	# the Shard, pushed through the crack (hidden until then)
	shard = Node3D.new()
	shard.name = "W3_Shard"
	add_child(shard)
	shard.position = SHARD
	var sm := StandardMaterial3D.new()
	sm.albedo_color = Color(0.85, 0.9, 0.95)
	sm.metallic = 0.9
	sm.roughness = 0.05
	sm.emission_enabled = true
	sm.emission = Color(0.85, 0.2, 0.25)
	sm.emission_energy_multiplier = 0.4
	var pm := PrismMesh.new()
	pm.size = Vector3(0.16, 0.34, 0.03)
	var mi := MeshInstance3D.new()
	mi.mesh = pm
	mi.material_override = sm
	mi.rotation = Vector3(0.0, 0.5, 0.25)
	mi.position.y = 0.17
	shard.add_child(mi)
	shard.visible = false
	game.level.add_interact("w3_shard", Vector3(SHARD.x, Y, SHARD.z + 0.7), "take", take_shard, 1.1,
		func() -> bool: return done and not state.get("shard", false))

## her memory of a thing: the same shape, pale, a little luminous
func _ghost(k: String) -> Node3D:
	var n := Node3D.new()
	n.name = "W3_Ghost_" + k
	add_child(n)
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.92, 0.9, 0.96, 0.55)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.emission_enabled = true
	m.emission = Color(0.7, 0.72, 0.8)
	m.emission_energy_multiplier = 0.25
	var mi := MeshInstance3D.new()
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	match k:
		"bust":
			var bm := BoxMesh.new()
			bm.size = Vector3(0.5, 0.9, 0.5)
			mi.mesh = bm
			mi.position.y = 0.45
		"drum":
			var cm := CylinderMesh.new()
			cm.top_radius = 0.36
			cm.bottom_radius = 0.36
			cm.height = 0.74
			mi.mesh = cm
			mi.position.y = 0.37
		"brazier":
			var cm := CylinderMesh.new()
			cm.top_radius = 0.34
			cm.bottom_radius = 0.16
			cm.height = 1.0
			mi.mesh = cm
			mi.position.y = 0.5
	n.add_child(mi)
	return n

# ------------------------------------------------------------------ pushing
func push(k: String) -> void:
	if done: return
	var n: Node3D = nodes[k]
	var dir := 1 if game.player.position.x < n.position.x else -1
	var xs: Array = THINGS[k][1]
	var to: int = slots[k] + dir
	game.call("perform", "push", n.position + Vector3(0, 0.5, 0), func() -> void:
		if to < 0 or to >= xs.size():
			if game.sfx: game.sfx.play("hollow", -16.0, 0.8)
			return
		_place(k, to, false))

func _place(k: String, i: int, snap: bool) -> void:
	slots[k] = i
	state[k] = i
	var t: Array = THINGS[k]
	var to := Vector3(t[1][i], Y, t[0])
	var n: Node3D = nodes[k]
	var r := 0.38 if k != "bust" else 0.3
	(obs[k] as Level.Obstacle).r = Rect2(to.x - r, to.z - r, r * 2.0, r * 2.0)
	for it in game.level.interacts:
		if it.id == "w3_" + k: it.pos = to
	var was: bool = fused.get(k, false)
	fused[k] = i == t[3]
	if snap:
		n.position = to
		_fuse_look(k, true)
		return
	progress()
	var tw := n.create_tween()
	tw.tween_property(n, "position", to, 0.7).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	if game.sfx: game.sfx.play("grind", -12.0, 1.0 if k == "drum" else 0.85)
	if game.juice: game.juice.grit(to + Vector3(0, 0.05, 0), 0.4)
	if fused[k] and not was:
		tw.tween_callback(func() -> void:
			_fuse_look(k, false)
			if game.sfx: game.sfx.play("chime", -14.0, 1.0 + 0.1 * float(THINGS.keys().find(k)))
			if game.juice: game.juice.glint(to + Vector3(0, 0.9, 0))
			_check())
	elif was and not fused[k]:
		_fuse_look(k, true)

## fused: her memory and the thing are one (the glow round it, the brazier catches)
func _fuse_look(k: String, snap: bool) -> void:
	var on: bool = fused.get(k, false)
	var g: ShaderMaterial = glows[k]
	if k == "brazier": brazier_flame.mat.set_shader_parameter("intensity", 0.9 if on else 0.0)
	if snap or not on:
		g.set_shader_parameter("intensity", 0.22 if on else 0.0)
		(ghosts[k] as Node3D).visible = not on or k == "brazier"
		return
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: g.set_shader_parameter("intensity", v), 0.0, 1.0, 0.25)
	tw.tween_method(func(v: float) -> void: g.set_shader_parameter("intensity", v), 1.0, 0.22, 1.2)
	tw.tween_callback(func() -> void: (ghosts[k] as Node3D).visible = k == "brazier")

func _check() -> void:
	for k in THINGS:
		if not fused.get(k, false): return
	solve()

func _moved() -> bool:
	for k in THINGS:
		if int(slots.get(k, 0)) != int(THINGS[k][2]): return true
	return false

func reset_hall() -> void:
	game.call("perform", "reach", ROPE + Vector3(0, 1.2, 0), func() -> void:
		if game.sfx: game.sfx.play("rattle", -14.0, 0.9)
		for k in THINGS: _place(k, THINGS[k][2], false))

# ------------------------------------------------------------------ the crack and the Shard
func on_solved() -> void:
	var r: Reflector = World3.mirrors.get("W3")
	if r and r.planar:
		var tw := create_tween()
		tw.tween_method(func(v: float) -> void: r.planar.mat.set_shader_parameter("crack", v), 0.0, 1.0, 0.6)
	if game.sfx:
		game.sfx.play("shard", -8.0, 1.0)
		game.sfx.play_later("glass_tink", 0.9, -14.0, 1.3)
	if game.juice:
		game.juice.shake(0.08)
		game.juice.glint(SHARD + Vector3(0, 0.6, 0))
	shard.visible = true
	shard.position = SHARD + Vector3(0, 0.0, -0.3)
	var t2 := shard.create_tween()
	t2.tween_interval(1.2)
	t2.tween_property(shard, "position", SHARD, 0.9).set_trans(Tween.TRANS_SINE)

func take_shard() -> void:
	game.call("perform", "pickup", SHARD, func() -> void:
		state["shard"] = true
		shard.visible = false
		game.call("give", "shard")
		game.ui.show_text("A shard of her glass.\nRaised, it shows her world.", game.player.position, 5.0))

func apply() -> void:
	super.apply()
	for k in THINGS: _place(k, THINGS[k][3] if done else int(state.get(k, THINGS[k][2])), true)
	shard.visible = done and not state.get("shard", false)
	shard.position = SHARD
	var r: Reflector = World3.mirrors.get("W3")
	if r and r.planar: r.planar.mat.set_shader_parameter("crack", 1.0 if done else 0.0)

## her knuckles on the glass over the thing that is furthest from her memory
func hint() -> void:
	for k in ["drum", "brazier"]:
		if not fused.get(k, false):
			if game.juice: game.juice.glint((ghosts[k] as Node3D).position + Vector3(0, 1.0, 0))
			break
	if game.sfx:
		game.sfx.play("glass_tink", -13.0, 1.0)
		game.sfx.play_later("glass_tink", 0.4, -13.0, 1.0)

## as a player would: push the drum twice from its east side, the brazier twice from its west side, take the Shard
func autosolve() -> void:
	_auto = [["walk", -23.9, -25.35], ["i"], ["walk", -24.9, -25.35], ["i"], ["walk", -26.0, -23.0], ["walk", -31.4, -23.2],
		["walk", -31.4, -24.15], ["i"], ["walk", -30.4, -24.15], ["i"], ["walk", -27.0, -23.5], ["done"], ["walk", SHARD.x, SHARD.z + 0.7], ["i"]]
	_auto_t = 0.0

func tick(dt: float) -> void:
	if _auto.is_empty(): return
	_auto_t += dt
	if game.auto_target != Vector3.INF or game.get("_acting") or _auto_t < 0.9: return
	var a: Array = _auto[0]
	match a[0]:
		"walk": game.cmd("walk:%f:%f" % [a[1], a[2]])
		"i": game.try_interact()
		"done": if not done: return
	_auto.pop_front()
	_auto_t = 0.0
