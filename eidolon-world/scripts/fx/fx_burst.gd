class_name FxBurst
extends MultiMeshInstance3D
## v1.1 (Agent A) soft GPU particles (shaders/fx_burst.gdshader): one node = one draw call, frees itself when done.
##   FxBurst.splash(parent, pos)              water splash: droplets thrown up, stretched as they fly, falling back
##   FxBurst.dust(parent, pos, size)          dust shaken from a door / lintel: soft lit puffs drifting down
##   FxBurst.sparks(parent, pos)              brazier sparks: hot, stretched, cooling as they fall
##   FxBurst.glints(parent, pos)              loop: twinkles round a pickup
##   FxBurst.embers(parent, pos)              loop: embers rising from a brazier, swaying, flickering out
##   FxBurst.mist(parent, pos, area)          loop: slow wisps of low mist
##   FxBurst.footstep(parent, pos, water_fx)  her step in shallow water: a ring (WaterFX) and a few drops
## Soft particles (depth fade), size and colour over life. Low tier (FxBurst.high = false, set by World.set_tier):
## a third of the particles and no depth fade. Loops are stopped with `stop()` (they finish their particles first).

static var high := true

const SHADER := preload("res://shaders/fx_burst.gdshader")
enum { SPLASH, DUST, SPARK, GLINT, EMBER, MIST }

var clock := 0.0
var duration := 2.0          # one-shots free themselves after this (life + the longest delay)
var looping := false
var _stopping := -1.0

static func _make(parent: Node, pos: Vector3, kind: int, count: int, params: Dictionary, loop := false, seed := 0) -> FxBurst:
	var b := FxBurst.new()
	var n := maxi(1, count if high else count / 3)
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(pos) + seed
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	mm.mesh = q
	mm.instance_count = n
	var delay_max: float = params.get("delay", 0.15)
	for i in n:
		mm.set_instance_transform(i, Transform3D.IDENTITY)
		var dly := rng.randf() if loop else rng.randf() * delay_max
		mm.set_instance_custom_data(i, Color(rng.randf(), rng.randf(), rng.randf(), dly))
	b.multimesh = mm
	var m := ShaderMaterial.new()
	m.shader = SHADER
	m.set_shader_parameter("kind", kind)
	m.set_shader_parameter("loop", 1.0 if loop else 0.0)
	m.set_shader_parameter("soft", float(params.get("soft", 0.25)) if high else 0.0)
	for k in params:
		if k in ["delay", "soft", "reach"]: continue
		m.set_shader_parameter(k, params[k])
	b.material_override = m
	b.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var reach: float = params.get("reach", 2.0)
	b.custom_aabb = AABB(Vector3(-reach, -reach, -reach), Vector3.ONE * reach * 2.0)
	b.looping = loop
	b.duration = float(params.get("life", 1.0)) * 1.25 * (1.0 + delay_max) + 0.2
	parent.add_child(b)
	b.global_position = pos
	return b

func stop() -> void:
	if looping and _stopping < 0.0: _stopping = 0.0

func _process(dt: float) -> void:
	clock += dt
	(material_override as ShaderMaterial).set_shader_parameter("clock", clock)
	if _stopping >= 0.0:
		_stopping += dt
		transparency = clampf(_stopping / 1.0, 0.0, 1.0)
		if _stopping > 1.0: queue_free()
	elif not looping and clock > duration:
		queue_free()

static func splash(parent: Node, pos: Vector3, strength := 1.0) -> FxBurst:
	return _make(parent, pos, SPLASH, int(26 * strength), {"life": 0.75, "speed": 2.1 * sqrt(strength), "spread": 0.55, "gravity": 9.8,
		"size0": 0.035, "size1": 0.02, "stretch": 0.035, "col0": Color(0.9, 0.95, 1.0, 0.85), "col1": Color(0.85, 0.9, 0.95, 0.2), "delay": 0.1, "soft": 0.05, "reach": 1.5})

static func dust(parent: Node, pos: Vector3, size := 1.0) -> FxBurst:
	return _make(parent, pos, DUST, int(18 * size), {"life": 2.6, "speed": 0.35, "spread": 1.0, "dir": Vector3(0, -1, 0), "gravity": 0.25, "drag": 1.2,
		"size0": 0.16 * size, "size1": 0.42 * size, "col0": Color(0.84, 0.82, 0.78, 0.6), "col1": Color(0.8, 0.79, 0.76, 0.0), "delay": 0.5, "soft": 0.35, "reach": 2.0 * size})

static func sparks(parent: Node, pos: Vector3) -> FxBurst:
	return _make(parent, pos, SPARK, 22, {"life": 0.9, "speed": 2.4, "spread": 0.45, "gravity": 3.0, "drag": 0.8,
		"size0": 0.022, "size1": 0.01, "stretch": 0.05, "col0": Color(1.0, 0.86, 0.6, 1.0), "col1": Color(0.85, 0.15, 0.1, 0.0), "delay": 0.2, "soft": 0.0, "reach": 1.6})

static func glints(parent: Node, pos: Vector3) -> FxBurst:
	return _make(parent, pos, GLINT, 6, {"life": 1.6, "size0": 0.12, "size1": 0.09, "col0": Color(1.0, 0.97, 0.92, 1.0), "col1": Color(1.0, 0.85, 0.8, 0.0), "soft": 0.0, "reach": 0.6}, true)

static func embers(parent: Node, pos: Vector3) -> FxBurst:
	return _make(parent, pos, EMBER, 10, {"life": 2.4, "size0": 0.022, "size1": 0.008, "col0": Color(1.0, 0.7, 0.4, 1.0), "col1": Color(0.9, 0.12, 0.08, 0.0), "soft": 0.0, "reach": 2.0}, true)

static func mist(parent: Node, pos: Vector3, area := 2.0) -> FxBurst:
	return _make(parent, pos, MIST, int(8 * area), {"life": 9.0, "speed": 0.1, "spread": 1.0, "dir": Vector3(1, 0, 0), "size0": 0.9 * area * 0.5, "size1": 1.6 * area * 0.5,
		"col0": Color(0.86, 0.87, 0.88, 0.32), "col1": Color(0.86, 0.87, 0.88, 0.32), "wind": Vector3(0.12, 0.0, -0.05), "soft": 0.6, "reach": area * 2.5}, true)

## her footstep in shallow water: a ripple ring on the surface (WaterFX, if given) and a few drops
static func footstep(parent: Node, pos: Vector3, water_fx: Object = null) -> FxBurst:
	if water_fx and water_fx.has_method("splash"): water_fx.call("splash", pos, 0.3, 2.5)
	return _make(parent, pos, SPLASH, 7, {"life": 0.45, "speed": 0.9, "spread": 0.7, "gravity": 9.8, "size0": 0.022, "size1": 0.014, "stretch": 0.03,
		"col0": Color(0.9, 0.95, 1.0, 0.7), "col1": Color(0.85, 0.9, 0.95, 0.0), "delay": 0.05, "soft": 0.03, "reach": 0.8})
