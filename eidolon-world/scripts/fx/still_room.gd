class_name StillRoomFx
## v3 (Agent A, a3) THE STILL ROOM's look (N.4, dev/CH1_V3.md §3). Static builders: each adds its node to `parent` and
## returns it; the animations return their Tween. `her := true` puts a piece in HER world (TwoWorld.HER: only the glass
## shows it), and its dust with it. Web-safe; none of it is marble except the block (1 instance).
##   StillRoomFx.mirror(parent, glass_mat, center, n, size)  the north glass's aged SILVER frame (one mesh; outer = size +
##                                    0.6 m, + a 0.34 m crest on top; 0.16 m off the wall) and a bevel on the glass (planar)
##   StillRoomFx.cleat(parent, pos, n, via, her)   a bronze horn cleat on the wall (n = into the room) with its rope wound
##                                    round it, the rope running through the points `via` (last = at the bar)
##   StillRoomFx.untie(cleat, 2.5)    the wraps come off one by one (match her untie_cleat), then the rope runs off, lashing
##   StillRoomFx.bar(parent, a, b, n, her)   a heavy iron-bound timber bar from a to b across a door (n = into the room) in
##                                    two iron brackets; StillRoomFx.lift(bar, 1.1, 0.9) a short heavy lift + dust;
##                                    StillRoomFx.set_lifted(bar, true) puts it up at once (a loaded save)
##   StillRoomFx.block(parent, game, pos, yaw)   the stone block: marble, chamfered, a black base course, bronze rings, a
##                                    contact shadow (origin = its floor centre); StillRoomFx.push(block, to, 0.9) slides it
##   StillRoomFx.still_ring(parent, pos) / set_ring(ring, k)   your stillness ring (MINE): crimson, closing as k 0 -> 1
##                                    (k <= 0 hides it); ring_pop(ring) = the moment she frees (a pulse, then gone)
##   StillRoomFx.dress_n4(pz_n4, game)   swaps W's N.4 placeholders by name (see below): one call at the end of post()
##   StillRoomFx.detach(parent, glass_center, n, her_pos, cam)  "she's still": a crimson ripple on the glass where her
##                                    reflection stands (MINE, frees itself after 1.6 s)

const SH := preload("res://shaders/still_props.gdshader")
static var _mat: ShaderMaterial

## one shared material (the frames, the bars); cleats get their own (their unwrap / rope uniforms)
static func mat() -> ShaderMaterial:
	if _mat == null:
		_mat = ShaderMaterial.new()
		_mat.shader = SH
	return _mat

static func _c(m: float, hollow := 0.0, wrap := 0.0) -> Color:
	return Color(hollow, m, wrap, 1.0)

const SILVER := 0.0
const BRONZE := 0.33
const ENAMEL := 0.5
const TIMBER := 0.66
const IRON := 0.8
const ROPE := 1.0

static func _mesh(parent: Node, mesh: Mesh, m: Material, her: bool) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if her: mi.layers = TwoWorld.HER
	parent.add_child(mi)
	return mi

# ------------------------------------------------------------------ the great glass's frame
## `widths` = the frame's width on each side (left, right, bottom, top; metres, full 0.3): narrow it where the glass
## meets a floor or a door jamb. The crest sits on the top rail.
static func mirror(parent: Node3D, glass_mat: ShaderMaterial, center: Vector3, n: Vector3, size := Vector2(8.0, 3.5), widths := Vector4(0.3, 0.3, 0.3, 0.3)) -> Node3D:
	var root := Node3D.new()
	root.name = "StillMirrorFrame"
	parent.add_child(root)
	var nn := n.normalized()
	root.global_transform = Transform3D(Basis.looking_at(-nn, Vector3.UP), center)      # local +z = n (out of the wall)
	if glass_mat:
		glass_mat.set_shader_parameter("bevel", 0.07)
	var m := MB.new()
	var hx := size.x * 0.5
	var hy := size.y * 0.5
	var wl := widths.x
	var wr := widths.y
	var wb := widths.z
	var wt := widths.w
	# each rail, stepped like a moulding: a dark back plate, the main roll, an outer bead, the inner lip over the glass
	for side in 4:
		var horiz := side < 2
		var sg := 1.0 if side % 2 == 0 else -1.0
		var w: float = (wt if sg > 0.0 else wb) if horiz else (wr if sg > 0.0 else wl)
		var f := w / 0.3
		var L := size.x + wl + wr if horiz else size.y + wb + wt
		var mid := (wr - wl) * 0.5 if horiz else (wt - wb) * 0.5
		var off := hy if horiz else hx
		# (a4 zfight) the vertical rails sit 2.5 mm deeper than the horizontal ones: where they cross at the corners no
		# two faces share a plane; within a rail every piece has its own back / front / edge depths
		var dz := 0.0 if horiz else 0.0025
		var rail := func(across: float, rw: float, d: float, z: float, col: Color, length: float, centred: bool) -> void:
			var a0 := 0.0 if centred else mid
			var c := Vector3(a0, sg * (off + across), z + dz) if horiz else Vector3(sg * (off + across), a0, z + dz)
			var sz := Vector3(length, rw, d) if horiz else Vector3(rw, length, d)
			m.box(c, sz, col)
		rail.call((w + 0.013) * 0.5, w + 0.007, 0.062, 0.019, _c(SILVER, 0.9), L, false)         # the back plate (off the glass)
		if f > 0.45:
			rail.call(0.13 * f, 0.17 * f, 0.11, 0.07, _c(SILVER, 0.35), L - 0.1, false)        # the main roll
			rail.call(w - 0.025, 0.04, 0.09, 0.075, _c(SILVER, 0.0), L - 0.05, false)          # the outer bead
		rail.call(0.015, 0.05, 0.146, 0.067, _c(SILVER, 0.0), (size.x if horiz else size.y) + 0.02, true)   # the inner lip
		rail.call(0.02 + 0.045 * minf(f, 1.0), 0.03, 0.114, 0.077, _c(SILVER, 0.8), (size.x if horiz else size.y) + 0.13, true)
	# the corner blocks, each with a rosette
	for sx in [-1.0, 1.0]:
		for sy in [-1.0, 1.0]:
			var cw: float = wr if sx > 0.0 else wl
			var ch: float = wt if sy > 0.0 else wb
			var cc := Vector3(sx * (hx + cw * 0.5), sy * (hy + ch * 0.5), 0.08)
			m.box(cc, Vector3(cw + 0.06, ch + 0.06, 0.16), _c(SILVER, 0.45))
			var rr := minf(cw, ch) / 0.3
			if rr > 0.45:
				m.cyl(cc + Vector3(0, 0, 0.09), 0.1 * rr, 0.12 * rr, 0.04, _c(SILVER, 0.1), 14, Basis(Vector3.RIGHT, PI * 0.5))
				m.cyl(cc + Vector3(0, 0, 0.115), 0.035 * rr, 0.05 * rr, 0.03, _c(SILVER, 0.0), 10, Basis(Vector3.RIGHT, PI * 0.5))
	# the crest: a stepped cartouche over the top rail with a crimson enamel boss (the accent)
	var top := hy + wt
	m.box(Vector3(0, top + 0.07, 0.05), Vector3(1.5, 0.14, 0.1), _c(SILVER, 0.4))
	m.box(Vector3(0, top + 0.19, 0.064), Vector3(0.9, 0.12, 0.12), _c(SILVER, 0.2))
	m.box(Vector3(0, top + 0.12, 0.12), Vector3(0.34, 0.3, 0.06), _c(SILVER, 0.6))
	m.cyl(Vector3(0, top + 0.12, 0.16), 0.075, 0.09, 0.03, _c(SILVER, 0.0), 16, Basis(Vector3.RIGHT, PI * 0.5))
	m.sphere(Vector3(0, top + 0.12, 0.175), Vector3(0.055, 0.055, 0.03), _c(ENAMEL), 12, 6)
	for sx in [-1.0, 1.0]:
		m.cyl(Vector3(sx * 0.95, top + 0.06, 0.06), 0.05, 0.06, 0.08, _c(SILVER, 0.2), 10, Basis(Vector3.RIGHT, PI * 0.5))
	_mesh(root, m.commit(), mat(), false)
	return root

# ------------------------------------------------------------------ a cleat and its rope (her side)
## `pos` = the cleat's centre on the wall face; `via` = where the rope runs from it (the last point at the bar);
## horizontal: its horns lie flat (on a post), else upright on the wall
static func cleat(parent: Node3D, pos: Vector3, n: Vector3, via: PackedVector3Array, her := true, horizontal := false) -> Node3D:
	var root := Node3D.new()
	root.name = "Cleat"
	parent.add_child(root)
	var nn := n.normalized()
	root.global_transform = Transform3D(Basis.looking_at(-nn, Vector3.UP), pos)          # local +z out of the wall
	_cleat_into(root, horizontal, her)
	if via.size() > 0:
		var pts := PackedVector3Array([root.global_transform * (Vector3(0.14, 0, 0.09) if horizontal else Vector3(0, 0.14, 0.09))])
		pts.append_array(via)
		_rope_into(root, pts, her)
	root.set_meta("her", her)
	return root

## the cleat's metal + its wraps into `root` (its own material: the wraps come off by `unwrap`)
static func _cleat_into(root: Node3D, horizontal: bool, her: bool) -> MeshInstance3D:
	var cm := ShaderMaterial.new()
	cm.shader = SH
	root.set_meta("mat", cm)
	var m := MB.new()
	var B := Basis(Vector3.BACK, PI * 0.5) if horizontal else Basis()
	m.box(B * Vector3(0, 0, 0.01), Vector3(0.11, 0.36, 0.02), _c(BRONZE, 0.5), B)                    # the back plate
	for sy in [-1.0, 1.0]:
		m.cyl(B * Vector3(0, sy * 0.15, 0.024), 0.012, 0.014, 0.012, _c(BRONZE, 0.0), 8, Basis(Vector3.RIGHT, PI * 0.5))   # rivets
	m.cyl(Vector3(0, 0, 0.045), 0.022, 0.03, 0.05, _c(BRONZE, 0.3), 10, Basis(Vector3.RIGHT, PI * 0.5))         # the post
	m.box(Vector3(0, 0, 0.08), Vector3(0.04, 0.3, 0.036), _c(BRONZE, 0.1), B)                        # the horns
	for sy in [-1.0, 1.0]:
		m.box(B * Vector3(0, sy * 0.155, 0.083), Vector3(0.034, 0.03, 0.03), _c(BRONZE, 0.0), B * Basis(Vector3.BACK, sy * 0.3))
	# the wraps: figure-eights round the horns, then a hitch (they come off from the last)
	var wraps := 4
	for k in wraps:
		var tilt := (0.55 if k % 2 == 0 else -0.55)
		var ring := PackedVector3Array()
		for i in 17:
			var a := TAU * i / 16.0
			ring.append(B * (Basis(Vector3.BACK, tilt) * Vector3(cos(a) * 0.035, sin(a) * 0.13, 0.0) + Vector3(0, 0, 0.083 + 0.007 * k)))
		_tube(m, ring, 0.011, _c(ROPE, 0.0, float(k + 1) / float(wraps + 1)))
	return _mesh(root, m.commit(), cm, her)

## a rope through the GLOBAL points `pts`, sagging a little between them, into `root` (its own material: it runs off by
## `rope_gone`); its length is kept as meta "rope_len"
static func _rope_into(root: Node3D, pts_g: PackedVector3Array, her: bool) -> MeshInstance3D:
	var rm := ShaderMaterial.new()
	rm.shader = SH
	var inv := root.global_transform.affine_inverse()
	var pts := PackedVector3Array([inv * pts_g[0]])
	var prev := pts[0]
	for i in range(1, pts_g.size()):
		var q := inv * pts_g[i]
		var span := prev.distance_to(q)
		var steps := clampi(int(span / 0.25), 2, 12)
		for j in range(1, steps + 1):
			var t := j / float(steps)
			pts.append(prev.lerp(q, t) + Vector3(0, -4.0 * t * (1.0 - t) * span * 0.035, 0))
		prev = q
	var rl := 0.0
	for i in range(1, pts.size()): rl += pts[i].distance_to(pts[i - 1])
	var d := (pts[pts.size() - 1] - pts[0])
	var side := d.cross(Vector3.UP).normalized() if absf(d.normalized().y) < 0.9 else Vector3.RIGHT
	rm.set_shader_parameter("whip_dir", side)
	root.set_meta("rope_mat", rm)
	root.set_meta("rope_len", rl)
	var m := MB.new()
	_tube(m, pts, 0.014, _c(ROPE))
	return _mesh(root, m.commit(), rm, her)

## the cleat comes undone (match her untie_cleat): the wraps off one by one over 70% of `seconds`, then the rope (its own,
## or `rope` = the node dress_n4 dressed) runs off up its path, lashing
static func untie(cl: Node3D, seconds := 2.5, rope: Node3D = null) -> Tween:
	var cm: ShaderMaterial = cl.get_meta("mat")
	var rn: Node3D = rope if rope else cl
	var rm: ShaderMaterial = rn.get_meta("rope_mat", null)
	var tw := cl.create_tween()
	tw.tween_method(func(v: float) -> void: cm.set_shader_parameter("unwrap", v), 0.0, 1.0, seconds * 0.7).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void:
		var b := FxBurst._make(cl, cl.global_position + cl.global_transform.basis.z * 0.1, FxBurst.DUST, 6, {"life": 0.9, "speed": 0.3,
			"spread": 1.0, "gravity": 0.2, "drag": 1.2, "size0": 0.04, "size1": 0.12, "col0": Color(0.62, 0.55, 0.45, 0.5), "col1": Color(0.7, 0.66, 0.6, 0.0),
			"delay": 0.1, "soft": 0.0, "reach": 0.6})
		_layer_like(b, cl))
	if rm:
		tw.tween_callback(func() -> void: rm.set_shader_parameter("whip", 1.0))
		tw.tween_method(func(v: float) -> void: rm.set_shader_parameter("rope_gone", v), 0.0, float(rn.get_meta("rope_len", 9.0)) + 0.1, seconds * 0.3 + 0.6).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		tw.tween_callback(func() -> void: rm.set_shader_parameter("whip", 0.0))
	return tw

## a loaded save: already untied (no wraps, no rope)
static func set_untied(cl: Node3D, rope: Node3D = null) -> void:
	(cl.get_meta("mat") as ShaderMaterial).set_shader_parameter("unwrap", 1.0)
	var rn: Node3D = rope if rope else cl
	if rn.has_meta("rope_mat"): (rn.get_meta("rope_mat") as ShaderMaterial).set_shader_parameter("rope_gone", 99.0)

# ------------------------------------------------------------------ the door bar
static func bar(parent: Node3D, a: Vector3, b: Vector3, n: Vector3, her := true) -> Node3D:
	var root := Node3D.new()
	root.name = "DoorBar"
	parent.add_child(root)
	var along := (b - a).normalized()
	var nn := (n - along * n.dot(along)).normalized()
	var up := nn.cross(along).normalized()
	if up.y < 0.0:
		up = -up
		along = -along
	root.global_transform = Transform3D(Basis(along, up, along.cross(up)), (a + b) * 0.5)   # local x along the bar
	var L := a.distance_to(b)
	_brackets_into(root, L, her)
	_beam_into(root, L, her)
	root.set_meta("her", her)
	return root

## the brackets stay on the door: iron U's with bolts (local x = the bar)
static func _brackets_into(root: Node3D, L: float, her: bool, inset := 0.22) -> void:
	var br := MB.new()
	for sx in [-1.0, 1.0]:
		var x: float = sx * (L * 0.5 - inset)
		br.box(Vector3(x, -0.02, -0.075), Vector3(0.16, 0.34, 0.02), _c(IRON, 0.5))
		br.box(Vector3(x, -0.105, 0.0), Vector3(0.12, 0.03, 0.17), _c(IRON, 0.2))
		br.box(Vector3(x, 0.0, 0.085), Vector3(0.12, 0.22, 0.03), _c(IRON, 0.1))
		for sy in [-1.0, 1.0]:
			br.cyl(Vector3(x, sy * 0.13, -0.06), 0.016, 0.02, 0.02, _c(IRON, 0.0), 8, Basis(Vector3.RIGHT, PI * 0.5))
	_mesh(root, br.commit(), mat(), her).name = "Brackets"

## the bar itself: dark timber, iron-bound at its ends and middle, a ring for the rope at its centre (local x = the bar)
static func _beam_into(root: Node3D, L: float, her: bool) -> MeshInstance3D:
	var m := MB.new()
	m.box(Vector3.ZERO, Vector3(L, 0.17, 0.13), _c(TIMBER, 0.2))
	for x in [-L * 0.5 + 0.06, -L * 0.5 + 0.42, 0.0, L * 0.5 - 0.42, L * 0.5 - 0.06]:
		m.box(Vector3(x, 0, 0), Vector3(0.07, 0.185, 0.145), _c(IRON, 0.1))
	m.box(Vector3(0, 0.1, 0), Vector3(0.05, 0.04, 0.05), _c(IRON, 0.0))
	for i in 10:
		var a0 := TAU * i / 10.0
		m.box(Vector3(0, 0.155 + sin(a0) * 0.045, cos(a0) * 0.045), Vector3(0.016, 0.03, 0.03), _c(IRON, 0.0), Basis(Vector3.RIGHT, -a0))
	var beam := _mesh(root, m.commit(), mat(), her)
	beam.name = "Beam"
	root.set_meta("beam", beam)
	root.set_meta("beam_len", L)
	return beam

## a short, heavy lift: it catches (a sag, a shudder), jerks up `rise` metres one end leading, swings and hangs a little
## crooked; dust and grit burst from both brackets
static func lift(br: Node3D, seconds := 1.1, rise := 0.9) -> Tween:
	var beam: Node3D = br.get_meta("beam")
	var L: float = br.get_meta("beam_len", 1.0)
	var tw := br.create_tween()
	var t0 := seconds * 0.12
	tw.tween_property(beam, "position:y", -0.018, t0).set_trans(Tween.TRANS_SINE)
	tw.parallel().tween_property(beam, "rotation:z", 0.012, t0)
	tw.tween_callback(func() -> void:
		var par := br.get_parent()
		for sx in [-1.0, 1.0]:
			var p: Vector3 = beam.get_parent().global_transform * Vector3(sx * (L * 0.5 - 0.22), 0.0, 0.1)
			_layer_like(FxBurst.dust(par, p, 0.45, p.y - 1.5), br)
			_layer_like(FxBurst._make(par, p, FxBurst.SPARK, 10, {"life": 0.8, "speed": 1.1, "spread": 0.8, "dir": Vector3(0, 0.4, 0), "gravity": 9.8,
				"size0": 0.03, "size1": 0.022, "col0": Color(0.72, 0.68, 0.62, 1.0), "col1": Color(0.5, 0.47, 0.43, 1.0), "delay": 0.1, "soft": 0.0, "reach": 2.0}), br))
	tw.tween_property(beam, "position:y", rise * 1.06, seconds * 0.4).set_trans(Tween.TRANS_EXPO).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(beam, "rotation:z", -0.09, seconds * 0.3).set_trans(Tween.TRANS_SINE)
	tw.tween_property(beam, "position:y", rise, seconds * 0.48).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(beam, "rotation:z", 0.03, seconds * 0.48).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	return tw

static func set_lifted(br: Node3D, up: bool, rise := 0.9) -> void:
	var beam: Node3D = br.get_meta("beam")
	beam.position.y = rise if up else 0.0
	beam.rotation.z = 0.03 if up else 0.0

# ------------------------------------------------------------------ the stone block (real: in both worlds)
## within its footprint `size` exactly (x, height, z): a black base course, the body with sunk panels, an overhanging-
## looking cap (inset body instead), a bronze drag ring on each face; origin = its floor centre
static func block_mesh(size: Vector3) -> ArrayMesh:
	var cream := MB.col(0.25, false, 0.4)
	var m := MB.new()
	var bh := 0.1
	var ch := 0.07
	m.box(Vector3(0, bh * 0.5, 0), Vector3(size.x, bh, size.z), MB.col(0.75, false, 0.3))                       # the black base course
	# (a4 zfight) the body runs 1 cm into the base course and the cap, the inlay 6 mm into the cap: no shared faces
	m.box(Vector3(0, (bh + size.y - ch) * 0.5, 0), Vector3(size.x - 0.05, size.y - bh - ch + 0.02, size.z - 0.05), cream)   # the body
	m.box(Vector3(0, size.y - ch * 0.5, 0), Vector3(size.x - 0.01, ch, size.z - 0.01), cream)                    # the cap
	m.box(Vector3(0, size.y + 0.002, 0), Vector3(size.x - 0.16, 0.016, size.z - 0.16), MB.col(0.25, false, 0.55))
	var ph := size.y - bh - ch - 0.14
	for k in 4:
		var bs := Basis(Vector3.UP, k * PI * 0.5)
		var half: float = (size.z if k % 2 == 0 else size.x) * 0.5
		var wide: float = (size.x if k % 2 == 0 else size.z)
		# (face f = half - 0.025: dark panel f-0.01..f+0.004, its light field f-0.005..f+0.01, the ring's mount
		# f+0.0125..f+0.0265, the ring a round tube (flats at f+0.0025, f+0.0215): no two faces within 2 mm)
		m.box(bs * Vector3(0, bh + 0.07 + ph * 0.5, half - 0.028), Vector3(wide - 0.22, ph, 0.014), MB.col(0.75, false, 0.5), bs)   # a sunk dark panel
		m.box(bs * Vector3(0, bh + 0.07 + ph * 0.5, half - 0.0225), Vector3(wide - 0.3, ph - 0.08, 0.015), MB.col(0.25, false, 0.5), bs)
		var rc := bs * Vector3(0, bh + 0.07 + ph * 0.62, half - 0.013)
		m.box(rc + bs * Vector3(0, 0.06, 0.0075), Vector3(0.09, 0.05, 0.014), MB.col(0.9), bs)
		var ring := PackedVector3Array()
		for i in 13:          # (open at the top, under its mount: a closed tube's seam overlaps itself)
			var a := PI * 0.5 + TAU * (i + 0.5) / 14.0
			ring.append(rc + bs * Vector3(cos(a) * 0.055, sin(a) * 0.055 - 0.01, 0.0))
		_tube(m, ring, 0.011, MB.col(0.9), 6)
	return m.commit()

static func block(parent: Node3D, game: Game, pos: Vector3, yaw := 0.0, size := Vector3(0.8, 0.6, 0.8)) -> Node3D:
	var root := Node3D.new()
	root.name = "StillBlock"
	parent.add_child(root)
	root.global_transform = Transform3D(Basis(Vector3.UP, yaw), pos)
	var body := Kit3.marble(game, block_mesh(size), root)
	body.name = "Body"
	_contact_shadow(root, size)
	root.set_meta("size", size)
	return root

## a contact shadow under it: it sits, it does not float
static func _contact_shadow(root: Node3D, size: Vector3) -> void:
	var sh := MeshInstance3D.new()
	sh.name = "ContactShadow"
	var pm := PlaneMesh.new()
	pm.size = Vector2(size.x + 0.5, size.z + 0.5)
	sh.mesh = pm
	var sm := ShaderMaterial.new()
	var s := Shader.new()
	s.code = SHADOW_SH
	sm.shader = s
	sm.set_shader_parameter("half_in", Vector2(size.x, size.z) * 0.5 / (Vector2(size.x, size.z) + Vector2(0.5, 0.5)))
	sh.material_override = sm
	sh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sh.position = Vector3(0, 0.024, 0)          # (a4 zfight: over the 1.2 cm rune rugs by 1.2 cm; sub-pixel at 7.5 m view)
	root.add_child(sh)

## push it to `to` (its new floor centre): it heaves, grinds over (dust off its foot), thuds and rocks back.
## Works on block()'s node or any dressed block node (it tilts the node's "Body" child, else the node itself).
static func push(bl: Node3D, to: Vector3, seconds := 0.9) -> Tween:
	var body: Node3D = bl.get_node_or_null("Body")
	var b0 := bl.basis
	var size: Vector3 = bl.get_meta("size", Vector3(0.8, 0.6, 0.8))
	var from := bl.global_position
	var d := to - from
	d.y = 0.0
	var dir := d.normalized() if d.length() > 0.01 else Vector3.FORWARD
	var ax := (bl.global_transform.basis.inverse() * Vector3.UP.cross(dir)).normalized()
	var tw := bl.create_tween()
	var tilt := func(a: float) -> void:
		if body: body.basis = Basis(ax, a)
		else: bl.basis = b0 * Basis(ax, a)
	tw.tween_method(tilt, 0.0, -0.022, 0.16).set_trans(Tween.TRANS_SINE)
	tw.tween_callback(func() -> void: _block_dust(bl, from - dir * size.x * 0.5, 0.6))
	tw.tween_property(bl, "global_position", to, seconds).set_trans(Tween.TRANS_QUART).set_ease(Tween.EASE_IN_OUT)
	tw.parallel().tween_method(tilt, -0.022, 0.0, seconds * 0.5)
	for k in 3:
		tw.parallel().tween_callback(func() -> void: _block_dust(bl, bl.global_position - dir * size.x * 0.5, 0.35)).set_delay(seconds * (0.25 + 0.22 * k))
	tw.tween_callback(func() -> void: _block_dust(bl, to + dir * size.x * 0.5, 0.8))
	tw.tween_method(tilt, 0.0, 0.03, 0.08).set_trans(Tween.TRANS_SINE)
	tw.tween_method(tilt, 0.03, 0.0, 0.42).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	return tw

static func _block_dust(bl: Node3D, at: Vector3, k: float) -> void:
	var p := Vector3(at.x, bl.global_position.y + 0.06, at.z)
	FxBurst._make(bl.get_parent(), p, FxBurst.DUST, int(12 * k + 3), {"life": 1.6, "speed": 0.5, "spread": 1.0, "dir": Vector3(0, 0.25, 0), "gravity": 0.15, "drag": 1.3,
		"size0": 0.12 * (0.6 + k), "size1": 0.4 * (0.6 + k), "col0": Color(0.74, 0.72, 0.68, 0.6), "col1": Color(0.78, 0.77, 0.74, 0.0), "delay": 0.15,
		"soft": 0.12, "ground": bl.global_position.y, "reach": 2.0})
	if k > 0.5:
		FxBurst._make(bl.get_parent(), p, FxBurst.SPARK, 8, {"life": 0.6, "speed": 0.9, "spread": 0.9, "dir": Vector3(0, 0.6, 0), "gravity": 9.8,
			"size0": 0.03, "size1": 0.022, "col0": Color(0.8, 0.77, 0.72, 1.0), "col1": Color(0.6, 0.58, 0.54, 1.0), "delay": 0.1, "soft": 0.0, "reach": 1.5})

# ------------------------------------------------------------------ "she's still": your ring, her ripple
static func still_ring(parent: Node3D, pos: Vector3) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1.5, 1.5)
	mi.mesh = pm
	var m := ShaderMaterial.new()
	var s := Shader.new()
	s.code = RING_SH
	m.shader = s
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.layers = TwoWorld.MINE
	mi.visible = false
	parent.add_child(mi)
	mi.global_position = pos + Vector3(0, 0.012, 0)
	return mi

## k 0..1 = the second of stillness filling (the ring closes on her feet and its arc completes); k <= 0 hides it
static func set_ring(ring: MeshInstance3D, k: float, pos := Vector3.INF) -> void:
	if not is_instance_valid(ring): return
	if pos != Vector3.INF: ring.global_position = pos + Vector3(0, 0.012, 0)
	ring.visible = k > 0.0
	(ring.material_override as ShaderMaterial).set_shader_parameter("k", clampf(k, 0.0, 1.0))
	(ring.material_override as ShaderMaterial).set_shader_parameter("flash", 0.0)

## the moment she frees: the closed ring flares and fades (0.6 s), then hides
static func ring_pop(ring: MeshInstance3D) -> Tween:
	var m := ring.material_override as ShaderMaterial
	m.set_shader_parameter("k", 1.0)
	ring.visible = true
	var tw := ring.create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("flash", v), 0.0, 1.0, 0.12).set_trans(Tween.TRANS_SINE)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("flash", v), 1.0, 0.0, 0.5).set_trans(Tween.TRANS_SINE)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("k", v), 1.0, 0.0, 0.3)
	tw.tween_callback(func() -> void: ring.visible = false)
	return tw

## where the viewer sees `her_pos`'s reflection on the glass (plane through `glass_center`, normal n): the cue sits there
static func on_glass(glass_center: Vector3, n: Vector3, her_pos: Vector3, cam: Camera3D) -> Vector3:
	var nn := n.normalized()
	var q := her_pos - 2.0 * nn.dot(her_pos - glass_center) * nn
	var d := -cam.global_transform.basis.z if cam.projection == Camera3D.PROJECTION_ORTHOGONAL else (q - cam.global_position).normalized()
	var dn := nn.dot(d)
	if absf(dn) < 1e-4: return q
	return q + d * (nn.dot(glass_center - q) / dn)

## the crimson ripple on the glass as her reflection breaks free of yours (her_pos = her feet in YOUR world)
static func detach(parent: Node3D, glass_center: Vector3, n: Vector3, her_pos: Vector3, cam: Camera3D, height := 1.2) -> MeshInstance3D:
	var nn := n.normalized()
	var at := on_glass(glass_center, nn, her_pos + Vector3(0, height * 0.5, 0), cam)
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(height * 1.3, height * 1.5)
	mi.mesh = q
	var m := ShaderMaterial.new()
	var s := Shader.new()
	s.code = RIPPLE_SH
	m.shader = s
	m.render_priority = 2
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.layers = TwoWorld.MINE
	parent.add_child(mi)
	mi.global_transform = Transform3D(Basis.looking_at(-nn, Vector3.UP), at + nn * 0.05)
	var tw := mi.create_tween()
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("t", v), 0.0, 1.0, 1.6).set_trans(Tween.TRANS_LINEAR)
	tw.tween_callback(mi.queue_free)
	return mi

# ------------------------------------------------------------------ N.4: swap W's placeholders by name
## call once at the end of pz_n4.post(): StillRoomFx.dress_n4(self, game). It keeps W's nodes (their names, transforms,
## tweens and visibility all still work) and replaces only what they show:
##   the glass (World3.mirrors["N4"]) -> the aged silver frame + bevel; N4_Cleat_* -> bronze cleats with rope wraps;
##   N4_Rope_* -> twisted hemp rope (one crimson strand); N4_Bar_* -> iron-bound timber bars (their brackets stay on the
##   door as N4_Brackets_*); N4_Block -> the carved marble block (same footprint, still ONE marble instance) + contact
##   shadow; still_ring -> the closing crimson ring (same uniforms k / flash on W's ring_mat).
static func dress_n4(pz: Node3D, game: Game) -> void:
	var g: Variant = pz.get("glass")
	if g is Reflector and (g as Reflector).planar:
		var r := g as Reflector
		# (the glass's bottom is 0.2 m off the floor; its east edge meets the exit's jamb)
		mirror(pz, r.planar.mat, r.clip_c, r.plane_n, r.clip_h * 2.0, Vector4(0.3, 0.07, 0.17, 0.3))
	var rm: Variant = pz.get("ring_mat")
	if rm is ShaderMaterial:
		var sh := Shader.new()
		sh.code = RING_SH
		(rm as ShaderMaterial).shader = sh
		(rm as ShaderMaterial).set_shader_parameter("span", 1.6)
	for c in pz.get_children():
		var nm := str(c.name)
		if nm.begins_with("N4_Cleat_"): _dress_cleat(c)
		elif nm.begins_with("N4_Rope_"): _dress_rope(c)
		elif nm.begins_with("N4_Bar_"): _dress_bar(pz, c)
		elif nm == "N4_Block": _dress_block(c, game)

static func _hide_meshes(n: Node3D) -> Array:
	var out := []
	for ch in n.get_children():
		if ch is MeshInstance3D:
			(ch as MeshInstance3D).visible = false
			out.append(ch)
	return out

static func _dress_cleat(cn: Node3D) -> void:
	var old := _hide_meshes(cn)
	var her: bool = old.size() > 0 and (old[0] as MeshInstance3D).layers == TwoWorld.HER
	for mi in old:
		var bm := (mi as MeshInstance3D).mesh as BoxMesh
		if bm and bm.size.y > 0.3:
			# its post: square iron, a cap and a foot
			var pm := MB.new()
			var pp: Vector3 = (mi as MeshInstance3D).position
			pm.box(pp, Vector3(0.08, bm.size.y, 0.08), _c(IRON, 0.3))
			pm.box(pp + Vector3(0, -bm.size.y * 0.5 + 0.03, 0), Vector3(0.16, 0.06, 0.16), _c(IRON, 0.5))
			pm.box(pp + Vector3(0, bm.size.y * 0.5 - 0.06, -0.02), Vector3(0.12, 0.12, 0.06), _c(IRON, 0.2))
			_mesh(cn, pm.commit(), mat(), her)
	var holder := Node3D.new()
	holder.name = "Look"
	holder.position = Vector3(0, 0.03, -0.02)
	cn.add_child(holder)
	var mi2 := _cleat_into(holder, true, her)
	cn.set_meta("mat", holder.get_meta("mat"))
	cn.set_meta("her", her)
	mi2.name = "CleatLook"

static func _dress_rope(rn: Node3D) -> void:
	var old := _hide_meshes(rn)
	if old.is_empty(): return
	var her: bool = (old[0] as MeshInstance3D).layers == TwoWorld.HER
	var pts := PackedVector3Array()
	for mi in old:
		var cm := (mi as MeshInstance3D).mesh as CylinderMesh
		if cm == null: continue
		var xf := (mi as MeshInstance3D).global_transform
		var y := xf.basis.y.normalized() * cm.height * 0.5
		if pts.is_empty(): pts.append(xf.origin - y)
		pts.append(xf.origin + y)
	if pts.size() >= 2: _rope_into(rn, pts, her)
	rn.set_meta("her", her)

static func _dress_bar(pz: Node3D, bn: Node3D) -> void:
	var old := _hide_meshes(bn)
	if old.is_empty(): return
	var her: bool = (old[0] as MeshInstance3D).layers == TwoWorld.HER
	var bm := (old[0] as MeshInstance3D).mesh as BoxMesh
	if bm == null: return
	var along_z := bm.size.z > bm.size.x
	var L := maxf(bm.size.x, bm.size.z)
	var B := Basis(Vector3.UP, -PI * 0.5) if along_z else Basis()          # (local -z = toward the door: the brackets' plates)
	# the brackets stay on the door (W lifts and hides the bar's node)
	var brk := Node3D.new()
	brk.name = "N4_Brackets_" + str(bn.name).trim_prefix("N4_Bar_")
	pz.add_child(brk)
	brk.global_transform = Transform3D(bn.global_transform.basis * B, bn.global_position)
	_brackets_into(brk, L, her, 0.1)
	var holder := Node3D.new()
	holder.name = "Look"
	holder.basis = B
	bn.add_child(holder)
	_beam_into(holder, L, her)
	bn.set_meta("beam", holder.get_meta("beam"))
	bn.set_meta("beam_len", L)
	bn.set_meta("her", her)

static func _dress_block(bl: Node3D, game: Game) -> void:
	var mi := bl as MeshInstance3D
	if mi == null: return
	var size := mi.mesh.get_aabb().size
	size.y = snappedf(size.y - 0.02, 0.01)            # (W's has a 2 cm top inlay)
	mi.mesh = MB.split_occ(block_mesh(size))
	for si in mi.mesh.get_surface_count():
		mi.set_surface_override_material(si, game.level.marble_occ_mat if mi.mesh.surface_get_name(si) == "occ" else game.level.marble_mat)
	_contact_shadow(mi, size)
	mi.set_meta("size", size)

# ------------------------------------------------------------------ helpers
static func _layer_like(b: GeometryInstance3D, owner_node: Node) -> void:
	if b and owner_node.get_meta("her", false): b.layers = TwoWorld.HER

## a tube along `pts` (radius r) into the builder: UV.x = metres along, UV.y = round
static func _tube(m: MB, pts: PackedVector3Array, r: float, col: Color, sides := 6) -> void:
	var base := m.v.size()
	var acc := 0.0
	var prev_side := Vector3.UP
	for i in pts.size():
		var t := (pts[mini(i + 1, pts.size() - 1)] - pts[maxi(i - 1, 0)]).normalized()
		if i > 0: acc += pts[i].distance_to(pts[i - 1])
		var side := (prev_side - t * prev_side.dot(t))
		if side.length() < 1e-3: side = t.cross(Vector3.RIGHT)
		side = side.normalized()
		prev_side = side
		var bi := t.cross(side)
		for k in sides + 1:
			var a := TAU * k / float(sides)
			var nrm := side * cos(a) + bi * sin(a)
			m.v.append(pts[i] + nrm * r)
			m.n.append(nrm)
			m.c.append(col)
			m.uv.append(Vector2(acc, float(k) / float(sides)))
	for i in pts.size() - 1:
		for k in sides:
			var a0 := base + i * (sides + 1) + k
			var b0 := a0 + sides + 1
			m.idx.append_array([a0, b0, a0 + 1, a0 + 1, b0, b0 + 1])

const SHADOW_SH := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec2 half_in = vec2(0.28, 0.28);
void fragment() {
	vec2 q = abs(UV - 0.5);
	vec2 o = max(q - half_in, vec2(0.0));
	float d = length(o) / max(0.5 - half_in.x, 0.01);
	ALBEDO = vec3(0.07, 0.065, 0.06);          // (a8: a warm, soft occlusion, not a black slab)
	float f = 1.0 - smoothstep(0.0, 1.0, d);
	ALPHA = 0.42 * f * f;
}
"""

const RING_SH := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
uniform float k = 0.0;          // the second of stillness, 0..1: the ring closes on her feet, its arc completes
uniform float flash = 0.0;      // the moment she frees: a flare
uniform float span = 1.5;       // the plane's size (m)
void fragment() {
	vec2 q = (UV - 0.5) * span;
	float r = length(q);
	float rad = mix(0.66, 0.24, smoothstep(0.0, 1.0, k)) + flash * 0.06;
	float w = 0.018 + 0.01 * k + 0.02 * flash;
	float ring = 1.0 - smoothstep(w * 0.4, w, abs(r - rad));
	float ang = fract(atan(q.x, -q.y) / 6.28318 + 1.0);
	float arc = max(step(ang, k), flash);
	float glow = exp(-abs(r - rad) * 18.0) * 0.35;
	float disc = flash * 0.45 * (1.0 - smoothstep(0.0, rad, r));
	float a = (ring * (0.35 + 0.65 * arc) + glow * arc) * smoothstep(0.0, 0.15, k) + disc;
	ALBEDO = accent.rgb * a * (1.4 + 1.2 * flash);
}
"""

const RIPPLE_SH := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
global uniform vec4 accent;
uniform float t = 0.0;
void fragment() {
	vec2 q = (UV - 0.5) * vec2(1.0, 1.15) * 2.0;
	float r = length(q);
	float a = 0.0;
	for (int i = 0; i < 3; i++) {
		float ti = t * 1.4 - float(i) * 0.22;
		if (ti <= 0.0 || ti >= 1.0) continue;
		float rad = ti * 1.05;
		a += (1.0 - smoothstep(0.0, 0.035 + 0.04 * ti, abs(r - rad))) * (1.0 - ti) * (1.0 - ti);
	}
	float core = exp(-r * r * 6.0) * sin(3.14159 * clamp(t * 1.6, 0.0, 1.0)) * 0.35;
	ALBEDO = accent.rgb * (a * 1.3 + core) * (1.0 - smoothstep(0.85, 1.0, r));
}
"""
