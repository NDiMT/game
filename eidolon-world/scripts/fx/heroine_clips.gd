class_name HeroineClips
extends RefCounted
## a7 (Agent A): the heroine's clip table. The clips themselves are baked animations in assets/models/heroine_v2.glb
## (retargeted CC0 mocap + keyed gestures, dev_rig/tools/heroine_bl_rig.py + heroine_bl_clips.py); their timing,
## events, hold points and hand targets are in HeroineClipData (generated with the GLB). HeroineRig plays them.
## get_clip(name) -> {"name", "len", "loop", "hold_t" (-1: none), "blend": [in, out], "ev": {name: t}, "idle",
##   "layer" ("arm_r": a hold), "ik": [{side, t: [in0, in1, out0, out1], hand}], "at", "n"}

## the loops the rig runs itself (not clips to play)
const BASE := ["idle", "walk"]

static var _clips := {}

static func _build() -> void:
	if not _clips.is_empty(): return
	for n in HeroineClipData.CLIPS:
		var c: Dictionary = (HeroineClipData.CLIPS[n] as Dictionary).duplicate(true)
		c["name"] = n
		_clips[n] = c

static func names() -> Array:
	_build()
	return _clips.keys().filter(func(n: String) -> bool: return not BASE.has(n))

static func has(n: String) -> bool:
	_build()
	return _clips.has(n)

static func get_clip(n: String) -> Dictionary:
	_build()
	return _clips.get(n, {})

## the authored default "@" / surface normal per targeted clip (her model space)
static func at_defaults() -> Dictionary:
	_build()
	var d := {}
	for n in _clips: if _clips[n].has("at"): d[n] = _clips[n]["at"]
	return d

static func n_defaults() -> Dictionary:
	_build()
	var d := {}
	for n in _clips: if _clips[n].has("n"): d[n] = _clips[n]["n"]
	return d
