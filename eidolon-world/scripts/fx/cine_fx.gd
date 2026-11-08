class_name CineFx
extends Node
## v3 (Agent A) the cinematic LOOK toolkit for the prologue (and any cutscene). Web-safe: no screen or depth texture,
## no shadows on its lights; everything is a tween or a translucent card. Owns nothing of cinematic.gd (W's timeline):
## call these from Cinematic.at() / anim() keys.
##   var fx := CineFx.new(game.world, game.ui); game.add_child(fx)
##   fx.shake("thud" | "crack" | "tremor" | "rumble" | "taps", strength := 1.0, seconds := -1)   camera-shake curves
##   fx.letterbox(true, 1.2)                     the black bars in (false: out), eased (ui.set_letterbox)
##   fx.fade(1.0, 2.0, Color.BLACK)              a full-screen colour veil to alpha 1 over 2 s (0: clear); -> Tween
##   fx.flash(Color(0.75, 0.05, 0.08), 0.55, 0.06, 0.9)   a flash: up to alpha 0.55 in 0.06 s, gone in 0.9 s
##   fx.vignette(0.6, 1.5)                       soft dark corners (0..1), eased: frames the shot, hides the edges
##   fx.dof(subject, 2.4, 0.55)                  fake depth of field: a soft fog card 2.4 m BEHIND the subject (from the
##                                               camera), faces the camera each frame; alpha 0.55. dof_off(1.0) fades it
##   fx.light_rig("prologue", subject_pos, water_pos)   the prologue light: a cold rim from behind, a faint crimson
##                                               glow up from the water, a dim cold key; fx.lights_to(k, s) dims it, fx.clear_lights(s)
##   fx.focus_fog(k, seconds)                    the env fog thickens toward the background (0 = as the mood has it)
## (all safe to skip(): the setters land on their end values when their tweens are killed by main's skip.)

var world: World
var ui: Node
var layer: CanvasLayer
var veil: ColorRect
var vig: TextureRect
var _cards: Array = []           # [MeshInstance3D, subject (Node3D or Vector3), dist, ShaderMaterial]
var lights := {}
var _fog0 := -1.0

const VIG_SHADER := """
shader_type canvas_item;
uniform float k = 0.0;
uniform vec4 col : source_color = vec4(0.0, 0.0, 0.0, 1.0);
void fragment() {
	vec2 d = (UV - 0.5) * vec2(1.0, 1.25);
	float r = length(d);
	COLOR = vec4(col.rgb, col.a * k * smoothstep(0.28, 0.78, r));
}
"""
const CARD_SHADER := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec4 tint : source_color = vec4(0.16, 0.16, 0.18, 1.0);
uniform float alpha = 0.0;
uniform float t = 0.0;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void fragment() {
	vec2 q = UV - 0.5;
	float edge = 1.0 - smoothstep(0.30, 0.5, max(abs(q.x), abs(q.y)));
	float n = n2(UV * 5.0 + vec2(t * 0.05, t * 0.02)) * 0.6 + n2(UV * 11.0 - vec2(t * 0.03, 0.0)) * 0.4;
	ALBEDO = tint.rgb * (0.92 + 0.16 * n);
	ALPHA = alpha * edge * (0.75 + 0.25 * n);
}
"""

func _init(w: World, u: Node = null) -> void:
	world = w
	ui = u
	name = "CineFx"
	layer = CanvasLayer.new()
	layer.layer = 4                # (under the UI's layer 5: the bars and the lines stay on top)
	add_child(layer)
	vig = TextureRect.new()
	vig.set_anchors_preset(Control.PRESET_FULL_RECT)
	vig.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vig.texture = PlaceholderTexture2D.new()
	vig.stretch_mode = TextureRect.STRETCH_SCALE
	var vm := ShaderMaterial.new()
	var vs := Shader.new()
	vs.code = VIG_SHADER
	vm.shader = vs
	vig.material = vm
	vig.visible = false
	layer.add_child(vig)
	veil = ColorRect.new()
	veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	veil.color = Color(0, 0, 0, 0)
	veil.visible = false
	layer.add_child(veil)

# ---------------------------------------------------------------- camera
func shake(kind: String, strength := 1.0, seconds := -1.0) -> void:
	if world: world.shake_curve(kind, strength, seconds)

# ---------------------------------------------------------------- frame
func letterbox(on: bool, seconds := 1.2) -> Tween:
	var tw := create_tween()
	if ui == null or not ui.has_method("set_letterbox"): return tw
	var from: float = ui.get("letterbox")
	tw.tween_method(func(k: float) -> void: ui.call("set_letterbox", k), from, 1.0 if on else 0.0, seconds).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	return tw

func fade(to_alpha: float, seconds := 1.0, col := Color(0.02, 0.02, 0.025)) -> Tween:
	veil.visible = true
	veil.color = Color(col.r, col.g, col.b, veil.color.a)
	var tw := create_tween()
	tw.tween_property(veil, "color:a", to_alpha, maxf(seconds, 0.001)).set_trans(Tween.TRANS_SINE)
	if to_alpha <= 0.0: tw.tween_callback(func() -> void: veil.visible = false)
	return tw

func flash(col := Color(0.75, 0.05, 0.08), peak := 0.55, attack := 0.06, release := 0.9) -> Tween:
	veil.visible = true
	veil.color = Color(col.r, col.g, col.b, 0.0)
	var tw := create_tween()
	tw.tween_property(veil, "color:a", peak, attack)
	tw.tween_property(veil, "color:a", 0.0, release).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tw.tween_callback(func() -> void: veil.visible = false)
	return tw

func vignette(k: float, seconds := 1.5, col := Color(0.0, 0.0, 0.0)) -> Tween:
	var m := vig.material as ShaderMaterial
	m.set_shader_parameter("col", col)
	vig.visible = true
	var fv: Variant = m.get_shader_parameter("k")
	var from: float = fv if fv != null else 0.0
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("k", v), from, k, maxf(seconds, 0.001)).set_trans(Tween.TRANS_SINE)
	if k <= 0.0: tw.tween_callback(func() -> void: vig.visible = false)
	return tw

# ---------------------------------------------------------------- fake depth of field
## a soft card of fog `dist` metres behind `subject` (a Node3D or a point), facing the camera; it veils the background
## the way a shallow focus would, the subject stays crisp. Colour: the fog's own (world.env) unless given.
func dof(subject: Variant, dist := 2.4, alpha := 0.55, size := Vector2(14.0, 10.0), col := Color(-1, 0, 0)) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = size
	mi.mesh = qm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var m := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = CARD_SHADER
	m.shader = sh
	var c := col
	if c.r < 0.0: c = world.env.fog_light_color if world and world.env else Color(0.16, 0.16, 0.18)
	m.set_shader_parameter("tint", c)
	m.set_shader_parameter("alpha", 0.0)
	mi.material_override = m
	if world: world.add_child(mi)
	else: add_child(mi)
	_cards.append([mi, subject, dist, m])
	_place_card(_cards[-1])
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("alpha", v), 0.0, alpha, 1.2).set_trans(Tween.TRANS_SINE)
	return mi

func dof_off(seconds := 1.0) -> void:
	for cd in _cards:
		var m: ShaderMaterial = cd[3]
		var mi: MeshInstance3D = cd[0]
		var tw := create_tween()
		var a0: Variant = m.get_shader_parameter("alpha")
		tw.tween_method(func(v: float) -> void: m.set_shader_parameter("alpha", v), float(a0) if a0 != null else 0.0, 0.0, maxf(seconds, 0.001))
		tw.tween_callback(mi.queue_free)
	_cards.clear()

func _place_card(cd: Array) -> void:
	if world == null or world.cam == null: return
	var mi: MeshInstance3D = cd[0]
	var s: Variant = cd[1]
	var at: Vector3 = (s as Node3D).global_position + Vector3(0, 0.6, 0) if s is Node3D and is_instance_valid(s) else (s if s is Vector3 else Vector3.ZERO)
	var cb := world.cam.global_transform.basis
	mi.global_transform = Transform3D(cb, at - cb.z.normalized() * float(cd[2]))

## the env's fog thickens (k 0..1) over `seconds`: the far planes melt, the near stay
func focus_fog(k: float, seconds := 1.5) -> Tween:
	var tw := create_tween()
	if world == null or world.env == null: return tw
	if _fog0 < 0.0: _fog0 = world.env.fog_density
	tw.tween_property(world.env, "fog_density", _fog0 * (1.0 + 2.5 * k), maxf(seconds, 0.001)).set_trans(Tween.TRANS_SINE)
	return tw

# ---------------------------------------------------------------- light rig
## "prologue": rim (cold, from behind and above the subject: it draws her porcelain edges), key (a dim cold moon from
## the front-left), under (a faint crimson breath up from the water, if water_pos is given). No shadows (web).
func light_rig(preset: String, subject_pos: Vector3, water_pos := Vector3.INF, seconds := 2.0) -> Dictionary:
	clear_lights(0.0)
	if preset == "prologue":
		var cb := world.cam.global_transform.basis if world and world.cam else Basis()
		var back := -cb.z
		back.y = 0.0
		back = back.normalized() if back.length() > 0.01 else Vector3.FORWARD
		var right := cb.x
		var rim := SpotLight3D.new()
		rim.light_color = Color(0.72, 0.82, 1.0)
		rim.spot_range = 7.0
		rim.spot_angle = 32.0
		rim.spot_attenuation = 0.8
		_add_light("rim", rim, subject_pos + back * 2.6 + Vector3.UP * 2.6 - right * 0.6, subject_pos + Vector3.UP * 0.7, 3.2)
		var key := SpotLight3D.new()
		key.light_color = Color(0.62, 0.68, 0.86)
		key.spot_range = 9.0
		key.spot_angle = 40.0
		_add_light("key", key, subject_pos - back * 3.0 + Vector3.UP * 3.4 - right * 2.2, subject_pos + Vector3.UP * 0.5, 1.1)
		if water_pos != Vector3.INF:
			var under := OmniLight3D.new()
			under.light_color = Color(0.85, 0.08, 0.12)
			under.omni_range = 2.6
			under.omni_attenuation = 1.6
			_add_light("under", under, water_pos - Vector3.UP * 0.25, Vector3.INF, 0.9)
	lights_to(1.0, seconds)
	return lights

func _add_light(n: String, l: Light3D, pos: Vector3, look: Vector3, energy: float) -> void:
	l.name = "Cine_" + n
	l.shadow_enabled = false
	l.light_energy = 0.0
	l.set_meta("e", energy)
	if world: world.add_child(l)
	else: add_child(l)
	l.global_position = pos
	if look != Vector3.INF: l.look_at(look, Vector3.UP if absf((look - pos).normalized().y) < 0.98 else Vector3.BACK)
	lights[n] = l

## every rig light to k x its preset energy over `seconds`
func lights_to(k: float, seconds := 1.0) -> Tween:
	var tw := create_tween().set_parallel(true)
	for n in lights:
		var l: Light3D = lights[n]
		tw.tween_property(l, "light_energy", float(l.get_meta("e")) * k, maxf(seconds, 0.001)).set_trans(Tween.TRANS_SINE)
	return tw

func clear_lights(seconds := 1.0) -> void:
	for n in lights:
		var l: Light3D = lights[n]
		if seconds <= 0.0:
			l.queue_free()
			continue
		var tw := create_tween()
		tw.tween_property(l, "light_energy", 0.0, seconds)
		tw.tween_callback(l.queue_free)
	lights.clear()

var _t := 0.0
func _process(dt: float) -> void:
	_t += dt
	for cd in _cards:
		if is_instance_valid(cd[0]):
			_place_card(cd)
			(cd[3] as ShaderMaterial).set_shader_parameter("t", _t)
