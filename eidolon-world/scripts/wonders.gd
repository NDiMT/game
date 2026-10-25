class_name Wonders
extends Node3D
## v0.9 the wonder spaces between the puzzles (no puzzles in them): somewhere to breathe every few rooms.
##   The Sunken Colossus  (after the Hall and her shadow chamber): a giant veiled head half-sunk in still black
##                        water; the way on runs along its cheek on stepping stones; mist drifts; the water
##                        holds the head's reflection.
##   The Tree of Shards   (after the Garden, the Hollow Walk and the Court): a dead white tree hung with hundreds
##                        of mirror shards on threads, turning slowly, glinting, chiming softly.
##   The Upward Spring    (after the Echo Corridor and the Scales): a fountain falling UPWARD into the fog,
##                        toward a temple hanging upside down in the sky: the mirror world above.
## On your first arrival in each: its name, a swell in the music, a memory line, and the camera leans
## toward it (a pan, never a zoom). Cheap: a few meshes and one multimesh each, hidden when you are far.

const LINES := {
	"CO": "He carved her face so large\nthe sea itself could not forget it.\nThe sea forgot.",
	"TS": "Every face he broke, he hung here,\nso that each would catch the light\nonce more.",
	"SP": "Up there, they say, the rain falls upward\nand the dead look down into the water\nto see the living.",
}
## where the camera leans on arrival (the thing to look at), and how far (0..1)
const FOCUS := {"CO": [Ch1Geo.CO_HEAD + Vector3(0, 1.0, 0), 0.45], "TS": [Ch1Geo.TS_TREE + Vector3(0, 3.6, 0), 0.5],
	"SP": [Ch1Geo.SP_BASIN + Vector3(0, 9.0, 0), 0.55]}
const SHOW_R := 30.0          # each one is hidden beyond this (metres from you)

var game: Game
var level: Level
var roots := {}               # key -> Node3D
var here := ""                # the wonder you stand in ("" elsewhere)
var _chime_t := 2.0
var _line_t := -1.0
var _line_key := ""
var _label_t := -1.0

## a marble colour for the builder (the material id in g; its own variation, never the level's generator)
var _crng := RandomNumberGenerator.new()
func C(mat: float) -> Color:
	return Color(_crng.randf(), mat, 0.0, 1.0)

func setup(g: Game) -> void:
	game = g
	level = g.level
	_build_colossus()
	_build_tree()
	_build_spring()

# ------------------------------------------------------------------ the Sunken Colossus
## the head's parts: [centre, radii, basis] in head space (y 0 = the water line, the face toward -z): a great
## veiled skull, the face pressing through the cloth (brow, nose, lips, chin), and the veil's folds falling
## into the water
func _head_parts() -> Array:
	var I := Basis()
	var parts := [
		[Vector3(0, 0.9, 0.3), Vector3(2.75, 3.6, 2.95), I],                   # the veiled skull
		[Vector3(0, 1.55, -1.95), Vector3(1.35, 0.8, 0.75), Basis(Vector3.RIGHT, 0.15)],   # the brow, under the cloth
		[Vector3(0, 0.6, -2.55), Vector3(0.36, 0.8, 0.5), Basis(Vector3.RIGHT, -0.2)],     # the nose
		[Vector3(0, -0.35, -2.3), Vector3(0.65, 0.26, 0.42), I],               # the lips
		[Vector3(0, -1.1, -2.0), Vector3(0.95, 0.7, 0.7), I],                  # the chin (under the water)
		[Vector3(-1.45, 0.3, -1.5), Vector3(0.85, 1.25, 0.8), I],              # the cheeks
		[Vector3(1.45, 0.3, -1.5), Vector3(0.85, 1.25, 0.8), I],
	]
	# the veil's folds: long soft ridges lying on the skull, down the back and the sides into the water
	for k in 7:
		var a := PI * 0.35 + k * PI * 1.3 / 6.0
		var d := Vector3(sin(a), 0, cos(a))
		parts.append([d * 2.45 + Vector3(0, 0.2, 0.3), Vector3(0.42, 3.1, 0.42), Basis(d.cross(Vector3.UP).normalized(), -0.3)])
	return parts
func _build_colossus() -> void:
	var root := Node3D.new()
	root.name = "Colossus"
	add_child(root)
	roots["CO"] = root
	var c := Ch1Geo.CO_HEAD
	var wy := Ch1Geo.CO_WATER_Y
	# the head turns its veiled face toward the stones (and you), tipped a little as if sinking
	# the face turned west-south-west, toward the stones and toward you; tipped back, as if looking up
	var B := Basis(Vector3.UP, PI * 0.667) * Basis(Vector3.RIGHT, 0.32) * Basis(Vector3.BACK, 0.1)
	var M := Basis(Vector3.RIGHT, Vector3(0, -1, 0), Vector3.BACK)          # the water's mirror
	var hm := MB.new()
	var rm := MB.new()
	for p in _head_parts():
		var cen: Vector3 = B * (p[0] as Vector3)
		var pb: Basis = B * (p[2] as Basis)
		hm.sphere(cen, p[1], C(0.25), 24, 12, pb)
		# its reflection: the same shapes mirrored under the water line (a proper rotation: M B M)
		rm.sphere(M * cen, p[1], C(0.25), 16, 8, M * pb * M)
	var head := MeshInstance3D.new()
	head.mesh = hm.commit()
	head.material_override = level.marble_mat
	head.position = Vector3(c.x, wy, c.z)
	root.add_child(head)
	var refl := MeshInstance3D.new()
	refl.mesh = rm.commit()
	refl.material_override = level.marble_mat
	refl.position = Vector3(c.x, wy - 0.02, c.z)
	refl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(refl)
	# the still black water over the reflection
	var area := Vector4(6.8, -4.9, 22.4, 7.6)
	var wm := ShaderMaterial.new()
	wm.shader = preload("res://shaders/still_water.gdshader")
	wm.set_shader_parameter("noise_tex", level.noise_tex)
	wm.set_shader_parameter("area", area)
	var w := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(area.z - area.x, area.w - area.y)
	w.mesh = pm
	w.material_override = wm
	w.position = Vector3((area.x + area.z) * 0.5, wy, (area.y + area.w) * 0.5)
	w.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(w)
	# mist drifting low over it
	for i in 3:
		var mm := ShaderMaterial.new()
		mm.shader = preload("res://shaders/mist_drift.gdshader")
		mm.set_shader_parameter("noise_tex", level.noise_tex)
		mm.set_shader_parameter("density", 0.42 - i * 0.08)
		mm.set_shader_parameter("drift", Vector2(0.018 + i * 0.006, 0.006 - i * 0.004))
		var mi := MeshInstance3D.new()
		var mp := PlaneMesh.new()
		mp.size = Vector2(12.0, 10.0)
		mi.mesh = mp
		mi.material_override = mm
		mi.position = Vector3(c.x + (i - 1) * 1.6, wy + 0.35 + i * 0.45, c.z + 1.0 - i * 0.8)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(mi)

# ------------------------------------------------------------------ the Tree of Shards
const TS_SHARDS := 300
var shard_mm: MultiMeshInstance3D

func _build_tree() -> void:
	var root := Node3D.new()
	root.name = "TreeOfShards"
	add_child(root)
	roots["TS"] = root
	var base := Ch1Geo.TS_TREE + Vector3(0, 0.3, 0)
	# the dead white tree (the garden's trees, grown old and large)
	var m := MB.new()
	var r := RandomNumberGenerator.new()
	r.seed = 9001
	level._branch(m, r, base, Vector3(0.05, 1.0, -0.04).normalized(), 2.2, 0.3, 5, 0.25)      # (white marble)
	var tm := MeshInstance3D.new()
	tm.mesh = m.commit()
	tm.material_override = level.marble_mat
	root.add_child(tm)
	# the shards and their threads: one multimesh (a thread is an instance that does not turn)
	var q := ArrayMesh.new()
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	# a shard: an irregular sliver of glass, 0.14 x 0.24, hanging from its top
	var v := PackedVector3Array([Vector3(-0.06, 0, 0), Vector3(0.07, -0.02, 0), Vector3(0.02, -0.24, 0),
		Vector3(-0.06, 0, 0), Vector3(0.02, -0.24, 0), Vector3(-0.05, -0.15, 0)])
	arr[Mesh.ARRAY_VERTEX] = v
	q.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var t := ArrayMesh.new()
	var arr2 := []
	arr2.resize(Mesh.ARRAY_MAX)
	# a thread: a hair-thin strip 1 m long (scaled per instance), hanging down from its knot
	arr2[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(-0.008, 0, 0), Vector3(0.008, 0, 0), Vector3(0.008, -1, 0),
		Vector3(-0.008, 0, 0), Vector3(0.008, -1, 0), Vector3(-0.008, -1, 0)])
	t.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr2)
	var mat := ShaderMaterial.new()
	mat.shader = preload("res://shaders/shard_hang.gdshader")
	for kind in 2:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_custom_data = true
		mm.mesh = q if kind == 0 else t
		mm.instance_count = TS_SHARDS
		var rr := RandomNumberGenerator.new()
		rr.seed = 77
		for i in TS_SHARDS:
			# a knot somewhere in the crown, the shard hanging 0.2-0.7 m below it
			var a := rr.randf() * TAU
			var rad := sqrt(rr.randf()) * 2.3
			var knot := base + Vector3(cos(a) * rad, 3.4 + rr.randf() * 2.6 - rad * 0.35, sin(a) * rad * 0.9)
			var L := rr.randf_range(0.2, 0.7)
			var phase := rr.randf()
			var speed := rr.randf()
			if kind == 0:
				mm.set_instance_transform(i, Transform3D(Basis(), knot - Vector3(0, L, 0)))
			else:
				mm.set_instance_transform(i, Transform3D(Basis(Vector3.UP, a).scaled(Vector3(1, L, 1)), knot))
			mm.set_instance_custom_data(i, Color(phase, speed, 0.0, float(kind)))
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.material_override = mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(mi)
		if kind == 0: shard_mm = mi

# ------------------------------------------------------------------ the Upward Spring
func _build_spring() -> void:
	var root := Node3D.new()
	root.name = "UpwardSpring"
	add_child(root)
	roots["SP"] = root
	var b := Ch1Geo.SP_BASIN
	var m := MB.new()
	# a rock afloat in the fog, the basin on it
	m.cyl(b + Vector3(0, -1.3, 0), 2.6, 1.0, 2.6, C(0.0), 10)
	m.cyl(b + Vector3(0, -3.4, 0), 1.0, 0.25, 1.8, C(0.0), 8)
	m.cyl(b + Vector3(0, 0.25, 0), 1.9, 2.0, 0.5, C(0.25), 20)
	m.cyl(b + Vector3(0, 0.52, 0), 1.55, 1.55, 0.06, C(0.0), 20)
	# the temple above, upside down: its floor high in the fog, columns hanging, the pediment pointing down
	var top := b.y + 19.0
	m.box(Vector3(b.x, top, b.z), Vector3(6.4, 0.7, 4.6), C(0.25))
	m.box(Vector3(b.x, top - 0.45, b.z), Vector3(5.8, 0.2, 4.0), C(0.25))
	for ix in 4:
		for side in [-1.0, 1.0]:
			var cx := b.x - 2.4 + ix * 1.6
			m.cyl(Vector3(cx, top - 2.3, b.z + side * 1.55), 0.24, 0.27, 3.5, C(0.25), 10)
	m.box(Vector3(b.x, top - 4.25, b.z), Vector3(6.0, 0.45, 3.9), C(0.25))
	for k in 4:
		var w := 6.0 - k * 1.45
		m.box(Vector3(b.x, top - 4.6 - k * 0.32, b.z), Vector3(maxf(w, 0.4), 0.32, 3.6), C(0.25))
	var mi := MeshInstance3D.new()
	mi.mesh = m.commit()
	mi.material_override = level.marble_mat
	root.add_child(mi)
	# the water rising from the basin into the temple's pediment
	var col := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	var h := top - 5.6 - (b.y + 0.55)
	cm.height = h
	cm.top_radius = 0.3
	cm.bottom_radius = 0.7
	cm.radial_segments = 16
	cm.rings = 1
	cm.cap_top = false
	cm.cap_bottom = false
	col.mesh = cm
	var sm := ShaderMaterial.new()
	sm.shader = preload("res://shaders/spring_rise.gdshader")
	sm.set_shader_parameter("noise_tex", level.noise_tex)
	col.material_override = sm
	col.position = Vector3(b.x, b.y + 0.55 + h * 0.5, b.z)
	col.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(col)

# ------------------------------------------------------------------ per frame
## the wonder you stand in (by the floor's name)
func key_at(p: Vector3) -> String:
	var g := level.region_at(Vector2(p.x, p.z))
	if g == null: return ""
	match g.name:
		"CO": return "CO"
		"TS", "MZ_door": return "TS"          # (the way from the Court into the Maze passes it)
		"SPB": return "SP"
		"WK": if p.z > -35.5 and p.z < -28.5: return "SP"         # (the high walkway passes it)
	return ""

func update(dt: float) -> void:
	var p := game.player.position
	for k in roots:
		var r: Node3D = roots[k]
		var c: Vector3 = FOCUS[k][0]
		r.visible = Vector2(p.x - c.x, p.z - c.z).length() < SHOW_R
	var k2 := key_at(p) if (game.mode == "play" or game.mode == "wake") else ""
	if k2 != here:
		here = k2
		if here != "" and not game.visited.has("w:" + here):
			game.visited["w:" + here] = true          # (saved with the spaces you have seen)
			_label_t = 0.4
			game.sfx.swell()
			game.sfx.play("glass", -14.0, 0.6)
			_line_key = here
			_line_t = 3.2
	if _label_t > 0.0:
		_label_t -= dt
		if _label_t <= 0.0: game.ui.show_area(Names.WONDERS.get({"CO": "CO", "TS": "TS", "SP": "SPB"}[_line_key], ""))
	if _line_t > 0.0:
		_line_t -= dt
		if _line_t <= 0.0 and here == _line_key: game.ui.show_text(LINES[_line_key], p, 7.0)
	# the shards chime softly while you are near them
	if roots["TS"].visible:
		var d := p.distance_to(Ch1Geo.TS_TREE)
		if d < 9.0:
			_chime_t -= dt
			if _chime_t <= 0.0:
				_chime_t = randf_range(1.6, 4.2)
				game.sfx.play("glass_tink", -16.0 - d * 0.9, randf_range(1.5, 2.1))

## how the camera leans while you stand in a wonder (an offset for the follow target; zero elsewhere)
func lean(p: Vector3) -> Vector3:
	if here == "": return Vector3.ZERO
	var f: Array = FOCUS[here]
	var off: Vector3 = ((f[0] as Vector3) - p) * float(f[1])
	return off.limit_length(7.0)
