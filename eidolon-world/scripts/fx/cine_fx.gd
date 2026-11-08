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
var _cards: Array = []           # [MeshInstance3D, subject (Node3D or Vector3), dist, ShaderMaterial, size (ZERO = fit)]
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
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform vec4 tint : source_color = vec4(0.16, 0.16, 0.18, 1.0);
uniform float alpha = 0.0;
uniform float t = 0.0;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void fragment() {
	vec2 q = UV - 0.5;
	// (a3) a broad flat middle and a long soft shoulder: the haze reads as a plane of depth, not a card
	float edge = 1.0 - smoothstep(0.36, 0.5, max(abs(q.x), abs(q.y)));
	float n = n2(UV * 5.0 + vec2(t * 0.05, t * 0.02)) * 0.6 + n2(UV * 11.0 - vec2(t * 0.03, 0.0)) * 0.4;
	ALBEDO = tint.rgb * (0.94 + 0.12 * n);
	ALPHA = alpha * edge * (0.86 + 0.14 * n);
}
"""

## (a3) the crimson rim + slow glint sweep laid OVER an item's own materials (material_overlay): it reads in a dark shot
const RIM_SHADER := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_back, shadows_disabled, fog_disabled;
uniform vec4 col : source_color = vec4(0.95, 0.10, 0.14, 1.0);
uniform float k = 0.0;
varying vec3 lp;
void vertex() { lp = VERTEX; }
void fragment() {
	float fr = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.6);
	float sweep = smoothstep(0.10, 0.0, abs(fract(dot(lp, vec3(3.1, 2.3, 1.7)) - TIME * 0.32) - 0.5));
	vec3 c = col.rgb * fr * 1.6 + vec3(1.0, 0.86, 0.84) * sweep * 0.35 * (0.3 + fr);
	ALBEDO = c * k;
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
## a soft card of fog `dist` metres behind `subject` (a Node3D or a point), facing the ACTIVE camera (the CineCam in a
## cutscene: get_viewport().get_camera_3d()); it veils the background the way a shallow focus would, the subject stays
## crisp. size Vector2.ZERO (default) = it fills the view at its depth, re-fitted each frame. Colour: the fog's own, lifted
## a little so it reads over a dark background (or `col`).
func dof(subject: Variant, dist := 2.4, alpha := 0.62, size := Vector2.ZERO, col := Color(-1, 0, 0)) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2.ONE
	mi.mesh = qm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var m := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = CARD_SHADER
	m.shader = sh
	var c := col
	if c.r < 0.0:
		var f := world.env.fog_light_color if world and world.env else Color(0.16, 0.16, 0.18)
		c = f.lerp(Color(0.46, 0.48, 0.52), 0.32)          # (the bare fog colour vanished into a dark backdrop)
	m.set_shader_parameter("tint", c)
	m.set_shader_parameter("alpha", 0.0)
	mi.material_override = m
	if world: world.add_child(mi)
	else: add_child(mi)
	_cards.append([mi, subject, dist, m, size])
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

## the camera the player sees through right now: the CineCam in a cutscene, else the gameplay camera
func cam() -> Camera3D:
	var c: Camera3D = get_viewport().get_camera_3d() if is_inside_tree() else null
	if c == null and world: c = world.cam
	return c

func _place_card(cd: Array) -> void:
	var c := cam()
	if c == null: return
	var mi: MeshInstance3D = cd[0]
	var s: Variant = cd[1]
	var at: Vector3 = (s as Node3D).global_position + Vector3(0, 0.6, 0) if s is Node3D and is_instance_valid(s) else (s if s is Vector3 else Vector3.ZERO)
	var cx := c.global_transform
	var fwd := -cx.basis.z.normalized()
	var p := at + fwd * float(cd[2])
	var sz: Vector2 = cd[4]
	if sz == Vector2.ZERO:
		var vs := Vector2(get_viewport().get_visible_rect().size)
		var asp := vs.x / maxf(vs.y, 1.0)
		var hh: float = c.size if c.projection == Camera3D.PROJECTION_ORTHOGONAL else 2.0 * maxf(fwd.dot(p - cx.origin), 0.5) * tan(deg_to_rad(c.fov) * 0.5)
		sz = Vector2(hh * asp, hh) * 1.45 if c.keep_aspect == Camera3D.KEEP_HEIGHT else Vector2(hh, hh / asp) * 1.45
	mi.global_transform = Transform3D(cx.basis.orthonormalized().scaled_local(Vector3(sz.x, sz.y, 1.0)), p)

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
		var cc := cam()
		var cb := cc.global_transform.basis if cc else Basis()
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

# ---------------------------------------------------------------- P1 prologue moments (a3)
var _follow: Array = []          # [FxBurst, Callable -> Vector3 (INF: stop), end time, (shown with this node)]

## (22.4 s) her fingers stir and the hairline cracks in the marble catch the light: small white-hot crimson stars that
## ride her fingertips for `seconds`. `rig`: a HeroineRig (player.fig.rig); side "L" | "R" | "" (both hands).
func finger_glints(rig: Node, side := "", seconds := 2.4) -> FxBurst:
	var b: FxBurst = null
	for sd in (["L", "R"] if side == "" else [side]):
		var tip := func() -> Vector3: return _fingertip(rig, sd)
		b = FxBurst._make(_fx_parent(), tip.call(), FxBurst.GLINT, 5, {"life": 0.8, "size0": 0.045, "size1": 0.022,
			"glint_r": Vector3(0.035, 0.01, 0.035), "col0": Color(1.0, 0.5, 0.5, 1.0), "col1": Color(1.0, 1.0, 1.0, 0.0), "soft": 0.0, "reach": 0.4}, true)
		_follow.append([b, tip, _t + seconds])
	return b

## (26-28 s) stone dust and grit shaken from her joints as she rises: knees, hips, elbows, shoulders in turn over `seconds`
func joint_dust(rig: Node, seconds := 2.0, strength := 1.2) -> Tween:
	var tw := create_tween()
	var js := ["L_Calf", "R_Calf", "L_Thigh", "R_Thigh", "R_Forearm", "L_Forearm", "R_Upperarm", "L_Upperarm"]
	for i in js.size():
		var bn: String = js[i]
		tw.tween_callback(func() -> void:
			if not is_instance_valid(rig): return
			var p: Vector3 = rig.call("bone_world", bn) + Vector3(0, 0.04, 0)
			var g: float = (rig as Node3D).global_position.y
			FxBurst._make(_fx_parent(), p, FxBurst.DUST, int(8 * strength), {"life": 1.5, "speed": 0.22, "spread": 0.9, "dir": Vector3(0, -0.4, 0),
				"gravity": 0.25, "drag": 1.4, "size0": 0.08, "size1": 0.24, "col0": Color(0.8, 0.78, 0.74, 0.85), "col1": Color(0.82, 0.8, 0.77, 0.0),
				"delay": 0.2, "soft": 0.06, "ground": g, "reach": 1.0})
			FxBurst._make(_fx_parent(), p, FxBurst.SPARK, int(6 * strength), {"life": 0.7, "speed": 0.55, "spread": 0.9, "dir": Vector3(0, 0.3, 0),
				"gravity": 9.8, "size0": 0.02, "size1": 0.015, "col0": Color(0.9, 0.88, 0.84, 1.0), "col1": Color(0.7, 0.68, 0.64, 1.0),
				"delay": 0.15, "soft": 0.0, "reach": 1.0})).set_delay(0.0 if i == 0 else seconds / float(js.size()))
	return tw

## (73.3 s) the comb's clink on the marble: a crown of droplets thrown up off it, a few taller jets, a wet print that dries
func droplet_crown(pos: Vector3, strength := 1.0) -> FxBurst:
	var par := _fx_parent()
	var b := FxBurst._make(par, pos, FxBurst.SPLASH, int(26 * strength), {"life": 0.55, "speed": 1.35, "crown": 1.05, "gravity": 9.8,
		"size0": 0.012, "size1": 0.008, "stretch": 0.05, "col0": Color(0.97, 0.99, 1.0, 1.0), "col1": Color(0.9, 0.94, 0.98, 0.25), "delay": 0.04, "soft": 0.0, "reach": 0.8})
	FxBurst._make(par, pos, FxBurst.SPLASH, int(5 * strength), {"life": 0.5, "speed": 1.6, "spread": 0.15, "gravity": 9.8,
		"size0": 0.015, "size1": 0.01, "stretch": 0.04, "col0": Color(0.97, 0.99, 1.0, 1.0), "col1": Color(0.9, 0.94, 0.98, 0.2), "delay": 0.08, "soft": 0.0, "reach": 0.8})
	var wet := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(0.34, 0.34) * strength
	wet.mesh = pm
	var m := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = WET_SHADER
	m.shader = sh
	wet.material_override = m
	wet.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	par.add_child(wet)
	wet.global_position = pos + Vector3(0, 0.004, 0)
	var tw := wet.create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("k", v), 0.0, 1.0, 0.12)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("k", v), 1.0, 0.0, 5.0).set_delay(1.0)
	tw.tween_callback(wet.queue_free)
	return b

## a story item that must READ in a dark shot (the comb in shot 12): a crimson rim + a slow glint sweep over its own
## materials, and one star that rides it. hero_item(node, 0.0, 1.0) fades it off. Returns the overlay material.
func hero_item(node: Node3D, k := 0.75, seconds := 0.8) -> ShaderMaterial:
	var m: ShaderMaterial = node.get_meta("a3_rim") if node.has_meta("a3_rim") else null
	if m == null:
		m = ShaderMaterial.new()
		var sh := Shader.new()
		sh.code = RIM_SHADER
		m.shader = sh
		m.set_shader_parameter("k", 0.0)
		node.set_meta("a3_rim", m)
		var mis := node.find_children("*", "MeshInstance3D", true, false)
		if node is MeshInstance3D: mis.append(node)
		for mi in mis: (mi as MeshInstance3D).material_overlay = m
		var at := func() -> Vector3: return node.global_position + Vector3(0, 0.03, 0) if is_instance_valid(node) and node.is_inside_tree() else Vector3.INF
		var b := FxBurst._make(_fx_parent(), node.global_position, FxBurst.GLINT, 2, {"life": 1.4, "size0": 0.05, "size1": 0.03,
			"glint_r": Vector3(0.05, 0.02, 0.05), "col0": Color(1.0, 0.3, 0.32, 1.0), "col1": Color(1.0, 1.0, 1.0, 0.0), "soft": 0.0, "reach": 0.5}, true)
		_follow.append([b, at, INF, node])
		node.set_meta("a3_glint", b)
	var k0: Variant = m.get_shader_parameter("k")
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("k", v), float(k0) if k0 != null else 0.0, k, maxf(seconds, 0.001))
	if k <= 0.0 and node.has_meta("a3_glint"):
		var g: FxBurst = node.get_meta("a3_glint")
		if is_instance_valid(g): g.stop()
	return m

func _fingertip(rig: Node, side: String) -> Vector3:
	if not is_instance_valid(rig) or not rig.is_inside_tree(): return Vector3.INF
	var h: Vector3 = rig.call("bone_world", side + "_Hand")
	var f: Vector3 = rig.call("bone_world", side + "_Forearm")
	return h + (h - f).normalized() * 0.085 + Vector3(0, 0.025, 0)          # (lifted clear of the floor she lies on)

func _fx_parent() -> Node:
	return world if world else self

const WET_SHADER := """
shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform float k = 0.0;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void fragment() {
	vec2 q = (UV - 0.5) * 2.0;
	float a = atan(q.y, q.x);
	float r = length(q) * (1.0 + 0.18 * sin(a * 5.0 + 1.3) + 0.1 * sin(a * 9.0));
	float m = 1.0 - smoothstep(0.55 * k + 0.2, 0.62 * k + 0.25, r);
	ALBEDO = vec3(0.10, 0.10, 0.11);
	ROUGHNESS = 0.08;
	SPECULAR = 0.9;
	ALPHA = m * 0.42 * k;
}
"""

var _t := 0.0
func _process(dt: float) -> void:
	_t += dt
	for i in range(_follow.size() - 1, -1, -1):
		var f: Array = _follow[i]
		var b: FxBurst = f[0]
		var p: Vector3 = (f[1] as Callable).call() if is_instance_valid(b) else Vector3.INF
		if p == Vector3.INF or _t > float(f[2]):
			if is_instance_valid(b): b.stop()
			_follow.remove_at(i)
		else:
			b.global_position = p
			if f.size() > 3: b.visible = (f[3] as Node3D).is_visible_in_tree()
	for cd in _cards:
		if is_instance_valid(cd[0]):
			_place_card(cd)
			(cd[3] as ShaderMaterial).set_shader_parameter("t", _t)
