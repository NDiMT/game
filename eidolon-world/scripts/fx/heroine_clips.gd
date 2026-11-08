class_name HeroineClips
extends RefCounted
## v3 (Agent A) the heroine's hand-keyed clips. Keys are poses in HeroineRig CHANNELS (her model space: metres of
## the 1.7 m rig, +z forward, +x her left, y up; angles in radians), sampled with a time-aware Catmull-Rom spline
## (fluid, never key-to-key robotic) or a per-key ease. HeroineRig blends them over its procedural base
## (planted-foot walk, breath, weight shift).
##
## CHANNELS
##   additive (added x the layer weight):
##     r  Vector3 hip offset         rr Vector3 whole-body rotation (x pitch fwd+, y yaw, z roll: +z = onto her right side)
##     sp Vector3 spine (x bow fwd+, y twist, z side bend)    hd Vector3 head (x bow+, y look left+, z tilt)
##     Lsh/Rsh Vector2 shoulder (raise, forward)              Lw/Rw Vector3 wrist (x flex, y twist, z side)
##     Lfp/Rfp float foot pitch (toes down+)
##   absolute (lerped x the layer weight), with their weights:
##     Lik/Rik 0..1 arm IK     Lh/Rh Vector3 wrist target    Lel/Rel Vector3 elbow pole    Lpn/Rpn palm normal, Lpw/Rpw 0..1
##     fw 0..1 feet override   Lf/Rf Vector3 ankle targets   Lkn/Rkn Vector3 knee poles    fol 0..1 feet follow the shins
##   a target value "@" (or ["@", offset]) = the world point given to play(name, {"at": p}); "@n" = its normal {"n": v}
## CLIP KEYS:  len, keys [[t, {channels}, ease]], loop, hold_t (play(..., {"hold": true}) waits there until
##   release()), blend [in, out] seconds, ev {name: t} (HeroineRig.clip_event), idle (an idle variant: fades on moving)
## ease of the segment arriving at a key: "" spline, "s" snap (a sudden jerk that settles), "e" sine in-out, "i" ease in,
##   "l" linear, "h" step (hold the previous value, then jump)

const ADDITIVE := ["r", "rr", "sp", "hd", "Lsh", "Rsh", "Lw", "Rw", "Lfp", "Rfp"]

# --- reference points (model space)
const HANG_R := Vector3(-0.24, 0.80, 0.10)         # where the right wrist hangs at rest (approx.)
const HANG_L := Vector3(0.24, 0.80, 0.10)
const FOOT_L := Vector3(0.085, 0.085, 0.03)
const FOOT_R := Vector3(-0.085, 0.085, 0.03)
const EL_R := Vector3(-0.55, -0.6, -0.55)          # elbow out, down and back
const EL_L := Vector3(0.55, -0.6, -0.55)
const KN := Vector3(0, 0, 1)

static func V(x: float, y: float, z: float) -> Vector3: return Vector3(x, y, z)

static var _lib := {}
static var _compiled := {}

static func names() -> Array:
	_build()
	return _lib.keys()

static func has(n: String) -> bool:
	_build()
	return _lib.has(n)

## compiled clip: {"len", "loop", "hold_t", "blend", "ev", "idle", "ch": {channel: [[t, v, ease], ...]}}
static func get_clip(n: String) -> Dictionary:
	_build()
	if _compiled.has(n): return _compiled[n]
	var src: Dictionary = _lib[n]
	var ch := {}
	for k in src["keys"]:
		var t: float = k[0]
		var e: String = k[2] if k.size() > 2 else ""
		for c in (k[1] as Dictionary):
			if not ch.has(c): ch[c] = []
			ch[c].append([t, k[1][c], e])
	var c2 := {"len": float(src.get("len", 1.0)), "loop": bool(src.get("loop", false)), "hold_t": float(src.get("hold_t", -1.0)),
		"blend": src.get("blend", [0.25, 0.35]), "ev": src.get("ev", {}), "idle": bool(src.get("idle", false)), "ch": ch, "name": n}
	_compiled[n] = c2
	return c2

## a channel at time t (resolve: Callable(v) -> concrete value, for "@" targets)
static func sample(keys: Array, t: float, resolve: Callable) -> Variant:
	var n := keys.size()
	if n == 1 or t <= keys[0][0]: return resolve.call(keys[0][1])
	if t >= keys[n - 1][0]: return resolve.call(keys[n - 1][1])
	var i := 0
	while i < n - 2 and t >= keys[i + 1][0]: i += 1
	var t1: float = keys[i][0]
	var t2: float = keys[i + 1][0]
	var u := (t - t1) / maxf(t2 - t1, 1e-4)
	var a: Variant = resolve.call(keys[i][1])
	var b: Variant = resolve.call(keys[i + 1][1])
	var e: String = keys[i + 1][2]
	match e:
		"s": return _lerp(a, b, 1.0 - pow(1.0 - u, 4.0))
		"e": return _lerp(a, b, 0.5 - 0.5 * cos(PI * u))
		"i": return _lerp(a, b, u * u)
		"l": return _lerp(a, b, u)
		"h": return a if u < 1.0 else b
	var t0: float = keys[i - 1][0] if i > 0 else t1 - (t2 - t1)
	var t3: float = keys[i + 2][0] if i + 2 < n else t2 + (t2 - t1)
	var p0: Variant = resolve.call(keys[i - 1][1]) if i > 0 else a
	var p3: Variant = resolve.call(keys[i + 2][1]) if i + 2 < n else b
	# a key arriving with a non-spline ease is a corner: do not let the spline run through it
	if i > 0 and keys[i][2] != "": p0 = a
	if typeof(a) == TYPE_FLOAT:
		return cubic_interpolate_in_time(a, b, p0, p3, u, t2 - t1, t0 - t1, t3 - t1)
	return (a as Variant).cubic_interpolate_in_time(b, p0, p3, u, t2 - t1, t0 - t1, t3 - t1)

static func _lerp(a: Variant, b: Variant, k: float) -> Variant:
	if typeof(a) == TYPE_FLOAT: return lerpf(a, b, k)
	return a.lerp(b, k)

# ------------------------------------------------------------------------------------------------ the library
static func _build() -> void:
	if not _lib.is_empty(): return
	var Z := Vector3.ZERO
	# ---------------------------------------------------------------- P0 gameplay
	# idle variant 1: the slow head tilt, past what is natural; it lingers, then comes back with a small snap
	_lib["idle_tilt"] = {"len": 6.0, "idle": true, "blend": [0.8, 0.6], "keys": [
		[0.0, {"hd": Z, "sp": Z}],
		[2.6, {"hd": V(0.10, 0.12, 0.42), "sp": V(0.0, 0.0, 0.05)}, "e"],
		[4.2, {"hd": V(0.12, 0.14, 0.46), "sp": V(0.0, 0.0, 0.05)}],
		[4.5, {"hd": V(0.04, -0.03, -0.05), "sp": V(0, 0, 0)}, "s"],
		[6.0, {"hd": Z, "sp": Z}, "e"]]}
	# idle variant 2: the fingers. The right hand drifts up a little; it twitches, she looks down at it
	_lib["idle_fingers"] = {"len": 5.0, "idle": true, "blend": [0.6, 0.6], "keys": [
		[0.0, {"Rik": 0.0, "Rh": HANG_R, "Rw": Z, "hd": Z}],
		[1.2, {"Rik": 0.8, "Rh": V(-0.20, 0.92, 0.22), "Rel": EL_R, "Rw": Z, "hd": V(0.38, -0.12, 0.10)}, "e"],
		[1.55, {"Rw": V(0.55, 0.0, 0.25)}, "s"],
		[1.75, {"Rw": V(0.05, 0.0, 0.0)}, "s"],
		[2.35, {"Rw": V(0.65, 0.15, -0.2)}, "s"],
		[2.5, {"Rw": V(0.35, 0.1, -0.1)}, "s"],
		[2.62, {"Rw": V(0.75, 0.0, 0.3)}, "s"],
		[3.3, {"Rik": 0.8, "Rh": V(-0.20, 0.92, 0.22), "Rw": V(0.1, 0, 0), "hd": V(0.40, -0.12, 0.16)}],
		[5.0, {"Rik": 0.0, "Rh": HANG_R, "Rw": Z, "hd": Z}, "e"]]}
	# the interaction reach (a lever, a bell, a door): the right hand to "@" (default: ahead, chest height)
	_lib["reach"] = {"len": 1.25, "blend": [0.15, 0.25], "ev": {"contact": 0.42}, "keys": [
		[0.0, {"Rik": 0.0, "Rh": ["@", V(0, -0.15, -0.15)], "sp": Z, "hd": Z, "Rsh": Vector2.ZERO}],
		[0.42, {"Rik": 1.0, "Rh": "@", "Rel": V(-0.5, -0.8, -0.3), "sp": V(0.14, 0.10, 0.0), "hd": V(0.10, 0.05, 0.0), "Rsh": Vector2(0.04, 0.10)}],
		[0.7, {"Rik": 1.0, "Rh": ["@", V(0, 0, -0.02)], "sp": V(0.12, 0.08, 0.0)}],
		[1.25, {"Rik": 0.0, "Rh": ["@", V(0, -0.2, -0.2)], "sp": Z, "hd": Z, "Rsh": Vector2.ZERO}, "e"]]}
	# pick up from the floor at "@" (default: in front of her right foot)
	_lib["pickup"] = {"len": 2.1, "blend": [0.2, 0.3], "ev": {"grab": 0.75}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Rfp": 0.0, "Lfp": 0.0}],
		[0.25, {"r": V(0.0, -0.06, -0.02), "sp": V(0.25, 0.0, 0.0), "hd": V(0.30, 0, 0), "fw": 1.0, "Lf": V(0.10, 0.085, 0.16), "Rf": V(-0.10, 0.085, -0.14)}],
		[0.7, {"r": V(0.0, -0.40, -0.06), "sp": V(0.85, 0.12, 0.0), "hd": V(0.25, 0.0, 0.0), "Rik": 1.0, "Rh": "@", "Rel": V(-0.6, 0.1, -0.5), "Rfp": 0.55}],
		[0.95, {"r": V(0.0, -0.42, -0.06), "sp": V(0.88, 0.12, 0.0), "Rh": ["@", V(0, 0.02, 0)]}],
		[1.45, {"r": V(0.0, -0.10, -0.01), "sp": V(0.20, 0.0, 0.0), "hd": V(0.45, -0.1, 0.1), "Rh": V(-0.12, 1.05, 0.30), "Rel": EL_R, "Rfp": 0.0}],
		[2.1, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R}, "e"]]}
	# kneel and touch the water (or the floor) at "@" (default: ahead, at her feet's level). hold_t: the touch held
	_lib["kneel_touch"] = {"len": 3.2, "hold_t": 1.7, "blend": [0.2, 0.3], "ev": {"touch": 1.35}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "Lik": 0.0, "Lh": HANG_L, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Rfp": 0.0, "Rpw": 0.0}],
		[0.35, {"r": V(0.0, -0.06, 0.0), "fw": 1.0, "Rf": V(-0.10, 0.10, -0.20), "Lf": V(0.10, 0.085, 0.16), "sp": V(0.2, 0, 0), "hd": V(0.25, 0, 0)}],
		[0.95, {"r": V(-0.02, -0.46, 0.0), "Rf": V(-0.10, 0.10, -0.36), "Rfp": 1.05, "Lf": V(0.11, 0.085, 0.22), "sp": V(0.55, 0.05, 0.0), "hd": V(0.30, 0.0, 0.0),
			"Lik": 0.8, "Lh": V(0.16, 0.50, 0.40), "Lel": EL_L}],
		[1.35, {"r": V(-0.02, -0.50, 0.04), "sp": V(0.95, 0.08, 0.0), "hd": V(0.15, 0.0, 0.0), "Rik": 1.0, "Rh": "@", "Rel": V(-0.5, -0.2, -0.6), "Rpw": 1.0, "Rpn": V(0, 1, 0)}],
		[1.7, {"r": V(-0.02, -0.50, 0.04), "sp": V(0.98, 0.08, 0.0), "Rh": ["@", V(0, -0.01, 0.01)]}],
		[2.4, {"r": V(-0.02, -0.40, 0.0), "sp": V(0.50, 0.0, 0.0), "Rik": 0.6, "Rh": V(-0.16, 0.70, 0.30), "Rpw": 0.0, "Lik": 0.0}],
		[3.2, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "Lik": 0.0, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Rfp": 0.0}, "e"]]}
	# the palm laid flat on glass at "@" (normal "@n": the glass faces her); hold_t: the hand stays
	_lib["touch_glass"] = {"len": 2.4, "hold_t": 1.2, "blend": [0.2, 0.3], "ev": {"touch": 0.95}, "keys": [
		[0.0, {"Rik": 0.0, "Rh": ["@", V(0, -0.25, -0.25)], "Rpw": 0.0, "Rpn": "@n", "hd": Z, "sp": Z}],
		[0.6, {"Rik": 1.0, "Rh": ["@", V(0, -0.02, -0.07)], "Rel": V(-0.5, -0.9, -0.2), "Rpw": 0.6, "Rpn": "@n", "hd": V(0.05, 0.08, 0.18), "sp": V(0.08, 0.06, 0)}],
		[0.8, {"Rh": ["@", V(0, -0.01, -0.05)]}],
		[0.95, {"Rh": "@", "Rpw": 1.0, "hd": V(0.06, 0.1, 0.24), "sp": V(0.12, 0.08, 0)}, "e"],
		[1.2, {"Rh": "@", "hd": V(0.06, 0.1, 0.28)}],
		[2.4, {"Rik": 0.0, "Rh": ["@", V(0, -0.3, -0.3)], "Rpw": 0.0, "hd": Z, "sp": Z}, "e"]]}
	# the Shard raised to her eye (right hand), looked through; hold_t: she keeps looking
	_lib["shard_eye"] = {"len": 2.6, "hold_t": 1.3, "blend": [0.2, 0.3], "ev": {"at_eye": 0.9}, "keys": [
		[0.0, {"Rik": 0.0, "Rh": V(-0.20, 0.95, 0.25), "hd": Z, "sp": Z, "Rpw": 0.0, "Lik": 0.0, "Lh": HANG_L}],
		[0.9, {"Rik": 1.0, "Rh": V(-0.045, 1.50, 0.20), "Rel": V(-0.6, -0.7, -0.1), "Rpw": 0.8, "Rpn": V(0.3, 0.0, -1.0), "hd": V(-0.06, 0.0, -0.12), "sp": V(-0.04, 0, 0),
			"Lik": 0.6, "Lh": V(0.06, 1.05, 0.20), "Lel": EL_L}],
		[1.3, {"Rh": V(-0.04, 1.51, 0.19), "hd": V(-0.08, 0.02, -0.14)}],
		[2.6, {"Rik": 0.0, "Rh": V(-0.20, 0.95, 0.25), "hd": Z, "sp": Z, "Rpw": 0.0, "Lik": 0.0}, "e"]]}
	# holds (a layer that stays: hold("lamp") / hold("shard") / hold("")): the arm only, over the walk
	_lib["hold_lamp"] = {"len": 4.0, "loop": true, "blend": [0.45, 0.45], "keys": [
		[0.0, {"Rik": 1.0, "Rh": V(-0.17, 1.30, 0.30), "Rel": V(-0.6, -0.8, -0.1), "Rpw": 0.9, "Rpn": V(0.0, 1.0, 0.2), "Rsh": Vector2(0.06, 0.05), "hd": V(-0.04, -0.06, -0.04)}],
		[2.0, {"Rh": V(-0.17, 1.315, 0.305), "hd": V(-0.05, -0.07, -0.05)}],
		[4.0, {"Rh": V(-0.17, 1.30, 0.30), "hd": V(-0.04, -0.06, -0.04)}]]}
	_lib["hold_shard"] = {"len": 4.0, "loop": true, "blend": [0.4, 0.4], "keys": [
		[0.0, {"Rik": 1.0, "Rh": V(-0.12, 1.08, 0.28), "Rel": EL_R, "Rpw": 0.7, "Rpn": V(0.4, 0.3, -0.8), "hd": V(0.18, -0.05, 0.0)}],
		[2.0, {"Rh": V(-0.12, 1.09, 0.285)}],
		[4.0, {"Rh": V(-0.12, 1.08, 0.28)}]]}
	# ---------------------------------------------------------------- the prologue (cinematic)
	# lying on her right side on the marble, knees drawn up, the left hand loose in front of her (a loop: breath only)
	var LIE := {"r": V(0.62, -0.74, 0.02), "rr": V(0.0, 0.0, 1.50), "sp": V(0.35, 0.0, 0.06), "hd": V(0.25, 0.0, 0.18),
		"fw": 1.0, "fol": 1.0, "Lf": V(0.86, 0.17, 0.30), "Rf": V(0.90, 0.07, 0.20), "Lkn": V(0, 0.3, 1), "Rkn": V(0, -0.2, 1),
		"Lik": 1.0, "Lh": V(0.15, 0.07, 0.32), "Lel": V(0.2, 0.6, -0.6), "Lpw": 0.8, "Lpn": V(0.0, 1.0, 0.1),
		"Rik": 1.0, "Rh": V(-0.25, 0.04, 0.24), "Rel": V(0.0, -1.0, -0.3), "Rpw": 0.6, "Rpn": V(0.3, -0.2, 0.9)}
	_lib["lie_side"] = {"len": 5.0, "loop": true, "blend": [0.01, 0.4], "keys": [
		[0.0, LIE], [2.5, {"sp": V(0.37, 0.0, 0.07)}], [5.0, {"sp": V(0.35, 0.0, 0.06)}]]}
	# she rises unnaturally, as if learning her joints: the fingers first, then each part on its own, in jerks
	var KN2 := {"r": V(0.0, -0.52, -0.02), "rr": V(0, 0, 0), "fw": 1.0, "fol": 0.0, "Lf": V(0.12, 0.10, -0.30), "Rf": V(-0.12, 0.10, -0.30),
		"Lfp": 1.1, "Rfp": 1.1, "Lkn": KN, "Rkn": KN}
	_lib["rise"] = {"len": 10.0, "blend": [0.01, 0.6], "ev": {"fingers": 0.4, "push": 2.2, "sit": 4.0, "kneel": 5.6, "stand": 8.0, "head": 9.0}, "keys": [
		[0.0, LIE],
		[0.45, {"Lw": V(0.6, 0.0, 0.2)}, "s"], [0.7, {"Lw": V(0.0, 0.0, 0.0)}, "s"], [1.05, {"Lw": V(0.75, 0.2, -0.2)}, "s"], [1.3, {"Lw": V(0.15, 0, 0)}, "s"],
		[1.5, {"Lh": V(0.15, 0.07, 0.32), "rr": V(0.0, 0.0, 1.50), "r": V(0.62, -0.74, 0.02), "hd": V(0.25, 0.0, 0.18), "sp": V(0.35, 0.0, 0.06)}],
		# the left palm plants, the torso jerks up off the floor, the head hangs behind
		[2.2, {"Lh": V(0.10, 0.08, 0.30), "Lpw": 1.0, "Lpn": V(0, 1, 0), "rr": V(0.0, 0.0, 1.05), "r": V(0.50, -0.64, 0.02), "sp": V(0.30, 0.0, 0.1), "hd": V(0.5, 0.0, 0.55)}, "s"],
		[3.0, {"rr": V(0.0, 0.0, 0.98), "r": V(0.48, -0.62, 0.02), "hd": V(0.55, 0.05, 0.62)}],
		# sitting up on her hip, the head lolls over to the other side in one jerk
		[4.0, {"rr": V(0.0, 0.0, 0.45), "r": V(0.22, -0.66, -0.04), "sp": V(0.45, 0.0, 0.15), "Lh": V(0.30, 0.10, 0.12), "Lf": V(0.62, 0.11, 0.30), "Rf": V(0.55, 0.08, 0.10),
			"Rh": V(-0.12, 0.30, 0.28), "Rpw": 0.3}, "e"],
		[4.5, {"hd": V(0.45, -0.1, -0.5)}, "s"],
		# onto her knees, bent over, the head down
		[5.6, KN2.merged({"sp": V(0.95, 0.0, 0.0), "hd": V(0.5, 0, 0), "Lik": 0.9, "Lh": V(0.14, 0.06, 0.34), "Lpw": 1.0, "Rik": 0.7, "Rh": V(-0.14, 0.12, 0.30), "Rpw": 0.6, "Rpn": V(0, 1, 0)}), "e"],
		[6.3, {"sp": V(0.95, 0.0, 0.0), "hd": V(0.55, 0, 0.1)}],
		# the hips rise first, the back still folded (a marionette lifted by the waist), the arms hang
		[7.4, {"r": V(0.0, -0.12, -0.03), "fw": 1.0, "Lf": V(0.10, 0.085, 0.04), "Rf": V(-0.09, 0.085, -0.02), "Lfp": 0.0, "Rfp": 0.0, "sp": V(1.15, 0.0, 0.0), "hd": V(0.4, 0, 0.0),
			"Lik": 0.0, "Rik": 0.0, "Lpw": 0.0, "Rpw": 0.0}, "e"],
		# the spine unrolls in two jerks; the head comes up last, a beat late, with a snap and a small overshoot
		[8.0, {"r": V(0.0, -0.03, 0.0), "sp": V(0.55, 0.0, 0.0), "hd": V(0.7, 0, 0.0)}, "s"],
		[8.6, {"sp": V(0.04, 0.0, 0.0), "hd": V(0.75, 0.0, 0.1)}, "s"],
		[9.0, {"hd": V(-0.10, 0.05, -0.12), "r": Z}, "s"],
		[10.0, {"hd": V(0.0, 0.0, 0.0), "sp": Z, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R}, "e"]]}
	# she looks at her hands: both come up, palms up, then turn over; the head bows to them
	_lib["look_hands"] = {"len": 5.2, "blend": [0.3, 0.4], "keys": [
		[0.0, {"Lik": 0.0, "Rik": 0.0, "Lh": HANG_L, "Rh": HANG_R, "hd": Z, "Lpw": 0.0, "Rpw": 0.0}],
		[1.2, {"Lik": 1.0, "Rik": 1.0, "Lh": V(0.10, 1.02, 0.30), "Rh": V(-0.12, 1.04, 0.28), "Lel": EL_L, "Rel": EL_R, "Lpw": 1.0, "Rpw": 1.0, "Lpn": V(0.1, 1, 0.2), "Rpn": V(-0.1, 1, 0.2),
			"hd": V(0.52, 0.0, 0.08), "sp": V(0.06, 0, 0)}, "e"],
		[2.2, {"Lh": V(0.11, 1.03, 0.31), "Rh": V(-0.12, 1.05, 0.29), "hd": V(0.55, 0.06, 0.18)}],
		[2.5, {"Lw": V(0.5, 0, 0)}, "s"], [2.7, {"Lw": Z}, "s"],
		# they turn over (palms down), slowly, wrong
		[3.6, {"Lpn": V(0.3, -1, 0.3), "Rpn": V(-0.3, -1, 0.3), "Lh": V(0.10, 1.05, 0.31), "Rh": V(-0.11, 1.06, 0.30), "hd": V(0.5, -0.05, -0.12)}, "e"],
		[4.1, {"hd": V(0.48, -0.05, -0.2)}],
		[5.2, {"Lik": 0.0, "Rik": 0.0, "Lh": HANG_L, "Rh": HANG_R, "hd": Z, "Lpw": 0.0, "Rpw": 0.0, "sp": Z, "Lw": Z}, "e"]]}
	# kneel and reach out over the water toward "@" (held until release()); then recoil is a separate clip
	_lib["kneel_reach"] = {"len": 4.0, "hold_t": 2.4, "blend": [0.25, 0.3], "ev": {"reach": 1.9}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "Lik": 0.0, "Lh": HANG_L, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Rfp": 0.0}],
		[0.4, {"r": V(0.0, -0.06, 0.0), "fw": 1.0, "Rf": V(-0.10, 0.10, -0.20), "Lf": V(0.10, 0.085, 0.16), "sp": V(0.2, 0, 0), "hd": V(0.25, 0, 0)}],
		[1.1, {"r": V(-0.02, -0.46, 0.0), "Rf": V(-0.10, 0.10, -0.36), "Rfp": 1.05, "Lf": V(0.11, 0.085, 0.22), "sp": V(0.55, 0.05, 0.0), "hd": V(0.40, 0.0, 0.0),
			"Lik": 0.9, "Lh": V(0.18, 0.45, 0.42), "Lel": EL_L, "Lpw": 0.6, "Lpn": V(0, -0.3, 1)}],
		[1.9, {"r": V(-0.02, -0.50, 0.06), "sp": V(0.85, 0.12, 0.0), "hd": V(0.10, 0.05, 0.0), "Rik": 1.0, "Rh": "@", "Rel": V(-0.4, -0.5, -0.5), "Rpw": 0.8, "Rpn": V(0, -0.6, 1), "Rsh": Vector2(0.05, 0.12)}, "e"],
		[2.4, {"Rh": ["@", V(0, -0.01, 0.015)], "sp": V(0.88, 0.12, 0.0)}],
		[4.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "Lik": 0.0, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Rfp": 0.0, "Rpw": 0.0, "Rsh": Vector2.ZERO}, "e"]]}
	# recoil (from the kneel): the hand snaps back to her chest, she jerks back onto her left hand, the face turns away
	_lib["recoil"] = {"len": 3.2, "hold_t": 1.4, "blend": [0.02, 0.4], "ev": {"flinch": 0.12}, "keys": [
		[0.0, {"r": V(-0.02, -0.50, 0.06), "sp": V(0.85, 0.12, 0.0), "hd": V(0.10, 0.05, 0.0), "Rik": 1.0, "Rh": V(-0.10, 0.30, 0.70), "Rel": V(-0.4, -0.5, -0.5),
			"Lik": 0.9, "Lh": V(0.18, 0.45, 0.42), "Lel": EL_L, "fw": 1.0, "Rf": V(-0.10, 0.10, -0.36), "Rfp": 1.05, "Lf": V(0.11, 0.085, 0.22), "Rpw": 0.0, "Lpw": 0.0}],
		[0.22, {"r": V(0.0, -0.52, -0.10), "sp": V(-0.20, -0.15, 0.05), "hd": V(-0.30, -0.45, 0.10), "Rh": V(-0.02, 1.0, 0.16), "Rel": V(-0.6, -0.8, 0.0),
			"Lh": V(0.30, 0.20, -0.20), "Lel": V(0.3, 0.2, -1.0), "Lpw": 1.0, "Lpn": V(0, 1, 0)}, "s"],
		[0.6, {"r": V(0.0, -0.53, -0.12), "sp": V(-0.25, -0.18, 0.06), "hd": V(-0.22, -0.55, 0.15), "Rh": V(0.0, 1.02, 0.15)}],
		[1.4, {"sp": V(-0.20, -0.16, 0.05), "hd": V(-0.10, -0.50, 0.12)}],
		[3.2, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "Lik": 0.0, "Lh": HANG_L, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Rfp": 0.0, "Lpw": 0.0}, "e"]]}
	# ---------------------------------------------------------------- the crimson reflection (Ione) in the pool
	# under the surface, her palm pressed up flat on it ("@": the point on the surface; default above her), then two taps
	_lib["refl_press"] = {"len": 4.6, "hold_t": 4.0, "blend": [0.3, 0.3], "ev": {"press": 1.4, "tap1": 2.35, "tap2": 2.95}, "keys": [
		[0.0, {"Rik": 0.0, "Rh": HANG_R, "hd": Z, "sp": Z, "Rpw": 0.0, "Lik": 0.0, "Lh": HANG_L}],
		[1.1, {"Rik": 1.0, "Rh": ["@", V(0, -0.08, 0)], "Rel": V(-0.7, -0.3, -0.4), "Rpw": 1.0, "Rpn": V(0, 1, 0), "hd": V(-0.45, 0.0, 0.10), "sp": V(-0.08, 0.0, -0.04), "Rsh": Vector2(0.12, 0.0),
			"Lik": 0.7, "Lh": V(0.10, 1.10, 0.20), "Lel": EL_L}, "e"],
		[1.4, {"Rh": "@"}, "e"],
		[2.0, {"Rh": "@"}],
		[2.2, {"Rh": ["@", V(0, -0.07, 0)]}, "e"], [2.35, {"Rh": "@"}, "i"],
		[2.8, {"Rh": ["@", V(0, -0.07, 0)]}, "e"], [2.95, {"Rh": "@"}, "i"],
		[4.0, {"Rh": "@", "hd": V(-0.40, 0.05, 0.16)}],
		[4.6, {"Rh": "@"}]]}
	# dragged down (the Warden's pull): a jerk downward, the arms flung up to the surface, the head thrown back
	_lib["refl_dragged"] = {"len": 2.8, "hold_t": 2.8, "blend": [0.02, 0.3], "ev": {"jerk": 0.1}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": V(-0.40, 0.05, 0.16), "Rik": 1.0, "Rh": V(-0.10, 1.78, 0.12), "Rpw": 1.0, "Rpn": V(0, 1, 0), "Lik": 0.7, "Lh": V(0.10, 1.10, 0.20), "Lel": EL_L}],
		[0.18, {"r": V(0.0, -0.10, -0.04), "sp": V(-0.25, 0.05, 0.06), "hd": V(-0.55, 0.10, 0.10), "Rh": V(-0.16, 1.80, 0.20), "Rel": V(-0.8, 0, -0.3), "Rpn": V(0, 1, 0.3),
			"Lik": 1.0, "Lh": V(0.20, 1.72, 0.22), "Lel": V(0.8, 0, -0.3), "Lpw": 0.8, "Lpn": V(0, 1, 0.3), "fw": 1.0, "Lf": V(0.10, 0.12, 0.10), "Rf": V(-0.12, 0.10, -0.06), "Rfp": 0.6, "Lfp": 0.5}, "s"],
		[1.2, {"sp": V(-0.30, 0.10, 0.04), "hd": V(-0.5, 0.2, 0.05), "Rh": V(-0.20, 1.82, 0.26), "Lh": V(0.24, 1.76, 0.26), "Lf": V(0.10, 0.20, 0.0), "Rf": V(-0.10, 0.10, 0.02)}],
		[2.8, {"sp": V(-0.32, 0.08, 0.02), "hd": V(-0.45, 0.1, 0.0), "Rh": V(-0.22, 1.84, 0.28), "Lh": V(0.26, 1.80, 0.28)}]]}
