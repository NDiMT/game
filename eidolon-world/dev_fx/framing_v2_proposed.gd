extends "res://tests/framing_test.gd"
## (Agent A, dev) W's framing / occlusion test, with A's proposed v2 dressings built first (EIDOLON_V2=1)
var _built := false
func _collect(n: Node, skip: Node, body: StaticBody3D, names: Dictionary, count: Array) -> void:
	if not _built:
		_built = true
		for r in V2Proposed.build(lv_ref): print(r)
	super._collect(n, skip, body, names, count)
