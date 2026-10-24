class_name Names
extends RefCounted
## Every place name in ONE table, so the spaces are easy to rename.

const AREAS := {
	"gate": "The Veiled Gate",
	"hall": "Hall of Glass",
	"garden": "Garden of the Veiled",
	"court": "Court of Light",
	"shrine": "The First Shrine",
}

## walk-region name (Level) -> area key
const REGION_AREA := {
	"T": "gate", "stub": "gate", "b1_stair": "gate",
	"H": "hall",
	"G": "garden", "shortcut_ramp": "garden",
	"passage": "court", "L": "court", "LB": "court",
	"E": "shrine", "EB": "shrine", "S": "shrine", "sealed_way": "shrine",
}

## the first awakened space (the slice's milestone)
const FIRST := "gate"

static func area(key: String) -> String:
	return AREAS.get(key, "")

static func awakened(key: String) -> String:
	return "%s — awakened" % area(key)
