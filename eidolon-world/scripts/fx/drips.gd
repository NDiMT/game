class_name Drips
extends MultiMeshInstance3D
## v1.0 M3c (Agent A) water drips with tiny splash rings (one draw call). Built by AmbientLife.drips(points, h).
## The shader's clock is driven from here, so `splash(pos)` fires exactly when a drop lands (for a sound:
## connect it to a quiet "drip" cue; the splashes are 1.6-3.4 s apart per point).

signal splash(pos: Vector3)

var clock := 0.0
var _pts: Array[Vector3] = []
var _h: Array[float] = []
var _period: Array[float] = []
var _phase: Array[float] = []
var _last: Array[float] = []

func setup(points: Array, height: float, period_min: float, period_max: float) -> void:
	name = "Drips"
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242 + points.size()
	# two quads: the drop (COLOR.r 0) and the ring (COLOR.r 1)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for part in [0.0, 1.0]:
		for c in [Vector2(-0.5, -0.5), Vector2(0.5, -0.5), Vector2(0.5, 0.5), Vector2(-0.5, -0.5), Vector2(0.5, 0.5), Vector2(-0.5, 0.5)]:
			st.set_color(Color(part, 0, 0, 1))
			st.set_uv(c + Vector2(0.5, 0.5))
			st.add_vertex(Vector3(c.x, c.y, 0.0))
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = st.commit()
	mm.instance_count = points.size()
	var lo := Vector3.INF; var hi := -Vector3.INF
	for i in points.size():
		var p: Vector3 = points[i]
		var per := rng.randf_range(period_min, period_max)
		var ph := rng.randf()
		_pts.append(p); _h.append(height); _period.append(per); _phase.append(ph); _last.append(-1.0)
		mm.set_instance_transform(i, Transform3D(Basis.IDENTITY, p))
		mm.set_instance_custom_data(i, Color(height, per, ph, 0.0))
		lo = lo.min(p); hi = hi.max(p)
	multimesh = mm
	var m := ShaderMaterial.new()
	m.shader = AmbientLife.DRIPS
	material_override = m
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# (instances carry their own world positions; the node stays at the origin)
	custom_aabb = AABB(lo - Vector3(0.4, height + 0.2, 0.4), hi - lo + Vector3(0.8, height + 0.4, 0.8))

func _process(dt: float) -> void:
	clock += dt
	if clock > 3600.0: clock -= 3600.0
	(material_override as ShaderMaterial).set_shader_parameter("clock", clock)
	for i in _pts.size():
		# the same formula as the shader: time since let-go, landing at the fall time
		var tl := fposmod(clock / _period[i] + _phase[i], 1.0) * _period[i]
		var tf := sqrt(2.0 * _h[i] / 9.81)
		var landed := tl >= tf
		if landed and _last[i] < tf and _last[i] >= 0.0:
			splash.emit(_pts[i] - Vector3(0, _h[i], 0))
		_last[i] = tl
