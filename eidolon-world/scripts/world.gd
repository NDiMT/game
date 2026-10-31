class_name World
extends Node3D
## Environment, light, the orthographic isometric follow camera (v0.9: one fixed view: no rotation, no zoom), fog sheets
## that follow the player (with a clear bubble projected along the view ray so the bubble is centred on
## the player on screen), light shafts, floating dust, backdrop and the film-grain overlay.
## `awaken` (0..1) drives the shrine finale: fog recedes, light returns.

const PITCH := deg_to_rad(36.0)
const DIST := 24.0                 # v0.8 (was 40): an orthographic camera sees the same at any distance;
                                   # closer, the directional shadow covers no empty air in front of the scene
const CAM_SIZE := 10.5             # reference width for the vertical framing offset
## v0.9: ONE fixed view. No rotation, no zoom: one iso yaw and one width (7.5 m across since v0.9.1), the
## camera following you as before; the rooms are laid out so nothing stands between it and a puzzle piece
## (tests/framing_test: the occlusion test)
const FIXED_SIZE := 7.5               # (v0.9.1: a little closer, the owner)
const V_OFFSET := 1.6              # the vertical framing offset at CAM_SIZE (scaled with the size)
const SHAFT_BASE := [0.20, 0.16, 0.14]
const VEIL := 1                    # fog_mats index of the veil sheet with the clear bubble

var noise_tex: ImageTexture
var env: Environment
var rig: Node3D
var pitch_node: Node3D
var cam: Camera3D
var sun: DirectionalLight3D
var yaw_index := 0
var _shake := 0.0
var _t := 0.0
var base_v_offset := V_OFFSET
var fog_mats: Array[ShaderMaterial] = []
var fog_nodes: Array[MeshInstance3D] = []
var cam_back := Vector3(-0.572, 0.588, 0.572)
var follow: Node3D
var look_offset := Vector3.ZERO
## the clear bubble in the fog veil (inner, outer radius); eased toward fog_hole_target
var fog_hole := Vector2(4.6, 11.0)
var fog_hole_target := Vector2(4.6, 11.0)
var awaken := 0.0
var shaft_mats: Array[ShaderMaterial] = []
var zoom := FIXED_SIZE            # (kept for the cinematics, which read it; never changes)
var backdrop_mat: ShaderMaterial
var cam_size_target := FIXED_SIZE
var cam_lock := false
var quality_high := true           # false = the low feature set (bloom off, fewer motes, ...)
var tier := "high"                 # high | auto | low
var auto_step := 0                 # auto: 0 = as high (cheaper), 1 = 1.25x render cap, 2 = no MSAA, 3 = low set
var dpr := 1.0                     # device pixel ratio (web)
var dust_mm: MultiMeshInstance3D
var ash_mm: MultiMeshInstance3D
var puffs: Array[MeshInstance3D] = []
var _puff_i := 0
var birds: Array[MeshInstance3D] = []
var moths: Array = []                # [node, center, phase]

func _ready() -> void:
	var fn := FastNoiseLite.new()
	fn.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	fn.frequency = 0.012
	fn.fractal_octaves = 4
	fn.seed = 17
	var img := fn.get_seamless_image(256, 256, false, false, 0.1, true)
	img.generate_mipmaps()
	noise_tex = ImageTexture.create_from_image(img)
	_build_env()
	_build_camera()
	_build_light()
	_build_fog()
	_build_shafts()
	_build_motes()
	_build_sprites()
	_build_overlays()
	set_awaken(0.0)

func _build_env() -> void:
	env = Environment.new()
	env.background_mode = Environment.BG_CANVAS
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.70, 0.76, 0.86)     # cool fog ambient
	env.ambient_light_energy = 0.6
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_light_color = Color(0.78, 0.78, 0.765)
	env.fog_light_energy = 1.0
	env.fog_depth_curve = 1.3
	env.fog_height = -1.2
	env.fog_height_density = 0.40
	env.fog_sky_affect = 0.0
	# v0.3: filmic, a little less exposure: the marble no longer burns
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.98
	env.tonemap_white = 4.0
	# post: soft bloom on the glowing runes, a gentle grade (cool shadows, warm highlights)
	env.glow_enabled = true
	env.glow_intensity = 0.55
	env.glow_strength = 1.0
	env.glow_bloom = 0.0
	env.glow_hdr_threshold = 0.95
	env.glow_hdr_scale = 1.6
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	for i in 7: env.set_glow_level(i, 1.0 if i in [1, 2, 3] else 0.0)
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.04
	env.adjustment_saturation = 0.95
	var grad := Gradient.new()
	# a gentle midtone S-curve: cool shadows, warm highlights that never reach pure white
	grad.set_color(0, Color(0.0, 0.015, 0.045))
	grad.set_color(1, Color(0.955, 0.94, 0.905))
	grad.add_point(0.25, Color(0.19, 0.20, 0.225))
	grad.add_point(0.5, Color(0.49, 0.495, 0.50))
	grad.add_point(0.75, Color(0.775, 0.77, 0.755))
	var gt := GradientTexture1D.new()
	gt.gradient = grad
	gt.width = 256
	env.adjustment_color_correction = gt
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

func _build_camera() -> void:
	rig = Node3D.new()
	rig.name = "Rig"
	rig.rotation.y = -PI * 0.25
	add_child(rig)
	pitch_node = Node3D.new()
	pitch_node.rotation.x = -PITCH
	rig.add_child(pitch_node)
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.keep_aspect = Camera3D.KEEP_WIDTH
	cam.size = FIXED_SIZE
	cam.near = 1.0
	cam.far = 110.0
	cam.position = Vector3(0, 0, DIST)
	cam.v_offset = base_v_offset
	pitch_node.add_child(cam)
	cam.current = true
	cam.cull_mask = PlanarMirror.MAIN_MASK

func _build_light() -> void:
	sun = DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0)
	sun.light_color = Color(1.0, 0.925, 0.80)            # warm key
	sun.light_energy = 0.85
	sun.shadow_enabled = true
	# v0.8 smoother shadows: the shadow box is fitted to what the iso camera sees (the camera sits DIST
	# away, the visible ground spans about DIST +- 13 m), a larger atlas on High / Auto, PCF soft
	# filtering, biases retuned for the smaller texels (Godot keeps the directional shadow texel-snapped)
	sun.shadow_blur = 1.4
	sun.shadow_bias = 0.03
	sun.shadow_normal_bias = 0.8
	sun.light_angular_distance = 0.8
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = DIST + 16.0
	add_child(sun)

func _fog_sheet(y: float, density: float, hole_in: float, hole_out: float, drift: Vector2, scale: float, col: Color) -> void:
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/fog_sheet.gdshader")
	m.set_shader_parameter("noise_tex", noise_tex)
	m.set_shader_parameter("density", density)
	m.set_shader_parameter("hole_inner", hole_in)
	m.set_shader_parameter("hole_outer", hole_out)
	m.set_shader_parameter("drift", drift)
	m.set_shader_parameter("scale", scale)
	m.set_shader_parameter("color", col)
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(150, 150)
	mi.mesh = pm
	mi.material_override = m
	mi.position.y = y
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.extra_cull_margin = 20.0
	add_child(mi)
	mi.layers = PlanarMirror.LAYER_MAIN_FX
	mi.add_to_group("f_fog")
	fog_mats.append(m)
	fog_nodes.append(mi)

func _build_fog() -> void:
	# three fog layers in two passes (overdraw): the cloud floor under the islands carries the deep
	# void below it in the same pass (layer2), and a veil above the walkways with a clear bubble
	_fog_sheet(-2.4, 0.80, 0.0, 0.0, Vector2(-0.009, 0.005), 0.045, Color(0.76, 0.76, 0.745))
	fog_mats[0].set_shader_parameter("layer2", 1.0)
	fog_mats[0].set_shader_parameter("l2_depth", 4.6)
	_fog_sheet(6.5, 0.86, 4.6, 11.0, Vector2(0.012, -0.004), 0.05, Color(0.82, 0.815, 0.79))

func _build_shafts() -> void:
	# one quad covering what the three shaft quads covered (x -9..9, y -8..22 in the pitch plane)
	var sm := ShaderMaterial.new()
	sm.shader = preload("res://shaders/shafts.gdshader")
	sm.set_shader_parameter("intensity", Vector3(SHAFT_BASE[0], SHAFT_BASE[1], SHAFT_BASE[2]))
	sm.set_shader_parameter("offset", Vector2(0.0, 7.0))
	var q := QuadMesh.new()
	q.size = Vector2(18.0, 30.0)
	var sq := MeshInstance3D.new()
	sq.mesh = q
	sq.material_override = sm
	sq.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sq.position = Vector3(0.0, 7.0, -8.0)
	sq.extra_cull_margin = 20.0
	pitch_node.add_child(sq)
	sq.layers = PlanarMirror.LAYER_MAIN_FX
	sq.add_to_group("f_shafts")
	shaft_mats.append(sm)

func _build_motes() -> void:
	dust_mm = _mote_cloud(130, 0.06, 0.0, 0.7)
	ash_mm = _mote_cloud(70, 0.07, 1.0, 0.55)

func _mote_cloud(count: int, size: float, ash: float, intensity: float) -> MultiMeshInstance3D:
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = q
	mm.instance_count = count
	var r := RandomNumberGenerator.new()
	r.seed = 5 + int(ash * 7)
	for i in count:
		var sc := r.randf_range(0.6, 1.6)
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3(sc, sc, sc)), Vector3(r.randf_range(-8, 8), r.randf_range(-3.5, 3.5), r.randf_range(-8, 8))))
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/mote.gdshader")
	m.set_shader_parameter("ash", ash)
	m.set_shader_parameter("intensity", intensity)
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.custom_aabb = AABB(Vector3(-200, -50, -200), Vector3(400, 100, 400))
	add_child(mi)
	mi.layers = PlanarMirror.LAYER_MAIN_FX
	mi.add_to_group("f_motes")
	return mi

func _sprite(kind: float, size: float) -> MeshInstance3D:
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/sprite.gdshader")
	m.set_shader_parameter("kind", kind)
	m.set_shader_parameter("phase", randf() * TAU)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return mi

func _build_sprites() -> void:
	for i in 8:
		var p := _sprite(0.0, 0.5)
		p.visible = false
		puffs.append(p)
	for i in 3:
		birds.append(_sprite(1.0, 0.7))

## a soft puff of dust where a foot lands
func dust_puff(at: Vector3) -> void:
	if not quality_high and randf() < 0.5: return
	var p := puffs[_puff_i]
	_puff_i = (_puff_i + 1) % puffs.size()
	p.position = at + Vector3(0, 0.06, 0)
	p.visible = true
	p.scale = Vector3.ONE * 0.4
	var m: ShaderMaterial = p.material_override
	var tw := p.create_tween()
	tw.tween_method(func(v: float) -> void:
		m.set_shader_parameter("life", v)
		p.scale = Vector3.ONE * (0.4 + v * 0.9)
		p.position.y = at.y + 0.06 + v * 0.12, 0.0, 1.0, 0.7)
	tw.tween_callback(func() -> void: p.visible = false)

## moths circling a light
func add_moths(center: Vector3, n: int) -> void:
	for i in n:
		var mo := _sprite(2.0, 0.09)
		moths.append([mo, center, randf() * TAU, randf_range(0.35, 0.8)])

## Quality tiers. HIGH (default since v0.8.4) = the full look at the device's native resolution. AUTO = the same
## look, cheaper: the 3D view renders at most 1.5x the CSS pixel size (a 3x phone renders at 1.5x, the
## UI stays sharp), bloom from the quarter / eighth resolution levels only; if frames stay slow it steps
## down gently (1.25x cap, then no MSAA, then the low set) and never further. LOW = 1x CSS, no MSAA,
## no bloom, fewer motes and grass.
func set_tier(t: String, step := 0) -> void:
	tier = t
	auto_step = step if t == "auto" else 0
	var high := t == "high"
	var low := t == "low" or auto_step >= 3
	quality_high = not low
	var cap := 2.0 if high else (1.0 if low else (1.5 if auto_step == 0 else 1.25))      # (v0.8.5: High caps at 2x CSS px)
	var vp := get_viewport()
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
	vp.scaling_3d_scale = clampf(cap / maxf(dpr, 1.0), 0.34, 1.0)
	vp.msaa_3d = Viewport.MSAA_DISABLED if (low or auto_step >= 2) else Viewport.MSAA_2X
	env.glow_enabled = not low
	if high:
		env.glow_intensity = 0.55
		for i in 7: env.set_glow_level(i, 1.0 if i in [1, 2, 3] else 0.0)
	else:
		# the half-resolution level is the costly one: drop it, lift the others to the same look
		env.glow_intensity = 0.62
		for i in 7: env.set_glow_level(i, [0.0, 0.0, 1.25, 1.1, 0.0, 0.0, 0.0][i])
	sun.shadow_enabled = true
	sun.shadow_blur = 1.2 if low else 1.4
	# (v0.8: a 4096 atlas on High / Auto (texels about 4x smaller with the fitted shadow box), 2048 on Low;
	# PCF soft filtering. The Compatibility renderer's higher PCF levels blur the thin shadows of branches
	# and railings almost away, so the soft-very-low kernel with a little blur is kept on every tier)
	RenderingServer.directional_shadow_atlas_set_size(2048 if low else 4096, true)
	RenderingServer.directional_soft_shadow_filter_set_quality(RenderingServer.SHADOW_QUALITY_SOFT_VERY_LOW)
	# (QA P1-8) less full-screen overdraw below High: the light-shaft sheet is a High-tier luxury
	for n in get_tree().get_nodes_in_group("f_shafts"): (n as Node3D).visible = high
	dust_mm.multimesh.visible_instance_count = 50 if low else -1
	ash_mm.multimesh.visible_instance_count = 25 if low else -1
	# (v1.0 A) the newer effects' Low paths: ambient life, water events, the Warden's shadow, the quad batching
	AmbientLife.apply_tier(get_tree(), not low)
	WaterFX.high = not low
	QuadBatch.high = not low
	WardenRig.high = not low
	for w in get_tree().get_nodes_in_group("q_warden"): (w as WardenRig).set_shadow(not low)

func set_quality(high: bool) -> void:
	set_tier("high" if high else "low")

## Approximate fill cost: how many screens' worth of pixels are shaded per frame (backdrop, the opaque
## scene incl. MSAA, every visible blended layer by its on-screen area, bloom passes, post, grain).
func fill_estimate() -> float:
	var f := 1.0                                           # backdrop (canvas)
	f += 1.0 * (2.0 if get_viewport().msaa_3d != Viewport.MSAA_DISABLED else 1.0) * pow(get_viewport().scaling_3d_scale, 2.0)
	for g in ["f_fog", "f_shafts", "f_godrays", "f_water", "f_overlay"]:
		for n in get_tree().get_nodes_in_group(g):
			if n is GeometryInstance3D and n.is_visible_in_tree(): f += screen_frac(n) * pow(get_viewport().scaling_3d_scale, 2.0)
	if env.glow_enabled:
		for i in 7:
			if env.get_glow_level(i) > 0.0: f += 3.0 * pow(0.25, i)   # downsample + 2 blur passes
	f += 1.0                                               # tonemap / grade post pass
	for n in get_tree().get_nodes_in_group("f_grain"):
		if n.visible: f += 1.0
	return f

## fraction of the viewport covered by a node's projected bounding box
func screen_frac(n: GeometryInstance3D) -> float:
	var ab := n.global_transform * n.get_aabb()
	var vs := get_viewport().get_visible_rect().size
	var lo := Vector2(INF, INF); var hi := -lo
	for i in 8:
		var p := cam.unproject_position(ab.get_endpoint(i))
		lo = lo.min(p); hi = hi.max(p)
	lo = lo.clamp(Vector2.ZERO, vs); hi = hi.clamp(Vector2.ZERO, vs)
	return maxf(hi.x - lo.x, 0.0) * maxf(hi.y - lo.y, 0.0) / (vs.x * vs.y)

func tier_name() -> String:
	return tier.to_upper() + (" step %d" % auto_step if tier == "auto" and auto_step > 0 else "")

func _build_overlays() -> void:
	var back := CanvasLayer.new()
	back.layer = -10
	add_child(back)
	var br := ColorRect.new()
	br.set_anchors_preset(Control.PRESET_FULL_RECT)
	br.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var bm := ShaderMaterial.new()
	bm.shader = preload("res://shaders/backdrop.gdshader")
	backdrop_mat = bm
	br.material = bm
	back.add_child(br)
	var front := CanvasLayer.new()
	front.layer = 20
	add_child(front)
	var gr := ColorRect.new()
	gr.set_anchors_preset(Control.PRESET_FULL_RECT)
	gr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var gm := ShaderMaterial.new()
	gm.shader = preload("res://shaders/grain.gdshader")
	gr.material = gm
	front.add_child(gr)
	gr.add_to_group("f_grain")

# ------------------------------------------------------------------ camera
## (dev only: screenshots from the other sides; the game never turns)
func set_yaw_index(i: int) -> void:
	yaw_index = i
	rig.rotation.y = -PI * 0.25 + yaw_index * PI * 0.5

func snap_to(p: Vector3) -> void:
	rig.position = p + Vector3(0, 0.6, 0)
	_rig_smooth = rig.position

## v0.5b: the follow camera moves in whole RENDER pixels (in the camera's own right / up axes): an
## orthographic view whose static stone shifts by exact pixels never crawls or shimmers on thin edges
## (balusters, steps) while you walk. The smooth position is kept separately, so motion stays fluid.
var _rig_smooth := Vector3.INF
var _was_following := false
func _pixel_snap(p: Vector3) -> Vector3:
	var vp := get_viewport()
	var w := float(vp.size.x) * vp.scaling_3d_scale
	if w < 8.0: return p
	var texel := cam.size / w                          # KEEP_WIDTH: world units per render pixel
	var b := cam.global_transform.basis
	var x := roundf(p.dot(b.x) / texel) * texel
	var y := roundf(p.dot(b.y) / texel) * texel
	return b.x * x + b.y * y + b.z * p.dot(b.z)

## v0.6: SEE-THROUGH. When something stands between the camera and the wanderer, the occluding stone
## opens in a soft screen-space circle round them (marble.gdshader: radial cut, a hazy feathered edge,
## a thin petrol rim on the cut). `occ` = the level's occluder boxes; the reveal eases in and out over
## ~0.25 s, and only fragments nearer the camera than the wanderer are cut.
var reveal_k := 0.0
var reveal_px := Vector4.ZERO
const REVEAL_DIAMETER := 2.4     # v0.8 (the owner's value): the see-through circle, metres across
const REVEAL_R := REVEAL_DIAMETER * 0.5
var _near_occ: Array[AABB] = []
var _near_t := 0.0
var _near_at := Vector3.INF
var _hid_hold := 0.0
func update_reveal(occ: Array[AABB], p: Vector3, dt: float) -> void:
	# (perf: only boxes near you can hide you; nothing taller than ~7 m stands more than ~12 m off)
	_near_t -= dt
	if _near_t <= 0.0 or _near_at.distance_to(p) > 3.0:
		_near_t = 0.5
		_near_at = p
		_near_occ.clear()
		var around := AABB(p - Vector3(16, 6, 16), Vector3(32, 18, 32))
		for bx in occ:
			if around.intersects(bx): _near_occ.append(bx)
	var hidden := false
	var back := cam.global_transform.basis.z.normalized()
	for h in [0.25, 0.9, 1.55]:
		var a := p + Vector3(0, h, 0) + back * 0.3
		var b := a + back * 16.0
		for bx in _near_occ:
			if bx.intersects_segment(a, b):
				hidden = true
				break
		if hidden: break
	# (v0.9.1, the flicker hunt: hysteresis: once hidden, stay "hidden" 0.35 s, so a ray grazing the edge of
	# an occluder as you walk past it cannot flip the see-through on and off every frame)
	if hidden: _hid_hold = 0.35
	else: _hid_hold -= dt
	reveal_k = move_toward(reveal_k, 1.0 if _hid_hold > 0.0 else 0.0, dt / 0.25)
	var vp := get_viewport()
	var vis := vp.get_visible_rect().size
	var sp := cam.unproject_position(p + Vector3(0, 0.85, 0))
	var k := Vector2(vp.size) * vp.scaling_3d_scale / vis
	var r := REVEAL_R / maxf(cam.size, 0.1) * vis.x
	var e := smoothstep(0.0, 1.0, reveal_k)
	reveal_px = Vector4(sp.x * k.x, sp.y * k.y, r * k.x, e)
	RenderingServer.global_shader_parameter_set("reveal", reveal_px)

func shake(amount: float) -> void:
	_shake = maxf(_shake, amount)

## camera-relative input: screen-right / screen-up vectors on the ground plane
func ground_axes() -> Array:
	var y := rig.rotation.y
	var right := Vector3(cos(y), 0, -sin(y))
	var fwd := Vector3(-sin(y), 0, -cos(y))
	return [right, fwd]

func set_awaken(k: float) -> void:
	if OS.get_environment("EIDOLON_DEV_AWAKE") == "1": k = 1.0     # (dev only: clear-air material shots)
	awaken = k
	env.fog_depth_begin = DIST + lerpf(-1.0, 8.0, k)
	env.fog_depth_end = DIST + lerpf(20.0, 58.0, k)
	env.fog_light_color = Color(0.78, 0.78, 0.765).lerp(Color(0.82, 0.84, 0.85), k)
	env.fog_height_density = lerpf(0.40, 0.22, k)
	env.ambient_light_energy = lerpf(0.55, 0.72, k)
	sun.light_energy = lerpf(0.85, 1.0, k)
	for i in fog_mats.size():
		fog_mats[i].set_shader_parameter("clear", k * (1.0 if i == VEIL else 0.45))
	shaft_mats[0].set_shader_parameter("intensity", Vector3(SHAFT_BASE[0], SHAFT_BASE[1], SHAFT_BASE[2]) * (1.0 + k * 1.3))
	RenderingServer.global_shader_parameter_set("awaken", k)

func _process(dt: float) -> void:
	_t += dt
	if not cam_lock:
		cam.size = lerpf(cam.size, cam_size_target, 1.0 - exp(-dt * 2.5))
	var pc := follow.global_position if follow else rig.position
	for i in birds.size():
		var a := _t * (0.12 + i * 0.03) + i * 2.1
		var rr := 15.0 + i * 3.0
		birds[i].position = pc + Vector3(cos(a) * rr, 8.0 + i * 1.5 + sin(_t * 0.5 + i) * 0.8, sin(a) * rr)
	for mo in moths:
		var node: MeshInstance3D = mo[0]
		var c: Vector3 = mo[1]
		var ph: float = mo[2]
		var r2: float = mo[3]
		var tt := _t * 1.3 + ph
		node.position = c + Vector3(cos(tt) * r2 + sin(tt * 3.1) * 0.12, sin(tt * 2.3) * 0.25 + sin(tt * 7.0) * 0.05, sin(tt * 0.9) * r2)
	if follow:
		var target := follow.global_position + Vector3(0, 0.6, 0) + look_offset
		if _rig_smooth == Vector3.INF or not _was_following: _rig_smooth = rig.position
		_rig_smooth = _rig_smooth.lerp(target, 1.0 - exp(-dt * 4.0))
		rig.position = _pixel_snap(_rig_smooth)
	_was_following = follow != null
	if _shake > 0.0:
		_shake = maxf(0.0, _shake - dt * 0.6)
		cam.h_offset = sin(_t * 91.0) * _shake * 0.3
		cam.v_offset = base_v_offset * cam.size / CAM_SIZE + cos(_t * 77.0) * _shake * 0.3
	else:
		cam.h_offset = 0.0
		cam.v_offset = base_v_offset * cam.size / CAM_SIZE
	fog_hole = fog_hole.lerp(fog_hole_target, 1.0 - exp(-dt * 1.2))
	fog_mats[VEIL].set_shader_parameter("hole_inner", fog_hole.x)
	fog_mats[VEIL].set_shader_parameter("hole_outer", fog_hole.y)
	cam_back = cam.global_transform.basis.z.normalized()
	if backdrop_mat:
		var sd := Basis.from_euler(Vector3(deg_to_rad(-55.0), deg_to_rad(-32.0), 0.0)) * Vector3.BACK
		var sp := cam.unproject_position(rig.position + sd * 60.0 + Vector3(0, 25, 0))
		var vs := get_viewport().get_visible_rect().size
		backdrop_mat.set_shader_parameter("sun_uv", Vector2(clampf(sp.x / vs.x, 0.1, 0.9), clampf(sp.y / vs.y, 0.04, 0.3)))
	RenderingServer.global_shader_parameter_set("cam_back", cam_back)
	var p := follow.global_position if follow else rig.position - Vector3(0, 0.6, 0)
	if true:
		RenderingServer.global_shader_parameter_set("player_pos", p)
		for i in fog_nodes.size():
			var n := fog_nodes[i]
			# keep the sheet under the camera; texture coords are world-space so nothing swims
			n.position = Vector3(snappedf(p.x, 1.0), n.position.y, snappedf(p.z, 1.0))
			var t := (n.position.y - (p.y + 0.6)) / maxf(cam_back.y, 0.05)
			var c := p + cam_back * t
			fog_mats[i].set_shader_parameter("center", Vector2(c.x, c.z))
