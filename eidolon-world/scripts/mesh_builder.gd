class_name MB
extends RefCounted
## Accumulates transformed primitives into ONE ArrayMesh (merged static geometry = one draw call).
## Every vertex carries a COLOR: r = random tint, g = material id, b = occluder flag (see marble.gdshader).

var v := PackedVector3Array()
var n := PackedVector3Array()
var c := PackedColorArray()
var uv := PackedVector2Array()
var idx := PackedInt32Array()

static var _cache := {}
## v0.7: every primitive's bounds are kept (the collision audit): [AABB, tag, round]. `tag` "floor" marks
## what you walk on (slabs, steps, undersides); the rest stands in the way unless it hangs overhead.
var tag := ""
var parts: Array = []
const _UNIT_BOX := AABB(Vector3(-0.5, -0.5, -0.5), Vector3.ONE)
const _UNIT_CYL := AABB(Vector3(-1.0, -0.5, -1.0), Vector3(2.0, 1.0, 2.0))
const _UNIT_SPH := AABB(Vector3(-1.0, -1.0, -1.0), Vector3(2.0, 2.0, 2.0))

static func col(mat: float, occ := false, rnd := -1.0) -> Color:
	return Color(randf() if rnd < 0.0 else rnd, mat, 1.0 if occ else 0.0, 1.0)

func add_arrays(a: Array, xf: Transform3D, color: Color) -> void:
	var base := v.size()
	var pv: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
	var pn: PackedVector3Array = a[Mesh.ARRAY_NORMAL]
	var puv = a[Mesh.ARRAY_TEX_UV]
	var nb := xf.basis.inverse().transposed()
	var flip := xf.basis.determinant() < 0.0
	for i in pv.size():
		v.append(xf * pv[i])
		n.append((nb * pn[i]).normalized())
		c.append(color)
		uv.append(puv[i] if puv != null and i < puv.size() else Vector2.ZERO)
	var pi = a[Mesh.ARRAY_INDEX]
	if pi == null:
		for i in pv.size(): idx.append(base + i)
	else:
		var ii: PackedInt32Array = pi
		if flip:
			for k in range(0, ii.size(), 3):
				idx.append(base + ii[k]); idx.append(base + ii[k + 2]); idx.append(base + ii[k + 1])
		else:
			for k in ii: idx.append(base + k)

static func prim_arrays(key: String, make: Callable) -> Array:
	if not _cache.has(key):
		var m: PrimitiveMesh = make.call()
		_cache[key] = m.get_mesh_arrays()
	return _cache[key]

## boxes carry COLOR.a = 1: the shader reads their face UVs to wear and bevel the edges
func box(center: Vector3, size: Vector3, color: Color, basis := Basis()) -> void:
	var a := prim_arrays("box", func() -> PrimitiveMesh: return BoxMesh.new())
	var c := color
	c.a = 1.0
	var xf := Transform3D(basis * Basis.from_scale(size), center)
	add_arrays(a, xf, c)
	parts.append([xf * _UNIT_BOX, tag, false, xf])      # (the transform: a turned box's true footprint)

func cyl(center: Vector3, r_top: float, r_bot: float, h: float, color: Color, segs := 12, basis := Basis()) -> void:
	var R := maxf(maxf(r_top, r_bot), 0.001)
	var tt := snappedf(r_top / R, 0.01)
	var bb := snappedf(r_bot / R, 0.01)
	var key := "cyl%d_%.2f_%.2f" % [segs, tt, bb]
	var a := prim_arrays(key, func() -> PrimitiveMesh:
		var m := CylinderMesh.new()
		m.top_radius = tt; m.bottom_radius = bb; m.height = 1.0
		m.radial_segments = segs; m.rings = 1
		return m)
	var c := color
	c.a = 0.0
	var xf := Transform3D(basis * Basis.from_scale(Vector3(R, h, R)), center)
	add_arrays(a, xf, c)
	parts.append([xf * _UNIT_CYL, tag, true])

func sphere(center: Vector3, radii: Vector3, color: Color, segs := 12, rings := 6, basis := Basis()) -> void:
	var a := prim_arrays("sph%d_%d" % [segs, rings], func() -> PrimitiveMesh:
		var m := SphereMesh.new()
		m.radius = 1.0; m.height = 2.0; m.radial_segments = segs; m.rings = rings
		return m)
	var c := color
	c.a = 0.0
	var xf := Transform3D(basis * Basis.from_scale(radii), center)
	add_arrays(a, xf, c)
	parts.append([xf * _UNIT_SPH, tag, true])

## Quad lying in a plane (for flat details). size in local x/y, faces local +z.
func quad(center: Vector3, size: Vector2, color: Color, basis := Basis()) -> void:
	var a := prim_arrays("quad", func() -> PrimitiveMesh: return QuadMesh.new())
	add_arrays(a, Transform3D(basis * Basis.from_scale(Vector3(size.x, size.y, 1.0)), center), color)

func is_empty() -> bool:
	return v.is_empty()

## v0.8: two surfaces: 0 the stone that never hides the wanderer, 1 the possible occluders (COLOR.b = 1),
## which take the see-through's alpha-faded marble (surface 1 is absent when there are none)
func commit_split() -> ArrayMesh:
	var i0 := PackedInt32Array()
	var i1 := PackedInt32Array()
	for k in range(0, idx.size(), 3):
		var o := c[idx[k]].b > 0.5
		var dst := i1 if o else i0
		dst.append(idx[k]); dst.append(idx[k + 1]); dst.append(idx[k + 2])
		if o: i1 = dst
		else: i0 = dst
	var m := ArrayMesh.new()
	for ii in [i0, i1]:
		if ii.is_empty(): continue
		var arr := []
		arr.resize(Mesh.ARRAY_MAX)
		arr[Mesh.ARRAY_VERTEX] = v
		arr[Mesh.ARRAY_NORMAL] = n
		arr[Mesh.ARRAY_COLOR] = c
		arr[Mesh.ARRAY_TEX_UV] = uv
		arr[Mesh.ARRAY_INDEX] = ii
		m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		m.surface_set_name(m.get_surface_count() - 1, "occ" if ii == i1 and not i1.is_empty() else "stone")
	m.set_meta("parts", parts)
	return m

func commit() -> ArrayMesh:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v
	arr[Mesh.ARRAY_NORMAL] = n
	arr[Mesh.ARRAY_COLOR] = c
	arr[Mesh.ARRAY_TEX_UV] = uv
	arr[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	m.set_meta("parts", parts)
	return m
