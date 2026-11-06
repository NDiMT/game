class_name FogBank
extends Node3D
## v2.0 (Agent A) a FOG BANK on still water (Act 3, I.20: the Pool of Halves is fogged until the three Beacons burn).
## Three stacked sheets of rolling fog (depth from above), standing curtains round its edge (its silhouette), a slow
## crimson glow breathing deep in it; drifting wisps (FxBurst.mist). Web-safe; Low: one sheet, no curtains.
##   var fog := FogBank.make(parent, Rect2(x0, z0, w, d), water_y)     # (it is there at once)
##   fog.lift(4.5)        the Beacons burn: a ragged clearing sweeps across from the east (her side), the sheets thin and
##                        rise, the curtains sink, a sheen of light runs over the uncovered water; it frees itself
##   fog.set_on(false)    gone at once (a save loaded with the pool open)
static var high := true
const SH := preload("res://shaders/fog_bank.gdshader")
var rect := Rect2()
var water_y := 0.0
var _mats: Array[ShaderMaterial] = []
var _mists: Array = []
var _front := 0.0
var _k := 1.0

static func make(parent: Node, r: Rect2, wy: float) -> FogBank:
	var f := FogBank.new()
	f.name = "FogBank"
	f.rect = r
	f.water_y = wy
	parent.add_child(f)
	f._build()
	return f

func _mat(part: float, layer: float, seed: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = SH
	m.set_shader_parameter("part", part)
	m.set_shader_parameter("layer", layer)
	m.set_shader_parameter("seed", seed)
	m.set_shader_parameter("rect", Vector4(rect.position.x, rect.position.y, rect.end.x, rect.end.y))
	m.render_priority = int(layer * 3.0) + (5 if part > 0.5 else 0)
	_mats.append(m)
	return m

func _build() -> void:
	var grow := 1.6
	var big := rect.grow(grow)
	var sheets := [[0.1, 0.0], [0.6, 0.5], [1.15, 1.0]] if high else [[0.3, 0.1]]
	for s in sheets:
		var mi := MeshInstance3D.new()
		var pm := PlaneMesh.new()
		pm.size = big.size
		mi.mesh = pm
		mi.material_override = _mat(0.0, s[1], randf() * 10.0)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		mi.global_position = Vector3(big.get_center().x, water_y + float(s[0]), big.get_center().y)
	if high:
		# curtains round the edge: every ~2.2 m along it, a camera-facing quad 2.6 m wide
		# (low billows standing IN the water, 0.6 m inside its edges: they give the bank its height without veiling
		# her where she walks round it)
		var pts := []
		var inner := rect.grow(-0.6)
		var nx := maxi(2, int(inner.size.x / 1.8))
		for i in nx + 1:
			var x := inner.position.x + inner.size.x * float(i) / nx
			pts.append(Vector3(x, 0, inner.position.y)); pts.append(Vector3(x, 0, inner.end.y))
			pts.append(Vector3(x + 0.9, 0, inner.get_center().y))
		var q := QuadMesh.new()
		q.size = Vector2.ONE
		for p in pts:
			var mi := MeshInstance3D.new()
			mi.mesh = q
			var m := _mat(1.0, 0.5, randf() * 10.0)
			m.set_shader_parameter("height", randf_range(1.0, 1.5))
			mi.material_override = m
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.extra_cull_margin = 3.0
			add_child(mi)
			mi.global_position = Vector3(p.x, water_y, p.z)
			mi.scale = Vector3(2.2, 1.0, 1.0)
	# drifting wisps over it
	var n := 3 if high else 1
	for i in n:
		var x := rect.position.x + rect.size.x * (float(i) + 0.5) / n
		_mists.append(FxBurst.mist(self, Vector3(x, water_y + 0.1, rect.get_center().y), clampf(rect.size.y * 0.6, 1.5, 3.0)))

func _apply() -> void:
	for m in _mats:
		m.set_shader_parameter("k", _k)
		m.set_shader_parameter("front", _front)

func _set_front(v: float) -> void:
	_front = v
	_apply()

func _set_k(v: float) -> void:
	_k = v
	_apply()

func set_on(on: bool) -> void:
	_k = 1.0 if on else 0.0
	_front = 0.0 if on else 1.0
	_apply()
	visible = on

## the Beacons burn: it rolls back from the east (her side) over `seconds`; a sheen runs over the uncovered water
func lift(seconds := 4.5) -> void:
	for m in _mists: if is_instance_valid(m): (m as FxBurst).stop()
	var tw := create_tween()
	tw.tween_method(_set_front, 0.0, 1.0, seconds).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.parallel().tween_method(_set_k, 1.0, 0.0, seconds * 1.1).set_delay(seconds * 0.25)
	tw.tween_callback(queue_free)
	# the sheen: a long band of light running west over the water just behind the clearing
	var band := OmenFx.decal(get_parent(), Vector3(rect.end.x, water_y + OmenFx.LIFT, rect.get_center().y), OmenFx.CAUSTIC, Vector2(2.4, rect.size.y * 0.9))
	var bm := band.material_override as ShaderMaterial
	bm.set_shader_parameter("tint", Color(1.0, 0.97, 0.92))
	var bt := band.create_tween()
	bt.tween_property(band, "global_position:x", rect.position.x, seconds * 1.05).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	bt.parallel().tween_method(func(v: float) -> void: bm.set_shader_parameter("k", v), 0.0, 1.0, seconds * 0.3)
	bt.tween_method(func(v: float) -> void: bm.set_shader_parameter("k", v), 1.0, 0.0, 1.0)
	bt.tween_callback(band.queue_free)
