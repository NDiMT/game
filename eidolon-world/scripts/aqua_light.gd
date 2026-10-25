class_name AquaLight
extends Node3D
## v0.8.1: the aqua writing gives light. A small OmniLight3D (no shadows) on a key glowing element, and
## optionally a soft additive pool of aqua light on the stone below / before it (cheap: one quad, also
## the whole effect for small glyphs where a real light would be too many). Lights are CULLED like the
## flames: only the nearest few within LIGHT_DIST are live (High 3, Low 1); the pools always draw.
## `follow`: a ShaderMaterial and a parameter (e.g. a halo's "intensity", a rune's "lit") whose value
## scales the light, so it brightens and fades with the glow it belongs to.

static var all: Array = []
static var high := true
const LIGHT_DIST := 11.0
var light: OmniLight3D
var pool: MeshInstance3D
var pool_mat: ShaderMaterial
var energy := 0.35
var follow: ShaderMaterial
var follow_param := ""
var follow_scale := 1.0
var strength := 1.0
var _allowed := false
var _fade := 0.0

## light at `at` (world), range `range_m`; pool: a floor disc of `pool_size` metres at `pool_at` (INF: none)
func _init(range_m := 2.4, e := 0.35, pool_at := Vector3.INF, pool_size := 1.6) -> void:
	energy = e
	light = OmniLight3D.new()
	light.light_color = Palette.ACCENT
	light.omni_range = range_m
	light.omni_attenuation = 1.6
	light.light_energy = e
	light.shadow_enabled = false
	light.light_specular = 0.15
	add_child(light)
	if pool_at != Vector3.INF:
		pool_mat = ShaderMaterial.new()
		pool_mat.shader = preload("res://shaders/light_pool.gdshader")
		pool_mat.render_priority = -2           # (v0.8.3: always UNDER the carved writing / rings on the same floor: no sort flicker)
		var q := PlaneMesh.new()
		q.size = Vector2(pool_size, pool_size)
		pool = MeshInstance3D.new()
		pool.mesh = q
		pool.material_override = pool_mat
		pool.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		pool.set_meta("pool_at", pool_at)
		add_child(pool)
	all.append(self)

func _ready() -> void:
	if pool: pool.global_position = pool.get_meta("pool_at") - Vector3(0, 0.006, 0)      # (a hair above the stone, below any marks)

func _exit_tree() -> void:
	all.erase(self)

func level() -> float:
	var k := strength
	if follow and follow_param != "":
		var v = follow.get_shader_parameter(follow_param)
		k *= clampf((float(v) if v != null else 0.0) * follow_scale, 0.0, 1.0)
	return k

func _process(dt: float) -> void:
	var k := level()
	if pool_mat: pool_mat.set_shader_parameter("k", k)
	# (v0.8.3: the shared budget (Flame.cull) gives or takes the light; it fades, never pops)
	_fade = move_toward(_fade, 1.0 if (k > 0.02 and _allowed and is_visible_in_tree()) else 0.0, dt * 3.0)
	light.visible = _fade > 0.005
	if light.visible: light.light_energy = energy * k * _fade
