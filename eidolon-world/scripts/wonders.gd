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
	"CO": "He carved her face so large\nthe sea itself could not forget it.\nIt was still the wrong face.",
	"TS": "Every face he broke, he hung here,\nso that each would catch the light\nonce more.",
	"SP": "Up there, they say, the rain falls upward\nand the dead look down into the water\nto see the living.",
}
## where the camera leans on arrival (the thing to look at), and how far (0..1)
const FOCUS := {"CO": [Map2.O + Map2.OBSERVER + Vector3(0, 2.0, 0), 0.45], "TS": [Ch1Geo.TS_TREE + Vector3(0, 3.6, 0), 0.5],
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
	# (v2: the Sunken Colossus is the Observer, A's veiled head in the inlet: Map2.pieces / Dress.observer)
	_build_tree()
	_build_spring()

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
	# (the owner's Tripo temple when it is there: assets/models/props/temple_small.glb, turned over)
	var top := b.y + 19.0
	var tmodel := _model_temple(root, Vector3(b.x, top, b.z))
	if not tmodel:
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

const TEMPLE_MODEL := "temple_small"
const TEMPLE_W := 6.4
## the Tripo temple turned upside down, its floor at `top` (about 6.4 m across, about 5.6 m tall)
func _model_temple(root: Node3D, top: Vector3) -> bool:
	if not ResourceLoader.exists(Props.DIR + TEMPLE_MODEL + ".glb"): return false
	var pm := Props._mesh(TEMPLE_MODEL)
	if pm.is_empty(): return false
	var mesh: ArrayMesh = pm[0]
	var bb: AABB = pm[1]
	var k := TEMPLE_W / maxf(maxf(bb.size.x, bb.size.z), 0.001)
	var B := Basis(Vector3.RIGHT, PI) * Basis.from_scale(Vector3.ONE * k)       # turned over
	# its floor (the AABB's bottom, now on top) at `top`
	var o := top - B * Vector3(bb.get_center().x, bb.position.y, bb.get_center().z)
	var mi := MeshInstance3D.new()
	mi.name = "Temple"
	mi.mesh = mesh
	mi.material_override = level.marble_mat
	mi.transform = Transform3D(B, o)
	root.add_child(mi)
	return true

# ------------------------------------------------------------------ per frame
## the wonder you stand in (by the floor's name)
func key_at(p: Vector3) -> String:
	var g := level.region_at(Vector2(p.x, p.z))
	if g == null: return ""
	match g.name:
		"CO", "V2_W7": return "CO"
		"TS", "MZ_door": return "TS"          # (the way from the Court into the Maze passes it)
		"SPB": return "SP"
		"WK": if p.z - Map2.GE.z > -35.5 and p.z - Map2.GE.z < -28.5: return "SP"         # (the high walkway passes it)
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
