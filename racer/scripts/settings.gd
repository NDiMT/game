class_name Settings
## Player preferences, persisted in user://settings.cfg (IndexedDB on the web).

const PATH := "user://settings.cfg"
const CAM_MODES := ["iso_follow", "iso_fixed", "chase"]
const CAM_LABEL := {"iso_follow": "ISO FOLLOW", "iso_fixed": "ISO FIXED", "chase": "CHASE"}

static var cam_mode := "iso_follow"
const WEAPON_MODES := ["buttons", "tap", "flick", "auto"]
const WEAPON_LABEL := {"buttons": "BUTTONS", "tap": "TAP", "flick": "FLICK", "auto": "AUTO"}
static var weapon_mode := "buttons" # buttons (default) | tap | flick (v0.1 scheme) | auto (option only)
static var _loaded := false

static func load_all() -> void:
	if _loaded: return
	_loaded = true
	var cf := ConfigFile.new()
	if cf.load(PATH) != OK: return
	var c: String = cf.get_value("view", "camera", cam_mode)
	if c in CAM_MODES: cam_mode = c
	var w: String = cf.get_value("controls", "weapons_v3", weapon_mode)
	if w in WEAPON_MODES: weapon_mode = w

static func save() -> void:
	var cf := ConfigFile.new()
	cf.set_value("view", "camera", cam_mode)
	cf.set_value("controls", "weapons_v3", weapon_mode)
	cf.save(PATH)

static func next_cam() -> String:
	cam_mode = CAM_MODES[(CAM_MODES.find(cam_mode) + 1) % CAM_MODES.size()]
	save()
	return cam_mode

static func toggle_weapons() -> String:
	weapon_mode = WEAPON_MODES[(WEAPON_MODES.find(weapon_mode) + 1) % WEAPON_MODES.size()]
	save()
	return weapon_mode
