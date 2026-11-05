extends "res://tests/overlap_test.gd"
## (Agent A, dev) W's overlap test, with A's proposed v2 dressings built first (EIDOLON_V2=1)
func _gather() -> void:
	for r in V2Proposed.build(lv): print(r)
	super._gather()
