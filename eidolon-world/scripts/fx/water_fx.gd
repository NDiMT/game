class_name WaterFX
extends Node
## v1.0 (Agent A, rendering helper): water events for the pool shaders (water.gdshader, water_over.gdshader,
## both include water_fx.gdshaderinc) and wet stone for marble instances. One node per body of water.
##
##   var fx := WaterFX.new()
##   fx.mats = [water_mat, water_over_mat]          # every material that draws this water
##   add_child(fx)
##   fx.splash(Vector3(x, y, z), 1.0)                  # a drop / a step / something falling in
##   fx.rise(Rect2(x0, z0, w, d), 2.4)                 # a body breaking the surface (a slab rising): foam
##                                                     #   collar, sheeting, rings off its edges
##   fx.wet_dry(slab_mesh_instance, 3.0, water_y)      # a risen stone: wet, sheeting, dries in patches
##
## Up to 8 splashes and 8 rising bodies at once (the oldest is replaced). It pushes the uniforms only while
## something is alive (and once more to clear them), so it costs nothing at rest.

const MAX := 8
var mats: Array = []                    # ShaderMaterials that include water_fx.gdshaderinc
## (v1.0 Low tier, set by World.set_tier) only the 3 newest events are drawn (the shader loop stops at 3)
static var high := true
var _q_sent := -1
var _ev: Array = []                     # [Vector2 xz, t0, strength, life]
var _box: Array = []                    # [Rect2 xz, t0, duration, strength]
var _dirty := false
var _clock := 0.0

func splash(pos: Vector3, strength := 1.0, life := 5.0) -> void:
	_ev.append([Vector2(pos.x, pos.z), _clock, strength, life])
	while _ev.size() > MAX: _ev.pop_front()
	_dirty = true

func rise(rect_xz: Rect2, duration := 2.4, strength := 1.0) -> void:
	_box.append([rect_xz, _clock, duration, strength])
	while _box.size() > MAX: _box.pop_front()
	_dirty = true

## a stone that has just come out of the water: wet now, dry after `seconds` (patchy). `water_y` is the
## line it stood in (it stays wet longest below it). Works on any MeshInstance3D using the marble shader.
func wet_dry(gi: GeometryInstance3D, seconds := 3.0, water_y := -99.0) -> void:
	if gi == null: return
	gi.set_instance_shader_parameter("wet", 1.0)
	gi.set_instance_shader_parameter("wet_line", water_y)
	var tw := create_tween()
	tw.tween_interval(seconds * 0.15)
	tw.tween_method(func(v: float) -> void: gi.set_instance_shader_parameter("wet", v), 1.0, 0.0, seconds * 0.85).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

func _process(dt: float) -> void:
	_clock += dt
	var n := 8 if high else 3
	if n != _q_sent:
		_q_sent = n
		for m in mats:
			if m is ShaderMaterial: (m as ShaderMaterial).set_shader_parameter("wfx_n", n)
	if not high:
		while _ev.size() > 3: _ev.pop_front()
		while _box.size() > 3: _box.pop_front()
	if _ev.is_empty() and _box.is_empty() and not _dirty: return
	for i in range(_ev.size() - 1, -1, -1):
		if _clock - _ev[i][1] > _ev[i][3]: _ev.remove_at(i)
	for i in range(_box.size() - 1, -1, -1):
		if _clock - _box[i][1] > _box[i][2] + 4.0: _box.remove_at(i)
	var ev := PackedVector4Array()
	var bx := PackedVector4Array()
	var bk := PackedVector4Array()
	for i in MAX:
		if i < _ev.size():
			var e: Array = _ev[i]
			ev.append(Vector4(e[0].x, e[0].y, _clock - e[1], e[2]))
		else:
			ev.append(Vector4(0, 0, -1, 0))
		if i < _box.size():
			var b: Array = _box[i]
			var r: Rect2 = b[0]
			bx.append(Vector4(r.position.x, r.position.y, r.end.x, r.end.y))
			bk.append(Vector4(_clock - b[1], b[2], b[3], 0))
		else:
			bx.append(Vector4(0, 0, 0, 0))
			bk.append(Vector4(-1, 1, 0, 0))
	for m in mats:
		var sm := m as ShaderMaterial
		if sm == null: continue
		sm.set_shader_parameter("ev", ev)
		sm.set_shader_parameter("ev_box", bx)
		sm.set_shader_parameter("ev_box_k", bk)
	_dirty = not (_ev.is_empty() and _box.is_empty())
