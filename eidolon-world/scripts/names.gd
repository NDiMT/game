class_name Names
extends RefCounted
## Every place name in ONE table, so the spaces are easy to rename.
## v0.5: Chapter I, "The Veiled Gate", is thirteen spaces; the keys are the audio room ids
## (dev/ROOMS.md, assets/audio/v5/manifest.json).

const CHAPTER := "The Veiled Gate"

const AREAS := {
	"waking_pool": "The Waking Pool",
	"stair_breath": "The Stair of Breath",
	"hall_glass": "Hall of Glass",
	"shard_gallery": "The Shard Gallery",
	"garden_veiled": "Garden of the Veiled",
	"hollow_walk": "The Hollow Walk",
	"court_light": "Court of Light",
	"mist_maze": "The Mist Maze",
	"echo_corridor": "The Echo Corridor",
	"scales": "The Scales",
	"eidolon_ledge": "The Eidolon Ledge",
	"gate_four": "Gate of the Four Veiled",
	"first_shrine": "The First Shrine",
}
const ORDER := ["waking_pool", "stair_breath", "hall_glass", "shard_gallery", "garden_veiled", "hollow_walk",
	"court_light", "mist_maze", "echo_corridor", "scales", "eidolon_ledge", "gate_four", "first_shrine"]

## walk-region name (Level) -> area key
const REGION_AREA := {
	"T": "waking_pool", "stub": "waking_pool", "b1": "waking_pool",
	"W_land": "stair_breath", "W_stair1": "stair_breath", "W_breath": "stair_breath", "W_stair2": "stair_breath",
	"W_top": "stair_breath", "W_corr": "stair_breath",
	"H": "hall_glass", "hdoor": "hall_glass",
	"GL": "shard_gallery",
	"G": "garden_veiled", "shortcut_ramp": "garden_veiled",
	"g_door": "hollow_walk", "HW": "hollow_walk",
	"HW_ramp": "court_light", "L_ramp": "court_light", "L": "court_light", "LB": "court_light",
	"MZ_door": "mist_maze", "MZ": "mist_maze",
	"EC_a": "echo_corridor", "EC": "echo_corridor", "EC_room_door": "echo_corridor", "EC_room": "echo_corridor",
	"SC": "scales", "lift": "scales",
	"WK": "eidolon_ledge", "WK_down": "eidolon_ledge", "E": "eidolon_ledge",
	"EB": "gate_four", "S": "gate_four", "four_plinth": "gate_four", "sealed_way": "first_shrine",
}

## the first awakened space (the slice's milestone)
const FIRST := "first_shrine"

static func area(key: String) -> String:
	return AREAS.get(key, "")

static func awakened(_key := "") -> String:
	return "%s — awakened" % CHAPTER
