class_name OmenFx
## v2.0 (Agent A) drop-in effects for Chapter I's beats (EIDOLON_SCRIPT §5, §6). Static builders: each returns a node
## (add nothing yourself: it is added to `parent`), animates itself and frees itself when done unless noted.
## Every effect is web-safe (no depth/screen texture) and has a cheap Low path (OmenFx.high = false, set by World.set_tier).
##
## PROLOGUE
##   OmenFx.palm_press(parent, pos, yaw, water_fx)       her palm pressed on the pool's surface from BENEATH, then two
##                                                       taps (ripple rings, the print flashing); returns it (call
##                                                       .queue_free() or OmenFx.fade_out(node) when she is taken)
##   OmenFx.palm_tap(node, water_fx)                     one more knock on an existing palm
##   warden.set_look("glass") / warden.rise_from(y, s)  (WardenRig) the Glass Warden of cracked glass, rising
##   OmenFx.murk(water_mat, to, seconds)                 the pool clouds over (water.gdshader `murk`), or clears (to 0)
##   PassThrough.water(parent, pos, comb_node, ...)      the comb passing up through the surface (see pass_through.gd)
## THE WARDEN SNUFFS A REFLECTION
##   OmenFx.frost(parent, centre, normal, size, hold)    dark spreads over a mirror / pool with frost-cracks, then clears
## FIRST SHRINE FINALE
##   OmenFx.write_in_water(parent, pos, yaw, "ΒΡΕΣ ΜΕ", seconds)   her fingertip writes it, stroke by stroke
##   OmenFx.glass_eye(parent, pos, size, open_s, hold_s)            a glass eye deep in the water opens, looks, closes

static var high := true
const SH := preload("res://shaders/omen_fx.gdshader")
enum { CAUSTIC, CRACK, FROST, WRITING, EYE, RING }

## a flat decal (PlaneMesh, +Y normal) with the omen shader; `normal` turns it to stand on a glass
static func decal(parent: Node, pos: Vector3, kind: int, size: Vector2, normal := Vector3.UP, yaw := 0.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = size
	mi.mesh = pm
	var m := ShaderMaterial.new()
	m.shader = SH
	m.set_shader_parameter("kind", kind)
	m.set_shader_parameter("aspect", size.x / maxf(size.y, 0.001))
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	var n := normal.normalized()
	var b: Basis
	if absf(n.y) > 0.99:
		b = Basis(Vector3.UP, yaw)
	else:
		# on a glass: the decal's normal is the glass's, its p.y (quad -Z) is world up
		var x := Vector3.UP.cross(n).normalized()
		b = Basis(x, n, x.cross(n))
	mi.global_transform = Transform3D(b, pos)
	return mi

static func _p(mi: MeshInstance3D, k: String, v: Variant) -> void:
	(mi.material_override as ShaderMaterial).set_shader_parameter(k, v)

## fade a decal / effect node out and free it
static func fade_out(node: Node3D, seconds := 0.8) -> void:
	if not is_instance_valid(node): return
	var tw := node.create_tween()
	var m := (node as GeometryInstance3D).material_override as ShaderMaterial if node is GeometryInstance3D else null
	if m: tw.tween_method(func(v: float) -> void: m.set_shader_parameter("k", v), float(m.get_shader_parameter("k")), 0.0, seconds)
	else: tw.tween_interval(seconds)
	tw.tween_callback(node.queue_free)

# ------------------------------------------------------------------------------------------------------------------- prologue
## her palm on the surface, from beneath: it rises into the surface (blurred -> pressed), then knocks twice
static func palm_press(parent: Node, pos: Vector3, yaw := 0.0, water_fx: Object = null, taps := 2) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(0.62, 0.62)               # (her hand at the hero's scale: about 25 cm long in the 1.12 m world)
	mi.mesh = pm
	var m := ShaderMaterial.new()
	m.shader = preload("res://shaders/surface_palm.gdshader")
	m.set_shader_parameter("k", 0.0)
	m.set_shader_parameter("press", 0.0)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	mi.global_transform = Transform3D(Basis(Vector3.UP, yaw), pos + Vector3(0, 0.004, 0))
	var tw := mi.create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("k", v), 0.0, 1.0, 0.8)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("press", v), 0.0, 1.0, 0.9).set_ease(Tween.EASE_OUT)
	for i in taps:
		tw.tween_interval(0.42 if i == 0 else 0.3)
		tw.tween_callback(func() -> void: palm_tap(mi, water_fx))
	return mi

static func palm_tap(mi: MeshInstance3D, water_fx: Object = null) -> void:
	if not is_instance_valid(mi): return
	var m := mi.material_override as ShaderMaterial
	var tw := mi.create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("tap", v), 1.0, 0.0, 0.45)
	if water_fx and water_fx.has_method("splash"): water_fx.call("splash", mi.global_position, 0.55, 3.0)
	var r := decal(mi.get_parent(), mi.global_position + Vector3(0, 0.006, 0), RING, Vector2(1.1, 1.1))
	var rm := r.material_override as ShaderMaterial
	var t2 := r.create_tween()
	t2.tween_method(func(v: float) -> void: rm.set_shader_parameter("grow", v), 0.15, 1.0, 0.9).set_ease(Tween.EASE_OUT)
	t2.tween_callback(r.queue_free)

## the pool clouds over (to 1) or clears (to 0): water.gdshader's `murk`
static func murk(water_mat: ShaderMaterial, to := 1.0, seconds := 2.5) -> void:
	if water_mat == null: return
	var from := float(water_mat.get_shader_parameter("murk") if water_mat.get_shader_parameter("murk") != null else 0.0)
	var tree := Engine.get_main_loop() as SceneTree
	var tw := tree.create_tween()
	tw.tween_method(func(v: float) -> void: water_mat.set_shader_parameter("murk", v), from, to, seconds).set_trans(Tween.TRANS_SINE)

# ------------------------------------------------------------------------------------------------- the Warden snuffs a reflection
## dark spreads over the glass / pool from `centre` with frost-cracks growing in it, holds, then clears
static func frost(parent: Node, centre: Vector3, normal: Vector3, size: Vector2, hold := 1.4) -> MeshInstance3D:
	var mi := decal(parent, centre + normal.normalized() * 0.03, FROST, size, normal)
	_p(mi, "grow", 0.0)
	var m := mi.material_override as ShaderMaterial
	var tw := mi.create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("grow", v), 0.0, 1.0, 0.9).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_interval(hold)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("k", v), 1.0, 0.0, 1.2)
	tw.tween_callback(mi.queue_free)
	return mi

# ------------------------------------------------------------------------------------------------------- First Shrine finale
## glyph strokes on a 1 x 1.4 cell (x right, y up): uppercase Greek + the Latin capitals they share
const GLYPHS := {
	"Β": [[[0, 0], [0, 1.4]], [[0, 1.4], [0.55, 1.36], [0.72, 1.16], [0.55, 0.74], [0, 0.72]], [[0, 0.72], [0.62, 0.68], [0.82, 0.4], [0.62, 0.04], [0, 0]]],
	"Ρ": [[[0, 0], [0, 1.4]], [[0, 1.4], [0.58, 1.36], [0.78, 1.08], [0.58, 0.72], [0, 0.7]]],
	"Ε": [[[0.75, 1.4], [0, 1.4], [0, 0], [0.75, 0]], [[0, 0.72], [0.6, 0.72]]],
	"Σ": [[[0.8, 1.4], [0, 1.4], [0.48, 0.7], [0, 0], [0.8, 0]]],
	"Μ": [[[0, 0], [0, 1.4], [0.48, 0.55], [0.96, 1.4], [0.96, 0]]],
	"Α": [[[0, 0], [0.45, 1.4], [0.9, 0]], [[0.2, 0.55], [0.7, 0.55]]],
	"Ι": [[[0.2, 0], [0.2, 1.4]]],
	"Ο": [[[0.42, 1.4], [0.75, 1.2], [0.85, 0.7], [0.75, 0.2], [0.42, 0], [0.1, 0.2], [0, 0.7], [0.1, 1.2], [0.42, 1.4]]],
	"Ν": [[[0, 0], [0, 1.4], [0.8, 0], [0.8, 1.4]]],
	"Η": [[[0, 0], [0, 1.4]], [[0, 0.7], [0.8, 0.7]], [[0.8, 1.4], [0.8, 0]]],
}
const ADV := {"Β": 1.0, "Ρ": 0.95, "Ε": 0.92, "Σ": 0.98, "Μ": 1.2, "Α": 1.05, "Ι": 0.5, "Ο": 1.0, "Ν": 1.0, "Η": 1.0, " ": 0.7}

## her fingertip writes `text` in the water (a quad on the surface, `yaw` turns the line), stroke by stroke over
## `seconds`, a caustic glow along each stroke; it lingers `linger` s, then fades. Returns the decal.
static func write_in_water(parent: Node, pos: Vector3, yaw := 0.0, text := "ΒΡΕΣ ΜΕ", seconds := 6.0, letter_h := 0.42, linger := 4.0) -> MeshInstance3D:
	# lay the strokes out on a line, in metres, centred
	var segs: Array[Vector4] = []
	var x := 0.0
	var s := letter_h / 1.4
	for ch in text:
		if GLYPHS.has(ch):
			for stroke in GLYPHS[ch]:
				for i in (stroke as Array).size() - 1:
					var a: Array = stroke[i]; var b: Array = stroke[i + 1]
					segs.append(Vector4(x + float(a[0]) * s, float(a[1]) * s, x + float(b[0]) * s, float(b[1]) * s))
		x += float(ADV.get(ch, 1.0)) * s
	var w := x + 0.3
	var h := letter_h + 0.4
	var acc := PackedFloat32Array()
	var arr := PackedVector4Array()
	var total := 0.0
	for sg in segs:
		# quad units: x * aspect-scaled -1..1 -> metres: pa = (p.x * aspect, p.y) with p in -1..1 => 1 unit = h/2 m
		var u := 2.0 / h
		var a := Vector2(sg.x - x * 0.5, sg.y - letter_h * 0.5) * u
		var b := Vector2(sg.z - x * 0.5, sg.w - letter_h * 0.5) * u
		arr.append(Vector4(a.x, a.y, b.x, b.y))
		acc.append(total)
		total += a.distance_to(b)
	var mi := decal(parent, pos + Vector3(0, 0.006, 0), WRITING, Vector2(w, h), Vector3.UP, yaw)
	var m := mi.material_override as ShaderMaterial
	m.set_shader_parameter("segs", arr)
	m.set_shader_parameter("seg_acc", acc)
	m.set_shader_parameter("n_segs", arr.size())
	m.set_shader_parameter("progress", 0.0)
	var tw := mi.create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("progress", v), 0.0, total + 0.01, seconds)
	tw.tween_interval(linger)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("k", v), 1.0, 0.0, 1.6)
	tw.tween_callback(mi.queue_free)
	return mi

## a glass eye deep in the water opens for a moment (`hold_s`), then closes and is gone
static func glass_eye(parent: Node, pos: Vector3, size := 1.4, open_s := 1.6, hold_s := 2.2, yaw := 0.0) -> MeshInstance3D:
	var mi := decal(parent, pos + Vector3(0, 0.005, 0), EYE, Vector2(size, size * 0.62), Vector3.UP, yaw)
	var m := mi.material_override as ShaderMaterial
	m.set_shader_parameter("open", 0.0)
	var tw := mi.create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("open", v), 0.0, 1.0, open_s).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.tween_interval(hold_s)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("open", v), 1.0, 0.0, 0.7).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tw.tween_callback(mi.queue_free)
	return mi
