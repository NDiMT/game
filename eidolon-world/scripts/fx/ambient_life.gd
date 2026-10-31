class_name AmbientLife
## v1.0 M3c (Agent A) ambient life: drop-in builders. Each returns one node (one draw call), all motion on the GPU.
##   add_child(AmbientLife.moths(flame_pos))                        moths round a light
##   add_child(AmbientLife.petals(AABB(...), 60, wind))             petals / grit drifting through a box
##   var d := AmbientLife.drips([Vector3(...)], 2.4); add_child(d)  water drips + splash rings (d.splash signal)
##   add_child(AmbientLife.veils(top, 3, 1.6, wind, pole_mat))       torn veils on a pole, streaming in the wind
## Gusts: AmbientLife.set_gust(node, 0..1) pulses petals and veils (e.g. with the wind sound).
## Test: dev_fx/ambient_test.tscn.

const MOTHS := preload("res://shaders/moths.gdshader")
const PETALS := preload("res://shaders/petals.gdshader")
const DRIPS := preload("res://shaders/drips.gdshader")
const VEIL := preload("res://shaders/veil_strip.gdshader")

## moths round a light (a flame, a lamp): `count` of them, orbit radius ~`radius` m
static func moths(centre: Vector3, count := 5, radius := 0.38, seed := 0) -> MultiMeshInstance3D:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(centre) + seed
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	mm.mesh = q
	mm.instance_count = count
	for i in count:
		mm.set_instance_transform(i, Transform3D.IDENTITY)
		mm.set_instance_custom_data(i, Color(rng.randf(), rng.randf(), rng.randf(), rng.randf()))
	var m := ShaderMaterial.new()
	m.shader = MOTHS
	m.set_shader_parameter("radius", radius)
	var mi := MultiMeshInstance3D.new()
	mi.name = "Moths"
	mi.multimesh = mm
	mi.material_override = m
	mi.position = centre
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.custom_aabb = AABB(Vector3(-1, -0.6, -1) * (radius * 2.0 + 0.3), Vector3(2, 1.2, 2) * (radius * 2.0 + 0.3))
	return mi

## petals drifting through `box` (world space) on `wind` (m/s); `rose_share` of them faintly rose
static func petals(box: AABB, count := 60, wind := Vector3(1.1, 0.0, -0.45), rose_share := 0.2, size := 0.06) -> MultiMeshInstance3D:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(box.position)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	mm.mesh = q
	mm.instance_count = count
	for i in count:
		mm.set_instance_transform(i, Transform3D.IDENTITY)
		mm.set_instance_custom_data(i, Color(rng.randf(), rng.randf(), rng.randf(), rng.randf()))
	var m := ShaderMaterial.new()
	m.shader = PETALS
	m.set_shader_parameter("box_min", box.position)
	m.set_shader_parameter("box_size", box.size)
	m.set_shader_parameter("wind", wind)
	m.set_shader_parameter("rose_share", rose_share)
	m.set_shader_parameter("size", size)
	var mi := MultiMeshInstance3D.new()
	mi.name = "Petals"
	mi.multimesh = mm
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.custom_aabb = box.grow(0.2)
	return mi

## water drips from `points` (ceiling points, world space), each falling `height` m to the floor
static func drips(points: Array, height := 2.4, period_min := 1.6, period_max := 3.4) -> Drips:
	var d := Drips.new()
	d.setup(points, height, period_min, period_max)
	return d

## torn veils hanging from a bar at `top` (world space) on a thin pole down to `floor_y`
static func veils(top: Vector3, count := 3, length := 1.6, wind := Vector3(0.8, 0.0, -0.6), pole_mat: Material = null,
		floor_y := NAN, bar_len := 0.9, yaw := 0.0) -> Node3D:
	var root := Node3D.new()
	root.name = "Veils"
	root.position = top
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(top)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var B := Basis(Vector3.UP, yaw)
	var SEG := 12
	for k in count:
		var x0 := (float(k) - (count - 1) * 0.5) * (bar_len / float(maxi(count, 1)))
		var w := rng.randf_range(0.16, 0.26)
		var L := length * rng.randf_range(0.7, 1.05)
		var seed := rng.randf()
		for j in SEG:
			for c in [[0, j], [1, j], [1, j + 1], [0, j], [1, j + 1], [0, j + 1]]:
				var u := float(c[0]); var v := float(c[1]) / SEG
				st.set_color(Color(seed, L, 0.0, 1.0))
				st.set_uv(Vector2(u, v))
				st.add_vertex(B * Vector3(x0 + (u - 0.5) * w, -v * L, 0.0))
	var m := ShaderMaterial.new()
	m.shader = VEIL
	m.set_shader_parameter("wind_dir", wind)
	var cloth := MeshInstance3D.new()
	cloth.name = "Cloth"
	cloth.mesh = st.commit()
	cloth.material_override = m
	cloth.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	cloth.custom_aabb = AABB(Vector3(-2.2, -length - 0.4, -2.2), Vector3(4.4, length * 2.0 + 0.6, 4.4))
	root.add_child(cloth)
	# the pole and its cross-bar (optional: pass pole_mat, e.g. level.marble_mat with charcoal vertex colour)
	if pole_mat != null:
		var py := 0.0 if is_nan(floor_y) else floor_y - top.y
		var pm := MeshInstance3D.new()
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.03; cyl.bottom_radius = 0.04; cyl.height = -py + 0.12; cyl.radial_segments = 6
		pm.mesh = _tinted(cyl, 1.0)
		pm.material_override = pole_mat
		pm.position = B * Vector3(-bar_len * 0.5 - 0.04, py * 0.5 + 0.06, 0.0)
		root.add_child(pm)
		var bar := MeshInstance3D.new()
		var bx := BoxMesh.new()
		bx.size = Vector3(bar_len + 0.12, 0.04, 0.04)
		bar.mesh = _tinted(bx, 1.0)
		bar.material_override = pole_mat
		bar.basis = B
		bar.position = Vector3(0, 0.02, 0)
		root.add_child(bar)
	return root

## gusts: 0..1 on petals or veils (any node returned above)
static func set_gust(n: Node, g: float) -> void:
	var mi: GeometryInstance3D = n if n is GeometryInstance3D else n.get_node_or_null("Cloth")
	if mi and mi.material_override is ShaderMaterial:
		(mi.material_override as ShaderMaterial).set_shader_parameter("gust", g)

## a primitive with the marble vertex colour (r random, g = material id: 1.0 charcoal)
static func _tinted(pm: PrimitiveMesh, mat_id: float) -> ArrayMesh:
	var arr := pm.get_mesh_arrays()
	var n: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
	var cols := PackedColorArray()
	cols.resize(n)
	cols.fill(Color(0.5, mat_id, 0.0, 0.0))
	arr[Mesh.ARRAY_COLOR] = cols
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return am
