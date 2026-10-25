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
var energy := 1.6
var range_m := 4.0
var _t := 0.0
var _seed := 0.0
var _allowed := true
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
	var on := k > 0.01 and _allowed and is_visible_in_tree()
	light.visible = on
	if on:
		# noise-driven flicker: two incommensurate sines and a little random breath
		var f := 0.86 + 0.08 * sin(_t * 9.1 + _seed) * sin(_t * 3.7) + 0.06 * sin(_t * 17.3 + _seed * 2.0)
		light.light_energy = k * energy * f
		light.omni_range = range_m * (1.0 if high else 0.75)
		light.position = Vector3(sin(_t * 7.3 + _seed) * 0.012, _ly + sin(_t * 5.1) * 0.01, cos(_t * 6.1 + _seed) * 0.012)
		light.shadow_enabled = key and high

## only the nearest lit flames carry a live light
static func cull(p: Vector3) -> void:
	var lit: Array = []
	for f in all:
		if f.level() > 0.01 and f.is_visible_in_tree():
			var d := f.global_position.distance_to(p)
			if d < LIGHT_DIST: lit.append([d, f])
			else: f._allowed = false
		else:
			f._allowed = true
	lit.sort_custom(func(a: Array, b: Array) -> bool: return a[0] < b[0])
	for i in lit.size(): (lit[i][1] as Flame)._allowed = i < MAX_LIGHTS
