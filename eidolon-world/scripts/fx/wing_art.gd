class_name WingArt
## v3 (Agent A, a4) the look for W's phase 3 placeholders (West + North wings), in the Still Room's language
## (StillRoomFx / still_props.gdshader: aged bronze and silver, crimson enamel accents). One call, after every beat's post():
##   WingArt.dress_all(game)     swaps by name in game.ch.pz (idempotent; a missing beat or node is skipped)
## Every swap keeps W's nodes, materials and tweens: meshes are replaced in place, textures and rims are added to W's
## own materials, old meshes are hidden (not freed). No new marble instances: marble pieces are re-meshed in place.
##   N4_Gate_W/E    bronze leaf frame (posts with crimson finials, rails, a came border round W's pane)
##   N4_DoorPane    bronze diamond leading over W's pane
##   W3_Shard       a faceted sliver (W's material)          W3_Ghost_*   the real thing's own meshes, W's pale material + a rim
##   W5_Shadow_*    a veiled head-and-shoulders silhouette (head centre at the eye's height)
##   N7_Print       foot-shaped prints (hers small, toes; his long, broad)
##   N6_Tree        a dead tree of tapered limbs (marble, same trunk footprint)    N6_Shards   faceted slivers (MultiMesh)
##   N5_Mirror_*    a silver frame and crest round each swivel glass, bronze pivots
##   N1_Stone_*     worn stepping stones (a cap stepped in from the body)          NG_Bench   a carved bench, same footprint

static func dress_all(game: Game) -> void:
	var ch: Variant = game.get("ch")
	if ch == null: return
	var pz: Dictionary = ch.get("pz")
	for id in pz:
		var p: Node3D = pz[id]
		if p.has_meta("a4_dressed"): continue
		p.set_meta("a4_dressed", true)
		for c in p.get_children(): _dress(c, p, game)

static func _dress(c: Node, p: Node3D, game: Game) -> void:
	var nm := str(c.name)
	if nm.begins_with("N4_Gate_"): _gate(c as Node3D)
	elif nm == "N4_DoorPane": _door_pane(c as Node3D)
	elif nm == "W3_Shard": _shard_node(c as Node3D)
	elif nm.begins_with("W3_Ghost_"): _ghost(c as Node3D, p)
	elif nm.begins_with("W5_Shadow_"): _tex(c, head_tex())
	elif nm == "N7_Print": _print(c as MeshInstance3D)
	elif nm == "N6_Shards": (c as MultiMeshInstance3D).multimesh.mesh = shard_mesh(Vector2(0.07, 0.15), 0.008, 5)
	elif nm == "N6_Tree":
		var T: Variant = (p.get_script() as Script).get_script_constant_map().get("TREE")
		if T is Vector3: _remesh_marble(c as MeshInstance3D, game, tree_mesh(T))
	elif nm.begins_with("N5_Mirror_"): _swivel(c as Node3D)
	elif nm.begins_with("N1_Stone_"): _stone(c as Node3D, game)
	elif nm == "NG_Bench": _remesh_marble(c as MeshInstance3D, game, bench_mesh(c as MeshInstance3D, game))

# ------------------------------------------------------------------ helpers
static func _c(m: float, hollow := 0.0) -> Color: return StillRoomFx._c(m, hollow)

static func _mesh(parent: Node3D, mesh: Mesh, like: Node = null) -> MeshInstance3D:
	var mi := StillRoomFx._mesh(parent, mesh, StillRoomFx.mat(), false)
	if like is VisualInstance3D: mi.layers = (like as VisualInstance3D).layers
	return mi

static func _remesh_marble(mi: MeshInstance3D, game: Game, mesh: Mesh) -> void:
	if mi == null or mesh == null: return
	mi.mesh = MB.split_occ(mesh)
	for si in mi.mesh.get_surface_count():
		mi.set_surface_override_material(si, game.level.marble_occ_mat if mi.mesh.surface_get_name(si) == "occ" else game.level.marble_mat)

static func _tex(c: Node, t: Texture2D) -> void:
	var mi := c as MeshInstance3D
	if mi and mi.material_override is StandardMaterial3D: (mi.material_override as StandardMaterial3D).albedo_texture = t

## a segment from a to b (tapered r0 -> r1) into the builder
static func _limb(m: MB, a: Vector3, b: Vector3, r0: float, r1: float, col: Color, segs := 7) -> void:
	var d := b - a
	var y := d.normalized()
	var x := y.cross(Vector3.FORWARD if absf(y.z) < 0.9 else Vector3.RIGHT).normalized()
	m.cyl((a + b) * 0.5, r1, r0, d.length(), col, segs, Basis(x, y, x.cross(y)))

# ------------------------------------------------------------------ N.4: the gates and the door's pane
static func _gate(n: Node3D) -> void:
	var len := 0.0
	for mi in StillRoomFx._hide_meshes(n):
		if (mi as MeshInstance3D).mesh: len = maxf(len, (mi as MeshInstance3D).mesh.get_aabb().size.z)
	if len <= 0.0: return
	# (the pane stays: it is a QuadMesh child that is not marble; _hide_meshes hid it too)
	for ch in n.get_children():
		if ch is MeshInstance3D and (ch as MeshInstance3D).mesh is QuadMesh: (ch as MeshInstance3D).visible = true
	var m := MB.new()
	var hz := len * 0.5 - 0.05
	for s in [-1.0, 1.0]:
		m.box(Vector3(0, 1.09, s * hz), Vector3(0.1, 2.14, 0.1), _c(StillRoomFx.BRONZE, 0.35))                 # the post
		m.box(Vector3(0, 0.0415, s * hz), Vector3(0.16, 0.077, 0.16), _c(StillRoomFx.BRONZE, 0.6))             # its foot (3 mm up)
		m.cyl(Vector3(0, 2.195, s * hz), 0.03, 0.055, 0.08, _c(StillRoomFx.BRONZE, 0.2), 10)                    # the finial
		m.sphere(Vector3(0, 2.285, s * hz), Vector3(0.045, 0.045, 0.045), _c(StillRoomFx.ENAMEL), 10, 6)      # crimson bead
	m.box(Vector3(0, 0.07, 0), Vector3(0.09, 0.1, len - 0.21), _c(StillRoomFx.BRONZE, 0.5))                    # bottom rail
	m.box(Vector3(0, 2.03, 0), Vector3(0.09, 0.09, len - 0.21), _c(StillRoomFx.BRONZE, 0.3))                   # top rail
	# the came round the pane (W's pane: YZ plane, (len - 0.2) x 1.86 at y 1.05): a thin bead each side of it
	# (each bar straddles the pane: its faces 12-14 mm off the glass, never within the 1 cm the zfight test flags)
	m.box(Vector3(0, 1.05, 0), Vector3(0.024, 1.80, 0.035), _c(StillRoomFx.BRONZE, 0.1))                        # (a mid bar)
	for sy in [-1.0, 1.0]:
		m.box(Vector3(0, 1.05 + sy * 0.915, 0), Vector3(0.028, 0.03, len - 0.25), _c(StillRoomFx.BRONZE, 0.0))
	_mesh(n, m.commit())

static func _door_pane(n: Node3D) -> void:
	var q: MeshInstance3D = null
	for ch in n.get_children(): if ch is MeshInstance3D: q = ch
	if q == null or not (q.mesh is QuadMesh): return
	var sz := (q.mesh as QuadMesh).size
	var root := Node3D.new()
	root.name = "Leading"
	root.transform = q.transform          # (quad space: x along the pane, y up, z through it)
	n.add_child(root)
	var m := MB.new()
	var h := sz * 0.5
	for s in [-1.0, 1.0]:
		m.box(Vector3(s * (h.x - 0.095), 0, 0), Vector3(0.05, sz.y, 0.05), _c(StillRoomFx.BRONZE, 0.45))   # (the pane runs into the jambs: stiles 2.7 cm clear)
		m.box(Vector3(0, s * (h.y - 0.02), 0), Vector3(sz.x - 0.1, 0.05, 0.042), _c(StillRoomFx.BRONZE, 0.45))
	# diamond leading: two families of diagonal cames, clipped to the pane by length
	var pitch := 0.42
	for fam in [-1.0, 1.0]:
		var dir := Vector2(1.0, fam * 1.6).normalized()
		var nrm := Vector2(-dir.y, dir.x)
		for k in range(-8, 9):
			var o := nrm * (k * pitch * 0.62)
			# the chord of the line o + t*dir inside the pane's box
			var t0 := -INF
			var t1 := INF
			for ax in 2:
				if absf(dir[ax]) < 1e-4: continue
				var ta := (-h[ax] + 0.04 - o[ax]) / dir[ax]
				var tb := (h[ax] - 0.04 - o[ax]) / dir[ax]
				t0 = maxf(t0, minf(ta, tb))
				t1 = minf(t1, maxf(ta, tb))
			if t1 - t0 < 0.08: continue
			var c := o + dir * (t0 + t1) * 0.5
			var ang := atan2(dir.y, dir.x)
			m.box(Vector3(c.x, c.y, 0.0), Vector3(t1 - t0, 0.012, 0.028 + 0.004 * fam), _c(StillRoomFx.BRONZE, 0.15), Basis(Vector3.BACK, ang))
	m.sphere(Vector3(0, h.y - 0.14, 0), Vector3(0.05, 0.05, 0.03), _c(StillRoomFx.ENAMEL), 10, 6)
	_mesh(root, m.commit(), q)

# ------------------------------------------------------------------ W.3: the Shard, her memories of the things
## a faceted sliver: an irregular outline (size) bulged to an off-centre ridge on each face
static func shard_mesh(size: Vector2, thick: float, seed_i: int) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_i
	var pts := PackedVector2Array([Vector2(0.0, 0.5), Vector2(0.3, 0.16), Vector2(0.5, -0.12), Vector2(0.14, -0.5), Vector2(-0.26, -0.36), Vector2(-0.42, 0.06)])
	for i in pts.size(): pts[i] = (pts[i] + Vector2(rng.randf_range(-0.06, 0.06), rng.randf_range(-0.05, 0.05))) * size
	var apex := Vector2(rng.randf_range(-0.1, 0.1), rng.randf_range(0.0, 0.15)) * size
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_smooth_group(0xFFFFFFFF)          # (flat facets)
	for side in [1.0, -1.0]:
		var ap := Vector3(apex.x, apex.y, thick * side)
		for i in pts.size():
			var a := Vector3(pts[i].x, pts[i].y, 0.0)
			var b := Vector3(pts[(i + 1) % pts.size()].x, pts[(i + 1) % pts.size()].y, 0.0)
			if side > 0.0:
				st.add_vertex(a); st.add_vertex(b); st.add_vertex(ap)
			else:
				st.add_vertex(b); st.add_vertex(a); st.add_vertex(ap)
	st.generate_normals()
	return st.commit()

static func _shard_node(n: Node3D) -> void:
	for ch in n.get_children():
		if ch is MeshInstance3D and (ch as MeshInstance3D).mesh is PrismMesh:
			var mi := ch as MeshInstance3D
			mi.mesh = shard_mesh(Vector2(0.17, 0.36), 0.016, 31)
			var sm := mi.material_override as StandardMaterial3D
			if sm: sm.cull_mode = BaseMaterial3D.CULL_DISABLED
			if sm and sm.next_pass == null: sm.next_pass = rim_mat(Color(1.0, 0.35, 0.4), 0.9)

## her memory of a thing = the thing's own meshes, in W's pale material (+ a crimson-white rim)
static func _ghost(g: Node3D, p: Node3D) -> void:
	var k := str(g.name).trim_prefix("W3_Ghost_")
	var nodes: Variant = p.get("nodes")
	if not (nodes is Dictionary) or not (nodes as Dictionary).has(k): return
	var real: Node3D = nodes[k]
	var old: MeshInstance3D = null
	for ch in g.get_children(): if ch is MeshInstance3D: old = ch
	if old == null: return
	var m := old.material_override as StandardMaterial3D
	if m == null: return
	var src: Array = real.find_children("*", "MeshInstance3D", true, false)
	if real is MeshInstance3D: src.append(real)
	var inv := real.global_transform.affine_inverse()
	var made := 0
	for s in src:
		var smi := s as MeshInstance3D
		# (marble and Tripo meshes carry no override; a flame's / glow's quads do)
		if smi.mesh == null or not smi.visible or smi.material_override != null or smi.mesh is QuadMesh or smi.mesh is PlaneMesh: continue
		var mi := MeshInstance3D.new()
		mi.mesh = smi.mesh
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.layers = old.layers
		mi.transform = inv * smi.global_transform
		g.add_child(mi)
		made += 1
	if made > 0: old.visible = false
	if m.next_pass == null: m.next_pass = rim_mat(Color(1.0, 0.82, 0.86), 0.7)

static var _rim_sh: Shader
static func rim_mat(col: Color, k: float) -> ShaderMaterial:
	if _rim_sh == null:
		_rim_sh = Shader.new()
		_rim_sh.code = RIM_SH
	var r := ShaderMaterial.new()
	r.shader = _rim_sh
	r.set_shader_parameter("col", col)
	r.set_shader_parameter("k", k)
	return r

const RIM_SH := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_back, shadows_disabled, fog_disabled;
global uniform vec4 accent;
uniform vec4 col : source_color = vec4(1.0);
uniform float k = 0.7;
void fragment() {
	float f = pow(1.0 - clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0), 2.5);
	ALBEDO = mix(col.rgb, accent.rgb, 0.35 * f) * f * k;
}
"""

# ------------------------------------------------------------------ textures (made once; tiny)
static var _head: ImageTexture
static var _print_t := {}

## W.5: a veiled head and shoulders, dark, soft-edged; the head's centre (the eyes) at v 0.36
static func head_tex() -> ImageTexture:
	if _head: return _head
	var W := 64
	var H := 84
	var img := Image.create(W, H, false, Image.FORMAT_RGBA8)
	for y in H:
		for x in W:
			var u := (x + 0.5) / W
			var v := (y + 0.5) / H
			var d := Vector2((u - 0.5) / 0.2, (v - 0.36) / 0.25).length() - 1.0           # the head
			var veil := maxf(absf(u - 0.5) - (0.165 + (v - 0.36) * 0.12), -(v - 0.4))      # the veil, falling close to the neck
			d = minf(d, veil / 0.2)
			var sh := Vector2((u - 0.5) / 0.5, (v - 1.02) / 0.22).length() - 1.0         # the shoulders
			d = minf(d, sh)
			var a := clampf(0.5 - d * 3.0, 0.0, 1.0) * 0.82 * (1.0 - smoothstep(0.86, 1.0, v) * 0.6)
			img.set_pixel(x, y, Color(0.02, 0.015, 0.025, a))
	img.generate_mipmaps()
	_head = ImageTexture.create_from_image(img)
	return _head

## N.7: a bare footprint (white; W's colour and alpha tint it). his = long and broad, the toes run together
static func print_tex(his: bool) -> ImageTexture:
	if _print_t.has(his): return _print_t[his]
	var W := 32
	var H := 64
	var img := Image.create(W, H, false, Image.FORMAT_RGBA8)
	for y in H:
		for x in W:
			var u := (x + 0.5) / W - 0.5
			var v := (y + 0.5) / H
			var ball := Vector2((u + 0.03) / 0.36, (v - 0.34) / 0.17).length()
			var heel := Vector2(u / 0.27, (v - 0.82) / 0.14).length()
			var arch := Vector2((u - 0.08 * (v - 0.55)) / (0.2 + 0.08 * (1.0 - smoothstep(0.45, 0.7, v))), 0.0).length() + (0.0 if v > 0.34 and v < 0.84 else 9.0)
			var d := minf(minf(ball, heel), arch)
			var a := clampf((1.0 - d) * 6.0, 0.0, 1.0)
			# the toes: five small pads in an arc (his: a broad blur)
			for t in 5:
				var tx := -0.26 + t * 0.12 + (0.0 if t > 0 else -0.02)
				var ty := 0.13 - absf(t - 0.6) * 0.017 - (0.02 if t == 0 else 0.0)
				var rr := (0.085 if t == 0 else 0.06) * (1.25 if his else 1.0)
				a = maxf(a, clampf((1.0 - Vector2(u - tx, (v - ty) * 0.8).length() / rr) * 5.0, 0.0, 1.0))
			# pressed: the rim a touch stronger than the middle
			a *= 0.75 + 0.25 * smoothstep(0.55, 0.95, d)
			img.set_pixel(x, y, Color(1, 1, 1, a))
	img.generate_mipmaps()
	_print_t[his] = ImageTexture.create_from_image(img)
	return _print_t[his]

static func _print(mi: MeshInstance3D) -> void:
	if mi == null or not (mi.mesh is QuadMesh): return
	var his := (mi.mesh as QuadMesh).size.x > 0.16
	_tex(mi, print_tex(his))

# ------------------------------------------------------------------ N.6: the tree of glass
static func tree_mesh(base: Vector3) -> ArrayMesh:
	var col := Color(0.5, 0.97, 0.0)
	var m := MB.new()
	var rng := RandomNumberGenerator.new()
	rng.seed = 606
	# the trunk: three tapered pieces leaning a little, a root flare (inside its 0.32 m footprint)
	var pts := [base, base + Vector3(0.04, 0.8, -0.02), base + Vector3(-0.03, 1.5, 0.03), base + Vector3(0.02, 1.95, 0.0)]
	var rs := [0.24, 0.19, 0.15, 0.12]
	m.cyl(base + Vector3(0, 0.09, 0), 0.24, 0.3, 0.18, col, 9)
	for i in 3: _limb(m, pts[i], pts[i + 1], rs[i], rs[i + 1], col, 9)
	# five limbs from the crown, each forking once, reaching out over the shards (r 0.6..1.4, y 1.9..2.6)
	for k in 5:
		var ang := TAU * k / 5.0 + 0.4
		var d := Vector3(cos(ang), 0.0, sin(ang))
		var s0: Vector3 = pts[2].lerp(pts[3], 0.3 + 0.15 * (k % 3))
		var s1 := s0 + d * 0.65 + Vector3(0, 0.38 + rng.randf() * 0.15, 0)
		_limb(m, s0, s1, 0.085, 0.06, col)
		for f in 2:
			var fd := (d.rotated(Vector3.UP, (f * 2 - 1) * 0.55) * (0.6 + rng.randf() * 0.25)) + Vector3(0, 0.22 + rng.randf() * 0.2, 0)
			var s2 := s1 + fd
			_limb(m, s1, s2, 0.055, 0.03, col, 6)
			_limb(m, s2, s2 + fd.normalized() * 0.28 + Vector3(0, 0.1, 0), 0.03, 0.012, col, 5)
	_limb(m, pts[3], pts[3] + Vector3(0.05, 0.55, -0.04), 0.11, 0.03, col, 7)
	return m.commit()

# ------------------------------------------------------------------ N.5: the swivel glasses
static func _swivel(n: Node3D) -> void:
	var glass: MeshInstance3D = null
	for ch in n.get_children(): if ch is MeshInstance3D and str(ch.name) == "Glass": glass = ch
	if glass == null or not (glass.mesh is QuadMesh): return
	var sz := (glass.mesh as QuadMesh).size          # (0.8 x 1.15 in the YZ plane at x 0.035)
	var c := glass.position
	var m := MB.new()
	var hz := sz.x * 0.5
	var hy := sz.y * 0.5
	var S := StillRoomFx.SILVER
	# the frame: a roll and a bead each side, lapping the glass 2 cm; the slab behind stays
	for s in [-1.0, 1.0]:
		# (depths: H roll 0.022..0.072, V roll 0.026..0.080, H bead 0.044..0.090, V bead 0.050..0.096 from the slab: no shared planes)
		m.box(c + Vector3(0.012, s * (hy + 0.03), 0), Vector3(0.05, 0.1, sz.x + 0.14), _c(S, 0.35))          # (ends inside the V roll)
		m.box(c + Vector3(0.018, 0, s * (hz + 0.03)), Vector3(0.054, sz.y + 0.04, 0.1), _c(S, 0.35))
		m.box(c + Vector3(0.032, s * (hy + 0.005), 0), Vector3(0.046, 0.035, sz.x + 0.01), _c(S, 0.0))
		m.box(c + Vector3(0.038, 0, s * (hz + 0.005)), Vector3(0.046, sz.y - 0.03, 0.035), _c(S, 0.0))
	# the crest: a small cartouche and a crimson boss
	m.box(c + Vector3(0.008, hy + 0.13, 0), Vector3(0.05, 0.12, 0.34), _c(S, 0.5))
	m.cyl(c + Vector3(0.04, hy + 0.13, 0), 0.04, 0.05, 0.03, _c(S, 0.1), 12, Basis(Vector3.BACK, PI * 0.5))
	m.sphere(c + Vector3(0.058, hy + 0.13, 0), Vector3(0.018, 0.032, 0.032), _c(StillRoomFx.ENAMEL), 10, 6)
	# bronze pivots on each side (it turns on them)
	for s in [-1.0, 1.0]:
		m.cyl(c + Vector3(0.0, 0, s * (hz + 0.1)), 0.035, 0.035, 0.06, _c(StillRoomFx.BRONZE, 0.3), 10, Basis(Vector3.RIGHT, PI * 0.5))
	_mesh(n, m.commit(), glass)

# ------------------------------------------------------------------ N.1: the stones; NG: the bench
static func _stone(n: Node3D, game: Game) -> void:
	for ch in n.get_children():
		var mi := ch as MeshInstance3D
		if mi == null or mi.mesh == null: continue
		var ab := mi.mesh.get_aabb()
		var sz := ab.size
		var top := ab.end.y
		var cen := ab.get_center()
		var m := MB.new()
		var col := Color(0.5, 0.5, 0.0)
		m.box(Vector3(cen.x, (ab.position.y + top - 0.022) * 0.5, cen.z), Vector3(sz.x, top - 0.022 - ab.position.y, sz.z), col)        # the body
		m.box(Vector3(cen.x, top - 0.018, cen.z), Vector3(sz.x - 0.07, 0.036, sz.z - 0.07), Color(0.5, 0.25, 0.0))                       # the worn cap
		m.box(Vector3(cen.x, top - 0.12, cen.z), Vector3(sz.x + 0.024, 0.05, sz.z + 0.024), Color(0.5, 0.75, 0.0))                        # the water line
		_remesh_marble(mi, game, m.commit())
		return

static func bench_mesh(mi: MeshInstance3D, game: Game) -> ArrayMesh:
	if mi == null or mi.mesh == null: return null
	var ab := mi.mesh.get_aabb()
	var cen := ab.get_center()
	var top := ab.end.y
	var m := MB.new()
	var col := Color(0.5, 0.25, 0.0)
	var L := ab.size.z
	m.box(Vector3(cen.x, top - 0.035, cen.z), Vector3(0.45, 0.07, L), col)                                         # the seat
	m.box(Vector3(cen.x, top - 0.08, cen.z), Vector3(0.47, 0.03, L - 0.04), Color(0.5, 0.5, 0.0))                  # its moulded lip
	for dz in [-0.5, 0.5]:
		var ly := game.level.height_at(Vector2(cen.x, cen.z + dz))
		var h := top - 0.115 - ly                     # (ly + 0.04 .. top - 0.075: under the lip, into the foot)
		m.box(Vector3(cen.x, ly + 0.04 + h * 0.5, cen.z + dz), Vector3(0.3, h, 0.13), Color(0.5, 0.5, 0.0))         # the leg
		m.box(Vector3(cen.x, ly + 0.0265, cen.z + dz), Vector3(0.36, 0.047, 0.19), Color(0.5, 0.75, 0.0))           # its foot
		m.box(Vector3(cen.x, top - 0.125, cen.z + dz), Vector3(0.38, 0.05, 0.17), Color(0.5, 0.5, 0.0))             # its capital
	return m.commit()
