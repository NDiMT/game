extends "res://wing_cistern.gd"
## EIDOLON, chapter 1, the wing of the lamps: "the water he blinded". Light on water is a blind eye: where the glare
## of a flame falls, the water shows nothing and her reflection has nowhere to stand. Four courts south of the atrium,
## in a ring: from the door a causeway comes down to a landing, where the main channel turns west to the sealed
## head-gate of the Great Lamp's hall. The way there goes round: east along the first canal (L.1), south to the forked
## canal (L.2), west along the long road beside the blind water (the passage), into the court of the dead lamps (L.3),
## and north into the hall (L.4), whose gate opens back onto the landing.
## Everything here is named lm_ / Lm / LM_. See eidolon-world/dev/CH1_FLOW_V4.md, "Η Στοά των Λύχνων".

# ---------------------------------------------------------------- where things stand
const LM_LX0 := -32.9      # the landing at the foot of the causeway
const LM_LZ0 := -19.0
const LM_LX1 := -28.4
const LM_LZ1 := -15.4
const LM_CH_Z := -16.4     # the main channel runs west along this line, from the landing to the head-gate
const LM_AX0 := -28.4      # L.1: the first canal, along the north bank of which she walks
const LM_AZ0 := -19.0
const LM_AX1 := -18.8
const LM_AZ1 := -13.2
const LM_APX0 := -27.4
const LM_APZ0 := -17.1
const LM_APX1 := -20.4
const LM_APZ1 := -14.7
const LM_A_LAMPS := [-26.0, -23.8, -21.6]      # its three lamps, along x; they hang over the middle of the canal
const LM_A_MID := -15.9
const LM_BX0 := -28.2      # L.2: the forked canal
const LM_BZ0 := -9.8
const LM_BX1 := -18.8
const LM_BZ1 := -0.6
const LM_BPX0 := -26.6     # the rectangle its water lies in: a stem from the west rim, and a bar across its east end
const LM_BPZ0 := -8.2
const LM_BPX1 := -20.7
const LM_BPZ1 := -1.8
const LM_B_BAR := -22.9    # the bar lies east of this line
const LM_B_ZC := -5.0      # the middle line of the stem
const LM_B_XC := -21.8     # the middle line of the bar
const LM_B_HALF := 1.1     # half the width of either
const LM_PX0 := -37.4      # the passage: the long road beside the blind water
const LM_PZ0 := -9.8
const LM_PX1 := -28.2
const LM_PZ1 := -5.4
const LM_PPX0 := -36.4
const LM_PPZ0 := -8.0
const LM_PPX1 := -29.2
const LM_PPZ1 := -6.2
const LM_CX0 := -46.4      # L.3: the court of the dead lamps
const LM_CZ0 := -9.8
const LM_CX1 := -37.4
const LM_CZ1 := -0.9
const LM_CPX0 := -44.2
const LM_CPZ0 := -7.7
const LM_CPX1 := -38.6
const LM_CPZ1 := -1.7
const LM_C_ZC := -4.7      # the stem of its path runs east from the west rim along this line
const LM_C_J := -41.6      # to the crossing here
const LM_C_LEG := 1.9      # each of the three arms is this long, with a lamp on an islet at its end
const LM_DX0 := -46.4      # L.4: the hall of the Great Lamp
const LM_DZ0 := -19.0
const LM_DX1 := -37.6
const LM_DZ1 := -9.8
const LM_DC := Vector3(-42.0, 0, -14.7)      # the middle of its round pool
const LM_DR := 2.7
const LM_GL := Vector3(-43.0, 0, -15.7)      # where the Great Lamp hangs: toward the north-west rim, so that the pool holds the whole of its twin
const LM_GL_UP := 1.7      # how high its foot hangs when it is up
const LM_BEAM_Y := 3.7     # the beam it hangs from
# a lamp on its gallows
const LM_POST_H := 2.25
const LM_ARM_Y := 2.16
const LM_RUN_Y := 2.07     # the chain runs along under the arm at this height
const LM_CAP_UP := 1.58    # the mouth of the cap when it hangs over the flame, and when it lies over it
const LM_CAP_DN := 1.07
const LM_RING_Y := 1.0     # the pull ring, hooked low on the post (the cap is up); it rises as the cap falls
const LM_LINK := 0.04      # a link of chain

var LM := {}      # the lamps, by name: see _lm_lamp
var LMW := {}     # for each water of this wing: the names of the lamps over it
var lm_glare_sh: Shader
var lm_flames: Array = []      # the flames, to keep them alive
var lm_oil := 0      # how many lamps' oil has run into the bowl of the Great Lamp
var lm_glow_a := 0.0      # how much of the Great Lamp's burning twin shows on the water

func _init() -> void:
	super._init(); wing_open["S"] = true

func _hollows() -> Array:
	return super._hollows() + [[LM_AX0 + 0.5, LM_AZ0 + 0.5, LM_AX1 - 0.5, LM_AZ1 - 0.5], [LM_BX0 + 0.5, LM_BZ0 + 0.5, LM_BX1 - 0.5, LM_BZ1 - 0.5],
		[LM_PX0 + 0.5, LM_PZ0 + 0.5, LM_PX1 - 0.5, LM_PZ1 - 0.5], [LM_CX0 + 0.5, LM_CZ0 + 0.5, LM_CX1 - 0.5, LM_CZ1 - 0.5], [LM_DX0 + 0.5, LM_DZ0 + 0.5, LM_DX1 - 0.5, LM_DZ1 - 0.5]]

func _wings() -> void:
	super._wings()
	_lm_shader()
	N["lm_run_fl"] = _lm_flame(self, Vector3(0, -50, 0), 0.001, 0.55)      # the small flame that runs along a runnel when oil goes elsewhere
	_lm_entry(); _lm_garden(); _lm_a(); _lm_b(); _lm_p(); _lm_c(); _lm_d()

# ---------------------------------------------------------------- small builders of this wing
## the glare of a flame on water: a soft warm disc that lies just over the surface, brightest in the middle. It
## covers whatever the water would show there. a: how much of it there is; rect1, rect2, circ: the water it lies on
func _lm_shader() -> void:
	lm_glare_sh = Shader.new()
	lm_glare_sh.code = """shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled;
uniform float a = 1.0; uniform float time_s = 0.0; uniform float ph = 0.0; uniform float deep = 0.0;
uniform vec4 rect1 = vec4(0.0); uniform vec4 rect2 = vec4(0.0); uniform vec3 circ = vec3(0.0);
varying vec3 wp;
void vertex(){ wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float inr(vec4 r, vec2 p){ return step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w); }
void fragment(){
	float d = length(UV - vec2(0.5)) * 2.0;
	float k = max(inr(rect1, wp.xz), inr(rect2, wp.xz));
	if (circ.z > 0.0) k = max(k, 1.0 - smoothstep(circ.z - 0.02, circ.z, length(wp.xz - circ.xy)));
	float body = 1.0 - smoothstep(0.66, 1.0, d);
	float live = 1.0 + 0.035 * sin(time_s * 1.3 + ph) + 0.02 * sin(wp.x * 4.0 + time_s * 0.8) * sin(wp.z * 3.3 - time_s * 0.6);
	vec3 c = mix(vec3(1.0, 0.86, 0.58), vec3(1.0, 0.975, 0.88), 1.0 - smoothstep(0.0, 0.75, d));
	c = mix(c, vec3(1.0, 0.62, 0.2), deep * smoothstep(0.1, 0.85, d));      // (deep: the glow of a flame that burns under the water)
	ALBEDO = c; ALPHA = clamp(a * k * body * 0.97 * live, 0.0, 1.0);
}"""

func _lm_glare(c: Vector3, r: float, clip: Array, lit: bool) -> ShaderMaterial:
	var q := QuadMesh.new(); q.size = Vector2(r * 2.0, r * 2.0); q.orientation = PlaneMesh.FACE_Y
	var m := ShaderMaterial.new(); m.shader = lm_glare_sh; m.render_priority = 2; timed.append(m)
	m.set_shader_parameter("a", 1.0 if lit else 0.0); m.set_shader_parameter("ph", c.x * 1.7 + c.z)
	var ri := 1
	for cl in clip:
		if cl is Vector3: m.set_shader_parameter("circ", cl)
		else: m.set_shader_parameter("rect%d" % ri, Vector4(cl[0], cl[1], cl[2], cl[3])); ri += 1
	prim(q, Vector3(c.x, 0.022, c.z), m).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return m

## the lines between the slabs of a floor, left out over the openings in it
func _lm_tiles(x0: float, z0: float, x1: float, z1: float, holes: Array, step := 1.0) -> void:
	var x := x0 + step
	while x < x1 - 0.1:
		for seg in _lm_cut(z0 + 0.1, z1 - 0.1, holes, x, true): blk(Vector3(x - 0.008, 0, seg[0]), Vector3(x + 0.008, 0.003, seg[1]), "shade")
		x += step
	var z := z0 + step
	while z < z1 - 0.1:
		for seg in _lm_cut(x0 + 0.1, x1 - 0.1, holes, z, false): blk(Vector3(seg[0], 0, z - 0.008), Vector3(seg[1], 0.003, z + 0.008), "shade")
		z += step

func _lm_cut(a: float, b: float, holes: Array, at: float, along_z: bool) -> Array:
	var segs := [[a, b]]
	for h in holes:
		var lo: float = h[1] if along_z else h[0]; var hi: float = h[3] if along_z else h[2]
		var c0: float = h[0] if along_z else h[1]; var c1: float = h[2] if along_z else h[3]
		if at <= c0 or at >= c1: continue
		var out := []
		for s in segs:
			if s[1] <= lo or s[0] >= hi: out.append(s); continue
			if s[0] < lo: out.append([s[0], lo])
			if s[1] > hi: out.append([hi, s[1]])
		segs = out
	return segs

## the hollow under a pool, made as deep as what stands over that water is tall
func _lm_pit(sky: String, depth: float) -> void:
	var pit := get_node_or_null(sky) as MeshInstance3D
	if pit == null: return
	var pm := pit.mesh as BoxMesh
	pm.size = Vector3(pm.size.x, depth, pm.size.z); pit.position.y = -0.185 - depth * 0.5

## one flat face (three or four corners) for the mesh that bb_end closes, wound so that it is seen from the side `out` points to
func _lm_face(pts: Array, out: Vector3) -> void:
	var nn: Vector3 = ((pts[1] as Vector3) - (pts[0] as Vector3)).cross((pts[2] as Vector3) - (pts[0] as Vector3))
	if nn.dot(out) < 0.0: pts = pts.duplicate(); pts.reverse()
	face_q(pts, out)

## a slanted bar between two points, square in section (into the mesh that bb_end closes)
func _lm_bar(a: Vector3, b: Vector3, w: float) -> void:
	var d := (b - a).normalized()
	var s := d.cross(Vector3.UP)
	if s.length() < 0.01: s = Vector3(1, 0, 0)
	s = s.normalized() * w; var u := s.cross(d).normalized() * w
	_lm_face([a + s - u, b + s - u, b + s + u, a + s + u], s); _lm_face([a - s - u, b - s - u, b - s + u, a - s + u], -s)
	_lm_face([a - s + u, b - s + u, b + s + u, a + s + u], u); _lm_face([a - s - u, b - s - u, b + s - u, a + s - u], -u)

## a flame: a small bright tongue, and its halo. It is kept whole in one node, which is scaled to nothing when it is out
func _lm_flame(parent: Node, at: Vector3, sc := 1.0, glow := 0.9) -> Node3D:
	var n := Node3D.new(); n.position = at; parent.add_child(n)
	turned(Vector3.ZERO, [[0.0, 0.0], [0.045, 0.03], [0.055, 0.075], [0.03, 0.15], [0.0, 0.215]], "gold", 8, n).material_override = mat(Color(1.0, 0.72, 0.26))
	turned(Vector3(0, 0.015, 0), [[0.0, 0.0], [0.024, 0.025], [0.028, 0.06], [0.014, 0.11], [0.0, 0.15]], "gold", 8, n).material_override = mat(Color(1.0, 0.95, 0.72))
	if glow > 0.0:
		var hl := halo(glow, Color(1.0, 0.8, 0.45, 0.5)); hl.position = Vector3(0, 0.1, 0); n.add_child(hl)
	n.scale = Vector3.ONE * sc
	lm_flames.append([n, at.x * 3.1 + at.z * 1.7])
	return n

## a run of chain: so many links, laid along a way by _lm_chain_lay
func _lm_chain_new(parent: Node, n: int, twin: bool, link := LM_LINK) -> MultiMeshInstance3D:
	var mm := MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D
	var bm := BoxMesh.new(); bm.size = Vector3(link * 0.72, link * 1.25, link * 0.28); mm.mesh = bm
	mm.instance_count = n
	var mi := MultiMeshInstance3D.new(); mi.multimesh = mm; mi.extra_cull_margin = 6.0
	mi.material_override = under_mat(Color("c2a25a")) if twin else pal("gold", "flat")
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi

## lays the links along a way (points in the chain's own frame), one after another from its first point; every other
## link stands across the one before. Links left over at the far end are drawn in to nothing
func _lm_chain_lay(mi: MultiMeshInstance3D, pts: Array, link := LM_LINK) -> void:
	var mm := mi.multimesh
	var seg := 0; var s0 := 0.0      # the piece of the way the link lies on, and where that piece begins
	var ln: float = (pts[1] as Vector3).distance_to(pts[0])
	for i in mm.instance_count:
		var s := link * (i + 0.5)
		while seg < pts.size() - 2 and s > s0 + ln:
			s0 += ln; seg += 1; ln = (pts[seg + 1] as Vector3).distance_to(pts[seg])
		if s > s0 + ln:
			mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ONE * 0.001), pts[pts.size() - 1])); continue
		var d: Vector3 = ((pts[seg + 1] as Vector3) - (pts[seg] as Vector3)).normalized()
		var side := d.cross(Vector3(0.3, 0.2, 1.0).normalized()).normalized()
		var bas := Basis(side, d, side.cross(d))
		if i % 2 == 1: bas = bas * Basis(Vector3.UP, PI * 0.5)
		mm.set_instance_transform(i, Transform3D(bas, (pts[seg] as Vector3) + d * (s - s0)))

## A lamp on its gallows: a bronze post at the rim, an arm out over the water, and under the arm's end a stirrup that
## carries the bowl with its flame. A bell-shaped cap slides in the stirrup over the flame; its chain runs over two
## small wheels, along under the arm and down the post to a ring hooked low on it. Unhooked, the ring rises and the
## cap falls over the flame; pulled down and hooked again, the cap lifts. Under the flame its glare lies on the water.
## id: its name. wid: the water it hangs over. post: where the post stands. dir: the way the arm reaches. arm: how
## far. r: the reach of its glare. opt: "foot": the footings of that water its glare covers; "clip": the water its
## glare lies on (rectangles [x0, z0, x1, z1], or a Vector3(cx, cz, radius)); "lit": false for a dead lamp;
## "ring": false for one whose chain is cut short, out of reach
func _lm_lamp(id: String, wid: String, post: Vector3, dir: Vector3, arm: float, r: float, opt := {}) -> void:
	var yw := atan2(-dir.z, dir.x)
	var side := Vector3(1, 0, 0) if absf(dir.z) > 0.5 else Vector3(0, 0, 1)      # the chain comes down on a side of the post that the eye sees
	var zs: float = (Basis(Vector3.UP, yw).inverse() * side).z * 0.1
	var lit: bool = opt.get("lit", true); var has_ring: bool = opt.get("ring", true)
	var tip := post + dir * arm
	var L := {"id": id, "w": wid, "post": post, "tip": tip, "dir": dir, "arm": arm, "r": r, "lit": lit, "cap": false, "u": 0.0, "foot": opt.get("foot", []), "zs": zs,
		"ring_at": post + side * 0.1 + Vector3(0, LM_RING_Y, 0), "stand": post + side * 0.5 - dir * 0.15, "has_ring": has_ring}
	var n_links := int((LM_RUN_Y - LM_CAP_UP - 0.28 + arm + (LM_RUN_Y - LM_RING_Y - 0.06 if has_ring else 0.3)) / LM_LINK) + 1
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var sfx := "_m" if twin else ""
		var hold := Node3D.new(); hold.position = post; hold.rotation.y = yw; both.add_child(hold)
		blk(Vector3(-0.15, 0, -0.15), Vector3(0.15, 0.09, 0.15), "shade", hold); blk(Vector3(-0.11, 0.09, -0.11), Vector3(0.11, 0.17, 0.11), "stone", hold)
		bb(Vector3(-0.04, 0.17, -0.04), Vector3(0.04, LM_POST_H, 0.04))      # the post, with its collars
		for cy in [0.17, 0.82, LM_POST_H - 0.3, LM_POST_H]: bb(Vector3(-0.058, cy, -0.058), Vector3(0.058, cy + 0.045, 0.058))
		bb(Vector3(0.0, LM_ARM_Y - 0.03, -0.03), Vector3(arm + 0.05, LM_ARM_Y + 0.03, 0.03))      # the arm, and the bar across its end from which the stirrup hangs
		bb(Vector3(arm - 0.03, LM_ARM_Y - 0.03, -0.29), Vector3(arm + 0.03, LM_ARM_Y + 0.03, 0.29))
		_lm_bar(Vector3(0.03, LM_ARM_Y - 0.62, 0), Vector3(minf(0.62, arm * 0.5), LM_ARM_Y - 0.03, 0), 0.022)      # its stay
		for e in [-1.0, 1.0]:      # the stirrup: two rods down, and the bar under the bowl
			bb(Vector3(arm - 0.012, 1.0, e * 0.262 - 0.012), Vector3(arm + 0.012, LM_ARM_Y - 0.03, e * 0.262 + 0.012))
		bb(Vector3(arm - 0.02, 1.0, -0.27), Vector3(arm + 0.02, 1.03, 0.27))
		for wx in [arm - 0.055, 0.055]:      # the straps of the two wheels
			var wz := 0.0 if wx > 0.1 else zs
			bb(Vector3(wx - 0.008, LM_RUN_Y - 0.06, wz - 0.03), Vector3(wx + 0.008, LM_ARM_Y - 0.03, wz - 0.022)); bb(Vector3(wx - 0.008, LM_RUN_Y - 0.06, wz + 0.022), Vector3(wx + 0.008, LM_ARM_Y - 0.03, wz + 0.03))
		if has_ring:      # the hook the ring is held by
			bb(Vector3(-0.012, LM_RING_Y - 0.03, minf(0.0, zs * 1.25)), Vector3(0.012, LM_RING_Y - 0.012, maxf(0.0, zs * 1.25)))
		bb_end("gold", hold)
		ball(Vector3(0, LM_POST_H + 0.1, 0), 0.06, pal("gold", "flat2" if twin else "flat"), hold)
		turned(Vector3(arm, 1.03, 0), [[0.0, 0.0], [0.1, 0.0], [0.185, 0.09], [0.2, 0.13], [0.17, 0.13], [0.09, 0.045], [0.0, 0.045]], "gold", 14, hold)      # the bowl
		cyl(Vector3(arm, 1.105, 0), 0.13, 0.13, 0.012, pal("dark", "flat2" if twin else "flat"), 12, hold)      # its dark inside
		L["flame" + sfx] = _lm_flame(hold, Vector3(arm, 1.09, 0), 1.0 if lit else 0.001, 0.0 if twin else 0.95)
		var wheels := []
		for wx in [arm - 0.055, 0.055]:
			var wh := Node3D.new(); wh.position = Vector3(wx, LM_RUN_Y - 0.055, 0.0 if wx > 0.1 else zs); wh.rotation.x = PI * 0.5; hold.add_child(wh)
			var inner := Node3D.new(); wh.add_child(inner); inner.position = Vector3(0, -0.011, 0); _gear(inner, 0.055, 8, 0.022); wheels.append(inner)
		L["wheels" + sfx] = wheels
		var cap := Node3D.new(); cap.position = Vector3(arm, LM_CAP_UP, 0); hold.add_child(cap)      # the cap: a bell, with a bar across its head that rides on the two rods
		turned(Vector3.ZERO, [[0.232, 0.0], [0.225, 0.035], [0.18, 0.17], [0.075, 0.25], [0.0, 0.27]], "gold", 14, cap)
		turned(Vector3.ZERO, [[0.243, 0.0], [0.243, 0.03], [0.232, 0.03]], "dark", 14, cap)
		bb(Vector3(-0.016, 0.225, -0.285), Vector3(0.016, 0.25, 0.285)); bb(Vector3(-0.02, 0.26, -0.02), Vector3(0.02, 0.3, 0.02)); bb_end("gold", cap)
		L["capn" + sfx] = cap
		L["chain" + sfx] = _lm_chain_new(hold, n_links, twin)
		if has_ring:
			var ring := Node3D.new(); ring.position = Vector3(0, LM_RING_Y, zs); hold.add_child(ring)
			var tm := TorusMesh.new(); tm.inner_radius = 0.034; tm.outer_radius = 0.052; tm.rings = 12; tm.ring_segments = 6
			var rg := prim(tm, Vector3(0, 0.0, 0), pal("gold", "flat2" if twin else "flat"), ring); rg.rotation.x = PI * 0.5
			if absf(zs) > 0.01: rg.rotation.y = PI * 0.5
			L["ring" + sfx] = ring
		L["hold" + sfx] = hold
	L["gm"] = _lm_glare(tip, r, opt.get("clip", []), lit)
	LM[id] = L
	if not LMW.has(wid): LMW[wid] = []
	LMW[wid].append(id)
	_lm_cap_set(0.0, id)

## the cap of a lamp at u of its way down (0: up over the flame, 1: lying over it): cap, chain, ring and wheels, in
## the court and in the water
func _lm_cap_set(u: float, id: String) -> void:
	var L: Dictionary = LM[id]
	var d := (LM_CAP_UP - LM_CAP_DN) * u
	var arm: float = L.arm; var zs: float = L.zs
	for sfx in ["", "_m"]:
		(L["capn" + sfx] as Node3D).position.y = LM_CAP_UP - d
		var pts := [Vector3(arm, LM_CAP_UP - d + 0.29, 0), Vector3(arm, LM_RUN_Y, 0), Vector3(0, LM_RUN_Y, zs)]
		if L.has_ring:
			(L["ring" + sfx] as Node3D).position.y = LM_RING_Y + d
			pts.append(Vector3(0, LM_RING_Y + d + 0.05, zs))
		else: pts.append(Vector3(0, LM_RUN_Y - 0.3, zs))
		_lm_chain_lay(L["chain" + sfx], pts)
		for wh in L["wheels" + sfx]: (wh as Node3D).rotation.y = d / 0.055
	L.u = u

## where the pull ring of a lamp hangs now
func _lm_ring_pos(id: String) -> Vector3:
	return (LM[id].ring as Node3D).global_position

## an islet with a lamp standing on it: a low round stone, a short column, a bowl. (Dead until it is lit.)
func _lm_islet_lamp(id: String, wid: String, at: Vector3, r: float, opt := {}) -> void:
	var lit: bool = opt.get("lit", false)
	var L := {"id": id, "w": wid, "post": at, "tip": at, "r": r, "lit": lit, "cap": false, "u": 0.0, "foot": opt.get("foot", []), "has_ring": false, "islet": true, "bowl": at + Vector3(0, 1.0, 0)}
	for both in [self, mroot]:
		var twin: bool = both == mroot
		turned(at, [[0.36, 0.0], [0.36, 0.05], [0.33, 0.07], [0.0, 0.07]], "stone", 18, both)
		turned(at + Vector3(0, 0.07, 0), [[0.15, 0.0], [0.15, 0.05], [0.1, 0.09], [0.075, 0.5], [0.085, 0.78], [0.12, 0.82], [0.12, 0.86], [0.0, 0.86]], "stone", 12, both)
		turned(at + Vector3(0, 0.93, 0), [[0.0, 0.0], [0.1, 0.0], [0.185, 0.09], [0.2, 0.13], [0.17, 0.13], [0.09, 0.045], [0.0, 0.045]], "gold", 14, both)
		cyl(at + Vector3(0, 1.005, 0), 0.13, 0.13, 0.012, pal("dark", "flat2" if twin else "flat"), 12, both)
		L["flame" + ("_m" if twin else "")] = _lm_flame(both, at + Vector3(0, 0.99, 0), 1.0 if lit else 0.001, 0.0 if twin else 0.95)
	L["gm"] = _lm_glare(at, r, opt.get("clip", []), lit)
	LM[id] = L
	if not LMW.has(wid): LMW[wid] = []
	LMW[wid].append(id)

## a lever on a stone that stands in the water: the stone, two cheeks, and the handle (kept under N[key], N[key + "_m"])
func _lm_lever(key: String, at: Vector3, yaw: float) -> void:
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var st := blk(at + Vector3(-0.36, 0, -0.36), at + Vector3(0.36, 0.06, 0.36), "stone", both); st.material_override = pal("stone", "flat2" if twin else "flat")
		blk(at + Vector3(-0.39, 0, -0.39), at + Vector3(0.39, 0.025, 0.39), "shade", both)
		var hold := Node3D.new(); hold.position = at + Vector3(0, 0.06, 0); hold.rotation.y = yaw; both.add_child(hold)
		for e in [-1.0, 1.0]: bb(Vector3(-0.09, 0, e * 0.05 - 0.012), Vector3(0.09, 0.2, e * 0.05 + 0.012))
		bb(Vector3(-0.13, 0, -0.09), Vector3(0.13, 0.03, 0.09)); bb_end("gold", hold)
		var h := Node3D.new(); h.position = Vector3(0, 0.15, 0); h.rotation.z = 0.5; hold.add_child(h)
		bb(Vector3(-0.02, -0.04, -0.02), Vector3(0.02, 0.78, 0.02)); bb(Vector3(-0.03, -0.03, -0.065), Vector3(0.03, 0.03, 0.065)); bb_end("gold", h)
		ball(Vector3(0, 0.82, 0), 0.055, pal("crim", "flat2" if twin else "flat"), h)
		N[key + ("_m" if twin else "")] = h

## stepping stones that lie only in the water, in a row from a to b (and one larger stone where ways meet)
func _lm_stones(a: Vector3, b: Vector3) -> void:
	var n := maxi(1, int(round(a.distance_to(b) / 0.47)))
	var along_x := absf(b.x - a.x) > absf(b.z - a.z)
	for i in n:
		var c := a.lerp(b, (i + 0.5) / n)
		var sb := blk(Vector3(-0.17, 0, -0.25) if along_x else Vector3(-0.25, 0, -0.17), Vector3(0.17, 0.05, 0.25) if along_x else Vector3(0.25, 0.05, 0.17), "stone", mroot)
		sb.material_override = under_mat(Color("857fa4")); sb.position += Vector3(c.x, 0, c.z)

func _lm_stone(c: Vector3, half := 0.3) -> void:
	blk(Vector3(c.x - half, 0, c.z - half), Vector3(c.x + half, 0.05, c.z + half), "stone", mroot).material_override = under_mat(Color("857fa4"))

## a gutter of bronze for the oil, level, between two points (along x or along z), with its twin in the water
func _lm_gutter(a: Vector3, b: Vector3) -> void:
	var lo := Vector3(minf(a.x, b.x), a.y, minf(a.z, b.z)); var hi := Vector3(maxf(a.x, b.x), a.y, maxf(a.z, b.z))
	for both in [self, mroot]:
		blk(lo + Vector3(-0.05, 0, -0.05), hi + Vector3(0.05, 0.05, 0.05), "gold", both)
		blk(lo + Vector3(-0.025, 0.05, -0.025), hi + Vector3(0.025, 0.054, 0.025), "dark", both)

# ---------------------------------------------------------------- the entry: the causeway from the door, the landing, the way back from the head-gate
func _lm_entry() -> void:
	floor_plain(-31.3, UZ1, -28.7, LM_LZ0, 0.0)
	for e in [-1.0, 1.0]: parapet(Vector3(-30.0 + e * 1.2, 0, UZ1 + 0.1), Vector3(-30.0 + e * 1.2, 0, LM_LZ0 - 0.1))
	floor_plain(LM_LX0, LM_LZ0, LM_LX1, LM_LZ1)
	floor_plain(LM_DX1, -17.2, LM_LX0, -15.6, 0.0)
	channel(Vector3(-30.0, 0, UZ1), Vector3(-30.0, 0, LM_CH_Z + 0.5)); channel(Vector3(LM_DX1, 0, LM_CH_Z), Vector3(-29.5, 0, LM_CH_Z))
	channel(Vector3(-29.5, 0, -18.05), Vector3(LM_LX1, 0, -18.05))      # the side channel, which the stoa's own water used
	parapet(Vector3(LM_LX0 + 0.1, 0, LM_LZ0 + 0.1), Vector3(-31.2, 0, LM_LZ0 + 0.1)); parapet(Vector3(LM_LX0 + 0.1, 0, LM_LZ0 + 0.1), Vector3(LM_LX0 + 0.1, 0, -17.3))
	parapet(Vector3(LM_DX1 + 0.5, 0, -17.1), Vector3(LM_LX0 - 0.1, 0, -17.1))
	stele("lm_stele_0", Vector3(LM_LX0 + 0.8, 0, LM_LZ0 + 0.85), 0.0, ["I did not hide these mirrors.\nI set a flame before each one.", "The gate to the west is sealed with wax.\nWax fears one thing."])
	urn(Vector3(-28.75, 0, LM_LZ0 + 0.5), 1.0); urn(Vector3(LM_LX0 + 0.5, 0, -17.6), 0.8, "rose")

# ---------------------------------------------------------------- the garden inside the ring of courts
## One terrace joins the landing, the way to the head-gate and the courts round it: a paved garden with three beds
## of grass, olives (the oil of the lamps was pressed here), the old mill, and lamp standards that no runnel reaches
func _lm_garden() -> void:
	floor_plain(LM_DX1, -15.6, LM_LX0, LM_PZ0); floor_plain(LM_LX0, LM_LZ1, LM_AX0, LM_PZ0); floor_plain(LM_AX0, LM_AZ1, -20.4, LM_BZ0)
	for b in [[-36.9, -14.2, -33.7, -11.7], [-32.1, -14.2, -29.0, -11.7], [-28.2, -13.0, -21.0, -11.7]]:
		blk(Vector3(b[0], 0, b[1]), Vector3(b[2], 0.05, b[3]), "shade"); blk(Vector3(b[0] + 0.09, 0, b[1] + 0.09), Vector3(b[2] - 0.09, 0.062, b[3] - 0.09), "leaf2")
	tree(Vector3(-31.35, 0.05, -13.45), 0.9); tree(Vector3(-29.75, 0.05, -12.45), 0.8); tree(Vector3(-27.2, 0.05, -12.35), 0.8); tree(Vector3(-36.2, 0.05, -12.2), 0.85, "leaf3")
	bush(Vector3(-34.2, 0.05, -13.7), 0.9); bush(Vector3(-25.4, 0.05, -12.4), 1.0); bush(Vector3(-30.6, 0.05, -13.9), 0.8)
	# the olive mill, in the west bed: a round trough, a post, a beam, and the stone on its edge
	var mc := Vector3(-35.15, 0.05, -13.05)
	turned(mc, [[0.78, 0.0], [0.78, 0.26], [0.66, 0.26], [0.62, 0.16], [0.22, 0.16], [0.18, 0.3], [0.0, 0.3]], "stone", 22)
	turned(mc + Vector3(0, 0.0, 0), [[0.82, 0.0], [0.82, 0.06], [0.78, 0.06]], "shade", 22)
	blk(mc + Vector3(-0.06, 0.3, -0.06), mc + Vector3(0.06, 1.0, 0.06), "wood"); blk(mc + Vector3(-0.95, 0.56, -0.045), mc + Vector3(0.75, 0.65, 0.045), "wood")
	var ms := cyl(Vector3.ZERO, 0.4, 0.4, 0.2, pal("shade"), 18); ms.rotation.z = PI * 0.5; ms.position = mc + Vector3(0.42, 0.56, 0)
	var ms2 := cyl(Vector3.ZERO, 0.09, 0.09, 0.22, pal("gold"), 10); ms2.rotation.z = PI * 0.5; ms2.position = mc + Vector3(0.42, 0.56, 0)
	_look_add("", mc, 1.0, ["an olive mill. the stone has not turned in years", "the oil of all these lamps was pressed here"])
	# two tall lamp standards by the path, dead: no runnel comes to them
	for sx in [-33.55, -32.25]:
		var sp := Vector3(sx, 0, -14.0)
		blk(sp + Vector3(-0.14, 0, -0.14), sp + Vector3(0.14, 0.1, 0.14), "shade"); blk(sp + Vector3(-0.1, 0.1, -0.1), sp + Vector3(0.1, 0.2, 0.1), "stone")
		bb(sp + Vector3(-0.03, 0.2, -0.03), sp + Vector3(0.03, 2.7, 0.03))
		for cy in [0.2, 1.1, 2.0, 2.62]: bb(sp + Vector3(-0.05, cy, -0.05), sp + Vector3(0.05, cy + 0.04, 0.05))
		bb_end("gold")
		turned(sp + Vector3(0, 2.7, 0), [[0.0, 0.0], [0.07, 0.0], [0.17, 0.08], [0.19, 0.12], [0.16, 0.12], [0.07, 0.04], [0.0, 0.04]], "gold", 12)
		cyl(sp + Vector3(0, 2.77, 0), 0.12, 0.12, 0.012, pal("dark"), 12)
	_look_add("", Vector3(-33.55, 0, -14.0), 0.9, ["a tall lamp, cold", "he lit only the ones that hang over water"])
	# what is left of an older colonnade, in the east bed
	column(Vector3(-22.3, 0.05, -12.4), 1.5, 0.14, true); column(Vector3(-23.7, 0.05, -12.3), 0.8, 0.14, true)
	var dr := cyl(Vector3.ZERO, 0.13, 0.13, 0.7, pal("stone"), 12); dr.rotation.z = PI * 0.5; dr.rotation.y = 0.5; dr.position = Vector3(-24.6, 0.19, -12.55)
	_look_add("", Vector3(-22.3, 0, -12.4), 1.5, ["older columns, broken off", "the house was open here once"])
	urn(Vector3(-21.3, 0.05, -12.4), 0.9); urn(Vector3(-28.9, 0, -10.3), 1.0, "rose"); urn(Vector3(-36.6, 0.05, -11.95), 0.8)

# ---------------------------------------------------------------- L.1 put it out so that it can see
func _lm_a() -> void:
	_pool_court(LM_AX0, LM_AZ0, LM_AX1, LM_AZ1, LM_APX0, LM_APZ0, LM_APX1, LM_APZ1, "stone", "PoolSkyLmA")
	_lm_pit("PoolSkyLmA", 2.6)
	_lm_tiles(LM_AX0, LM_AZ0, LM_AX1, LM_AZ1, [[LM_APX0 - 0.08, LM_APZ0 - 0.08, LM_APX1 + 0.08, LM_APZ1 + 0.08]])
	glass(LM_APX0, LM_APZ0, LM_APX1, LM_APZ1)
	var xs: float = LM_A_LAMPS[1] + 0.55      # the line of stones that lies only in the water, from the bank to the lever's stone
	var bank := R(LM_AX0, -18.35, -19.25, -17.75)
	W["LM1"] = {"r": [LM_APX0, LM_APZ0, LM_APX1, LM_APZ1], "heads": [bank],
		"foot": {"bank": bank, "st": R(xs - 0.25, -17.8, xs + 0.25, -16.35, false), "isl": R(xs - 0.3, -16.4, xs + 0.3, -15.75, false)}}
	WL.append("LM1")
	var clip := [[LM_APX0, LM_APZ0, LM_APX1, LM_APZ1]]
	for i in 3:
		_lm_lamp("a%d" % (i + 1), "LM1", Vector3(LM_A_LAMPS[i], 0, LM_APZ0 - 0.3), Vector3(0, 0, 1), LM_A_MID - (LM_APZ0 - 0.3), 1.42, {"clip": clip, "foot": ["st", "isl"] if i == 1 else []})
	_lm_stones(Vector3(xs, 0, LM_APZ0 + 0.04), Vector3(xs, 0, -16.13))      # the stones: in the water only
	_lm_lever("lm_lev1", Vector3(xs, 0, -15.75), PI * 0.5)
	# the stoa: columns along the north edge, a beam along their heads, a rafter to each lamp's post
	stoa(LM_AX0 + 0.25, LM_AZ0 + 0.02, -20.3, LM_AZ0 + 0.44)      # (it stops short of the corner, where an unfinished statue of her stands)
	parapet(Vector3(-20.3, 0, LM_AZ0 + 0.1), Vector3(LM_AX1 - 0.1, 0, LM_AZ0 + 0.1))
	for i in 3:
		for both in [self, mroot]:
			var rf := blk(Vector3(-0.035, -0.035, -0.6), Vector3(0.035, 0.035, 0.6), "wood", both); rf.position = Vector3(LM_A_LAMPS[i], 2.45, (LM_AZ0 + 0.44 + LM_APZ0 - 0.3) * 0.5); rf.rotation.x = 0.26
	channel(Vector3(LM_AX0, 0, -18.05), Vector3(-19.1, 0, -18.05)); channel(Vector3(-19.6, 0, -18.05), Vector3(-19.6, 0, LM_AZ1))
	sluice("lm_s1", Vector3(-19.6, 0, LM_AZ1 - 0.15), false, 0.5)
	parapet(Vector3(LM_AX1 - 0.1, 0, LM_AZ0 + 0.1), Vector3(LM_AX1 - 0.1, 0, LM_AZ1 - 0.1)); parapet(Vector3(LM_AX0 + 0.1, 0, LM_AZ1 - 0.1), Vector3(-20.27, 0, LM_AZ1 - 0.1))
	parapet(Vector3(LM_AX0 + 0.1, 0, LM_LZ1 + 0.1), Vector3(LM_AX0 + 0.1, 0, LM_AZ1 - 0.1))
	stele("lm_stele_1", Vector3(-27.75, 0, -16.3), PI * 0.5, ["Light on water is a blind eye.\nI keep them burning.", "Each has its cap, and a chain\nto let it fall. I never do."])
	_look_add("", Vector3(xs, 0.06, -15.75), 0.9, ["the lever of the sluice, on a stone in the canal", "a lamp burns right over it"])
	_look_add("", Vector3(LM_A_LAMPS[0], 0, LM_APZ0 - 0.3), 2.1, ["a lamp, burning by day over the canal", "a bronze cap hangs over its flame, on a chain"])
	urn(Vector3(-19.35, 0, -14.0), 0.9); urn(Vector3(-27.8, 0, -13.9), 1.0, "rose")
	# the short causeway on to the next court
	floor_plain(-20.4, LM_AZ1, -18.8, LM_BZ0, 0.0); channel(Vector3(-19.6, 0, LM_AZ1), Vector3(-19.6, 0, LM_BZ0))
	for e in [-20.3, -18.9]: parapet(Vector3(e, 0, LM_AZ1 + 0.1), Vector3(e, 0, LM_BZ0 - 0.1))

# ---------------------------------------------------------------- L.2 the oil goes elsewhere
func _lm_b() -> void:
	var n0 := get_child_count()
	_pool_court(LM_BX0, LM_BZ0, LM_BX1, LM_BZ1, LM_BPX0, LM_BPZ0, LM_BPX1, LM_BPZ1, "stone", "PoolSkyLmB")
	_lm_pit("PoolSkyLmB", 2.6)
	var z0 := LM_B_ZC - LM_B_HALF; var z1 := LM_B_ZC + LM_B_HALF
	var kr := 0.07
	for ch in get_children().slice(n0):      # the water is not a rectangle here: the kerb of the rectangle goes, and one is laid round the stem and the bar
		var mi := ch as MeshInstance3D
		if mi != null and mi.mesh is BoxMesh and absf((mi.mesh as BoxMesh).size.y - 0.04) < 0.001 and absf(mi.position.y - 0.02) < 0.001: remove_child(mi); mi.queue_free()
	# the two blocks of floor that leave of the water a stem and a bar
	blk(Vector3(LM_BPX0, -0.13, LM_BPZ0), Vector3(LM_B_BAR - kr, 0.0, z0 - kr), "stone"); blk(Vector3(LM_BPX0, -0.13, z1 + kr), Vector3(LM_B_BAR - kr, 0.0, LM_BPZ1), "stone")
	for kb in [[LM_BPX0 - kr, z0 - kr, LM_B_BAR, z0], [LM_BPX0 - kr, z1, LM_B_BAR, z1 + kr], [LM_BPX0 - kr, z0, LM_BPX0, z1], [LM_B_BAR - kr, LM_BPZ0 - kr, LM_B_BAR, z0 - kr], [LM_B_BAR - kr, z1 + kr, LM_B_BAR, LM_BPZ1 + kr],
			[LM_B_BAR, LM_BPZ0 - kr, LM_BPX1 + kr, LM_BPZ0], [LM_B_BAR, LM_BPZ1, LM_BPX1 + kr, LM_BPZ1 + kr], [LM_BPX1, LM_BPZ0, LM_BPX1 + kr, LM_BPZ1]]:
		blk(Vector3(kb[0], -0.13, kb[1]), Vector3(kb[2], 0.04, kb[3]), "shade")
	var stem := [LM_BPX0, z0, LM_B_BAR, z1]; var bar := [LM_B_BAR, LM_BPZ0, LM_BPX1, LM_BPZ1]
	_lm_tiles(LM_BX0, LM_BZ0, LM_BX1, LM_BZ1, [[stem[0] - 0.08, stem[1] - 0.08, stem[2], stem[3] + 0.08], [bar[0] - 0.08, bar[1] - 0.08, bar[2] + 0.08, bar[3] + 0.08]])
	glass(stem[0], stem[1], stem[2], stem[3]); glass(bar[0], bar[1], bar[2], bar[3])
	var zc := LM_B_ZC; var xc := LM_B_XC
	var head := R(-27.75, zc - 0.9, -27.05, zc + 0.9)
	W["LM2"] = {"r": [LM_BPX0, LM_BPZ0, LM_BPX1, LM_BPZ1], "heads": [head], "dry": [R(LM_BPX0 - 0.1, LM_BPZ0 - 0.1, LM_B_BAR, z0), R(LM_BPX0 - 0.1, z1, LM_B_BAR, LM_BPZ1 + 0.1)],
		"foot": {"head": head, "s0": R(-27.1, zc - 0.25, LM_BPX0 + 0.05, zc + 0.25),
			"s1": R(LM_BPX0 + 0.05, zc - 0.25, -24.65, zc + 0.25, false), "s2": R(-24.65, zc - 0.25, -22.75, zc + 0.25, false),
			"j1": R(-22.75, zc - 0.25, xc + 0.25, zc + 0.25, false), "j2": R(xc - 0.25, zc - 0.95, xc + 0.25, zc + 0.95, false),
			"s4": R(xc - 0.25, zc - 2.85, xc + 0.25, zc - 0.95), "lev": R(xc - 0.25, zc - 2.75, xc + 0.9, zc - 2.15),
			"s5": R(xc - 0.25, zc + 0.95, xc + 0.25, zc + 2.95), "shelf": R(xc - 0.25, zc + 2.4, xc + 0.9, zc + 2.95)}}
	WL.append("LM2")
	var clip := [stem, bar]
	_lm_lamp("b1", "LM2", Vector3(-25.6, 0, z0 - 0.3), Vector3(0, 0, 1), 1.4, 1.0, {"clip": clip, "foot": ["s1"]})
	_lm_lamp("b2", "LM2", Vector3(-23.7, 0, z0 - 0.3), Vector3(0, 0, 1), 1.4, 1.0, {"clip": clip, "foot": ["s2"]})
	_lm_lamp("b3", "LM2", Vector3(LM_BPX1 + 0.3, 0, zc), Vector3(-1, 0, 0), LM_BPX1 + 0.3 - xc, 1.0, {"clip": clip, "foot": ["j1", "j2"]})
	_lm_lamp("b4", "LM2", Vector3(xc, 0, LM_BPZ0 - 0.3), Vector3(0, 0, 1), zc - 1.9 - (LM_BPZ0 - 0.3), 1.0, {"clip": clip, "foot": ["s4", "lev"], "lit": false})
	_lm_lamp("b5", "LM2", Vector3(xc, 0, LM_BPZ1 + 0.3), Vector3(0, 0, -1), LM_BPZ1 + 0.3 - (zc + 1.9), 1.0, {"clip": clip, "foot": ["s5", "shelf"], "lit": false})
	# the path that lies only in the water: slabs down the middle of the stem and of the bar
	_lm_stones(Vector3(LM_BPX0 + 0.04, 0, zc), Vector3(xc - 0.36, 0, zc)); _lm_stone(Vector3(xc, 0, zc))
	_lm_stones(Vector3(xc, 0, zc - 0.36), Vector3(xc, 0, zc - 2.8)); _lm_stones(Vector3(xc, 0, zc + 0.36), Vector3(xc, 0, zc + 2.9))
	_lm_lever("lm_lev2", Vector3(xc + 0.58, 0, zc - 2.45), 0.0)
	# the shelf that only the water has, in the south corner of the bar, and on it her own small lamp
	var sh := blk(Vector3(xc + 0.2, 0, zc + 2.4), Vector3(xc + 0.95, 0.05, zc + 2.95), "stone", mroot); sh.material_override = under_mat(Color("857fa4"))
	var keep := Node3D.new(); keep.position = Vector3(xc + 0.58, 0.05, zc + 2.68); mroot.add_child(keep); N["lm_keep"] = keep
	turned(Vector3.ZERO, [[0.0, 0.0], [0.05, 0.0], [0.085, 0.035], [0.07, 0.07], [0.03, 0.075], [0.0, 0.06]], "terra", 10, keep).material_override = under_mat(Color("c7774e"))
	blk(Vector3(0.06, 0.03, -0.015), Vector3(0.13, 0.05, 0.015), "terra", keep).material_override = under_mat(Color("c7774e"))
	# the runnel: from the oil jar on its pier at the west edge, over the path, to the fork; and the jar
	var gy := LM_ARM_Y + 0.03
	_lm_gutter(Vector3(LM_BX0 + 0.3, gy, zc), Vector3(xc, gy, zc)); _lm_gutter(Vector3(xc, gy, zc - 1.9), Vector3(xc, gy, zc + 1.9))
	for both in [self, mroot]:
		blk(Vector3(LM_BX0 + 0.06, 0, zc - 0.17), Vector3(LM_BX0 + 0.4, gy - 0.1, zc + 0.17), "stone", both); blk(Vector3(LM_BX0 + 0.03, 0, zc - 0.2), Vector3(LM_BX0 + 0.43, 0.12, zc + 0.2), "shade", both)
		blk(Vector3(LM_BX0 + 0.03, gy - 0.1, zc - 0.2), Vector3(LM_BX0 + 0.43, gy - 0.04, zc + 0.2), "shade", both)
		turned(Vector3(LM_BX0 + 0.2, gy - 0.04, zc), [[0.0, 0.0], [0.09, 0.0], [0.17, 0.12], [0.18, 0.26], [0.11, 0.4], [0.07, 0.44], [0.1, 0.5], [0.0, 0.5]], "gold", 14, both)
	N["lm_run_b"] = [Vector3(-25.6, gy + 0.06, zc), Vector3(-23.7, gy + 0.06, zc), Vector3(xc, gy + 0.06, zc), Vector3(xc, gy + 0.06, zc - 1.9), Vector3(xc, gy + 0.06, zc + 1.9)]
	sluice("lm_s2", Vector3(LM_BX0 + 0.15, 0, -8.8), true, 0.5)
	channel(Vector3(-19.6, 0, LM_BZ0), Vector3(-19.6, 0, -8.3)); channel(Vector3(LM_BX0, 0, -8.8), Vector3(-19.1, 0, -8.8))
	parapet(Vector3(LM_BX1 - 0.1, 0, LM_BZ0 + 0.1), Vector3(LM_BX1 - 0.1, 0, LM_BZ1 - 0.1)); parapet(Vector3(LM_BX0 + 0.1, 0, LM_BZ1 - 0.1), Vector3(LM_BX1 - 0.1, 0, LM_BZ1 - 0.1))
	parapet(Vector3(LM_BX0 + 0.1, 0, -8.03), Vector3(LM_BX0 + 0.1, 0, zc - 0.3)); parapet(Vector3(LM_BX0 + 0.1, 0, zc + 0.3), Vector3(LM_BX0 + 0.1, 0, LM_BZ1 - 0.1))
	stele("lm_stele_2", Vector3(-24.6, 0, z1 + 0.9), 0.0, ["The oil must go somewhere.\nSo there is always light.", "Three flames, never fewer.\nShut one and another wakes."])
	_look_add("", Vector3(LM_BX0 + 0.2, 0, zc), gy + 0.4, ["a jar of oil, on a pier. one runnel leaves it", "enough for three flames, and it never runs dry"])
	_look_add("", Vector3(xc + 0.58, 0.06, zc - 2.45), 0.9, ["the lever of the next gate", "the path to it lies only in the water"])
	urn(Vector3(-23.6, 0, LM_BZ1 - 0.45), 1.0); cypress(Vector3(-26.0, 0, z1 + 1.3), 2.3); urn(Vector3(-19.3, 0, LM_BZ1 - 0.5), 0.9, "rose")

# ---------------------------------------------------------------- the passage: the long road under the lamps
func _lm_p() -> void:
	_pool_court(LM_PX0, LM_PZ0, LM_PX1, LM_PZ1, LM_PPX0, LM_PPZ0, LM_PPX1, LM_PPZ1, "stone", "PoolSkyLmP")
	_lm_pit("PoolSkyLmP", 2.6)
	_lm_tiles(LM_PX0, LM_PZ0, LM_PX1, LM_PZ1, [[LM_PPX0 - 0.08, LM_PPZ0 - 0.08, LM_PPX1 + 0.08, LM_PPZ1 + 0.08]])
	glass(LM_PPX0, LM_PPZ0, LM_PPX1, LM_PPZ1)
	var bank := R(LM_PX0, -9.15, LM_PX1, -8.45)
	W["LMP"] = {"r": [LM_PPX0, LM_PPZ0, LM_PPX1, LM_PPZ1], "heads": [bank], "foot": {"bank": bank}}
	WL.append("LMP")
	var clip := [[LM_PPX0, LM_PPZ0, LM_PPX1, LM_PPZ1]]
	var mid := (LM_PPZ0 + LM_PPZ1) * 0.5
	for i in 4: _lm_lamp("p%d" % (i + 1), "LMP", Vector3(-30.25 - 1.8 * i, 0, LM_PPZ0 - 0.3), Vector3(0, 0, 1), mid - (LM_PPZ0 - 0.3), 1.22, {"clip": clip, "ring": false})
	stoa(LM_PX0, LM_PZ0 - 0.21, -20.4, LM_PZ0 + 0.21)      # one long colonnade between the garden and the water, as far as the next court's corner
	for i in 4:
		for both in [self, mroot]:
			var rf := blk(Vector3(-0.035, -0.035, -0.66), Vector3(0.035, 0.035, 0.66), "wood", both); rf.position = Vector3(-30.25 - 1.8 * i, 2.45, (LM_PZ0 + 0.21 + LM_PPZ0 - 0.3) * 0.5); rf.rotation.x = 0.23
	# the runnel over the lamps: it comes from the east, and at the west end it is cut
	_lm_gutter(Vector3(LM_PX1 - 0.4, LM_ARM_Y + 0.03, mid), Vector3(-36.0, LM_ARM_Y + 0.03, mid))
	channel(Vector3(LM_PX0, 0, -8.8), Vector3(LM_PX1, 0, -8.8), 0.4)
	parapet(Vector3(LM_PX0 + 0.1, 0, LM_PZ1 - 0.1), Vector3(LM_PX1 - 0.1, 0, LM_PZ1 - 0.1))
	_look_add("", Vector3(-32.05, 0, LM_PPZ0 - 0.3), 2.0, ["the chain of this one is cut short", "no one was meant to put these out"])
	_look_add("", Vector3(-34.55, 0, LM_PZ0 + 0.25), 2.3, ["a long roof of nothing but beams", "light the whole length of the water. she walks here alone"])

# ---------------------------------------------------------------- L.3 the flame passes below
func _lm_c() -> void:
	_pool_court(LM_CX0, LM_CZ0, LM_CX1, LM_CZ1, LM_CPX0, LM_CPZ0, LM_CPX1, LM_CPZ1, "stone", "PoolSkyLmC")
	_lm_pit("PoolSkyLmC", 2.6)
	_lm_tiles(LM_CX0, LM_CZ0, LM_CX1, LM_CZ1, [[LM_CPX0 - 0.08, LM_CPZ0 - 0.08, LM_CPX1 + 0.08, LM_CPZ1 + 0.08]])
	glass(LM_CPX0, LM_CPZ0, LM_CPX1, LM_CPZ1)
	var zc := LM_C_ZC; var xj := LM_C_J; var lg := LM_C_LEG
	var head := R(-45.8, zc - 1.0, -44.65, zc + 1.0)
	W["LM3"] = {"r": [LM_CPX0, LM_CPZ0, LM_CPX1, LM_CPZ1], "heads": [head],
		"foot": {"head": head, "n1": R(-44.7, zc - 0.25, -43.95, zc + 0.25), "n2": R(-43.95, zc - 0.25, -42.05, zc + 0.25),
			"j": R(-42.05, zc - 0.25, xj + 0.25, zc + 0.25),
			"f1": R(xj + 0.25, zc - 0.25, xj + 0.95, zc + 0.25), "f2": R(xj + 0.95, zc - 0.25, xj + lg - 0.4, zc + 0.25),
			"a1": R(xj - 0.25, zc - 0.95, xj + 0.25, zc - 0.25), "a2": R(xj - 0.25, zc - lg + 0.4, xj + 0.25, zc - 0.95),
			"b1": R(xj - 0.25, zc + 0.25, xj + 0.25, zc + 0.95), "b2": R(xj - 0.25, zc + 0.95, xj + 0.25, zc + lg - 0.4)}}
	WL.append("LM3")
	var clip := [[LM_CPX0, LM_CPZ0, LM_CPX1, LM_CPZ1]]
	_lm_lamp("cn", "LM3", Vector3(LM_CPX0 - 0.3, 0, zc), Vector3(1, 0, 0), 1.5, 0.95, {"clip": clip, "foot": ["n2"], "lit": false})
	_lm_islet_lamp("cf", "LM3", Vector3(xj + lg, 0, zc), 0.95, {"clip": clip, "foot": ["f2"]})
	_lm_islet_lamp("ca", "LM3", Vector3(xj, 0, zc - lg), 0.95, {"clip": clip, "foot": ["a2"]})
	_lm_islet_lamp("cb", "LM3", Vector3(xj, 0, zc + lg), 0.95, {"clip": clip, "foot": ["b2"]})
	_lm_stones(Vector3(LM_CPX0 + 0.04, 0, zc), Vector3(xj - 0.36, 0, zc)); _lm_stone(Vector3(xj, 0, zc))
	_lm_stones(Vector3(xj + 0.36, 0, zc), Vector3(xj + lg - 0.4, 0, zc)); _lm_stones(Vector3(xj, 0, zc - 0.36), Vector3(xj, 0, zc - lg + 0.4)); _lm_stones(Vector3(xj, 0, zc + 0.36), Vector3(xj, 0, zc + lg - 0.4))
	# the way in from the passage: a grille that stands open, the runnel cut beside it, and the last lamp that burns:
	# a bowl on a short column at the north rim, with a jar of dry reeds by it
	sluice("lm_g3", Vector3(LM_CX1, 0, -8.8), true, 0.5); (N["lm_g3"] as Node3D).position.y = -1.75
	var lp := Vector3(-38.9, 0, -9.42)
	turned(lp, [[0.17, 0.0], [0.17, 0.05], [0.11, 0.1], [0.08, 0.5], [0.09, 0.8], [0.13, 0.85], [0.13, 0.9], [0.0, 0.9]], "stone", 12)
	turned(lp + Vector3(0, 0.9, 0), [[0.0, 0.0], [0.1, 0.0], [0.185, 0.09], [0.2, 0.13], [0.17, 0.13], [0.09, 0.045], [0.0, 0.045]], "gold", 14)
	N["lm_last"] = _lm_flame(self, lp + Vector3(0, 0.96, 0), 1.0, 0.95)
	var jar := lp + Vector3(-0.55, 0, 0.05)
	turned(jar, [[0.0, 0.0], [0.09, 0.0], [0.14, 0.12], [0.13, 0.3], [0.085, 0.4], [0.1, 0.44], [0.07, 0.44], [0.07, 0.03], [0.0, 0.03]], "terra", 12)
	for i in 7:
		var rd := blk(Vector3(-0.006, 0, -0.006), Vector3(0.006, 0.62 + 0.05 * (i % 3), 0.006), "rope"); rd.position += jar + Vector3(0.03 * cos(i * 0.9), 0.3, 0.03 * sin(i * 0.9)); rd.rotation = Vector3(0.1 * sin(i * 2.1), 0, 0.1 * cos(i * 1.3))
	solids.append(Vector3(lp.x, lp.z, 0.34)); solids.append(Vector3(jar.x, jar.z, 0.3))
	# her reed: one stalk with a small flame at its tip, held by her or by her reflection (see carry)
	var reed := Node3D.new(); reed.position = Vector3(0, -50, 0); add_child(reed); reed.visible = false; N["lm_reed"] = reed
	blk(Vector3(-0.006, 0.12, -0.006), Vector3(0.006, 0.68, 0.006), "rope", reed)
	N["lm_reed_fl"] = _lm_flame(reed, Vector3(0, 0.67, 0), 0.5, 0.55)
	# the door to the hall, in the north edge at the end of the west walk: four bolts across it, each sealed with wax
	var dc := Vector3(-45.2, 0, LM_CZ0 + 0.15)
	sluice("lm_door3", dc, false, 0.6, 2.0)
	(N["lm_door3"] as Node3D).add_child(_lm_plate(1.16, 1.9))
	for i in 4:
		var by := 0.42 + 0.4 * i
		var bolt := Node3D.new(); bolt.position = dc + Vector3(0, by, 0.05); add_child(bolt); N["lm_bolt%d" % i] = bolt
		bb(Vector3(-0.72, -0.025, -0.02), Vector3(0.3, 0.025, 0.02)); bb(Vector3(0.22, -0.06, -0.02), Vector3(0.3, 0.06, 0.035)); bb_end("dark", bolt)
		var seal := Node3D.new(); seal.position = dc + Vector3(0.39, by, 0.07); add_child(seal); N["lm_seal%d" % i] = seal
		var sd := cyl(Vector3.ZERO, 0.085, 0.085, 0.03, pal("crim", "flat"), 12, seal); sd.rotation.x = PI * 0.5; sd.position = Vector3.ZERO
		var sd2 := cyl(Vector3.ZERO, 0.05, 0.05, 0.03, pal("crim", "flat"), 10, seal); sd2.rotation.x = PI * 0.5; sd2.position = Vector3(0, 0, 0.012)
	parapet(Vector3(-44.43, 0, LM_CZ0 + 0.1), Vector3(LM_CX1 - 0.1, 0, LM_CZ0 + 0.1)); parapet(Vector3(LM_CX0 + 0.4, 0, LM_CZ1 - 0.1), Vector3(LM_CX1 - 0.1, 0, LM_CZ1 - 0.1)); parapet(Vector3(LM_CX1 - 0.1, 0, -8.03), Vector3(LM_CX1 - 0.1, 0, LM_CZ1 - 0.1))
	channel(Vector3(-45.2, 0, -8.8), Vector3(LM_CX1, 0, -8.8), 0.4); channel(Vector3(-45.2, 0, LM_CZ0), Vector3(-45.2, 0, -8.4), 0.4)
	stele("lm_stele_3", Vector3(-41.3, 0, -9.4), 0.0, ["Past this gate I let them die.\nNo one walks there.", "A flame lit on the way out\nshuts the way in."])
	_look_add("", lp, 1.2, ["the last lamp that burns", "dry reeds stand in a jar beside it"])
	_look_add("", Vector3(-36.0, 0, LM_PPZ0 - 0.3), 2.2, ["here the runnel is cut", "past it no oil runs"])
	cypress(Vector3(LM_CX0 + 0.75, 0, LM_CZ1 - 0.6), 2.5); urn(Vector3(-37.95, 0, -2.0), 0.9)

## a plate of bronze that closes a grille (the leaf of a door): w wide, h tall, standing on the floor in the leaf's own plane
func _lm_plate(w: float, h: float) -> Node3D:
	var n := Node3D.new()
	blk(Vector3(-w * 0.5, 0.02, -0.014), Vector3(w * 0.5, h, 0.014), "gold", n)
	for e in [-1.0, 1.0]: blk(Vector3(e * w * 0.25 - w * 0.2, 0.25, 0.014), Vector3(e * w * 0.25 + w * 0.2, h - 0.2, 0.02), "dark", n)
	return n

# ---------------------------------------------------------------- L.4 the Great Lamp
func _lm_d() -> void:
	var c := LM_DC; var rr := LM_DR
	var n0 := get_child_count()
	_pool_court(LM_DX0, LM_DZ0, LM_DX1, LM_DZ1, c.x - rr, c.z - rr, c.x + rr, c.z + rr, "stone", "PoolSkyLmD")
	for ch in get_children().slice(n0):      # the pool is round: the square kerb goes, and the corners are floor
		var mi := ch as MeshInstance3D
		if mi != null and mi.mesh is BoxMesh and absf((mi.mesh as BoxMesh).size.y - 0.04) < 0.001 and absf(mi.position.y - 0.02) < 0.001: remove_child(mi); mi.queue_free()
	_lm_pit("PoolSkyLmD", 3.6)
	var seg := 48
	for i in seg:      # the four corners of the square opening, filled up to the round of the pool
		var a0 := TAU * i / seg; var a1 := TAU * (i + 1) / seg
		var p0 := c + Vector3(cos(a0), 0, sin(a0)) * rr; var p1 := c + Vector3(cos(a1), 0, sin(a1)) * rr
		var am := (a0 + a1) * 0.5
		var q0 := c + Vector3(cos(a0), 0, sin(a0)) * (rr / maxf(absf(cos(a0)), absf(sin(a0)))); var q1 := c + Vector3(cos(a1), 0, sin(a1)) * (rr / maxf(absf(cos(a1)), absf(sin(a1))))
		if int(floor((a0 + PI * 0.25) / (PI * 0.5))) != int(floor((a1 - 0.0001 + PI * 0.25) / (PI * 0.5))):      # this piece holds a corner of the square
			var cr := c + Vector3(signf(cos(am)) * rr, 0, signf(sin(am)) * rr)
			_lm_face([p0, q0, cr], Vector3.UP); _lm_face([p0, cr, q1], Vector3.UP); _lm_face([p0, q1, p1], Vector3.UP)
		else: _lm_face([p0, q0, q1, p1], Vector3.UP)
		_lm_face([p0, p1, p1 + Vector3(0, -0.2, 0), p0 + Vector3(0, -0.2, 0)], c - p0)
	bb_end("stone")
	turned(c, [[rr + 0.08, 0.0], [rr + 0.08, 0.04], [rr, 0.04], [rr, 0.0]], "shade", seg)
	_lm_tiles(LM_DX0, LM_DZ0, LM_DX1, LM_DZ1, [[c.x - rr - 0.08, c.z - rr - 0.08, c.x + rr + 0.08, c.z + rr + 0.08]])
	var cm := CylinderMesh.new(); cm.top_radius = rr; cm.bottom_radius = rr; cm.height = 0.002; cm.radial_segments = seg; cm.cap_bottom = false
	var g := ShaderMaterial.new(); g.shader = shaders["glass"]; timed.append(g)
	g.set_shader_parameter("lost_a", 0.0); g.set_shader_parameter("blur_px", 0.6); g.set_shader_parameter("lod", 0.0)
	prim(cm, Vector3(c.x, 0.011, c.z), g).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var ring := [R(LM_DX0 + 0.6, -18.4, -38.05, -17.85), R(-45.8, -18.4, -45.3, -10.85), R(-45.8, -11.55, -38.05, -10.85), R(-38.85, -18.4, -38.05, -10.85), R(-40.35, -17.85, -39.6, -17.15)]
	W["LM4"] = {"r": [c.x - rr, c.z - rr, c.x + rr, c.z + rr], "round": true, "c": c, "rad": rr, "heads": ring, "foot": {}}      # (a round water is said the way ch1 says it)
	WL.append("LM4")
	var clip := [Vector3(c.x, c.z, rr)]
	_lm_lamp("dn", "LM4", c + Vector3(0, 0, -3.0), Vector3(0, 0, 1), 1.6, 1.5, {"clip": clip})
	_lm_lamp("dw", "LM4", c + Vector3(-3.0, 0, 0), Vector3(1, 0, 0), 1.6, 1.5, {"clip": clip})
	_lm_lamp("de", "LM4", c + Vector3(3.0, 0, 0), Vector3(-1, 0, 0), 1.6, 1.2, {"clip": clip})
	_lm_lamp("ds", "LM4", c + Vector3(0, 0, 3.0), Vector3(0, 0, -1), 1.6, 1.2, {"clip": clip})
	for both in [self, mroot]:      # the oil comes to the four down thin pipes from the runnel on the beam, over the middle
		for q in ["dn", "dw", "de", "ds"]:
			var tp: Vector3 = LM[q].tip
			_lm_bar(Vector3(tp.x, LM_ARM_Y + 0.04, tp.z), LM_GL + Vector3(0, LM_BEAM_Y, 0), 0.013)
		bb_end("gold", both)
	# the gantry: two tall columns, on the north rim and on the west, and a beam between them over the pool
	var cn := LM_GL + Vector3(1.85, 0, -1.85); var cw := LM_GL + Vector3(-1.95, 0, 1.95)
	N["lm_cn"] = cn; N["lm_cw"] = cw
	var by := LM_BEAM_Y
	for both in [self, mroot]:
		var twin: bool = both == mroot
		var flat := "flat2" if twin else "flat"
		for cp in [cn, cw]:
			turned(cp, [[0.22, 0.0], [0.22, 0.08], [0.17, 0.14], [0.13, 0.2], [0.115, by - 0.25], [0.15, by - 0.18], [0.17, by - 0.1], [0.17, by], [0.0, by]], "stone", 14, both)
		var bm := blk(Vector3(-2.9, 0, -0.07), Vector3(2.9, 0.16, 0.07), "wood", both); bm.position = (cn + cw) * 0.5 + Vector3(0, by + 0.08, 0); bm.rotation.y = PI * 0.25
		var bm2 := blk(Vector3(-2.93, 0, -0.085), Vector3(2.93, 0.03, 0.085), "gold", both); bm2.position = (cn + cw) * 0.5 + Vector3(0, by + 0.17, 0); bm2.rotation.y = PI * 0.25      # the runnel lies along the beam
		# the wheel over the lamp, and the one at the head of the north column
		for wp in [LM_GL + Vector3(0, by - 0.28, 0), cn + Vector3(-0.2, by - 0.28, 0.2)]:
			var wh := Node3D.new(); wh.position = wp; wh.rotation = Vector3(PI * 0.5, PI * 0.25, 0); both.add_child(wh)
			var inner := Node3D.new(); inner.position = Vector3(0, -0.02, 0); wh.add_child(inner); _gear(inner, 0.13, 12, 0.04)
		# the Great Lamp: a wide bowl on three chains from a ring; its foot is at this node
		var gl := Node3D.new(); gl.position = LM_GL + Vector3(0, LM_GL_UP, 0); both.add_child(gl); N["lm_gl" + ("_m" if twin else "")] = gl
		turned(Vector3.ZERO, [[0.0, 0.0], [0.16, 0.0], [0.2, 0.05], [0.4, 0.2], [0.5, 0.36], [0.52, 0.42], [0.46, 0.42], [0.36, 0.26], [0.16, 0.12], [0.0, 0.12]], "gold", 20, gl)
		turned(Vector3(0, 0.36, 0), [[0.53, 0.0], [0.53, 0.035], [0.5, 0.035]], "dark", 20, gl)
		for i in 3:
			var a := TAU * i / 3.0 + 0.5
			var ch := _lm_chain_new(gl, 16, twin, 0.06)
			_lm_chain_lay(ch, [Vector3(cos(a) * 0.48, 0.42, sin(a) * 0.48), Vector3(0, 1.3, 0)], 0.06)
		var tm := TorusMesh.new(); tm.inner_radius = 0.045; tm.outer_radius = 0.075; tm.rings = 12; tm.ring_segments = 6
		prim(tm, Vector3(0, 1.33, 0), pal("gold", flat), gl).rotation = Vector3(PI * 0.5, PI * 0.25, 0)
		var oil := cyl(Vector3.ZERO, 0.4, 0.4, 0.01, mat(Color("b8802c")), 20, gl); oil.position = Vector3(0, 0.3 if twin else 0.13, 0)      # the oil in its bowl: above, there is none
		if not twin: oil.scale = Vector3(0.001, 1, 0.001)
		N["lm_gl_oil" + ("_m" if twin else "")] = oil
		N["lm_gl_fl" + ("_m" if twin else "")] = _lm_flame(gl, Vector3(0, 0.3, 0), 3.4 if twin else 0.001, 0.0 if twin else 1.9)
		N["lm_gl_ch" + ("_m" if twin else "")] = _lm_chain_new(both, 150, twin, 0.06)
		# the windlass, at the foot of the north column: a drum on an axle, a handwheel at its east end
		var axle := Node3D.new(); axle.position = cn + Vector3(0.1, 1.1, 0.2); both.add_child(axle); N["lm_axle" + ("_m" if twin else "")] = axle
		var a1 := cyl(Vector3.ZERO, 0.03, 0.03, 1.1, pal("gold", flat), 10, axle); a1.rotation.z = PI * 0.5; a1.position = Vector3.ZERO
		var dr := cyl(Vector3.ZERO, 0.1, 0.1, 0.36, pal("wood", flat), 12, axle); dr.rotation.z = PI * 0.5; dr.position = Vector3(-0.3, 0, 0)
		for i in 5:
			var rc := cyl(Vector3.ZERO, 0.118, 0.118, 0.05, pal("gold", flat), 12, axle); rc.rotation.z = PI * 0.5; rc.position = Vector3(-0.42 + 0.06 * i, 0, 0)
		var rt := Node3D.new(); rt.position = Vector3(0.2, 0, 0); rt.rotation.z = -PI * 0.5; axle.add_child(rt); _gear(rt, 0.16, 12, 0.03)      # the ratchet wheel, beside the east cheek
		var hw := Node3D.new(); hw.position = Vector3(0.52, 0, 0); axle.add_child(hw)
		prop_model("winch_wheel", hw, 0.0, 0.0, twin, false, "wood:wood,rope:linen,gold:gold,stone:stone").scale = Vector3.ONE * 1.25
		for e in [-0.55, 0.3]:      # its two cheeks
			blk(cn + Vector3(0.1 + e - 0.03, 0, 0.2 - 0.09), cn + Vector3(0.1 + e + 0.03, 1.22, 0.2 + 0.09), "wood", both)
			blk(cn + Vector3(0.1 + e - 0.06, 0, 0.2 - 0.13), cn + Vector3(0.1 + e + 0.06, 0.1, 0.2 + 0.13), "shade", both)
		# the pawl that holds it: a small bronze tooth on the east cheek, lying in the ratchet's teeth
		var pw := blk(Vector3(-0.1, -0.015, -0.015), Vector3(0.1, 0.015, 0.015), "gold", both); pw.position = cn + Vector3(0.36, 1.31, 0.2 + 0.1); pw.rotation.x = 0.5
	N["lm_hub"] = cn + Vector3(0.62, 1.1, 0.2)
	# the light of the flame that burns in the water: it lies on the surface where that flame is seen, and is lost in the glare of the four
	var gq := QuadMesh.new(); gq.size = Vector2(1.7, 1.7); gq.orientation = PlaneMesh.FACE_Y
	var gwm := ShaderMaterial.new(); gwm.shader = lm_glare_sh; gwm.render_priority = 3; timed.append(gwm)
	gwm.set_shader_parameter("a", 0.0); gwm.set_shader_parameter("deep", 1.0); gwm.set_shader_parameter("circ", Vector3(c.x, c.z, rr))
	N["lm_gl_glow"] = prim(gq, LM_GL + Vector3(0, 0.026, 0), gwm); (N["lm_gl_glow"] as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_lm_gl_set(LM_GL_UP)
	# the head-gate, in the east edge: beyond it the channel runs to the landing. A bar across its piers, and on the
	# bar the great seal of wax
	var gc := Vector3(LM_DX1 - 0.15, 0, LM_CH_Z)
	sluice("lm_head", gc, true, 0.6, 1.7)
	(N["lm_head"] as Node3D).add_child(_lm_plate(1.16, 1.6))
	var bar := Node3D.new(); bar.position = gc + Vector3(0.05, 1.32, 0); add_child(bar); N["lm_headbar"] = bar
	blk(Vector3(-0.03, -0.06, -0.8), Vector3(0.03, 0.06, 0.8), "dark", bar)
	var seal := Node3D.new(); seal.position = gc + Vector3(0.1, 1.32, 0); add_child(seal); N["lm_gseal"] = seal
	var s1 := cyl(Vector3.ZERO, 0.3, 0.3, 0.07, pal("crim", "flat"), 18, seal); s1.rotation.z = PI * 0.5; s1.position = Vector3.ZERO
	var s2 := cyl(Vector3.ZERO, 0.19, 0.19, 0.07, pal("crim", "flat"), 14, seal); s2.rotation.z = PI * 0.5; s2.position = Vector3(0.025, 0, 0)
	var s3 := cyl(Vector3.ZERO, 0.11, 0.11, 0.05, pal("gold", "flat"), 12, seal); s3.rotation.z = PI * 0.5; s3.position = Vector3(0.06, 0, 0)      # his stamp in it
	channel(Vector3(c.x + 2.05, 0, LM_CH_Z), Vector3(LM_DX1, 0, LM_CH_Z))
	# the water that will run: a band down the channel, drawn out from the pool to the landing, and from there north to the atrium
	var w1 := Node3D.new(); w1.position = Vector3(c.x + 2.05, 0.009, LM_CH_Z); add_child(w1); N["lm_run_w1"] = w1
	var len1 := -29.55 - (c.x + 2.05)
	var q1 := QuadMesh.new(); q1.size = Vector2(len1, 0.9); q1.orientation = PlaneMesh.FACE_Y
	prim(q1, Vector3(len1 * 0.5, 0, 0), water(Vector2(-2.4, 0.0)), w1); w1.scale.x = 0.001; w1.visible = false
	var w2 := Node3D.new(); w2.position = Vector3(-30.0, 0.0095, LM_CH_Z + 0.45); add_child(w2); N["lm_run_w2"] = w2
	var len2 := LM_CH_Z + 0.45 + 27.4
	var q2 := QuadMesh.new(); q2.size = Vector2(0.9, len2); q2.orientation = PlaneMesh.FACE_Y
	prim(q2, Vector3(0, 0, -len2 * 0.5), water(Vector2(0.0, 2.4)), w2); w2.scale.z = 0.001; w2.visible = false
	# no walls: a colonnade along the north side of the hall, and one down the whole west side of the wing (this court and the next)
	stoa(LM_DX0, LM_DZ0, LM_DX1, LM_DZ0 + 0.42, 2.6); stoa(LM_DX0, LM_DZ0 + 0.42, LM_DX0 + 0.42, LM_CZ1 - 0.02, 2.6)
	parapet(Vector3(LM_DX1 - 0.1, 0, LM_DZ0 + 0.5), Vector3(LM_DX1 - 0.1, 0, -17.17)); parapet(Vector3(LM_DX1 - 0.1, 0, -15.63), Vector3(LM_DX1 - 0.1, 0, LM_DZ1))
	channel(Vector3(-45.2, 0, -11.2), Vector3(-45.2, 0, LM_DZ1), 0.4)
	stele("lm_stele_4", Vector3(-44.6, 0, -17.3), 0.0, ["The great one stays dark.\nIts heat is bad for my seal.", "It hangs dry. All the oil\ngoes to the four."])
	_look_add("", gc + Vector3(0.1, 0, 0), 1.7, ["the head-gate of the channel, sealed with wax", "his stamp is in the seal"])
	_look_add("", cw, 2.6, ["a great lamp hangs from the beam, dark and dry", "in the water it burns"])
	urn(Vector3(-39.5, 0, -12.2), 1.0); urn(Vector3(-44.5, 0, -12.0), 0.9, "rose")

## the Great Lamp hangs with its foot y over the water; its chain runs up over the wheel, along under the beam, and
## down the north column to the drum of the windlass
func _lm_gl_set(y: float) -> void:
	var cn: Vector3 = N["lm_cn"]
	var by := LM_BEAM_Y - 0.15      # under the beam, over the tops of the two wheels
	for sfx in ["", "_m"]:
		(N["lm_gl" + sfx] as Node3D).position.y = y
		var top := Vector3(LM_GL.x, by, LM_GL.z); var col := cn + Vector3(-0.2, by, 0.2)
		var pts := [Vector3(LM_GL.x, y + 1.4, LM_GL.z), top, col, cn + Vector3(-0.2, 1.2, 0.2)]
		_lm_chain_lay(N["lm_gl_ch" + sfx], pts, 0.06)
		(N["lm_axle" + sfx] as Node3D).rotation.x = (LM_GL_UP - y) * 6.0
	(N["lm_gl_glow"] as Node3D).position = LM_GL + Vector3(y + 0.6, 0.026, y + 0.6)

# ---------------------------------------------------------------- what can be tapped in the wing, and where she can walk
func _wing_things() -> void:
	super._wing_things()
	for id in LM:      # every lamp whose chain has a ring: the ring, and the post it hangs on
		var L: Dictionary = LM[id]
		if not L.has_ring: continue
		var p: Vector3 = L.post
		objs["lm_c_" + id] = {"at": L.ring_at, "stand": L.stand, "mark": false, "hits": [L.ring_at + Vector3(0, -0.35, 0), L.ring_at + Vector3(0, 0.45, 0)]}
	var xs: float = LM_A_LAMPS[1] + 0.55
	objs["lm_lever1"] = {"at": Vector3(xs, -0.5, -15.75), "stand": Vector3(xs, 0, -17.75), "mark": false, "water": "LM1", "rstand": Vector3(xs, 0, -16.22),
		"hits": [Vector3(xs, 0.9, -15.75), Vector3(xs, 0.06, -15.75), Vector3(xs, -0.9, -15.75)]}
	var xc := LM_B_XC; var zc := LM_B_ZC
	objs["lm_lever2"] = {"at": Vector3(xc + 0.58, -0.5, zc - 2.45), "stand": Vector3(-27.4, 0, zc), "mark": false, "water": "LM2", "rstand": Vector3(xc + 0.02, 0, zc - 2.45),
		"hits": [Vector3(xc + 0.58, 0.9, zc - 2.45), Vector3(xc + 0.58, 0.06, zc - 2.45), Vector3(xc + 0.58, -0.9, zc - 2.45)]}
	objs["lm_keep"] = {"at": Vector3(xc + 0.58, -0.1, zc + 2.68), "stand": Vector3(-27.4, 0, zc), "mark": false, "water": "LM2", "rstand": Vector3(xc + 0.02, 0, zc + 2.68),
		"hits": [Vector3(xc + 0.58, -0.05, zc + 2.68), Vector3(xc + 0.58, -0.25, zc + 2.68)]}
	var jar := Vector3(-39.45, 0, -9.37)
	objs["lm_reed"] = {"at": jar + Vector3(0, 0.8, 0), "stand": Vector3(-39.2, 0, -8.82), "mark": false, "hits": [jar + Vector3(0, 0.1, 0), jar + Vector3(0, 1.0, 0), Vector3(-38.9, 1.15, -9.42), Vector3(-38.9, 0.2, -9.42)]}
	var c3 := Vector3(LM_C_J, 0, LM_C_ZC); var lg := LM_C_LEG
	for d in [["n", LM["cn"].tip, Vector3(-43.66, 0, LM_C_ZC)], ["f", c3 + Vector3(lg, 0, 0), c3 + Vector3(lg - 0.62, 0, 0)], ["a", c3 + Vector3(0, 0, -lg), c3 + Vector3(0, 0, -lg + 0.62)], ["b", c3 + Vector3(0, 0, lg), c3 + Vector3(0, 0, lg - 0.62)]]:
		var lp: Vector3 = d[1]
		objs["lm_d3" + d[0]] = {"at": Vector3(lp.x, -1.0, lp.z), "stand": Vector3(-44.65, 0, LM_C_ZC + 0.5), "mark": false, "water": "LM3", "rstand": d[2], "hits": [Vector3(lp.x, 1.25, lp.z), Vector3(lp.x, -1.3, lp.z)]}
	var hub: Vector3 = N["lm_hub"]
	objs["lm_wind"] = {"at": hub, "stand": Vector3(hub.x + 0.56, 0, hub.z), "mark": false, "hits": [hub + Vector3(-0.9, 0, 0), hub, hub + Vector3(0, -0.6, 0)]}
	objs["lm_great"] = {"at": LM_GL + Vector3(0, LM_GL_UP + 0.3, 0), "stand": Vector3(hub.x + 0.56, 0, hub.z), "mark": false, "hits": [LM_GL + Vector3(0, LM_GL_UP, 0), LM_GL + Vector3(0, LM_GL_UP + 1.3, 0)]}

func _wing_nav() -> void:
	super._wing_nav()
	rects["LmC0"] = R(-30.75, UZ1 + 0.5, -29.25, LM_LZ0 + 0.5)      # the causeway from the door
	rects["LmL"] = R(LM_LX0 + 0.45, LM_LZ0 + 0.45, LM_LX1, LM_LZ1 - 0.45)      # the landing
	rects["LmW"] = R(-37.3, -16.75, LM_LX0 + 0.45, -16.05)      # the way to the head-gate, and through it
	rects["LmHead"] = R(-38.45, -16.65, -37.3, -16.15, false)
	rects["LmG1"] = R(-37.15, -16.05, -32.45, -14.5); rects["LmG2"] = R(-32.45, -15.95, -28.85, -14.5)      # the garden: its north walk, the path between the beds, the walk along the colonnade
	rects["LmG3"] = R(-33.4, -14.5, -32.4, -11.4); rects["LmG4"] = R(-37.15, -11.4, -20.85, -10.35)
	rects["LmAn"] = R(LM_AX0, -18.35, -19.25, -17.75); rects["LmAe"] = R(-19.95, -18.35, -19.25, -13.75)      # L.1: the north bank, the east rim
	rects["LmS1"] = R(-19.85, -13.75, -19.35, -12.7, false); rects["LmAB"] = R(-19.95, -12.7, -19.25, -9.35)
	rects["LmBn"] = R(-27.75, -9.35, -19.25, -8.65); rects["LmBe"] = R(-20.25, -9.35, -19.25, -1.05); rects["LmBw"] = R(-27.75, -9.35, -27.05, -1.05)      # L.2
	rects["LmBs"] = R(-27.75, -1.35, -19.25, -1.05); rects["LmBnw"] = R(-27.05, -8.65, -23.25, -6.55); rects["LmBsw"] = R(-27.05, -3.45, -23.35, -1.35)
	rects["LmS2"] = R(-28.75, -9.05, -27.65, -8.55, false)
	rects["LmP"] = R(LM_PX0, -9.15, -28.75, -8.45)      # the passage
	rects["LmCn"] = R(-45.8, -9.05, LM_CX1, -8.25); rects["LmCw"] = R(-45.8, -9.05, -44.65, -1.35)      # L.3
	rects["LmD3"] = R(-45.45, -11.0, -44.95, -9.05, false)
	rects["LmDn"] = R(-45.8, -18.4, -38.05, -17.85); rects["LmDw"] = R(-45.8, -18.4, -45.3, -10.85)      # L.4: round the pool
	rects["LmDs"] = R(-45.8, -11.55, -38.05, -10.25); rects["LmDe"] = R(-38.85, -18.4, -38.05, -10.85)
	rects["LmDwl"] = R(-40.35, -17.85, -39.6, -17.15)      # before the windlass

func _ready() -> void:
	super._ready()
	for k in H:      # every body of hers can sink down on its heels (see LmKneel)
		var sk: Skeleton3D = H[k].sk
		if sk == null: continue
		var kn := LmKneel.new(); kn.main = self; sk.add_child(kn); sk.move_child(kn, 0)
	var ic := LmIcons.new(); ic.pk = pocket_ui; ic.set_anchors_preset(Control.PRESET_FULL_RECT); ic.mouse_filter = Control.MOUSE_FILTER_IGNORE; pocket_ui.get_parent().add_child(ic)
	if OS.get_environment("LMSNAP") != "":      # (to look at a run without drawing all of it: only every so-many-th frame is drawn, and kept as a small picture)
		lm_snap_every = int(OS.get_environment("LMSNAP")); RenderingServer.render_loop_enabled = false
	if "lamps" in OS.get_cmdline_user_args(): _play_lamps()

var lm_kneel := 0.0      # how far down she is on her heels (0 standing .. 1)
var lm_zone := ""      # the court whose whole water the view holds while she is in it ("": the view follows her)
var lm_zone_tw: Tween
var lm_cam_act := false      # an act of this wing is showing something: the view is its own for now
var lm_snap_every := 0
var lm_snap_f := 0

func _lm_snap() -> void:
	RenderingServer.render_loop_enabled = true
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	RenderingServer.render_loop_enabled = false
	img.save_jpg("%s/s_%05d.jpg" % [OS.get_environment("SHOT_DIR"), lm_snap_f], 0.8)

## she sinks down on her heels: the hips come down and a little back, and each leg folds so that its foot stays where
## it stood. Every copy of her does the same (her reflection under her, too)
class LmKneel extends SkeletonModifier3D:
	var main
	func _b(sk: Skeleton3D, n: String) -> int:
		var i := sk.find_bone("mixamorig:" + n)
		return i if i >= 0 else sk.find_bone("mixamorig_" + n)
	func _process_modification() -> void:
		if main == null: return
		var k: float = main.lm_kneel
		if k <= 0.001: return
		var sk := get_skeleton()
		var hi := _b(sk, "Hips"); var la := _b(sk, "LeftArm"); var ra := _b(sk, "RightArm")
		if hi < 0 or la < 0 or ra < 0: return
		var sc := maxf(sk.global_transform.basis.get_scale().y, 0.001)
		var left := (sk.get_bone_global_pose(la).origin - sk.get_bone_global_pose(ra).origin).normalized()
		var fwd := left.cross(Vector3.UP).normalized()
		var feet := []
		for sd in ["Left", "Right"]:
			var fi0 := _b(sk, sd + "Foot")
			if fi0 < 0: return
			feet.append(sk.get_bone_global_pose(fi0))
		var g := sk.get_bone_global_pose(hi)
		sk.set_bone_global_pose(hi, Transform3D(g.basis, g.origin - Vector3.UP * (0.5 * k / sc) - fwd * (0.12 * k / sc)))
		for i in 2:
			var sd: String = ["Left", "Right"][i]
			var ui := _b(sk, sd + "UpLeg"); var li := _b(sk, sd + "Leg"); var fi := _b(sk, sd + "Foot")
			if ui < 0 or li < 0: return
			var gu := sk.get_bone_global_pose(ui); var gl := sk.get_bone_global_pose(li); var gf := sk.get_bone_global_pose(fi)
			var l1 := (gl.origin - gu.origin).length(); var l2 := (gf.origin - gl.origin).length()
			var foot: Vector3 = (feet[i] as Transform3D).origin
			var to := foot - gu.origin; var d := clampf(to.length(), 0.02, (l1 + l2) * 0.999); var dir := to.normalized()
			var ca := clampf((l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d), -1.0, 1.0)
			var perp := fwd + left * (0.25 if i == 0 else -0.25); perp = (perp - dir * perp.dot(dir)).normalized()
			var knee := gu.origin + dir * (l1 * ca) + perp * (l1 * sqrt(maxf(1.0 - ca * ca, 0.0)))
			sk.set_bone_global_pose(ui, Transform3D(Basis(Quaternion((gl.origin - gu.origin).normalized(), (knee - gu.origin).normalized())) * gu.basis, gu.origin))
			var gl2 := sk.get_bone_global_pose(li); var gf2 := sk.get_bone_global_pose(fi)
			sk.set_bone_global_pose(li, Transform3D(Basis(Quaternion((gf2.origin - gl2.origin).normalized(), (foot - gl2.origin).normalized())) * gl2.basis, gl2.origin))
			sk.set_bone_global_pose(fi, Transform3D((feet[i] as Transform3D).basis, sk.get_bone_global_pose(fi).origin))

## In the courts where what a chain does is seen somewhere else, the view takes in the whole water and stays there
## while she walks its rims: it does not swing after her at every pull. [name, x0, z0, x1, z1, the middle it looks at, how
## much it holds, how far it still leans toward her]
const LM_ZONES := [["B", -28.0, -9.6, -18.8, -0.6, Vector3(-23.3, 0.4, -5.3), 10.6, 0.25], ["C", -46.4, -9.6, -37.6, -0.9, Vector3(-42.3, 0.4, -5.6), 9.8, 0.3], ["D", -46.4, -19.0, -37.9, -10.0, Vector3(-41.8, 0.7, -14.6), 10.4, 0.2]]
func _lm_view() -> void:
	if not started or ended or shot != null: return
	var z := ""; var zd := []
	for q in LM_ZONES:
		if pos.x > q[1] and pos.x < q[3] and pos.z > q[2] and pos.z < q[4]: z = q[0]; zd = q
	if z != lm_zone:
		lm_zone = z
		if lm_zone_tw != null and lm_zone_tw.is_valid(): lm_zone_tw.kill()
		if not lm_cam_act:
			lm_zone_tw = create_tween(); lm_zone_tw.tween_property(cam, "size", float(zd[6]) if z != "" else PLAY_SIZE, 2.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
			if z == "": cam_focus_on = false
	if z != "" and not lm_cam_act:
		var k: float = zd[7]
		cam_focus = (zd[5] as Vector3) * (1.0 - k) + Vector3(pos.x, 0.4, pos.z) * k; cam_focus_on = true

## the size the view goes back to when an act of this wing has shown what it had to
func _lm_size() -> float:
	for q in LM_ZONES:
		if q[0] == lm_zone: return q[6]
	return PLAY_SIZE

## the things of this wing that go into the pocket: a reed with a flame at its tip, and her own small lamp
class LmIcons extends Control:
	var pk
	func _process(_dt: float) -> void:
		queue_redraw()
	func _draw() -> void:
		if pk == null or pk.seen <= 0.001: return
		var k: float = size.x / 720.0
		var w := 78.0 * k; var gap := 14.0 * k
		var x0 := (size.x - (w * 3 + gap * 2)) * 0.5; var y0 := size.y - 212.0 * k
		for i in pk.items.size():
			var c := Rect2(x0 + i * (w + gap), y0, w, w).get_center(); var u: float = w * 0.5 * (1.0 + (0.22 * pk.pop if i == pk.items.size() - 1 else 0.0))
			var col := Color(1.0, 0.84, 0.48, pk.seen); var lw := 3.2 * k
			match pk.items[i]:
				"reed":      # a stalk, and a flame at its tip
					draw_line(c + Vector2(-0.38, 0.62) * u, c + Vector2(0.16, -0.22) * u, col, lw * 1.2)
					draw_colored_polygon(PackedVector2Array([c + Vector2(0.16, -0.16) * u, c + Vector2(0.4, -0.34) * u, c + Vector2(0.34, -0.7) * u, c + Vector2(0.1, -0.44) * u]), col)
				"lamp":      # a small clay lamp: a bowl, a spout, a flame
					draw_arc(c + Vector2(-0.08, 0.1) * u, 0.42 * u, 0.15, PI - 0.15, 20, col, lw * 1.2)
					draw_line(c + Vector2(-0.5, 0.16) * u, c + Vector2(0.62, 0.16) * u, col, lw * 1.2)
					draw_line(c + Vector2(0.34, 0.16) * u, c + Vector2(0.66, -0.02) * u, col, lw * 1.2)
					draw_colored_polygon(PackedVector2Array([c + Vector2(0.56, -0.08) * u, c + Vector2(0.74, -0.3) * u, c + Vector2(0.62, -0.58) * u, c + Vector2(0.48, -0.3) * u]), col)

func _process(dt: float) -> void:
	super._process(dt)
	if lm_snap_every > 0:
		lm_snap_f += 1
		if lm_snap_f % lm_snap_every == 0: _lm_snap()
	_lm_view()
	for f in lm_flames:      # the flames are alive: they lean and stretch a little, and never go out by themselves
		var n: Node3D = f[0]
		if n.scale.x < 0.01: continue
		var ph: float = f[1]
		(n.get_child(0) as Node3D).scale = Vector3(1.0 + 0.05 * sin(t * 6.1 + ph), 1.0 + 0.1 * sin(t * 4.7 + ph * 1.7), 1.0 + 0.05 * cos(t * 5.3 + ph))
		(n.get_child(1) as Node3D).scale = Vector3(1.0, 1.0 + 0.08 * sin(t * 5.9 + ph * 0.6), 1.0)
	var gn: MeshInstance3D = N["lm_gl_glow"]      # the burning twin of the Great Lamp shows where no lamp's glare lies
	lm_glow_a = move_toward(lm_glow_a, 0.0 if _lm_blind("LM4", gn.position) != "" else 0.92, dt * 1.1)
	(gn.material_override as ShaderMaterial).set_shader_parameter("a", lm_glow_a)

# ---------------------------------------------------------------- light on water
## the lit lamp whose glare holds a place on a water ("": none does)
func _lm_blind(wid: String, p: Vector3) -> String:
	for id in LMW.get(wid, []):
		var L: Dictionary = LM[id]
		if L.lit and _flat(L.tip, p) < float(L.r) * 0.88: return id
	return ""

## a tap on water falls on water only where there is water (a round pool in its square, a canal between its blocks)
func _water_under(sp: Vector2):
	var wu: Variant = super._water_under(sp)
	if wu == null: return null
	var wa: Array = wu
	var w: Dictionary = W[WL[wa[0]]]; var g: Vector3 = wa[1]
	for d in w.get("dry", []):
		if in_rect(d, g): return null
	return wu

## a post with a ring is a thin thing among much floor and water: a tap must fall nearer to it than to other things
func _tap_dist(k: String, sp: Vector2) -> float:
	var d := super._tap_dist(k, sp)
	return d * 1.8 if k.begins_with("lm_c_") else d

## a tap on water that a flame lights: there is no one in it. She looks, and shakes her head
func _send_reflection(pi: int, to: Vector3, sp: Vector2) -> void:
	var wid: String = WL[pi]
	if OS.get_environment("LMDBG") == "1": print("LMDBG send ", wid, " to ", to, " busy ", busy, " out ", _lm_where())
	var by := _lm_blind(wid, to) if LMW.has(wid) else ""
	if by != "":
		if not busy: await _lm_no_one(by, to)
		return
	await super._send_reflection(pi, to, sp)

func use(k: String) -> void:
	var o: Dictionary = objs[k]
	if OS.get_environment("LMDBG") == "1": print("LMDBG use ", k, " busy ", busy, " out ", _lm_where())
	if o.has("water") and LMW.has(o.water):
		if busy: return
		var by := _lm_blind(o.water, o.rstand)
		if by != "":      # the place her reflection would stand is in the glare of a flame
			await _lm_no_one(by, o.rstand); return
		if k.begins_with("lm_d3") and "reed" in pocket and not flags.has("lm_gave"):      # the flame goes down to her reflection first
			route.clear(); pending = ""
			busy = true; refl_busy += 1
			await _lm_give_reed()
			refl_busy -= 1; busy = false
	await super.use(k)

func _lm_no_one(id: String, to: Vector3) -> void:
	hold_id = -1; route.clear(); pending = ""
	busy = true; refl_busy += 1
	await face(Vector3(to.x, 0, to.z))
	var gm: ShaderMaterial = LM[id].gm
	var pl := create_tween().set_trans(Tween.TRANS_SINE)
	pl.tween_method(func(v: float) -> void: gm.set_shader_parameter("a", v), 1.0, 1.22, 0.4); pl.tween_method(func(v: float) -> void: gm.set_shader_parameter("a", v), 1.22, 1.0, 0.7)
	say("light on the water. no one in it")
	var h := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	h.tween_property(self, "a_headp", 0.3, 0.45); h.tween_property(self, "a_hy", -0.3, 0.3); h.tween_property(self, "a_hy", 0.3, 0.45); h.tween_property(self, "a_hy", 0.0, 0.3); h.tween_property(self, "a_headp", 0.0, 0.45)
	await h.finished
	refl_busy -= 1; busy = false; settled.emit()

## what a lamp's light does to the footing under it: a footing is there only while no lamp that covers it burns. Her
## reflection, if it stands where light has come, is drawn back to her
func _lm_foot(wid: String) -> void:
	var F: Dictionary = W[wid].foot
	var cover := {}
	for id in LMW[wid]:
		for f in LM[id].foot: cover[f] = cover.get(f, false) or LM[id].lit
	for f in cover: F[f].on = not cover[f]
	if not refl_out.is_empty() and refl_w == wid:
		var hp: Vector3 = (refl_out.holder as Node3D).position
		if _foot_of(wid, hp, 0.06) == "": _refl_melt()

## the flame of a lamp comes, or goes, and its glare with it
func _lm_set(id: String, lit: bool, secs := 0.9) -> void:
	var L: Dictionary = LM[id]
	if L.lit == lit: return
	L.lit = lit
	if lit: _lm_foot(L.w)
	var gm: ShaderMaterial = L.gm
	var a0: float = gm.get_shader_parameter("a")
	var tw2 := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	for sfx in ["", "_m"]: tw2.tween_property(L["flame" + sfx], "scale", Vector3.ONE * (1.0 if lit else 0.001), secs)
	tw2.tween_method(func(v: float) -> void: gm.set_shader_parameter("a", v), a0, 1.0 if lit else 0.0, secs)
	await tw2.finished
	if not lit: _lm_foot(L.w)

func _lm_set_now(id: String, lit: bool) -> void:
	var L: Dictionary = LM[id]
	L.lit = lit
	for sfx in ["", "_m"]: (L["flame" + sfx] as Node3D).scale = Vector3.ONE * (1.0 if lit else 0.001)
	(L.gm as ShaderMaterial).set_shader_parameter("a", 1.0 if lit else 0.0)
	_lm_foot(L.w)

func _lm_cap_now(id: String, down: bool) -> void:
	LM[id].cap = down; _lm_cap_set(1.0 if down else 0.0, id)

## a small flame runs along a way (along the runnel: the oil going elsewhere)
func _lm_run(pts: Array, speed := 2.6) -> void:
	var fl: Node3D = N["lm_run_fl"]
	var total := 0.0
	for i in pts.size() - 1: total += (pts[i + 1] as Vector3).distance_to(pts[i])
	if total < 0.05: return
	fl.position = pts[0]
	var a := create_tween(); a.tween_property(fl, "scale", Vector3.ONE * 0.6, 0.25)
	var along := func(s: float) -> void:
		var left := s
		for i in pts.size() - 1:
			var ln: float = (pts[i + 1] as Vector3).distance_to(pts[i])
			if left <= ln or i == pts.size() - 2:
				fl.position = (pts[i] as Vector3).lerp(pts[i + 1], clampf(left / maxf(ln, 0.001), 0.0, 1.0)); return
			left -= ln
	var mv := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT); mv.tween_method(along, 0.0, total, maxf(total / speed, 0.5))
	await mv.finished
	var b := create_tween(); b.tween_property(fl, "scale", Vector3.ONE * 0.001, 0.25)
	await b.finished

## she takes the ring of a lamp's chain. With the cap up, she lifts the ring off its hook and lets it rise: the cap
## comes down over the flame. With the cap down, she pulls the ring down and hooks it: the cap lifts again
func _lm_chain(id: String) -> void:
	var L: Dictionary = LM[id]
	var wid: String = L.w
	await face(Vector3(L.post.x, 0, L.post.z))
	var down: bool = not L.cap
	if wid == "LM4" and flags.has("lm_great"): return
	tgtR = _lm_ring_pos(id)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.55); a.tween_property(self, "a_headp", -0.12 if L.cap else 0.0, 0.55)
	await a.finished
	var step := func(u: float) -> void:
		_lm_cap_set(u, id); tgtR = _lm_ring_pos(id)
	var refuse: bool = down and wid == "LM2" and _lm_caps("LM2") >= 2      # the oil of a third has nowhere to go
	L.cap = down
	var mv := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	mv.tween_method(step, 0.0 if down else 1.0, 1.0 if down else 0.0, 1.3)
	if refuse:
		await mv.finished
		var gm: ShaderMaterial = L.gm
		var dim := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
		for sfx in ["", "_m"]: dim.tween_property(L["flame" + sfx], "scale", Vector3.ONE * 0.4, 0.5)
		dim.tween_method(func(v: float) -> void: gm.set_shader_parameter("a", v), 1.0, 0.55, 0.5)
		await dim.finished
		say("the oil has nowhere else to go")
		await wait(0.5)
		var back := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)      # the flame swells again and lifts the cap off itself; the ring is drawn down out of her hand
		for sfx in ["", "_m"]: back.tween_property(L["flame" + sfx], "scale", Vector3.ONE, 0.7)
		back.tween_method(func(v: float) -> void: gm.set_shader_parameter("a", v), 0.55, 1.0, 0.7)
		back.tween_method(step, 1.0, 0.0, 0.9)
		await back.finished
		L.cap = false
	elif down:
		await wait(0.85)      # the cap is over the flame
		if mv.is_running(): await mv.finished
		await _lm_after(id, true)
	else:
		await mv.finished
		await _lm_after(id, false)
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.55); b.tween_property(self, "a_headp", 0.0, 0.55)
	await b.finished

func _lm_caps(wid: String) -> int:
	var n := 0
	for id in LMW[wid]:
		if LM[id].cap: n += 1
	return n

## what follows when a cap has come down over a lamp, or has been lifted: each court has its own rule
func _lm_after(id: String, down: bool) -> void:
	var L: Dictionary = LM[id]
	match String(L.w):
		"LM2":      # one runnel, oil for three flames: the first three lamps along it that are not capped burn
			var order := ["b1", "b2", "b3", "b4", "b5"]
			var want := []
			for q in order:
				if not LM[q].cap and want.size() < 3: want.append(q)
			var off := ""; var on := ""
			for q in order:
				if LM[q].lit and not (q in want): off = q
				if not LM[q].lit and (q in want): on = q
			if off != "": await _lm_set(off, false, 0.6)
			if off != "" and on != "": await _lm_run(_lm_b_way(order.find(off), order.find(on)))
			if on != "": await _lm_set(on, true, 0.8)
		"LM3":      # a lamp with no runnel: capped, it dies, and stays dead until it is lit again
			if down and L.lit:
				await _lm_set(id, false, 0.6)
				_lm_seal(0, false); done.erase("lm_d3n")
		"LM4":      # the four of the hall: the oil of a capped one runs to the bowl of the Great Lamp
			var up_pts := [Vector3(L.tip.x, LM_ARM_Y + 0.1, L.tip.z), LM_GL + Vector3(0, LM_BEAM_Y - 0.05, 0), LM_GL + Vector3(0, LM_GL_UP + 0.45, 0)]
			if down:
				await _lm_set(id, false, 0.6)
				await _lm_run(up_pts, 3.2)
				lm_oil += 1; await _lm_oil_show()
			else:
				lm_oil -= 1; await _lm_oil_show()
				up_pts.reverse()
				await _lm_run(up_pts, 3.2)
				await _lm_set(id, true, 0.8)
		_:
			await _lm_set(id, not down, 0.7)

## the way along the runnel of L.2 from one lamp to another (its lamps 0..2 stand in a line; 3 and 4 hang off 2)
func _lm_b_way(i: int, j: int) -> Array:
	var T: Array = N["lm_run_b"]
	var a := []; var b := []
	if i <= 2:
		for k in range(i, 3): a.append(k)
	else: a = [i, 2]
	if j <= 2:
		for k in range(j, 3): b.append(k)
	else: b = [j, 2]
	while a.size() > 1 and b.size() > 1 and a[a.size() - 2] == b[b.size() - 2]: a.pop_back(); b.pop_back()
	b.reverse()
	var out := []
	for k in a + b.slice(1): out.append(T[k])
	return out

## the oil in the bowl of the Great Lamp stands as high as lm_oil lamps have given it
func _lm_oil_show() -> void:
	var oil: Node3D = N["lm_gl_oil"]
	var k := clampf(lm_oil / 4.0, 0.0, 1.0)
	var o := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	o.tween_property(oil, "position:y", 0.13 + 0.19 * k, 0.6); o.tween_property(oil, "scale", Vector3(0.001, 1, 0.001) if lm_oil <= 0 else Vector3(0.45 + 0.6 * k, 1, 0.45 + 0.6 * k), 0.6)
	await o.finished

func _do_lm_c_a1() -> void: await _lm_chain("a1")
func _do_lm_c_a2() -> void: await _lm_chain("a2")
func _do_lm_c_a3() -> void: await _lm_chain("a3")
func _do_lm_c_b1() -> void: await _lm_chain("b1")
func _do_lm_c_b2() -> void: await _lm_chain("b2")
func _do_lm_c_b3() -> void: await _lm_chain("b3")
func _do_lm_c_b4() -> void: await _lm_chain("b4")
func _do_lm_c_b5() -> void: await _lm_chain("b5")
func _do_lm_c_cn() -> void: await _lm_chain("cn")
func _do_lm_c_dn() -> void: await _lm_chain("dn")
func _do_lm_c_dw() -> void: await _lm_chain("dw")
func _do_lm_c_de() -> void: await _lm_chain("de")
func _do_lm_c_ds() -> void: await _lm_chain("ds")

# ---------------------------------------------------------------- L.1 and L.2: the levers on their stones
## a lever in a water: her reflection, standing before it, takes the handle and draws it over; what it opens happens
## meanwhile, with the view on it. Then her reflection goes back the way the water lets it, and is hers again
func _lm_pull(key: String, wid: String, focus: Vector3, size: float, opens: Callable) -> void:
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var lv: Node3D = N[key]; var lm: Node3D = N[key + "_m"]
	var gp := lm.global_position
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, atan2(gp.x - hd.position.x, gp.z - hd.position.z)), 0.4).set_trans(Tween.TRANS_SINE)
	await rt.finished
	var hm := _hermod(e)
	var grip := func() -> Vector3: return lm.global_transform * Vector3(0, 0.62, 0)
	hm.tR = grip.call(); hm.tL = grip.call(); hm.own = true
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wR", 1.0, 0.5); hu.tween_property(hm, "wL", 0.7, 0.5); hu.tween_property(hm, "bow", 0.12, 0.5)
	await hu.finished
	lm_cam_act = true
	var over := func(a: float) -> void:
		lv.rotation.z = a; lm.rotation.z = a; hm.tR = grip.call(); hm.tL = grip.call()
	var pt := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT); pt.tween_method(over, 0.5, -0.5, 1.5)
	await pt.finished
	var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wL", 0.0, 0.5); hd2.tween_property(hm, "wR", 0.0, 0.5); hd2.tween_property(hm, "bow", 0.0, 0.5)
	cam_focus = focus; cam_focus_on = true
	create_tween().tween_property(cam, "size", size, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(1.3)
	hm.own = false
	await opens.call()
	await wait(0.5)
	cam_focus_on = false; lm_cam_act = false
	create_tween().tween_property(cam, "size", _lm_size(), 1.4).set_trans(Tween.TRANS_SINE)
	refl_token += 1; var my := refl_token
	var back := _refl_path(wid, hd.position, pos)
	if await _refl_walk_pts(e, back.pts, back.h, my, 1.1): await _refl_melt()

func _do_lm_lever1() -> void:
	await _lm_pull("lm_lev1", "LM1", Vector3(-21.6, 0.4, -15.4), 9.4, func() -> void:
		await sluice_open("lm_s1", 2.6)
		rects["LmS1"].on = true; done["lm_lever1"] = true)

func _do_lm_lever2() -> void:
	await _lm_pull("lm_lev2", "LM2", Vector3(-25.2, 0.4, -7.6), 10.8, func() -> void:
		await sluice_open("lm_s2", 2.6)
		rects["LmS2"].on = true; done["lm_lever2"] = true)

## L.2, the keepsake: her own small lamp, on a shelf that only the water has. Her reflection takes it up; it is hers
## when her reflection is under her feet again and she bends to the water for it
func _do_lm_keep() -> void:
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var kp: Node3D = N["lm_keep"]
	var gp := kp.global_position
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, atan2(gp.x - hd.position.x, gp.z - hd.position.z)), 0.4).set_trans(Tween.TRANS_SINE)
	await rt.finished
	var hm := _hermod(e)
	hm.tR = gp + Vector3(0, -0.05, 0); hm.own = true
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wR", 1.0, 0.6); hu.tween_property(hm, "bow", 0.5, 0.6)
	await hu.finished
	var sh := create_tween(); sh.tween_property(kp, "scale", Vector3.ONE * 0.01, 0.35)
	await sh.finished
	kp.visible = false
	var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wR", 0.0, 0.6); hd2.tween_property(hm, "bow", 0.0, 0.6)
	await hd2.finished
	hm.own = false
	done["lm_keep"] = true
	await _refl_melt()      # it comes back to her with the lamp, and she takes it out of the water
	await face(Vector3(LM_B_XC - 1.2, 0, LM_B_ZC))
	lm_kneel = 0.0
	var a := tw(); a.tween_property(self, "lm_kneel", 1.0, 0.8); a.tween_property(self, "a_lean", 0.35, 0.8); a.tween_property(self, "a_headp", 0.3, 0.8)
	await a.finished
	refl_ring.position = Vector3(pos.x, 0.03, pos.z) + Vector3(sin(yaw), 0, cos(yaw)) * 0.45; refl_p = 0.0
	await wait(0.5)
	_pocket_add("lamp"); flags["lm_keep"] = true
	var b := tw(); b.tween_property(self, "lm_kneel", 0.0, 0.8); b.tween_property(self, "a_lean", 0.0, 0.8); b.tween_property(self, "a_headp", 0.0, 0.8)
	await b.finished

# ---------------------------------------------------------------- L.3: the reed, the dead lamps, the four seals
## the jar of reeds by the last lamp that burns: she takes one and lights it at the flame
func _do_lm_reed() -> void:
	if "reed" in pocket or flags.has("lm_gave"): return
	var jar := Vector3(-39.45, 0, -9.37); var lp := Vector3(-38.9, 0, -9.42)
	await face(jar)
	var reed: Node3D = N["lm_reed"]; var rfl: Node3D = N["lm_reed_fl"]
	tgtR = jar + Vector3(0, 0.95, 0)
	var a := tw(); a.tween_property(self, "a_wR", 1.0, 0.7); a.tween_property(self, "a_lean", 0.2, 0.7)
	await a.finished
	rfl.scale = Vector3.ONE * 0.001; reed.rotation = Vector3.ZERO; reed.scale = Vector3.ONE * 0.01
	carry = {"node": reed, "sk": H["main"].sk, "bone": _bone(H["main"].sk, "RightHand"), "flip": false}; reed.visible = true
	create_tween().tween_property(reed, "scale", Vector3.ONE, 0.3)
	await wait(0.4)
	var m := create_tween().set_trans(Tween.TRANS_SINE); m.tween_property(self, "tgtR", lp + Vector3(-0.1, 0.75, 0.12), 0.9)      # the tip of the reed into the flame
	create_tween().tween_property(self, "a_lean", 0.05, 0.9)
	await m.finished
	var fl := create_tween(); fl.tween_property(rfl, "scale", Vector3.ONE * 0.5, 0.5)
	await fl.finished
	await wait(0.3)
	var b := tw(); b.tween_property(self, "a_wR", 0.0, 0.7); b.tween_property(self, "a_lean", 0.0, 0.7)
	await b.finished
	var sh := create_tween(); sh.tween_property(reed, "scale", Vector3.ONE * 0.01, 0.3)
	await sh.finished
	carry = {}; reed.visible = false; reed.scale = Vector3.ONE
	_pocket_add("reed")

## she goes to the rim where the path begins, sinks down on her heels and holds the burning reed down to the water:
## her reflection takes it from her hand. From now on the flame is in the water
func _lm_give_reed() -> void:
	if not refl_out.is_empty(): await _refl_melt()
	var hp := Vector3(-44.65, 0, LM_C_ZC + 0.5)
	await walk(hp)
	await go([hp + Vector3(0.2, 0, 0)], 0.6)
	await face(hp + Vector3(2.0, 0, 0))
	var reed: Node3D = N["lm_reed"]
	_pocket_take("reed"); reed.rotation = Vector3.ZERO; reed.scale = Vector3.ONE * 0.01
	carry = {"node": reed, "sk": H["main"].sk, "bone": _bone(H["main"].sk, "RightHand"), "flip": false}; reed.visible = true
	create_tween().tween_property(reed, "scale", Vector3.ONE, 0.3)
	await wait(0.5)
	tgtR = Vector3(LM_CPX0 + 0.14, 0.3, hp.z)
	var a := tw(); a.tween_property(self, "lm_kneel", 1.0, 0.9); a.tween_property(self, "a_lean", 0.4, 0.9); a.tween_property(self, "a_headp", 0.3, 0.9); a.tween_property(self, "a_wR", 1.0, 0.9)
	await a.finished
	refl_ring.position = Vector3(tgtR.x, 0.03, tgtR.z); refl_p = 0.0
	await wait(0.35)
	var turn := create_tween(); turn.tween_property(reed, "scale", Vector3(1, 0.02, 1), 0.25)      # the reed goes through the surface: it is drawn in above, and out again below
	await turn.finished
	var me: Dictionary = H["mir"]
	carry = {"node": reed, "sk": me.sk, "bone": _bone(me.sk, "RightHand"), "flip": true}; reed.rotation = Vector3(0, 0, PI)
	var turn2 := create_tween(); turn2.tween_property(reed, "scale", Vector3.ONE, 0.25)
	await turn2.finished
	await wait(0.3)
	var b := tw(); b.tween_property(self, "lm_kneel", 0.0, 0.9); b.tween_property(self, "a_lean", 0.0, 0.9); b.tween_property(self, "a_headp", 0.0, 0.9); b.tween_property(self, "a_wR", 0.0, 0.9)
	await b.finished
	flags["lm_gave"] = true; done["lm_reed"] = true
	await go([hp], 0.6)
	await face(hp + Vector3(2.0, 0, 0))

## a seal of the door softens in the heat of its lamp (and sets again if that lamp dies)
func _lm_seal(i: int, soft: bool) -> void:
	var s: Node3D = N["lm_seal%d" % i]
	var t2 := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	t2.tween_property(s, "scale", Vector3(1.25, 0.55, 1.0) if soft else Vector3.ONE, 1.2); t2.tween_property(s, "position:y", 0.42 + 0.4 * i - (0.06 if soft else 0.0), 1.2)

## her reflection, with the reed, before one of the dead lamps: it holds the flame to the bowl, steps back out of
## what will be light, and the lamp burns: above, too. The seal over it softens. With all four alight, the door opens
func _lm_light3(which: String) -> void:
	var id := "c" + which
	var L: Dictionary = LM[id]
	var e: Dictionary = refl_out; var hd: Node3D = e.holder
	var tip: Vector3 = L.tip
	var rt := create_tween(); rt.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, atan2(tip.x - hd.position.x, tip.z - hd.position.z)), 0.4).set_trans(Tween.TRANS_SINE)
	await rt.finished
	if L.lit: return
	var back_to: Vector3 = {"n": Vector3(-44.3, 0, LM_C_ZC), "f": Vector3(LM_C_J + 0.6, 0, LM_C_ZC), "a": Vector3(LM_C_J, 0, LM_C_ZC - 0.6), "b": Vector3(LM_C_J, 0, LM_C_ZC + 0.6)}[which]
	if not flags.has("lm_gave") or L.cap:      # nothing to light it with, or its cap lies over it: it looks, and comes back
		await wait(0.8)
		say("its cap is down" if L.cap else "dead. no oil comes here, and there is no flame")
		await wait(0.5)
		refl_token += 1; var my0 := refl_token
		var back0 := _refl_path("LM3", hd.position, pos)
		if await _refl_walk_pts(e, back0.pts, back0.h, my0, 1.1): await _refl_melt()
		return
	var hm := _hermod(e)
	var bowl_y := 1.12
	var dir := Vector3(hd.position.x - tip.x, 0, hd.position.z - tip.z).normalized()
	hm.tR = Vector3(tip.x, -(bowl_y - 0.36), tip.z) + dir * 0.2; hm.own = true
	var hu := create_tween().set_parallel(); hu.tween_property(hm, "wR", 1.0, 0.7); hu.tween_property(hm, "bow", 0.1, 0.7)
	await hu.finished
	var gm: ShaderMaterial = L.gm
	var st := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)      # it catches: a small flame, above and below
	for sfx in ["", "_m"]: st.tween_property(L["flame" + sfx], "scale", Vector3.ONE * 0.45, 0.6)
	st.tween_method(func(v: float) -> void: gm.set_shader_parameter("a", v), 0.0, 0.22, 0.6)
	await st.finished
	var hd2 := create_tween().set_parallel(); hd2.tween_property(hm, "wR", 0.0, 0.5); hd2.tween_property(hm, "bow", 0.0, 0.5)
	await hd2.finished
	hm.own = false
	refl_token += 1; var my := refl_token      # a step back, out of what will be light
	await _refl_walk_pts(e, [back_to], 0.0, my, 0.9)
	var look := create_tween(); look.tween_property(hd, "rotation:y", hd.rotation.y + angle_difference(hd.rotation.y, atan2(tip.x - hd.position.x, tip.z - hd.position.z)), 0.4).set_trans(Tween.TRANS_SINE)
	await _lm_set(id, true, 1.0)
	done["lm_d3" + which] = true
	_lm_seal(["n", "a", "b", "f"].find(which), true)
	await wait(1.0)
	var all := true
	for q in ["cn", "ca", "cb", "cf"]:
		if not LM[q].lit: all = false
	if all: await _lm_open3()
	elif which == "n":      # the near one burns between it and the rest: it is hers again
		await _refl_melt()

func _do_lm_d3n() -> void: await _lm_light3("n")
func _do_lm_d3f() -> void: await _lm_light3("f")
func _do_lm_d3a() -> void: await _lm_light3("a")
func _do_lm_d3b() -> void: await _lm_light3("b")

## all four lamps burn: the four seals run, the bolts draw, and the door to the hall goes down
func _lm_open3() -> void:
	lm_cam_act = true
	var dc := Vector3(-45.2, 0, LM_CZ0 + 0.15)
	cam_focus = dc + Vector3(1.2, 0.5, 2.2); cam_focus_on = true
	create_tween().tween_property(cam, "size", 7.4, 1.6).set_trans(Tween.TRANS_SINE)
	await wait(1.5)
	for i in 4:
		var s: Node3D = N["lm_seal%d" % i]
		var m := create_tween().set_parallel().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		m.tween_property(s, "position:y", s.position.y - 0.35, 0.9).set_delay(0.18 * i); m.tween_property(s, "scale", Vector3(0.6, 0.01, 0.6), 0.9).set_delay(0.18 * i)
	await wait(1.5)
	for i in 4:
		var bl: Node3D = N["lm_bolt%d" % i]
		create_tween().tween_property(bl, "position:x", bl.position.x + 0.2, 0.6).set_delay(0.12 * i).set_trans(Tween.TRANS_SINE)
	await wait(1.2)
	for i in 4:
		var bl: Node3D = N["lm_bolt%d" % i]
		create_tween().tween_property(bl, "position:y", bl.position.y - 2.25, 2.8).set_trans(Tween.TRANS_SINE)
	await sluice_open("lm_door3", 2.8)
	rects["LmD3"].on = true; flags["lm_door3"] = true; done["lm_c_cn"] = true
	for q in ["n", "f", "a", "b"]: done["lm_d3" + q] = true
	await wait(0.6)
	cam_focus_on = false; lm_cam_act = false
	create_tween().tween_property(cam, "size", _lm_size(), 1.4).set_trans(Tween.TRANS_SINE)
	if not refl_out.is_empty(): await _refl_melt()
	var reed: Node3D = N["lm_reed"]      # the reed has done its work: it burns down
	var gone := create_tween(); gone.tween_property(reed, "scale", Vector3.ONE * 0.01, 0.8)
	await gone.finished
	carry = {}; reed.visible = false

# ---------------------------------------------------------------- L.4: the Great Lamp
## the windlass of the Great Lamp. She lowers the dark lamp until it touches the water. While any of the four lamps
## of the hall burns, the water there is light and holds nothing: she winds it up again as it went down. With all four
## capped, the dark lamp meets its burning reflection, and comes up alight: its heat runs the seal of the head-gate
func _do_lm_wind() -> void:
	if flags.has("lm_great"): return
	var hub: Vector3 = N["lm_hub"]; var hn := Vector3(1, 0, 0)
	await face(hub)
	var hands := func(y: float) -> void:
		_lm_gl_set(y)
		var pts := _crank_pts(hub, hn, (N["lm_axle"] as Node3D).rotation.x, 0.27)
		tgtL = pts[0]; tgtR = pts[1]
	hands.call(LM_GL_UP)
	var up := tw(); up.tween_property(self, "a_wL", 1.0, 0.7); up.tween_property(self, "a_wR", 1.0, 0.7); up.tween_property(self, "a_lean", 0.06, 0.7)
	await up.finished
	lm_cam_act = true
	cam_focus = LM_DC + Vector3(0.3, 0.8, 0.1); cam_focus_on = true
	var dn := create_tween(); dn.tween_method(hands, LM_GL_UP, 0.012, 5.0).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await dn.finished
	var dark := true
	var by := ""
	for q in LMW["LM4"]:
		if LM[q].lit: dark = false; by = q
	if not dark:      # it touches only light
		var gm: ShaderMaterial = LM[_lm_blind("LM4", LM_GL) if _lm_blind("LM4", LM_GL) != "" else by].gm
		var pl := create_tween().set_trans(Tween.TRANS_SINE)
		pl.tween_method(func(v: float) -> void: gm.set_shader_parameter("a", v), 1.0, 1.22, 0.4); pl.tween_method(func(v: float) -> void: gm.set_shader_parameter("a", v), 1.22, 1.0, 0.7)
		say("it touches only light")
		await wait(1.6)
	else:      # the dark lamp touches the water, and is one with what the water held
		refl_ring.position = LM_GL + Vector3(0, 0.03, 0); refl_p = 0.0
		var fl: Node3D = N["lm_gl_fl"]
		var l2 := create_tween().set_trans(Tween.TRANS_SINE); l2.tween_property(fl, "scale", Vector3.ONE * 3.0, 0.9)
		await l2.finished
		flags["lm_great"] = true
		await wait(0.6)
	var rise := create_tween(); rise.tween_method(hands, 0.012, LM_GL_UP, 4.4).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await rise.finished
	var off := tw(); off.tween_property(self, "a_wL", 0.0, 0.6); off.tween_property(self, "a_wR", 0.0, 0.6); off.tween_property(self, "a_lean", 0.0, 0.6)
	await off.finished
	if flags.has("lm_great"):
		done["lm_wind"] = true; done["lm_great"] = true
		for q in LMW["LM4"]: done["lm_c_" + q] = true
		await _lm_finale()
	else:
		cam_focus_on = false; lm_cam_act = false

func _do_lm_great() -> void: await _do_lm_wind()

## the Great Lamp burns. Its heat runs the wax of the great seal; the head-gate goes down; the water of the hall
## runs out along the channel, across the landing and down to the door of the atrium
func _lm_finale() -> void:
	var gc := Vector3(LM_DX1 - 0.15, 0, LM_CH_Z)
	cam_focus = gc + Vector3(-0.9, 0.7, 0.3)
	create_tween().tween_property(cam, "size", 7.6, 1.8).set_trans(Tween.TRANS_SINE)
	await wait(2.0)
	var seal: Node3D = N["lm_gseal"]; var bar: Node3D = N["lm_headbar"]
	var m := create_tween().set_parallel().set_trans(Tween.TRANS_SINE)
	m.tween_property(seal, "scale", Vector3(1.0, 0.62, 1.2), 1.4); m.tween_property(seal, "position:y", seal.position.y - 0.1, 1.4)
	await m.finished
	var m2 := create_tween().set_parallel().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	m2.tween_property(seal, "scale", Vector3(0.5, 0.02, 0.7), 1.3); m2.tween_property(seal, "position:y", 0.02, 1.3)
	await m2.finished
	await wait(0.3)
	create_tween().tween_property(bar, "position:y", bar.position.y - 1.95, 3.0).set_trans(Tween.TRANS_SINE)
	await sluice_open("lm_head", 3.0)
	rects["LmHead"].on = true
	# the water: out of the pool, through the gate, east along the channel, and north to the door
	var w1: Node3D = N["lm_run_w1"]; var w2: Node3D = N["lm_run_w2"]
	w1.visible = true; w2.visible = true
	cam_focus = Vector3(-34.5, 0.4, LM_CH_Z)
	create_tween().tween_property(cam, "size", 10.0, 2.0).set_trans(Tween.TRANS_SINE)
	var r1 := create_tween(); r1.tween_property(w1, "scale:x", 1.0, 4.2).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await wait(2.2)
	cam_focus = Vector3(-30.4, 0.4, -19.4)
	await r1.finished
	var r2 := create_tween(); r2.tween_property(w2, "scale:z", 1.0, 4.6).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	await wait(2.0)
	cam_focus = Vector3(-30.0, 0.4, UZ1 + 0.4)
	await r2.finished
	_wing_done("S")
	await wait(1.4)
	cam_focus_on = false; lm_cam_act = false
	create_tween().tween_property(cam, "size", _lm_size(), 1.6).set_trans(Tween.TRANS_SINE)

# ---------------------------------------------------------------- the run that tries the wing, by taps
func _lm_where() -> String:
	return str((refl_out.holder as Node3D).position.snapped(Vector3.ONE * 0.01)) if not refl_out.is_empty() else "under her"

func _lm_lit(wid: String) -> String:
	var s := ""
	for id in LMW[wid]: s += ("*" if LM[id].lit else ".") + ("c" if LM[id].cap else " ")
	return s

func _lm_ring(id: String) -> Vector3:
	return _lm_ring_pos(id)

## the wing played by taps, as a player would: at every station first what seems obvious, then what works. FROM=1..4
## starts at that station with everything before it done
func _play_lamps() -> void:
	var from := int(OS.get_environment("FROM")) if OS.get_environment("FROM") != "" else 1
	var until := int(OS.get_environment("UNTIL")) if OS.get_environment("UNTIL") != "" else 4      # (UNTIL=1..3: stop when that station is done)
	await get_tree().create_timer(1.0).timeout
	tap(Vector2(360, 640)); await wait(0.5)      # the title
	_wake_now(); _open_to("U")
	_lm_open_to(from)
	await wait(1.0)
	if from <= 1:
		await _tap_wait(Vector3(-30.0, 0, -17.6))
		print("LAMPS in the wing, on the landing: ", pos.snapped(Vector3.ONE * 0.01))
		await _tap_wait(Vector3(-36.9, 0, LM_CH_Z))      # along the channel to the head-gate: sealed
		print("LAMPS at the head-gate: ", pos.snapped(Vector3.ONE * 0.01), " way through ", rects["LmHead"].on)
		await _tap_wait(Vector3(-25.7, 0, -18.1))
		print("LAMPS L.1 on the bank: ", pos.snapped(Vector3.ONE * 0.01), " lamps ", _lm_lit("LM1"))
		await _tap_wait(Vector3(-25.4, 0.012, -16.2))      # the canal: glare
		print("LAMPS L.1 a tap on the canal: reflection ", _lm_where(), ", lamps ", _lm_lit("LM1"))
		var lev: Vector3 = objs["lm_lever1"].at
		await _tap_wait(Vector3(lev.x, 0.5, lev.z))      # the lever, on its stone under the lamp
		print("LAMPS L.1 a tap on the lever under the burning lamp: lever ", done.has("lm_lever1"), ", reflection ", _lm_where())
		await _tap_wait(_lm_ring("a1"))      # the wrong lamp: its water goes dark, and there is nothing in it
		print("LAMPS L.1 the first lamp capped: lamps ", _lm_lit("LM1"), " she at ", pos.snapped(Vector3.ONE * 0.01))
		await _tap_wait(Vector3(lev.x, 0.5, lev.z))
		print("LAMPS L.1 the lever again: lever ", done.has("lm_lever1"))
		await _tap_wait(_lm_ring("a1"))      # and lifted again
		await _tap_wait(_lm_ring("a2"))      # the lamp over the lever
		print("LAMPS L.1 the lamp over the lever capped: lamps ", _lm_lit("LM1"), ", stones ", W["LM1"].foot["st"].on)
		await _tap_wait(Vector3(lev.x, 0.5, lev.z))
		print("LAMPS L.1 lever ", done.has("lm_lever1"), " sluice ", rects["LmS1"].on, " reflection ", _lm_where())
		if until <= 1: await wait(1.0); get_tree().quit(); return
	if from <= 2:
		await _tap_wait(Vector3(-19.6, 0, -10.6))
		await _tap_wait(Vector3(-24.0, 0, -9.0))
		await _tap_wait(Vector3(-27.2, 0, LM_B_ZC + 0.8))      # to the head of the path, at the west rim
		print("LAMPS L.2 at the head of the path: ", pos.snapped(Vector3.ONE * 0.01), " lamps ", _lm_lit("LM2"))
		var lv2: Vector3 = objs["lm_lever2"].at
		await _tap_wait(Vector3(lv2.x, 0.5, lv2.z))      # the lever lies in dark water, but the way to it is light
		print("LAMPS L.2 a tap on the lever: lever ", done.has("lm_lever2"), " reflection ", _lm_where())
		for q in ["b1", "b2"]: await _tap_wait(_lm_ring(q))
		print("LAMPS L.2 the first two capped: lamps ", _lm_lit("LM2"))
		await _tap_wait(_lm_ring("b3"))      # a third: the oil has nowhere to go
		print("LAMPS L.2 a third cap: lamps ", _lm_lit("LM2"), " (it does not stay down)")
		await _tap_wait(Vector3(-27.2, 0, LM_B_ZC + 0.8))
		await _tap_wait(Vector3(-23.6, 0.012, LM_B_ZC))      # her reflection into the dark, as far as it goes
		print("LAMPS L.2 reflection sent along the dark: ", _lm_where())
		await _tap_wait(_lm_ring("b1"))      # the cap behind it lifted,
		await _tap_wait(_lm_ring("b3"))      # the next one let down
		print("LAMPS L.2 the dark moved on: lamps ", _lm_lit("LM2"), " reflection ", _lm_where())
		await _tap_wait(Vector3(LM_B_XC - 0.5, 0.012, LM_B_ZC))      # to the fork
		print("LAMPS L.2 reflection at the fork: ", _lm_where())
		await _tap_wait(_lm_ring("b4"))      # both arms are lit; a third cap will not stay
		print("LAMPS L.2 the lever's lamp, with two caps down: lamps ", _lm_lit("LM2"))
		await _tap_wait(_lm_ring("b2"))      # so: one lifted behind (its oil comes back from the far arm),
		print("LAMPS L.2 the cap behind lifted: lamps ", _lm_lit("LM2"), " (the far arm is dark now)")
		if OS.get_environment("KEEP") == "1":
			var kp: Vector3 = objs["lm_keep"].at
			await _tap_wait(kp)
			print("LAMPS L.2 the keepsake: ", flags.has("lm_keep"), " pocket ", pocket, " reflection ", _lm_where())
			for q in ["b3", "b1", "b2"]: await _tap_wait(_lm_ring(q))      # and the dark is brought to the fork again, from the beginning
			await _tap_wait(Vector3(-27.2, 0, LM_B_ZC + 0.8))
			await _tap_wait(Vector3(-23.6, 0.012, LM_B_ZC))
			await _tap_wait(_lm_ring("b1")); await _tap_wait(_lm_ring("b3"))
			await _tap_wait(Vector3(LM_B_XC - 0.5, 0.012, LM_B_ZC))
			await _tap_wait(_lm_ring("b2"))
			print("LAMPS L.2 at the fork again: lamps ", _lm_lit("LM2"), " reflection ", _lm_where())
		await _tap_wait(_lm_ring("b4"))      # and the lever's lamp capped: its oil lights the other arm
		print("LAMPS L.2 the lever's lamp capped: lamps ", _lm_lit("LM2"))
		await _tap_wait(Vector3(lv2.x, 0.5, lv2.z))
		print("LAMPS L.2 lever ", done.has("lm_lever2"), " gate ", rects["LmS2"].on, " reflection ", _lm_where())
		if until <= 2: await wait(1.0); get_tree().quit(); return
	if from <= 3:
		await _tap_wait(Vector3(-29.6, 0, -8.8))
		await _tap_wait(Vector3(-33.0, 0.012, -7.0))      # the long water: light
		print("LAMPS passage: a tap on the long water: reflection ", _lm_where(), " she at ", pos.snapped(Vector3.ONE * 0.01))
		await _tap_wait(Vector3(-36.6, 0, -8.8))
		await _tap_wait(Vector3(LM_C_J, -1.0, LM_C_ZC - LM_C_LEG))      # a dead lamp, with no flame to bring
		print("LAMPS L.3 a dead lamp, without a flame: lit ", LM["ca"].lit, " reflection ", _lm_where(), " she at ", pos.snapped(Vector3.ONE * 0.01))
		await _tap_wait(objs["lm_reed"].at)
		print("LAMPS L.3 a reed, lit at the last lamp: pocket ", pocket)
		var nt: Vector3 = LM["cn"].tip
		await _tap_wait(Vector3(nt.x, -1.0, nt.z))      # the first lamp it comes to
		print("LAMPS L.3 the near lamp lit first: gave ", flags.has("lm_gave"), " pocket ", pocket, " lamps ", _lm_lit("LM3"), " reflection ", _lm_where())
		await _tap_wait(Vector3(LM_C_J + LM_C_LEG, -1.0, LM_C_ZC))      # the far one: the way is light now
		print("LAMPS L.3 the far lamp, past the lit one: lit ", LM["cf"].lit, " reflection ", _lm_where())
		await _tap_wait(_lm_ring("cn"))      # she caps the near one from the rim
		print("LAMPS L.3 the near lamp capped: lamps ", _lm_lit("LM3"))
		for q in [["f", Vector3(LM_C_J + LM_C_LEG, -1.0, LM_C_ZC)], ["a", Vector3(LM_C_J, -1.0, LM_C_ZC - LM_C_LEG)], ["b", Vector3(LM_C_J, -1.0, LM_C_ZC + LM_C_LEG)]]:
			await _tap_wait(q[1])
			print("LAMPS L.3 lamp ", q[0], ": lamps ", _lm_lit("LM3"), " reflection ", _lm_where())
		await _tap_wait(Vector3(nt.x, -1.0, nt.z))      # the near one, with its cap still down
		print("LAMPS L.3 the near lamp under its cap: lit ", LM["cn"].lit)
		await _tap_wait(_lm_ring("cn"))
		await _tap_wait(Vector3(nt.x, -1.0, nt.z))
		print("LAMPS L.3 the near lamp last: lamps ", _lm_lit("LM3"), " door ", rects["LmD3"].on, " reflection ", _lm_where())
		if until <= 3: await wait(1.0); get_tree().quit(); return
	await _tap_wait(Vector3(-45.2, 0, -11.2))
	print("LAMPS L.4 in the hall: ", pos.snapped(Vector3.ONE * 0.01))
	await _tap_wait(Vector3(LM_DC.x + 1.0, 0.012, LM_DC.z + 0.6))      # the pool: light
	print("LAMPS L.4 a tap on the pool: reflection ", _lm_where())
	await _tap_wait(objs["lm_wind"].at)      # the Great Lamp let down among the four that burn
	print("LAMPS L.4 the Great Lamp let down into the light: lit ", flags.has("lm_great"), " lamps ", _lm_lit("LM4"))
	for q in ["dn", "dw", "ds"]: await _tap_wait(_lm_ring(q))
	print("LAMPS L.4 three capped: lamps ", _lm_lit("LM4"), " oil ", lm_oil)
	await _tap_wait(objs["lm_wind"].at)      # three are not four
	print("LAMPS L.4 let down with one still burning: lit ", flags.has("lm_great"))
	await _tap_wait(_lm_ring("de"))
	print("LAMPS L.4 all four capped: lamps ", _lm_lit("LM4"), " oil ", lm_oil)
	await _tap_wait(objs["lm_wind"].at)
	print("LAMPS L.4 the Great Lamp: lit ", flags.has("lm_great"), " gate ", rects["LmHead"].on, " wings done ", wings_done)
	await _tap_wait(Vector3(-36.0, 0, LM_CH_Z))      # the short way back: through the head-gate
	await _tap_wait(Vector3(-30.0, 0, UZ1 - 1.2))
	print("LAMPS back in the atrium: ", pos.snapped(Vector3.ONE * 0.01))
	await wait(1.0)
	get_tree().quit()

## (to try a later station) everything before it is done, and she stands at its entry
func _lm_open_to(k: int) -> void:
	pos = Vector3(-30.0, 0, UZ1 - 1.6); yaw = 0.0
	if k >= 2:
		_lm_cap_now("a2", true); _lm_set_now("a2", false)
		for sfx in ["", "_m"]: (N["lm_lev1" + sfx] as Node3D).rotation.z = -0.5
		(N["lm_s1"] as Node3D).position.y = -1.75; rects["LmS1"].on = true; done["lm_lever1"] = true
		pos = Vector3(-19.6, 0, -11.6); yaw = 0.0
	if k >= 3:
		for q in ["b3", "b4"]: _lm_cap_now(q, true)
		for q in ["b1", "b2", "b5"]: _lm_set_now(q, true)
		for q in ["b3", "b4"]: _lm_set_now(q, false)
		for sfx in ["", "_m"]: (N["lm_lev2" + sfx] as Node3D).rotation.z = -0.5
		(N["lm_s2"] as Node3D).position.y = -1.75; rects["LmS2"].on = true; done["lm_lever2"] = true
		pos = Vector3(-29.4, 0, -8.8); yaw = -PI * 0.5
	if k >= 4:
		for q in ["cn", "ca", "cb", "cf"]: _lm_set_now(q, true)
		for i in 4:
			(N["lm_seal%d" % i] as Node3D).visible = false; (N["lm_bolt%d" % i] as Node3D).position.y -= 2.25
		(N["lm_door3"] as Node3D).position.y = -2.25; rects["LmD3"].on = true; flags["lm_door3"] = true; flags["lm_gave"] = true
		for q in ["lm_reed", "lm_c_cn", "lm_d3n", "lm_d3f", "lm_d3a", "lm_d3b"]: done[q] = true
		pos = Vector3(-45.2, 0, -10.2); yaw = PI
	cam_t = pos
