class_name Sfx
extends Node
## EIDOLON soundscape v0.4: AMBIENT, not songs. Every room is a mix of looping recorded layers (CC0 /
## CC-BY, see CREDITS.md) that crossfade (3 s) as you move, plus rare random "events" (a distant bell,
## a chime, a creak, a crow) every 20-60 s. Almost no melody.
##
##   gate    dark drone bed + soft wind + the pool's water + distant bells
##   hall    low hall room-tone + a glassy resonant hum + faint glass tinkles
##   garden  a thinner drone + wind in dead branches + far birds / crows, creaking trees
##   court   a warmer harmonic drone + a faint distant choir + the beam's hum
##   shrine  a deep sacred drone + the choir
##   bridges / ledges  stronger wind gusts (set_wind)
##
## Why v0.2 sounded like static on a phone: its synthesised beds sat 92-100 % below 200 Hz, which phone
## speakers cannot play. Every layer here is high-passed at 150 Hz and sits in the 200 Hz - 8 kHz band.
## Web rules kept: static bus layout, Sample playback (reverb is baked into the files), start on a
## gesture, layers are loaded on first use.

const LAYERS := {
	# name: [file, level dB]
	"bed_dark": ["amb/bed_dark.ogg", -6.0],
	"bed_hall": ["amb/bed_hall.ogg", -5.0],
	"bed_court": ["amb/bed_court.ogg", -6.0],
	"bed_shrine": ["amb/bed_shrine.ogg", -6.0],
	"wind_soft": ["amb/wind_soft.ogg", -9.0],
	"garden_air": ["amb/garden_air.ogg", -8.0],
	"garden_branches": ["amb/garden_branches.ogg", -8.0],
	"glass_hum": ["amb/glass_hum.ogg", -8.0],
	"choir": ["amb/choir.ogg", -10.0],
}
## per room: layer -> offset dB (absent = silent)
const ROOMS := {
	"gate": {"bed_dark": 0.0, "wind_soft": 0.0},
	"hall": {"bed_hall": 0.0, "glass_hum": 0.0, "bed_dark": -12.0},
	"garden": {"bed_dark": -4.0, "garden_air": 0.0, "garden_branches": 0.0, "wind_soft": -5.0},
	"court": {"bed_court": 0.0, "choir": -5.0, "bed_dark": -12.0},
	"shrine": {"bed_shrine": 0.0, "choir": -2.0, "wind_soft": -6.0},
}
## rare events per room: [sound, dB, pitch range]
const EVENTS := {
	"gate": [["bell_far", -16.0, 0.85], ["ev_chime", -20.0, 0.9], ["ev_stone", -20.0, 0.8], ["bell", -22.0, 0.75]],
	"hall": [["ev_chime", -18.0, 1.0], ["glass", -20.0, 0.8], ["bell_far", -20.0, 1.1]],
	"garden": [["ev_crow0", -22.0, 0.95], ["ev_crow1", -24.0, 0.95], ["ev_creak", -14.0, 0.9], ["bell_far", -20.0, 0.8]],
	"court": [["bell", -20.0, 0.67], ["ev_chime", -20.0, 0.84], ["ev_stone", -20.0, 0.75]],
	"shrine": [["bell_far", -14.0, 0.7], ["ev_chime", -18.0, 0.75], ["bell", -22.0, 0.6]],
}
const XFADE := 3.0
## v0.5: the composed score (assets/audio/v5/manifest.json, dev/ROOMS.md). Absent or incomplete: each
## Chapter I room falls back to the v0.4 room it grew out of.
const MANIFEST := "res://assets/audio/v5/manifest.json"
const V5 := "res://assets/audio/v5/"
const FALLBACK_ROOM := {
	"waking_pool": "gate", "stair_breath": "gate", "hall_glass": "hall", "shard_gallery": "hall",
	"garden_veiled": "garden", "hollow_walk": "garden", "court_light": "court", "mist_maze": "garden",
	"echo_corridor": "hall", "scales": "court", "eidolon_ledge": "court", "gate_four": "shrine", "first_shrine": "shrine",
}
## v0.4 sounds for the v0.5 cues when the manifest has none: [sound, dB, pitch]
const FALLBACK_CUE := {
	"shrine_awaken": ["bell_far", -8.0, 0.8], "cinematic_hand": ["bell", -10.0, 0.6], "glimpse": ["glass", -18.0, 0.62],
	"glimpse_far": ["bell_far", -14.0, 0.7], "breath": ["whoosh", -22.0, 1.6], "touch_glass": ["glass", -14.0, 0.8],
	"statue_turn": ["stone_turn", -9.0, 1.1], "cloth": ["cloth", -24.0, 1.0], "footsteps_water": ["step_wet", -20.0, 0.9],
	"footsteps_stone": ["step_stone", -17.0, 1.0],
}

const SFX := {
	"step_stone": 10, "step_hall": 5, "step_wood": 4, "step_wet": 3, "cloth": 4,
	"bell": 2, "glass": 2,
}
const SINGLE := ["water_loop", "hum_loop", "stone_door", "stone_turn", "bell_far", "glass_tink", "click", "flip",
	"rattle", "thud", "whoosh", "page"]
const AMB_SINGLE := ["ev_creak", "ev_stone", "ev_crow0", "ev_crow1", "ev_chime", "wind_gust"]
## older names the game still uses -> recorded sounds
const ALIAS := {"chime": "glass", "chime_hall": "glass", "tinkle": "glass_tink", "grind": "stone_turn", "turn": "stone_turn",
	"door": "stone_door", "piano": "bell", "step": "step_stone"}

var streams := {}            # name -> Array[AudioStream]
var players: Array[AudioStreamPlayer] = []
var layer_p := {}            # layer -> AudioStreamPlayer (created on first use)
var layer_db := {}           # layer -> current dB
var _started := false
var _music_cur := ""         # the current room (state hook)
var water_player: AudioStreamPlayer
var hum_player: AudioStreamPlayer
var gust_player: AudioStreamPlayer
var drone: AudioStreamPlayer   # state hook: the current room's bed
var _next := 0
var ready_ok := false
var music_bus := 0
var sfx_bus := 0
var music_on := true
var area := "gate"
var water_target := 0.0
var wind_target := 0.0
var swell_boost := 0.0
var _event_t := 14.0
var _last_event := ""
var _tinkle_t := 5.0
var _rng := RandomNumberGenerator.new()
var played := {}
var manifest := {}           # v0.5: parsed manifest.json (empty = fall back)
var layers := LAYERS.duplicate(true)
var rooms := ROOMS.duplicate(true)
var events := EVENTS.duplicate(true)
var room_events := {}        # v0.5 room -> [[stream key, dB, min_s, max_s]]

func _ready() -> void:
	_rng.randomize()
	music_bus = AudioServer.get_bus_index("Music")
	sfx_bus = AudioServer.get_bus_index("SFX")
	AudioServer.set_bus_volume_db(music_bus, -40.0)
	AudioServer.set_bus_volume_db(sfx_bus, -3.0)
	for i in 12: players.append(_player("SFX"))
	water_player = _player("Music")
	hum_player = _player("Music")
	gust_player = _player("Music")
	drone = _player("Music")
	for k in SFX.keys():
		var arr: Array = []
		for i in SFX[k]: arr.append(load("res://assets/audio/sfx/%s_%d.ogg" % [k, i]))
		streams[k] = arr
	for k in SINGLE: streams[k] = [load("res://assets/audio/sfx/%s.ogg" % k)]
	for k in AMB_SINGLE: streams[k] = [load("res://assets/audio/amb/%s.ogg" % k)]
	for k in ["water_loop", "hum_loop", "wind_gust"]:
		var s: AudioStreamOggVorbis = streams[k][0]
		s.loop = true
	_load_manifest()
	ready_ok = true

## v0.5: read the composed score's manifest; every file is checked, a missing one is skipped
func _load_manifest() -> void:
	if not FileAccess.file_exists(MANIFEST): return
	var d = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST))
	if not d is Dictionary: return
	manifest = d
	var rs: Dictionary = d.get("rooms", {})
	for room in rs:
		var r: Dictionary = rs[room]
		var mix := {}
		for L in r.get("layers", []):
			var f := str(L.get("file", ""))
			if not ResourceLoader.exists(V5 + f): continue
			var key := "v5:" + f
			layers[key] = ["v5/" + f, float(L.get("gain_db", 0.0))]
			mix[key] = 0.0
		if not mix.is_empty(): rooms[room] = mix
		var evs := []
		for e in r.get("events", []):
			var f2 := str(e.get("file", ""))
			if not _v5_stream("v5:" + f2, f2): continue
			evs.append(["v5:" + f2, float(e.get("gain_db", -6.0)), float(e.get("min_s", 20.0)), float(e.get("max_s", 60.0))])
		if not evs.is_empty(): room_events[room] = evs
	var cues: Dictionary = d.get("cues", {})
	for k in cues:
		var arr: Array = cues[k] if cues[k] is Array else [cues[k]]
		var ok: Array = []
		for f3 in arr:
			var st = _v5_load(str(f3))
			if st: ok.append(st)
		if not ok.is_empty(): streams["cue:" + k] = ok
	for k in ["footsteps_stone", "footsteps_water"]:
		if streams.has("cue:" + k): streams[{"footsteps_stone": "step_stone", "footsteps_water": "step_wet"}[k]] = streams["cue:" + k]
	if streams.has("cue:cloth"): streams["cloth"] = streams["cue:cloth"]
	print("[audio] v5 manifest: %d rooms, %d cues" % [rooms.size() - ROOMS.size(), cues.size()])

func _v5_load(f: String) -> AudioStream:
	if f == "" or not ResourceLoader.exists(V5 + f): return null
	return load(V5 + f)

func _v5_stream(key: String, f: String) -> bool:
	if streams.has(key): return true
	var st := _v5_load(f)
	if st == null: return false
	streams[key] = [st]
	return true

## the room whose layers play: a v0.5 room id, or the v0.4 room it falls back to
func _room(key: String) -> String:
	if rooms.has(key): return key
	return FALLBACK_ROOM.get(key, key)

## a named cue from the score (statue_turn, breath, touch_glass, solve_<room>, ...); falls back to a
## v0.4 sound. Returns false when there was nothing to play.
func cue(name: String, vol_db := 0.0) -> bool:
	if not ready_ok: return false
	played["cue:" + name] = played.get("cue:" + name, 0) + 1
	if streams.has("cue:" + name):
		play("cue:" + name, vol_db, 1.0)
		return true
	if name.begins_with("solve_"):
		resolve(0)
		return true
	if FALLBACK_CUE.has(name):
		var f: Array = FALLBACK_CUE[name]
		play(f[0], f[1] + vol_db, f[2] * _rng.randf_range(0.96, 1.04))
		return true
	return false

func play_later(name: String, delay: float, vol_db := 0.0, pitch := 1.0) -> void:
	get_tree().create_timer(delay).timeout.connect(func() -> void: play(name, vol_db, pitch))

func _player(bus: String, vol := -80.0) -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = bus
	p.volume_db = vol
	add_child(p)
	return p

func build_step() -> bool:
	return true

func build() -> void:
	pass

# ------------------------------------------------------------------ ambient layers
func _layer(name: String) -> AudioStreamPlayer:
	if not layer_p.has(name):
		var st: AudioStream = load("res://assets/audio/" + layers[name][0])
		if st is AudioStreamOggVorbis: (st as AudioStreamOggVorbis).loop = true
		elif st is AudioStreamWAV:
			var wv := st as AudioStreamWAV
			if wv.loop_mode == AudioStreamWAV.LOOP_DISABLED:
				wv.loop_mode = AudioStreamWAV.LOOP_FORWARD
				wv.loop_end = int(wv.get_length() * wv.mix_rate)
		var p := _player("Music")
		p.stream = st
		layer_p[name] = p
		layer_db[name] = -60.0
		p.volume_db = -60.0
		p.play(_rng.randf_range(0.0, st.get_length() * 0.8))
	return layer_p[name]

func _target(name: String) -> float:
	var rk := _room(area)
	var room: Dictionary = rooms.get(rk, {})
	if not room.has(name): return -60.0
	var db: float = layers[name][1] + room[name]
	if name == "choir": db += swell_boost
	if (name.begins_with("bed") or name.begins_with("v5:")) and rk in ["shrine", "court", "first_shrine", "gate_four"]: db += swell_boost * 0.4
	return db

func start_music() -> void:
	if _started: return
	_started = true
	water_player.stream = streams["water_loop"][0]
	water_player.play()
	gust_player.stream = streams["wind_gust"][0]
	gust_player.play(_rng.randf_range(0.0, 30.0))
	_enter(area)
	var tw := create_tween()
	tw.tween_method(func(v: float) -> void: AudioServer.set_bus_volume_db(music_bus, v), -40.0, 0.0, 4.0)

func _enter(key: String) -> void:
	_music_cur = key
	var rk := _room(key)
	var room: Dictionary = rooms.get(rk, {})
	for n in room: _layer(n)
	var bed := ""
	for n in room:
		if (n.begins_with("bed") or n.begins_with("v5:")) and room[n] == 0.0 and bed == "": bed = n
	if bed != "": drone = layer_p[bed]
	_event_t = _rng.randf_range(10.0, 25.0)

func set_music(on: bool) -> void:
	music_on = on
	AudioServer.set_bus_mute(music_bus, not on)

func set_area(key: String) -> void:
	area = key
	if _started and rooms.has(_room(key)): _enter(key)

## exposed bridges and ledges: the gusts rise (0..1)
func set_wind(k: float) -> void:
	wind_target = k

func set_water(k: float) -> void:
	water_target = k

func _process(dt: float) -> void:
	if not _started: return
	var step := dt * 60.0 / XFADE              # dB per second so a full fade takes ~XFADE s
	for n in layer_p:
		var p: AudioStreamPlayer = layer_p[n]
		var t := _target(n)
		layer_db[n] = move_toward(layer_db[n], t, step * (1.6 if t > layer_db[n] else 1.0))
		p.volume_db = layer_db[n]
	water_player.volume_db = move_toward(water_player.volume_db, linear_to_db(maxf(water_target, 0.0001)) - 14.0, dt * 14.0)
	var gk := clampf((wind_target - 0.5) / 0.45, 0.0, 1.0)
	gust_player.volume_db = move_toward(gust_player.volume_db, linear_to_db(maxf(gk, 0.0001)) - 9.0, dt * 12.0)
	# rare, random, never the same twice in a row
	_event_t -= dt
	if _event_t <= 0.0:
		_event_t = _rng.randf_range(20.0, 60.0)
		var evs: Array = events.get(_room(area), [])
		if room_events.has(area):
			var re: Array = room_events[area]
			var e5: Array = re[_rng.randi_range(0, re.size() - 1)]
			play(e5[0], e5[1] + _rng.randf_range(-2.0, 0.5), 1.0)
			played["event"] = played.get("event", 0) + 1
			_event_t = _rng.randf_range(e5[2], maxf(e5[2], e5[3]))
			evs = []
		if evs.size() > 0:
			var e: Array = evs[_rng.randi_range(0, evs.size() - 1)]
			if e[0] == _last_event and evs.size() > 1: e = evs[(evs.find(e) + 1) % evs.size()]
			_last_event = e[0]
			play(e[0], e[1] + _rng.randf_range(-3.0, 1.0), e[2] * _rng.randf_range(0.94, 1.06))
			played["event"] = played.get("event", 0) + 1
	if _room(area) == "hall":
		_tinkle_t -= dt
		if _tinkle_t <= 0.0:
			_tinkle_t = _rng.randf_range(5.0, 11.0)
			play("glass_tink", -28.0 + _rng.randf_range(-3.0, 1.0), _rng.randf_range(0.8, 1.3))

# ------------------------------------------------------------------ effects
func play(name: String, vol_db := 0.0, pitch := 1.0) -> void:
	if not ready_ok: return
	var key: String = ALIAS.get(name, name)
	if not streams.has(key): return
	played[name] = played.get(name, 0) + 1
	var arr: Array = streams[key]
	var p := players[_next]
	_next = (_next + 1) % players.size()
	p.stream = arr[_rng.randi_range(0, arr.size() - 1)]
	p.volume_db = vol_db
	p.pitch_scale = pitch
	p.play()

## soft, quiet footsteps: 4-10 recorded variants per surface, random pitch +-5 %, random level
func footstep(surface: String, strength: float) -> void:
	var key := "step_stone"
	match surface:
		"hall": key = "step_hall"
		"wood": key = "step_wood"
		"water": key = "step_wet"
	var base: float = {"step_stone": -17.0, "step_hall": -12.0, "step_wood": -19.0, "step_wet": -17.0}[key]
	play(key, base + strength * 2.0 + _rng.randf_range(-2.0, 1.0), _rng.randf_range(0.95, 1.05))
	played["step"] = played.get("step", 0) + 1

## the beam's low hum (Court of Light)
func set_hum(level: float) -> void:
	if level > 0.01 and not hum_player.playing:
		hum_player.stream = streams["hum_loop"][0]
		hum_player.play()
	hum_player.volume_db = linear_to_db(maxf(level, 0.0001)) - 15.0
	if level <= 0.01 and hum_player.playing: hum_player.stop()

## a puzzle solved: a struck bell and a glass answer, gently
func resolve(root := 0) -> void:
	played["resolve"] = played.get("resolve", 0) + 1
	play("bell", -11.0, pow(2.0, root / 24.0))
	get_tree().create_timer(0.45).timeout.connect(func() -> void: play("glass", -15.0, 1.0))

## the shrine wakes: the choir rises out of the drone, a deep bell, glass shimmer (ambient, no song)
func swell() -> void:
	played["swell"] = played.get("swell", 0) + 1
	if _started:
		_layer("choir")
		var tw := create_tween()
		tw.tween_property(self, "swell_boost", 9.0, 5.0).set_trans(Tween.TRANS_SINE)
		tw.tween_interval(10.0)
		tw.tween_property(self, "swell_boost", 0.0, 8.0).set_trans(Tween.TRANS_SINE)
	play("bell_far", -8.0, 0.8)
	get_tree().create_timer(2.2).timeout.connect(func() -> void: play("bell", -12.0, 0.6))
	for i in 4:
		get_tree().create_timer(4.0 + i * 0.7).timeout.connect(func() -> void: play("glass", -19.0, [1.0, 1.12, 1.26, 1.5][i]))

func chord(_semis: Array, vol_db := -6.0, _spread := 0.09) -> void:
	play("bell", vol_db - 2.0, 0.8)
