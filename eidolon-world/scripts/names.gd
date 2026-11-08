class_name Names
extends RefCounted
## The chapter's name and the audio rooms (assets/audio/v5/manifest.json). (v3: the spaces' own names live in
## Map3.SPACES; Game3.MUSIC picks a room per part.)

const CHAPTER := "The Veiled Gate"

const AREAS := {
	"waking_pool": "The Waking Pool",
	"atrium": "The Atrium of a Thousand Faces",
	"stair_breath": "The Stair of Breath",
	"hall_glass": "Hall of Glass",
	"shard_gallery": "Where Her Shadow Fell",
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
## the audio rooms in score order (Sfx: a room not in Sfx.near pre-loads its neighbours here)
const ORDER := ["waking_pool", "atrium", "stair_breath", "hall_glass", "shard_gallery", "garden_veiled", "hollow_walk",
	"court_light", "mist_maze", "echo_corridor", "scales", "eidolon_ledge", "gate_four", "first_shrine"]

## the first awakened space (the slice's milestone)
const FIRST := "first_shrine"

static func area(key: String) -> String:
	return AREAS.get(key, "")

static func awakened(_key := "") -> String:
	return "%s — awakened" % CHAPTER
