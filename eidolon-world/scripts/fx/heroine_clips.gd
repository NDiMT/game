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
		[1.35, {"r": V(-0.02, -0.50, 0.04), "sp": V(0.95, 0.08, 0.0), "hd": V(0.15, 0.0, 0.0), "Rik": 1.0, "Rh": "@", "Rel": V(-0.5, -0.2, -0.6), "Rpw": 1.0, "Rpn": "@n"}],
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
	# ---------------------------------------------------------------- a4: v3 phase 3 asks
	# push a block at "@" (its near face, waist high): both palms on, she leans her weight in and shoves, steps after it
	_lib["push"] = {"len": 2.0, "blend": [0.2, 0.35], "ev": {"contact": 0.45, "shove": 0.6, "done": 1.5}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Lik": 0.0, "Rh": HANG_R, "Lh": HANG_L, "Rpw": 0.0, "Lpw": 0.0, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Rfp": 0.0, "Rsh": Vector2.ZERO, "Lsh": Vector2.ZERO}],
		[0.45, {"r": V(0.0, -0.05, 0.04), "sp": V(0.30, 0, 0), "hd": V(0.12, 0, 0), "Rik": 1.0, "Lik": 1.0, "Rh": ["@", V(-0.16, 0, 0)], "Lh": ["@", V(0.16, 0, 0)],
			"Rel": V(-0.6, -0.7, -0.3), "Lel": V(0.6, -0.7, -0.3), "Rpw": 1.0, "Lpw": 1.0, "Rpn": "@n", "Lpn": "@n", "fw": 1.0, "Lf": V(0.10, 0.085, 0.12), "Rf": V(-0.10, 0.085, -0.22), "Rfp": 0.5}, "e"],
		[0.6, {"r": V(0.0, -0.08, 0.10), "sp": V(0.42, 0, 0), "Rsh": Vector2(0.0, 0.10), "Lsh": Vector2(0.0, 0.10)}, "s"],
		[1.35, {"r": V(0.0, -0.06, 0.30), "sp": V(0.40, 0, 0), "Rh": ["@", V(-0.16, 0, 0.30)], "Lh": ["@", V(0.16, 0, 0.30)], "Lf": V(0.10, 0.085, 0.36), "Rf": V(-0.10, 0.085, 0.06), "Rfp": 0.2}],
		[2.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Lik": 0.0, "Rh": HANG_R, "Lh": HANG_L, "Rpw": 0.0, "Lpw": 0.0, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Rfp": 0.0,
			"Rsh": Vector2.ZERO, "Lsh": Vector2.ZERO}, "e"]]}
	# light a brazier / votive / beacon at "@" with the lamp in her right hand (over hold_lamp): she lowers it in, tilts it, waits
	_lib["light_with_lamp"] = {"len": 2.6, "hold_t": 1.3, "blend": [0.25, 0.35], "ev": {"light": 1.05}, "keys": [
		[0.0, {"Rik": 1.0, "Rh": V(-0.17, 1.30, 0.30), "Rel": V(-0.6, -0.8, -0.1), "Rpw": 0.9, "Rpn": V(0, 1, 0.2), "sp": Z, "hd": Z, "Rw": Z}],
		[0.7, {"Rh": ["@", V(0, 0.16, -0.10)], "Rel": V(-0.5, -0.9, -0.3), "sp": V(0.22, 0.06, 0), "hd": V(0.30, 0.04, 0.05)}, "e"],
		[1.05, {"Rh": ["@", V(0, 0.10, -0.04)], "Rw": V(0.0, 0.0, -0.45), "Rpn": V(0.4, 0.8, 0.3), "hd": V(0.34, 0.04, 0.10)}, "e"],
		[1.3, {"Rh": ["@", V(0, 0.11, -0.05)], "Rw": V(0.0, 0.0, -0.40)}],
		[2.6, {"Rh": V(-0.17, 1.30, 0.30), "Rel": V(-0.6, -0.8, -0.1), "Rw": Z, "Rpn": V(0, 1, 0.2), "sp": Z, "hd": Z}, "e"]]}
	# hold("raise_shard"): the Shard kept up at her eye while she walks (the lens on); the left hand steadies it
	_lib["hold_raise_shard"] = {"len": 4.0, "loop": true, "blend": [0.45, 0.4], "keys": [
		[0.0, {"Rik": 1.0, "Rh": V(-0.05, 1.49, 0.21), "Rel": V(-0.6, -0.7, -0.1), "Rpw": 0.8, "Rpn": V(0.3, 0.0, -1.0), "hd": V(-0.05, 0.0, -0.10),
			"Lik": 0.5, "Lh": V(0.05, 1.10, 0.22), "Lel": EL_L}],
		[2.0, {"Rh": V(-0.05, 1.495, 0.215), "hd": V(-0.06, 0.01, -0.11)}],
		[4.0, {"Rh": V(-0.05, 1.49, 0.21), "hd": V(-0.05, 0.0, -0.10)}]]}
	# untie a horn cleat at "@" (2.5 s, StillRoomFx.untie's wraps): the left hand holds the standing part, the right
	# unwinds three turns over the horns, then flicks the rope free
	var UW := []
	for i in 3:
		var t0 := 0.55 + i * 0.5
		UW.append([t0, {"Rh": ["@", V(-0.07, 0.05, -0.02)], "Rw": V(0.3, 0.2, 0.0)}, "e"])
		UW.append([t0 + 0.25, {"Rh": ["@", V(0.06, -0.03, -0.06)], "Rw": V(-0.2, -0.3, 0.1)}, "e"])
	_lib["untie_cleat"] = {"len": 3.0, "blend": [0.2, 0.3], "ev": {"grip": 0.45, "wrap1": 0.8, "wrap2": 1.3, "wrap3": 1.8, "free": 2.25}, "keys": [
		[0.0, {"Rik": 0.0, "Lik": 0.0, "Rh": HANG_R, "Lh": HANG_L, "sp": Z, "hd": Z, "Rw": Z}],
		[0.45, {"Rik": 1.0, "Lik": 1.0, "Rh": "@", "Lh": ["@", V(0.18, -0.08, -0.04)], "Rel": V(-0.5, -0.8, -0.3), "Lel": EL_L, "sp": V(0.18, 0.05, 0), "hd": V(0.28, 0.0, 0.05)}, "e"]]
		+ UW + [
		[2.25, {"Rh": ["@", V(-0.25, 0.10, -0.15)], "Rw": V(-0.4, 0, 0.3), "Lh": ["@", V(0.10, -0.12, -0.10)], "hd": V(0.20, -0.1, 0)}, "s"],
		[3.0, {"Rik": 0.0, "Lik": 0.0, "Rh": HANG_R, "Lh": HANG_L, "sp": Z, "hd": Z, "Rw": Z}, "e"]]}
	# reach high for "@" (default: above her head): onto her toes, the head tipped back; hold_t: the hand stays up
	_lib["reach_high"] = {"len": 2.0, "hold_t": 1.0, "blend": [0.2, 0.3], "ev": {"contact": 0.8}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "Rfp": 0.0, "Lfp": 0.0, "Rsh": Vector2.ZERO}],
		[0.8, {"r": V(0, 0.07, 0), "sp": V(-0.12, 0.08, 0.04), "hd": V(-0.42, 0.05, 0.0), "Rik": 1.0, "Rh": "@", "Rel": V(-0.6, -0.2, 0.0), "Rsh": Vector2(0.14, 0.05), "Rfp": 0.55, "Lfp": 0.55}, "e"],
		[1.0, {"Rh": ["@", V(0, 0.015, 0)]}],
		[2.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "Rsh": Vector2.ZERO, "Rfp": 0.0, "Lfp": 0.0}, "e"]]}
	# she reaches high for "@" and falls short: up on her toes, a straining second try, the arm drops, the head shakes
	_lib["reach_fail_shake"] = {"len": 3.2, "blend": [0.2, 0.35], "ev": {"short": 0.8, "drop": 1.5}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "Rfp": 0.0, "Lfp": 0.0, "Rsh": Vector2.ZERO}],
		[0.8, {"r": V(0, 0.07, 0), "sp": V(-0.12, 0.08, 0.04), "hd": V(-0.42, 0.05, 0), "Rik": 1.0, "Rh": ["@", V(0, -0.22, 0)], "Rel": V(-0.6, -0.2, 0), "Rsh": Vector2(0.16, 0.05), "Rfp": 0.6, "Lfp": 0.6}, "e"],
		[1.15, {"r": V(0, 0.09, 0), "Rh": ["@", V(0, -0.17, 0)], "Rsh": Vector2(0.2, 0.06), "Rfp": 0.75, "Lfp": 0.75}, "e"],
		[1.5, {"r": V(0, -0.02, 0), "sp": V(0.10, 0, 0), "hd": V(0.15, 0, 0), "Rik": 0.3, "Rh": V(-0.22, 0.95, 0.15), "Rsh": Vector2.ZERO, "Rfp": 0.0, "Lfp": 0.0}, "i"],
		[1.85, {"hd": V(0.22, 0.30, 0.0)}, "e"], [2.15, {"hd": V(0.22, -0.30, 0.0)}, "e"], [2.45, {"hd": V(0.20, 0.22, 0.0)}, "e"],
		[3.2, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R}, "e"]]}
	# knock twice on the glass at "@" (normal "@n" toward her) with the knuckles
	_lib["knock_glass_twice"] = {"len": 1.9, "blend": [0.2, 0.3], "ev": {"knock1": 0.6, "knock2": 0.95}, "keys": [
		[0.0, {"Rik": 0.0, "Rh": ["@", V(0, -0.3, -0.3)], "Rw": Z, "hd": Z, "sp": Z}],
		[0.45, {"Rik": 1.0, "Rh": ["@n", 0.09], "Rel": V(-0.5, -0.9, -0.2), "Rw": V(-0.9, 0, 0), "sp": V(0.06, 0.04, 0), "hd": V(0.04, 0.05, 0.05)}, "e"],
		[0.6, {"Rh": ["@n", 0.012]}, "i"], [0.78, {"Rh": ["@n", 0.08]}, "e"],
		[0.95, {"Rh": ["@n", 0.012]}, "i"], [1.15, {"Rh": ["@n", 0.10]}, "e"],
		[1.9, {"Rik": 0.0, "Rh": ["@", V(0, -0.3, -0.3)], "Rw": Z, "hd": Z, "sp": Z}, "e"]]}
	# climb onto a block 0.6 m high just ahead ("@" = its near top edge): hands on, the right knee up, she rises onto it.
	# Its one event "top" (2.4 s; perform's `then`): move her node up / forward onto the block there, then rig.stop(0.05)
	_lib["climb_block"] = {"len": 2.6, "hold_t": 2.4, "blend": [0.2, 0.1], "ev": {"top": 2.4}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Lik": 0.0, "Rh": HANG_R, "Lh": HANG_L, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Rpw": 0.0, "Lpw": 0.0, "Rfp": 0.0}],
		[0.5, {"r": V(0, -0.10, 0.04), "sp": V(0.55, 0, 0), "hd": V(0.10, 0, 0), "Rik": 1.0, "Lik": 1.0, "Rh": ["@", V(-0.16, 0.0, 0.04)], "Lh": ["@", V(0.16, 0.0, 0.04)],
			"Rel": V(-0.6, -0.5, -0.4), "Lel": V(0.6, -0.5, -0.4), "Rpw": 1.0, "Lpw": 1.0, "Rpn": V(0, -1, 0), "Lpn": V(0, -1, 0), "fw": 1.0}, "e"],
		[1.1, {"r": V(0, 0.08, 0.12), "Rf": V(-0.10, 0.68, 0.30), "Rkn": KN, "Rfp": 0.3}, "e"],
		[1.8, {"r": V(0, 0.48, 0.30), "sp": V(0.45, 0, 0), "Lf": V(0.10, 0.40, 0.22), "Rf": V(-0.10, 0.685, 0.32), "Rfp": 0.0, "Rh": ["@", V(-0.18, 0.0, 0.10)], "Lh": ["@", V(0.18, 0.0, 0.10)]}, "e"],
		[2.4, {"r": V(0, 0.60, 0.34), "sp": V(0.08, 0, 0), "hd": Z, "Lf": V(0.085, 0.685, 0.34), "Rf": V(-0.085, 0.685, 0.33), "Rik": 0.0, "Lik": 0.0, "Rh": HANG_R + V(0, 0.6, 0.34), "Lh": HANG_L + V(0, 0.6, 0.34),
			"Rpw": 0.0, "Lpw": 0.0}, "e"],
		[2.6, {"r": V(0, 0.60, 0.34)}]]}
	# ---------------------------------------------------------------- a4: v3 phase 4 (East wing, Act 3) stand-ins replaced
	# ring a bell by its rope at "@" (overhead-ish): she takes it, pulls twice, lets it swing
	_lib["ring_bell"] = {"len": 2.6, "blend": [0.2, 0.3], "ev": {"ring": 0.95, "ring2": 1.55}, "keys": [
		[0.0, {"Rik": 0.0, "Rh": HANG_R, "sp": Z, "hd": Z, "r": Z, "Rpw": 0.0, "Rsh": Vector2.ZERO}],
		[0.6, {"Rik": 1.0, "Rh": "@", "Rel": V(-0.6, -0.5, -0.2), "Rpw": 0.7, "Rpn": V(0.3, 0, 1), "hd": V(-0.25, 0.05, 0), "Rsh": Vector2(0.10, 0.05)}, "e"],
		[0.95, {"Rh": ["@", V(0, -0.30, 0)], "r": V(0, -0.05, 0), "sp": V(0.12, 0, 0), "hd": V(-0.1, 0.05, 0)}, "i"],
		[1.25, {"Rh": ["@", V(0, -0.05, 0)], "r": Z, "sp": Z}, "e"],
		[1.55, {"Rh": ["@", V(0, -0.30, 0)], "r": V(0, -0.05, 0), "sp": V(0.12, 0, 0)}, "i"],
		[1.9, {"Rh": ["@", V(0, -0.15, 0)], "r": Z, "sp": Z, "hd": V(-0.2, 0.05, 0)}, "e"],
		[2.6, {"Rik": 0.0, "Rh": HANG_R, "Rpw": 0.0, "hd": Z, "Rsh": Vector2.ZERO}, "e"]]}
	# reach down low to "@" (knee height) without kneeling: a bend from the hips, one knee giving
	_lib["reach_low"] = {"len": 2.0, "hold_t": 1.0, "blend": [0.2, 0.3], "ev": {"contact": 0.8}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Rh": HANG_R, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Rpw": 0.0, "Lik": 0.0, "Lh": HANG_L}],
		[0.8, {"r": V(0, -0.22, -0.08), "sp": V(0.75, 0.10, 0), "hd": V(0.2, 0, 0), "Rik": 1.0, "Rh": "@", "Rel": V(-0.6, 0.0, -0.4), "Rpw": 0.7, "Rpn": "@n",
			"fw": 1.0, "Lf": V(0.11, 0.085, 0.10), "Rf": V(-0.10, 0.085, -0.10), "Lik": 0.6, "Lh": V(0.20, 0.55, 0.30), "Lel": EL_L}, "e"],
		[1.0, {"Rh": ["@", V(0, 0.01, 0)]}],
		[2.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Lik": 0.0, "Rh": HANG_R, "Rpw": 0.0, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R}, "e"]]}
	# sit on a bench (seat 0.45 m, just behind her): down, hands in her lap; held until release()
	var SIT := {"r": V(0, -0.42, -0.22), "sp": V(0.10, 0, 0), "hd": V(0.18, 0, 0), "fw": 1.0, "fol": 0.0, "Lf": V(0.11, 0.085, 0.22), "Rf": V(-0.11, 0.085, 0.20),
		"Lkn": KN, "Rkn": KN, "Lik": 1.0, "Rik": 1.0, "Lh": V(0.07, 0.60, 0.16), "Rh": V(-0.06, 0.61, 0.17), "Lel": EL_L, "Rel": EL_R, "Lpw": 0.6, "Rpw": 0.6,
		"Lpn": V(0, -1, 0.2), "Rpn": V(0, -1, 0.2)}
	_lib["sit_bench"] = {"len": 4.4, "hold_t": 2.4, "blend": [0.3, 0.4], "ev": {"seated": 1.4}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Lik": 0.0, "Rik": 0.0, "Lh": HANG_L, "Rh": HANG_R, "Lpw": 0.0, "Rpw": 0.0}],
		[0.7, {"r": V(0, -0.22, -0.10), "sp": V(0.35, 0, 0), "fw": 1.0, "Lf": V(0.11, 0.085, 0.16), "Rf": V(-0.11, 0.085, 0.14)}, "e"],
		[1.4, SIT, "e"],
		[2.4, SIT.merged({"hd": V(0.24, 0.04, 0.06)})],
		[3.4, {"r": V(0, -0.20, -0.06), "sp": V(0.45, 0, 0), "Lik": 0.0, "Rik": 0.0, "Lpw": 0.0, "Rpw": 0.0}, "e"],
		[4.4, {"r": Z, "sp": Z, "hd": Z, "fw": 0.0, "Lf": FOOT_L, "Rf": FOOT_R, "Lik": 0.0, "Rik": 0.0, "Lh": HANG_L, "Rh": HANG_R}, "e"]]}
	# hide behind a column: her back pressed to it (it is behind her), palms flat on the stone, the head turned to look past it
	var HIDE := {"r": V(0, -0.03, -0.06), "sp": V(-0.12, 0, 0), "hd": V(-0.05, 0.75, 0.05), "Lik": 1.0, "Rik": 1.0, "Lh": V(0.24, 0.92, -0.10), "Rh": V(-0.24, 0.90, -0.10),
		"Lel": V(0.8, -0.4, 0.2), "Rel": V(-0.8, -0.4, 0.2), "Lpw": 1.0, "Rpw": 1.0, "Lpn": V(0, 0, -1), "Rpn": V(0, 0, -1), "Lsh": Vector2(0.08, -0.06), "Rsh": Vector2(0.08, -0.06)}
	_lib["hide_column"] = {"len": 4.0, "hold_t": 2.6, "blend": [0.25, 0.4], "ev": {"pressed": 0.7}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Lik": 0.0, "Rik": 0.0, "Lh": HANG_L, "Rh": HANG_R, "Lpw": 0.0, "Rpw": 0.0, "Lsh": Vector2.ZERO, "Rsh": Vector2.ZERO}],
		[0.7, HIDE, "s"],
		[1.6, HIDE.merged({"hd": V(-0.02, 0.85, 0.08)})],
		[2.6, HIDE.merged({"hd": V(-0.04, 0.80, 0.05)})],
		[4.0, {"r": Z, "sp": Z, "hd": Z, "Lik": 0.0, "Rik": 0.0, "Lh": HANG_L, "Rh": HANG_R, "Lpw": 0.0, "Rpw": 0.0, "Lsh": Vector2.ZERO, "Rsh": Vector2.ZERO}, "e"]]}
	# flinch: she is seen. The shoulders jump, both hands come up before the face, she turns her head away, then lowers them
	_lib["flinch_seen"] = {"len": 2.2, "blend": [0.03, 0.4], "ev": {"flinch": 0.1}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Lik": 0.0, "Rik": 0.0, "Lh": HANG_L, "Rh": HANG_R, "Lsh": Vector2.ZERO, "Rsh": Vector2.ZERO, "Lpw": 0.0, "Rpw": 0.0}],
		[0.16, {"r": V(0, -0.05, -0.08), "sp": V(0.10, -0.15, 0), "hd": V(0.25, -0.55, 0.12), "Lik": 1.0, "Rik": 1.0, "Lh": V(0.08, 1.42, 0.24), "Rh": V(-0.10, 1.36, 0.26),
			"Lel": EL_L, "Rel": EL_R, "Lpw": 0.8, "Rpw": 0.8, "Lpn": V(0, 0, 1), "Rpn": V(0, 0, 1), "Lsh": Vector2(0.16, 0.06), "Rsh": Vector2(0.16, 0.06)}, "s"],
		[0.8, {"sp": V(0.12, -0.18, 0), "hd": V(0.30, -0.6, 0.15)}],
		[2.2, {"r": Z, "sp": Z, "hd": Z, "Lik": 0.0, "Rik": 0.0, "Lh": HANG_L, "Rh": HANG_R, "Lpw": 0.0, "Rpw": 0.0, "Lsh": Vector2.ZERO, "Rsh": Vector2.ZERO}, "e"]]}
	# statue-still (like the veiled statues): the hands clasped at her chest, the head bowed; held until release()
	var STILL := {"sp": V(0.05, 0, 0), "hd": V(0.32, 0, 0), "Lik": 1.0, "Rik": 1.0, "Lh": V(0.03, 1.22, 0.20), "Rh": V(-0.03, 1.20, 0.21), "Lel": EL_L, "Rel": EL_R,
		"Lpw": 0.7, "Rpw": 0.7, "Lpn": V(-1, 0, 0.3), "Rpn": V(1, 0, 0.3)}
	_lib["statue_still"] = {"len": 3.6, "hold_t": 2.2, "blend": [0.4, 0.5], "ev": {"still": 1.2}, "keys": [
		[0.0, {"sp": Z, "hd": Z, "Lik": 0.0, "Rik": 0.0, "Lh": HANG_L, "Rh": HANG_R, "Lpw": 0.0, "Rpw": 0.0}],
		[1.2, STILL, "e"], [2.2, STILL],
		[3.6, {"sp": Z, "hd": Z, "Lik": 0.0, "Rik": 0.0, "Lh": HANG_L, "Rh": HANG_R, "Lpw": 0.0, "Rpw": 0.0}, "e"]]}
	# hang a weight on a hook at "@" (above her): both hands lift it up, it catches, she lets go and stays a breath
	_lib["hang_weight"] = {"len": 2.8, "blend": [0.2, 0.3], "ev": {"hung": 1.3}, "keys": [
		[0.0, {"r": Z, "sp": Z, "hd": Z, "Rik": 1.0, "Lik": 1.0, "Rh": V(-0.10, 1.00, 0.30), "Lh": V(0.10, 1.00, 0.30), "Rel": EL_R, "Lel": EL_L, "Rpw": 0.5, "Lpw": 0.5,
			"Rpn": V(1, 0, 0), "Lpn": V(-1, 0, 0), "Rfp": 0.0, "Lfp": 0.0, "Rsh": Vector2.ZERO, "Lsh": Vector2.ZERO}],
		[1.0, {"r": V(0, 0.05, 0), "sp": V(-0.10, 0, 0), "hd": V(-0.40, 0, 0), "Rh": ["@", V(-0.07, -0.06, 0)], "Lh": ["@", V(0.07, -0.06, 0)], "Rel": V(-0.6, -0.3, 0), "Lel": V(0.6, -0.3, 0),
			"Rsh": Vector2(0.14, 0.04), "Lsh": Vector2(0.14, 0.04), "Rfp": 0.45, "Lfp": 0.45}, "e"],
		[1.3, {"Rh": ["@", V(-0.07, -0.02, 0)], "Lh": ["@", V(0.07, -0.02, 0)]}, "i"],
		[1.6, {"Rh": ["@", V(-0.10, -0.12, 0.05)], "Lh": ["@", V(0.10, -0.12, 0.05)], "r": Z, "Rfp": 0.0, "Lfp": 0.0}, "e"],
		[2.8, {"r": Z, "sp": Z, "hd": Z, "Rik": 0.0, "Lik": 0.0, "Rh": HANG_R, "Lh": HANG_L, "Rpw": 0.0, "Lpw": 0.0, "Rsh": Vector2.ZERO, "Lsh": Vector2.ZERO}, "e"]]}
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
		[2.2, {"Lh": V(0.10, 0.08, 0.30), "Lpw": 1.0, "Lpn": V(0, -1, 0), "rr": V(0.0, 0.0, 1.05), "r": V(0.50, -0.64, 0.02), "sp": V(0.30, 0.0, 0.1), "hd": V(0.5, 0.0, 0.55)}, "s"],
		[3.0, {"rr": V(0.0, 0.0, 0.98), "r": V(0.48, -0.62, 0.02), "hd": V(0.55, 0.05, 0.62)}],
		# sitting up on her hip, the head lolls over to the other side in one jerk
		[4.0, {"rr": V(0.0, 0.0, 0.45), "r": V(0.22, -0.66, -0.04), "sp": V(0.45, 0.0, 0.15), "Lh": V(0.30, 0.10, 0.12), "Lf": V(0.62, 0.11, 0.30), "Rf": V(0.55, 0.08, 0.10),
			"Rh": V(-0.12, 0.30, 0.28), "Rpw": 0.3}, "e"],
		[4.5, {"hd": V(0.45, -0.1, -0.5)}, "s"],
		# onto her knees, bent over, the head down
		[5.6, KN2.merged({"sp": V(0.95, 0.0, 0.0), "hd": V(0.5, 0, 0), "Lik": 0.9, "Lh": V(0.14, 0.06, 0.34), "Lpw": 1.0, "Rik": 0.7, "Rh": V(-0.14, 0.12, 0.30), "Rpw": 0.6, "Rpn": V(0, -1, 0)}), "e"],
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
		[1.2, {"Lik": 1.0, "Rik": 1.0, "Lh": V(0.10, 1.30, 0.30), "Rh": V(-0.11, 1.31, 0.28), "Lel": EL_L, "Rel": EL_R, "Lpw": 1.0, "Rpw": 1.0, "Lpn": V(0.1, 1, 0.2), "Rpn": V(-0.1, 1, 0.2),
			"hd": V(0.45, 0.0, 0.08), "sp": V(0.06, 0, 0)}, "e"],
		[2.2, {"Lh": V(0.11, 1.31, 0.31), "Rh": V(-0.11, 1.32, 0.29), "hd": V(0.46, 0.06, 0.18)}],
		[2.5, {"Lw": V(0.5, 0, 0)}, "s"], [2.7, {"Lw": Z}, "s"],
		# they turn over (palms down), slowly, wrong
		[3.6, {"Lpn": V(0.3, -1, 0.3), "Rpn": V(-0.3, -1, 0.3), "Lh": V(0.10, 1.32, 0.31), "Rh": V(-0.10, 1.33, 0.30), "hd": V(0.42, -0.05, -0.12)}, "e"],
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
			"Lh": V(0.30, 0.20, -0.20), "Lel": V(0.3, 0.2, -1.0), "Lpw": 1.0, "Lpn": V(0, -1, 0)}, "s"],
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
	# (a4, after kneel_reach) kneel and lay the palm flat on the water at "@", palm to her reflection's palm; held until release()
	var ptp: Dictionary = (_lib["kneel_reach"] as Dictionary).duplicate(true)
	ptp["ev"] = {"palm": 1.9}
	ptp["keys"][0][1].merge({"Rpw": 0.0, "Lpw": 0.0, "Rsh": Vector2.ZERO}, true)
	ptp["keys"][3][1].merge({"Rpw": 1.0, "Rpn": V(0, -1, 0), "Rel": V(-0.5, -0.3, -0.6)}, true)
	ptp["keys"][4][1].merge({"Rh": "@", "hd": V(0.30, 0.0, 0.0)}, true)
	_lib["palm_to_palm"] = ptp
