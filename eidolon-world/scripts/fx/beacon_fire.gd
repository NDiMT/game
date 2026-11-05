class_name BeaconFire
extends Node3D
## v2.0 (Agent A) a WING BEACON (EIDOLON_SCRIPT §6: three wing fires, seen from the Atrium). Put one on each beacon's
## bowl (position = the top of the bowl, where the fire stands):
##   var b := BeaconFire.new(); bowl.add_child(b); b.position = Vector3(0, 0.9, 0)   # (unlit until told)
##   b.ignite()          the big readable ignition: the flame leaps to ~2.4x and settles over ~2.5 s, two spark bursts,
##                       embers swelling, and a far glow (a fog-free crimson halo, seen through the Atrium's fog from
##                       across the hall); then the lit loop
##   b.set_lit(true)     lit at once, no ignition (loading a save); set_lit(false) puts it out
##   b.lit               (read) whether it burns
## The fire IS the game's Flame (scripts/flame.gd: the same crimson fire as the braziers, its light in the shared light
## budget, its crimson bounce on the marble, its embers), at beacon size, plus the far glow (beacon_flame.gdshader).
## Low tier (BeaconFire.high = false, set by World.set_tier; Flame.high does the rest): no extra embers loop, no
## second spark burst; the glow stays (it is what reads from afar).

static var high := true
const SH := preload("res://shaders/beacon_flame.gdshader")
static var _noise: Texture2D

@export var height := 1.3          # the flame at rest (m)
@export var glow_size := 3.2       # the far glow's radius (m)
@export var noise: Texture2D       # level.noise_tex if you have it (else a small one is made once)
var lit := false
var flame: Flame
var _glow: MeshInstance3D
var _gm: ShaderMaterial
var _embers: FxBurst
var _flare := 0.0
var _tw: Tween

static func _get_noise() -> Texture2D:
	if _noise == null:
		var n := NoiseTexture2D.new()
		var fn := FastNoiseLite.new()
		fn.frequency = 0.03
		n.noise = fn
		n.width = 128; n.height = 128
		n.seamless = true
		_noise = n
	return _noise

func _ready() -> void:
	flame = Flame.new(0.0, height, Palette.FIRE_LIGHT, noise if noise else _get_noise())
	flame.key = false
	flame.energy = 2.2
	flame.range_m = 6.0
	add_child(flame)
	_glow = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	_glow.mesh = q
	_gm = ShaderMaterial.new()
	_gm.shader = SH
	_gm.set_shader_parameter("part", 1.0)
	_gm.set_shader_parameter("height", height)
	_gm.set_shader_parameter("glow_size", glow_size)
	_gm.set_shader_parameter("seed", randf())
	_gm.set_shader_parameter("k", 0.0)
	_gm.render_priority = -1                     # (under the flame)
	_glow.material_override = _gm
	_glow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_glow.custom_aabb = AABB(Vector3(-glow_size * 1.5, -glow_size, -glow_size * 1.5), Vector3(glow_size * 3.0, glow_size * 3.0, glow_size * 3.0))
	add_child(_glow)
	_apply(1.0 if lit else 0.0)

func _apply(k: float) -> void:
	if flame == null: return
	flame.mat.set_shader_parameter("intensity", k)
	flame.scale = Vector3.ONE * (1.0 + _flare * 1.4)
	_gm.set_shader_parameter("k", k)
	_gm.set_shader_parameter("flare", _flare)
	_glow.visible = k > 0.001
	flame.energy = 2.2 * (1.0 + _flare * 1.2)

func _ensure_embers() -> void:
	if not high or is_instance_valid(_embers): return
	_embers = FxBurst.embers(self, global_position + Vector3(0, height * 0.5, 0))

func ignite() -> void:
	if not is_inside_tree(): return
	lit = true
	FxBurst.sparks(self, global_position + Vector3(0, 0.15, 0))
	if high: FxBurst.sparks(self, global_position + Vector3(0, height * 0.8, 0))
	_ensure_embers()
	if is_instance_valid(_embers): _embers.boost_t = 2.6
	# the leap: up in a breath (the fire catching), held, then settling over ~2 s into the lit loop
	if _tw: _tw.kill()
	_tw = create_tween()
	_tw.tween_method(_leap, 0.0, 1.0, 0.22).set_ease(Tween.EASE_OUT)
	_tw.tween_interval(0.35)
	_tw.tween_method(_settle, 1.0, 0.0, 2.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

func _leap(v: float) -> void:
	_flare = v
	_apply(minf(v * 3.0, 1.0))

func _settle(v: float) -> void:
	_flare = v
	_apply(1.0)

func set_lit(on: bool) -> void:
	lit = on
	_flare = 0.0
	if _tw: _tw.kill()
	if on: _ensure_embers()
	else:
		if is_instance_valid(_embers): _embers.stop()
		_embers = null
	_apply(1.0 if on else 0.0)
