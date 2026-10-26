extends Node
## v0.9.1 flicker hunt (headless): every world-space triangle of the visible meshes within RADIUS of a spot
## (zone meshes, props, puzzle pieces, multimesh stone, decals, quads), then every pair of triangles that
## lie in the same plane (normals parallel, planes within EPS) and overlap (by more than a sliver): the
## z-fighting candidates. Pairs between different meshes, and inside one merged mesh. Transparent quads
## within 1 cm of another surface are listed too. Usage: godot --headless --path . res://tests/zfight.tscn -- x,y,z[,radius]
const EPS := 0.002
const RADIUS := 6.0
var BACK := Framing.basis().z
var tris: Array = []          # [a, b, c, n, d, owner, transparent]

func _ready() -> void:
	Game.autotest = true
	var game: Game = load("res://scenes/main.tscn").instantiate()
	add_child(game)
	await get_tree().process_frame
	await get_tree().process_frame
	var args := OS.get_cmdline_user_args()
	var spots: Array = []
	for a in args:
		var v := a.split(",")
		if v.size() >= 3: spots.append([Vector3(float(v[0]), float(v[1]), float(v[2])), float(v[3]) if v.size() > 3 else RADIUS])
	if spots.is_empty(): spots = [[Vector3(-4.6, 1.0, -13.5), RADIUS]]
	for sp in spots:
		tris.clear()
		_collect(game, game.player, sp[0], sp[1], game.level)
		print("ZF spot %s r %.1f: %d triangles" % [sp[0], sp[1], tris.size()])
		_pairs()
	get_tree().quit()

func _is_transparent(m: Material) -> bool:
	if m is ShaderMaterial and (m as ShaderMaterial).shader:
		var code := (m as ShaderMaterial).shader.code
		return code.contains("blend_") or code.contains("ALPHA")
	if m is StandardMaterial3D: return (m as StandardMaterial3D).transparency != BaseMaterial3D.TRANSPARENCY_DISABLED
	return false

func _collect(n: Node, skip: Node, c: Vector3, r: float, lv: Level) -> void:
	if n == skip: return
	if n is Node3D and not (n as Node3D).is_visible_in_tree(): return
	if n is CanvasItem or n is CanvasLayer or n is SubViewport: return
	if n is GeometryInstance3D and ((n as VisualInstance3D).layers & PlanarMirror.MAIN_MASK) != 0:
		var xfs: Array = []
		var mesh: Mesh = null
		if n is MeshInstance3D:
			mesh = (n as MeshInstance3D).mesh
			xfs = [(n as MeshInstance3D).global_transform]
		elif n is MultiMeshInstance3D and (n as MultiMeshInstance3D).multimesh:
			var src: Array = {"Columns": lv.col_full, "Stumps": lv.col_stump, "Debris": lv.debris}.get(str(n.get_parent().name), [])
			mesh = (n as MultiMeshInstance3D).multimesh.mesh
			for x: Transform3D in src: xfs.append((n.get_parent() as Node3D).global_transform * x)
		if mesh:
			var gi := n as GeometryInstance3D
			var mat: Material = gi.material_override
			if mat == null and n is MeshInstance3D and mesh.get_surface_count() > 0:
				mat = (n as MeshInstance3D).get_surface_override_material(0)
				if mat == null: mat = mesh.surface_get_material(0)
			var tr := _is_transparent(mat)
			var mname: String = (mat.shader.resource_path.get_file() if mat is ShaderMaterial and (mat as ShaderMaterial).shader else str(mat))
			var faces := mesh.get_faces()
			var owner := "%s/%s" % [n.get_parent().name, n.name]
			for xf: Transform3D in xfs:
				if xf.origin.distance_to(c) > r + mesh.get_aabb().size.length() + 2.0: continue
				for i in range(0, faces.size(), 3):
					var a: Vector3 = xf * faces[i]; var b: Vector3 = xf * faces[i + 1]; var cc: Vector3 = xf * faces[i + 2]
					var ctr := (a + b + cc) / 3.0
					if ctr.distance_to(c) > r: continue
					var nn := (cc - a).cross(b - a)        # (Godot: clockwise front faces)
					if nn.length() < 1e-8: continue
					nn = nn.normalized()
					tris.append([a, b, cc, nn, nn.dot(a), owner, tr, mname])
	for ch in n.get_children(): _collect(ch, skip, c, r, lv)

## buckets by plane (normal up to sign, offset); overlap in the plane with a 1 mm shrink (shared edges are not overlaps)
func _pairs() -> void:
	var buckets := {}
	for i in tris.size():
		var t: Array = tris[i]
		var n: Vector3 = t[3]
		var d: float = t[4]
		# canonical sign
		if n.x < -1e-4 or (absf(n.x) <= 1e-4 and (n.y < -1e-4 or (absf(n.y) <= 1e-4 and n.z < 0.0))): n = -n; d = -d
		var key := Vector4i(roundi(n.x * 40), roundi(n.y * 40), roundi(n.z * 40), roundi(d / 0.01))
		if not buckets.has(key): buckets[key] = []
		buckets[key].append([i, n, d])
	var found := {}
	var out := 0
	for key in buckets:
		var cand: Array = []
		for dx in [-1, 0, 1]:
			var k2 := Vector4i(key.x, key.y, key.z, key.w + dx)
			if buckets.has(k2):
				for e in buckets[k2]: if dx >= 0 or true: cand.append(e)
		# (a sweep along one in-plane axis: only boxes that overlap there are tested)
		var n0: Vector3 = (cand[0][1] as Vector3)
		var u := n0.cross(Vector3.UP if absf(n0.y) < 0.9 else Vector3.RIGHT).normalized()
		var own := {}
		for e in buckets[key]: own[e[0]] = true
		var iv: Array = []
		for e in cand:
			var t: Array = tris[e[0]]
			var a0 := minf((t[0] as Vector3).dot(u), minf((t[1] as Vector3).dot(u), (t[2] as Vector3).dot(u)))
			var a1 := maxf((t[0] as Vector3).dot(u), maxf((t[1] as Vector3).dot(u), (t[2] as Vector3).dot(u)))
			iv.append([a0, a1, e])
		iv.sort_custom(func(p: Array, q: Array) -> bool: return p[0] < q[0])
		for ia in iv.size():
			var A: Array = iv[ia]
			var e1: Array = A[2]
			for ib in range(ia + 1, iv.size()):
				var Bv: Array = iv[ib]
				if Bv[0] >= A[1]: break
				var e2: Array = Bv[2]
				if not (own.has(e1[0]) or own.has(e2[0])): continue
				if not own.has(e1[0]) and own.has(e2[0]) and false: continue
				var n1: Vector3 = e1[1]; var n2: Vector3 = e2[1]
				var t1: Array = tris[e1[0]]; var t2: Array = tris[e2[0]]
				var tol := 0.01 if (t1[6] or t2[6]) else EPS
				if n1.dot(n2) < 0.9995 or absf(float(e1[2]) - float(e2[2])) > tol: continue
				if not (t1[6] or t2[6]) and (t1[3] as Vector3).dot(t2[3]) < 0.0: continue
				if (t1[3] as Vector3).dot(BACK) < 0.02 and (t2[3] as Vector3).dot(BACK) < 0.02: continue
				if not _overlap(t1, t2, n1): continue
				var tag := "%s | %s" % [t1[5], t2[5]]
				var kind := "TRANSPARENT" if (t1[6] or t2[6]) else "COPLANAR"
				var ck := kind + tag
				if found.has(ck):
					found[ck][0] += 1
					continue
				found[ck] = [1, kind, tag, (t2[0] + t2[1] + t2[2]) / 3.0, float(e1[2]) - float(e2[2]), n1, t1[7], t2[7], _bb(t1), _bb(t2)]
				out += 1
	for k in found:
		var f: Array = found[k]
		print("ZF %s %d pairs  %s  at %s  gap %.4f m  n %s  [%s | %s]  boxes %s | %s" % [f[1], f[0], f[2], (f[3] as Vector3).snapped(Vector3.ONE * 0.01), f[4], (f[5] as Vector3).snapped(Vector3.ONE * 0.01), f[6], f[7], f[8], f[9]])
	print("ZF %d kinds of overlapping coplanar pairs" % out)

func _bb(t: Array) -> String:
	var lo: Vector3 = (t[0] as Vector3).min(t[1]).min(t[2]); var hi: Vector3 = (t[0] as Vector3).max(t[1]).max(t[2])
	return "%s..%s" % [lo.snapped(Vector3.ONE * 0.01), hi.snapped(Vector3.ONE * 0.01)]

func _overlap(t1: Array, t2: Array, n: Vector3) -> bool:
	# project to 2D in the plane, shrink each triangle 1 mm toward its centroid, SAT
	var u := n.cross(Vector3.UP if absf(n.y) < 0.9 else Vector3.RIGHT).normalized()
	var v := n.cross(u)
	var A: Array = []; var B: Array = []
	for k in 3:
		A.append(Vector2((t1[k] as Vector3).dot(u), (t1[k] as Vector3).dot(v)))
		B.append(Vector2((t2[k] as Vector3).dot(u), (t2[k] as Vector3).dot(v)))
	A = _shrink(A); B = _shrink(B)
	for P in [A, B]:
		for k in 3:
			var e: Vector2 = P[(k + 1) % 3] - P[k]
			var ax := Vector2(-e.y, e.x)
			var a0 := INF; var a1 := -INF; var b0 := INF; var b1 := -INF
			for q in A: var s := ax.dot(q); a0 = minf(a0, s); a1 = maxf(a1, s)
			for q in B: var s2 := ax.dot(q); b0 = minf(b0, s2); b1 = maxf(b1, s2)
			if a1 <= b0 or b1 <= a0: return false
	return true

func _shrink(P: Array) -> Array:
	var c: Vector2 = (P[0] + P[1] + P[2]) / 3.0
	var o := []
	for q: Vector2 in P:
		var d := q - c
		o.append(c + d * maxf(0.0, (d.length() - 0.001)) / maxf(d.length(), 1e-6))
	return o
