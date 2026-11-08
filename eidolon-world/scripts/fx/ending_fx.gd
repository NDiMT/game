class_name EndingFx
extends Node
## (Agent A, a5) I.23, the chapter's end, made beautiful without touching W's film: this node watches pz_i23's `_film`
## (a Cinematic) and lays its light on the same clock (W's beats: 0 kneel, 6.6 palm to palm, 14.6 ΒΡΕΣ ΜΕ, 21.4 the
## glass eye, 24.2 the rune wakes, 29.5 fade). Attached by PolishArt.dress_all (W adds nothing).
##   0     a warm key from over her shoulder, a cold rim from across the pool, gold motes rising off the water
##   0     her double kneels with her (palm_to_palm on its own rig, half a second late): the palms meet AT the surface
##   6.5   palm to palm: a crimson light wells up under the touch (her side), a pool of it on the surface; soft focus
##   14.2  the writing: the crimson drifts under the words, the key lowers
##   21.3  the eye: the warmth goes out, the rim cools
##   24.0  the rune wakes: a shaft of gold on the stele, the fog recedes and the light returns (World.set_awaken)
##   end   everything eases back (the awaken too) over 2-3 s; a skip ends it at once
## Low tier: two lights (key, under), fewer motes.

const POOL_C := Vector3(-40.0, 0.0, 15.6)
const KNEEL := Vector3(-40.0, 0.0, 18.25)
const TOUCH := Vector3(-40.0, 0.05, 17.42)
const STELE := Vector3(-40.0, 0.0, 11.0)

var pz: Node3D
var game: Game
var _on := false
var _done := {}
var _lights := {}
var _motes: CPUParticles3D
var _pool: MeshInstance3D
var _pool_mat: ShaderMaterial
var _shaft: MeshInstance3D
var _shaft_mat: ShaderMaterial
var _awaken0 := 0.0
var _tw: Tween

static func attach(p: Node3D, g: Game) -> EndingFx:
	var e := EndingFx.new()
	e.name = "I23_EndingFx"
	e.pz = p
	e.game = g
	p.add_child(e)
	return e

func _process(_dt: float) -> void:
	var film: Variant = pz.get("_film") if is_instance_valid(pz) else null
	var running := film != null and is_instance_valid(film) and bool(film.running) and not bool(film.skipping)
	if not running:
		if _on: _end(film != null and is_instance_valid(film) and bool(film.skipping))
		return
	var t: float = film.t
	if not _on: _begin()
	_cue(t, 6.5, _palm)
	_cue(t, 14.2, _write)
	_cue(t, 21.3, _eye)
	_cue(t, 24.0, _wake)
	_cue(t, 24.6, _let_go)

func _cue(t: float, at: float, f: Callable) -> void:
	if t >= at and not _done.has(at):
		_done[at] = true
		f.call()

func _base_y() -> float:
	return pz.global_position.y if is_instance_valid(pz) else 0.0

# ------------------------------------------------------------------ the beats
func _begin() -> void:
	_on = true
	_done.clear()
	var hi := game.world.quality_high
	var y := Vector3(0, _base_y(), 0)
	_light("key", _spot(Color(1.0, 0.80, 0.58), 9.0, 34.0), KNEEL + y + Vector3(1.8, 3.6, 2.6), KNEEL + y + Vector3(0, 0.5, -0.6), 2.4)
	if hi: _light("rim", _spot(Color(0.66, 0.76, 1.0), 9.0, 30.0), POOL_C + y + Vector3(-1.2, 3.0, -3.2), KNEEL + y + Vector3(0, 0.9, 0), 2.6)
	var under := OmniLight3D.new()
	under.light_color = Color(0.92, 0.08, 0.12)
	under.omni_range = 2.6
	under.omni_attenuation = 1.4
	under.light_cull_mask = 0xFFFFF & ~PlanarMirror.LAYER_PLAYER       # (the water and the stone, not her: she wears grey)
	_light("under", under, TOUCH + y + Vector3(0, -0.35, 0), Vector3.INF, 0.0)
	if hi: _light("stele", _spot(Color(1.0, 0.84, 0.55), 8.0, 22.0), STELE + y + Vector3(0.6, 5.5, 2.4), STELE + y + Vector3(0, 1.4, 0), 0.0)
	_to("key", 1.0, 2.5)
	_to("rim", 1.0, 3.0)
	# gold motes lifting off the water
	_motes = CPUParticles3D.new()
	_motes.amount = 60 if hi else 24
	_motes.lifetime = 6.0
	_motes.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	_motes.emission_box_extents = Vector3(2.0, 0.05, 2.0)
	_motes.direction = Vector3.UP
	_motes.spread = 12.0
	_motes.initial_velocity_min = 0.08
	_motes.initial_velocity_max = 0.22
	_motes.gravity = Vector3(0, 0.02, 0)
	_motes.scale_amount_min = 0.5
	_motes.scale_amount_max = 1.2
	var q := QuadMesh.new()
	q.size = Vector2(0.035, 0.035)
	var mm := StandardMaterial3D.new()
	mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mm.albedo_color = Color(1.0, 0.78, 0.45, 0.85)
	mm.albedo_texture = _dot_tex()
	mm.vertex_color_use_as_albedo = true
	q.material = mm
	_motes.mesh = q
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 1, 1, 0))
	grad.add_point(0.2, Color(1, 1, 1, 1))
	grad.add_point(0.75, Color(1, 1, 1, 0.8))
	grad.set_color(grad.get_point_count() - 1, Color(1, 1, 1, 0))
	_motes.color_ramp = grad
	_motes.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_motes)
	_motes.global_position = POOL_C + Vector3(0, _base_y() + 0.06, 0)
	# the crimson pool of light on the water (her side shining through) and the shaft on the stele
	_pool_mat = ShaderMaterial.new()
	_pool_mat.shader = PolishArt.shader(POOL_SH)
	_pool_mat.set_shader_parameter("k", 0.0)
	_pool = _quad(_pool_mat, Vector2(2.4, 2.4), Transform3D(Basis(Vector3.RIGHT, -PI * 0.5), TOUCH + Vector3(0, _base_y() + 0.012, -0.2)))
	_shaft_mat = ShaderMaterial.new()
	_shaft_mat.shader = PolishArt.shader(SHAFT_SH)
	_shaft_mat.set_shader_parameter("k", 0.0)
	if hi: _shaft = _quad(_shaft_mat, Vector2(1.6, 6.0), Transform3D(Basis(Vector3.RIGHT, -0.32), STELE + Vector3(0.3, _base_y() + 3.2, 1.2)))
	_awaken0 = game.world.awaken
	# palm to palm: her double kneels WITH her (half a second late) and lays its palm on the same point from beneath:
	# the touch is on the water's plane, so in the reflection the two palms meet exactly
	var r: Variant = pz.get("water")
	if r is Reflector and (r as Reflector).puppet and (r as Reflector).puppet.rig:
		(r as Reflector).puppet.rig.play("palm_to_palm", {"at": TOUCH + Vector3(0, _base_y(), 0), "n": Vector3.UP, "hold": true, "from": 1.4, "fade": 0.6})

func _palm() -> void:
	var l: Light3D = _lights.get("under")
	if l:
		var tw := create_tween()
		tw.tween_property(l, "light_energy", 3.2, 0.35).set_trans(Tween.TRANS_SINE)
		tw.tween_property(l, "light_energy", 1.5, 2.2).set_trans(Tween.TRANS_SINE)
	var tp := create_tween()
	tp.tween_method(func(v: float) -> void: _pool_mat.set_shader_parameter("k", v), 0.0, 1.0, 0.5).set_trans(Tween.TRANS_SINE)
	tp.tween_method(func(v: float) -> void: _pool_mat.set_shader_parameter("k", v), 1.0, 0.6, 3.0).set_trans(Tween.TRANS_SINE)
	var fx: Variant = pz.get("fx")
	if fx is CineFx and game.world.quality_high: (fx as CineFx).dof(TOUCH + Vector3(0, _base_y(), 0), 1.4, 0.5)

func _write() -> void:
	var fx: Variant = pz.get("fx")
	if fx is CineFx: (fx as CineFx).dof_off(1.0)
	_to("key", 0.7, 2.0)
	var l: Light3D = _lights.get("under")
	if l: create_tween().tween_property(l, "global_position", POOL_C + Vector3(0, _base_y() - 0.3, 0.1), 3.0).set_trans(Tween.TRANS_SINE)
	if _pool: create_tween().tween_property(_pool, "global_position", POOL_C + Vector3(0, _base_y() + 0.012, 0.1), 3.0).set_trans(Tween.TRANS_SINE)

func _eye() -> void:
	_to("key", 0.35, 1.2)
	_to("under", 0.4, 1.2)
	_to("rim", 1.3, 1.2)

func _wake() -> void:
	_to("stele", 1.0, 2.2)
	_to("key", 1.15, 3.0)
	_to("under", 0.6, 3.0)
	var w := game.world
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: w.set_awaken(v), w.awaken, maxf(w.awaken, 0.55), 5.0).set_trans(Tween.TRANS_SINE)
	if _shaft: create_tween().tween_method(func(v: float) -> void: _shaft_mat.set_shader_parameter("k", v), 0.0, 1.0, 2.5).set_trans(Tween.TRANS_SINE)
	if _motes: _motes.amount = _motes.amount + 30

func _let_go() -> void:
	var r: Variant = pz.get("water")
	if r is Reflector and (r as Reflector).puppet and (r as Reflector).puppet.rig: (r as Reflector).puppet.rig.release()

func _end(snap: bool) -> void:
	if not _done.has(24.6): _let_go()
	_on = false
	var s := 0.05 if snap else 2.5
	var w := game.world
	var tw := create_tween().set_parallel(true)
	for n in _lights: tw.tween_property(_lights[n], "light_energy", 0.0, s)
	if _pool_mat: tw.tween_method(func(v: float) -> void: _pool_mat.set_shader_parameter("k", v), _k(_pool_mat), 0.0, s)
	if _shaft_mat: tw.tween_method(func(v: float) -> void: _shaft_mat.set_shader_parameter("k", v), _k(_shaft_mat), 0.0, s)
	tw.tween_method(func(v: float) -> void: w.set_awaken(v), w.awaken, _awaken0, s + 0.5)
	if _motes: _motes.emitting = false
	tw.chain().tween_callback(_clear)

static func _k(m: ShaderMaterial) -> float:
	var v: Variant = m.get_shader_parameter("k")
	return float(v) if v != null else 0.0

func _clear() -> void:
	for n in _lights: if is_instance_valid(_lights[n]): (_lights[n] as Node).queue_free()
	_lights.clear()
	for n in [_motes, _pool, _shaft]: if n and is_instance_valid(n): n.queue_free()
	_motes = null; _pool = null; _shaft = null

# ------------------------------------------------------------------ helpers
func _spot(col: Color, rng: float, ang: float) -> SpotLight3D:
	var l := SpotLight3D.new()
	l.light_color = col
	l.spot_range = rng
	l.spot_angle = ang
	l.spot_attenuation = 0.9
	return l

func _light(n: String, l: Light3D, pos: Vector3, look: Vector3, energy: float) -> void:
	l.name = "End_" + n
	l.shadow_enabled = false
	l.light_energy = 0.0
	l.set_meta("e", energy if energy > 0.0 else 2.2)
	add_child(l)
	l.global_position = pos
	if look != Vector3.INF: l.look_at(look, Vector3.UP)
	_lights[n] = l

func _to(n: String, k: float, s: float) -> void:
	var l: Light3D = _lights.get(n)
	if l: create_tween().tween_property(l, "light_energy", float(l.get_meta("e")) * k, s).set_trans(Tween.TRANS_SINE)

func _quad(m: Material, size: Vector2, xf: Transform3D) -> MeshInstance3D:
	var q := QuadMesh.new()
	q.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.layers = TwoWorld.MINE
	add_child(mi)
	mi.global_transform = xf
	return mi

static var _dot: ImageTexture
static func _dot_tex() -> ImageTexture:
	if _dot: return _dot
	var img := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	for y in 16:
		for x in 16:
			var d := Vector2(x - 7.5, y - 7.5).length() / 7.5
			img.set_pixel(x, y, Color(1, 1, 1, clampf(1.0 - d, 0.0, 1.0) ** 2.0))
	_dot = ImageTexture.create_from_image(img)
	return _dot

const POOL_SH := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
uniform float k = 0.0;
void fragment() {
	float r = length(UV * 2.0 - 1.0);
	float ring = smoothstep(0.05, 0.0, abs(r - fract(TIME * 0.18) * 0.9)) * (1.0 - fract(TIME * 0.18));
	float a = (pow(max(1.0 - r, 0.0), 2.2) * 0.85 + ring * 0.25) * k;
	ALBEDO = mix(accent.rgb, vec3(1.0, 0.45, 0.4), 0.25) * a;
}
"""

const SHAFT_SH := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform float k = 0.0;
void fragment() {
	float x = abs(UV.x * 2.0 - 1.0);
	float body = pow(max(1.0 - x, 0.0), 1.8) * smoothstep(0.0, 0.35, UV.y) * (1.0 - smoothstep(0.75, 1.0, UV.y));
	float motes = 0.75 + 0.25 * sin(UV.y * 40.0 - TIME * 1.2 + UV.x * 9.0);
	ALBEDO = vec3(1.0, 0.82, 0.55) * body * motes * 0.32 * k;
}
"""
