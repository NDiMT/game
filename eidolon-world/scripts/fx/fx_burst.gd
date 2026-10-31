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
## Soft particles (web-safe: faded by height above the ground under them, no depth texture), size and colour over life. Low tier (FxBurst.high = false, set by World.set_tier):
## a third of the particles and no depth fade. Loops are stopped with `stop()` (they finish their particles first).

static var high := true

const SHADER := preload("res://shaders/fx_burst.gdshader")
enum { SPLASH, DUST, SPARK, GLINT, EMBER, MIST }

var clock := 0.0
var duration := 2.0          # one-shots free themselves after this (life + the longest delay)
var looping := false
var _stopping := -1.0
var boost_t := 0.0           # (embers: the ignition swell, decaying)

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
	# (web-safe soft fade: by height above the ground under the burst; "ground" = its y, else `ground_drop` below pos)
	m.set_shader_parameter("ground_y", float(params.get("ground", pos.y - float(params.get("ground_drop", 0.0)))))
	for k in params:
		if k in ["delay", "soft", "reach", "ground", "ground_drop"]: continue
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
	if boost_t > 0.0:
		boost_t = maxf(boost_t - dt, 0.0)
		(material_override as ShaderMaterial).set_shader_parameter("boost", 1.6 * smoothstep(0.0, 2.2, boost_t))
	if _stopping >= 0.0:
		_stopping += dt
		transparency = clampf(_stopping / 1.0, 0.0, 1.0)
		if _stopping > 1.0: queue_free()
	elif not looping and clock > duration:
		queue_free()

## (v1.1c tuning, at the 7.5 m camera on a phone: about 52 css px per metre, so a particle needs 6-10 cm to read)
static func splash(parent: Node, pos: Vector3, strength := 1.0) -> FxBurst:
	return _make(parent, pos, SPLASH, int(40 * strength), {"life": 0.9, "speed": 2.8 * sqrt(strength), "spread": 0.5, "gravity": 9.8,
		"size0": 0.07, "size1": 0.045, "stretch": 0.05, "col0": Color(0.97, 0.99, 1.0, 1.0), "col1": Color(0.9, 0.94, 0.98, 0.35), "delay": 0.12, "soft": 0.04, "reach": 2.0})

## `ground`: the floor's y under the lintel (the dust thins out as it settles on it); NAN = pos.y - 2.5
static func dust(parent: Node, pos: Vector3, size := 1.0, ground := NAN) -> FxBurst:
	if is_nan(ground): ground = pos.y - 2.5
	return _make(parent, pos, DUST, int(26 * size), {"life": 2.8, "speed": 0.45, "spread": 1.0, "dir": Vector3(0, -1, 0), "gravity": 0.3, "drag": 1.1,
		"size0": 0.22 * size, "size1": 0.55 * size, "col0": Color(0.62, 0.6, 0.56, 0.62), "col1": Color(0.7, 0.68, 0.64, 0.0), "delay": 0.45, "soft": 0.3, "reach": 2.5 * size, "ground": ground})

## a lit brazier's ignition: a short hot burst (then FxBurst.embers carries on, calmer)
static func sparks(parent: Node, pos: Vector3) -> FxBurst:
	return _make(parent, pos, SPARK, 36, {"life": 1.0, "speed": 3.2, "spread": 0.5, "gravity": 3.0, "drag": 0.9,
		"size0": 0.05, "size1": 0.02, "stretch": 0.06, "col0": Color(1.0, 0.9, 0.66, 1.0), "col1": Color(0.9, 0.2, 0.1, 0.0), "delay": 0.25, "soft": 0.0, "reach": 2.2})

static func glints(parent: Node, pos: Vector3) -> FxBurst:
	return _make(parent, pos, GLINT, 6, {"life": 1.6, "size0": 0.18, "size1": 0.13, "col0": Color(1.0, 0.98, 0.94, 1.0), "col1": Color(1.0, 0.88, 0.84, 0.0), "soft": 0.0, "reach": 0.7}, true)

## embers off a lit flame; they swell for the first ~2 s after it is lit (`boost`), then settle
static func embers(parent: Node, pos: Vector3) -> FxBurst:
	var b := _make(parent, pos, EMBER, 16, {"life": 2.4, "size0": 0.045, "size1": 0.015, "col0": Color(1.0, 0.76, 0.45, 1.0), "col1": Color(0.95, 0.15, 0.08, 0.0), "soft": 0.0, "reach": 2.5}, true)
	b.boost_t = 2.2
	return b

## low drifting mist: broad soft wisps, a cool grey a little darker than the fog so they read against pale stone
static func mist(parent: Node, pos: Vector3, area := 2.0) -> FxBurst:
	return _make(parent, pos + Vector3(0, 0.25, 0), MIST, int(10 * area), {"life": 10.0, "speed": 0.12, "spread": 1.0, "dir": Vector3(1, 0, 0), "size0": 0.75 * area, "size1": 1.15 * area,
		"col0": Color(0.66, 0.69, 0.72, 0.55), "col1": Color(0.66, 0.69, 0.72, 0.55), "wind": Vector3(0.14, 0.0, -0.06), "soft": 0.3, "ground_drop": 0.55, "reach": area * 3.0}, true)

## her footstep in shallow water: a ripple ring on the surface (WaterFX, if given) and a few drops
static func footstep(parent: Node, pos: Vector3, water_fx: Object = null) -> FxBurst:
	if water_fx and water_fx.has_method("splash"): water_fx.call("splash", pos, 0.45, 2.5)
	return _make(parent, pos, SPLASH, 10, {"life": 0.5, "speed": 1.2, "spread": 0.7, "gravity": 9.8, "size0": 0.05, "size1": 0.032, "stretch": 0.04,
		"col0": Color(0.97, 0.99, 1.0, 0.95), "col1": Color(0.9, 0.94, 0.98, 0.0), "delay": 0.05, "soft": 0.02, "reach": 1.0})
