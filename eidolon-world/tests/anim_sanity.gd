extends Node
## tests/anim_sanity (a6, Agent A): the anatomy test of every rig motion. The heroine (and her reflections / Ione: the
## same HeroineRig) and the Warden play every clip, idle, the walk, hold("lamp"/"shard"), aim_hand and look_at_point
## at a fixed 60 fps; every frame both arms and both legs are measured in skeleton space against the rest pose:
##   elbow  flexion about the upper arm's rest hinge (bone x): -5..150 deg, forearm off the hinge plane <= 25 deg
##   knee   flexion backward only: -5..160 deg, off-plane <= 25 deg
##   twist  forearm (vs upper arm) and wrist (vs forearm) twist within +-90 deg, wrist bend <= 85 deg;
##          shoulder: the upper arm in a sane cone of the chest (not through the torso, not far behind), its twist +-95
##   flips  no driven bone turns more than 30 deg in one frame (= 60 deg per 1/30 s)
##   skin   elbow/wrist/knee bands (CPU-skinned vertices): the mean distance to the bone line keeps >= 75% of rest
##          (no candy-wrapper / collapsed joint) and no vertex falls under 12% (none driven into the bone)
## godot --headless --fixed-fps 60 --path . res://tests/anim_sanity.tscn [-- --only=<case substring>] [--verbose]
## Prints "FAIL <case>: ..." per failing case and "ANIM PASS|FAIL cases=N frames=M"; exit code 1 on failure.

const LIM := {"el_lo": -5.0, "el_hi": 150.0, "el_off": 25.0, "kn_lo": -5.0, "kn_hi": 160.0, "kn_off": 25.0,
	"tw_fore": 90.0, "tw_wrist": 90.0, "wr_bend": 85.0, "sh_tw": 95.0, "flip": 30.0, "skin_mean": 0.75, "skin_min": 0.12}
const SIDES := ["L", "R"]
## clips the game only plays out of another one's held pose: [predecessor, seconds into it, play opts]
const PRE := {"recoil": ["kneel_reach", 2.6, {}], "refl_dragged": ["refl_press", 4.2, {"hold": true}], "rise": ["lie_side", 1.0, {"fade": 0.3}]}

var only := ""
var verbose := false
var fails := {}              # case -> {check: [count, worst, t, detail]}
var frames := 0
var ncases := 0
var _case := ""
var _t := 0.0
var _prev := {}              # bone index -> global Quaternion (last frame)
var _last := {}              # side -> the arm's last readout (for --verbose)

class RigData:
	var sk: Skeleton3D
	var bi := {}
	var rest := {}           # name -> global rest Basis (orthonormal)
	var chest0 := Basis()
	var flip_bones := PackedInt32Array()
	var skin_v := []         # [region, rest pos, bones PackedInt32Array, weights PackedFloat32Array, seg a, seg b names, rest dist]
	var binds := []          # bind index -> [bone index, bind pose]

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--only="): only = a.substr(7)
		if a == "--verbose": verbose = true
	await get_tree().process_frame
	await _heroine()
	await _warden()
	var rc := 0
	for c in fails:
		rc = 1
		var parts := []
		for k in fails[c]:
			var f: Array = fails[c][k]
			parts.append("%s x%d worst %.1f @%.2fs %s" % [k, f[0], f[1], f[2], f[3]])
		print("FAIL %s: %s" % [c, "; ".join(parts)])
	print("ANIM %s cases=%d failing=%d frames=%d" % ["PASS" if rc == 0 else "FAIL", ncases, fails.size(), frames])
	get_tree().quit(rc)

# ------------------------------------------------------------------ rig data
func _data(sk: Skeleton3D, mi: MeshInstance3D, flip_re: String) -> RigData:
	var d := RigData.new()
	d.sk = sk
	for nm in ["Spine02", "L_Upperarm", "L_Forearm", "L_Hand", "R_Upperarm", "R_Forearm", "R_Hand",
			"L_Thigh", "L_Calf", "L_Foot", "R_Thigh", "R_Calf", "R_Foot", "L_Clavicle", "R_Clavicle"]:
		d.bi[nm] = sk.find_bone(nm)
		d.rest[nm] = sk.get_bone_global_rest(d.bi[nm]).basis.orthonormalized()
	d.chest0 = d.rest["Spine02"]
	var re := RegEx.create_from_string(flip_re)
	for i in sk.get_bone_count():
		if not re.search(sk.get_bone_name(i)): d.flip_bones.append(i)
	# skin: the vertices of the elbow / wrist / knee bands (weighted to both bones of the joint)
	var sknres := mi.skin
	for i in sknres.get_bind_count():
		var nm := sknres.get_bind_name(i)
		var b := sk.find_bone(nm) if nm != "" else sknres.get_bind_bone(i)
		d.binds.append([b, sknres.get_bind_pose(i)])
	var arr := mi.mesh.surface_get_arrays(0)
	var V: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var B: PackedInt32Array = arr[Mesh.ARRAY_BONES]
	var W: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
	var per := B.size() / V.size()
	var joints := []
	for s: String in SIDES:
		joints.append(["%s_elbow" % s, s + "_Upperarm", s + "_Forearm", s + "_Hand"])
		joints.append(["%s_wrist" % s, s + "_Forearm", s + "_Hand", ""])
		joints.append(["%s_knee" % s, s + "_Thigh", s + "_Calf", s + "_Foot"])
	for j in joints:
		var b1: int = sk.find_bone(j[1])
		var b2: int = sk.find_bone(j[2])
		var cand := []
		for vi in range(0, V.size()):
			var w1 := 0.0
			var w2 := 0.0
			for k in per:
				var bb: int = d.binds[B[vi * per + k]][0]
				if bb == b1: w1 += W[vi * per + k]
				elif bb == b2: w2 += W[vi * per + k]
			if w1 < 0.2 or w2 < 0.2 or w1 + w2 < 0.85: continue
			var bs := PackedInt32Array()
			var ws := PackedFloat32Array()
			for k in per:
				if W[vi * per + k] > 0.0:
					bs.append(B[vi * per + k])
					ws.append(W[vi * per + k])
			var pa: Vector3 = sk.get_bone_global_rest(b1).origin
			var pb: Vector3 = sk.get_bone_global_rest(b2).origin
			var pc: Vector3 = sk.get_bone_global_rest(sk.find_bone(j[3])).origin if j[3] != "" else pb + sk.get_bone_global_rest(b2).basis.y.normalized() * (pb - pa).length() * 0.4
			var rd := _seg_dist(V[vi], pa, pb, pc)
			if rd < 0.012: continue
			cand.append([j[0], V[vi], bs, ws, b1, b2, sk.find_bone(j[3]) if j[3] != "" else -1, rd])
		# an even spread over the whole band (every k-th), at most 120 vertices
		var stride := maxi(1, ceili(cand.size() / 120.0))
		for ci in range(0, cand.size(), stride): d.skin_v.append(cand[ci])
	return d

static func _seg_dist(p: Vector3, a: Vector3, b: Vector3, c: Vector3) -> float:
	return minf(p.distance_to(Geometry3D.get_closest_point_to_segment(p, a, b)), p.distance_to(Geometry3D.get_closest_point_to_segment(p, b, c)))

# ------------------------------------------------------------------ the measures
func _fail(check: String, val: float, detail := "") -> void:
	if not fails.has(_case): fails[_case] = {}
	var f: Dictionary = fails[_case]
	if not f.has(check): f[check] = [0, val, _t, detail]
	var e: Array = f[check]
	e[0] += 1
	if verbose and e[0] <= 3: print("  [%s] %s %.1f @%.3f %s" % [_case, check, val, _t, detail])
	if absf(val) > absf(e[1]): e[1] = val; e[2] = _t; e[3] = detail

static func _twist_y(q: Quaternion) -> float:
	if q.w < 0.0: q = -q
	return rad_to_deg(wrapf(2.0 * atan2(q.y, q.w), -PI, PI))

static func _bend(q: Quaternion) -> float:
	return rad_to_deg(acos(clampf((q * Vector3.UP).y, -1.0, 1.0)))

func _gq(d: RigData, nm: String) -> Basis:
	return d.sk.get_bone_global_pose(d.bi[nm]).basis.orthonormalized()

func _go(d: RigData, nm: String) -> Vector3:
	return d.sk.get_bone_global_pose(d.bi[nm]).origin

func _measure(d: RigData, with_skin: bool) -> void:
	frames += 1
	var chest := _gq(d, "Spine02")
	var cd := chest * d.chest0.inverse()            # the chest's turn since rest
	for s: String in SIDES:
		var sg := 1.0 if s == "L" else -1.0
		var up := s + "_Upperarm"
		var fo := s + "_Forearm"
		var ha := s + "_Hand"
		var Bu := _gq(d, up)
		var Bf := _gq(d, fo)
		var Bh := _gq(d, ha)
		var U := (_go(d, fo) - _go(d, up)).normalized()
		var F := (_go(d, ha) - _go(d, fo)).normalized()
		var H := (Bu * Vector3.RIGHT).normalized()
		var Fp := F - H * F.dot(H)
		var flex := rad_to_deg(U.signed_angle_to(Fp, H))
		var off := rad_to_deg(asin(clampf(F.dot(H), -1.0, 1.0)))
		_last[s] = "flex %.0f fore-tw %.0f wrist-tw %.0f" % [flex, _twist_y(Quaternion((d.rest[up].inverse() * d.rest[fo]).inverse() * (Bu.inverse() * Bf))), _twist_y(Quaternion((d.rest[fo].inverse() * d.rest[ha]).inverse() * (Bf.inverse() * Bh)))]
		if flex < LIM["el_lo"] or flex > LIM["el_hi"]: _fail(s + " elbow flex", flex)
		if absf(off) > LIM["el_off"]: _fail(s + " elbow off-plane", off)
		var tw_f := _twist_y(Quaternion((d.rest[up].inverse() * d.rest[fo]).inverse() * (Bu.inverse() * Bf)))
		if absf(tw_f) > LIM["tw_fore"]: _fail(s + " forearm twist", tw_f)
		var qw := Quaternion((d.rest[fo].inverse() * d.rest[ha]).inverse() * (Bf.inverse() * Bh))
		var tw_w := _twist_y(qw)
		if absf(tw_w) > LIM["tw_wrist"]: _fail(s + " wrist twist", tw_w)
		var bw := _bend(qw)
		if bw > LIM["wr_bend"]: _fail(s + " wrist bend", bw)
		# the shoulder cone, in the chest's frame (+z forward, +x her left)
		var dl := cd.inverse() * U
		var lat := dl.x * sg
		if dl.z < -0.72: _fail(s + " shoulder behind", dl.z)
		if lat < -0.35 and dl.z < 0.35: _fail(s + " arm through torso", lat)
		var tw_u := _twist_y(Quaternion((d.chest0.inverse() * d.rest[up]).inverse() * (chest.inverse() * Bu)))
		if absf(tw_u) > LIM["sh_tw"]: _fail(s + " upper-arm twist", tw_u, "U=%s elbow=%s" % [dl.snapped(Vector3.ONE * 0.01), (cd.inverse() * (U - F)).normalized().snapped(Vector3.ONE * 0.01)] if verbose else "")
		# legs
		var th := s + "_Thigh"
		var ca := s + "_Calf"
		var ft := s + "_Foot"
		var T := (_go(d, ca) - _go(d, th)).normalized()
		var K := (_go(d, ft) - _go(d, ca)).normalized()
		var Hk := (_gq(d, th) * Vector3.RIGHT).normalized()
		var Kp := K - Hk * K.dot(Hk)
		var kf := -rad_to_deg(T.signed_angle_to(Kp, Hk))
		var koff := rad_to_deg(asin(clampf(K.dot(Hk), -1.0, 1.0)))
		if kf < LIM["kn_lo"] or kf > LIM["kn_hi"]: _fail(s + " knee flex", kf)
		if absf(koff) > LIM["kn_off"]: _fail(s + " knee off-plane", koff)
	# frame-to-frame flips
	for i in d.flip_bones:
		var q := Quaternion(d.sk.get_bone_global_pose(i).basis.orthonormalized())
		if _prev.has(i):
			var a := rad_to_deg((_prev[i] as Quaternion).angle_to(q))
			if a > LIM["flip"]: _fail("flip", a, d.sk.get_bone_name(i))
		_prev[i] = q
	if with_skin: _skin(d)

func _skin(d: RigData) -> void:
	var M := []
	M.resize(d.binds.size())
	for k in d.binds.size():
		var b: Array = d.binds[k]
		M[k] = d.sk.get_bone_global_pose(b[0]) * (b[1] as Transform3D)
	var sum := {}
	var mn := {}
	var tot := {}
	for v in d.skin_v:
		var p := Vector3.ZERO
		var bs: PackedInt32Array = v[2]
		var ws: PackedFloat32Array = v[3]
		for k in bs.size(): p += ((M[bs[k]] as Transform3D) * (v[1] as Vector3)) * ws[k]
		var pa := d.sk.get_bone_global_pose(v[4]).origin
		var pb := d.sk.get_bone_global_pose(v[5]).origin
		var pc := d.sk.get_bone_global_pose(v[6]).origin if v[6] >= 0 else pb + d.sk.get_bone_global_pose(v[5]).basis.y.normalized() * (pb - pa).length() * 0.4
		var r := _seg_dist(p, pa, pb, pc) / float(v[7])
		tot[v[0]] = tot.get(v[0], 0) + 1
		sum[v[0]] = sum.get(v[0], 0.0) + r
		mn[v[0]] = minf(mn.get(v[0], 9.0), r)
	# a band collapses when its cross-section shrinks as a whole (candy-wrapper, a folded-through joint), or when any
	# vertex is driven into the bone; the inner fold of a deep bend alone (some vertices nearer the line) is LBS-normal
	for j in tot:
		var mean := float(sum[j]) / float(tot[j])
		if mean < LIM["skin_mean"]: _fail(j + " skin volume", mean, "mean radius ratio")
		if float(mn[j]) < LIM["skin_min"]: _fail(j + " skin pinch", float(mn[j]), "min radius ratio " + (str(_last.get(str(j)[0], "")) if verbose else ""))

func _begin(nm: String) -> bool:
	if only != "" and not nm.contains(only): return false
	_case = nm
	_t = 0.0
	_prev.clear()
	ncases += 1
	return true

# ------------------------------------------------------------------ the heroine
var _her: HeroineRig
var _hd: RigData
var _pose := Figure.Pose.new()

func _step_her(n: int, cb := Callable()) -> void:
	for f in n:
		await get_tree().process_frame
		_t += 1.0 / 60.0
		_pose.breath = sin(_t * 1.7)
		if cb.is_valid(): cb.call(_t)
		_her.apply_pose(_pose, 0.0, false)
		_measure(_hd, f % 6 == 0)

func _settle(fade := 0.35) -> void:
	_her.stop(fade)
	_her.hold("")
	_her.set_locomotion(0.0)
	_her.look_at_point(Vector3.INF)
	for s in SIDES: _her.aim_hand(s, Vector3.INF, Vector3.ZERO, 0.0)
	var c := _case
	_case = "(settle)"
	await _step_her(60)
	_case = c

func _w(m: Vector3) -> Vector3:
	return _her.rig.global_transform * m

func _heroine() -> void:
	_her = HeroineRig.new()
	add_child(_her)
	await get_tree().process_frame
	_her.apply_pose(_pose, 0.0, false)
	_hd = _data(_her.sk, _her.mesh_mi, "^(Hem|Veil|Cape)")
	if verbose: print("heroine skin band verts: ", _hd.skin_v.size())
	if _begin("her idle"): await _step_her(240)
	for sp in [0.6, 1.3, 2.4]:
		if _begin("her walk %.1f" % sp):
			_her.set_locomotion(sp)
			await _step_her(200)
			_her.set_locomotion(0.0)
			await _step_her(60)
	for h in ["lamp", "shard"]:
		if _begin("her hold %s" % h):
			_her.hold(h)
			await _step_her(90)
			_her.set_locomotion(1.2)
			await _step_her(120)
			_her.set_locomotion(0.0)
			await _step_her(60)
			await _settle()
	if _begin("her look_at sweep"):
		await _step_her(300, func(t: float) -> void:
			var a := t * 1.3
			_her.look_at_point(_w(Vector3(sin(a) * 1.5, 1.5 + 0.8 * sin(t * 0.7), cos(a) * 1.5))))
		await _settle()
	# the reflections' pose layers (ReflActor / Ione: Figure.Pose clasp / reach, over the walk too)
	for fld in ["clasp", "reach"]:
		if _begin("her Pose.%s" % fld):
			_her.set_locomotion(0.9)
			await _step_her(240, func(t: float) -> void: _pose.set(fld, smoothstep(0.0, 1.0, 1.0 - absf(t / 2.0 - 1.0))))
			_pose.set(fld, 0.0)
			await _settle()
	# every clip, at its default target and two other targets
	var names: Array = HeroineClips.names()
	names.sort()
	for nm in names:
		var c := HeroineClips.get_clip(nm)
		var base: Vector3 = HeroineRig.AT_DEFAULT.get(nm, Vector3(-0.12, 1.12, 0.44))
		for vi in 3:
			var cn := "clip %s%s" % [nm, ["", " @near-low", " @far-high"][vi]]
			if vi > 0 and not HeroineRig.AT_DEFAULT.has(nm): continue
			if not _begin(cn): continue
			var o := {}
			if vi == 1: o["at"] = _w(base + Vector3(0.06, -0.08, -0.08))
			if vi == 2: o["at"] = _w(base + Vector3(-0.08, 0.10, 0.10))
			if PRE.has(nm):
				# (the game plays it straight after another: from that one's held pose)
				var pre: Array = PRE[nm]
				_her.play(pre[0], {"hold": true})
				await _step_her(int(float(pre[1]) * 60.0))
				o.merge(pre[2])
			if nm.begins_with("hold_"): _her.hold(nm.substr(5))
			else: _her.play(nm, o)
			await _step_her(int((float(c["len"]) + 0.6) * 60.0))
			await _settle(1.0 if nm == "lie_side" else 0.35)      # (lying: the game only ever leaves it by "rise")
	# clips over the lamp (light_with_lamp is authored over hold_lamp) and over the walk's end
	for nm in ["light_with_lamp", "reach", "push"]:
		if _begin("clip %s (lamp held)" % nm):
			_her.hold("lamp")
			await _step_her(30)
			_her.play(nm)
			await _step_her(int((HeroineClips.get_clip(nm)["len"] + 0.6) * 60.0))
			await _settle()
	# aim_hand: a grid of targets, eased between (both hands)
	# (a cycle whose straight legs never pass through her own shoulder: a hand cannot go there)
	var pts := [Vector3(0.15, 1.15, 0.40), Vector3(0.20, 1.90, 0.35), Vector3(0.10, 2.20, 0.0), Vector3(0.60, 1.20, 0.0),
		Vector3(0.30, 1.00, -0.25), Vector3(0.25, 0.85, 0.15), Vector3(0.15, 0.60, 0.35), Vector3(-0.15, 1.20, 0.35),
		Vector3(0.05, 1.50, 0.18), Vector3(0.10, 1.25, 0.16)]
	var nrm := [Vector3.ZERO, Vector3(0, 0, -1), Vector3.UP]
	for s: String in SIDES:
		var sg := 1.0 if s == "L" else -1.0
		for ni in nrm.size():
			if not _begin("aim_hand %s n%d" % [s, ni]): continue
			var prev: Vector3 = pts[pts.size() - 1] * Vector3(sg, 1, 1)
			for p in pts:
				var tgt: Vector3 = p * Vector3(sg, 1, 1)
				var a0 := prev
				var t0 := _t
				await _step_her(70, func(t: float) -> void:
					var k := smoothstep(0.0, 1.0, minf(1.0, (t - t0) / 0.6))
					var n_w: Vector3 = _her.rig.global_transform.basis * (nrm[ni] as Vector3) if (nrm[ni] as Vector3) != Vector3.ZERO else Vector3.ZERO
					_her.aim_hand(s, _w(a0.lerp(tgt, k)), n_w.normalized(), 1.0))
				prev = tgt
			await _settle()

# ------------------------------------------------------------------ the Warden
var _wd: WardenRig
var _wdd: RigData

func _step_w(n: int, cb := Callable()) -> void:
	for f in n:
		await get_tree().process_frame
		_t += 1.0 / 60.0
		if cb.is_valid(): cb.call(_t)
		# (WardenRig._process ran this frame: the skeleton is posed)
		_measure(_wdd, f % 6 == 0)

func _warden() -> void:
	_wd = WardenRig.new()
	add_child(_wd)
	await get_tree().process_frame
	var mi: MeshInstance3D = _wd.model.find_children("*", "MeshInstance3D", true, false)[0]
	_wdd = _data(_wd.skel, mi, "^(Hem|Cape)")
	if _begin("warden idle"): await _step_w(300)
	if _begin("warden walk"):
		_wd.walk(true)
		await _step_w(330)
		_wd.walk(false)
		await _step_w(60)
	for a in ["turn_head_left", "turn_head_right"]:
		if _begin("warden " + a):
			_wd.anim.play(a, 0.3)
			await _step_w(200)
			_wd.anim.play("idle", 0.4)
			await _step_w(40)
	if _begin("warden look sweep"):
		await _step_w(300, func(t: float) -> void: _wd.look_at_point(_wd.global_position + Vector3(sin(t * 1.3) * 2.0, 1.6, cos(t * 1.3) * 2.0)))
		_wd.look_at_point(Vector3.INF)
	# grabs (the prologue: her upper arm, in front of him, lower; and around)
	var tg := [Vector3(-0.25, 0.85, 0.45), Vector3(0.0, 1.0, 0.5), Vector3(-0.5, 1.2, 0.2), Vector3(-0.2, 0.6, 0.35), Vector3(-0.15, 1.4, 0.3)]
	for side in ["R", "L"]:
		for i in tg.size():
			var p: Vector3 = tg[i] * (Vector3(1, 1, 1) if side == "R" else Vector3(-1, 1, 1))
			if not _begin("warden grab %s %d" % [side, i]): continue
			_wd.grab(_wd.global_transform * p, side, 1.0)
			await _step_w(120)
			_wd.ungrab(0.8)
			await _step_w(60)
