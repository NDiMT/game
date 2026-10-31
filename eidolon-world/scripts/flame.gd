class_name Flame
extends Node3D
## v0.8.1: a flame that is also a light. Two camera-facing fire layers (flame.gdshader: body and hot core),
## rising embers, and an OmniLight3D that flickers (noise-driven energy and a tiny jitter), lighting the
## stone round it. Driven by `mat` ("intensity" 0..1, "gutter" 0..1), so a puzzle fades / gutters it the
## way it always did. Only the nearest few lit flames carry a live light (Flame.cull), shadows only on
## High and only for a `key` flame; on Low no embers and a shorter light.
static var all: Array[Flame] = []
static var high := true
const MAX_LIGHTS := 4
const LIGHT_DIST := 13.0

var mat: ShaderMaterial
var core: ShaderMaterial
var light: OmniLight3D
var embers: CPUParticles3D
var key := false
var bounce := true          # (v1.0: a hand lamp's tiny flame casts no crimson bounce on the stone)
var energy := 1.6
var range_m := 4.0
var _t := 0.0
var _seed := 0.0
var _allowed := false
var _fade := 0.0
var _ly := 0.27

func _init(style := 0.0, size := 0.6, light_col := Color(1.0, 0.68, 0.38), noise: Texture2D = null) -> void:
	_seed = randf() * 10.0
	var sh := preload("res://shaders/flame.gdshader")
	mat = ShaderMaterial.new()
	mat.shader = sh
	core = ShaderMaterial.new()
	core.shader = sh
	for m in [mat, core]:
		m.set_shader_parameter("noise_tex", noise)
		m.set_shader_parameter("style", style)
		m.set_shader_parameter("seed", _seed)
	core.set_shader_parameter("core_layer", 1.0)
	core.set_shader_parameter("seed", _seed + 3.7)
	mat.set_shader_parameter("intensity", 0.0)
	mat.set_shader_parameter("gutter", 0.0)
	for k in 2:
		var q := QuadMesh.new()
		q.size = Vector2(size * 0.7, size * 1.25)
		q.center_offset = Vector3(0, size * 0.625, 0)
		var mi := MeshInstance3D.new()
		mi.mesh = q
		mi.material_override = mat if k == 0 else core
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.extra_cull_margin = 1.0
		mi.sorting_offset = 0.01 * k
		add_child(mi)
	embers = CPUParticles3D.new()
	var em := QuadMesh.new()
	em.size = Vector2(0.025, 0.025)
	embers.mesh = em
	var emm := ShaderMaterial.new()
	emm.shader = preload("res://shaders/ember.gdshader")
	emm.set_shader_parameter("style", style)
	embers.material_override = emm
	embers.amount = 10
	embers.lifetime = 1.6
	embers.direction = Vector3.UP
	embers.spread = 14.0
	embers.initial_velocity_min = 0.25
	embers.initial_velocity_max = 0.6
	embers.gravity = Vector3(0, 0.15, 0)
	embers.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	embers.emission_sphere_radius = size * 0.12
	embers.position = Vector3(0, size * 0.3, 0)
	embers.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	embers.emitting = false
	var ramp := Gradient.new()
	ramp.set_color(0, Color(1, 1, 1, 1))
	ramp.set_color(1, Color(1, 1, 1, 0))
	embers.color_ramp = ramp
	add_child(embers)
	light = OmniLight3D.new()
	light.light_color = light_col
	light.omni_range = range_m
	light.omni_attenuation = 1.3
	light.light_energy = 0.0
	light.shadow_enabled = false
	_ly = size * 0.45
	light.position = Vector3(0, _ly, 0)
	light.visible = false
	light.omni_shadow_mode = OmniLight3D.SHADOW_DUAL_PARABOLOID      # (QA P1-15: 2 shadow passes, not 6)
	add_child(light)
	all.append(self)

func _exit_tree() -> void:
	all.erase(self)

func level() -> float:
	var f: float = mat.get_shader_parameter("intensity")
	var g = mat.get_shader_parameter("gutter")
	return f * (1.0 - (float(g) if g != null else 0.0))

func _process(dt: float) -> void:
	_t += dt
	var k := level()
	core.set_shader_parameter("intensity", mat.get_shader_parameter("intensity"))
	core.set_shader_parameter("gutter", mat.get_shader_parameter("gutter"))
	embers.emitting = high and k > 0.4 and is_visible_in_tree()
	# (v0.8.3) the light fades in and out when the budget gives or takes it: it never pops
	_fade = move_toward(_fade, 1.0 if (k > 0.01 and _allowed and is_visible_in_tree()) else 0.0, dt * 3.0)
	light.visible = _fade > 0.005
	if light.visible:
		# noise-driven flicker: two incommensurate sines and a little random breath
		var f := 0.86 + 0.08 * sin(_t * 9.1 + _seed) * sin(_t * 3.7) + 0.06 * sin(_t * 17.3 + _seed * 2.0)
		light.light_energy = k * energy * f * _fade
		light.omni_range = range_m * (1.0 if high else 0.75)
		light.position = Vector3(sin(_t * 7.3 + _seed) * 0.012, _ly + sin(_t * 5.1) * 0.01, cos(_t * 6.1 + _seed) * 0.012)
		light.shadow_enabled = key and shadows and self == _shadow_f       # (QA P1-15: one shadowed flame at a time)

## v0.8.3: ONE light budget for every dynamic light (the flames and the aqua lights together): the nearest
## few within reach are live (`budget`: 3 on High, 2 on Auto, 1 on Low), chosen 4 times a second with a
## margin for the ones already on (no flip-flopping between two at the same distance); key flames first.
static var budget := 2
static var shadows := false
static var _shadow_f: Flame = null      # the one live key flame that casts (the nearest)
static var _cull_t := 0.0
static var _cand: Array = []
static func cull(p: Vector3, dt := 0.016) -> void:
	_cull_t -= dt
	if _cull_t > 0.0: return
	_cull_t = 0.25
	_cand.clear()
	for f in all:
		if f.level() > 0.01 and f.is_visible_in_tree():
			var d := f.global_position.distance_to(p) - (2.0 if f.key else 0.0)
			if d < LIGHT_DIST: _cand.append([d - (1.5 if f._allowed else 0.0), f])
		f._allowed = false
	for a in AquaLight.all:
		if a.level() > 0.02 and a.is_visible_in_tree():
			var d: float = a.global_position.distance_to(p) + 1.0
			if d < AquaLight.LIGHT_DIST: _cand.append([d - (1.5 if a._allowed else 0.0), a])
		a._allowed = false
	_cand.sort_custom(_by_first)
	for i in mini(_cand.size(), budget): _cand[i][1]._allowed = true
	_shadow_f = null
	for i in mini(_cand.size(), budget):
		if _cand[i][1] is Flame and (_cand[i][1] as Flame).key:
			_shadow_f = _cand[i][1]
			break

static func _by_first(x: Array, y: Array) -> bool:
	return x[0] < y[0]

## (v1.0 A) the 8 nearest lit flames as (x, y, z, strength): fed to the marble for a crimson bounce
static func bounce_list(p: Vector3) -> PackedVector4Array:
	var c: Array = []
	for f in all:
		var k := f.level()
		if k > 0.01 and f.bounce and f.is_visible_in_tree():
			c.append([f.global_position.distance_squared_to(p), f, k])
	c.sort_custom(_by_first)
	var out := PackedVector4Array()
	for i in 8:
		if i < c.size():
			var f: Flame = c[i][1]
			var fl := 0.86 + 0.08 * sin(f._t * 9.1 + f._seed) * sin(f._t * 3.7)
			var q := f.global_position + Vector3(0, f._ly, 0)
			out.append(Vector4(q.x, q.y, q.z, float(c[i][2]) * fl))
		else:
			out.append(Vector4(0, -999, 0, 0))
	return out
